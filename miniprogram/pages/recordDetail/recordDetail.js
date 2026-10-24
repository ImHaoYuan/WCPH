const cloud = require('../../utils/cloud')
const util = require('../../utils/util')

Page({
  data: {
    id: '',
    record: { messages: [], petName: '', petAvatar: '', title: '' },
    timeText: '',
    userAvatar: ''
  },

  onLoad(options) {
    const id = (options && options.id) || ''
    this.setData({ id })
    const user = getApp().getUser() || {}
    this.setData({ userAvatar: user.avatarUrl || '' })
    if (!id) return
    wx.showLoading({ title: '加载中' })
    cloud
      .getRecord(id)
      .then(record => {
        wx.hideLoading()
        if (!record) return
        record.messages = (record.messages || []).map((m, i) =>
          Object.assign({}, m, { _k: 'r' + i })
        )
        this.setData({
          record,
          timeText: util.formatDateTime(record.createdAt)
        })
      })
      .catch(err => {
        wx.hideLoading()
        cloud.toastError(err)
      })
  },

  // 全屏预览聊天记录中的图片
  onPreviewImage(e) {
    const { urls, cur } = e.currentTarget.dataset
    wx.previewImage({ urls: urls || [cur], current: cur })
  },

  // 跳转 AI 问诊聊天页，直接打开该条问诊档案继续对话
  onContinueConsult() {
    const id = this.data.id || (this.data.record && this.data.record._id) || ''
    wx.navigateTo({ url: '/pages/chat/chat' + (id ? '?sessionId=' + id : '') })
  },

  onDelete() {
    wx.showModal({
      title: '删除记录',
      content: '确定删除这条问诊记录吗？',
      confirmColor: '#FF5A5F',
      success: res => {
        if (!res.confirm) return
        wx.showLoading({ title: '删除中' })
        cloud
          .deleteRecord(this.data.id)
          .then(() => {
            wx.hideLoading()
            wx.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => wx.navigateBack(), 700)
          })
          .catch(e => {
            wx.hideLoading()
            cloud.toastError(e)
          })
      }
    })
  }
})
