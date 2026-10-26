const util = require('../../utils/util')
const history = require('../../utils/history')

const KIND_EMOJI = { 猫: '🐱', 狗: '🐶', 兔: '🐰', 鸟: '🐦', 仓鼠: '🐹', 乌龟: '🐢' }

Page({
  data: {
    list: []
  },

  onShow() {
    this.load()
  },

  load() {
    const list = history
      .list()
      .map(p =>
        Object.assign({}, p, {
          kindEmoji: KIND_EMOJI[p.petKind] || '🐾',
          timeText: util.formatDateTime(p.viewedAt || p.createdAt)
        })
      )
    this.setData({ list })
  },

  onTap(e) {
    wx.navigateTo({ url: '/pages/postDetail/postDetail?id=' + e.currentTarget.dataset.id })
  },

  onClear() {
    wx.showModal({
      title: '清空浏览记录',
      content: '确定清空全部历史浏览记录吗？',
      confirmColor: '#FF5A5F',
      success: res => {
        if (!res.confirm) return
        history.clear()
        this.setData({ list: [] })
        wx.showToast({ title: '已清空', icon: 'success' })
      }
    })
  }
})
