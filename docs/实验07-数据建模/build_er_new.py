"""
校园委托系统 —— E-R 图（新画法：Crow's Foot / IE 记法）最终版
坐标逐一核对过包围盒，行内/列内连线不交叉、不穿框。
"""
import os, math
from PIL import Image, ImageDraw, ImageFont

_DIR = os.path.dirname(os.path.abspath(__file__))
OUT = _DIR

def load_font(size):
    for c in (r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\msyhbd.ttc",
              r"C:\Windows\Fonts\simhei.ttf", r"C:\Windows\Fonts\simsun.ttc"):
        if os.path.exists(c):
            try: return ImageFont.truetype(c, size)
            except Exception: pass
    return ImageFont.load_default()

F_TITLE=load_font(40); F_SUB=load_font(20); F_ENT=load_font(27)
F_COL=load_font(18); F_REL=load_font(20); F_LEG=load_font(19)

BG=(255,255,255); INK=(31,56,100)
ENT_BG,ENT_HD=(223,234,250),(47,85,151)
LINE=(70,90,120); PK_BG=(255,242,204); CARD=(176,58,58)
HD,ROW,PAD=42,29,12

TB = {
 "USER 用户": (330,["user_id        BIGINT    PK","username       VARCHAR(50)  UQ",
    "password_hash  CHAR(60)","student_no     VARCHAR(20)  UQ","phone          VARCHAR(20)  UQ",
    "real_name      VARCHAR(50)","verify_status  TINYINT","credit_score   INT","created_at     DATETIME"]),
 "CATEGORY 委托分类": (330,["category_id    BIGINT    PK","name           VARCHAR(50)  UQ",
    "description    VARCHAR(255)","sort_no        INT","enabled        TINYINT"]),
 "WALLET 钱包": (330,["wallet_id      BIGINT    PK","user_id        BIGINT    FK,UQ",
    "balance        DECIMAL(12,2)","frozen         DECIMAL(12,2)","updated_at     DATETIME"]),
 "TASK 委托任务": (390,["task_id        BIGINT    PK","publisher_id   BIGINT    FK",
    "category_id    BIGINT    FK","title          VARCHAR(100)","description    TEXT",
    "reward         DECIMAL(10,2)","deadline       DATETIME","place          VARCHAR(100)",
    "urgency        TINYINT","status         TINYINT","created_at     DATETIME"]),
 "APPLICATION 接单申请": (390,["application_id BIGINT    PK","task_id        BIGINT    FK",
    "applicant_id   BIGINT    FK","message        VARCHAR(255)","status         TINYINT",
    "applied_at     DATETIME","handled_at     DATETIME"]),
 "ORDERS 订单": (330,["order_id       BIGINT    PK","order_no       VARCHAR(32)  UQ",
    "task_id        BIGINT    FK,UQ","publisher_id   BIGINT    FK","taker_id       BIGINT    FK",
    "amount         DECIMAL(10,2)","status         TINYINT","accepted_at    DATETIME","finished_at    DATETIME"]),
 "TRANSACTION 资金流水": (390,["txn_id         BIGINT    PK","wallet_id      BIGINT    FK",
    "order_id       BIGINT    FK","type           TINYINT","amount         DECIMAL(12,2)",
    "balance_after  DECIMAL(12,2)","created_at     DATETIME"]),
 "MESSAGE 站内消息": (330,["message_id     BIGINT    PK","order_id       BIGINT    FK",
    "sender_id      BIGINT    FK","receiver_id    BIGINT    FK","content        VARCHAR(500)",
    "is_read        TINYINT","sent_at        DATETIME"]),
 "REVIEW 评价": (330,["review_id      BIGINT    PK","order_id       BIGINT    FK,UQ",
    "reviewer_id    BIGINT    FK","reviewee_id    BIGINT    FK","score          TINYINT",
    "content        VARCHAR(500)","created_at     DATETIME"]),
}

# ================= 手工核对过的网格坐标（箱体中心） =================
# 列心 x：260 / 890 / 1520 / 2050   —— 第4列给 TRANSACTION/MESSAGE
GEO = {
 # 顶行 y=300
 "CATEGORY 委托分类":    (260,  300, 1),
 "ORDERS 订单":          (890,  300, 2),
 "MESSAGE 站内消息":     (1520, 300, 3),
 # 中行 y=900
 "USER 用户":            (260,  900, 1),
 "TASK 委托任务":        (890,  900, 2),
 "REVIEW 评价":          (1520, 900, 3),
 "TRANSACTION 资金流水": (2050, 900, 4),
 # 底行 y=1500
 "WALLET 钱包":          (260, 1500, 1),
 "APPLICATION 接单申请": (890, 1500, 2),
}
def tw(d,t,f):
    b=d.textbbox((0,0),t,font=f); return b[2]-b[0],b[3]-b[1]
def boxh(n): return HD + ROW*n + PAD
def dot(d,p): d.ellipse([p[0]-4,p[1]-4,p[0]+4,p[1]+4], fill=LINE)

def _tick(d,p,u,off):
    cx,cy=p[0]+off*u[0], p[1]+off*u[1]; n=(-u[1],u[0])
    d.line([(cx-13*n[0],cy-13*n[1]),(cx+13*n[0],cy+13*n[1])], fill=LINE, width=3)
def _circ(d,p,u,off,r=7):
    cx,cy=p[0]+off*u[0], p[1]+off*u[1]
    d.ellipse([cx-r,cy-r,cx+r,cy+r], fill=BG, outline=LINE, width=3)
def _crow(d,p,u,size=16):
    a0=math.atan2(u[1],u[0])
    for s in (-0.55,0.0,0.55):
        a=a0+s
        d.line([p,(p[0]+size*math.cos(a),p[1]+size*math.sin(a))], fill=LINE, width=3)
def end_mark(d,p,u,kind):
    if kind=='one':       _tick(d,p,u,14); _tick(d,p,u,28)
    elif kind=='opt1':    _circ(d,p,u,15); _tick(d,p,u,31)
    elif kind=='many':    _crow(d,p,u);    _tick(d,p,u,23)
    elif kind=='optmany': _crow(d,p,u);    _circ(d,p,u,23)

def connect(d, pts, sk, ek, label=None, lab_pos=None):
    for i in range(len(pts)-1):
        d.line([pts[i],pts[i+1]], fill=LINE, width=3)
    def unit(a,b):
        v=(a[0]-b[0],a[1]-b[1]); n=math.hypot(*v) or 1; return (v[0]/n, v[1]/n)
    if sk: end_mark(d,pts[0],unit(pts[0],pts[1]),sk)
    if ek: end_mark(d,pts[-1],unit(pts[-1],pts[-2]),ek)
    for p in pts: dot(d,p)
    if label and lab_pos:
        b=d.textbbox((0,0),label,font=F_REL); bw,bh=b[2]-b[0],b[3]-b[1]
        x,y=lab_pos
        d.rectangle([x-bw/2-7,y-bh/2-5,x+bw/2+7,y+bh/2+7], fill=BG)
        d.text((x-bw/2,y-bh/2-1), label, font=F_REL, fill=CARD)

def fig(path):
    W,H = 2420, 2200
    img=Image.new("RGB",(W,H),BG); d=ImageDraw.Draw(img)
    d.text((44,22), "图1  校园委托系统 E-R 图（新画法：Crow's Foot / IE 记法）", font=F_TITLE, fill=INK)
    d.text((44,78), "矩形 = 实体，属性直接列于框内；PK = 主键，FK = 外键，UQ = 唯一约束；"
                    "实体间连线表示关系，两端鸦爪符号表示基数", font=F_SUB, fill=(90,100,120))

    R={}
    for name,(cx,cy,_) in GEO.items():
        w,cols=TB[name]; h=boxh(len(cols)); x,yy=cx-w/2, cy-h/2
        d.rectangle([x,yy,x+w,yy+h], fill=ENT_BG, outline=ENT_HD, width=3)
        d.rectangle([x,yy,x+w,yy+HD], fill=ENT_HD)
        d.text((cx-tw(d,name,F_ENT)[0]/2, yy+6), name, font=F_ENT, fill=(255,255,255))
        yy2=yy+HD+4
        for cc in cols:
            if "PK" in cc: d.rectangle([x+4,yy2-2,x+w-4,yy2+ROW-6], fill=PK_BG)
            col=(150,40,40) if "PK" in cc else ((20,90,160) if "FK" in cc else (40,48,60))
            d.text((x+12,yy2), cc, font=F_COL, fill=col)
            yy2+=ROW
        R[name]=(x,yy,x+w,yy+h)

    def A(n,side,off=0):
        x1,y1,x2,y2=R[n]
        return {"L":(x1,(y1+y2)/2+off),"R":(x2,(y1+y2)/2+off),
                "T":((x1+x2)/2+off,y1),"B":((x1+x2)/2+off,y2)}[side]
    def MB(n): return (R[n][0]+R[n][2])/2
    def MC(n): return (R[n][1]+R[n][3])/2

    # 中行：USER — TASK — REVIEW 水平关系
    connect(d,[A("USER 用户","R"), A("TASK 委托任务","L")], "one","optmany",
            "发布 1:N", ((A('USER 用户','R')[0]+A('TASK 委托任务','L')[0])/2, 900-118))
    connect(d,[A("TASK 委托任务","R"), A("TRANSACTION 资金流水","L")], "one","optmany",
            "关联流水 1:N", (A('TASK 委托任务','R')[0]+150, 900-118))

    # 顶行 → TASK：CATEGORY 下行接入 TASK 左上
    connect(d,[A("CATEGORY 委托分类","B"), A("TASK 委托任务","T",-130)], "one","optmany",
            "所属分类 1:N", (MB("CATEGORY 委托分类")-40, (A('CATEGORY 委托分类','B')[1]+A('TASK 委托任务','T')[1])/2))
    # ORDERS 上行接入 TASK：ORDERS 在 TASK 正上方，直连
    connect(d,[A("ORDERS 订单","B"), A("TASK 委托任务","T", 130)], "one","one",
            "成交 1:1", (MB("ORDERS 订单")+118, (A('ORDERS 订单','B')[1]+A('TASK 委托任务','T')[1])/2))

    # TASK → APPLICATION：经右通道 CH2 下行（避开 ORDERS）
    CH2 = 1160
    connect(d,[A("TASK 委托任务","R", 60), (CH2, A("TASK 委托任务","R",60)[1]),
               (CH2, MC("APPLICATION 接单申请")), A("APPLICATION 接单申请","R")], "one","optmany",
            "收到申请 1:N", (CH2+10, MC("APPLICATION 接单申请")-128))
    # USER → WALLET：竖直同列
    connect(d,[A("USER 用户","B"), A("WALLET 钱包","T")], "one","opt1",
            "拥有 1:1", (MB("USER 用户")-112, (A('USER 用户','B')[1]+A('WALLET 钱包','T')[1])/2))
    # ORDERS → REVIEW / MESSAGE：ORDERS 在顶行中列，REVIEW 在中行右列，MESSAGE 在顶行右列
    connect(d,[A("MESSAGE 站内消息","L"), A("ORDERS 订单","R",-110)], "one","optmany",
            "订单沟通 1:N", ((A('MESSAGE 站内消息','L')[0]+A('ORDERS 订单','R')[0])/2, 300-110))
    CH3 = 1900
    connect(d,[A("REVIEW 评价","T"), (MB("REVIEW 评价"), 300+150), (CH3, 300+150),
               (CH3, A("ORDERS 订单","R",110)[1]), A("ORDERS 订单","R",110)], "one","opt1",
            "产生评价 1:1", (CH3-10, 300+150))

    # ---------------- 图例 ----------------
    lx,ly = 44, 1880
    d.rectangle([lx,ly,lx+2330,ly+280], fill=(248,250,253), outline=(200,210,225), width=2)
    d.text((lx+22,ly+14), "一、基数符号（Crow's Foot 记法）", font=F_ENT, fill=INK)
    sy=ly+72
    def sample(x,kind,cap,desc):
        p1=(x,sy); p2=(x+80,sy)
        d.line([p1,p2],fill=LINE,width=3); end_mark(d,p2,(1,0),kind)
        d.text((x+8,sy+18),cap,font=F_REL,fill=CARD)
        d.text((x+70,sy+18),desc,font=F_LEG,fill=(40,48,60))
    sample(lx+40,"one","||","一（强制）")
    sample(lx+360,"opt1","|o","零或一（可选）")
    sample(lx+680,"many","}|","一或多（强制）")
    sample(lx+1000,"optmany","}o","零或多（可选）")
    d.text((lx+1400,ly+72), "符号贴近实体一侧表示该实体在关系中的参与数量", font=F_LEG, fill=(90,100,120))

    d.text((lx+22,ly+150), "二、关系一览（业务读法）", font=F_ENT, fill=INK)
    left=["USER ||--o{ TASK          一个用户发布零或多个委托；一个委托只由一个用户发布",
          "TASK ||--|| ORDERS        一个委托成交后产生唯一订单（1:1，orders.task_id 唯一）",
          "USER ||--o| WALLET        一个用户拥有零或一个钱包（1:1，wallet.user_id 唯一）",
          "TASK ||--o{ APPLICATION   一个委托收到零或多条接单申请"]
    right=["ORDERS ||--o| REVIEW      一个订单产生零或一条评价（1:1，review.order_id 唯一）",
           "ORDERS ||--o{ MESSAGE     一个订单内有零或多条沟通消息",
           "CATEGORY ||--o{ TASK      一个分类下有零或多个委托",
           "WALLET ||--o{ TRANSACTION 一个钱包产生零或多条资金流水"]
    yy=ly+192
    for a,b in zip(left,right):
        d.text((lx+30,yy), a, font=F_LEG, fill=(40,48,60))
        d.text((lx+1180,yy), b, font=F_LEG, fill=(40,48,60))
        yy+=28
    d.text((lx+30,yy+6), "多对多处理：USER 与 TASK 之间的「申请接单」为 M:N，经中间表 APPLICATION 拆解为两个 1:N 关系。",
           font=F_LEG, fill=(176,58,58))

    img.save(path); print("saved", path, img.size)

fig(os.path.join(OUT,"03_图1_ER图.png"))
print("DONE")
