const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const COL = 'reminders'
const TYPES = ['vaccine', 'deworm_in', 'deworm_out', 'recheck', 'medication', 'custom']
const REPEATS = ['none', 'monthly', 'quarterly', 'yearly']
const REPEAT_MONTHS = { monthly: 1, quarterly: 3, yearly: 12 }

async function ensureCollection() {
  try {
    await db.createCollection(COL)
  } catch (e) {}
}

const EDITABLE_FIELDS = ['petId', 'petName', 'type', 'title', 'dueAt', 'repeat']

function pick(r) {
  const out = {}
  EDITABLE_FIELDS.forEach(k => {
    if (r[k] !== undefined) out[k] = r[k]
  })
  return out
}

// 从到期日开始按周期逐次推进，直到下一次到期时间在未来
function nextDue(dueAt, repeat) {
  const months = REPEAT_MONTHS[repeat]
  if (!months) return null
  let ts = dueAt
  for (let i = 0; i < 60; i++) {
    const d = new Date(ts)
    d.setMonth(d.getMonth() + months)
    ts = d.getTime()
    if (ts > Date.now()) return ts
  }
  return null
}

async function findOwn(openid, id) {
  const res = await db.collection(COL).where({ _openid: openid, _id: id }).limit(1).get()
  return res.data[0] || null
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action
  const col = db.collection(COL)

  try {
    await ensureCollection()

    if (action === 'list') {
      const res = await col.where({ _openid: OPENID }).orderBy('dueAt', 'desc').limit(100).get()
      // 懒更新：待完成的提醒过期后（早于今天零点）落库为 expired
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const expired = res.data.filter(r => r.status === 'pending' && r.dueAt < todayStart.getTime())
      if (expired.length) {
        await Promise.all(
          expired.map(r => col.doc(r._id).update({ data: { status: 'expired', updatedAt: Date.now() } }))
        )
        expired.forEach(r => {
          r.status = 'expired'
        })
      }
      return { ok: true, data: res.data }
    }

    if (action === 'get') {
      const rec = await findOwn(OPENID, event.id)
      if (!rec) return { ok: false, msg: '提醒不存在' }
      return { ok: true, data: rec }
    }

    if (action === 'add') {
      const r = event.reminder || {}
      const title = String(r.title || '').trim().slice(0, 30)
      const dueAt = Number(r.dueAt)
      if (!title) return { ok: false, msg: '请填写提醒内容' }
      if (TYPES.indexOf(r.type) < 0) return { ok: false, msg: '提醒类型不正确' }
      if (REPEATS.indexOf(r.repeat) < 0) return { ok: false, msg: '重复周期不正确' }
      if (!isFinite(dueAt) || dueAt <= 0) return { ok: false, msg: '请选择到期日期' }
      const data = Object.assign(
        {
          _openid: OPENID,
          petId: '',
          petName: '',
          type: r.type,
          title,
          dueAt,
          repeat: r.repeat,
          status: 'pending',
          notifiedAt: 0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        pick(r)
      )
      const res = await col.add({ data })
      return { ok: true, data: Object.assign({ _id: res._id }, data) }
    }

    if (action === 'update') {
      const exist = await findOwn(OPENID, event.id)
      if (!exist) return { ok: false, msg: '提醒不存在' }
      const r = event.reminder || {}
      const data = pick(r)
      if (data.title !== undefined && !String(data.title).trim()) {
        return { ok: false, msg: '请填写提醒内容' }
      }
      if (data.dueAt !== undefined && (!isFinite(Number(data.dueAt)) || Number(data.dueAt) <= 0)) {
        return { ok: false, msg: '请选择到期日期' }
      }
      if (data.repeat !== undefined && REPEATS.indexOf(data.repeat) < 0) {
        return { ok: false, msg: '重复周期不正确' }
      }
      data.updatedAt = Date.now()
      // 修改了到期时间后允许重新触发订阅通知
      if (data.dueAt !== undefined && data.dueAt !== exist.dueAt) data.notifiedAt = 0
      await col.doc(event.id).update({ data })
      return { ok: true, data: Object.assign({}, exist, data) }
    }

    if (action === 'complete' || action === 'skip') {
      const exist = await findOwn(OPENID, event.id)
      if (!exist) return { ok: false, msg: '提醒不存在' }
      const status = action === 'complete' ? 'done' : 'skipped'
      // 仅待办/已过期可流转，避免重复点击产生多条下一次提醒
      if (exist.status !== 'pending' && exist.status !== 'expired') {
        return { ok: true, data: { id: event.id, status: exist.status } }
      }
      await col.doc(event.id).update({ data: { status, updatedAt: Date.now() } })
      // 周期提醒：完成后自动排下一次
      let next = null
      if (exist.repeat && exist.repeat !== 'none') {
        const dueAt = nextDue(exist.dueAt, exist.repeat)
        if (dueAt) {
          const data = {
            _openid: OPENID,
            petId: exist.petId || '',
            petName: exist.petName || '',
            type: exist.type || 'custom',
            title: exist.title,
            dueAt,
            repeat: exist.repeat,
            status: 'pending',
            notifiedAt: 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
          const res = await col.add({ data })
          next = Object.assign({ _id: res._id }, data)
        }
      }
      return { ok: true, data: { id: event.id, status, next } }
    }

    if (action === 'reopen') {
      const exist = await findOwn(OPENID, event.id)
      if (!exist) return { ok: false, msg: '提醒不存在' }
      // 到期时间已过时恢复为今天到期，避免列表懒更新立刻又置为 expired
      const data = { status: 'pending', updatedAt: Date.now() }
      if (exist.dueAt < Date.now()) data.dueAt = Date.now()
      await col.doc(event.id).update({ data })
      return { ok: true, data: { id: event.id, status: 'pending' } }
    }

    if (action === 'remove') {
      const exist = await findOwn(OPENID, event.id)
      if (!exist) return { ok: false, msg: '提醒不存在' }
      await col.doc(event.id).remove()
      return { ok: true, data: { id: event.id } }
    }

    return { ok: false, msg: '未知操作' }
  } catch (err) {
    console.error('[reminder]', err)
    return { ok: false, msg: err.message || '服务异常' }
  }
}
