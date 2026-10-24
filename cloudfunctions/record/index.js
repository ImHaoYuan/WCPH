const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const COL = 'records'

async function ensureCollection() {
  try {
    await db.createCollection(COL)
  } catch (e) {}
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action
  const col = db.collection(COL)

  try {
    await ensureCollection()

    if (action === 'list') {
      const res = await col
        .where({ _openid: OPENID })
        .field({ petName: true, petAvatar: true, title: true, createdAt: true, messages: true })
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get()
      return { ok: true, data: res.data }
    }

    if (action === 'get') {
      const res = await col.where({ _openid: OPENID, _id: event.id }).limit(1).get()
      if (!res.data.length) return { ok: false, msg: '记录不存在' }
      return { ok: true, data: res.data[0] }
    }

    if (action === 'add') {
      const r = event.record || {}
      const data = {
        _openid: OPENID,
        petId: r.petId || '',
        petName: r.petName || '',
        petAvatar: r.petAvatar || '',
        title: r.title || '新问诊',
        messages: r.messages || [],
        createdAt: Date.now()
      }
      const res = await col.add({ data })
      return { ok: true, data: Object.assign({ _id: res._id }, data) }
    }

    if (action === 'update') {
      const exist = await col.where({ _openid: OPENID, _id: event.id }).limit(1).get()
      if (!exist.data.length) return { ok: false, msg: '记录不存在' }
      const r = event.record || {}
      const data = {
        title: r.title !== undefined ? r.title : exist.data[0].title,
        messages: r.messages !== undefined ? r.messages : exist.data[0].messages,
        updatedAt: Date.now()
      }
      await col.doc(event.id).update({ data })
      return { ok: true, data: Object.assign({}, exist.data[0], data) }
    }

    if (action === 'remove') {
      const exist = await col.where({ _openid: OPENID, _id: event.id }).limit(1).get()
      if (!exist.data.length) return { ok: false, msg: '记录不存在' }
      await col.doc(event.id).remove()
      return { ok: true, data: { id: event.id } }
    }

    return { ok: false, msg: '未知操作' }
  } catch (err) {
    console.error('[record]', err)
    return { ok: false, msg: err.message || '服务异常' }
  }
}
