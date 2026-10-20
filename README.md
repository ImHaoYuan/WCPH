# AI宠物问诊（微信小程序）

基于微信云开发的「AI宠物问诊」小程序，提供 AI 问诊、宠物档案管理、问诊记录、手机号登录等功能。

## 功能概览

- **AI问诊（Tab）**：顶部宠物横向管理（最多 5 只）、介绍卡片区、底部悬浮「马上问诊」，进入对话页。
- **我的（Tab）**：用户信息、我的宠物、问诊记录、退出登录。
- **添加/编辑宠物**：头像（相册上传或卡通头像）、名字、分类-品种联动、性别、出生日期、体重、绝育/驱虫状态，含表单防呆校验。
- **登录**：微信手机号一键登录 + 手机号验证码登录（60s 倒计时、记住手机号）。
- **AI问诊对话页**：模拟 AI 初步健康评估（关键词规则），自动保存问诊记录到云端。

## 目录结构

```
miniprogram/
  app.js / app.json / app.wxss   # 全局逻辑、页面与 tabBar 配置、全局样式
  config.js                       # 云开发环境 ID
  images/tabbar/                  # tabBar 图标
  utils/
    cloud.js                      # 云函数调用封装
    petDict.js                    # 宠物分类-品种字典
    util.js                       # 日期/校验/模拟AI回复
  pages/
    consult/      AI问诊首页
    mine/         我的
    login/        登录
    addPet/       添加/编辑宠物
    chat/         AI问诊对话
    recordDetail/ 问诊记录详情
cloudfunctions/
  login/          登录与验证码
  pet/            宠物 CRUD
  record/         问诊记录 CRUD
```

## 运行与部署（重要）

本项目数据存储使用**微信云开发**，运行前必须完成以下配置，否则页面会提示「云函数调用失败」。

1. 用[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)打开本目录。
2. 开通云开发，创建/选择一个云环境，将其**环境 ID** 填入 `miniprogram/config.js` 的 `envId`（当前为 `release-b86096`）。
3. 右键 `cloudfunctions/login`、`cloudfunctions/pet`、`cloudfunctions/record`，分别执行**「上传并部署：云端安装依赖」**。
4. 云数据库集合 `users` / `pets` / `records` / `sms_codes` 会在云函数首次调用时自动创建，无需手动建表。
5. 编译运行即可。

## 说明

- 短信验证码为**演示实现**：无短信服务商，验证码由 `login` 云函数生成后直接弹窗提示，生产环境请接入真实短信并移除回传字段。
- AI 回复为**本地关键词模拟**（`utils/util.js` 的 `aiReply`），生产环境请替换为后端大模型接口。
- 微信手机号一键登录（`getPhoneNumber`）需小程序具备相应资质，个人主体可先用验证码登录。
