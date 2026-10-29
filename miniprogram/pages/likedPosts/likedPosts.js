const cloud = require('../../utils/cloud')
const util = require('../../utils/util')

const KIND_EMOJI = { 猫: '🐱', 狗: '🐶', 兔: '🐰', 鸟: '🐦', 仓鼠: '🐹', 乌龟: '🐢', 龟: '🐢' }

Page({
  data: {
    posts: [],
    loading: true,
    selecting: false,
    selectedIds: [],
    deleting: false
  },

  onShow() {
    if (!getApp().requireLogin()) return
    this.loadPosts()
  },

  onPullDownRefresh() {
    this.loadPosts().then(() => wx.stopPullDownRefresh())
  },

  loadPosts() {
    return cloud
      .squareLiked()
      .then(list => {
        const posts = (list || []).map(p =>
          Object.assign({}, p, {
            kindEmoji: KIND_EMOJI[p.petKind] || '🐾',
            timeText: util.formatDateTime(p.createdAt),
            selected: false
          })
        )
        this.setData({ posts, loading: false, selecting: false, selectedIds: [], deleting: false })
      })
      .catch(err => {
        this.setData({ loading: false, deleting: false })
        cloud.toastError(err)
      })
  },

  onToggleSelectMode() {
    if (this.data.deleting || (!this.data.selecting && !this.data.posts.length)) return
    this.setData({
      selecting: !this.data.selecting,
      selectedIds: [],
      posts: this.data.posts.map(p => Object.assign({}, p, { selected: false }))
    })
  },

  onPostTap(e) {
    const id = e.currentTarget.dataset.id
    if (!this.data.selecting) {
      wx.navigateTo({ url: '/pages/postDetail/postDetail?id=' + id })
      return
    }
    if (this.data.deleting) return
    const selectedIds = this.data.selectedIds.slice()
    const index = selectedIds.indexOf(id)
    if (index >= 0) selectedIds.splice(index, 1)
    else selectedIds.push(id)
    const posts = this.data.posts.map(p =>
      p._id === id ? Object.assign({}, p, { selected: index < 0 }) : p
    )
    this.setData({ posts, selectedIds })
  },

  onDeleteSelected() {
    if (!this.data.selectedIds.length || this.data.deleting) return
    wx.showModal({
      title: '删除点赞记录',
      content: '确认删除点赞记录吗？',
      cancelText: '取消',
      confirmText: '确认',
      confirmColor: '#FF5A5F',
      success: res => {
        if (res.confirm) this.deleteSelected()
      }
    })
  },

  deleteSelected() {
    const ids = this.data.selectedIds.slice()
    this.setData({ deleting: true })
    Promise.all(ids.map(id => cloud.squareLike(id)))
      .then(() => {
        this.setData({
          posts: this.data.posts.filter(p => ids.indexOf(p._id) < 0),
          selecting: false,
          selectedIds: [],
          deleting: false
        })
        wx.showToast({ title: '删除成功', icon: 'none', duration: 2000 })
      })
      .catch(err => {
        this.setData({ deleting: false })
        // 批量请求可能部分成功，重新拉取以保证列表与云端一致
        return this.loadPosts().then(() => cloud.toastError(err))
      })
  }
})
