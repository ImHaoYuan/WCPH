"""
校园委托系统 —— 数据字典生成器
输出: 02_数据字典.xlsx  (每个表一个工作表 + 关系总览)
"""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

OUT = r"C:\Users\林炯汉\Documents\deepseek-harness\default-workspace\campus-commission\02_数据字典.xlsx"

# ---------------------------------------------------------------- 元数据
# (字段名, 中文名, 数据类型, 长度/精度, 约束, 业务含义)
TABLES = {}

TABLES["user 用户表"] = dict(
    comment="校园委托的参与者，同一账号既可发布委托也可接单",
    cols=[
        ("user_id", "用户ID", "BIGINT", "-", "PK, AUTO_INCREMENT, NOT NULL", "唯一标识一个用户"),
        ("username", "登录名", "VARCHAR", "50", "NOT NULL, UNIQUE", "登录系统使用的账号，不可重复"),
        ("password_hash", "密码哈希", "CHAR", "60", "NOT NULL", "bcrypt 加密后的密码，禁止存明文"),
        ("real_name", "真实姓名", "VARCHAR", "50", "NULL", "实名认证时填写的姓名"),
        ("student_no", "学号", "VARCHAR", "20", "UNIQUE, NULL", "校内唯一学号，用于校园身份核验"),
        ("phone", "手机号", "VARCHAR", "20", "UNIQUE, NULL", "联系方式，亦可用于登录"),
        ("email", "邮箱", "VARCHAR", "100", "NULL", "找回密码与通知邮箱"),
        ("avatar_url", "头像地址", "VARCHAR", "255", "NULL", "用户头像图片存储路径"),
        ("verify_status", "认证状态", "TINYINT", "-", "NOT NULL, DEFAULT 0", "0未认证 1审核中 2已认证 3已驳回；仅认证用户可接单"),
        ("credit_score", "信用分", "INT", "-", "NOT NULL, DEFAULT 100", "初始100，爽约/差评扣分，影响接单权限"),
        ("status", "账号状态", "TINYINT", "-", "NOT NULL, DEFAULT 1", "0禁用 1正常，管理员可封禁违规账号"),
        ("created_at", "注册时间", "DATETIME", "-", "NOT NULL, DEFAULT NOW", "账号创建时间"),
        ("updated_at", "更新时间", "DATETIME", "-", "NOT NULL, ON UPDATE NOW", "最后修改时间，自动维护"),
    ])

TABLES["category 委托分类表"] = dict(
    comment="对委托进行归类，便于检索与筛选",
    cols=[
        ("category_id", "分类ID", "BIGINT", "-", "PK, AUTO_INCREMENT, NOT NULL", "唯一标识一个分类"),
        ("name", "分类名称", "VARCHAR", "50", "NOT NULL, UNIQUE", "如代取快递、学习辅导、跑腿代办"),
        ("description", "分类说明", "VARCHAR", "255", "NULL", "该分类的适用范围说明"),
        ("sort_no", "排序号", "INT", "-", "NOT NULL, DEFAULT 0", "前端展示顺序，值越小越靠前"),
        ("enabled", "是否启用", "TINYINT", "-", "NOT NULL, DEFAULT 1", "0停用 1启用；停用后不再允许发布到该分类"),
    ])

TABLES["task 委托任务表"] = dict(
    comment="系统核心实体，一条记录即一个待完成的委托",
    cols=[
        ("task_id", "委托ID", "BIGINT", "-", "PK, AUTO_INCREMENT, NOT NULL", "唯一标识一个委托"),
        ("publisher_id", "发布者ID", "BIGINT", "-", "FK->user.user_id, NOT NULL", "发布该委托的用户"),
        ("category_id", "分类ID", "BIGINT", "-", "FK->category.category_id, NOT NULL", "委托所属分类"),
        ("title", "委托标题", "VARCHAR", "100", "NOT NULL", "简短描述委托内容"),
        ("description", "详细描述", "TEXT", "-", "NULL", "委托的具体要求、注意事项"),
        ("reward", "悬赏金额", "DECIMAL", "(10,2)", "NOT NULL, DEFAULT 0.00", "完成委托后支付给接单方的报酬(元)"),
        ("deadline", "期望完成时间", "DATETIME", "-", "NOT NULL", "超过该时间未完成视为逾期"),
        ("place", "地点", "VARCHAR", "100", "NULL", "委托涉及的地点，如某宿舍楼"),
        ("urgency", "紧急程度", "TINYINT", "-", "NOT NULL, DEFAULT 0", "0普通 1加急 2非常紧急"),
        ("status", "委托状态", "TINYINT", "-", "NOT NULL, DEFAULT 0", "0待接单 1进行中 2已完成 3已取消 4已关闭"),
        ("view_count", "浏览量", "INT", "-", "NOT NULL, DEFAULT 0", "被查看次数，用于热度排序"),
        ("created_at", "发布时间", "DATETIME", "-", "NOT NULL, DEFAULT NOW", "委托创建时间"),
        ("updated_at", "更新时间", "DATETIME", "-", "NOT NULL, ON UPDATE NOW", "状态变更等修改时间"),
    ])

TABLES["application 接单申请表"] = dict(
    comment="用户对委托的接单意向；一个委托可收到多条申请",
    cols=[
        ("application_id", "申请ID", "BIGINT", "-", "PK, AUTO_INCREMENT, NOT NULL", "唯一标识一条申请"),
        ("task_id", "委托ID", "BIGINT", "-", "FK->task.task_id, NOT NULL", "申请接单的目标委托"),
        ("applicant_id", "申请人ID", "BIGINT", "-", "FK->user.user_id, NOT NULL", "提交申请的用户"),
        ("message", "申请留言", "VARCHAR", "255", "NULL", "接单说明，供委托方择优选择"),
        ("status", "申请状态", "TINYINT", "-", "NOT NULL, DEFAULT 0", "0待处理 1已接受 2已拒绝 3已撤回"),
        ("applied_at", "申请时间", "DATETIME", "-", "NOT NULL, DEFAULT NOW", "提交申请的时间"),
        ("handled_at", "处理时间", "DATETIME", "-", "NULL", "委托方接受或拒绝的时间"),
    ])

TABLES["orders 订单表"] = dict(
    comment="委托被接单后形成的成交订单，与 task 一一对应",
    cols=[
        ("order_id", "订单ID", "BIGINT", "-", "PK, AUTO_INCREMENT, NOT NULL", "唯一标识一个订单"),
        ("order_no", "订单编号", "VARCHAR", "32", "NOT NULL, UNIQUE", "对外展示的业务单号，便于客服追踪"),
        ("task_id", "委托ID", "BIGINT", "-", "FK->task.task_id, NOT NULL, UNIQUE", "一单对应一委托，保证 1:1"),
        ("publisher_id", "委托方ID", "BIGINT", "-", "FK->user.user_id, NOT NULL", "发起委托并付款的一方"),
        ("taker_id", "接单方ID", "BIGINT", "-", "FK->user.user_id, NOT NULL", "实际执行委托的一方"),
        ("amount", "成交金额", "DECIMAL", "(10,2)", "NOT NULL", "实际托管并结算的金额(元)"),
        ("status", "订单状态", "TINYINT", "-", "NOT NULL, DEFAULT 0", "0进行中 1待确认 2已完成 3已取消 4已退款"),
        ("accepted_at", "接单时间", "DATETIME", "-", "NOT NULL, DEFAULT NOW", "委托方确认接单方的时间"),
        ("finished_at", "完成时间", "DATETIME", "-", "NULL", "委托方确认完成、资金解冻的时间"),
        ("cancel_reason", "取消原因", "VARCHAR", "255", "NULL", "订单取消时填写的原因"),
    ])

TABLES["review 评价表"] = dict(
    comment="订单完成后的互评记录，与 orders 一一对应",
    cols=[
        ("review_id", "评价ID", "BIGINT", "-", "PK, AUTO_INCREMENT, NOT NULL", "唯一标识一条评价"),
        ("order_id", "订单ID", "BIGINT", "-", "FK->orders.order_id, NOT NULL, UNIQUE", "被评价的订单，一单一评"),
        ("reviewer_id", "评价人ID", "BIGINT", "-", "FK->user.user_id, NOT NULL", "给出评价的一方"),
        ("reviewee_id", "被评价人ID", "BIGINT", "-", "FK->user.user_id, NOT NULL", "收到评价的一方，其信用分随之调整"),
        ("score", "评分", "TINYINT", "-", "NOT NULL, CHECK 1~5", "1~5 星，星数越低对信用分影响越大"),
        ("content", "评价内容", "VARCHAR", "500", "NULL", "文字评价，公开展示"),
        ("created_at", "评价时间", "DATETIME", "-", "NOT NULL, DEFAULT NOW", "提交评价的时间"),
    ])

TABLES["wallet 钱包表"] = dict(
    comment="用户资金账户，与 user 一一对应",
    cols=[
        ("wallet_id", "钱包ID", "BIGINT", "-", "PK, AUTO_INCREMENT, NOT NULL", "唯一标识一个钱包"),
        ("user_id", "用户ID", "BIGINT", "-", "FK->user.user_id, NOT NULL, UNIQUE", "钱包归属用户，保证 1:1"),
        ("balance", "可用余额", "DECIMAL", "(12,2)", "NOT NULL, DEFAULT 0.00, CHECK>=0", "可提现、可支付的金额(元)"),
        ("frozen", "冻结金额", "DECIMAL", "(12,2)", "NOT NULL, DEFAULT 0.00, CHECK>=0", "已接单未完成期间托管的资金(元)"),
        ("updated_at", "更新时间", "DATETIME", "-", "NOT NULL, ON UPDATE NOW", "余额变动时间"),
    ])

TABLES["transaction 资金流水表"] = dict(
    comment="钱包的每一次资金变动都留痕，用于对账与纠纷举证",
    cols=[
        ("txn_id", "流水ID", "BIGINT", "-", "PK, AUTO_INCREMENT, NOT NULL", "唯一标识一条流水"),
        ("wallet_id", "钱包ID", "BIGINT", "-", "FK->wallet.wallet_id, NOT NULL", "发生变动的钱包"),
        ("order_id", "订单ID", "BIGINT", "-", "FK->orders.order_id, NULL", "关联订单；充值/提现时为空"),
        ("type", "流水类型", "TINYINT", "-", "NOT NULL", "1充值 2提现 3支付托管 4解冻退回 5接单收入 6平台服务费"),
        ("amount", "变动金额", "DECIMAL", "(12,2)", "NOT NULL", "正数为入账、负数为出账(元)"),
        ("balance_after", "变动后余额", "DECIMAL", "(12,2)", "NOT NULL", "冗余记录，便于快速对账"),
        ("remark", "备注", "VARCHAR", "255", "NULL", "补充说明"),
        ("created_at", "发生时间", "DATETIME", "-", "NOT NULL, DEFAULT NOW", "资金变动的时间点"),
    ])

TABLES["message 站内消息表"] = dict(
    comment="订单双方的沟通记录，作为纠纷处理依据",
    cols=[
        ("message_id", "消息ID", "BIGINT", "-", "PK, AUTO_INCREMENT, NOT NULL", "唯一标识一条消息"),
        ("order_id", "订单ID", "BIGINT", "-", "FK->orders.order_id, NOT NULL", "消息所属订单"),
        ("sender_id", "发送者ID", "BIGINT", "-", "FK->user.user_id, NOT NULL", "发出消息的用户"),
        ("receiver_id", "接收者ID", "BIGINT", "-", "FK->user.user_id, NOT NULL", "接收消息的用户"),
        ("content", "消息内容", "VARCHAR", "500", "NOT NULL", "消息正文"),
        ("is_read", "是否已读", "TINYINT", "-", "NOT NULL, DEFAULT 0", "0未读 1已读，用于未读红点提示"),
        ("sent_at", "发送时间", "DATETIME", "-", "NOT NULL, DEFAULT NOW", "消息发送时间"),
    ])

RELATIONS = [
    ("User", "Wallet", "1 : 1", "一个用户拥有唯一钱包；一个钱包只属于一个用户", "wallet.user_id 唯一约束实现"),
    ("User", "Task", "1 : N", "一个用户可发布多个委托；一个委托只由一个用户发布", "task.publisher_id 外键"),
    ("Category", "Task", "1 : N", "一个分类下可有多个委托；一个委托只属于一个分类", "task.category_id 外键"),
    ("User", "Application", "1 : N", "一个用户可提交多条接单申请", "application.applicant_id 外键"),
    ("Task", "Application", "1 : N", "一个委托可收到多条接单申请", "application.task_id 外键"),
    ("Task", "Order", "1 : 1", "一个委托成交后只生成一个订单；一个订单只对应一个委托", "orders.task_id 唯一约束实现"),
    ("Order", "Review", "1 : 1", "一个订单只产生一条评价", "review.order_id 唯一约束实现"),
    ("User", "Review", "1 : N", "一个用户可作为评价人/被评价人参与多条评价", "review.reviewer_id / reviewee_id 外键"),
    ("Wallet", "Transaction", "1 : N", "一个钱包有多条资金流水", "transaction.wallet_id 外键"),
    ("Order", "Transaction", "1 : N", "一个订单可关联多条流水(托管、结算、退款)", "transaction.order_id 外键"),
    ("Order", "Message", "1 : N", "一个订单内可有多条沟通消息", "message.order_id 外键"),
]

# ---------------------------------------------------------------- 样式
HDR_FILL = PatternFill("solid", fgColor="2F5597")
HDR_FONT = Font(bold=True, color="FFFFFF", size=11)
TITLE_FONT = Font(bold=True, size=12, color="1F3864")
WRAP = Alignment(vertical="center", wrap_text=True)
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
THIN = Side(style="thin", color="B4C6E7")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

wb = Workbook()
wb.remove(wb.active)

# ------------------------------------------------- 关系总览（第一页）
ws = wb.create_sheet("关系总览")
ws["A1"] = "校园委托系统 —— 实体关系总览"
ws["A1"].font = Font(bold=True, size=14, color="1F3864")
ws.merge_cells("A1:E1")

hdrs = ["主实体", "关联实体", "关联类型", "业务含义", "模型实现方式"]
for c, h in enumerate(hdrs, 1):
    cell = ws.cell(row=3, column=c, value=h)
    cell.fill, cell.font, cell.alignment, cell.border = HDR_FILL, HDR_FONT, CENTER, BORDER

for r, rel in enumerate(RELATIONS, 4):
    for c, v in enumerate(rel, 1):
        cell = ws.cell(row=r, column=c, value=v)
        cell.alignment = CENTER if c == 3 else WRAP
        cell.border = BORDER

for col, w in zip("ABCDE", (14, 14, 12, 56, 44)):
    ws.column_dimensions[col].width = w

# ------------------------------------------------- 每表一个工作表
for sheet_name, meta in TABLES.items():
    short = sheet_name.split()[0]
    ws = wb.create_sheet(short)

    ws["A1"] = f"数据字典 —— {sheet_name}"
    ws["A1"].font = Font(bold=True, size=13, color="1F3864")
    ws.merge_cells("A1:F1")
    ws["A2"] = f"表说明：{meta['comment']}"
    ws["A2"].font = Font(italic=True, size=10, color="404040")
    ws.merge_cells("A2:F2")

    hdrs = ["字段名", "中文名", "数据类型", "长度/精度", "约束条件", "业务含义说明"]
    for c, h in enumerate(hdrs, 1):
        cell = ws.cell(row=4, column=c, value=h)
        cell.fill, cell.font, cell.alignment, cell.border = HDR_FILL, HDR_FONT, CENTER, BORDER

    for r, row in enumerate(meta["cols"], 5):
        for c, v in enumerate(row, 1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.border = BORDER
            cell.alignment = CENTER if c in (3, 4) else WRAP
            if c == 1:
                cell.font = Font(name="Consolas", size=10)
        if "PK" in row[4]:
            for c in range(1, 7):
                ws.cell(row=r, column=c).fill = PatternFill("solid", fgColor="FFF2CC")

    for col, w in zip("ABCDEF", (20, 14, 11, 11, 30, 46)):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = "A5"

wb.save(OUT)
print("OK ->", OUT)
print("工作表:", wb.sheetnames)
