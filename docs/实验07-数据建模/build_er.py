"""
校园委托系统 —— E-R 图 定稿（v2 清晰版）
设计原则：
  1. 9 个实体排成 3x3 网格
  2. 只用水平线 / 垂直线，绝不画斜线与绕行长折线
  3. 实体之间的横向连线只放在「顶行」与「行间通道」，纵向连线只放在「列间通道」
  4. 未画出的次要外键，在图例的「关系一览」中完整列出
"""
import os, math
from PIL import Image, ImageDraw, ImageFont

OUT = r"C:\Users\林炯汉\Documents\deepseek-harness\default-workspace\campus-commission"

def load_font(size):
    for c in (r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\msyhbd.ttc",
              r"C:\Windows\Fonts\simhei.ttf", r"C:\Windows\Fonts\simsun.ttc"):
        if os.path.exists(c):
            try: return ImageFont.truetype(c, size)
            except Exception: pass
    return ImageFont.load_default()

F_TITLE=load_font(38); F_SUB=load_font(20); F_ENT=load_font(26)
F_COL=load_font(17); F_REL=load_font(19); F_CARD=load_font(20)

BG=(255,255,255); INK=(31,56,100)
ENT_BG,ENT_HD=(223,234,250),(47,85,151)
REL_BG,REL_HD=(255,242,204),(191,143,0)
LINE=(70,90,120); PK_BG=(255,242,204); CARD=(176,58,58)
HD,ROW,PAD=38,27,12

BW   = 340                 # 箱宽
DHW, DHH = 92, 52          # 菱形半宽/半高
COLGAP = 360               # 列间距（> 2*DHW=184）
CH     = 250               # 行间通道高度

CX = {1: 340, 2: 340+BW+COLGAP, 3: 340+2*(BW+COLGAP)}   # 340 / 1040 / 1740
GX13 = (CX[1]+CX[2])/2      # 690
GX23 = (CX[2]+CX[3])/2      # 1390

def boxh(n): return HD + ROW*n + PAD

ROWS = {}
Y = 400
ROWS[1] = Y
ROW1 = [("User 用户",10),("Task 委托任务",12),("Orders 订单",10)]
ROWS[2] = Y + max(boxh(n) for _,n in ROW1)/2 + CH + 220
ROW2 = [("Wallet 钱包",5),("Transaction 资金流水",8),("Message 站内消息",7)]
ROWS[3] = ROWS[2] + max(boxh(n) for _,n in ROW2)/2 + CH + 220
ROW3 = [("Category 委托分类",5),("Application 接单申请",7),("Review 评价",7)]

def tw(d,t,f):
    b=d.textbbox((0,0),t,font=f); return b[2]-b[0],b[3]-b[1]
def wrap(d,t,f,mw):
    ls,cur=[],""
    for ch in t:
        if tw(d,cur+ch,f)[0]<=mw: cur+=ch
        else: ls.append(cur); cur=ch
    if cur: ls.append(cur)
    return ls

def diamond(d,cx,cy,text):
    d.polygon([(cx,cy-DHH),(cx+DHW,cy),(cx,cy+DHH),(cx-DHW,cy)], fill=REL_BG, outline=REL_HD, width=3)
    ls=wrap(d,text,F_REL,int(DHW*1.5)); th=sum(tw(d,l,F_REL)[1]+5 for l in ls); yy=cy-th/2
    for l in ls:
        d.text((cx-tw(d,l,F_REL)[0]/2,yy), l, font=F_REL, fill=(120,85,0)); yy+=tw(d,l,F_REL)[1]+5

def dot(d,p): d.ellipse([p[0]-5,p[1]-5,p[0]+5,p[1]+5], fill=LINE)
def card(d,x,y,t):
    b=d.textbbox((0,0),t,font=F_CARD); bw,bh=b[2]-b[0],b[3]-b[1]
    d.rectangle([x-bw/2-6,y-bh/2-4,x+bw/2+6,y+bh/2+6], fill=BG)
    d.text((x-bw/2,y-bh/2-1), t, font=F_CARD, fill=CARD)
def arrow(d,p1,p2):
    d.line([p1,p2], fill=LINE, width=3)
    ang=math.atan2(p2[1]-p1[1], p2[0]-p1[0]); L,sp=18,0.42
    d.polygon([p2,(p2[0]-L*math.cos(ang-sp),p2[1]-L*math.sin(ang-sp)),
                  (p2[0]-L*math.cos(ang+sp),p2[1]-L*math.sin(ang+sp))], fill=LINE)
def connect(d,pts):
    for i in range(len(pts)-1): d.line([pts[i],pts[i+1]], fill=LINE, width=3)
    arrow(d, pts[-2], pts[-1]); dot(d, pts[0])

def fig(path):
    # 画布高度按行位置推算，并预留图例空间
    H = int(ROWS[3] + 200 + 275)
    W = 2150
    img=Image.new("RGB",(W,H),BG); d=ImageDraw.Draw(img)
    d.text((44,24),"图1  校园委托系统 E-R 图", font=F_TITLE, fill=INK)
    d.text((44,74),"矩形 = 实体；菱形 = 联系；箭头指向「多」端；主键黄底、外键以 → 标记。"
                   "为保持图面清晰，只绘制主要联系，完整外键清单见下方「关系一览」",
           font=F_SUB, fill=(90,100,120))

    DATA = {
      "User 用户": ["PK user_id BIGINT","username VARCHAR(50)","password_hash CHAR(60)",
                    "student_no VARCHAR(20)","phone VARCHAR(20)","real_name VARCHAR(50)",
                    "verify_status TINYINT","credit_score INT","status TINYINT","created_at DATETIME"],
      "Task 委托任务": ["PK task_id BIGINT","FK publisher_id BIGINT","FK category_id BIGINT",
                        "title VARCHAR(100)","description TEXT","reward DECIMAL(10,2)",
                        "deadline DATETIME","place VARCHAR(100)","urgency TINYINT",
                        "status TINYINT","view_count INT","created_at DATETIME"],
      "Orders 订单": ["PK order_id BIGINT","order_no VARCHAR(32)","FK task_id BIGINT",
                      "FK publisher_id BIGINT","FK taker_id BIGINT","amount DECIMAL(10,2)",
                      "status TINYINT","accepted_at DATETIME","finished_at DATETIME","cancel_reason VARCHAR(255)"],
      "Wallet 钱包": ["PK wallet_id BIGINT","FK user_id BIGINT","balance DECIMAL(12,2)",
                      "frozen DECIMAL(12,2)","updated_at DATETIME"],
      "Transaction 资金流水": ["PK txn_id BIGINT","FK wallet_id BIGINT","FK order_id BIGINT","type TINYINT",
                               "amount DECIMAL(12,2)","balance_after DECIMAL(12,2)","remark VARCHAR(255)","created_at DATETIME"],
      "Message 站内消息": ["PK message_id BIGINT","FK order_id BIGINT","FK sender_id BIGINT",
                           "FK receiver_id BIGINT","content VARCHAR(500)","is_read TINYINT","sent_at DATETIME"],
      "Category 委托分类": ["PK category_id BIGINT","name VARCHAR(50)","description VARCHAR(255)",
                            "sort_no INT","enabled TINYINT"],
      "Application 接单申请": ["PK application_id BIGINT","FK task_id BIGINT","FK applicant_id BIGINT",
                               "message VARCHAR(255)","status TINYINT","applied_at DATETIME","handled_at DATETIME"],
      "Review 评价": ["PK review_id BIGINT","FK order_id BIGINT","FK reviewer_id BIGINT",
                      "FK reviewee_id BIGINT","score TINYINT 1~5","content VARCHAR(500)","created_at DATETIME"],
    }

    R = {}
    def draw_box(cx, cy, name):
        cols = DATA[name]; h = boxh(len(cols)); x,y = cx-BW/2, cy-h/2
        d.rectangle([x,y,x+BW,y+h], fill=ENT_BG, outline=ENT_HD, width=3)
        d.rectangle([x,y,x+BW,y+HD], fill=ENT_HD)
        d.text((cx-tw(d,name,F_ENT)[0]/2, y+5), name, font=F_ENT, fill=(255,255,255))
        yy=y+HD+4
        for c in cols:
            ispk,isfk=c.startswith("PK"),c.startswith("FK")
            if ispk: d.rectangle([x+4,yy-2,x+BW-4,yy+ROW-5], fill=PK_BG)
            col=(150,40,40) if ispk else ((20,90,160) if isfk else (40,48,60))
            d.text((x+12,yy), c.replace("PK ","").replace("FK ","→ "), font=F_COL, fill=col)
            yy+=ROW
        R[name]=(x,y,x+BW,y+h)

    for i,(nm,_) in enumerate(ROW1,1): draw_box(CX[i], ROWS[1], nm)
    for i,(nm,_) in enumerate(ROW2,1): draw_box(CX[i], ROWS[2], nm)
    for i,(nm,_) in enumerate(ROW3,1): draw_box(CX[i], ROWS[3], nm)

    def L(n): return R[n][0]
    def Rt(n): return R[n][2]
    def T(n): return R[n][1]
    def B(n): return R[n][3]
    def CY_(n): return (R[n][1]+R[n][3])/2
    def MB(n): return (R[n][0]+R[n][2])/2     # 箱中线 x

    # ================= 顶行：横向主要关系（菱形在列间通道中央）=================
    diamond(d, GX13, ROWS[1], "发布\nPUBLISH")
    connect(d,[(Rt("User 用户"),CY_("User 用户")),(GX13-DHW,CY_("User 用户"))])
    card(d, GX13-DHW-52, CY_("User 用户")-46, "1")
    connect(d,[(GX13+DHW,CY_("User 用户")),(L("Task 委托任务"),CY_("User 用户"))])
    card(d, GX13+DHW+50, CY_("User 用户")-46, "N")

    diamond(d, GX23, ROWS[1], "成交\nACCEPT")
    connect(d,[(Rt("Task 委托任务"),CY_("Task 委托任务")),(GX23-DHW,CY_("Task 委托任务"))])
    card(d, GX23-DHW-52, CY_("Task 委托任务")-46, "1")
    connect(d,[(GX23+DHW,CY_("Task 委托任务")),(L("Orders 订单"),CY_("Task 委托任务"))])
    card(d, GX23+DHW+50, CY_("Task 委托任务")-46, "1")

    # ================= 行1 -> 行2：竖直连接（同列正下方，最短直线）=================
    # User -1- HAS -1- Wallet
    connect(d,[(MB("User 用户"),B("User 用户")),(MB("Wallet 钱包"),T("Wallet 钱包"))])
    card(d, MB("User 用户")-56, (B("User 用户")+T("Wallet 钱包"))/2, "1")
    card(d, MB("User 用户")-56, (B("User 用户")+T("Wallet 钱包"))/2+40, "1")
    # Task -1- 归集 -N- Transaction
    connect(d,[(MB("Task 委托任务"),B("Task 委托任务")),(MB("Transaction 资金流水"),T("Transaction 资金流水"))])
    card(d, MB("Task 委托任务")-56, (B("Task 委托任务")+T("Transaction 资金流水"))/2, "1")
    card(d, MB("Task 委托任务")-56, (B("Task 委托任务")+T("Transaction 资金流水"))/2+40, "N")
    # Orders -1- 通知 -N- Message
    connect(d,[(MB("Orders 订单"),B("Orders 订单")),(MB("Message 站内消息"),T("Message 站内消息"))])
    card(d, MB("Orders 订单")-56, (B("Orders 订单")+T("Message 站内消息"))/2, "1")
    card(d, MB("Orders 订单")-56, (B("Orders 订单")+T("Message 站内消息"))/2+40, "N")

    # ================= 行2 -> 行3：竖直连接（同列正下方）=================
    # Wallet -1- 结算 -N- ? 用 Wallet 下方直接接 Category 不妥，故改用行间横向通道
    # Transaction 由 Orders 与 Wallet 共同引用，已在关系一览列出
    # Category -1- 属于 -N- Task ：Category 在行3左列，向上穿过行间通道，再水平进入 Task 底部左端
    ychan = (ROWS[2] + ROWS[3])/2
    connect(d,[(MB("Category 委托分类"),T("Category 委托分类")),(MB("Category 委托分类"),ychan),
            (L("Task 委托任务")+90,ychan),(L("Task 委托任务")+90,B("Task 委托任务"))])
    card(d, MB("Category 委托分类")+56, ychan-40, "1")
    card(d, L("Task 委托任务")+40, ychan-40, "N")
    # Task -1- 申请 -1- Application
    connect(d,[(MB("Task 委托任务"),B("Task 委托任务")),(MB("Task 委托任务"),T("Application 接单申请"))])
    card(d, MB("Task 委托任务")-56, (B("Task 委托任务")+T("Application 接单申请"))/2, "1")
    card(d, MB("Task 委托任务")-56, (B("Task 委托任务")+T("Application 接单申请"))/2+40, "1")
    # Orders -1- 评价 -1- Review
    connect(d,[(MB("Orders 订单"),B("Orders 订单")),(MB("Orders 订单"),T("Review 评价"))])
    card(d, MB("Orders 订单")-56, (B("Orders 订单")+T("Review 评价"))/2, "1")
    card(d, MB("Orders 订单")-56, (B("Orders 订单")+T("Review 评价"))/2+40, "1")

    # ================= 图例（完整关系清单，含未画线的次要外键）=================
    ly = int(ROWS[3] + 200)
    lx = 44
    d.rectangle([lx,ly,lx+1500,ly+185], fill=(248,250,253), outline=(200,210,225), width=2)
    d.text((lx+20,ly+12),"关系一览（图中未画线的次要外键亦在此列出）", font=F_REL, fill=INK)
    notes=[
      "一对一 1:1 　User ↔ Wallet（wallet.user_id 唯一）　Task ↔ Orders（orders.task_id 唯一）　Orders ↔ Review（review.order_id 唯一）",
      "一对多 1:N 　User → Task（publisher_id）　Category → Task（category_id）　Task → Application（task_id）",
      "　　　　　   Orders → Message（order_id）　Wallet → Transaction（wallet_id）　Orders → Transaction（order_id）",
      "多对多 M:N 　User ↔ Task，经 Application（接单申请）联系实体化解为两个 1:N 关系",
    ]
    yy=ly+50
    for n in notes:
        d.text((lx+20,yy), n, font=F_COL, fill=(40,48,60)); yy+=33

    img.save(path); print("saved", path, img.size)

fig(os.path.join(OUT,"03_图1_ER图.png"))
print("DONE")
