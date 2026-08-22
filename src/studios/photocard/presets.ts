export type PhotocardPreset = {
  id: string
  label: string
  widthMm: number
  heightMm: number
  bleedMm: number
  windowWidthMm: number
  windowHeightMm: number
  windowTopOffsetMm: number
  defaultRadiusMm: number
  description: string
}

export type FrameType = 'polaroid-white' | 'polaroid-black' | 'full-bleed' | 'vintage-film'

export const PHOTOCARD_PRESETS: PhotocardPreset[] = [
  {
    id: 'mini-polaroid',
    label: '富士 Mini 拍立得 (54×86mm)',
    widthMm: 54,
    heightMm: 86,
    bleedMm: 1.5,
    windowWidthMm: 46,
    windowHeightMm: 62,
    windowTopOffsetMm: 6,
    defaultRadiusMm: 2,
    description: '最经典的拍立得相纸比例，底部留宽框支持签名与日期戳',
  },
  {
    id: 'square-polaroid',
    label: '方形拍立得 (72×86mm)',
    widthMm: 72,
    heightMm: 86,
    bleedMm: 1.5,
    windowWidthMm: 62,
    windowHeightMm: 62,
    windowTopOffsetMm: 6,
    defaultRadiusMm: 2,
    description: '正方形画心相框，适合大头照、头像与插画',
  },
  {
    id: 'kpop-card',
    label: '标准追星/收藏小卡 (54×85mm)',
    widthMm: 54,
    heightMm: 85,
    bleedMm: 1.5,
    windowWidthMm: 54,
    windowHeightMm: 85,
    windowTopOffsetMm: 0,
    defaultRadiusMm: 3,
    description: '谷圈与韩流标准卡牌尺寸，满版无白边与 R3 冲切圆角',
  },
  {
    id: 'wide-polaroid',
    label: '宽幅拍立得 (108×86mm)',
    widthMm: 108,
    heightMm: 86,
    bleedMm: 1.5,
    windowWidthMm: 99,
    windowHeightMm: 62,
    windowTopOffsetMm: 6,
    defaultRadiusMm: 2,
    description: '横向双人/多人合影与全景插画拍立得',
  },
]

export const FRAME_OPTIONS: Array<{ id: FrameType; label: string; icon: string }> = [
  { id: 'polaroid-white', label: '经典纯白框', icon: '◻️' },
  { id: 'polaroid-black', label: '复古纯黑框', icon: '◼️' },
  { id: 'full-bleed', label: '满版无白边', icon: '🎴' },
  { id: 'vintage-film', label: '胶片齿孔框', icon: '🎞️' },
]

export const CORNER_RADIUS_OPTIONS = [
  { value: 0, label: '直角', tag: 'R0', hint: '标准四方直角' },
  { value: 3, label: '标准圆角', tag: 'R3', hint: '经典小卡推荐' },
  { value: 5, label: '大圆角', tag: 'R5', hint: '柔和圆角' },
]
