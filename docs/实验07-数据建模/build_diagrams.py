"""
校园委托系统 —— 绘制 E-R 图 与 3 个数据流图 (PNG)
依赖: Pillow
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = r"C:\Users\林炯汉\Documents\deepseek-harness\default-workspace\campus-commission"
os.makedirs(OUT, exist_ok=True)

# ------------------------------------------------------------------ 字体
def load_font(size):
    cands = [
        r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\msyhbd.ttc",
        r"C:\Windows\Fonts\simhei.ttf", r"C:\Windows\Fonts\simsun.ttc",
        r"C:\Windows\Fonts\Deng.ttf",
    ]
    for c in cands:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                continue
    return ImageFont.load_default()

F_TITLE = load_font(34)
F_ENT   = load_font(23)
F_COL   = load_font(17)
F_EDGE  = load_font(18)
F_NOTE  = load_font(18)

BG = (255, 255, 255)
INK = (31, 56, 100)
ENT_BG = (223, 234, 250)
ENT_HD = (47, 85, 151)
LINE = (70, 90, 120)
PK_BG = (255, 242, 204)
EDGE_TXT = (176, 58, 58)

def tw(d, txt, f):
    b = d.textbbox((0, 0), txt, font=f)
    return b[2] - b[0], b[3] - b[1]

def wrap(d, txt, f, maxw):
    lines, cur = [], ""
    for ch in txt:
        if ch == "\n":
            lines.append(cur); cur = ""
            continue
        if tw(d, cur + ch, f)[0] <= maxw:
            cur += ch
        else:
            lines.append(cur); cur = ch
    if cur:
        lines.append(cur)
    return lines

# ================================================================== 图1 E-R
def draw_er(path):
    W, H = 1820, 1290
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    d.text((40, 26), "图1  校园委托系统 E-R 图", font=F_TITLE, fill=INK)
    d.text((40, 74), "（矩形=实体，下划线/黄底=主键，菱形关系已简化为带基数的连线）",
           font=F_NOTE, fill=(90, 100, 120))

    COLS_H = 34
    ROW_H = 27
    PAD = 14

    # 实体: 名称, x, y, 宽, [字段...]
    ents = [
        ("User 用户", 60, 470, 300, [
            "PK user_id  BIGINT", "username  VARCHAR(50) UNIQUE",
            "password_hash  CHAR(60)", "student_no  VARCHAR(20)",
            "phone  VARCHAR(20)", "real_name  VARCHAR(50)",
            "verify_status  TINYINT", "credit_score  INT",
            "status  TINYINT", "created_at  DATETIME"]),
        ("Category 委托分类", 60, 170, 300, [
            "PK category_id  BIGINT", "name  VARCHAR(50) UNIQUE",
            "description  VARCHAR(255)", "sort_no  INT", "enabled  TINYINT"]),
        ("Task 委托任务", 660, 440, 340, [
            "PK task_id  BIGINT", "FK publisher_id  BIGINT",
            "FK category_id  BIGINT", "title  VARCHAR(100)",
            "description  TEXT", "reward  DECIMAL(10,2)",
            "deadline  DATETIME", "place  VARCHAR(100)",
            "urgency  TINYINT", "status  TINYINT",
            "view_count  INT", "created_at  DATETIME"]),
        ("Application 接单申请", 660, 130, 340, [
            "PK application_id  BIGINT", "FK task_id  BIGINT",
            "FK applicant_id  BIGINT", "message  VARCHAR(255)",
            "status  TINYINT", "applied_at  DATETIME",
            "handled_at  DATETIME"]),
        ("Orders 订单", 1310, 430, 340, [
            "PK order_id  BIGINT", "order_no  VARCHAR(32) UNIQUE",
            "FK task_id  BIGINT UNIQUE", "FK publisher_id  BIGINT",
            "FK taker_id  BIGINT", "amount  DECIMAL(10,2)",
            "status  TINYINT", "accepted_at  DATETIME",
            "finished_at  DATETIME", "cancel_reason  VARCHAR(255)"]),
        ("Review 评价", 1310, 130, 340, [
            "PK review_id  BIGINT", "FK order_id  BIGINT UNIQUE",
            "FK reviewer_id  BIGINT", "FK reviewee_id  BIGINT",
            "score  TINYINT (1~5)", "content  VARCHAR(500)",
            "created_at  DATETIME"]),
        ("Wallet 钱包", 60, 830, 300, [
            "PK wallet_id  BIGINT", "FK user_id  BIGINT UNIQUE",
            "balance  DECIMAL(12,2)", "frozen  DECIMAL(12,2)",
            "updated_at  DATETIME"]),
        ("Transaction 资金流水", 660, 830, 340, [
            "PK txn_id  BIGINT", "FK wallet_id  BIGINT",
            "FK order_id  BIGINT NULL", "type  TINYINT",
            "amount  DECIMAL(12,2)", "balance_after  DECIMAL(12,2)",
            "remark  VARCHAR(255)", "created_at  DATETIME"]),
        ("Message 站内消息", 1310, 830, 340, [
            "PK message_id  BIGINT", "FK order_id  BIGINT",
            "FK sender_id  BIGINT", "FK receiver_id  BIGINT",
            "content  VARCHAR(500)", "is_read  TINYINT",
            "sent_at  DATETIME"]),
    ]

    boxes = {}
    for name, x, y, w, cols in ents:
        h = COLS_H + ROW_H * len(cols) + PAD
        boxes[name] = (x, y, w, h)
        d.rectangle([x, y, x + w, y + h], fill=ENT_BG, outline=ENT_HD, width=3)
        d.rectangle([x, y, x + w, y + COLS_H], fill=ENT_HD)
        t = name
        d.text((x + w / 2 - tw(d, t, F_ENT)[0] / 2, y + 6), t, font=F_ENT, fill=(255, 255, 255))
        yy = y + COLS_H + 4
        for c in cols:
            is_pk = c.startswith("PK")
            is_fk = c.startswith("FK")
            if is_pk:
                d.rectangle([x + 4, yy - 2, x + w - 4, yy + ROW_H - 4], fill=PK_BG)
            col = (150, 40, 40) if is_pk else ((20, 90, 160) if is_fk else (40, 48, 60))
            label = c.replace("PK ", "").replace("FK ", "→ ")
            d.text((x + 12, yy), label, font=F_COL, fill=col)
            yy += ROW_H

    def anchor(key, side):
        x, y, w, h = boxes[key]
        return {"L": (x, y + h / 2), "R": (x + w, y + h / 2),
                "T": (x + w / 2, y), "B": (x + w / 2, y + h)}[side]

    def edge(p1, p2, card, lx=None, ly=None, color=LINE, dash=False):
        d.line([p1, p2], fill=color, width=3)
        for (px, py) in (p1, p2):
            d.ellipse([px - 5, py - 5, px + 5, py + 5], fill=color)
        if lx is not None:
            b = d.textbbox((0, 0), card, font=F_EDGE)
            bw, bh = b[2] - b[0], b[3] - b[1]
            d.rectangle([lx - bw / 2 - 5, ly - bh / 2 - 4, lx + bw / 2 + 5, ly + bh / 2 + 6],
                        fill=(255, 255, 255))
            d.text((lx - bw / 2, ly - bh / 2 - 1), card, font=F_EDGE, fill=EDGE_TXT)

    # 关系连线（带基数标注）
    edge(anchor("User 用户", "R"), anchor("Task 委托任务", "L"), "1 : N", 470, 560)
    edge(anchor("Category 委托分类", "R"), (boxes["Task 委托任务"][0], boxes["Task 委托任务"][1] + 70),
         "1 : N", 500, 250)
    edge(anchor("User 用户", "T"), anchor("Application 接单申请", "L"), "1 : N", 480, 330)
    edge((boxes["Application 接单申请"][0] + 90, boxes["Application 接单申请"][1] + boxes["Application 接单申请"][3]),
         (boxes["Task 委托任务"][0] + 90, boxes["Task 委托任务"][1]), "N : 1", 790, 335)
    edge(anchor("Task 委托任务", "R"), anchor("Orders 订单", "L"), "1 : 1", 1160, 440)
    edge(anchor("Orders 订单", "T"), anchor("Review 评价", "B"), "1 : 1", 1520, 355)
    edge((boxes["Review 评价"][0], boxes["Review 评价"][1] + 80),
         anchor("User 用户", "T"), "N : 1", 1000, 96)
    edge(anchor("User 用户", "B"), anchor("Wallet 钱包", "T"), "1 : 1", 215, 800)
    edge(anchor("Wallet 钱包", "R"), anchor("Transaction 资金流水", "L"), "1 : N", 500, 900)
    edge((boxes["Transaction 资金流水"][0] + 250, boxes["Transaction 资金流水"][1]),
         (boxes["Orders 订单"][0] + 170, boxes["Orders 订单"][1] + boxes["Orders 订单"][3]),
         "N : 1", 1140, 790)
    edge((boxes["Message 站内消息"][0], boxes["Message 站内消息"][1] + 60),
         (boxes["Orders 订单"][0] + boxes["Orders 订单"][2], boxes["Orders 订单"][1] + 180),
         "N : 1", 1560, 700)

    d.text((40, H - 46),
           "说明：User↔Wallet、Task↔Orders、Orders↔Review 为 1:1；User/Category→Task、Task→Application 等为 1:N；"
           "Review 通过 reviewer_id / reviewee_id 两条 1:N 路径回溯到 User，故整体呈现为 N:1 与 1:N 的组合。",
           font=F_NOTE, fill=(90, 100, 120))

    img.save(path)
    print("saved", path)

# ================================================================== DFD 通用
def dfd_shell(path, title, subtitle, w=1700, h=1080):
    img = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(img)
    d.text((40, 24), title, font=F_TITLE, fill=INK)
    d.text((40, 70), subtitle, font=F_NOTE, fill=(90, 100, 120))
    return img, d

def box(d, x, y, w, h, text, fill=(235, 242, 252), outline=(47, 85, 151), f=None, radius=10, width=3):
    f = f or F_ENT
    if radius:
        d.rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=fill, outline=outline, width=width)
    else:
        d.rectangle([x, y, x + w, y + h], fill=fill, outline=outline, width=width)
    lines = wrap(d, text, f, w - 20)
    th = sum(tw(d, l, f)[1] + 6 for l in lines)
    yy = y + (h - th) / 2
    for l in lines:
        d.text((x + w / 2 - tw(d, l, f)[0] / 2, yy), l, font=f, fill=(20, 30, 50))
        yy += tw(d, l, f)[1] + 6

def store(d, x, y, w, h, text, sid):
    """数据存储：左侧标识栏 + 开口矩形"""
    d.rectangle([x, y, x + w, y + h], fill=(255, 248, 225), outline=(180, 130, 40), width=3)
    d.line([x + 56, y, x + 56, y + h], fill=(180, 130, 40), width=3)
    d.text((x + 18, y + h / 2 - 12), sid, font=F_ENT, fill=(150, 100, 20))
    lines = wrap(d, text, F_COL, w - 76)
    th = sum(tw(d, l, F_COL)[1] + 6 for l in lines)
    yy = y + (h - th) / 2
    for l in lines:
        d.text((x + 68, yy), l, font=F_COL, fill=(60, 50, 20))
        yy += tw(d, l, F_COL)[1] + 6

def circle(d, cx, cy, r, text, num):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(226, 240, 227), outline=(60, 130, 70), width=3)
    d.text((cx - r + 10, cy - r + 6), num, font=F_EDGE, fill=(40, 100, 50))
    lines = wrap(d, text, F_COL, int(r * 1.7))
    th = sum(tw(d, l, F_COL)[1] + 5 for l in lines)
    yy = cy - th / 2 + 6
    for l in lines:
        d.text((cx - tw(d, l, F_COL)[0] / 2, yy), l, font=F_COL, fill=(20, 60, 30))
        yy += tw(d, l, F_COL)[1] + 5

def arrow(d, p1, p2, label=None, lpos=0.5, color=LINE, offset=(0, -22), f=None):
    f = f or F_EDGE
    import math
    d.line([p1, p2], fill=color, width=3)
    ang = math.atan2(p2[1] - p1[1], p2[0] - p1[0])
    L, sp = 16, 0.42
    for s in (+1, -1):
        d.line([p2, (p2[0] - L * math.cos(ang - s * sp), p2[1] - L * math.sin(ang - s * sp))],
               fill=color, width=3)
    if label:
        mx = p1[0] + (p2[0] - p1[0]) * lpos + offset[0]
        my = p1[1] + (p2[1] - p1[1]) * lpos + offset[1]
        b = d.textbbox((0, 0), label, font=f)
        bw, bh = b[2] - b[0], b[3] - b[1]
        d.rectangle([mx - bw / 2 - 5, my - bh / 2 - 4, mx + bw / 2 + 5, my + bh / 2 + 6], fill=BG)
        d.text((mx - bw / 2, my - bh / 2 - 1), label, font=f, fill=(150, 40, 40))

USER = "用户"
def ext(d, x, y, w, h, text):
    d.rectangle([x, y, x + w, y + h], fill=(253, 235, 235), outline=(178, 70, 70), width=3)
    d.rectangle([x + 6, y + 6, x + w - 6, y + h - 6], outline=(178, 70, 70), width=1)
    lines = wrap(d, text, F_ENT, w - 24)
    th = sum(tw(d, l, F_ENT)[1] + 6 for l in lines)
    yy = y + (h - th) / 2
    for l in lines:
        d.text((x + w / 2 - tw(d, l, F_ENT)[0] / 2, yy), l, font=F_ENT, fill=(120, 30, 30))
        yy += tw(d, l, F_ENT)[1] + 6

# ---------------------------------------------------------- 图2 DFD-0 顶层
def dfd0(path):
    img, d = dfd_shell(path, "图2  数据流图 DFD-0（顶层图 / 上下文图）",
                       "校园委托系统作为一个整体处理，与外部实体交换数据")
    circle(d, 850, 560, 150, "校园委托\n管理系统", "0")
    ext(d, 140, 480, 250, 150, "用户\n（学生 / 委托方 / 接单方）")
    ext(d, 1310, 300, 250, 130, "支付平台")
    ext(d, 1310, 720, 250, 130, "管理员")
    arrow(d, (390, 520), (700, 530), "委托信息 / 接单申请", offset=(0, -26))
    arrow(d, (700, 600), (390, 610), "委托列表 / 订单结果", offset=(0, 30))
    arrow(d, (1000, 520), (1310, 380), "支付 / 提现请求", offset=(0, -26))
    arrow(d, (1310, 400), (1000, 545), "支付结果回调", offset=(0, 30))
    arrow(d, (1310, 780), (1000, 620), "审核 / 封禁指令", offset=(0, 30))
    arrow(d, (985, 640), (1310, 760), "统计数据 / 违规记录", offset=(0, -30))
    d.text((40, 1000), "说明：顶层图只出现一个加工（0 号），用于界定系统边界；所有外部实体均为数据的源或宿。",
           font=F_NOTE, fill=(90, 100, 120))
    img.save(path)
    print("saved", path)

# ---------------------------------------------------------- 图3 DFD-1 发布委托
def dfd1(path):
    img, d = dfd_shell(path, "图3  数据流图 DFD-1（第 1 层：发布委托）",
                      "描述用户发布委托 → 进入待接单池的完整数据流")
    ext(d, 60, 470, 230, 140, "用户（委托方）")
    circle(d, 590, 300, 110, "校验身份\n与委托内容", "1.1")
    circle(d, 590, 640, 110, "保存委托\n并计悬赏", "1.2")
    circle(d, 590, 900, 105, "生成待接单\n列表", "1.3")
    store(d, 1010, 430, 300, 100, "user 用户表", "D1")
    store(d, 1010, 600, 300, 100, "task 委托任务表", "D3")
    store(d, 1010, 770, 300, 100, "category 委托分类表", "D2")
    ext(d, 1450, 590, 200, 120, "接单方\n（其他用户）")

    arrow(d, (290, 520), (500, 350), "委托内容 / 悬赏金额", offset=(0, -20))
    arrow(d, (660, 410), (900, 450), "查询账号与信用分", offset=(0, -20))
    arrow(d, (900, 500), (660, 380), "身份校验结果", offset=(0, 26))
    arrow(d, (590, 410), (590, 530), "校验通过的委托", offset=(60, 0))
    arrow(d, (660, 700), (900, 640), "写入委托记录", offset=(0, -20))
    arrow(d, (1010, 660), (700, 680), "task_id 回填", offset=(0, 28))
    arrow(d, (660, 790), (900, 820), "读取分类信息", offset=(0, -18))
    arrow(d, (700, 900), (1010, 880), "按分类归集", offset=(0, -20))
    arrow(d, (311, 430), (1310, 660), "浏览委托列表", offset=(0, 0))
    d.text((40, 1020), "说明：1.1 完成合法性校验（分类存在、金额>0、截止时间未过期），1.2 落库，1.3 组装待接单列表供接单方浏览。",
           font=F_NOTE, fill=(90, 100, 120))
    img.save(path)
    print("saved", path)

# ---------------------------------------------------------- 图4 DFD-2 接单成交
def dfd2(path):
    img, d = dfd_shell(path, "图4  数据流图 DFD-2（第 1 层：申请接单与订单成交）",
                      "描述接单方申请 → 委托方确认 → 生成订单并托管资金的数据流")
    ext(d, 40, 300, 210, 130, "用户（接单方）")
    ext(d, 40, 760, 210, 130, "用户（委托方）")
    circle(d, 520, 300, 108, "受理接单\n申请", "2.1")
    circle(d, 520, 620, 108, "委托方\n确认接单", "2.2")
    circle(d, 520, 900, 105, "生成订单\n并托管资金", "2.3")
    store(d, 900, 190, 300, 95, "application 接单申请表", "D4")
    store(d, 900, 400, 300, 95, "task 委托任务表", "D3")
    store(d, 900, 620, 300, 95, "orders 订单表", "D5")
    store(d, 900, 830, 300, 95, "wallet 钱包表", "D7")
    store(d, 1300, 620, 300, 95, "transaction 资金流水表", "D8")
    ext(d, 1300, 300, 300, 120, "支付平台")

    arrow(d, (250, 340), (415, 320), "接单申请 / 留言", offset=(0, -22))
    arrow(d, (520, 408), (900, 280), "写入申请记录", offset=(0, -20))
    arrow(d, (900, 240), (628, 290), "是否存在重复申请", offset=(80, -34))
    arrow(d, (250, 790), (415, 650), "接受/拒绝指令", offset=(0, 30))
    arrow(d, (628, 600), (900, 450), "更新委托状态=进行中", offset=(0, -20))
    arrow(d, (900, 470), (610, 560), "读取委托与悬赏", offset=(0, 26))
    arrow(d, (520, 728), (900, 660), "生成订单记录", offset=(0, -18))
    arrow(d, (1050, 715), (1050, 830), "扣减余额/计入冻结", offset=(120, 0))
    arrow(d, (1200, 870), (1300, 690), "写入托管流水", offset=(0, -24))
    arrow(d, (1300, 360), (1200, 640), "请求冻结资金", offset=(0, -25))
    arrow(d, (1300, 400), (1220, 700), "冻结成功", offset=(34, 30))
    d.text((40, 1020), "说明：application.status=1 与 orders 记录生成必须同事务；资金先在 wallet.frozen 冻结，订单完成后再结算。",
           font=F_NOTE, fill=(90, 100, 120))
    img.save(path)
    print("saved", path)

draw_er(os.path.join(OUT, "03_ER图.png"))
dfd0(os.path.join(OUT, "04_DFD0_顶层图.png"))
dfd1(os.path.join(OUT, "05_DFD1_发布委托.png"))
dfd2(os.path.join(OUT, "06_DFD2_接单成交.png"))
print("ALL DONE")
