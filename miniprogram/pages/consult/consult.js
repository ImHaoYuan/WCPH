const cloud = require('../../utils/cloud')

const MAX_PETS = 5

function isImageUrl(a) {
  return typeof a === 'string' && /^(cloud:\/\/|https?:\/\/|\/|wxfile:\/\/)/.test(a)
}

Page({
  data: {
    pets: [],
    loading: false,
    deleteMode: false,
    tips: [
      {
        icon: '💡',
        title: '评估标准',
        desc: '参考国内外权威兽医学指南，综合症状、病史、生活环境等多维度分析，优先排查高风险疾病。'
      },
      {
        icon: '📝',
        title: '请尽量详细描述',
        desc: '发病时间与频率、异常行为表现、近期饮食及排便情况、疫苗接种史等。'
      },
      {
        icon: '🚨',
        title: '紧急提示',
        desc: '如遇呼吸困难、大出血、误食毒物、抽搐等危急情况，请立即送医！在线咨询仅限轻症或非紧急问题。'
      }
    ]
  },

  onShow() {
    this.setData({ deleteMode: false })
    this.loadPets()
  },

  onPullDownRefresh() {
    this.loadPets().then(() => wx.stopPullDownRefresh())
  },

  loadPets() {
    const app = getApp()
    if (!app.isLoggedIn()) {
      this.setData({ pets: [] })
      return Promise.resolve()
    }
    this.setData({ loading: true })
    return cloud
      .listPets()
      .then(list => {
        const pets = (list || []).map(p =>
          Object.assign({}, p, {
            avatarIsImage: isImageUrl(p.avatar),
            avatarText: p.avatar && !isImageUrl(p.avatar) ? p.avatar : '🐾'
          })
        )
        this.setData({ pets, loading: false })
      })
      .catch(err => {
        this.setData({ loading: false })
        cloud.toastError(err)
      })
  },

  onAddPet() {
    if (this.data.pets.length >= MAX_PETS) {
      wx.showToast({ title: '宠物位置已满，无法继续添加', icon: 'none' })
      return
    }
    if (!getApp().requireLogin()) return
    wx.navigateTo({ url: '/pages/addPet/addPet' })
  },

  onPetTap(e) {
    if (!getApp().requireLogin()) return
    const id = e.currentTarget.dataset.id
    // 删除模式下点击宠物：弹窗确认后删除
    if (this.data.deleteMode) {
      const pet = this.data.pets.find(p => p._id === id)
      if (!pet) return
      wx.showModal({
        title: '删除宠物',
        content: '确认删除该宠物吗？',
        confirmText: '确认',
        cancelText: '取消',
        confirmColor: '#FF5A5F',
        success: res => {
          if (!res.confirm) return
          wx.showLoading({ title: '删除中', mask: true })
          cloud
            .deletePet(id)
            .then(() => {
              wx.hideLoading()
              wx.showToast({ title: '已删除', icon: 'success' })
              const pets = this.data.pets.filter(p => p._id !== id)
              this.setData({ pets, deleteMode: pets.length ? this.data.deleteMode : false })
            })
            .catch(err => {
              wx.hideLoading()
              cloud.toastError(err)
            })
        }
      })
      return
    }
    wx.navigateTo({ url: '/pages/chat/chat?petId=' + id })
  },

  // 删除按钮：切换删除模式（显示/隐藏宠物头像右上角的删除徽标）
  onDeletePet() {
    if (!getApp().requireLogin()) return
    if (!this.data.pets.length) {
      wx.showToast({ title: '暂无宠物可删除', icon: 'none' })
      return
    }
    this.setData({ deleteMode: !this.data.deleteMode })
  },

  // 图片/视频上传问诊：有未发送附件时询问是否继续添加，否则先选择并上传
  onMediaConsult() {
    if (!getApp().requireLogin()) return
    if (!this.data.pets.length) {
      wx.showToast({ title: '请先添加宠物信息', icon: 'none' })
      return
    }
    const draft = getApp()._chatDraftMedia
    if (draft && ((draft.images || []).length || draft.video)) {
      wx.showModal({
        title: '提示',
        content: '您已有图片/视频上传，需要继续添加图片吗？',
        cancelText: '不需要',
        confirmText: '需要',
        success: res => {
          if (!res.confirm) {
            wx.navigateTo({ url: '/pages/chat/chat' })
            return
          }
          wx.showActionSheet({
            itemList: ['拍照', '上传图片', '上传视频'],
            success: s => this.onPickMedia(s.tapIndex, draft)
          })
        }
      })
      return
    }
    wx.showActionSheet({
      itemList: ['拍照', '上传图片', '上传视频'],
      success: s => {
        const draft = { images: [], video: '' }
        this.onPickMedia(s.tapIndex, draft)
      }
    })
  },

  onPickMedia(tapIndex, draft) {
    if (tapIndex === 0) this.shootNow(draft)
    else if (tapIndex === 1) this.addMoreImages(draft)
    else this.addMoreVideo(draft)
  },

  // 直接调起相机拍照，跳过相册选择（真机可用，模拟器无摄像头）
  shootNow(draft) {
    const remain = 3 - (draft.images || []).length
    if (remain <= 0) {
      wx.showToast({ title: '图片最多3张', icon: 'none' })
      return
    }
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['camera'],
      camera: 'back',
      success: res => {
        const files = res.tempFiles || []
        if (files.length) this.uploadAppend(files, draft)
      },
      fail: err => {
        if (err && /cancel/.test(err.errMsg || '')) return
        wx.showToast({ title: '无法调起相机，请改用上传图片', icon: 'none' })
      }
    })
  },

  // 继续添加图片（追加到已有图片右侧，上限3张）
  addMoreImages(draft) {
    const remain = 3 - (draft.images || []).length
    if (remain <= 0) {
      wx.showToast({ title: '图片最多3张', icon: 'none' })
      return
    }
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: res => {
        const files = res.tempFiles || []
        if (files.length) this.uploadAppend(files, draft)
      }
    })
  },

  // 继续添加视频（新视频替换旧视频）
  addMoreVideo(draft) {
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      maxDuration: 30,
      sourceType: ['album', 'camera'],
      success: res => {
        const f = res.tempFiles && res.tempFiles[0]
        if (f) this.uploadAppend([f], draft)
      }
    })
  },

  uploadAppend(files, draft) {
    wx.showLoading({ title: '上传中', mask: true })
    const owner = getApp().globalData.openid || 'anon'
    Promise.all(
      files.map((f, i) => {
        const isVideo = f.fileType === 'video'
        const p = f.tempFilePath
        const ext = (p.match(/\.([a-zA-Z0-9]+)$/) || [])[1] || (isVideo ? 'mp4' : 'jpg')
        return cloud
          .uploadFile(p, `consult/${owner}/${Date.now()}-${isVideo ? 'video' : 'image'}-${i}.${ext}`)
          .then(url => ({ isVideo, url }))
          .catch(() => ({ isVideo, url: p })) // 上传失败降级本地路径
      })
    )
      .then(list => {
        wx.hideLoading()
        let changed = false
        list.forEach(({ isVideo, url }) => {
          if (isVideo) {
            draft.video = url
            changed = true
          } else if ((draft.images || []).length < 3) {
            draft.images.push(url)
            changed = true
          }
        })
        if (!changed) {
          wx.showToast({ title: '图片最多3张', icon: 'none' })
          return
        }
        // 写回全局草稿并跳转聊天页（新附件显示在上一张右边）
        getApp()._chatDraftMedia = draft
        wx.navigateTo({ url: '/pages/chat/chat' })
      })
      .catch(err => {
        wx.hideLoading()
        console.error('上传失败', err)
        wx.showToast({ title: '上传失败，请重试', icon: 'none' })
      })
  },

  onTextConsult() {
    if (!getApp().requireLogin()) return
    wx.navigateTo({ url: '/pages/chat/chat' })
  },

  // 结构化症状问诊：部位/病程表单 + 拍照 → AI 分诊报告
  onSymptomForm() {
    if (!getApp().requireLogin()) return
    wx.navigateTo({ url: '/pages/consultForm/consultForm' })
  },

  // 宠物急救指南（离线版）
  onFirstAid() {
    wx.navigateTo({ url: '/pages/firstaid/firstaid' })
  }
})
