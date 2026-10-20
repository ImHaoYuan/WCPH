const cloud = require('../../utils/cloud')

const MAX_PETS = 5

function isImageUrl(a) {
  return typeof a === 'string' && /^(cloud:\/\/|https?:\/\/|\/|wxfile:\/\/)/.test(a)
}

Page({
  data: {
    pets: [],
    loading: false,
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
    wx.navigateTo({ url: '/pages/chat/chat?petId=' + id })
  },

  onStart() {
    if (!getApp().requireLogin()) return
    wx.navigateTo({ url: '/pages/chat/chat' })
  }
})
