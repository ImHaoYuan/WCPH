const cloud = require('../../utils/cloud')
const util = require('../../utils/util')

const KIND_EMOJI = { 猫: '🐱', 狗: '🐶', 兔: '🐰', 鸟: '🐦', 仓鼠: '🐹', 乌龟: '🐢' }

// 点赞/评论本地持久化：云端不可用（示例模式）或同步失败时，交互数据保存在本地存储
const INTERACT_KEY = 'square_interactions_v1'

function loadInteractions() {
  try {
    const map = wx.getStorageSync(INTERACT_KEY) || {}
    // 迁移：旧版本保存的评论缺少 mine/author 标记（本地存储中的评论均为本人发表），统一补上
    let changed = false
    Object.keys(map).forEach(pid => {
      const cs = map[pid] && map[pid].comments
      if (!cs || !cs.length) return
      cs.forEach(c => {
        if (!c.mine) {
          c.mine = true
          const info = getApp().globalData.userInfo || {}
          c.author = info.nickname || '我'
          changed = true
        }
      })
    })
    if (changed) {
      try {
        wx.setStorageSync(INTERACT_KEY, map)
      } catch (e) {}
    }
    return map
  } catch (e) {
    return {}
  }
}

function saveInteractions(map) {
  try {
    wx.setStorageSync(INTERACT_KEY, map)
  } catch (e) {}
}

// 清理空条目：无点赞覆盖且无本地评论时删除该帖记录
function pruneInteractions(map, id) {
  const ov = map[id]
  if (!ov) return
  if (typeof ov.liked !== 'boolean' && !(ov.comments && ov.comments.length)) delete map[id]
}

// 云端不可用（如未部署 square 云函数）时的本地示例案例（已脱敏）
const FALLBACK_POSTS = [
  {
    _id: 'demo1',
    petKind: '猫',
    petBreed: '布偶猫',
    title: '布偶猫呕吐怎么办',
    excerpt: '3个月布偶猫，昨晚吐了两次未消化的猫粮，精神食欲还正常，需要马上就医吗？',
    likes: [],
    comments: [
      { content: '少食多餐观察一下，精神好一般问题不大', createdAt: 1730000000000 },
      { content: '我家猫以前也这样，换粮太快引起的', createdAt: 1730001000000 }
    ],
    demo: true,
    createdAt: Date.now() - 3600000
  },
  {
    _id: 'demo2',
    petKind: '狗',
    petBreed: '金毛',
    title: '狗狗拉稀带血丝',
    excerpt: '金毛昨晚偷吃了半根火腿肠，今天拉稀带少量血丝，活泼能吃，急！',
    likes: [],
    comments: [{ content: '便血别拖，建议做个细小检测', createdAt: 1730002000000 }],
    demo: true,
    createdAt: Date.now() - 7200000
  },
  {
    _id: 'demo3',
    petKind: '猫',
    petBreed: '英短',
    title: '猫咪频繁挠耳朵',
    excerpt: '英短最近老挠耳朵，耳朵里有很多黑褐色耳垢，是耳螨吗？',
    likes: [],
    comments: [
      { content: '像耳螨，用洁耳液+驱虫药，坚持两周', createdAt: 1730003000000 },
      { content: '去宠物医院做个耳镜更放心', createdAt: 1730003100000 }
    ],
    demo: true,
    createdAt: Date.now() - 86400000
  }
]

Page({
  data: {
    posts: [],
    loading: true,
    openId: '',
    offline: false,
    // 当前展开评论的帖子 id
    expandedId: '',
    commentText: ''
  },

  onShow() {
    this.setData({ openId: getApp().globalData.openid || '' })
    this.load()
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh())
  },

  load() {
    return cloud
      .squareList()
      .then(list => {
        this.setData({ offline: false })
        this.applyPosts(list || [])
      })
      .catch(err => {
        // 云函数未部署/网络异常时静默降级为本地示例，不弹报错
        console.warn('[square] 云端不可用，使用本地示例数据', err && err.message)
        this.setData({ offline: true })
        this.applyPosts(FALLBACK_POSTS)
      })
  },

  applyPosts(list) {
    const interactions = loadInteractions()
    const posts = list.map(p => {
      const ov = interactions[p._id] || {}
      const baseLikes = (p.likes || []).length
      const baseLiked = (p.likes || []).indexOf(this.data.openId) >= 0
      // 本地点赞覆盖云端/示例基准状态
      const likedByMe = typeof ov.liked === 'boolean' ? ov.liked : baseLiked
      const likeDelta = (likedByMe && !baseLiked ? 1 : 0) + (!likedByMe && baseLiked ? -1 : 0)
      // 本地新增评论追加到已有评论之后
      const comments = (p.comments || []).concat(ov.comments || [])
      return Object.assign({}, p, {
        kindEmoji: KIND_EMOJI[p.petKind] || '🐾',
        breedText: p.petBreed ? ' · ' + p.petBreed : '',
        timeText: util.formatDateTime(p.createdAt),
        likeCount: baseLikes + likeDelta,
        likedByMe,
        comments
      })
    })
    this.setData({ posts, loading: false })
  },

  onLike(e) {
    if (!getApp().requireLogin()) return
    const id = e.currentTarget.dataset.id
    let newLiked = false
    const posts = this.data.posts.map(p => {
      if (p._id !== id) return p
      newLiked = !p.likedByMe
      return Object.assign({}, p, {
        likedByMe: newLiked,
        likeCount: p.likeCount + (newLiked ? 1 : -1)
      })
    })
    this.setData({ posts })
    // 持久化本地点赞状态
    const interactions = loadInteractions()
    const ov = (interactions[id] = interactions[id] || {})
    ov.liked = newLiked
    pruneInteractions(interactions, id)
    saveInteractions(interactions)
    // 云端同步：成功后清除本地覆盖（服务端已有该状态），失败保持本地状态
    cloud
      .squareLike(id)
      .then(() => {
        const cur = loadInteractions()
        if (cur[id]) {
          delete cur[id].liked
          pruneInteractions(cur, id)
          saveInteractions(cur)
        }
      })
      .catch(err => console.warn('[square] like sync failed', err))
  },

  onToggleComments(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      expandedId: this.data.expandedId === id ? '' : id,
      commentText: ''
    })
  },

  onCommentInput(e) {
    this.setData({ commentText: e.detail.value })
  },

  // 当前登录用户的昵称
  getMyName() {
    const info = getApp().globalData.userInfo || {}
    return info.nickname || '我'
  },

  onCommentSend(e) {
    if (!getApp().requireLogin()) return
    const id = e.currentTarget.dataset.id
    const content = (this.data.commentText || '').trim()
    if (!content) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' })
      return
    }
    const comment = { content, createdAt: Date.now(), mine: true, author: this.getMyName() }
    const posts = this.data.posts.map(p =>
      p._id === id ? Object.assign({}, p, { comments: p.comments.concat(comment) }) : p
    )
    this.setData({ posts, commentText: '' })
    wx.showToast({ title: '评论成功', icon: 'none' })
    // 持久化本地评论
    const interactions = loadInteractions()
    const ov = (interactions[id] = interactions[id] || {})
    ov.comments = (ov.comments || []).concat(comment)
    saveInteractions(interactions)
    // 云端同步：成功后从本地移除该条（服务端已有），失败保持本地状态
    cloud
      .squareComment(id, content)
      .then(() => {
        const cur = loadInteractions()
        if (cur[id] && cur[id].comments) {
          cur[id].comments = cur[id].comments.filter(c => c.createdAt !== comment.createdAt)
          pruneInteractions(cur, id)
          saveInteractions(cur)
        }
      })
      .catch(err => console.warn('[square] comment sync failed', err))
  },

  // 点击自己的评论：弹窗确认后删除
  onCommentTap(e) {
    const id = e.currentTarget.dataset.id
    const index = e.currentTarget.dataset.index
    const post = this.data.posts.find(p => p._id === id)
    const comment = post && post.comments[index]
    if (!comment || !comment.mine) return
    wx.showModal({
      title: '删除评论',
      content: '是否删除该评论？',
      confirmText: '是',
      cancelText: '否',
      success: res => {
        if (!res.confirm) return
        this.removeComment(id, comment)
      }
    })
  },

  removeComment(id, comment) {
    const posts = this.data.posts.map(p =>
      p._id === id
        ? Object.assign({}, p, { comments: p.comments.filter(c => c.createdAt !== comment.createdAt) })
        : p
    )
    this.setData({ posts })
    // 同步移除本地持久化的评论
    const interactions = loadInteractions()
    if (interactions[id] && interactions[id].comments) {
      interactions[id].comments = interactions[id].comments.filter(
        c => c.createdAt !== comment.createdAt
      )
      pruneInteractions(interactions, id)
      saveInteractions(interactions)
    }
  }
})
