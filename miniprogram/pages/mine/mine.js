const cloud = require('../../utils/cloud')
const util = require('../../utils/util')
const history = require('../../utils/history')

function isImageUrl(a) {
  return typeof a === 'string' && /^(cloud:\/\/|https?:\/\/|\/|wxfile:\/\/)/.test(a)
}

const KIND_EMOJI = { 猫: '🐱', 狗: '🐶', 兔: '🐰', 鸟: '🐦', 仓鼠: '🐹', 乌龟: '🐢' }
const FAV_KEY = 'square_favs_v1'
const FAV_POSTS_KEY = 'square_fav_posts_v1'

Page({
  data: {
    logged: false,
    user: {},
    pets: [],
    petIndex: 0,
    currentPet: {},
    records: [],
    reminders: [],
    myPosts: [],
    favPosts: [],
    history: []
  },

  onShow() {
    const app = getApp()
    const logged = app.isLoggedIn()
    this.setData({ logged, user: app.getUser() || {} })
    if (logged) {
      this.loadData()
    } else {
      this.setData({ pets: [], records: [], reminders: [], myPosts: [], favPosts: [], history: [] })
    }
  },

  onPullDownRefresh() {
    if (!getApp().isLoggedIn()) {
      wx.stopPullDownRefresh()
      return
    }
    this.loadData().then(() => wx.stopPullDownRefresh())
  },

  loadData() {
    const p1 = cloud
      .listPets()
      .then(list => {
        const pets = (list || []).map(p =>
          Object.assign({}, p, {
            avatarIsImage: isImageUrl(p.avatar),
            ageText: util.calcAge(p.birthDate)
          })
        )
        // 刷新后尽量保持当前选中的宠物；若它已被删除则回到第一只
        const curId = this.data.currentPet && this.data.currentPet._id
        let petIndex = pets.findIndex(p => p._id === curId)
        if (petIndex < 0) petIndex = 0
        this.setData({
          pets,
          petIndex,
          currentPet: pets[petIndex] || {}
        })
      })
      .catch(cloud.toastError)

    const p2 = cloud
      .listRecords()
      .then(list => {
        const records = (list || []).map(r => {
          // 灰色小字：本次问诊的第一句话（优先取第一条真实文字，超过5个字截断为 xxxxx...）
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
            // 整条记录没有文字时，按媒体类型标注
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
        this.setData({ records })
      })
      .catch(cloud.toastError)

    const p3 = cloud
      .listReminders()
      .then(list => {
        const reminders = (list || [])
          .filter(r => r.status === 'pending' || r.status === 'expired')
          .sort((a, b) => a.dueAt - b.dueAt)
          .slice(0, 3)
          .map(r => {
            try {
              const meta = util.reminderTypeMeta(r.type)
              return Object.assign({}, r, {
                typeLabel: meta.label,
                typeEmoji: meta.emoji,
                dueText: util.reminderDueText(r.dueAt)
              })
            } catch (e) {
              console.warn('[mine] 单条提醒渲染失败', e)
              return Object.assign({}, r, { typeLabel: '提醒', typeEmoji: '⏰', dueText: '' })
            }
          })
        this.setData({ reminders })
      })
      .catch(err => console.warn('[mine] 提醒加载失败', err && err.message))

    const p4 = cloud
      .squareMine()
      .then(list => {
        const myPosts = (list || []).map(p =>
          Object.assign({}, p, { timeText: util.formatDateTime(p.createdAt) })
        )
        this.setData({ myPosts })
      })
      .catch(err => console.warn('[mine] 我的发布加载失败', err && err.message))

    const p5 = this.loadFavPosts()
    this.loadHistory()

    return Promise.all([p1, p2, p3, p4, p5])
  },

  // 历史浏览记录（本地存储，同步读取）
  loadHistory() {
    const list = history
      .list()
      .map(p =>
        Object.assign({}, p, {
          kindEmoji: KIND_EMOJI[p.petKind] || '🐾',
          timeText: util.formatDateTime(p.viewedAt || p.createdAt)
        })
      )
    this.setData({ history: list })
  },

  // 我的收藏：优先云端批量取帖（数据最新），云端不可用时回退本地快照兜底
  loadFavPosts() {
    let ids = []
    try {
      const v = wx.getStorageSync(FAV_KEY)
      ids = Array.isArray(v) ? v : []
    } catch (e) {
      ids = []
    }
    if (!ids.length) {
      this.setData({ favPosts: [] })
      return Promise.resolve()
    }
    return cloud
      .squareFavlist(ids)
      .then(list => {
        if (list && list.length) {
          this.applyFavPosts(list)
          this.refreshFavSnaps(list)
        } else {
          this.applyFavSnapshots(ids)
        }
      })
      .catch(() => this.applyFavSnapshots(ids))
  },

  applyFavPosts(list) {
    const favPosts = (list || []).map(p =>
      Object.assign({}, p, {
        kindEmoji: KIND_EMOJI[p.petKind] || '🐾',
        breedText: p.petBreed ? ' · ' + p.petBreed : '',
        timeText: util.formatDateTime(p.createdAt)
      })
    )
    this.setData({ favPosts })
  },

  // 用云端最新数据更新本地快照
  refreshFavSnaps(list) {
    try {
      const map = wx.getStorageSync(FAV_POSTS_KEY) || {}
      list.forEach(p => {
        map[p._id] = {
          _id: p._id,
          petKind: p.petKind,
          petBreed: p.petBreed,
          part: p.part,
          title: p.title,
          excerpt: p.excerpt,
          image: p.image,
          createdAt: p.createdAt,
          demo: !!p.demo,
          fromConsult: !!p.fromConsult,
          likeCount: p.likeCount || (p.likes || []).length,
          commentCount: (p.comments || []).length
        }
      })
      wx.setStorageSync(FAV_POSTS_KEY, map)
    } catch (e) {}
  },

  // 云端不可用：用收藏时保存的本地快照展示
  applyFavSnapshots(ids) {
    let map = {}
    try {
      map = wx.getStorageSync(FAV_POSTS_KEY) || {}
    } catch (e) {
      map = {}
    }
    const favPosts = ids
      .map(id => map[id])
      .filter(Boolean)
      .map(p =>
        Object.assign({}, p, {
          kindEmoji: KIND_EMOJI[p.petKind] || '🐾',
          breedText: p.petBreed ? ' · ' + p.petBreed : '',
          timeText: util.formatDateTime(p.createdAt)
        })
      )
    this.setData({ favPosts })
  },

  onUserTap() {
    if (!this.data.logged) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    // 已登录：编辑头像/昵称
    wx.showActionSheet({
      itemList: ['修改头像', '修改昵称'],
      success: res => {
        if (res.tapIndex === 0) this.editAvatar()
        else this.editNickname()
      }
    })
  },

  editAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: res => {
        const file = res.tempFiles[0]
        const ext = (file.tempFilePath.match(/\.(\w+)$/) || [, 'png'])[1]
        const cloudPath = `avatars/${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`
        wx.showLoading({ title: '上传中' })
        cloud
          .uploadFile(file.tempFilePath, cloudPath)
          .then(fileID => {
            wx.hideLoading()
            return this.saveProfile('', fileID)
          })
          .catch(() => {
            wx.hideLoading()
            wx.showToast({ title: '上传失败，请重试', icon: 'none' })
          })
      }
    })
  },

  editNickname() {
    wx.showModal({
      title: '修改昵称',
      editable: true,
      placeholderText: '请输入昵称',
      content: this.data.user.nickname || '',
      success: res => {
        if (!res.confirm) return
        const nickname = (res.content || '').trim().slice(0, 20)
        if (!nickname) {
          wx.showToast({ title: '昵称不能为空', icon: 'none' })
          return
        }
        this.saveProfile(nickname, '')
      }
    })
  },

  saveProfile(nickname, avatarUrl) {
    wx.showLoading({ title: '保存中' })
    return cloud
      .updateProfile(nickname, avatarUrl)
      .then(user => {
        wx.hideLoading()
        getApp().setLogin(Object.assign({}, getApp().getUser() || {}, user))
        this.setData({ user: getApp().getUser() })
        wx.showToast({ title: '已保存', icon: 'success' })
      })
      .catch(err => {
        wx.hideLoading()
        cloud.toastError(err)
      })
  },

  onAddPet() {
    if (!getApp().requireLogin()) return
    wx.navigateTo({ url: '/pages/addPet/addPet' })
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
  },

  onPetTap() {
    const id = this.data.currentPet && this.data.currentPet._id
    if (!id) return
    wx.navigateTo({ url: '/pages/addPet/addPet?id=' + id })
  },

  onRecordTap(e) {
    wx.navigateTo({ url: '/pages/recordDetail/recordDetail?id=' + e.currentTarget.dataset.id })
  },

  // 全部问诊记录
  onRecordsListTap() {
    wx.navigateTo({ url: '/pages/recordsList/recordsList' })
  },

  // 全部我的发布
  onMyPostsListTap() {
    wx.navigateTo({ url: '/pages/myPosts/myPosts' })
  },

  // 全部历史浏览记录
  onHistoryTap() {
    wx.navigateTo({ url: '/pages/history/history' })
  },

  // 点击某条浏览记录：跳转对应帖子
  onHistoryItemTap(e) {
    wx.navigateTo({ url: '/pages/postDetail/postDetail?id=' + e.currentTarget.dataset.id })
  },

  onRemindersTap() {
    if (!getApp().requireLogin()) return
    wx.navigateTo({ url: '/pages/reminders/reminders' })
  },

  onReminderTap(e) {
    wx.navigateTo({ url: '/pages/reminderEdit/reminderEdit?id=' + e.currentTarget.dataset.id })
  },

  onMyPostTap(e) {
    wx.navigateTo({ url: '/pages/postDetail/postDetail?id=' + e.currentTarget.dataset.id })
  },

  onFavPostTap(e) {
    wx.navigateTo({ url: '/pages/postDetail/postDetail?id=' + e.currentTarget.dataset.id })
  },

  onFavPostRemove(e) {
    const id = e.currentTarget.dataset.id
    let ids = []
    try {
      const v = wx.getStorageSync(FAV_KEY)
      ids = Array.isArray(v) ? v : []
    } catch (e2) {
      ids = []
    }
    ids = ids.filter(x => x !== id)
    try {
      wx.setStorageSync(FAV_KEY, ids)
      const map = wx.getStorageSync(FAV_POSTS_KEY) || {}
      delete map[id]
      wx.setStorageSync(FAV_POSTS_KEY, map)
    } catch (e2) {}
    this.setData({ favPosts: this.data.favPosts.filter(p => p._id !== id) })
    wx.showToast({ title: '已取消收藏', icon: 'none' })
  },

  onSettingsTap() {
    wx.navigateTo({ url: '/pages/settings/settings' })
  },

  onHospitals() {
    wx.navigateTo({ url: '/pages/hospitals/hospitals' })
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定退出当前账号吗？',
      confirmColor: '#FF5A5F',
      success: res => {
        if (!res.confirm) return
        getApp().logout()
        this.setData({ logged: false, user: {}, pets: [], petIndex: 0, currentPet: {}, records: [] })
        wx.showToast({ title: '已退出登录', icon: 'none' })
      }
    })
  }
})
