const cloud = require('../../utils/cloud')
const util = require('../../utils/util')

Page({
  data: {
    list: [],
    loading: true
  },

  onShow() {
    this.load()
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh())
  },

  load() {
    this.setData({ loading: true })
    return cloud
      .squareNotifications()
      .then(res => {
        const list = ((res && res.list) || []).map(n => ({
          _id: n._id,
          type: n.type,
          icon: n.type === 'comment' ? '💬' : '❤️',
          title: n.type === 'comment' ? '有人评论了你的帖子' : '有人赞了你的帖子',
          postTitle: n.postTitle || '帖子',
          content: n.content || '',
          timeText: util.formatDateTime(n.createdAt),
          postId: n.postId,
          read: !!n.read
        }))
        this.setData({ list, loading: false })
        // 展示后把未读的全部标记为已读
        const unreadIds = list.filter(x => !x.read).map(x => x._id)
        if (unreadIds.length) {
          cloud.squareReadNotifications(unreadIds).catch(() => {})
        }
      })
      .catch(err => {
        this.setData({ loading: false })
        cloud.toastError(err)
      })
  },

  onTap(e) {
    const pid = e.currentTarget.dataset.pid
    if (pid) wx.navigateTo({ url: '/pages/postDetail/postDetail?id=' + pid })
  }
})
