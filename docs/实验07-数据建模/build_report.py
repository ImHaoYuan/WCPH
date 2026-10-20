"""
校园委托系统 —— 实验07 数据建模 实验报告生成器
输出: 09_实验07_数据建模_实验报告.docx
"""
import os
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

_DIR = os.path.dirname(os.path.abspath(__file__))
OUT = _DIR
DOCX = os.path.join(OUT, "09_实验07_数据建模_实验报告.docx")

# ============================================================ 数据
TABLES = {
 "user 用户表": dict(comment="校园委托的参与者，同一账号既可发布委托也可接单",
  cols=[("user_id","用户ID","BIGINT","—","PK, 自增, 非空","唯一标识一个用户"),
        ("username","登录名","VARCHAR","50","非空, 唯一","登录系统使用的账号，不可重复"),
        ("password_hash","密码哈希","CHAR","60","非空","bcrypt 加密后密文，禁止存明文"),
        ("real_name","真实姓名","VARCHAR","50","可空","实名认证时填写的姓名"),
        ("student_no","学号","VARCHAR","20","唯一, 可空","校内唯一学号，用于身份核验"),
        ("phone","手机号","VARCHAR","20","唯一, 可空","联系方式，亦可用于登录"),
        ("email","邮箱","VARCHAR","100","可空","找回密码与通知邮箱"),
        ("avatar_url","头像地址","VARCHAR","255","可空","头像图片存储路径"),
        ("verify_status","认证状态","TINYINT","—","非空, 默认0","0未认证 1审核中 2已认证 3已驳回；仅认证用户可接单"),
        ("credit_score","信用分","INT","—","非空, 默认100","初始100，爽约/差评扣分，影响接单权限"),
        ("status","账号状态","TINYINT","—","非空, 默认1","0禁用 1正常，管理员可封禁违规账号"),
        ("created_at","注册时间","DATETIME","—","非空, 默认当前","账号创建时间"),
        ("updated_at","更新时间","DATETIME","—","非空, 自动更新","最后修改时间，系统自动维护")]),
 "category 委托分类表": dict(comment="对委托进行归类，便于检索与筛选",
  cols=[("category_id","分类ID","BIGINT","—","PK, 自增, 非空","唯一标识一个分类"),
        ("name","分类名称","VARCHAR","50","非空, 唯一","如代取快递、学习辅导、跑腿代办"),
        ("description","分类说明","VARCHAR","255","可空","该分类的适用范围说明"),
        ("sort_no","排序号","INT","—","非空, 默认0","前端展示顺序，值越小越靠前"),
        ("enabled","是否启用","TINYINT","—","非空, 默认1","0停用 1启用；停用后不允许发布到该分类")]),
 "task 委托任务表": dict(comment="系统核心实体，一条记录即一个待完成的委托",
  cols=[("task_id","委托ID","BIGINT","—","PK, 自增, 非空","唯一标识一个委托"),
        ("publisher_id","发布者ID","BIGINT","—","FK→user, 非空","发布该委托的用户"),
        ("category_id","分类ID","BIGINT","—","FK→category, 非空","委托所属分类"),
        ("title","委托标题","VARCHAR","100","非空","简短描述委托内容"),
        ("description","详细描述","TEXT","—","可空","委托的具体要求与注意事项"),
        ("reward","悬赏金额","DECIMAL","(10,2)","非空, 默认0.00","完成后支付给接单方的报酬（元）"),
        ("deadline","期望完成时间","DATETIME","—","非空","超过该时间未完成视为逾期"),
        ("place","地点","VARCHAR","100","可空","委托涉及的地点，如某宿舍楼"),
        ("urgency","紧急程度","TINYINT","—","非空, 默认0","0普通 1加急 2非常紧急"),
        ("status","委托状态","TINYINT","—","非空, 默认0","0待接单 1进行中 2已完成 3已取消 4已关闭"),
        ("view_count","浏览量","INT","—","非空, 默认0","被查看次数，用于热度排序"),
        ("created_at","发布时间","DATETIME","—","非空, 默认当前","委托创建时间"),
        ("updated_at","更新时间","DATETIME","—","非空, 自动更新","状态变更等修改时间")]),
 "application 接单申请表": dict(comment="用户对委托的接单意向；一个委托可收到多条申请",
  cols=[("application_id","申请ID","BIGINT","—","PK, 自增, 非空","唯一标识一条申请"),
        ("task_id","委托ID","BIGINT","—","FK→task, 非空","申请接单的目标委托"),
        ("applicant_id","申请人ID","BIGINT","—","FK→user, 非空","提交申请的用户"),
        ("message","申请留言","VARCHAR","255","可空","接单说明，供委托方择优选择"),
        ("status","申请状态","TINYINT","—","非空, 默认0","0待处理 1已接受 2已拒绝 3已撤回"),
        ("applied_at","申请时间","DATETIME","—","非空, 默认当前","提交申请的时间"),
        ("handled_at","处理时间","DATETIME","—","可空","委托方接受或拒绝的时间")]),
 "orders 订单表": dict(comment="委托被接单后形成的成交订单，与 task 一一对应",
  cols=[("order_id","订单ID","BIGINT","—","PK, 自增, 非空","唯一标识一个订单"),
        ("order_no","订单编号","VARCHAR","32","非空, 唯一","对外展示的业务单号，便于追踪"),
        ("task_id","委托ID","BIGINT","—","FK→task, 非空, 唯一","一单对应一委托，实现 1:1"),
        ("publisher_id","委托方ID","BIGINT","—","FK→user, 非空","发起委托并付款的一方"),
        ("taker_id","接单方ID","BIGINT","—","FK→user, 非空","实际执行委托的一方"),
        ("amount","成交金额","DECIMAL","(10,2)","非空","实际托管并结算的金额（元）"),
        ("status","订单状态","TINYINT","—","非空, 默认0","0进行中 1待确认 2已完成 3已取消 4已退款"),
        ("accepted_at","接单时间","DATETIME","—","非空, 默认当前","委托方确认接单方的时间"),
        ("finished_at","完成时间","DATETIME","—","可空","确认完成、资金解冻的时间"),
        ("cancel_reason","取消原因","VARCHAR","255","可空","订单取消时填写的原因")]),
 "review 评价表": dict(comment="订单完成后的互评记录，与 orders 一一对应",
  cols=[("review_id","评价ID","BIGINT","—","PK, 自增, 非空","唯一标识一条评价"),
        ("order_id","订单ID","BIGINT","—","FK→orders, 非空, 唯一","被评价的订单，一单一评"),
        ("reviewer_id","评价人ID","BIGINT","—","FK→user, 非空","给出评价的一方"),
        ("reviewee_id","被评价人ID","BIGINT","—","FK→user, 非空","收到评价的一方，其信用分随之调整"),
        ("score","评分","TINYINT","—","非空, 取值1~5","星数越低对信用分影响越大"),
        ("content","评价内容","VARCHAR","500","可空","文字评价，公开展示"),
        ("created_at","评价时间","DATETIME","—","非空, 默认当前","提交评价的时间")]),
 "wallet 钱包表": dict(comment="用户资金账户，与 user 一一对应",
  cols=[("wallet_id","钱包ID","BIGINT","—","PK, 自增, 非空","唯一标识一个钱包"),
        ("user_id","用户ID","BIGINT","—","FK→user, 非空, 唯一","钱包归属用户，实现 1:1"),
        ("balance","可用余额","DECIMAL","(12,2)","非空, 默认0, ≥0","可提现、可支付的金额（元）"),
        ("frozen","冻结金额","DECIMAL","(12,2)","非空, 默认0, ≥0","已接单未完成期间托管的资金（元）"),
        ("updated_at","更新时间","DATETIME","—","非空, 自动更新","余额变动时间")]),
 "transaction 资金流水表": dict(comment="钱包每一次资金变动均留痕，用于对账与纠纷举证",
  cols=[("txn_id","流水ID","BIGINT","—","PK, 自增, 非空","唯一标识一条流水"),
        ("wallet_id","钱包ID","BIGINT","—","FK→wallet, 非空","发生变动的钱包"),
        ("order_id","订单ID","BIGINT","—","FK→orders, 可空","关联订单；充值/提现时为空"),
        ("type","流水类型","TINYINT","—","非空","1充值 2提现 3支付托管 4解冻退回 5接单收入 6平台服务费"),
        ("amount","变动金额","DECIMAL","(12,2)","非空","正数入账、负数出账（元）"),
        ("balance_after","变动后余额","DECIMAL","(12,2)","非空","冗余记录，便于快速对账"),
        ("remark","备注","VARCHAR","255","可空","补充说明"),
        ("created_at","发生时间","DATETIME","—","非空, 默认当前","资金变动的时间点")]),
 "message 站内消息表": dict(comment="订单双方的沟通记录，作为纠纷处理依据",
  cols=[("message_id","消息ID","BIGINT","—","PK, 自增, 非空","唯一标识一条消息"),
        ("order_id","订单ID","BIGINT","—","FK→orders, 非空","消息所属订单"),
        ("sender_id","发送者ID","BIGINT","—","FK→user, 非空","发出消息的用户"),
        ("receiver_id","接收者ID","BIGINT","—","FK→user, 非空","接收消息的用户"),
        ("content","消息内容","VARCHAR","500","非空","消息正文"),
        ("is_read","是否已读","TINYINT","—","非空, 默认0","0未读 1已读，用于未读红点提示"),
        ("sent_at","发送时间","DATETIME","—","非空, 默认当前","消息发送时间")]),
}

RELATIONS = [
 ("User 用户","Wallet 钱包","1 : 1","一个用户拥有唯一钱包；一个钱包只属于一个用户","wallet.user_id 建唯一约束"),
 ("User 用户","Task 委托任务","1 : N","一个用户可发布多个委托；一个委托只由一个用户发布","task.publisher_id 外键"),
 ("Category 委托分类","Task 委托任务","1 : N","一个分类下可有多个委托；一个委托只属于一个分类","task.category_id 外键"),
 ("User 用户","Application 接单申请","1 : N","一个用户可提交多条接单申请","application.applicant_id 外键"),
 ("Task 委托任务","Application 接单申请","1 : N","一个委托可收到多条接单申请","application.task_id 外键"),
 ("Task 委托任务","Orders 订单","1 : 1","委托成交后只生成一个订单；一个订单只对应一个委托","orders.task_id 建唯一约束"),
 ("Orders 订单","Review 评价","1 : 1","一个订单只产生一条评价记录","review.order_id 建唯一约束"),
 ("User 用户","Review 评价","1 : N","一个用户可作为评价人/被评价人参与多条评价","review.reviewer_id / reviewee_id 外键"),
 ("Wallet 钱包","Transaction 资金流水","1 : N","一个钱包有多条资金流水","transaction.wallet_id 外键"),
 ("Orders 订单","Transaction 资金流水","1 : N","一个订单可关联多条流水（托管、结算、退款）","transaction.order_id 外键"),
 ("Orders 订单","Message 站内消息","1 : N","一个订单内可有多条沟通消息","message.order_id 外键"),
 ("User 用户","Task 委托任务","M : N","同一用户可申请多个委托，同一委托可被多个用户申请","经 Application 联系实体拆为两个 1:N"),
]

DFDS = [
 ("图2  DFD-0 顶层图（上下文图）", "04_图2_DFD0顶层图.png",
  "界定系统边界。整个「校园委托管理系统」视为一个加工（0 号），与用户、支付平台、管理员三类外部实体交换数据。",
  ["用户 → 系统：委托信息、接单申请（含悬赏金额与截止时间）",
   "系统 → 用户：委托列表、订单结果",
   "系统 → 支付平台：支付 / 提现请求；支付平台 → 系统：支付结果回调",
   "系统 → 管理员：统计数据、违规记录；管理员 → 系统：审核 / 封禁指令"]),
 ("图3  DFD-1 第 1 层：发布委托", "05_图3_DFD1发布委托.png",
  "细化「发布委托」，拆为 3 个加工：1.1 校验身份与委托内容、1.2 保存委托并计悬赏、1.3 生成待接单列表。",
  ["用户（委托方）→ 1.1：委托内容、悬赏金额、截止时间",
   "1.1 ↔ D1 user 表：查询账号状态与信用分，返回身份校验结果",
   "1.1 → 1.2：校验通过的委托数据",
   "D2 category 表 → 1.2：读取分类信息",
   "1.2 → D3 task 表：写入委托记录并回填 task_id",
   "1.2 → 1.3：已保存的委托",
   "D3 task 表 → 1.3：按分类归集待接单委托",
   "1.3 → 接单方：待接单委托列表"]),
 ("图4  DFD-1 第 1 层：申请接单与订单成交", "06_图4_DFD2接单成交.png",
  "细化「接单成交」，拆为 3 个加工：2.1 受理接单申请、2.2 委托方确认接单、2.3 生成订单并托管资金。",
  ["接单方 → 2.1：接单申请、留言",
   "2.1 → D4 application 表：写入申请记录；D4 → 2.1：校验是否重复申请",
   "2.1 → 2.2：受理通过的申请",
   "D3 task 表 → 2.2：读取委托与悬赏",
   "2.2 → 2.3：接受指令，委托状态置为「进行中」",
   "委托方 → 2.3：确认完成 / 付款指令",
   "2.3 → D5 orders 表：生成订单记录",
   "2.3 ← 支付平台：请求冻结资金 / 冻结成功回调",
   "2.3 → D6 wallet 表：扣减余额、计入冻结金额"]),
 ("图7  DFD-1 第 1 层：结算、评价与消息", "12_图7_DFD3结算评价.png",
  "细化订单完成后的收尾业务，拆为 2 个加工：3.1 订单完成确认、3.2 资金解冻与结算。",
  ["委托方 → 3.1：完成确认",
   "3.1 ↔ D5 orders 表：更新订单状态为「已完成」，回写完成时间",
   "3.1 → 3.2：触发资金结算",
   "3.2 ↔ D6 wallet 表：解冻 frozen 并转入 balance",
   "3.2 → D7 transaction 表：写入结算流水",
   "3.2 ↔ 支付平台：提现 / 打款请求与打款结果回调",
   "3.1 → D9 review 评价表：生成可评价记录（双方各一条）",
   "评价结果回写 user.credit_score（D1）"]),
]

# ============================================================ 样式工具
def set_cjk(run, ascii_font="Times New Roman", cjk="宋体", size=10.5, bold=False, color=None):
    run.font.name = ascii_font
    run.font.size = Pt(size)
    run.font.bold = bold
    if color: run.font.color.rgb = color
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn('w:rFonts'))
    if rFonts is None:
        rFonts = OxmlElement('w:rFonts'); rPr.append(rFonts)
    rFonts.set(qn('w:eastAsia'), cjk)

def para(doc, text, size=10.5, bold=False, cjk="宋体", align=None, space_after=4, indent=None):
    p = doc.add_paragraph()
    if align is not None: p.alignment = align
    p.paragraph_format.space_after = Pt(space_after)
    if indent: p.paragraph_format.left_indent = Cm(indent)
    r = p.add_run(text)
    set_cjk(r, cjk=cjk, size=size, bold=bold)
    return p

def h1(doc, text):
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(14); p.paragraph_format.space_after = Pt(6)
    r = p.add_run(text); set_cjk(r, cjk="黑体", size=14, bold=True, color=RGBColor(0x1F,0x38,0x64))
    return p

def h2(doc, text):
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(10); p.paragraph_format.space_after = Pt(4)
    r = p.add_run(text); set_cjk(r, cjk="黑体", size=12, bold=True, color=RGBColor(0x2F,0x55,0x97))
    return p

def shade(cell, hexcolor):
    tcPr = cell._tc.get_or_add_tcPr()
    sh = OxmlElement('w:shd'); sh.set(qn('w:val'),'clear'); sh.set(qn('w:fill'),hexcolor)
    tcPr.append(sh)

def fill_cell(cell, text, size=9, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, cjk="宋体"):
    cell.text = ""
    p = cell.paragraphs[0]; p.alignment = align
    p.paragraph_format.space_after = Pt(0); p.paragraph_format.space_before = Pt(0)
    r = p.add_run(text); set_cjk(r, cjk=cjk, size=size, bold=bold)

def make_table(doc, headers, rows, widths=None, anchor=WD_TABLE_ALIGNMENT.CENTER):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = 'Table Grid'; t.alignment = anchor
    for i, htxt in enumerate(headers):
        c = t.rows[0].cells[i]
        fill_cell(c, htxt, size=9.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, cjk="黑体")
        shade(c, "2F5597")
        for p in c.paragraphs:
            for r in p.runs: r.font.color.rgb = RGBColor(0xFF,0xFF,0xFF)
    for row in rows:
        cells = t.add_row().cells
        for i, v in enumerate(row):
            al = WD_ALIGN_PARAGRAPH.CENTER if len(str(v)) <= 12 else WD_ALIGN_PARAGRAPH.LEFT
            fill_cell(cells[i], str(v), size=9, align=al)
            if str(v).startswith("PK"):
                shade(cells[i], "FFF2CC")
    if widths:
        for r in t.rows:
            for i, w in enumerate(widths):
                r.cells[i].width = Cm(w)
    return t

def add_image(doc, path, caption, width_cm=24.0):
    if not os.path.exists(path):
        para(doc, f"[缺图] {os.path.basename(path)}", bold=True); return
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6); p.paragraph_format.space_after = Pt(2)
    p.add_run().add_picture(path, width=Cm(width_cm))
    c = doc.add_paragraph(); c.alignment = WD_ALIGN_PARAGRAPH.CENTER
    c.paragraph_format.space_after = Pt(10)
    r = c.add_run(caption); set_cjk(r, cjk="楷体", size=10, bold=True)

# ============================================================ 构建文档
doc = Document()

sec = doc.sections[0]
sec.orientation = WD_ORIENT.LANDSCAPE
sec.page_width, sec.page_height = Cm(29.7), Cm(21.0)
sec.left_margin = sec.right_margin = Cm(2.2)
sec.top_margin = sec.bottom_margin = Cm(2.0)

# ---------- 封面 ----------
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(30); p.paragraph_format.space_after = Pt(6)
r = p.add_run("实验07  数据建模  实验报告"); set_cjk(r, cjk="黑体", size=22, bold=True, color=RGBColor(0x1F,0x38,0x64))
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("课题：校园委托管理系统"); set_cjk(r, cjk="黑体", size=15, bold=True)
para(doc, "", space_after=12)

make_table(doc,
  ["项目","内容","项目","内容"],
  [["实验名称","实验07 数据建模","实验日期","    年    月    日"],
   ["课题名称","校园委托管理系统","目标 DBMS","MySQL 8.0"],
   ["建模工具","PowerDesigner（ER 图/PDM）、StarUML、Axure RP9","实体数量","9 个实体"],
   ["小组成员","（请填写）","指导教师","（请填写）"]],
  widths=[3.2,9.0,3.2,9.0])

# ---------- 一、实验目的 ----------
h1(doc, "一、实验目的")
for s in [
  "1、能够归纳系统业务名词，提取核心实体并定义实体属性；",
  "2、能够区分实体间的三种关联关系（一对一、一对多、多对多），并正确表达于数据模型；",
  "3、能够使用 PowerDesigner 绘制 ER 图、类图与数据流图；",
  "4、能够编制规范的数据字典，包含实体名、属性名、数据类型、约束条件及业务含义说明。",
]:
    para(doc, s, indent=0.6)

# ---------- 二、仪器和材料 ----------
h1(doc, "二、实验用的仪器和材料")
para(doc, "硬件：PC 电脑一台；配置：内存 4G 及以上，硬盘 250G 及以上。", indent=0.6)
para(doc, "软件环境：StarUML、Power Designer、Axure RP9，另使用 MySQL 8.0 验证建表脚本。", indent=0.6)

# ---------- 三、课题背景 ----------
h1(doc, "三、课题背景与业务分析")
h2(doc, "3.1 业务概述")
para(doc, "校园委托管理系统面向校内师生，提供「发布委托 — 申请接单 — 成交执行 — 资金结算 — 双向评价」的闭环服务。"
          "委托内容涵盖代取快递、代买物品、学习辅导、跑腿代办等校园高频场景。系统引入实名认证与信用分机制"
          "以降低爽约风险，并通过平台托管资金保障双方权益。", indent=0.6)

h2(doc, "3.2 业务名词归纳（名词 → 实体）")
make_table(doc, ["业务名词","是否作为实体","说明 / 归属"],
  [["用户、学生","是 → User","系统的参与者，同时可作为委托方与接单方"],
   ["委托、任务、需求","是 → Task","系统核心业务对象"],
   ["委托分类、标签","是 → Category","对委托归类，便于检索"],
   ["接单申请、报名","是 → Application","用户对委托的接单意向"],
   ["订单、成交单","是 → Orders","委托被接单后形成的交易凭证"],
   ["评价、评分","是 → Review","订单完成后的互评记录"],
   ["钱包、余额","是 → Wallet","用户资金账户"],
   ["流水、账单","是 → Transaction","资金变动明细"],
   ["消息、聊天记录","是 → Message","订单内沟通记录"],
   ["支付平台","否，外部实体","通过接口交互，不建表"],
   ["管理员","否，参与者","通过后台行使审核权，可复用 User 并扩展角色字段"]],
  widths=[5.0,4.0,15.4])

h2(doc, "3.3 实体属性提取结果")
para(doc, "共提取 9 个实体、75 个字段（属性）（详见第五部分数据字典）。其中 Task 为核心实体，"
          "Application / Orders / Transaction / Message 为围绕核心实体的业务过程实体。", indent=0.6)

# ---------- 四、E-R 模型 ----------
h1(doc, "四、实验任务 1：系统 E-R 模型")
h2(doc, "4.1 采用的画法：Crow's Foot（鸦爪 / IE 记法）")
para(doc, "本次建模采用「ER 图新画法」，即 Crow's Foot（Information Engineering，信息工程）记法。"
          "它与偏概念教学的旧画法（Chen 记法）的核心区别是：属性不再画成椭圆，而是直接列在实体框内；"
          "关系不再用菱形，而是用实体间连线加基数符号表示；多对多关系拆成中间表。"
          "新画法更接近数据库表结构，可较自然地映射为 CREATE TABLE 语句。", indent=0.6)
make_table(doc, ["对比项","旧画法（Chen 记法）","新画法（Crow's Foot / IE）"],
  [["实体","矩形","矩形，表名置于顶部"],
   ["属性","椭圆","直接列在实体框内"],
   ["主键","属性下加下划线","在字段后标 PK"],
   ["外键","不强调","在字段后标 FK"],
   ["关系","菱形","实体间连线"],
   ["基数","1、N、M","鸦爪符号（见下表）"],
   ["多对多","可直接画 M:N","拆成关联实体（中间表）"],
   ["适用","概念建模、教学","数据库设计、建表、DDL"]],
  widths=[3.4,9.0,11.6])
para(doc, "基数符号含义（符号画在连线靠近实体的一端，紧贴该实体）：", indent=0.6, size=10, bold=True)
make_table(doc, ["符号","含义","本系统用例"],
  [["| |","一（强制）","TASK ||--|| ORDERS：一个委托成交后产生唯一订单"],
   ["| o","零或一（可选）","USER ||--o| WALLET：一个用户拥有零或一个钱包"],
   ["} |","一或多（强制）","本系统未使用，列出以说明记号体系"],
   ["} o","零或多（可选）","USER ||--o{ TASK：一个用户发布零或多个委托"]],
  widths=[2.6,4.4,17.4])

h2(doc, "4.2 完整 E-R 图（新画法）")
add_image(doc, os.path.join(OUT,"03_图1_ER图.png"), "图1  校园委托系统 E-R 图（Crow's Foot 记法，9 个实体）", 25.0)

h2(doc, "4.3 三种关联关系详解")
add_image(doc, os.path.join(OUT,"07_图5_ER关联关系详解.png"), "图5  一对一 / 一对多 / 多对多 三种关联关系详解", 25.0)

h2(doc, "4.4 实体关系清单")
make_table(doc, ["主实体","关联实体","关联类型","业务含义","模型实现方式"],
  [[a,b,c,d_,e] for (a,b,c,d_,e) in RELATIONS],
  widths=[3.4,3.6,2.0,10.0,5.4])

h2(doc, "4.5 关系设计说明")
for s in [
  "（1）一对一联系的实现：User↔Wallet 在 wallet.user_id 上建立唯一约束；Task↔Orders 在 orders.task_id 上建立唯一约束；"
  "Orders↔Review 在 review.order_id 上建立唯一约束。唯一约束是关系模型中表达 1:1 的标准手段。",
  "（2）一对多联系的实现：把「一」端的主键作为「多」端的外键，例如 task.publisher_id 引用 user.user_id。",
  "（3）多对多联系的实现：User↔Task 之间的「申请接单」是多对多联系，引入联系实体 Application，"
  "使其与 User、Task 各自形成 1:N 联系，从而可在关系数据库中直接落地。",
  "（4）自反与多重联系：Review 与 User 之间存在两条 1:N 路径（reviewer_id 与 reviewee_id），"
  "二者语义不同，因此分别建为两个外键，不能合并。",
]:
    para(doc, s, indent=0.6)

h2(doc, "4.6 完整数据模型（外键视图，对应 PowerDesigner PDM）")
add_image(doc, os.path.join(OUT,"08_图6_完整数据模型.png"), "图6  9 张表的完整外键引用模型", 25.0)

# ---------- 五、数据字典 ----------
doc.add_page_break()
h1(doc, "五、实验任务 2：数据字典")
para(doc, "命名规范：表名使用小写英文单数或复数（orders 因 order 为 SQL 保留字故用复数），"
          "字段名采用下划线分隔的小写英文；主键统一命名为 表名_id 并自增；"
          "所有表含 created_at / updated_at 时间戳；状态类字段用 TINYINT 并附取值说明。", indent=0.6)

for i, (name, meta) in enumerate(TABLES.items(), 1):
    h2(doc, f"5.{i}  {name}")
    para(doc, f"表说明：{meta['comment']}", indent=0.6, size=10)
    make_table(doc, ["字段名","中文名","数据类型","长度/精度","约束条件","业务含义说明"],
               meta["cols"],
               widths=[3.7,2.6,2.2,2.2,4.4,9.3])

# ---------- 六、数据流图 ----------
doc.add_page_break()
h1(doc, "六、实验任务 3：数据流图（共 3 个）")
para(doc, "图元说明：圆角矩形 = 外部实体，圆形 = 加工（带编号），开口矩形 = 数据存储（D 编号），箭头 = 数据流。",
     indent=0.6)
for idx, (title, fname, desc, flows) in enumerate(DFDS, 1):
    h2(doc, f"6.{idx}  {title}")
    para(doc, desc, indent=0.6, size=10)
    add_image(doc, os.path.join(OUT, fname), title, 24.0)
    para(doc, "数据流清单：", indent=0.6, size=10, bold=True)
    for f in flows:
        para(doc, "· " + f, indent=1.0, size=9.5, space_after=2)

# ---------- 七、PowerDesigner 操作指引 ----------
doc.add_page_break()
h1(doc, "七、PowerDesigner 建模操作指引（本报告配套脚本的使用方法）")
para(doc, "本报告配套提供 MySQL 8.0 建表脚本 01_campus_commission_DDL_MySQL80.sql，"
          "可在 PowerDesigner 中通过反向工程直接生成 PDM 与 ER 图，步骤如下：", indent=0.6)
for s in [
  "步骤 1：在 MySQL 8.0 中执行脚本建库 campus_commission 与 9 张表（或仅在数据库中执行）。",
  "步骤 2：PowerDesigner → File → Reverse Engineer → Database…，Model name 填写 CampusCommission。",
  "步骤 3：DBMS 选择 MySQL 8.0（若无该版本可选 MySQL 5.0，DDL 兼容），"
  "Connection profile 配置到本机 MySQL 实例。",
  "步骤 4：Options 页勾选 Tables、Columns、Primary keys、Foreign keys、Indexes，"
  "确保唯一约束（Unique key）被反向为 Alternate Key，从而在图中体现 1:1 关系。",
  "步骤 5：反向工程完成后，双击 Diagram 打开 ER 图；在 Tools → Display Preferences 中"
  "勾选显示基数（Cardinality）与关系名。",
  "步骤 6：如需补充类图，可在 PowerDesigner 中 File → New Model → Object-Oriented Model，"
  "按实体与业务方法绘制类图，或使用 StarUML 绘制。",
  "步骤 7：数据流图（DFD）建议使用 PowerDesigner 的 Data Flow Diagram 或 Axure RP9 绘制，"
  "图元与连线已在本报告第六部分给出，可直接照图绘制。",
]:
    para(doc, s, indent=0.6)

h1(doc, "八、实验小结")
for s in [
  "1、通过名词归纳法，从「委托发布—接单—成交—结算—评价」的业务流程中提取出 9 个实体，"
  "并明确了区分实体与外部实体的判据：是否需要在系统中持久化保存。",
  "2、掌握了「ER 图新画法」（Crow's Foot 记法）的要素：实体框内直接列属性、标 PK/FK、用鸦爪符号表示基数；"
  "同时掌握一对一、一对多、多对多三种联系的判别与表达：1:1 用唯一约束、1:N 用外键、M:N 用联系实体拆解为两个 1:N。",
  "3、数据字典不仅记录字段的技术属性（类型、长度、约束），更要写明业务含义与取值枚举，"
  "这是后续开发与维护的依据。",
  "4、为资金相关表引入 transaction 流水表与 balance_after 冗余字段，"
  "在保证可对账性的同时兼顾了查询性能。",
]:
    para(doc, s, indent=0.6)

doc.save(DOCX)
print("saved", DOCX)
