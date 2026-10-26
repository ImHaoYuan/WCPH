const cloud = require('../../utils/cloud')

const MAX_IMAGES = 3
// 简单版图片质检：压缩后体积过小，疑似模糊/无内容，提示重拍（仍允许提交）
const MIN_IMAGE_SIZE = 15 * 1024

Page({
  data: {
    kinds: ['猫', '狗', '其他'],
    kindIndex: -1,
    parts: ['皮肤', '耳朵', '眼睛', '口腔', '粪便', '其他'],
    partIndex: -1,
    durations: ['1-3天', '4-7天', '1-2周', '2周以上', '不清楚'],
    durationIndex: -1,
    itchOptions: ['是', '否', '不清楚'],
    itchIndex: -1,
    appetiteOptions: ['正常', '下降', '拒食'],
    appetiteIndex: -1,
    vaccineOptions: ['齐全', '不齐全', '未知'],
    vaccineIndex: -1,
    desc: '',
    images: [],
    uploading: false,
    submitting: false,
    maxImages: MAX_IMAGES
  },

  // 通用选项点击：data-key 对应 data 中的下标字段名
  onPick(e) {
    const key = e.currentTarget.dataset.key
    const i = Number(e.currentTarget.dataset.i)
    this.setData({ [key]: i })
  },

  onChooseImage() {
    if (!getApp().requireLogin()) return
    const remain = MAX_IMAGES - this.data.images.length
    if (remain <= 0) {
      wx.showToast({ title: '图片最多3张', icon: 'none' })
      return
    }
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: res => this.uploadFiles(res.tempFiles || [])
    })
  },

  uploadFiles(files) {
    wx.showLoading({ title: '上传中', mask: true })
    const owner = getApp().globalData.openid || 'anon'
    Promise.all(
      files.map((f, i) => {
        if (f.size != null && f.size < MIN_IMAGE_SIZE) {
          wx.showToast({ title: '图片可能模糊，建议重拍', icon: 'none' })
        }
        const ext = (f.tempFilePath.match(/\.([a-zA-Z0-9]+)$/) || [])[1] || 'jpg'
        return cloud
          .uploadFile(f.tempFilePath, `consult/${owner}/${Date.now()}-${i}.${ext}`)
          .catch(() => f.tempFilePath) // 上传失败降级本地路径，保证演示可用
      })
    )
      .then(urls => {
        wx.hideLoading()
        const images = this.data.images.concat(urls).slice(0, MAX_IMAGES)
        this.setData({ images })
      })
      .catch(() => {
        wx.hideLoading()
        wx.showToast({ title: '上传失败，请重试', icon: 'none' })
      })
  },

  onRemoveImage(e) {
    const i = e.currentTarget.dataset.i
    const images = this.data.images.slice()
    images.splice(i, 1)
    this.setData({ images })
  },

  onPreviewImage(e) {
    const { urls, cur } = e.currentTarget.dataset
    wx.previewImage({ urls: urls || [cur], current: cur })
  },

  onDesc(e) {
    this.setData({ desc: e.detail.value })
  },

  onSubmit() {
    if (!getApp().requireLogin()) return
    if (this.data.submitting) return
    if (this.data.kindIndex < 0) {
      wx.showToast({ title: '请选择宠物类型', icon: 'none' })
      return
    }
    if (this.data.partIndex < 0) {
      wx.showToast({ title: '请选择患处部位', icon: 'none' })
      return
    }
    if (!this.data.images.length && !this.data.desc.trim()) {
      wx.showToast({ title: '请上传患处照片或填写症状描述', icon: 'none' })
      return
    }

    const d = this.data
    const lines = [`宠物类型：${d.kinds[d.kindIndex]}`, `患处部位：${d.parts[d.partIndex]}`]
    if (d.durationIndex >= 0) lines.push(`病程：${d.durations[d.durationIndex]}`)
    if (d.itchIndex >= 0) lines.push(`是否瘙痒：${d.itchOptions[d.itchIndex]}`)
    if (d.appetiteIndex >= 0) lines.push(`精神食欲：${d.appetiteOptions[d.appetiteIndex]}`)
    if (d.vaccineIndex >= 0) lines.push(`疫苗情况：${d.vaccineOptions[d.vaccineIndex]}`)
    const text =
      lines.join('；') + '。' + (d.desc.trim() ? '\n补充描述：' + d.desc.trim().slice(0, 300) : '')

    // 草稿图片与结构化文本交给聊天页，进入后自动发送问诊
    getApp()._chatDraftMedia = { images: d.images.slice(), video: '' }
    getApp()._chatDraftText = text
    this.setData({ submitting: true })
    wx.navigateTo({ url: '/pages/chat/chat?auto=1' })
  }
})
