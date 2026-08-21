# Goods-Tools (谷子周边工具箱) 技术方案 v1.2

> 运行环境: 纯静态前端 (零后端、零外部着色依赖)  
> 核心引擎: HTML5 2D Canvas 程序化光学着色管线  
> 技术架构: React 19 + TypeScript + Vite 8  

---

## 1. 架构定位与设计原则

Goods-Tools 采用**模块化独立打样工作台 (Studios)** 与 **通用底层渲染管线 (Core Pipeline)** 解耦的架构体系：

```text
goods-tools/
├── Core Platform (通用底座)
│   ├── Canvas 2D 程序化光学着色引擎 (闪底、镭射、高光、色散、阴影)
│   ├── 工业尺寸计算引擎 (300 DPI 物理尺寸、出血位、安全区)
│   ├── 视口控制系统 (多端自适应比例尺、防误触平移、手势锁定)
│   └── 本地数据与隐私沙箱 (零上云、内存级对象生命周期管理)
│
└── Studios (品类打样工作室)
    ├── 🧷 Badge Studio (马口铁徽章打样台) —— 【已就绪】
    ├── 🎨 Shikishi Studio (金边/烫金色纸打样台) —— 【规划中】
    ├── 📸 Photocard Studio (拍立得/小卡打样台) —— 【规划中】
    ├── 🎟️ Ticket Studio (透卡/镭射票打样台) —— 【规划中】
    └── 🪆 Acrylic Studio (亚克力立牌/挂件打样台) —— 【规划中】
```

---

## 2. 状态模型 (Badge Studio)

```ts
export type BaseCraft =
  | 'none'
  | 'fine-silver'
  | 'silver-glitter'
  | 'brushed-silver'
  | 'sand-glitter'
  | 'gold-glitter'
  | 'pearl'

export type FilmCraft =
  | 'none'
  | 'glossy'
  | 'matte'
  | 'rainbow'
  | 'cracked-ice'
  | 'cross'

export type BadgeShape = 'round' | 'square'

export type Transform = {
  scale: number
  offsetX: number
  offsetY: number
}

export type EditorState = {
  artwork: Artwork | null
  transform: Transform
  baseCraft: BaseCraft
  filmCraft: FilmCraft
  shape: BadgeShape
  finishedDiameterMm: number
  printDiameterMm: number
  safeDiameterMm: number
}
```

- **单向数据流**：单一 `EditorState` 驱动效果图渲染、包边图渲染与 300 DPI 原图导出，杜绝状态不一致；
- **归一化变换**：`offsetX` 和 `offsetY` 存储相对画框的归一化百分比，缩放 `scale` 存储基于边界覆盖的倍率。

---

## 3. 核心光学渲染管线

### 3.1 五层程序化光学合成（成品预览）

```text
中性棚拍背景 + 接触与弥散双层地面投影
  ├── 1. 用户原画层 (Mapped Artwork)
  ├── 2. 闪底层 (Glitter Base: 确定性微粒场 + 局部扫光增益 + 珠光双色偏光)
  ├── 3. 覆膜层 (Film Craft: 物理波长彩虹色散 / 多面水晶折射 / 十字星芒 / 弧面天光)
  ├── 4. 穿透星芒层 (Glitter Accents: 穿透覆膜的高亮星芒微粒)
  └── 5. 3D 实体层 (微凸穹顶环境光 + 冲压金属包边轮廓高光 + 包边卷纸暗影)
```

- **确定性粒子场**：通过伪随机哈希算法生成固定的微米级晶片位置与朝向，保证无论如何缩放或转动，闪粉颗粒位置绝对稳定；
- **物理色散光谱**：素面镭射膜基于可见光波长（380nm~750nm）实现连续平滑色散，随光照角流转；
- **多面水晶晶格**：碎玻璃镭射膜采用程序化多边形晶格，各晶面依据独立入射角法线计算折射色相；
- **明度与对比度保护**：双闪复合模式下采用非线性色彩混合曲线，在暗部保持黑场深邃，仅在亮部和边缘激发高光。

### 3.2 300 DPI 印刷原图输出管线

```text
透明画布 (Pixel Size = round(printDiameterMm / 25.4 * 300))
  -> 完整形状几何裁切 (圆形 / 圆角方形)
  -> 渲染变换后的用户原画 (无损高保真绘制)
  -> 注入 PNG pHYs 数据块 (记录 300 DPI 分辨率元数据)
  -> 触发浏览器端无损下载
```

---

## 4. 质量保障与自动化验证

- **单元测试**：使用 Node.js 原生测试器（`node:test`）对 `geometry.ts` 中的 300 DPI 换算公式、包边公差、安全区计算与图片覆盖约束进行 100% 自动化测试；
- **类型系统**：严格 TypeScript 模式（`tsc --noEmit`），零类型推断错误；
- **自动化截图与视觉测试**：内置基于 Playwright 的自动化无头截图工作流，自动验证桌面端、移动端与模态弹窗的视觉表现。

---

## 5. 开源与后续规划

- 推进品类扩展：按计划逐步引入金边色纸、拍立得、透卡等模块；
- 保持纯前端架构：坚持 100% 浏览器端本地渲染，不引入后端存储，保持轻量高效与用户隐私安全。
