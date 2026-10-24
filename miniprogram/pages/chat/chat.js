const cloud = require('../../utils/cloud')
const util = require('../../utils/util')

function isImageUrl(a) {
  return typeof a === 'string' && /^(cloud:\/\/|https?:\/\/|\/|wxfile:\/\/)/.test(a)
}

function hm() {
  const d = new Date()
  const p = n => (n < 10 ? '0' + n : '' + n)
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

// 演示用附近宠物医院数据（正式版本可接入地图POI检索）
const HOSPITALS = [
  { name: '瑞鹏宠物医院·24h急诊（科技园分院·约1.2km）', phone: '075512345678' },
  { name: '芭比堂动物医院（中心院区·约2.0km）', phone: '075587654321' },
  { name: '安安宠医·24小时急诊（约2.8km）', phone: '075599988877' }
]

Page({
  data: {
    pets: [],
    petIndex: -1,
    currentPet: {},
    messages: [],
    inputValue: '',
    scrollTo: '',
    sending: false,
    savedId: '',
    statusBarHeight: 20,
    // 多模态：待发送附件
    pendingImages: [],
    pendingVideo: ''
  },

  _seq: 0,
  _chats: null,
  _savedIds: null,
  _pendingMedia: null,

  onLoad(options) {
    // 自定义导航栏：状态栏高度 + 状态栏前景白色
    try {
      const wi = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      this.setData({ statusBarHeight: wi.statusBarHeight || 20 })
      wx.setNavigationBarColor({ frontColor: '#ffffff', backgroundColor: '#6C8CFF' })
    } catch (e) {
      this.setData({ statusBarHeight: 20 })
    }
    // 每只宠物一份聊天记录：petId -> messages[]
    this._chats = {}
    this._savedIds = {}
    // 待发送附件草稿：挂到全局暂存，退回首页再进入不丢失
    this._pendingMedia = getApp()._chatDraftMedia = getApp()._chatDraftMedia || { images: [], video: '' }
    this.setData({ pendingImages: this._pendingMedia.images, pendingVideo: this._pendingMedia.video })
    this.loadPets(options && options.petId)
  },

  onShow() {},

  // 返回首页：有未发送附件时询问是否保存
  onBack() {
    const goHome = () => {
      if (getCurrentPages().length > 1) wx.navigateBack()
      else wx.switchTab({ url: '/pages/consult/consult' }) // 聊天页为栈底时（如直接打开）兜底
    }
    const draft = this._pendingMedia
    if (draft && ((draft.images || []).length || draft.video)) {
      wx.showModal({
        title: '提示',
        content: '图片还未保存，需要保存后再退出吗？',
        cancelText: '不保存',
        confirmText: '保存',
        success: res => {
          if (!res.confirm) {
            // 不保存：清空附件草稿
            draft.images = []
            draft.video = ''
          }
          goHome()
        }
      })
      return
    }
    goHome()
  },

  onRemoveImage(e) {
    const i = e.currentTarget.dataset.i
    this._pendingMedia.images.splice(i, 1)
    this.setData({ pendingImages: this._pendingMedia.images })
  },

  // 附件栏 ＋：继续添加图片/视频（新附件排在最右）
  onAddMore() {
    wx.showActionSheet({
      itemList: ['添加图片', '添加视频'],
      success: res => {
        if (res.tapIndex === 0) this.addMoreImages()
        else this.addMoreVideo()
      }
    })
  },

  addMoreImages() {
    const remain = 3 - this._pendingMedia.images.length
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
        const paths = (res.tempFiles || []).map(f => f.tempFilePath)
        if (paths.length) this.uploadAppendMedia(paths, 'image')
      }
    })
  },

  addMoreVideo() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      maxDuration: 30,
      sourceType: ['album', 'camera'],
      success: res => {
        const f = res.tempFiles && res.tempFiles[0]
        if (f && f.tempFilePath) this.uploadAppendMedia([f.tempFilePath], 'video')
      }
    })
  },

  uploadAppendMedia(paths, type) {
    wx.showLoading({ title: '上传中' })
    const owner = getApp().globalData.openid || 'anon'
    Promise.all(
      paths.map((p, i) => {
        const ext = (p.match(/\.([a-zA-Z0-9]+)$/) || [])[1] || (type === 'video' ? 'mp4' : 'jpg')
        return cloud
          .uploadFile(p, `consult/${owner}/${Date.now()}-${type}-${i}.${ext}`)
          .catch(() => p) // 上传失败降级为本地临时路径，保证演示可用
      })
    )
      .then(urls => {
        wx.hideLoading()
        urls.forEach(url => {
          if (type === 'video') {
            this._pendingMedia.video = url // 新视频替换旧视频
          } else if (this._pendingMedia.images.length < 3) {
            this._pendingMedia.images.push(url) // 排在上一张右边
          }
        })
        this.setData({
          pendingImages: this._pendingMedia.images,
          pendingVideo: this._pendingMedia.video
        })
      })
      .catch(err => {
        wx.hideLoading()
        console.error('上传失败', err)
        wx.showToast({ title: '上传失败，请重试', icon: 'none' })
      })
  },

  onRemoveVideo() {
    this._pendingMedia.video = ''
    this.setData({ pendingVideo: '' })
  },

  onPreviewImage(e) {
    const urls = e.currentTarget.dataset.urls || []
    const current = e.currentTarget.dataset.src
    if (urls.length) wx.previewImage({ current, urls })
  },

  // ================= 紧急预警：一键拨打附近宠物医院 =================
  onCallHospital() {
    wx.showActionSheet({
      itemList: HOSPITALS.map(h => h.name),
      success: res => {
        const h = HOSPITALS[res.tapIndex]
        wx.makePhoneCall({ phoneNumber: h.phone })
      }
    })
  },

  // ================= 宠物与会话 =================
  loadPets(preselectId) {
    wx.showLoading({ title: '加载中' })
    cloud
      .listPets()
      .then(list => {
        wx.hideLoading()
        const pets = (list || []).map(p =>
          Object.assign({}, p, {
            avatarIsImage: isImageUrl(p.avatar),
            ageText: util.calcAge(p.birthDate)
          })
        )
        let petIndex = preselectId ? pets.findIndex(p => p._id === preselectId) : -1
        if (petIndex < 0 && pets.length) petIndex = 0
        this.setData({
          pets,
          petIndex,
          currentPet: petIndex >= 0 ? pets[petIndex] : {}
        })
        this.ensureChat()
      })
      .catch(err => {
        wx.hideLoading()
        cloud.toastError(err)
        this.ensureChat()
      })
  },

  nextKey() {
    this._seq += 1
    return 'm' + this._seq
  },

  chatKey() {
    return (this.data.currentPet && this.data.currentPet._id) || 'none'
  },

  appendMessage(role, content, extra) {
    const key = this.chatKey()
    const msg = Object.assign({ role, content, timeText: hm(), _k: this.nextKey() }, extra || {})
    const messages = (this._chats[key] || []).concat([msg])
    this._chats[key] = messages
    this.setData({ messages, scrollTo: 'msg-' + msg._k })
    return messages
  },

  // 进入当前宠物的会话：没有记录则生成欢迎语，有则恢复历史
  ensureChat() {
    const key = this.chatKey()
    if (!this._chats[key]) {
      const name = this.data.currentPet && this.data.currentPet.name
      const greet = name
        ? `您好！我是AI宠物健康助手🐾 请详细描述「${name}」的情况：发病时间与频率、异常行为、近期饮食与排便、疫苗及驱虫史等，我会为您做初步健康评估。`
        : '您好！我是AI宠物健康助手🐾 请先在上方选择要咨询的宠物，然后详细描述症状（发病时间、异常行为、饮食排便、疫苗驱虫史等），我会为您做初步健康评估。'
      this._chats[key] = [
        {
          role: 'ai',
          content:
            greet +
            '\n\n✨ 您还可以：\n· 通过首页「拍照/视频上传问诊」上传患病部位照片或短视频（选好并上传后会自动带到这里），我会结合影像分析；\n· 回复会标注紧急程度（红/黄/绿），红色可一键拨打附近宠物医院电话。\n\n🚨 如遇呼吸困难、大出血、误食毒物、抽搐等危急情况，请立即送医！',
          timeText: hm(),
          _k: this.nextKey()
        }
      ]
    }
    this.setData({
      messages: this._chats[key],
      savedId: this._savedIds[key] || '',
      scrollTo: 'bottom-anchor'
    })
  },

  onPrevPet() {
    this.switchPet(-1)
  },

  onNextPet() {
    this.switchPet(1)
  },

  switchPet(step) {
    const n = this.data.pets.length
    if (!n) return
    const petIndex = (this.data.petIndex + step + n) % n
    this.setData({
      petIndex,
      currentPet: this.data.pets[petIndex]
    })
    this.ensureChat()
  },

  onAddPet() {
    if (!getApp().requireLogin()) return
    wx.navigateTo({ url: '/pages/addPet/addPet' })
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value })
  },

  send() {
    const text = this.data.inputValue.trim()
    const media = this._pendingMedia
    const hasMedia = media.images.length > 0 || !!media.video
    if ((!text && !hasMedia) || this.data.sending) return

    if (!this.data.currentPet || !this.data.currentPet.name) {
      if (!this.data.pets.length) {
        wx.showModal({
          title: '还没有宠物',
          content: '问诊前请先添加宠物信息，以便更准确地评估。',
          confirmText: '去添加',
          success: r => {
            if (r.confirm) this.onAddPet()
          }
        })
      } else {
        wx.showToast({ title: '请先选择宠物', icon: 'none' })
      }
      return
    }

    this.appendMessage('user', text || (media.video ? '[视频]' : '[图片]'), {
      images: media.images.slice(),
      video: media.video || ''
    })
    this._pendingMedia = { images: [], video: '' }
    getApp()._chatDraftMedia = this._pendingMedia
    this.setData({
      inputValue: '',
      pendingImages: [],
      pendingVideo: '',
      sending: true,
      scrollTo: 'bottom-anchor'
    })

    setTimeout(() => {
      const reply = util.aiConsult(text, this.data.currentPet, media)
      this.appendMessage('ai', reply.content, { level: reply.level })
      this.setData({ sending: false })
      this.saveRecord()
    }, 700)
  },

  saveRecord() {
    const key = this.chatKey()
    const savedId = this._savedIds[key] || ''
    const msgs = this.data.messages
      .filter(m => m.role === 'user' || m.role === 'ai')
      .map(m => ({
        role: m.role,
        content: m.content,
        time: m.timeText,
        level: m.level || '',
        images: m.images || [],
        video: m.video || ''
      }))
    const firstUser = this.data.messages.find(m => m.role === 'user')
    const pet = this.data.currentPet
    const title = pet.name || (firstUser ? firstUser.content || '问诊记录' : '问诊记录')
    const payload = {
      title: title.slice(0, 20),
      messages: msgs,
      petId: pet._id,
      petName: pet.name,
      petAvatar: pet.avatarIsImage ? '' : pet.avatar || ''
    }

    const task = savedId ? cloud.updateRecord(savedId, payload) : cloud.addRecord(payload)

    task
      .then(res => {
        if (!savedId && res && res._id) {
          this._savedIds[key] = res._id
          this.setData({ savedId: res._id })
          // 脱敏分享到问诊广场（失败不影响主流程）
          if (firstUser) {
            cloud
              .squarePublish({
                petKind: pet.category || '宠物',
                petBreed: pet.breed || '',
                title: firstUser.content || (firstUser.video ? '视频问诊求助' : '图片问诊求助'),
                excerpt: firstUser.content || '用户通过图片/视频发起了问诊，点击查看AI初步分析。'
              })
              .catch(err => console.warn('分享到问诊广场失败', err))
          }
        }
      })
      .catch(err => console.error('保存问诊记录失败', err))
  }
})
