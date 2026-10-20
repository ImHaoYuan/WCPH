"""
校园委托系统 —— 数据流图 DFD（通道布局定稿）
连线只走横竖、数据流经过的空白通道全部预留；标签沿线侧向偏移，绝不压框压线。

输出：
  04_图2_DFD0顶层图.png
  05_图3_DFD1发布委托.png
  06_图4_DFD2接单成交.png
  12_图7_DFD3结算评价.png
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

F_TITLE=load_font(38); F_SUB=load_font(19); F_ENT=load_font(22)
F_PROC=load_font(19); F_STORE=load_font(19); F_FLOW=load_font(17); F_NOTE=load_font(17)

BG=(255,255,255); INK=(31,56,100)
EXT_BG,EXT_BD=(253,235,235),(178,70,70)
PROC_BG,PROC_BD=(226,240,227),(60,130,70)
STORE_BG,STORE_BD=(255,248,225),(180,130,40)
LINE=(70,90,120); FLOW_TXT=(176,58,58)

def tw(d,t,f):
    b=d.textbbox((0,0),t,font=f); return b[2]-b[0],b[3]-b[1]

def wrap(d,t,f,mw):
    ls,cur=[],""
    for ch in t:
        if ch=="\n": ls.append(cur); cur=""; continue
        if tw(d,cur+ch,f)[0]<=mw: cur+=ch
        else: ls.append(cur); cur=ch
    if cur: ls.append(cur)
    return ls

def ext_entity(d,cx,cy,w,h,text):
    x,y=cx-w/2, cy-h/2
    d.rectangle([x,y,x+w,y+h], fill=EXT_BG, outline=EXT_BD, width=3)
    d.rectangle([x+7,y+7,x+w-7,y+h-7], outline=EXT_BD, width=1)
    ls=wrap(d,text,F_ENT,w-28); th=sum(tw(d,l,F_ENT)[1]+6 for l in ls); yy=cy-th/2
    for l in ls:
        d.text((cx-tw(d,l,F_ENT)[0]/2, yy), l, font=F_ENT, fill=(120,30,30)); yy+=tw(d,l,F_ENT)[1]+6

def process(d,cx,cy,r,num,text):
    d.ellipse([cx-r,cy-r,cx+r,cy+r], fill=PROC_BG, outline=PROC_BD, width=3)
    d.text((cx-r+12, cy-r+8), num, font=F_FLOW, fill=(40,100,50))
    ls=wrap(d,text,F_PROC,int(r*1.55)); th=sum(tw(d,l,F_PROC)[1]+6 for l in ls); yy=cy-th/2+6
    for l in ls:
        d.text((cx-tw(d,l,F_PROC)[0]/2, yy), l, font=F_PROC, fill=(20,60,30)); yy+=tw(d,l,F_PROC)[1]+6

def store(d,cx,cy,w,h,sid,text):
    x,y=cx-w/2, cy-h/2
    d.rectangle([x,y,x+w,y+h], fill=STORE_BG, outline=STORE_BD, width=3)
    d.line([x+62,y,x+62,y+h], fill=STORE_BD, width=3)
    d.text((x+18, cy-12), sid, font=F_STORE, fill=(150,100,20))
    ls=wrap(d,text,F_STORE,w-84); th=sum(tw(d,l,F_STORE)[1]+5 for l in ls); yy=cy-th/2
    for l in ls:
        d.text((x+74, yy), l, font=F_STORE, fill=(60,50,20)); yy+=tw(d,l,F_STORE)[1]+5

def arrow_line(d,p1,p2,color=LINE,w=3):
    d.line([p1,p2], fill=color, width=w)
    ang=math.atan2(p2[1]-p1[1], p2[0]-p1[0]); L,sp=15,0.42
    d.polygon([p2,(p2[0]-L*math.cos(ang-sp),p2[1]-L*math.sin(ang-sp)),
                  (p2[0]-L*math.cos(ang+sp),p2[1]-L*math.sin(ang+sp))], fill=color)

def label(d,text,x,y):
    bw,bh=tw(d,text,F_FLOW)
    d.rectangle([x-7,y-5,x+bw+7,y+bh+7], fill=BG)
    d.text((x,y), text, font=F_FLOW, fill=FLOW_TXT)

def along(d,p1,p2,text,t=0.5,side=-1,off=26):
    """沿 p1->p2 在 t 位置放标签，side 选一侧，off 为垂直距离"""
    arrow_line(d,p1,p2)
    if not text: return
    bw,bh=tw(d,text,F_FLOW)
    mx,my=p1[0]+(p2[0]-p1[0])*t, p1[1]+(p2[1]-p1[1])*t
    dx,dy=p2[0]-p1[0], p2[1]-p1[1]; n=math.hypot(dx,dy) or 1
    nx,ny=-dy/n, dx/n              # 单位法向
    label(d,text, mx+nx*off*side-bw/2, my+ny*off*side-bh/2)

def d2line(px,py,p1,p2):
    """点 (px,py) 到直线 p1-p2 的垂直距离"""
    dx,dy=p2[0]-p1[0], p2[1]-p1[1]; n=math.hypot(dx,dy) or 1
    return abs((px-p1[0])*dy-(py-p1[1])*dx)/n

def elbow(d,pts,text=None,seg=0,side=-1,off=26,t=0.5):
    for i in range(len(pts)-1):
        d.line([pts[i],pts[i+1]], fill=LINE, width=3)
    arrow_line(d, pts[-2], pts[-1])
    if text:
        p1,p2=pts[seg],pts[seg+1]
        along_label_only(d,p1,p2,text,t,side,off)

def along_label_only(d,p1,p2,text,t,side,off):
    bw,bh=tw(d,text,F_FLOW)
    mx,my=p1[0]+(p2[0]-p1[0])*t, p1[1]+(p2[1]-p1[1])*t
    dx,dy=p2[0]-p1[0], p2[1]-p1[1]; n=math.hypot(dx,dy) or 1
    nx,ny=-dy/n, dx/n
    label(d,text, mx+nx*off*side-bw/2, my+ny*off*side-bh/2)

def dfd_shell(path,title,sub,W,H):
    img=Image.new("RGB",(W,H),BG); d=ImageDraw.Draw(img)
    d.text((40,22),title,font=F_TITLE,fill=INK)
    d.text((40,72),sub,font=F_SUB,fill=(90,100,120))
    return img,d

def note(d,x,y,text,color=(120,128,145)):
    ls=wrap(d,text,F_NOTE,2000); yy=y
    for l in ls:
        d.text((x,yy), l, font=F_NOTE, fill=color); yy+=24

# ==================================================== 图2  DFD-0 顶层图
def dfd0(path):
    W,H=2160,1000
    img,d=dfd_shell(path,"图2  数据流图 DFD-0（顶层图 / 上下文图）",
        "把「校园委托管理系统」视为一个整体加工（0 号），只表示系统边界与对外数据流",W,H)
    CX,CY,R = 1090, 470, 185
    process(d,CX,CY,R,"0","校园委托\n管理系统")
    ext_entity(d, 330, 360, 320, 140, "用户\n（学生 / 委托方 / 接单方）")
    ext_entity(d, 1850, 230, 300, 130, "支付平台")
    ext_entity(d, 1850, 720, 300, 130, "管理员")
    LW=CX-R

    arrow_line(d,(490,380),(LW,380)); label(d,"委托信息 / 接单申请", 610, 350)
    arrow_line(d,(LW,425),(490,425)); label(d,"委托列表 / 订单结果", 610, 440)
    arrow_line(d,(1196,323),(1700,230)); label(d,"支付 / 提现请求", 1330, 296)
    arrow_line(d,(1700,290),(1181,419)); label(d,"支付结果回调", 1520, 300)
    elbow(d, [(1090,665),(1300,720),(1700,720)], "统计数据 / 违规记录", seg=1, side=-1, off=24)
    elbow(d, [(1700,780),(1300,780),(1184,607)], "审核 / 封禁指令", seg=1, side=1, off=16)

    note(d,40,H-72,"读法：箭头方向即数据流向，标签写在线的一侧。用户提交委托信息与接单申请；系统回推委托列表与订单结果；"
                   "系统向支付平台发起支付/提现请求并接收回调；向管理员输出统计数据，接收审核与封禁指令。")
    img.save(path); print("saved",path,img.size)

# ==================================================== 图3  DFD-1 发布委托
def dfd1(path):
    W,H=2120,1420
    img,d=dfd_shell(path,"图3  数据流图 DFD-1（第 1 层：发布委托）",
        "细化「发布委托」：校验 → 落库 → 组装待接单列表，并标出所读写的三个数据存储",W,H)

    ext_entity(d, 300, 260, 300, 116, "用户（委托方）")
    process(d, 820, 260, 106, "1.1", "校验身份\n与委托内容")
    process(d, 820, 660, 106, "1.2", "保存委托\n并计悬赏")
    process(d, 820, 1030, 106, "1.3", "生成待接单\n列表")
    ext_entity(d, 820, 1300, 320, 100, "接单方")

    store(d, 1600, 300, 440, 94, "D1", "user 用户表")
    store(d, 1600, 660, 440, 94, "D2", "category 委托分类表")
    store(d, 1600, 1030, 440, 94, "D3", "task 委托任务表")

    along(d,(460,230),(716,230),"委托内容 / 悬赏 / 截止时间", t=0.5, side=-1, off=24)
    along(d,(716,294),(460,294),"校验结果 / 错误提示",       t=0.5, side=1,  off=12)
    # 1.1 <-> D1（两条水平线：上行去、下行回）
    along(d,(1380,275),(924,275),"查询账号状态 / 信用分", t=0.5, side=-1, off=22)
    along(d,(924,330),(1380,330),"身份校验结果",         t=0.5, side=1,  off=12)
    # 1.1 -> 1.2
    along(d,(820,366),(820,554),"校验通过的委托数据", t=0.5, side=1, off=14)
    # D2 -> 1.2
    along(d,(1380,660),(926,660),"读取分类信息", t=0.5, side=-1, off=22)
    # 1.2 -> D3
    along(d,(926,712),(1380,712),"写入委托记录并回填 task_id", t=0.5, side=1, off=12)
    # 1.2 -> 1.3
    along(d,(820,766),(820,924),"已保存的委托", t=0.5, side=1, off=14)
    # D3 -> 1.3
    along(d,(1380,1030),(926,1030),"按分类归集待接单委托", t=0.5, side=-1, off=22)
    # 1.3 -> 接单方
    along(d,(820,1136),(820,1250),"待接单委托列表", t=0.5, side=1, off=14)

    note(d,40,H-58,"说明：1.1 校验分类是否存在、悬赏金额是否大于 0、截止时间是否已过期；1.2 落库并回填 task_id；"
                   "1.3 按分类归集后推送待接单列表给接单方浏览。")
    img.save(path); print("saved",path,img.size)

# ==================================================== 图4  DFD-2 接单成交
def dfd2(path):
    W,H=2320,1660
    img,d=dfd_shell(path,"图4  数据流图 DFD-1（第 1 层：申请接单与订单成交）",
        "细化「接单成交」：受理申请 → 委托方确认 → 生成订单并托管资金",W,H)

    ext_entity(d, 300, 560, 320, 140, "接单方\n（申请接单）")
    process(d, 940, 560, 108, "2.1", "受理接单\n申请")
    process(d, 1540, 860, 108, "2.2", "委托方\n确认接单")
    process(d, 1540, 1220, 108, "2.3", "生成订单\n并托管资金")
    ext_entity(d, 300, 1220, 320, 140, "委托方\n（确认与付款）")
    ext_entity(d, 1900, 620, 300, 140, "支付平台")

    store(d, 940, 200, 440, 94, "D4", "application 接单申请表")
    store(d, 1900, 210, 400, 94, "D3", "task 委托任务表")
    store(d, 2100, 1000, 400, 94, "D5", "orders 订单表")
    store(d, 940, 1470, 440, 94, "D6", "wallet 钱包表")

    # 接单方 -> 2.1
    along(d,(460,530),(832,530),"接单申请 / 留言", t=0.5, side=-1, off=24)
    # 2.1 <-> D5（竖直上行）
    along(d,(940,452),(940,247),"写入申请记录", t=0.5, side=1, off=16)
    # 2.1 -> 2.2（斜向，指向 2.2 左上）
    along(d,(1046,590),(1448,800),"受理通过的申请", t=0.5, side=-1, off=24)
    # 2.2 <-> D3（上行折线：先上，再右，进入 D3 底部）
    elbow(d, [(1540,752),(1540,430),(1760,430),(1760,260)],
          "读取委托与悬赏", seg=0, side=1, off=16)
    # 2.2 -> 2.3
    along(d,(1540,968),(1540,1112),"接受指令 → 委托状态置为进行中", t=0.5, side=1, off=16)
    # 2.3 -> 委托方
    along(d,(300,1180),(1432,1180),"确认完成 / 付款指令", t=0.5, side=-1, off=24)
    # 2.3 <-> D6（折线：右行再上到 D6 底部）
    elbow(d, [(1648,1260),(2100,1260),(2100,1047)],
          "生成订单记录", seg=0, side=-1, off=24)
    # 2.3 <-> 支付平台（上线去、下线回；标签用点到线距离校验，确保远离另一条线）
    P1=(1620,1150); P2=(1780,680)
    R1=(1850,690);  R2=(1700,1150)
    arrow_line(d,P1,P2); arrow_line(d,R1,R2)
    lx,ly = 1690, 1060
    print("   check 请求冻结资金 到回程线距离:", round(d2line(lx,ly,R1,R2),1),
          " 到 2.2 圆心距离:", round(math.hypot(lx-1540,ly-860),1))
    label(d,"请求冻结资金", lx, ly)
    lx,ly = 1905, 1080
    print("   check 冻结成功回调 到去程线距离:", round(d2line(lx,ly,P1,P2),1))
    label(d,"冻结成功回调", lx, ly)
    # 2.3 -> D4（折线：左行再下）
    elbow(d, [(1432,1290),(940,1290),(940,1423)],
          "扣减余额 / 计入冻结", seg=1, side=1, off=16)

    note(d,40,H-58,"说明：application.status 置为「已接受」与 orders 记录生成必须在同一事务中完成；"
                   "资金先在 wallet.frozen 冻结，订单完成后再结算，全部变动写入 transaction 流水表。")
    img.save(path); print("saved",path,img.size)

# ==================================================== 图7  DFD-3 结算评价
def dfd3(path):
    W,H=2320,1500
    img,d=dfd_shell(path,"图7  数据流图 DFD-1（第 1 层：结算、评价与消息）",
        "细化订单完成后的收尾：确认完成 → 资金解冻结算 → 双方互评与站内消息",W,H)

    ext_entity(d, 300, 620, 320, 140, "委托方")
    process(d, 940, 620, 108, "3.1", "订单完成\n确认")
    process(d, 940, 1060, 108, "3.2", "资金解冻\n与结算")
    ext_entity(d, 300, 1060, 320, 140, "接单方")
    ext_entity(d, 1900, 700, 300, 140, "支付平台")

    store(d, 940, 250, 440, 94, "D5", "orders 订单表")
    store(d, 1900, 380, 400, 94, "D6", "wallet 钱包表")
    store(d, 1900, 1180, 400, 94, "D7", "transaction 资金流水表")
    store(d, 940, 1420, 440, 94, "D9", "review 评价表")

    # 委托方 -> 3.1
    along(d,(460,590),(832,590),"完成确认", t=0.5, side=-1, off=24)
    # 3.1 <-> D6
    along(d,(940,512),(940,297),"更新订单状态 = 已完成", t=0.5, side=1, off=16)
    # 3.1 -> 3.2
    along(d,(940,728),(940,952),"触发资金结算", t=0.5, side=1, off=16)
    # 3.2 <-> D7（折线：右行至通道 x=1680 再上行；通道避开 D7 左边缘 1700）
    elbow(d, [(1048,1010),(1680,1010),(1680,427)],
          "解冻 frozen → balance", seg=1, side=1, off=20)
    # 3.2 -> D8
    elbow(d, [(1048,1090),(1450,1090),(1900,1133)],
          "写入结算流水（D7）", seg=0, side=-1, off=22)
    # 3.2 <-> 支付平台
    along(d,(1040,1000),(1790,760),"提现 / 打款请求", t=0.5, side=-1, off=22)
    along(d,(1830,770),(1050,1050),"打款结果回调", t=0.5, side=1, off=16)
    # 3.1 -> D5（评价表，折线：左行再下）
    elbow(d, [(832,650),(620,650),(620,1420)],
          "生成可评价记录（双方各一条）", seg=1, side=1, off=16)

    note(d,40,H-58,"说明：结算完成后订单置为「已完成」，委托方与接单方可各提交一条评价（D5），"
                   "评价结果回写 user.credit_score；订单内沟通消息保存在 message 表。")
    img.save(path); print("saved",path,img.size)

dfd0(os.path.join(OUT,"04_图2_DFD0顶层图.png"))
dfd1(os.path.join(OUT,"05_图3_DFD1发布委托.png"))
dfd2(os.path.join(OUT,"06_图4_DFD2接单成交.png"))
dfd3(os.path.join(OUT,"12_图7_DFD3结算评价.png"))
print("ALL DONE")
