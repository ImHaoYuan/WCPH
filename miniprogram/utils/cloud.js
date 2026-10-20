/**
 * 云开发调用封装：统一处理 callFunction 与错误提示
 * 依赖云函数：login / pet / record
 */

function call(name, data) {
  return wx.cloud
    .callFunction({ name, data })
    .then(res => {
      const result = res && res.result
      if (result && result.ok === false) {
        return Promise.reject(new Error(result.msg || '操作失败'))
      }
      return result ? result.data : null
    })
    .catch(err => {
      console.error(`[cloud] ${name}`, err)
      const msg = (err && err.message) || '云函数调用失败，请确认已部署云函数'
      return Promise.reject(new Error(msg))
    })
}

function toastError(err) {
  wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
}

module.exports = {
  call,
  toastError,

  // ===== 登录 =====
  smsLogin: (phone, code) => call('login', { action: 'smsLogin', phone, code }),
  phoneLogin: cloudID => call('login', { action: 'phoneLogin', cloudID }),
  sendCode: phone => call('login', { action: 'sendCode', phone }),

  // ===== 宠物 =====
  listPets: () => call('pet', { action: 'list' }),
  getPet: id => call('pet', { action: 'get', id }),
  addPet: pet => call('pet', { action: 'add', pet }),
  updatePet: (id, pet) => call('pet', { action: 'update', id, pet }),
  deletePet: id => call('pet', { action: 'remove', id }),
  countPets: () => call('pet', { action: 'count' }),

  // ===== 问诊记录 =====
  listRecords: () => call('record', { action: 'list' }),
  getRecord: id => call('record', { action: 'get', id }),
  addRecord: record => call('record', { action: 'add', record }),
  updateRecord: (id, record) => call('record', { action: 'update', id, record }),
  deleteRecord: id => call('record', { action: 'remove', id })
}
