# 校园委托系统 —— 图表源码（Mermaid）

> ⚠️ **本文件为旧版（Chen 记法），其中的 ER 图与数据流图源码已过期，请勿使用。**
> 现行源码请看 **`11_ER图源码.md`**（含 ER 图三种格式 + 4 张数据流图），
> 或直接双击 **`图表_Mermaid.html`** 在浏览器里查看与编辑。


> 用途：在支持 Mermaid 的编辑器（Typora、VS Code、Notion、语雀）或 https://mermaid.live 中粘贴，
> 即可得到可编辑的 E-R 图与数据流图；也可照此在 PowerDesigner / Axure RP9 中重绘。

---

## 图1  E-R 图（实体关系，带基数）

```mermaid
erDiagram
    USER ||--|| WALLET : "拥有 1:1"
    USER ||--o{ TASK : "发布 1:N"
    CATEGORY ||--o{ TASK : "属于 1:N"
    USER ||--o{ APPLICATION : "提交 1:N"
    TASK ||--o{ APPLICATION : "收到 1:N"
    TASK ||--|| ORDERS : "成交 1:1"
    ORDERS ||--|| REVIEW : "产生 1:1"
    USER ||--o{ REVIEW : "评价 1:N"
    WALLET ||--o{ TRANSACTION : "产生 1:N"
    ORDERS ||--o{ TRANSACTION : "关联 1:N"
    ORDERS ||--o{ MESSAGE : "沟通 1:N"

    USER {
        bigint user_id PK
        varchar username UK
        char password_hash
        varchar student_no UK
        varchar phone UK
        varchar real_name
        tinyint verify_status
        int credit_score
        tinyint status
        datetime created_at
    }
    CATEGORY {
        bigint category_id PK
        varchar name UK
        varchar description
        int sort_no
        tinyint enabled
    }
    TASK {
        bigint task_id PK
        bigint publisher_id FK
        bigint category_id FK
        varchar title
        text description
        decimal reward
        datetime deadline
        varchar place
        tinyint urgency
        tinyint status
        int view_count
        datetime created_at
    }
    APPLICATION {
        bigint application_id PK
        bigint task_id FK
        bigint applicant_id FK
        varchar message
        tinyint status
        datetime applied_at
        datetime handled_at
    }
    ORDERS {
        bigint order_id PK
        varchar order_no UK
        bigint task_id FK "UK 实现 1:1"
        bigint publisher_id FK
        bigint taker_id FK
        decimal amount
        tinyint status
        datetime accepted_at
        datetime finished_at
        varchar cancel_reason
    }
    REVIEW {
        bigint review_id PK
        bigint order_id FK "UK 实现 1:1"
        bigint reviewer_id FK
        bigint reviewee_id FK
        tinyint score
        varchar content
        datetime created_at
    }
    WALLET {
        bigint wallet_id PK
        bigint user_id FK "UK 实现 1:1"
        decimal balance
        decimal frozen
        datetime updated_at
    }
    TRANSACTION {
        bigint txn_id PK
        bigint wallet_id FK
        bigint order_id FK
        tinyint type
        decimal amount
        decimal balance_after
        varchar remark
        datetime created_at
    }
    MESSAGE {
        bigint message_id PK
        bigint order_id FK
        bigint sender_id FK
        bigint receiver_id FK
        varchar content
        tinyint is_read
        datetime sent_at
    }
```

---

## 图2  DFD-0 顶层图（上下文图）

```mermaid
flowchart LR
    U["外部实体<br/>用户（学生 / 委托方 / 接单方）"]
    P(("加工 0<br/>校园委托管理系统"))
    PAY["外部实体<br/>支付平台"]
    ADM["外部实体<br/>管理员"]

    U -->|"委托信息 / 接单申请"| P
    P -->|"委托列表 / 订单结果"| U
    PAY -->|"支付结果回调"| P
    P -->|"支付 / 提现请求"| PAY
    ADM -->|"审核 / 封禁指令"| P
    P -->|"统计数据 / 违规记录"| ADM
```

---

## 图3  DFD-1 第 1 层：发布委托

```mermaid
flowchart LR
    U(["外部实体<br/>用户（委托方）"])
    P1(("1.1<br/>校验身份与<br/>委托内容"))
    P2(("1.2<br/>保存委托<br/>并计悬赏"))
    P3(("1.3<br/>生成待接单<br/>列表"))
    D1[("D1 user<br/>用户表")]
    D2[("D2 category<br/>委托分类表")]
    D3[("D3 task<br/>委托任务表")]
    R(["外部实体<br/>接单方"])

    U -->|"委托内容 / 悬赏金额"| P1
    P1 -->|"查询账号与信用分"| D1
    D1 -->|"身份校验结果"| P1
    P1 -->|"校验通过的委托"| P2
    P2 -->|"写入委托记录"| D3
    D3 -->|"task_id 回填"| P2
    P2 -->|"读取分类信息"| D2
    D2 -->|"分类信息"| P2
    P2 -->|"已保存的委托"| P3
    P3 -->|"按分类归集"| D3
    P3 -->|"待接单委托列表"| R
```

---

## 图4  DFD-1 第 1 层：申请接单与订单成交

```mermaid
flowchart LR
    T(["外部实体<br/>用户（接单方）"])
    P(["外部实体<br/>用户（委托方）"])
    P1(("2.1<br/>受理接单<br/>申请"))
    P2(("2.2<br/>委托方<br/>确认接单"))
    P3(("2.3<br/>生成订单<br/>并托管资金"))
    D3[("D3 task<br/>委托任务表")]
    D4[("D4 application<br/>接单申请表")]
    D5[("D5 orders<br/>订单表")]
    D7[("D7 wallet<br/>钱包表")]
    D8[("D8 transaction<br/>资金流水表")]
    PAY["外部实体<br/>支付平台"]

    T -->|"接单申请 / 留言"| P1
    P1 -->|"写入申请记录"| D4
    D4 -->|"是否重复申请"| P1
    P -->|"接受 / 拒绝指令"| P2
    P2 -->|"更新委托状态=进行中"| D3
    D3 -->|"读取委托与悬赏"| P2
    P2 -->|"确认接单结果"| P3
    P3 -->|"生成订单记录"| D5
    P3 -->|"扣减余额 / 计入冻结"| D7
    P3 -->|"写入托管流水"| D8
    PAY -->|"冻结成功"| P3
    P3 -->|"请求冻结资金"| PAY
```

---

## 附：状态码字典（供数据字典与前端约定共用）

| 字段 | 取值 | 含义 |
|---|---|---|
| user.verify_status | 0 / 1 / 2 / 3 | 未认证 / 审核中 / 已认证 / 已驳回 |
| user.status | 0 / 1 | 禁用 / 正常 |
| task.urgency | 0 / 1 / 2 | 普通 / 加急 / 非常紧急 |
| task.status | 0 / 1 / 2 / 3 / 4 | 待接单 / 进行中 / 已完成 / 已取消 / 已关闭 |
| application.status | 0 / 1 / 2 / 3 | 待处理 / 已接受 / 已拒绝 / 已撤回 |
| orders.status | 0 / 1 / 2 / 3 / 4 | 进行中 / 待确认 / 已完成 / 已取消 / 已退款 |
| transaction.type | 1~6 | 充值 / 提现 / 支付托管 / 解冻退回 / 接单收入 / 平台服务费 |
| message.is_read | 0 / 1 | 未读 / 已读 |
