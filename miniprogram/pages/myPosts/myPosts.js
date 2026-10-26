const cloud = require('../../utils/cloud')
const util = require('../../utils/util')

const KIND_EMOJI = { 猫: '🐱', 狗: '🐶', 兔: '🐰', 鸟: '🐦', 仓鼠: '🐹', 乌龟: '🐢' }

Page({
  data: {
    posts: [],
    loading: true
  },

  onShow() {
    if (!getApp().isLoggedIn()) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 800)
      return
    }
    this.loadPosts()
  },

  onPullDownRefresh() {
    this.loadPosts().then(() => wx.stopPullDownRefresh())
  },

  loadPosts() {
    return cloud
      .squareMine()
      .then(list => {
        const posts = (list || []).map(p =>
          Object.assign({}, p, {
            kindEmoji: KIND_EMOJI[p.petKind] || '🐾',
            timeText: util.formatDateTime(p.createdAt)
          })
        )
        this.setData({ posts, loading: false })
      })
      .catch(err => {
        this.setData({ loading: false })
        cloud.toastError(err)
      })
  },

  onPostTap(e) {
    wx.navigateTo({ url: '/pages/postDetail/postDetail?id=' + e.currentTarget.dataset.id })
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除帖子',
      content: '确定删除该帖子吗？删除后不可恢复。',
      confirmColor: '#FF5A5F',
      success: res => {
        if (!res.confirm) return
        wx.showLoading({ title: '删除中' })
        cloud
          .squareRemove(id)
          .then(() => {
            wx.hideLoading()
            wx.showToast({ title: '已删除', icon: 'success' })
            this.setData({ posts: this.data.posts.filter(p => p._id !== id) })
          })
          .catch(err => {
            wx.hideLoading()
            cloud.toastError(err)
          })
      }
    })
  }
})
