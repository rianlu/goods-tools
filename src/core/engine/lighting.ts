/**
 * 通用 3D 物理光照计算与各品类特化把玩动效引擎
 */

export type LightingVector = {
  lx: number
  ly: number
  lz: number
  specularBoost: number
  shadowOffsetX: number
  shadowOffsetY: number
}

/**
 * 根据倾斜角度计算光源法线与动态投影偏置
 */
export function computeLighting(tiltX = 0, tiltY = 0): LightingVector {
  const lx = tiltX * 0.85
  const ly = -0.55 + tiltY * 0.75
  const lz = Math.sqrt(Math.max(0.1, 1 - (lx * lx + ly * ly) * 0.5))
  const distFromCenter = Math.hypot(tiltX, tiltY)
  const specularBoost = Math.max(0.1, 1.2 - distFromCenter * 0.6)

  return {
    lx,
    ly,
    lz,
    specularBoost,
    shadowOffsetX: tiltX * 32,
    shadowOffsetY: 18 + tiltY * 24,
  }
}

/**
 * 🧷 吧唧专属：♾️ 经典无穷大/8字形物理空间环绕把玩轨迹 (Lemniscate 1:2)
 */
export function computeBadgeOrbit(timeMs: number, speed = 0.0016) {
  const angle = timeMs * speed
  // ♾️ 8字形轨迹：X 为 sin(t)，Y 为 sin(2t) * 0.55
  const tiltX = Math.sin(angle) * 0.85
  const tiltY = Math.sin(angle * 2) * 0.55
  const phase = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)

  return {
    tiltX,
    tiltY,
    phase,
  }
}

/**
 * 📸 拍立得/小卡专属：3D 连续空间翻转动效 (Continuous 3D Card Flip 0° ~ 360°)
 */
export function computePhotocardFlip(timeMs: number, speed = 0.0012) {
  const angle = (timeMs * speed) % (Math.PI * 2)
  // 纯净垂直轴翻转，消除左右与上下晃动
  const tiltX = -Math.sin(angle) * 0.85
  const tiltY = 0.1
  return {
    flipAngle: angle,
    tiltX,
    tiltY,
    phase: angle,
  }
}


