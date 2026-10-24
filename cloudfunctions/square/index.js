const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const COL = 'square_posts'

// 集合为空时的演示案例（已脱敏，不含任何用户信息）
const SEED = [
  {
    petKind: '猫',
    petBreed: '布偶猫',
    title: '布偶猫呕吐怎么办',
    excerpt: '3个月布偶猫，昨晚吐了两次未消化的猫粮，精神食欲还正常，需要马上就医吗？',
    comments: [
      { content: '少食多餐观察一下，精神好一般问题不大', createdAt: 1730000000000 },
      { content: '我家猫以前也这样，换粮太快引起的', createdAt: 1730001000000 }
    ]
  },
  {
    petKind: '狗',
    petBreed: '金毛',
    title: '狗狗拉稀带血丝',
    excerpt: '金毛昨晚偷吃了半根火腿肠，今天拉稀带少量血丝，活泼能吃，急！',
    comments: [{ content: '便血别拖，建议做个细小检测', createdAt: 1730002000000 }]
  },
  {
    petKind: '猫',
    petBreed: '英短',
    title: '猫咪频繁挠耳朵',
    excerpt: '英短最近老挠耳朵，耳朵里有很多黑褐色耳垢，是耳螨吗？',
    comments: [
      { content: '像耳螨，用洁耳液+驱虫药，坚持两周', createdAt: 1730003000000 },
      { content: '去宠物医院做个耳镜更放心', createdAt: 1730003100000 }
    ]
  }
]

async function ensureCollection() {
  try {
    await db.createCollection(COL)
  } catch (e) {}
}

// 默认评论注入 openid
function withOwner(comments, openid) {
  return (comments || []).map(c => Object.assign({ _openid: openid, likes: 0 }, c))
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action
  const col = db.collection(COL)

  try {
    await ensureCollection()

    if (action === 'list') {
      let posts = []
      try {
        const res = await col.orderBy('createdAt', 'desc').limit(50).get()
        posts = res.data
      } catch (e) {
        posts = []
      }
      if (!posts.length) {
        // 初始化演示案例
        for (const s of SEED) {
          await col.add({
            data: {
              _openid: 'demo',
              petKind: s.petKind,
              petBreed: s.petBreed,
              title: s.title,
              excerpt: s.excerpt,
              likes: [],
              comments: withOwner(s.comments, 'demo'),
              demo: true,
              createdAt: Date.now() - Math.floor(Math.random() * 86400000)
            }
          })
        }
        const res = await col.orderBy('createdAt', 'desc').limit(50).get()
        posts = res.data
      }
      return { ok: true, data: posts }
    }

    if (action === 'like') {
      const res = await col.where({ _id: event.id }).limit(1).get()
      if (!res.data.length) return { ok: false, msg: '案例不存在' }
      const post = res.data[0]
      const likes = post.likes || []
      const idx = likes.indexOf(OPENID)
      if (idx >= 0) likes.splice(idx, 1)
      else likes.push(OPENID)
      await col.doc(event.id).update({ data: { likes } })
      return { ok: true, data: { likes } }
    }

    if (action === 'comment') {
      const content = (event.content || '').trim().slice(0, 200)
      if (!content) return { ok: false, msg: '评论不能为空' }
      const comment = { _openid: OPENID, content, createdAt: Date.now() }
      await col.doc(event.id).update({
        data: { comments: _.push(comment) }
      })
      return { ok: true, data: { comment } }
    }

    if (action === 'publish') {
      // 脱敏发布：只保留物种/品种与症状描述，不含用户信息
      const p = event.post || {}
      const data = {
        _openid: OPENID,
        petKind: String(p.petKind || '宠物').slice(0, 10),
        petBreed: String(p.petBreed || '').slice(0, 20),
        title: String(p.title || '').slice(0, 40),
        excerpt: String(p.excerpt || '').slice(0, 120),
        likes: [],
        comments: [],
        fromConsult: true,
        createdAt: Date.now()
      }
      if (!data.title) return { ok: false, msg: '内容为空' }
      const res = await col.add({ data })
      return { ok: true, data: { _id: res._id } }
    }

    return { ok: false, msg: '未知操作' }
  } catch (err) {
    console.error('[square]', err)
    return { ok: false, msg: err.message || '服务异常' }
  }
}
