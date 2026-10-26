const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const COL = 'square_posts'
const REPORT_COL = 'square_reports'
const NOTIFY_COL = 'square_notifications'
const PAGE_SIZE = 10

// 管理员白名单：填入管理员的 openid（可在云开发控制台 → 数据库 → users 集合查看）
const ADMIN_OPENIDS = ['o6oL4xUswvY3jsbrfMFNKiziEg4I']

// 集合为空时的演示案例（已脱敏，不含任何用户信息）
const SEED = [
  {
    petKind: '猫',
    petBreed: '布偶猫',
    part: '其他',
    title: '布偶猫呕吐怎么办',
    excerpt: '3个月布偶猫，昨晚吐了两次未消化的猫粮，精神食欲还正常，需要马上就医吗？',
    comments: [
      { content: '少食多餐观察一下，精神好一般问题不大', createdAt: 1730000000000 },
      { content: '我家猫以前也这样，换粮太快引起的', createdAt: 1730001000000 }
    ],
    // 演示「精选好帖」：预置 150 个点赞
    likes: Array.from({ length: 150 }, (v, i) => 'demo_liker_' + i)
  },
  {
    petKind: '狗',
    petBreed: '金毛',
    part: '粪便',
    title: '狗狗拉稀带血丝',
    excerpt: '金毛昨晚偷吃了半根火腿肠，今天拉稀带少量血丝，活泼能吃，急！',
    comments: [{ content: '便血别拖，建议做个细小检测', createdAt: 1730002000000 }]
  },
  {
    petKind: '猫',
    petBreed: '英短',
    part: '耳朵',
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
  try {
    await db.createCollection(REPORT_COL)
  } catch (e) {}
  try {
    await db.createCollection(NOTIFY_COL)
  } catch (e) {}
}

// 给帖子作者新增一条通知（作者本人操作不通知，演示数据不通知）
async function addNotify(ownerOpenid, fromOpenid, data) {
  if (!ownerOpenid || ownerOpenid === fromOpenid || ownerOpenid === 'demo') return
  await db.collection(NOTIFY_COL).add({
    data: {
      _openid: ownerOpenid,
      fromOpenid,
      type: data.type,
      postId: String(data.postId || ''),
      postTitle: String(data.postTitle || '').slice(0, 40),
      content: String(data.content || '').slice(0, 120),
      read: false,
      createdAt: Date.now()
    }
  })
}

// 确保精选演示帖存在（幂等）：没有过百帖子时也能展示精选页效果
async function ensureFeaturedDemos(col) {
  const now = Date.now()
  // 兼容旧版精选演示帖：没有 lastLikeAt 的补为更早时间，保证同赞数时新帖排前
  try {
    const olds = await col.where({ featuredDemo: true }).limit(10).get()
    for (const o of olds.data) {
      if (!o.lastLikeAt) {
        await col.doc(o._id).update({
          data: { lastLikeAt: (o.createdAt || now) - 5 * 86400000 }
        })
      }
    }
  } catch (e) {}
  const DEMOS = [
    {
      demoKey: 'feat2',
      petKind: '狗',
      petBreed: '金毛',
      part: '其他',
      title: '狗狗脚垫红肿一直舔怎么办（精选示例）',
      excerpt: '3岁金毛最近总舔脚垫，脚缝发红有异味，走路轻微跛行，是趾间炎吗？',
      likeCount: 150,
      // 后达到 150 赞：与旧 150 赞示例帖并列时排第一名
      lastLikeAt: now - 5 * 60 * 1000,
      comments: withOwner(
        [{ content: '像趾间炎，保持脚底干燥很关键', createdAt: now - 3600000 }],
        'demo'
      )
    },
    {
      demoKey: 'feat3',
      petKind: '兔',
      petBreed: '垂耳兔',
      part: '粪便',
      title: '兔子便便变小变干怎么回事（精选示例）',
      excerpt: '垂耳兔这两天便便比平时小很多，干硬，喝水少了，精神还可以，要紧吗？',
      likeCount: 132,
      lastLikeAt: now - 2 * 86400000,
      comments: withOwner(
        [{ content: '小心胃肠道淤滞，先补水和粗纤维', createdAt: now - 86400000 }],
        'demo'
      )
    },
    {
      demoKey: 'feat4',
      petKind: '仓鼠',
      petBreed: '金丝熊',
      part: '口腔',
      title: '仓鼠颊囊一直鼓着不消（精选示例）',
      excerpt: '金丝熊右边颊囊鼓鼓的持续两天，不影响进食，但一直不消下去，正常吗？',
      likeCount: 118,
      lastLikeAt: now - 3 * 86400000,
      comments: withOwner(
        [{ content: '可能是颊囊炎或嵌塞，建议带去检查', createdAt: now - 72000000 }],
        'demo'
      )
    }
  ]
  for (const d of DEMOS) {
    try {
      const exist = await col.where({ demoKey: d.demoKey }).limit(1).get()
      if (!exist.data.length) {
        await col.add({
          data: Object.assign({}, d, {
            _openid: 'demo',
            image: '',
            likes: Array.from({ length: d.likeCount }, (v, i) => 'demo_liker_' + i),
            demo: true,
            featuredDemo: true,
            fromConsult: true,
            createdAt: now - 4 * 86400000
          })
        })
      }
    } catch (e) {}
  }
}

// 默认评论注入 openid
function withOwner(comments, openid) {
  return (comments || []).map(c => Object.assign({ _openid: openid, likes: 0 }, c))
}

// 内容安全校验：命中返回提示文案；openapi 不可用时放行（fail-open），保证演示可用
async function checkText(content, openid) {
  try {
    const res = await cloud.openapi.security.msgSecCheck({
      version: 2,
      scene: 2,
      openid,
      content
    })
    const detail = res && res.result
    if (detail && detail.suggest && detail.suggest !== 'pass') {
      return detail.label ? `内容涉嫌违规（${detail.label}），请修改后重试` : '内容涉嫌违规，请修改后重试'
    }
    return ''
  } catch (e) {
    console.warn('[square] msgSecCheck 不可用，放行', e && e.message)
    return ''
  }
}

function isAdmin(openid) {
  return ADMIN_OPENIDS.indexOf(openid) >= 0
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action
  const col = db.collection(COL)

  try {
    await ensureCollection()

    if (action === 'list') {
      const page = Math.max(0, parseInt(event.page, 10) || 0)
      let posts = []
      try {
        const res = await col
          .orderBy('createdAt', 'desc')
          .skip(page * PAGE_SIZE)
          .limit(PAGE_SIZE)
          .get()
        posts = res.data
      } catch (e) {
        posts = []
      }
      if (!posts.length && page === 0) {
        // 初始化演示案例
        for (const s of SEED) {
          await col.add({
            data: {
              _openid: 'demo',
              petKind: s.petKind,
              petBreed: s.petBreed,
              part: s.part,
              title: s.title,
              excerpt: s.excerpt,
              image: '',
              likes: s.likes || [],
              likeCount: (s.likes || []).length,
              comments: withOwner(s.comments, 'demo'),
              demo: true,
              createdAt: Date.now() - Math.floor(Math.random() * 86400000)
            }
          })
        }
        const res = await col
          .orderBy('createdAt', 'desc')
          .skip(0)
          .limit(PAGE_SIZE)
          .get()
        posts = res.data
      }
      // 服务端标记是否本人发布（不依赖前端登录态）
      posts = posts.map(p => Object.assign({}, p, { mine: p._openid === OPENID }))
      return { ok: true, data: { list: posts, page, hasMore: posts.length === PAGE_SIZE } }
    }

    // 精选好帖：点赞数 ≥ 100，先按赞数、再按"到达该赞数的时间"（lastLikeAt）倒序：
    // 并列第一时，后达到该赞数的帖子排前面
    if (action === 'featured') {
      await ensureFeaturedDemos(col)
      let posts = []
      try {
        const res = await col.orderBy('createdAt', 'desc').limit(100).get()
        posts = res.data
          .map(p =>
            Object.assign({}, p, {
              likeCount: p.likeCount || (p.likes || []).length,
              lastLikeAt: p.lastLikeAt || p.createdAt || 0
            })
          )
          .filter(p => p.likeCount >= 100)
          .sort(
            (a, b) =>
              b.likeCount - a.likeCount || b.lastLikeAt - a.lastLikeAt
          )
      } catch (e) {
        posts = []
      }
      return { ok: true, data: posts }
    }

    if (action === 'get') {
      const res = await col.where({ _id: event.id }).limit(1).get()
      if (!res.data.length) return { ok: false, msg: '帖子不存在或已删除' }
      const doc = res.data[0]
      const post = Object.assign({}, doc, { mine: doc._openid === OPENID })
      // 评论也由服务端标记是否本人（不依赖前端登录态）
      post.comments = (post.comments || []).map(c =>
        Object.assign({}, c, { mine: c._openid === OPENID })
      )
      return { ok: true, data: post }
    }

    if (action === 'mylist') {
      const res = await col
        .where({ _openid: OPENID })
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get()
      return { ok: true, data: res.data }
    }

    // 我的收藏：按前端传来的 id 列表批量取帖（保持收藏顺序）
    if (action === 'favlist') {
      const ids = Array.isArray(event.ids)
        ? event.ids.filter(x => typeof x === 'string').slice(0, 100)
        : []
      if (!ids.length) return { ok: true, data: [] }
      const res = await col.where({ _id: _.in(ids) }).limit(100).get()
      const map = {}
      res.data.forEach(p => {
        map[p._id] = p
      })
      return { ok: true, data: ids.map(id => map[id]).filter(Boolean) }
    }

    // ===== 消息通知 =====
    if (action === 'notifications') {
      const ncol = db.collection(NOTIFY_COL)
      const res = await ncol
        .where({ _openid: OPENID })
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get()
      const list = res.data
      return { ok: true, data: { list, unread: list.filter(n => !n.read).length } }
    }

    // 标记已读：传 ids 则按条，否则全部
    if (action === 'readNotifications') {
      const ncol = db.collection(NOTIFY_COL)
      const ids = Array.isArray(event.ids) ? event.ids.filter(x => typeof x === 'string') : []
      if (ids.length) {
        await ncol.where({ _openid: OPENID, _id: _.in(ids) }).update({ data: { read: true } })
      } else {
        await ncol.where({ _openid: OPENID, read: false }).update({ data: { read: true } })
      }
      return { ok: true, data: {} }
    }

    if (action === 'unread') {
      const res = await db.collection(NOTIFY_COL).where({ _openid: OPENID, read: false }).count()
      return { ok: true, data: { unread: res.total } }
    }

    if (action === 'like') {
      const res = await col.where({ _id: event.id }).limit(1).get()
      if (!res.data.length) return { ok: false, msg: '帖子不存在' }
      const post = res.data[0]
      const likes = post.likes || []
      const idx = likes.indexOf(OPENID)
      let liked = false
      if (idx >= 0) likes.splice(idx, 1)
      else {
        likes.push(OPENID)
        liked = true
      }
      // 点赞时记录"到达当前赞数的时间"，用于精选页同赞数并列时后到者排前
      const updateData = { likes, likeCount: likes.length }
      if (liked) updateData.lastLikeAt = Date.now()
      await col.doc(event.id).update({ data: updateData })
      // 点赞/取消点赞：同步通知帖子作者
      const ncol = db.collection(NOTIFY_COL)
      if (liked) {
        await addNotify(post._openid, OPENID, {
          type: 'like',
          postId: event.id,
          postTitle: post.title
        })
      } else {
        try {
          await ncol
            .where({ _openid: post._openid, type: 'like', fromOpenid: OPENID, postId: event.id })
            .remove()
        } catch (e) {}
      }
      return { ok: true, data: { likes } }
    }

    if (action === 'comment') {
      const content = (event.content || '').trim().slice(0, 200)
      if (!content) return { ok: false, msg: '评论不能为空' }
      const bad = await checkText(content, OPENID)
      if (bad) return { ok: false, msg: bad }
      const comment = { _openid: OPENID, content, createdAt: Date.now() }
      await col.doc(event.id).update({
        data: { comments: _.push([comment]) }
      })
      // 评论：通知帖子作者
      const postRes = await col.where({ _id: event.id }).limit(1).get()
      const post = postRes.data[0] || {}
      await addNotify(post._openid, OPENID, {
        type: 'comment',
        postId: event.id,
        postTitle: post.title,
        content
      })
      return { ok: true, data: { comment } }
    }

    // 删除评论：评论作者本人或帖子作者（或管理员）可删
    if (action === 'deleteComment') {
      const commentId = String(event.commentId || '')
      if (!commentId) return { ok: false, msg: '评论不存在' }
      const res = await col.where({ _id: event.id }).limit(1).get()
      if (!res.data.length) return { ok: false, msg: '帖子不存在' }
      const post = res.data[0]
      const comments = post.comments || []
      const target = comments.find(c => String(c.createdAt) === commentId)
      if (!target) return { ok: false, msg: '评论不存在' }
      if (target._openid !== OPENID && post._openid !== OPENID && !isAdmin(OPENID)) {
        return { ok: false, msg: '无权删除该评论' }
      }
      await col.doc(event.id).update({
        data: { comments: comments.filter(c => String(c.createdAt) !== commentId) }
      })
      return { ok: true, data: { id: event.id, commentId } }
    }

    if (action === 'publish') {
      // 脱敏发布：只保留物种/品种/部位与症状描述，不含用户信息
      const p = event.post || {}
      const title = String(p.title || '').trim().slice(0, 40)
      const excerpt = String(p.excerpt || '').trim().slice(0, 120)
      if (!title || !excerpt) return { ok: false, msg: '内容为空' }
      const bad = await checkText(title + '\n' + excerpt, OPENID)
      if (bad) return { ok: false, msg: bad }
      const data = {
        _openid: OPENID,
        petKind: String(p.petKind || '宠物').slice(0, 10),
        petBreed: String(p.petBreed || '').slice(0, 20),
        part: String(p.part || '其他').slice(0, 10),
        title,
        excerpt,
        image: typeof p.image === 'string' ? p.image.slice(0, 300) : '',
        recordId: String(p.recordId || '').slice(0, 64),
        likes: [],
        likeCount: 0,
        comments: [],
        fromConsult: true,
        createdAt: Date.now()
      }
      const res = await col.add({ data })
      return { ok: true, data: { _id: res._id } }
    }

    // 删除帖子：本人或管理员
    if (action === 'remove') {
      const res = await col.where({ _id: event.id }).limit(1).get()
      if (!res.data.length) return { ok: false, msg: '帖子不存在' }
      const post = res.data[0]
      if (post._openid !== OPENID && !isAdmin(OPENID)) {
        return { ok: false, msg: '无权删除该帖子' }
      }
      await col.doc(event.id).remove()
      return { ok: true, data: { id: event.id } }
    }

    // 举报帖子或评论
    if (action === 'report') {
      const types = ['广告营销', '辱骂攻击', '虚假信息', '虐宠内容', '其他']
      const type = String(event.type || '其他')
      if (types.indexOf(type) < 0) return { ok: false, msg: '举报类型不正确' }
      const res = await col.where({ _id: event.id }).limit(1).get()
      if (!res.data.length) return { ok: false, msg: '帖子不存在' }
      const data = {
        postId: event.id,
        postTitle: res.data[0].title || '',
        commentId: String(event.commentId || '').slice(0, 64),
        type,
        reason: String(event.reason || '').trim().slice(0, 200),
        reporter: OPENID,
        status: 'pending',
        createdAt: Date.now()
      }
      const r = await db.collection(REPORT_COL).add({ data })
      return { ok: true, data: { _id: r._id } }
    }

    // ===== 管理员接口 =====
    if (action === 'amIAdmin') {
      return { ok: true, data: { isAdmin: isAdmin(OPENID) } }
    }

    if (action === 'adminPosts') {
      if (!isAdmin(OPENID)) return { ok: false, msg: '无权限' }
      const res = await col.orderBy('createdAt', 'desc').limit(100).get()
      return { ok: true, data: res.data }
    }

    // 下架帖子（直接删除）
    if (action === 'adminRemove') {
      if (!isAdmin(OPENID)) return { ok: false, msg: '无权限' }
      const res = await col.where({ _id: event.id }).limit(1).get()
      if (!res.data.length) return { ok: false, msg: '帖子不存在' }
      await col.doc(event.id).remove()
      return { ok: true, data: { id: event.id } }
    }

    if (action === 'adminReports') {
      if (!isAdmin(OPENID)) return { ok: false, msg: '无权限' }
      const res = await db
        .collection(REPORT_COL)
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get()
      return { ok: true, data: res.data }
    }

    // 处理举报：标记已处理（可顺带下架对应帖子）
    if (action === 'adminHandleReport') {
      if (!isAdmin(OPENID)) return { ok: false, msg: '无权限' }
      const res = await db
        .collection(REPORT_COL)
        .where({ _id: event.id })
        .limit(1)
        .get()
      if (!res.data.length) return { ok: false, msg: '举报记录不存在' }
      await db.collection(REPORT_COL).doc(event.id).update({
        data: { status: 'handled', handledAt: Date.now() }
      })
      return { ok: true, data: { id: event.id } }
    }

    return { ok: false, msg: '未知操作' }
  } catch (err) {
    console.error('[square]', err)
    return { ok: false, msg: err.message || '服务异常' }
  }
}
