const cloud = require('../../utils/cloud')
const util = require('../../utils/util')

const REMEMBER_KEY = 'remember_phone'

Page({
  data: {
    loginTab: 'phone',
    phone: '',
    code: '',
    username: '',
    password: '',
    showPwd: false,
    remember: false,
    agreed: false,
    countdown: 0,
    codeText: '获取验证码',
    saving: false,
    wxSaving: false
  },

  _timer: null,

  onLoad() {
    const saved = wx.getStorageSync(REMEMBER_KEY)
    if (saved) {
      this.setData({ phone: saved, remember: true })
    }
  },

  onUnload() {
    this.clearTimer()
  },

  switchTab(e) {
    this.setData({ loginTab: e.currentTarget.dataset.tab })
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value })
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value })
  },

  togglePwd() {
    this.setData({ showPwd: !this.data.showPwd })
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
  },

  onCodeInput(e) {
    this.setData({ code: e.detail.value })
  },

  onToggleAgreement() {
    this.setData({ agreed: !this.data.agreed })
  },

  showAgreementToast() {
    wx.showToast({
      title: '先阅读并同意《用户协议》与《隐私政策》',
      icon: 'none',
      duration: 2000
    })
  },

  ensureAgreement() {
    if (this.data.agreed) return true
    this.showAgreementToast()
    return false
  },

  onWxLoginTap() {
    if (!this.data.agreed) this.showAgreementToast()
  },

  toggleRemember() {
    const remember = !this.data.remember
    this.setData({ remember })
    if (remember) {
      if (this.data.phone) wx.setStorageSync(REMEMBER_KEY, this.data.phone)
    } else {
      wx.removeStorageSync(REMEMBER_KEY)
    }
  },

  clearTimer() {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  },

  startCountdown() {
    this.clearTimer()
    this.setData({ countdown: 60, codeText: '60s' })
    this._timer = setInterval(() => {
      const c = this.data.countdown - 1
      if (c <= 0) {
        this.clearTimer()
        this.setData({ countdown: 0, codeText: '重新获取' })
      } else {
        this.setData({ countdown: c, codeText: c + 's' })
      }
    }, 1000)
  },

  getCode() {
    if (this.data.countdown > 0) return
    const phone = this.data.phone.trim()
    if (!util.isValidPhone(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (this.data.remember) wx.setStorageSync(REMEMBER_KEY, phone)
    cloud
      .sendCode(phone)
      .then(res => {
        this.startCountdown()
        // 演示环境无短信服务商，验证码由云函数回传后本地提示
        wx.showModal({
          title: '验证码已发送',
          content: '演示环境验证码：' + ((res && res.code) || '------'),
          showCancel: false,
          confirmText: '知道了'
        })
      })
      .catch(cloud.toastError)
  },

  finishLogin(userInfo) {
    getApp().setLogin(userInfo)
    wx.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        wx.navigateBack()
      } else {
        wx.switchTab({ url: '/pages/mine/mine' })
      }
    }, 800)
  },

  doLogin() {
    if (!this.ensureAgreement()) return
    const phone = this.data.phone.trim()
    const code = this.data.code.trim()
    if (!util.isValidPhone(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (!/^\d{6}$/.test(code)) {
      wx.showToast({ title: '请输入6位验证码', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    cloud
      .smsLogin(phone, code)
      .then(result => {
        this.setData({ saving: false })
        if (result && result.needSetPassword) {
          wx.showModal({
            title: '提示',
            content: '该手机号是第一次注册，请先设置密码',
            showCancel: false,
            confirmText: '确定',
            success: res => {
              if (res.confirm) {
                // 等弹窗完全关闭后再跳转，避免弹窗与页面过渡动画叠加导致渲染异常
                setTimeout(() => {
                  wx.navigateTo({
                    url: '/pages/setPassword/setPassword?mode=register&phone=' + phone + '&code=' + code
                  })
                }, 300)
              }
            }
          })
          return
        }
        const userInfo = result && result.userInfo
        if (!userInfo || !userInfo.openid) throw new Error('登录信息不完整，请重试')
        this.finishLogin(userInfo)
      })
      .catch(err => {
        this.setData({ saving: false })
        cloud.toastError(err)
      })
  },

  // 账号密码登录（账号由管理员在后台创建）
  doAccountLogin() {
    if (!this.ensureAgreement()) return
    const username = this.data.username.trim()
    const password = this.data.password
    if (!util.isValidPhone(username)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    cloud
      .accountLogin(username, password)
      .then(userInfo => {
        this.setData({ saving: false })
        this.finishLogin(userInfo)
      })
      .catch(err => {
        this.setData({ saving: false })
        cloud.toastError(err)
      })
  },

  onForgotPassword() {
    wx.navigateTo({ url: '/pages/forgotPassword/forgotPassword' })
  },

  // 管理员登录入口
  onAdminLogin() {
    wx.navigateTo({ url: '/pages/adminLogin/adminLogin' })
  },

  // 微信原生手机号授权：成功后仅把 cloudID 交给云函数解析并创建/更新用户
  onGetPhone(e) {
    if (!this.ensureAgreement() || this.data.wxSaving) return
    const detail = (e && e.detail) || {}
    if (!detail.cloudID) {
      const errMsg = String(detail.errMsg || '')
      const canceled = /cancel|deny|auth/i.test(errMsg)
      wx.showToast({
        title: canceled ? '已取消授权' : '微信授权失败，请重试',
        icon: 'none',
        duration: 2000
      })
      return
    }
    this.setData({ wxSaving: true })
    wx.showLoading({ title: '微信登录中', mask: true })
    cloud
      .phoneLogin(detail.cloudID)
      .then(userInfo => {
        if (!userInfo || !userInfo.openid) throw new Error('微信登录信息不完整，请重试')
        wx.hideLoading()
        this.setData({ wxSaving: false })
        this.finishLogin(userInfo)
      })
      .catch(err => {
        wx.hideLoading()
        this.setData({ wxSaving: false })
        cloud.toastError(err)
      })
  }
})
