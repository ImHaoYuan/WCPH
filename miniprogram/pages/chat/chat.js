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

Page({
  data: {
    pets: [],
    petNames: [],
    petIndex: -1,
    currentPet: {},
    messages: [],
    inputValue: '',
    scrollTo: '',
    sending: false,
    savedId: ''
  },

  _seq: 0,

  onLoad(options) {
    this.loadPets(options && options.petId)
  },

  loadPets(preselectId) {
    wx.showLoading({ title: '加载中' })
    cloud
      .listPets()
      .then(list => {
        wx.hideLoading()
        const pets = (list || []).map(p =>
          Object.assign({}, p, { avatarIsImage: isImageUrl(p.avatar) })
        )
        let petIndex = -1
        if (preselectId) {
          petIndex = pets.findIndex(p => p._id === preselectId)
        } else if (pets.length >= 1) {
          petIndex = 0
        }
        this.setData({
          pets,
          petNames: pets.map(p => p.name),
          petIndex,
          currentPet: petIndex >= 0 ? pets[petIndex] : {}
        })
        this.pushWelcome()
      })
      .catch(err => {
        wx.hideLoading()
        cloud.toastError(err)
        this.pushWelcome()
      })
  },

  nextKey() {
    this._seq += 1
    return 'm' + this._seq
  },

  appendMessage(role, content) {
    const _k = this.nextKey()
    const messages = this.data.messages.concat([{ role, content, timeText: hm(), _k }])
    this.setData({ messages, scrollTo: 'msg-' + _k })
    return messages
  },

  pushWelcome() {
    const name = this.data.currentPet && this.data.currentPet.name
    const greet = name
      ? `您好！我是AI宠物健康助手🐾 请详细描述「${name}」的情况：发病时间与频率、异常行为、近期饮食与排便、疫苗及驱虫史等，我会为您做初步健康评估。`
      : '您好！我是AI宠物健康助手🐾 请先在上方选择要咨询的宠物，然后详细描述症状（发病时间、异常行为、饮食排便、疫苗驱虫史等），我会为您做初步健康评估。'
    this.appendMessage('ai', greet + '\n\n🚨 如遇呼吸困难、大出血、误食毒物、抽搐等危急情况，请立即送医！')
  },

  onPickPet(e) {
    const petIndex = Number(e.detail.value)
    this.setData({ petIndex, currentPet: this.data.pets[petIndex] || {} })
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
    if (!text || this.data.sending) return

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

    this.appendMessage('user', text)
    this.setData({ inputValue: '', sending: true, scrollTo: 'bottom-anchor' })

    setTimeout(() => {
      const reply = util.aiReply(text, this.data.currentPet)
      this.appendMessage('ai', reply)
      this.setData({ sending: false })
      this.saveRecord()
    }, 700)
  },

  saveRecord() {
    const msgs = this.data.messages
      .filter(m => m.role === 'user' || m.role === 'ai')
      .map(m => ({ role: m.role, content: m.content, time: m.timeText }))
    const firstUser = this.data.messages.find(m => m.role === 'user')
    const title = firstUser ? firstUser.content.slice(0, 20) : '新问诊'
    const pet = this.data.currentPet
    const payload = {
      title,
      messages: msgs,
      petId: pet._id,
      petName: pet.name,
      petAvatar: pet.avatarIsImage ? '' : pet.avatar || ''
    }

    const task = this.data.savedId
      ? cloud.updateRecord(this.data.savedId, payload)
      : cloud.addRecord(payload)

    task
      .then(res => {
        if (!this.data.savedId && res && res._id) {
          this.setData({ savedId: res._id })
        }
      })
      .catch(err => console.error('保存问诊记录失败', err))
  }
})
