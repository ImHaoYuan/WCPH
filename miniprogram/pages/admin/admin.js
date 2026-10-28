const cloud = require('../../utils/cloud')
const util = require('../../utils/util')

const KIND_EMOJI = { 猫: '🐱', 狗: '🐶', 兔: '🐰', 鸟: '🐦', 仓鼠: '🐹', 乌龟: '🐢' }

Page({
  data: {
    tab: 'accounts',
    posts: [],
    reports: [],
    accounts: [],
    stats: { users: 0, pets: 0, records: 0, posts: 0 },
    recentUsers: [],
    newAccount: { username: '', password: '', nickname: '' },
    loading: true,
    loadingAccounts: false,
    loadingStats: false,
    addingAccount: false,
    isAdmin: false
  },

  onLoad() {
    // 本地管理员登录态优先：登录成功后直接进后台，云端校验后台异步复核
    if (getApp().isAdminLoggedIn()) {
      this.setData({ isAdmin: true, loading: false })
      this.loadTabData()
      cloud
        .squareAmIAdmin()
        .then(res => {
          if (!(res && res.isAdmin)) {
            // 云端判定不一致时以本地为准，但仍提示可能需重新部署云函数
            console.warn('[admin] 云端未识别当前账号为管理员，请确认 login/square 云函数已重新部署')
          }
        })
        .catch(() => {})
      return
    }
    cloud
      .squareAmIAdmin()
      .then(res => {
        this.setData({ isAdmin: !!(res && res.isAdmin) })
        if (res && res.isAdmin) this.loadTabData()
        else this.setData({ loading: false })
      })
      .catch(() => this.setData({ loading: false, isAdmin: false }))
  },

  onPullDownRefresh() {
    if (!this.data.isAdmin) {
      wx.stopPullDownRefresh()
      return
    }
    this.loadTabData().then(() => wx.stopPullDownRefresh())
  },

  onTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ tab })
    this.loadTabData()
  },

  // 按当前标签懒加载数据
  loadTabData() {
    const t = this.data.tab
    if (t === 'accounts') {
      return Promise.all([this.loadAccounts(), this.loadAll()])
    }
    if (t === 'posts' || t === 'reports') return this.loadAll()
    if (t === 'stats') return this.loadStats()
    return Promise.resolve()
  },

  loadAccounts() {
    this.setData({ loadingAccounts: true })
    return cloud
      .adminListAccounts()
      .then(list => {
        const accounts = (list || []).map(a =>
          Object.assign({}, a, { timeText: util.formatDateTime(a.createdAt) })
        )
        this.setData({ accounts, loadingAccounts: false })
      })
      .catch(err => {
        this.setData({ loadingAccounts: false })
        cloud.toastError(err)
      })
  },

  loadStats() {
    this.setData({ loadingStats: true })
    return cloud
      .adminStats()
      .then(res => {
        const recentUsers = ((res && res.recentUsers) || []).map(u =>
          Object.assign({}, u, { timeText: util.formatDateTime(u.createdAt) })
        )
        this.setData({
          stats: (res && res.stats) || this.data.stats,
          recentUsers,
          loadingStats: false
        })
      })
      .catch(err => {
        this.setData({ loadingStats: false })
        cloud.toastError(err)
      })
  },

  loadAll() {
    this.setData({ loading: true })
    const p1 = cloud
      .squareAdminPosts()
      .then(list => {
        const posts = (list || []).map(p =>
          Object.assign({}, p, {
            timeText: util.formatDateTime(p.createdAt),
            kindEmoji: KIND_EMOJI[p.petKind] || '🐾'
          })
        )
        this.setData({ posts })
      })
      .catch(cloud.toastError)
    const p2 = cloud
      .squareAdminReports()
      .then(list => {
        const reports = (list || []).map(r =>
          Object.assign({}, r, {
            timeText: util.formatDateTime(r.createdAt),
            statusText: r.status === 'handled' ? '已处理' : '待处理'
          })
        )
        this.setData({ reports })
      })
      .catch(cloud.toastError)
    return Promise.all([p1, p2]).then(() => this.setData({ loading: false }))
  },

  onAccountInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ ['newAccount.' + key]: e.detail.value })
  },

  onAddAccount() {
    const a = this.data.newAccount
    const username = a.username.trim()
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      wx.showToast({ title: '账号需为3-20位字母/数字/下划线', icon: 'none' })
      return
    }
    if (!a.password || a.password.length < 6) {
      wx.showToast({ title: '密码至少6位', icon: 'none' })
      return
    }
    this.setData({ addingAccount: true })
    cloud
      .adminAddAccount(username, a.password, a.nickname.trim())
      .then(() => {
        this.setData({ addingAccount: false, newAccount: { username: '', password: '', nickname: '' } })
        wx.showToast({ title: '账号已添加', icon: 'success' })
        this.loadAccounts()
      })
      .catch(err => {
        this.setData({ addingAccount: false })
        cloud.toastError(err)
      })
  },

  onRemoveAccount(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除账号',
      content: '确定删除该账号吗？该账号用户将无法再登录。',
      confirmColor: '#FF5A5F',
      success: res => {
        if (!res.confirm) return
        wx.showLoading({ title: '删除中' })
        cloud
          .adminRemoveAccount(id)
          .then(() => {
            wx.hideLoading()
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadAccounts()
          })
          .catch(err => {
            wx.hideLoading()
            cloud.toastError(err)
          })
      }
    })
  },

  removePost(id) {
    wx.showModal({
      title: '下架帖子',
      content: '确定下架（删除）该帖子吗？',
      confirmColor: '#FF5A5F',
      success: res => {
        if (!res.confirm) return
        wx.showLoading({ title: '处理中' })
        cloud
          .squareAdminRemove(id)
          .then(() => {
            wx.hideLoading()
            wx.showToast({ title: '已下架', icon: 'success' })
            this.loadAll()
          })
          .catch(err => {
            wx.hideLoading()
            cloud.toastError(err)
          })
      }
    })
  },

  onRemovePost(e) {
    this.removePost(e.currentTarget.dataset.id)
  },

  onRemoveReportedPost(e) {
    this.removePost(e.currentTarget.dataset.postid)
  },

  onHandleReport(e) {
    const id = e.currentTarget.dataset.id
    cloud
      .squareAdminHandleReport(id)
      .then(() => {
        wx.showToast({ title: '已标记处理', icon: 'none' })
        this.loadAll()
      })
      .catch(cloud.toastError)
  },

  goAdminLogin() {
    wx.navigateTo({ url: '/pages/adminLogin/adminLogin' })
  },

  onLogoutAdmin() {
    wx.showModal({
      title: '退出管理员登录',
      content: '确定退出管理员后台吗？',
      success: res => {
        if (!res.confirm) return
        getApp().logoutAdmin()
        wx.showToast({ title: '已退出', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 600)
      }
    })
  }
})
