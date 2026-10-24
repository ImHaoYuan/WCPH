const cloud = require('../../utils/cloud')

const KINDS = ['猫', '狗', '兔', '鸟', '仓鼠', '其他']
const MAX_EXCERPT = 120

Page({
  data: {
    kinds: KINDS,
    petKind: '猫',
    title: '',
    excerpt: '',
    count: 0,
    maxExcerpt: MAX_EXCERPT,
    submitting: false
  },

  onKind(e) {
    this.setData({ petKind: e.currentTarget.dataset.k })
  },

  onTitle(e) {
    this.setData({ title: e.detail.value })
  },

  onExcerpt(e) {
    const v = e.detail.value || ''
    const excerpt = v.slice(0, MAX_EXCERPT)
    this.setData({ excerpt, count: excerpt.length })
  },

  onSubmit() {
    if (!getApp().requireLogin()) return
    if (this.data.submitting) return
    const title = (this.data.title || '').trim()
    const excerpt = (this.data.excerpt || '').trim()
    if (!title) {
      wx.showToast({ title: '请填写标题', icon: 'none' })
      return
    }
    if (!excerpt) {
      wx.showToast({ title: '请描述具体情况', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    cloud
      .squarePublish({ petKind: this.data.petKind, petBreed: '', title, excerpt })
      .then(() => {
        wx.showToast({ title: '发布成功', icon: 'success' })
        setTimeout(() => {
          if (getCurrentPages().length > 1) wx.navigateBack()
          else wx.switchTab({ url: '/pages/square/square' })
        }, 600)
      })
      .catch(err => {
        this.setData({ submitting: false })
        cloud.toastError(err)
      })
  }
})
