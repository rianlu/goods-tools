export type BadgeShape = 'round' | 'square'

export type BadgePreset = {
  id: string
  label: string
  name: string
  tag: string
  finishedDiameterMm: number
  printDiameterMm: number
  safeDiameterMm: number
  description: string
}

export const BADGE_PRESETS: BadgePreset[] = [
  {
    id: '25mm',
    label: '25mm',
    name: '25mm',
    tag: '迷你',
    finishedDiameterMm: 25,
    printDiameterMm: 31,
    safeDiameterMm: 23,
    description: '硬币大小，适合痛包密铺与小挂件点缀',
  },
  {
    id: '32mm',
    label: '32mm',
    name: '32mm',
    tag: '小巧',
    finishedDiameterMm: 32,
    printDiameterMm: 38,
    safeDiameterMm: 30,
    description: '小巧便携，适合作为配饰徽章',
  },
  {
    id: '44mm',
    label: '44mm',
    name: '44mm',
    tag: '标准中号',
    finishedDiameterMm: 44,
    printDiameterMm: 52,
    safeDiameterMm: 42,
    description: '适中尺寸，兼顾便携度与图案展示',
  },
  {
    id: '58mm',
    label: '58mm (最常见)',
    name: '58mm',
    tag: '最常见',
    finishedDiameterMm: 58,
    printDiameterMm: 70,
    safeDiameterMm: 54,
    description: '谷圈最经典通用规格，出镜率与实用性最高',
  },
  {
    id: '75mm',
    label: '75mm (大吧唧)',
    name: '75mm',
    tag: '大吧唧',
    finishedDiameterMm: 75,
    printDiameterMm: 87,
    safeDiameterMm: 71,
    description: '大尺寸大视觉，插画细节与大头照冲击力极强',
  },
]

export const SHAPE_OPTIONS: Array<{ id: BadgeShape; label: string }> = [
  { id: 'round', label: '圆形模具' },
  { id: 'square', label: '方形模具' },
]

export function previewDiameterRatio(finishedDiameterMm: number): number {
  return 0.58 + ((finishedDiameterMm - 25) / (75 - 25)) * 0.22
}
