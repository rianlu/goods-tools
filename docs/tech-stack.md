# 谷子Tools 技术方案 v1.1

> 平台: Web 优先  
> 渲染: Canvas 2D  
> 运行方式: 纯静态前端

## 1. 最小技术栈

```text
React 19 + Vite + TypeScript
├── UI 图标: lucide-react
├── 预览与导出: 原生 Canvas 2D
├── 图片输入: File API + createImageBitmap / HTMLImageElement
├── 状态: React 本地状态
├── 样式: 普通 CSS
└── 部署: 任意静态托管
```

- 使用 Canvas 2D 完成形状裁剪、区域标识、边缘弯曲暗影、镭射模拟和 PNG 导出.
- 不引入状态管理、图片编辑器、云存储或 WebGL 依赖.
- 不把商家刀模做成首版必需数据结构.
- 仅在真实设备证明 Canvas 2D 无法满足效果或性能时引入更重的渲染器.

## 2. 状态模型

使用一份状态驱动成品预览、完整图片范围和导出:

```ts
type RenderState = {
  artwork: Artwork
  transform: Transform
  baseCraft: 'none' | 'silver-glitter' | 'gold-glitter' | 'pearl'
  filmCraft: 'none' | 'glossy' | 'matte' | 'rainbow' | 'cracked-ice' | 'lattice'
  shape: 'round' | 'square'
  finishedDiameterMm: number
  printDiameterMm: number
  safeDiameterMm: number
}
```

- `shape` 决定圆形或圆角方形的预览、参考线和导出裁切.
- `baseCraft` 控制闪底层: 无闪底、银闪(细密金属晶片+十字星芒)、金闪(香槟金箔微粒)或珠光(粉青双色偏光).
- `filmCraft` 控制覆膜层: 无膜、亮膜(微弧面双反光带)、哑光(消光微磨砂)、素面镭射(连续彩虹色散)、碎冰镭射(多面水晶晶格)或方格镭射(全息棋盘光栅).
- 两层独立组合, 银闪/金闪 + 镭射覆膜 = 双闪.
- 三个尺寸值按当前形状分别表示直径或边长.
- 这三个值由用户选择的常用尺寸预设自动带入, 不要求用户填写商家参数.
- 偏移量保存为相对完整图片画布的归一化值.
- 缩放保存为相对完整图片画布覆盖范围的倍数.
- 禁止为预览和制作原图维护两份独立图片状态.

## 3. 尺寸预设

预设集中保存在 `src/geometry.ts`:

```ts
type BadgePreset = {
  id: string
  label: string
  finishedDiameterMm: number
  printDiameterMm: number
  safeDiameterMm: number
}
```

当前预设为 25mm、32mm、44mm、58mm 和 75mm. 它们是通用预览参考, 不是商家刀模. 后续增加尺寸时只需增加预设, 不需要增加渲染分支.

形状选项为圆形和圆角方形. 所有形状复用同一套尺寸预设、图片变换和导出分辨率计算.

## 4. 渲染管线

### 4.1 成品效果（五层物理分解与程序化光学渲染）

```text
中性棚拍背景 + 弥散与接触双层动态阴影
  ├── 1. 用户原画层 (Mapped Artwork)
  ├── 2. 闪底层 (Glitter Base: 确定性微粒场 + 扫光增益 + 珠光偏光)
  ├── 3. 覆膜层 (Film Craft: 彩虹色散光栅 / 水晶碎冰 / 棋盘方格 / 弧面天光)
  ├── 4. 顶层星芒 (Glitter Accents: 穿透覆膜的十字星芒与彩虹耀斑)
  └── 5. 3D 实体层 (微凸穹顶环境光 + 冲压金属包边轮廓高光 + 包边卷纸暗影)
```

- 根据 25mm 到 75mm 的成品尺寸线性调整吧唧本体在画布中的显示比例.
- 银闪/金闪底使用程序化高密度微米级粒子场，在迎光区域实时计算相位激发出 4 角/6 角十字星芒.
- 亮膜使用真实微凸穹顶计算的双层主次窗光反射带.
- 素面镭射使用基于物理色散波长的连续动态彩虹光谱流转算法.
- 碎冰镭射使用程序化多面晶格（Voronoi Shards），每个晶面具有独立的入射角法线与色相偏移.
- 双闪模式下通过分层复合算法与明度保护曲线，让闪粉既璀璨闪耀，又绝不冲淡原画色彩.
- 默认在自然静止角度呈现精致棚拍质感，开启动态预览后模拟 360° 真实转动与光影流转.

### 4.2 完整图片范围

```text
透明参考背景
  -> 完整形状图片
  -> 包边区半透明标识
  -> 成品可见边界
  -> 安全区边界
```

- 包边区是完整形状与成品可见形状之间的区域.
- 安全区只用于屏幕提示.
- 参考线和色带不写入制作原图.

### 4.3 制作原图

```text
透明画布
  -> 完整形状裁剪
  -> 用户原图
  -> 300 DPI PNG 元数据
```

- 使用 `round(printDiameterMm / 25.4 * 300)` 计算完整图片画布边长.
- 使用相同图片变换绘制完整图片形状.
- 禁止绘制边缘暗影、投影、背景、工艺效果和参考线.
- 写入 PNG `pHYs` 块, 将分辨率记录为 300 DPI.

## 5. 输入和错误边界

- 输入文件限制为 15MB.
- 工作图最长边限制为 2048px.
- 优先使用 `createImageBitmap` 解码和缩放.
- 不支持时使用 `HTMLImageElement` 和临时 Canvas.
- 替换图片和组件销毁时释放 Object URL 和 ImageBitmap.
- 对格式错误、解码失败、导出失败和内存不足给出可执行提示.

## 6. 文件结构

```text
goods-tools/
├── docs/
│   ├── feature-overview.md
│   └── tech-stack.md
├── src/
│   ├── App.tsx
│   ├── canvas.ts
│   ├── geometry.ts
│   ├── geometry.test.ts
│   ├── main.tsx
│   └── styles.css
├── index.html
├── package.json
└── vite.config.ts
```

- `geometry.ts` 只负责尺寸预设、单位换算和图片覆盖约束.
- `canvas.ts` 只负责渲染和导出.
- `App.tsx` 负责界面、手势和本地编辑状态.

## 7. 验证

- [x] Node 内置测试验证尺寸换算和图片覆盖约束.
- [x] TypeScript 类型检查通过.
- [x] Vite 生产构建通过.
- [x] 浏览器验证上传、拖动、缩放、尺寸切换、视图切换、工艺切换和双导出.
- [x] 验证效果图为 1080x1080 PNG.
- [x] 验证 58mm 默认制作原图为 827x827 PNG, 形状外透明.
- [x] 验证制作原图写入 300 DPI 元数据.
- [x] 桌面和 390x844 移动视口无重叠、溢出和画布空白.

## 8. 微信小程序迁移

仅在 Web 首版得到真实使用后执行小程序开发:

- 使用原生小程序页面和 Canvas 2D.
- 复用尺寸预设、变换规则、素材命名和验收样例.
- 分别实现文件选择、手势、Canvas 生命周期、保存相册和分享入口.
- 不直接迁移 React UI 和浏览器 Canvas 实例.
- 将效果图限制为 1080x1080.
- 将制作原图限制在真机 Canvas 能稳定处理的尺寸内.
- 仅在真机验证性能后决定是否保留动态镭射效果.
- 将本地制作原图保存到相册后交由用户发送给商家.
