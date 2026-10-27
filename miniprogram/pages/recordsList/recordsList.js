const cloud = require('../../utils/cloud')
const util = require('../../utils/util')

function isImageUrl(a) {
  return typeof a === 'string' && /^(cloud:\/\/|https?:\/\/|\/|wxfile:\/\/)/.test(a)
}

Page({
  data: {
    records: [],
    loading: true
  },

  onShow() {
    if (!getApp().isLoggedIn()) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 800)
      return
    }
    this.loadRecords()
  },

  onPullDownRefresh() {
    this.loadRecords().then(() => wx.stopPullDownRefresh())
  },

  loadRecords() {
    return cloud
      .listRecords()
      .then(list => {
        const records = (list || []).map(r => {
          const userMsgs = (r.messages || []).filter(m => m.role === 'user')
          let firstQuestion = ''
          for (const m of userMsgs) {
            const t = String(m.content || '').trim()
            if (t && t !== '[图片]' && t !== '[视频]') {
              firstQuestion = t
              break
            }
          }
          if (!firstQuestion) {
            const hasVideo = userMsgs.some(m => m.video || String(m.content || '') === '[视频]')
            firstQuestion = hasVideo ? '视频问诊' : '图片问诊'
          }
          if (firstQuestion.length > 5) firstQuestion = firstQuestion.slice(0, 5) + '...'
          return Object.assign({}, r, {
            avatarIsImage: isImageUrl(r.petAvatar),
            timeText: util.formatDateTime(r.createdAt),
            firstQuestion
          })
        })
        this.setData({ records, loading: false })
      })
      .catch(err => {
        this.setData({ loading: false })
        cloud.toastError(err)
      })
  },

  onRecordTap(e) {
    wx.navigateTo({ url: '/pages/recordDetail/recordDetail?id=' + e.currentTarget.dataset.id })
  }
})
