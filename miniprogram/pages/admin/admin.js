const cloud = require('../../utils/cloud')
const util = require('../../utils/util')

const KIND_EMOJI = { 猫: '🐱', 狗: '🐶', 兔: '🐰', 鸟: '🐦', 仓鼠: '🐹', 乌龟: '🐢' }

Page({
  data: {
    tab: 'posts',
    posts: [],
    reports: [],
    loading: true,
    isAdmin: false
  },

  onLoad() {
    cloud
      .squareAmIAdmin()
      .then(res => {
        this.setData({ isAdmin: !!(res && res.isAdmin) })
        if (res && res.isAdmin) this.loadAll()
        else this.setData({ loading: false })
      })
      .catch(() => this.setData({ loading: false, isAdmin: false }))
  },

  onPullDownRefresh() {
    if (!this.data.isAdmin) {
      wx.stopPullDownRefresh()
      return
    }
    this.loadAll().then(() => wx.stopPullDownRefresh())
  },

  loadAll() {
    this.setData({ loading: true })
    const p1 = cloud
      .squareAdminPosts()
      .then(list => {
        const posts = (list || []).map(p =>
          Object.assign({}, p, {
            timeText: util.formatDateTime(p.createdAt),
            kindEmoji: KIND_EMOJI[p.petKind] || '🐾'
          })
        )
        this.setData({ posts })
      })
      .catch(cloud.toastError)
    const p2 = cloud
      .squareAdminReports()
      .then(list => {
        const reports = (list || []).map(r =>
          Object.assign({}, r, {
            timeText: util.formatDateTime(r.createdAt),
            statusText: r.status === 'handled' ? '已处理' : '待处理'
          })
        )
        this.setData({ reports })
      })
      .catch(cloud.toastError)
    return Promise.all([p1, p2]).then(() => this.setData({ loading: false }))
  },

  onTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab })
  },

  removePost(id) {
    wx.showModal({
      title: '下架帖子',
      content: '确定下架（删除）该帖子吗？',
      confirmColor: '#FF5A5F',
      success: res => {
        if (!res.confirm) return
        wx.showLoading({ title: '处理中' })
        cloud
          .squareAdminRemove(id)
          .then(() => {
            wx.hideLoading()
            wx.showToast({ title: '已下架', icon: 'success' })
            this.loadAll()
          })
          .catch(err => {
            wx.hideLoading()
            cloud.toastError(err)
          })
      }
    })
  },

  onRemovePost(e) {
    this.removePost(e.currentTarget.dataset.id)
  },

  onRemoveReportedPost(e) {
    this.removePost(e.currentTarget.dataset.postid)
  },

  onHandleReport(e) {
    const id = e.currentTarget.dataset.id
    cloud
      .squareAdminHandleReport(id)
      .then(() => {
        wx.showToast({ title: '已标记处理', icon: 'none' })
        this.loadAll()
      })
      .catch(cloud.toastError)
  }
})
