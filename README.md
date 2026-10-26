# AI 宠物助手（微信小程序）

基于微信云开发的养宠助手小程序：以宠物档案为底座，用 AI 对话承接日常咨询与症状初判，把每次交流沉淀为可回溯的健康记录，并逐步引入疫苗、驱虫、复诊提醒。

> 完整需求见 [spec.md](./spec.md)。本文档描述**当前实现状态**与**目标形态**，两者不一致处以 spec 为准。

## 产品定位

| 维度 | 说明 |
|---|---|
| 一句话 | 每天都用得上的养宠助手，而不只是生病时才打开的问诊工具 |
| 目标用户 | 新手宠物主、多宠家庭、关注预防的用户 |
| 核心闭环 | 建档 → 对话 → 记录沉淀 → 提醒跟进 |
| 边界 | 不做在线诊疗，不开处方，不替代执业兽医 |

## 功能概览

### 当前已实现

- **AI 问诊（Tab）**：宠物横向管理（最多 5 只）、说明卡片、悬浮「马上问诊」。
- **我的（Tab）**：用户信息、我的宠物、问诊记录、退出登录。
- **添加/编辑宠物**：头像（相册上传或 emoji 卡通头像）、分类-品种联动、性别、出生日期、体重、绝育/驱虫状态，含表单校验。
- **登录**：微信手机号一键登录 + 手机号验证码登录（60s 倒计时、记住手机号）。
- **AI 对话页**：基于关键词规则的初步健康评估，急症词短路，自动归档问诊记录。
- **记录详情**：消息流展示、删除。
- **健康计划与提醒**：疫苗/驱虫/复诊/用药/自定义六类提醒，周期自动排下一次，待办/已处理状态流转（应用内提醒，订阅消息待模板）。
- **症状拍照问诊**：结构化表单（类型/患处/病程/瘙痒/食欲/疫苗）+ 拍照引导 + 模糊图提示重拍，提交后自动进入对话生成 AI 分诊报告。
- **问诊广场**：分页列表（部位标签/缩略图/上拉加载）、帖子详情（原图/点赞/评论/举报）、脱敏发布、我的发布管理。
- **内容安全与合规**：问诊文本/帖子/评论接入 msgSecCheck（失败自动放行）；首次问诊免责弹窗；每份 AI 报告固定免责声明；高风险结果红色预警 + 一键拨打医院。
- **管理员后台**：openid 白名单（见配置说明），帖子下架、举报处理。
- **设置与协议**：免责声明 / 隐私说明 / 内容安全 / 关于我们。

### 规划中（详见 spec.md）

| 阶段 | 内容 |
|---|---|
| M2 | 三 Tab 结构调整：AI 助手 / 记录 / 我的 |
| M3 | AI 意图路由（8 类）+ 结构化追问 |
| M4 | 健康计划与提醒（订阅消息）｜ 应用内提醒已完成 |
| M5 | 云函数代理大模型，超时降级到本地规则 ｜ 已接入智谱 GLM |

## 技术栈

- 小程序原生框架（WXML / WXSS / JS），基础库 `2.24.4`
- 微信云开发：云函数 + 云数据库 + 云存储
- 云函数运行时：Node.js + `wx-server-sdk`

## 目录结构

```
miniprogram/
  app.js / app.json / app.wxss   # 全局逻辑、页面与 tabBar 配置、全局样式
  config.js                      # 云开发环境 ID
  images/tabbar/                 # tabBar 图标
  utils/
    cloud.js                     # 云函数调用封装（统一 { ok, data, msg } 协议）
    petDict.js                   # 宠物分类-品种字典
    util.js                      # 日期/校验/年龄计算/AI 规则回复
  pages/
    consult/      AI 问诊首页（规划中迁移为 assistant/）
    consultForm/  症状拍照问诊表单
    square/       问诊广场列表
    postDetail/   广场帖子详情
    admin/        管理员后台（白名单）
    settings/     设置与协议
    mine/         我的
    login/        登录
    addPet/       添加/编辑宠物
    chat/         AI 对话
    recordDetail/ 问诊记录详情
    reminders/    健康计划列表
    reminderEdit/ 提醒创建/编辑
cloudfunctions/
  login/          登录与验证码
  pet/            宠物 CRUD（服务端强制 5 只上限）
  record/         问诊记录 CRUD
  assistant/      大模型代理（智谱 GLM 视觉模型 + 问题内容安全）
  square/         问诊广场（分页/详情/点赞/评论/举报/管理员）
  reminder/       健康提醒 CRUD 与状态流转
spec.md           产品需求文档
```

## 数据模型

| 集合 | 用途 | 关键字段 |
|---|---|---|
| `users` | 用户 | `_openid`、`phone`、`nickname`、`avatarUrl` |
| `pets` | 宠物档案 | `_openid`、`name`、`avatar`、`category`、`breed`、`birthDate`、`weight`、`neutered`、`body`、`dewormed`、`vaccinated` |
| `records` | 对话记录 | `_openid`、`petId`、`petName`、`title`、`messages[]`、`createdAt` |
| `reminders` | 健康提醒 | `_openid`、`petId`、`petName`、`type`、`title`、`dueAt`、`repeat`、`status`、`notifiedAt` |
| `sms_codes` | 验证码（演示） | `_openid`、`phone`、`code`、`expireAt` |

所有集合以 `_openid` 隔离用户数据；集合由云函数首次调用时自动创建。

## 运行与部署（重要）

本项目依赖微信云开发，未完成以下配置时页面会提示「云函数调用失败」。

1. 用[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)打开本目录。
2. 确认云开发环境：本项目的环境 ID 为 **`ai-d5gc65qrdab971a09`**，已写入 `miniprogram/config.js` 的 `envId`。若你的账号下环境不同，请替换为控制台中实际的环境 ID。
3. 右键 `cloudfunctions/login`、`cloudfunctions/pet`、`cloudfunctions/record`、`cloudfunctions/assistant`、`cloudfunctions/square`、`cloudfunctions/reminder`，分别执行 **「上传并部署：云端安装依赖」**。
4. 集合 `users` / `pets` / `records` / `sms_codes` / `reminders` 会在云函数首次调用时自动创建，无需手动建表；`reminders` 集合建议在控制台添加 `_openid + dueAt` 组合索引（列表查询用）。`square_posts` / `square_reports` 由 `square` 云函数自动创建。
5. 编译运行。
6. 管理员白名单：编辑 `cloudfunctions/square/index.js` 顶部的 `ADMIN_OPENIDS` 数组，填入管理员 openid（可在控制台 → 数据库 → users 集合查看）后重新部署；「我的」页将出现管理员后台入口。
7. 内容安全校验（msgSecCheck）依赖云函数调用微信 openapi 的权限；接口不可用或报错时自动放行，不影响演示。

> 云环境 `ai-d5gc65qrdab971a09` 下 `login`、`pet`、`record` 已部署；`assistant`、`square`、`reminder` 按上述步骤部署即可（未部署时问诊降级本地规则、广场降级示例数据）。

## AI 实现说明

### V1（当前降级方案）

`utils/util.js` 的 `aiReply` 为**本地关键词规则**：

- 急症词（呼吸困难、大出血、误食、抽搐、昏迷、休克、难产等）优先匹配，直接输出就医指引。
- 其余按呕吐 / 腹泻 / 食欲 / 皮肤 / 呼吸道 / 保健等意图返回结构化建议。
- 所有回复均附「不能替代执业兽医诊断」的提示。

### V2（已接入，V1 为降级兜底）

`assistant` 云函数代理智谱 GLM 视觉模型（`glm-4.6v-flash` → `glm-4v-flash` 依次回退），前端不接触密钥；携带宠物档案，支持最多 3 张图片；返回结构化结论（分析/可能病症/护理/就医/禁止事项/追问）。调用失败时前端自动回退 V1 规则回复。环境变量 `ZHIPU_API_KEY` 需在云函数配置中设置。

## 开发约定

- 云函数统一返回 `{ ok: true, data }` 或 `{ ok: false, msg }`，前端经 `utils/cloud.js` 调用，业务层只处理 `data` 与错误提示。
- 需登录的操作统一走 `app.requireLogin()`，由它负责跳转登录页。
- 宠物数据上限 5 只，前端与云函数双重校验。
- 新增页面需同步更新 `app.json` 的 `pages`；新增 Tab 需同时补 `images/tabbar/` 图标。
- 环境 ID 只允许出现在 `miniprogram/config.js`，不要在业务代码中硬编码。

## 说明与限制

- 短信验证码为**演示实现**：无短信服务商，验证码由 `login` 云函数生成后直接回传前端弹窗展示；生产环境请接入真实短信并**移除回传字段**。
- 健康提醒当前为**应用内提醒**（健康计划页红字提示）；微信订阅消息推送需在小程序后台申请模板，并将模板 ID 写入配置后接入。
- 举报与管理员为**极简版**：下架即删除帖子；举报记录存于 `square_reports` 集合，由管理员在后台处理。
- 大模型已接入（见「AI 实现说明」），但**内容安全校验（msgSecCheck）未接入**，上线前需完成内容安全评估。
- 微信手机号一键登录（`getPhoneNumber`）需小程序具备相应资质；个人主体可先用验证码登录。
- 所有健康建议仅供参考，紧急情况请立即前往宠物医院。

## 路线图

| 阶段 | 状态 |
|---|---|
| M1 需求文档与 README | ✅ 已完成 |
| M2 三 Tab 信息架构 | ⏳ 待开始 |
| M3 AI 意图路由与结构化追问 | ⏳ 待开始 |
| M4 健康计划与提醒 | 🔶 应用内提醒已完成，订阅消息待模板 |
| M5 大模型接入与降级 | ✅ assistant 云函数已接入智谱 GLM，超时/失败回退本地规则 |

## License

[MIT](./LICENSE)
