const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const USERS = 'users'
const CODES = 'sms_codes'

async function ensureCollection(name) {
  try {
    await db.createCollection(name)
  } catch (e) {
    // 已存在则忽略
  }
}

async function upsertUser(openid, phone, extra) {
  await ensureCollection(USERS)
  const col = db.collection(USERS)
  const exist = await col.where({ _openid: openid }).limit(1).get()
  const now = Date.now()
  if (exist.data.length) {
    const doc = exist.data[0]
    await col.doc(doc._id).update({
      data: Object.assign({ phone, updatedAt: now }, extra || {})
    })
    return Object.assign({}, doc, { phone, openid }, extra || {})
  }
  const data = Object.assign(
    { _openid: openid, phone, createdAt: now, updatedAt: now },
    extra || {}
  )
  const res = await col.add({ data })
  return Object.assign({ _id: res._id }, data, { openid })
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action

  try {
    if (action === 'sendCode') {
      const phone = String(event.phone || '')
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        return { ok: false, msg: '手机号格式不正确' }
      }
      await ensureCollection(CODES)
      const code = String(Math.floor(100000 + Math.random() * 900000))
      const col = db.collection(CODES)
      const exist = await col.where({ _openid: OPENID, phone }).limit(1).get()
      const expireAt = Date.now() + 5 * 60 * 1000
      if (exist.data.length) {
        await col.doc(exist.data[0]._id).update({ data: { code, expireAt } })
      } else {
        await col.add({ data: { _openid: OPENID, phone, code, expireAt } })
      }
      // 演示环境无短信服务商，直接回传验证码供页面提示；生产应改为短信下发并移除该字段
      return { ok: true, data: { code } }
    }

    if (action === 'smsLogin') {
      const phone = String(event.phone || '')
      const code = String(event.code || '')
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        return { ok: false, msg: '手机号格式不正确' }
      }
      const exist = await db
        .collection(CODES)
        .where({ _openid: OPENID, phone })
        .limit(1)
        .get()
      if (!exist.data.length) {
        return { ok: false, msg: '请先获取验证码' }
      }
      const rec = exist.data[0]
      if (rec.code !== code) {
        return { ok: false, msg: '验证码错误' }
      }
      if (rec.expireAt < Date.now()) {
        return { ok: false, msg: '验证码已过期，请重新获取' }
      }
      const user = await upsertUser(OPENID, phone, {
        nickname: '微信用户' + phone.slice(-4),
        avatarUrl: ''
      })
      await db.collection(CODES).doc(rec._id).remove()
      return { ok: true, data: { openid: OPENID, phone, nickname: user.nickname, avatarUrl: user.avatarUrl } }
    }

    if (action === 'phoneLogin') {
      let phone = ''
      if (event.cloudID) {
        const res = await cloud.getOpenData({ list: [event.cloudID] })
        const info = res.list && res.list[0] && res.list[0].data
        phone = (info && info.phoneNumber) || ''
      }
      if (!phone) {
        return { ok: false, msg: '未获取到手机号' }
      }
      const user = await upsertUser(OPENID, phone, {
        nickname: '微信用户' + phone.slice(-4),
        avatarUrl: ''
      })
      return { ok: true, data: { openid: OPENID, phone, nickname: user.nickname, avatarUrl: user.avatarUrl } }
    }

    // 更新头像/昵称
    if (action === 'updateProfile') {
      const nickname = String(event.nickname || '').trim().slice(0, 20)
      const avatarUrl = String(event.avatarUrl || '').slice(0, 300)
      if (!nickname && !avatarUrl) {
        return { ok: false, msg: '没有需要更新的内容' }
      }
      const extra = {}
      if (nickname) extra.nickname = nickname
      if (avatarUrl) extra.avatarUrl = avatarUrl
      const user = await upsertUser(OPENID, event.phone || '', extra)
      return {
        ok: true,
        data: { openid: OPENID, phone: user.phone, nickname: user.nickname, avatarUrl: user.avatarUrl }
      }
    }

    return { ok: false, msg: '未知操作' }
  } catch (err) {
    console.error('[login]', err)
    return { ok: false, msg: err.message || '服务异常' }
  }
}
