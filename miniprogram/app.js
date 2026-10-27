const config = require('./config')

const USER_KEY = 'pet_user'
const ADMIN_KEY = 'pet_admin'

App({
  globalData: {
    openid: null,
    userInfo: null,
    adminInfo: null,
    envId: config.envId
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      try {
        wx.cloud.init({
          env: config.envId,
          traceUser: true
        })
      } catch (e) {
        // 云环境未开通或 envId 不匹配时不应阻断页面渲染
        console.error('云开发初始化失败，请检查 config.js 的 envId 与云开发是否已开通：', e)
      }
    }
    const cached = wx.getStorageSync(USER_KEY)
    if (cached) {
      this.globalData.userInfo = cached
      this.globalData.openid = cached.openid || null
    }
    const adminCached = wx.getStorageSync(ADMIN_KEY)
    if (adminCached) {
      this.globalData.adminInfo = adminCached
    }
    if (!this.isLoggedIn()) {
      wx.showToast({
        title: '登录过期，请先登录',
        icon: 'none',
        duration: 2000
      })
    }
  },

  isLoggedIn() {
    return !!this.globalData.userInfo
  },

  getUser() {
    return this.globalData.userInfo
  },

  setLogin(userInfo) {
    this.globalData.userInfo = userInfo
    this.globalData.openid = userInfo.openid || null
    wx.setStorageSync(USER_KEY, userInfo)
  },

  logout() {
    this.globalData.userInfo = null
    this.globalData.openid = null
    wx.removeStorageSync(USER_KEY)
  },

  // ===== 管理员登录态（独立于普通用户登录态） =====
  isAdminLoggedIn() {
    return !!this.globalData.adminInfo
  },

  getAdmin() {
    return this.globalData.adminInfo
  },

  setAdminLogin(adminInfo) {
    this.globalData.adminInfo = adminInfo
    wx.setStorageSync(ADMIN_KEY, adminInfo)
  },

  logoutAdmin() {
    this.globalData.adminInfo = null
    wx.removeStorageSync(ADMIN_KEY)
  },

  // 需要登录的操作统一走这里：已登录返回 true，未登录跳转登录页并返回 false
  requireLogin() {
    if (this.isLoggedIn()) return true
    wx.navigateTo({ url: '/pages/login/login' })
    return false
  }
})
