const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 视觉模型按优先级尝试：glm-4.6v-flash（免费、支持多图）→ glm-4v-flash（免费、仅单图）
const MODELS = ['glm-4.6v-flash', 'glm-4v-flash']
const MAX_IMAGES = 3

const SYSTEM_PROMPT = [
  '你是"AI宠物健康助手"，具备扎实兽医临床知识的在线问诊助手。回答必须准确、克制、可执行。',
  '【准确性要求】',
  '1. 只在有把握时下判断；不确定就明确说"仅凭这张照片/这段描述无法确诊"，并给出最可能的两个方向。',
  '2. 犬、猫、兔、鸟等物种的常见病差异极大，必须先确认物种再判断。',
  '3. 结合年龄段与品种特征，把遗传病、老年病、幼宠常见病纳入考虑。',
  '4. 照片与描述矛盾时，以主人描述为主，并指出矛盾点。',
  '5. 急症（呼吸困难、大出血、误食毒物、抽搐、昏迷、休克、难产、公猫排尿困难）直接判 red。',
  '【字段要求】',
  'analysis：客观描述照片可见体征或主人描述的症状，说明哪些信息支持判断、哪些缺失。照片看不到的不写。',
  'diseases：2-4 条，每条格式"病名 —— 支持依据"，按可能性从高到低。',
  'care：2-4 条可立即执行的家庭护理措施。',
  'visit：去医院的紧迫程度与建议检查项目。',
  'forbid：1-3 条当前禁止做的事。',
  '不得出现任何具体药物名称、剂量或处方。',
  'followUp：为提升准确性最需要主人补充的信息，写成问句，最多3条。',
  '【输出格式】只返回 JSON，所有字段都是字符串或字符串数组：',
  '{"level":"red|yellow|green","summary":"一句话结论","analysis":"","diseases":[""],"care":[""],"visit":"","forbid":[""],"followUp":[""]}'
].join('\n')

function callZhipu(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const req = https.request(
      {
        hostname: 'open.bigmodel.cn',
        path: '/api/paas/v4/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ZHIPU_API_KEY}`,
          'Content-Length': Buffer.byteLength(body)
        },
        // 单次请求上限 25s：两级模型回退最坏 50s，控制在函数 60s 超时内
        timeout: 25000
      },
      res => {
        let data = ''
        res.on('data', c => (data += c))
        res.on('end', () => {
          let parsed = null
          try {
            parsed = JSON.parse(data)
          } catch (e) {
            // 非 JSON 响应，交给下面统一报错
          }
          if (res.statusCode >= 400 || (parsed && parsed.error)) {
            const apiMsg =
              (parsed && parsed.error && (parsed.error.message || parsed.error.code)) ||
              String(data).slice(0, 300)
            return reject(new Error(`HTTP ${res.statusCode}: ${apiMsg}`))
          }
          if (!parsed) {
            return reject(new Error(`模型响应解析失败: ${String(data).slice(0, 200)}`))
          }
          resolve(parsed)
        })
      }
    )
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('模型请求超时')))
    req.write(body)
    req.end()
  })
}

function buildPetText(petProfile) {
  const p = petProfile || {}
  const breed = [p.category, p.breed].filter(Boolean).join(' ')
  const parts = [
    breed && `品种：${breed}`,
    p.gender && `性别：${p.gender}`,
    p.weight != null && `体重：${p.weight}kg`,
    p.birthDate && `出生日期：${p.birthDate}`,
    p.neutered && `绝育：${p.neutered}`,
    p.vaccinated && `疫苗：${p.vaccinated}`,
    p.dewormed && `驱虫：${p.dewormed}`
  ].filter(Boolean)
  return `宠物档案：${parts.length ? parts.join('；') : '暂无'}`
}

function parseJson(raw) {
  const cleaned = String(raw || '').replace(/```json|```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('模型未返回有效JSON')
  return JSON.parse(cleaned.slice(start, end + 1))
}

function toText(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v.trim()
  if (Array.isArray(v)) return v.map(toText).filter(Boolean).join('\n')
  if (typeof v === 'object') {
    return Object.keys(v)
      .map(k => toText(v[k]))
      .filter(Boolean)
      .join('\n')
  }
  return String(v)
}

// 统一拼装成前端展示的三段式文本，兼容模型返回的各种结构
function buildContent(data) {
  const lines = []
  const analysis = toText(data.analysis)
  if (analysis) lines.push(`【分析】${analysis}`)

  const diseases = toText(data.diseases)
  if (diseases) lines.push(`【可能病症】\n${diseases}`)

  const care = toText(data.care)
  const visit = toText(data.visit)
  const forbid = toText(data.forbid)
  if (care || visit || forbid) {
    const t = ['【治疗意见】']
    if (care) t.push(`· 家庭护理：${care}`)
    if (visit) t.push(`· 就医建议：${visit}`)
    if (forbid) t.push(`· 禁止事项：${forbid}`)
    lines.push(t.join('\n'))
  }

  // 兜底：模型没有按新字段返回时，沿用旧 content 字段
  if (!lines.length) {
    const fallback = toText(data.content)
    if (fallback) lines.push(fallback)
  }

  lines.push('以上建议不能替代执业兽医的现场诊断，若症状加重请立即就医。')
  return lines.join('\n\n')
}

exports.main = async event => {
  const apiKey = process.env.ZHIPU_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      msg: '云函数未读取到 ZHIPU_API_KEY',
      detail: '请在云开发控制台 → 云函数 → assistant → 配置 → 环境变量中添加 ZHIPU_API_KEY 后重试'
    }
  }

  try {
    const { question = '', petProfile = {}, fileIDs = [] } = event

    // 内容安全：问题文本违规直接拦截；openapi 不可用时放行（fail-open）
    try {
      const sec = await cloud.openapi.security.msgSecCheck({
        version: 2,
        scene: 2,
        openid: cloud.getWXContext().OPENID,
        content: question
      })
      const d = sec && sec.result
      if (d && d.suggest && d.suggest !== 'pass') {
        return { ok: false, msg: '问题内容涉嫌违规，请修改后重试' }
      }
    } catch (e) {
      console.warn('[assistant] msgSecCheck 不可用，放行', e && e.message)
    }

    const content = []
    for (const fileID of fileIDs.slice(0, MAX_IMAGES)) {
      const file = await cloud.downloadFile({ fileID })
      if (file.fileContent.length > 4 * 1024 * 1024) {
        return { ok: false, msg: '图片过大，请压缩后重试' }
      }
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${file.fileContent.toString('base64')}` }
      })
    }
    const userText = `${buildPetText(petProfile)}\n\n用户描述：${question || '（仅上传了照片，请结合照片分析）'}`
    content.push({ type: 'text', text: userText })

    // 依次尝试候选模型：单图模型只取第一张图
    let lastErr = null
    for (const model of MODELS) {
      try {
        const res = await callZhipu({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: model === 'glm-4v-flash' ? content.slice(0, 1).concat(content.slice(-1)) : content }
          ],
          temperature: 0.2,
          max_tokens: 1024
        })
        const data = parseJson(res.choices[0].message.content)
        return {
          ok: true,
          model,
          data: {
            level: data.level || 'yellow',
            summary: toText(data.summary),
            content: buildContent(data),
            followUp: (Array.isArray(data.followUp) ? data.followUp : []).map(toText).filter(Boolean).slice(0, 3)
          }
        }
      } catch (e) {
        lastErr = e
        console.error(`[assistant] ${model} 调用失败:`, e && e.message)
      }
    }
    throw lastErr || new Error('模型调用失败')
  } catch (e) {
    console.error('[assistant]', e)
    return {
      ok: false,
      msg: 'AI服务繁忙，请稍后重试',
      detail: String((e && e.message) || e)
    }
  }
}