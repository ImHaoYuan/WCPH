/**
 * 通用工具函数
 */

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatDateTime(date) {
  const d = date instanceof Date ? date : new Date(date)
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function todayStr() {
  return formatDate(new Date())
}

// 校验手机号（中国大陆）
function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(String(phone || '').trim())
}

// 根据出生日期计算年龄描述
function calcAge(birthDate) {
  if (!birthDate) return '年龄未知'
  const birth = new Date(birthDate.replace(/-/g, '/'))
  if (isNaN(birth.getTime())) return '年龄未知'
  const now = new Date()
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (now.getDate() < birth.getDate()) months--
  if (months < 0) months = 0
  const years = Math.floor(months / 12)
  const rem = months % 12
  if (years <= 0) return rem <= 0 ? '不足1个月' : `${rem}个月`
  return rem === 0 ? `${years}岁` : `${years}岁${rem}个月`
}

// 生成演示用短信验证码（无短信服务商，前端模拟）
function genSmsCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// 健康提醒类型字典（与 cloudfunctions/reminder 的 TYPES 对应）
const REMINDER_TYPES = [
  { value: 'vaccine', label: '疫苗接种', emoji: '💉' },
  { value: 'deworm_in', label: '体内驱虫', emoji: '🪱' },
  { value: 'deworm_out', label: '体外驱虫', emoji: '🐛' },
  { value: 'recheck', label: '复诊', emoji: '🏥' },
  { value: 'medication', label: '用药', emoji: '💊' },
  { value: 'custom', label: '自定义', emoji: '⏰' }
]

const REMINDER_REPEATS = [
  { value: 'none', label: '不重复' },
  { value: 'monthly', label: '每月' },
  { value: 'quarterly', label: '每季度' },
  { value: 'yearly', label: '每年' }
]

function reminderTypeMeta(value) {
  return (
    REMINDER_TYPES.find(t => t.value === value) || REMINDER_TYPES[REMINDER_TYPES.length - 1]
  )
}

function reminderRepeatLabel(value) {
  const r = REMINDER_REPEATS.find(t => t.value === value)
  return r ? r.label : '不重复'
}

// 到期时间的人性化描述
function reminderDueText(dueAt) {
  if (!dueAt) return ''
  const due = new Date(dueAt)
  if (isNaN(due.getTime())) return formatDate(dueAt)
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const now = new Date()
  const diffDays = Math.round((startOfDay(due) - startOfDay(now)) / 86400000)
  if (diffDays < 0) return `已过期${-diffDays}天`
  if (diffDays === 0) return '今天到期'
  if (diffDays === 1) return '明天到期'
  if (diffDays <= 7) return `${diffDays}天后到期`
  return formatDate(dueAt)
}

/**
 * 模拟影像分析（演示用）：根据用户文字与媒体类型生成“影像初析”描述。
 * 真实项目应接入图像识别大模型。
 */
function mediaFinding(text, media) {
  const t = String(text || '')
  const isVideo = !!(media && media.video)

  if (!isVideo) {
    if (/皮肤|痒|挠|脱毛|掉毛|红疹|皮屑|癣/.test(t)) {
      return '患处局部可见圆形/不规则脱毛区，边缘略红并伴少量皮屑，中心皮肤呈淡粉色，未见明显破溃与渗出，外观倾向浅表皮炎或真菌感染早期表现。'
    }
    if (/呕吐|吐/.test(t)) {
      return '呕吐物中可见未完全消化的食物颗粒与少量黏液，颜色黄褐，未见明显血丝、胆汁样深绿色液体或线状异物。'
    }
    if (/便|拉稀|腹泻|软便|粪/.test(t)) {
      return '粪便形态偏软、成形度下降，颜色黄褐，表面附少量黏液，未见鲜血、黑便及虫体。'
    }
    if (/眼|流泪|分泌物/.test(t)) {
      return '眼部可见少量棕黄色分泌物附着于内眼角，结膜轻度充血，角膜表面尚清亮。'
    }
    if (/耳|挠耳|耳道/.test(t)) {
      return '耳道内可见棕褐色蜡样分泌物增多，耳廓内侧皮肤轻度发红。'
    }
    if (/伤口|肿块|包|肿/.test(t)) {
      return '患处可见局部隆起，表面毛发结块，皮肤完整未见破溃出血，周围无大面积淤血。'
    }
    return '照片初步观察患处外观与描述基本一致，暂未发现危及生命的表现。建议补充1-2张更近距离、光线充足的照片以便进一步比对。'
  }

  if (/走|路|腿|脚|瘸|跛|跳/.test(t)) {
    return '视频中宠物可自主行走，患侧肢体负重略减少、步幅变短，未见明显骨折畸形与拖行。'
  }
  if (/呼吸|喘|咳嗽/.test(t)) {
    return '视频中呼吸频率略偏快，可见轻度腹式呼吸，未见明显张口呼吸与颈部前伸等窘迫表现。'
  }
  return '视频中宠物精神状态尚可，对呼唤有反应，呼吸平稳，未见明显抽搐、转圈、跛行等异常动作。'
}

/**
 * 模拟 AI 问诊回复（演示用，基于关键词的初步健康建议）。
 * 返回 { level, content }：
 *  - level: 'red' 立刻送医 | 'yellow' 建议观察 | 'green' 居家护理
 *  - content: 回复正文（含影像初析）
 * 真实项目应替换为后端大模型接口。
 */
function aiConsult(text, petInfo, media) {
  const t = String(text || '')
  const petName = (petInfo && petInfo.name) || '您的宠物'
  const species = (petInfo && petInfo.category) || ''
  const hasMedia = !!(media && ((media.images && media.images.length) || media.video))
  const mediaNote = hasMedia
    ? `\n\n🔍 影像初析（模拟）：\n${mediaFinding(t, media)}\n（以上为演示用模拟分析，正式版本将接入图像识别大模型）`
    : ''

  const urgent = ['呼吸困难', '大出血', '出血不止', '误食', '中毒', '抽搐', '昏迷', '休克', '难产', '惊厥', '瘫痪', '排不出尿']
  if (urgent.some(k => t.includes(k))) {
    return {
      level: 'red',
      content: `🚨 紧急提示：${petName}出现的症状可能属于危急情况。请立即停止在线咨询，第一时间送往最近的宠物医院急诊，途中注意保暖、保持呼吸道通畅。${mediaNote}`
    }
  }

  if (/呕吐|吐/.test(t)) {
    return {
      level: 'yellow',
      content: `关于${petName}的呕吐，建议先观察：\n1. 呕吐频率与内容物（未消化食物/黄水/带血）；\n2. 是否伴随精神沉郁、腹泻、拒食；\n3. 近期是否更换粮食或误食异物。\n\n偶发一次且精神食欲正常，可先禁食6-12小时（供水），少量多餐观察；若频繁呕吐、带血或精神差，请尽快就医排查异物、肠胃炎或胰腺炎。${mediaNote}`
    }
  }
  if (/拉稀|腹泻|软便|便血/.test(t)) {
    return {
      level: 'yellow',
      content: `关于${petName}的腹泻，请注意：\n1. 粪便形态、颜色、有无血丝或黏液；\n2. 是否更换饮食、着凉或驱虫情况；\n3. 有无呕吐、发热、食欲下降。\n\n轻症可先喂益生菌+清淡饮食观察24-48小时；幼宠、便血、伴发热或脱水（皮肤回弹慢）需尽快就医，排查寄生虫、细小/冠状等传染病。${mediaNote}`
    }
  }
  if (/不吃|拒食|食欲|不吃东西/.test(t)) {
    return {
      level: 'yellow',
      content: `${petName}食欲下降的常见原因包括：环境变化/应激、口腔问题、消化道不适、发热或慢性病。\n建议测量体温、检查口腔与精神状态，观察是否饮水正常。\n若超过24小时完全拒食（幼宠12小时），或伴呕吐、嗜睡，请及时就医，避免脱水与脂肪肝（猫尤其危险）。${mediaNote}`
    }
  }
  if (/挠|痒|脱毛|掉毛|皮肤|红疹|皮屑/.test(t)) {
    return {
      level: 'yellow',
      content: `${petName}的皮肤瘙痒/脱毛常见于：跳蚤或螨虫、真菌（癣）、细菌性皮炎、过敏。\n建议：检查有无皮屑、结痂、红斑与虫体，规律体外驱虫，佩戴伊丽莎白圈防止舔咬。\n若持续抓挠、局部脱毛扩大或有异味，请就医做皮肤刮片/伍德氏灯检查以明确病因。${mediaNote}`
    }
  }
  if (/咳嗽|打喷嚏|流鼻涕|感冒/.test(t)) {
    return {
      level: 'yellow',
      content: `${petName}的呼吸道症状需注意：是否伴发热、鼻涕性状（清/脓）、有无呼吸困难。\n保持环境通风保暖、避免刺激气味。\n若出现脓性鼻涕、持续咳嗽、呼吸急促或精神差，请尽快就医排查犬窝咳、猫鼻支、肺炎等。${mediaNote}`
    }
  }
  if (/疫苗|驱虫|绝育|体检|喂养|喂什么/.test(t)) {
    return {
      level: 'green',
      content: `关于${petName}的日常保健建议：\n· 疫苗：幼宠按程序完成核心疫苗，成年后每年加强；\n· 驱虫：体内每1-3个月、体外每月一次（按产品说明）；\n· 绝育：非繁育用途建议适时绝育，可降低部分疾病风险；\n· 饮食：选择适龄优质主粮，避免洋葱、葡萄、巧克力、木糖醇等有毒食物。\n如需针对性方案，请告诉我${species}的具体年龄与体重。${mediaNote}`
    }
  }

  return {
    level: 'green',
    content: `我已收到关于${petName}的描述。为更准确评估，请尽量补充：\n1. 症状出现的时间与频率；\n2. 异常行为的具体表现；\n3. 近期饮食、排便、精神与食欲；\n4. 疫苗接种与驱虫史。\n\n温馨提示：以上为基于常见宠物医学知识的初步建议，不能替代执业兽医的现场诊断。若症状加重或出现危急情况，请立即就医。${mediaNote}`
  }
}

module.exports = {
  formatDate,
  formatDateTime,
  todayStr,
  isValidPhone,
  calcAge,
  genSmsCode,
  aiConsult,
  REMINDER_TYPES,
  REMINDER_REPEATS,
  reminderTypeMeta,
  reminderRepeatLabel,
  reminderDueText
}
