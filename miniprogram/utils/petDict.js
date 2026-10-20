/**
 * 宠物分类与品种字典（用于添加宠物页的分类-品种联动）
 * 结构：{ label, value, breeds: [] }，breeds 末位统一追加“其他”以便扩展
 */
const PET_DICT = [
  {
    label: '犬类',
    value: 'dog',
    breeds: ['金毛寻回犬', '拉布拉多', '泰迪/贵宾', '柯基', '哈士奇', '萨摩耶', '边境牧羊犬', '博美', '中华田园犬', '比熊', '雪纳瑞', '法国斗牛犬', '吉娃娃', '约克夏', '阿拉斯加', '德国牧羊犬', '其他']
  },
  {
    label: '猫类',
    value: 'cat',
    breeds: ['英国短毛猫', '美国短毛猫', '布偶猫', '暹罗猫', '波斯猫', '橘猫', '中华田园猫', '缅因猫', '无毛猫', '俄罗斯蓝猫', '异国短毛猫', '苏格兰折耳', '孟买猫', '其他']
  },
  {
    label: '鸟类',
    value: 'bird',
    breeds: ['虎皮鹦鹉', '玄凤鹦鹉', '牡丹鹦鹉', '文鸟', '八哥', '画眉', '金丝雀', '和尚鹦鹉', '非洲灰鹦鹉', '其他']
  },
  {
    label: '鼠类',
    value: 'rodent',
    breeds: ['金丝熊', '三线仓鼠', '一线仓鼠', '荷兰猪（豚鼠）', '龙猫', '花枝鼠', '小白鼠', '其他']
  },
  {
    label: '兔类',
    value: 'rabbit',
    breeds: ['垂耳兔', '侏儒兔', '安哥拉兔', '狮子头兔', '荷兰垂耳兔', '新西兰兔', '其他']
  },
  {
    label: '爬行类',
    value: 'reptile',
    breeds: ['巴西龟', '缅甸陆龟', '豹纹守宫', '绿鬣蜥', '草龟', '玉米蛇', '球蟒', '苏卡达陆龟', '其他']
  },
  {
    label: '两栖类',
    value: 'amphibian',
    breeds: ['角蛙', '树蛙', '蝾螈', '大鲵', '其他']
  },
  {
    label: '鱼类',
    value: 'fish',
    breeds: ['金鱼', '锦鲤', '斗鱼', '孔雀鱼', '神仙鱼', '龙鱼', '热带鱼', '其他']
  },
  {
    label: '其他',
    value: 'other',
    breeds: ['其他']
  }
]

// 默认卡通头像（emoji，前端渲染用）
const DEFAULT_AVATARS = ['🐶', '🐱', '🐰', '🐹', '🐦', '🐢', '🐠', '🦎', '🐾', '🐥']

const CATEGORIES = PET_DICT.map(i => i.label)

function getBreeds(categoryLabel) {
  const found = PET_DICT.find(i => i.label === categoryLabel)
  return found ? found.breeds : []
}

module.exports = {
  PET_DICT,
  CATEGORIES,
  DEFAULT_AVATARS,
  getBreeds
}
