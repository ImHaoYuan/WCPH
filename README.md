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

### 规划中（详见 spec.md）

| 阶段 | 内容 |
|---|---|
| M2 | 三 Tab 结构调整：AI 助手 / 记录 / 我的 |
| M3 | AI 意图路由（8 类）+ 结构化追问 |
| M4 | 健康计划与提醒（订阅消息） |
| M5 | 云函数代理大模型，超时降级到本地规则 |

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
    mine/         我的
    login/        登录
    addPet/       添加/编辑宠物
    chat/         AI 对话
    recordDetail/ 问诊记录详情
cloudfunctions/
  login/          登录与验证码
  pet/            宠物 CRUD（服务端强制 5 只上限）
  record/         问诊记录 CRUD
spec.md           产品需求文档
```

## 数据模型

| 集合 | 用途 | 关键字段 |
|---|---|---|
| `users` | 用户 | `_openid`、`phone`、`nickname`、`avatarUrl` |
| `pets` | 宠物档案 | `_openid`、`name`、`avatar`、`category`、`breed`、`birthDate`、`weight`、`neutered`、`dewormed` |
| `records` | 对话记录 | `_openid`、`petId`、`petName`、`title`、`messages[]`、`createdAt` |
| `sms_codes` | 验证码（演示） | `_openid`、`phone`、`code`、`expireAt` |

所有集合以 `_openid` 隔离用户数据；集合由云函数首次调用时自动创建。

## 运行与部署（重要）

本项目依赖微信云开发，未完成以下配置时页面会提示「云函数调用失败」。

1. 用[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)打开本目录。
2. 确认云开发环境：本项目的环境 ID 为 **`ai-d5gc65qrdab971a09`**，已写入 `miniprogram/config.js` 的 `envId`。若你的账号下环境不同，请替换为控制台中实际的环境 ID。
3. 右键 `cloudfunctions/login`、`cloudfunctions/pet`、`cloudfunctions/record`，分别执行 **「上传并部署：云端安装依赖」**。
4. 集合 `users` / `pets` / `records` / `sms_codes` 会在云函数首次调用时自动创建，无需手动建表。
5. 编译运行。

> 当前云环境 `ai-d5gc65qrdab971a09` 下 `login`、`pet`、`record` 三个云函数均已部署。

## AI 实现说明

### V1（当前）

`utils/util.js` 的 `aiReply` 为**本地关键词规则**：

- 急症词（呼吸困难、大出血、误食、抽搐、昏迷、休克、难产等）优先匹配，直接输出就医指引。
- 其余按呕吐 / 腹泻 / 食欲 / 皮肤 / 呼吸道 / 保健等意图返回结构化建议。
- 所有回复均附「不能替代执业兽医诊断」的提示。

### V2（规划）

新增 `assistant` 云函数代理大模型，前端不接触密钥；携带宠物档案与最近 10 轮对话，8 秒超时自动回退 V1 规则回复；调用前接 `msgSecCheck` 做内容安全校验。

## 开发约定

- 云函数统一返回 `{ ok: true, data }` 或 `{ ok: false, msg }`，前端经 `utils/cloud.js` 调用，业务层只处理 `data` 与错误提示。
- 需登录的操作统一走 `app.requireLogin()`，由它负责跳转登录页。
- 宠物数据上限 5 只，前端与云函数双重校验。
- 新增页面需同步更新 `app.json` 的 `pages`；新增 Tab 需同时补 `images/tabbar/` 图标。
- 环境 ID 只允许出现在 `miniprogram/config.js`，不要在业务代码中硬编码。

## 说明与限制

- 短信验证码为**演示实现**：无短信服务商，验证码由 `login` 云函数生成后直接回传前端弹窗展示；生产环境请接入真实短信并**移除回传字段**。
- AI 回复为**本地规则模拟**，不是真实大模型；上线前需完成 V2 接入与内容安全评估。
- 微信手机号一键登录（`getPhoneNumber`）需小程序具备相应资质；个人主体可先用验证码登录。
- 所有健康建议仅供参考，紧急情况请立即前往宠物医院。

## 路线图

| 阶段 | 状态 |
|---|---|
| M1 需求文档与 README | ✅ 已完成 |
| M2 三 Tab 信息架构 | ⏳ 待开始 |
| M3 AI 意图路由与结构化追问 | ⏳ 待开始 |
| M4 健康计划与提醒 | ⏳ 待开始 |
| M5 大模型接入与降级 | ⏳ 待开始 |

## License

[MIT](./LICENSE)
