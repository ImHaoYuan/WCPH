const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const USERS = 'users'
const CODES = 'sms_codes'
const ACCOUNTS = 'accounts'
const ADMINS = 'admins'

// 首次管理员登录时自动播种的默认管理员账号
const DEFAULT_ADMIN = { username: 'admin', password: 'Admin@123456' }

function hashPwd(password, salt) {
  return crypto.createHash('sha256').update(salt + '|' + password).digest('hex')
}

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
    const patch = Object.assign({ updatedAt: now }, extra || {})
    if (phone) patch.phone = phone
    await col.doc(doc._id).update({ data: patch })
    return Object.assign({}, doc, patch, { openid })
  }
  const data = Object.assign(
    {
      _openid: openid,
      phone: phone || '',
      nickname: phone ? '微信用户' + phone.slice(-4) : ((extra && (extra.nickname || extra.username)) || '宠物用户'),
      avatarUrl: '',
      createdAt: now,
      updatedAt: now
    },
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
      const user = await upsertUser(OPENID, phone)
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
      const user = await upsertUser(OPENID, phone)
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

    // ===== 账号密码登录（账号由管理员在后台创建） =====
    if (action === 'accountLogin') {
      const username = String(event.username || '').trim()
      const password = String(event.password || '')
      if (!username || !password) {
        return { ok: false, msg: '请输入账号和密码' }
      }
      await ensureCollection(ACCOUNTS)
      const exist = await db
        .collection(ACCOUNTS)
        .where({ username })
        .limit(1)
        .get()
      if (!exist.data.length) {
        return { ok: false, msg: '账号不存在，请联系管理员添加' }
      }
      const acc = exist.data[0]
      if (hashPwd(password, acc.salt || '') !== acc.passwordHash) {
        return { ok: false, msg: '密码错误' }
      }
      await upsertUser(OPENID, '', {
        accountId: acc._id,
        username
      })
      return {
        ok: true,
        data: {
          openid: OPENID,
          accountId: acc._id,
          username,
          nickname: acc.nickname || username,
          phone: '',
          role: 'user'
        }
      }
    }

    // ===== 管理员账号密码登录 =====
    if (action === 'adminLogin') {
      const username = String(event.username || '').trim()
      const password = String(event.password || '')
      if (!username || !password) {
        return { ok: false, msg: '请输入账号和密码' }
      }
      await ensureCollection(ADMINS)
      const exist = await db
        .collection(ADMINS)
        .where({ username })
        .limit(1)
        .get()
      if (!exist.data.length) {
        // 首次登录：自动播种默认管理员（admin / Admin@123456）
        if (username === DEFAULT_ADMIN.username && password === DEFAULT_ADMIN.password) {
          const salt = crypto.randomBytes(8).toString('hex')
          await db.collection(ADMINS).add({
            data: {
              _openid: OPENID,
              username,
              passwordHash: hashPwd(password, salt),
              salt,
              createdAt: Date.now()
            }
          })
          return { ok: true, data: { openid: OPENID, username, role: 'admin' } }
        }
        return { ok: false, msg: '管理员账号不存在' }
      }
      const acc = exist.data[0]
      if (hashPwd(password, acc.salt || '') !== acc.passwordHash) {
        return { ok: false, msg: '密码错误' }
      }
      // 绑定当前 openid：管理员换设备时以账号密码为准
      if (acc._openid !== OPENID) {
        await db.collection(ADMINS).doc(acc._id).update({ data: { _openid: OPENID } })
      }
      return { ok: true, data: { openid: OPENID, username, role: 'admin' } }
    }

    return { ok: false, msg: '未知操作' }
  } catch (err) {
    console.error('[login]', err)
    return { ok: false, msg: err.message || '服务异常' }
  }
}
