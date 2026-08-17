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

- 使用 Canvas 2D 完成圆形裁剪、区域标识、金属效果、镭射模拟和 PNG 导出.
- 不引入状态管理、图片编辑器、云存储或 WebGL 依赖.
- 不把商家刀模做成首版必需数据结构.
- 仅在真实设备证明 Canvas 2D 无法满足效果或性能时引入更重的渲染器.

## 2. 状态模型

使用一份状态驱动成品预览、完整图片范围和导出:

```ts
type RenderState = {
  artwork: Artwork
  transform: Transform
  craft: 'plain' | 'holographic'
  finishedDiameterMm: number
  printDiameterMm: number
  safeDiameterMm: number
}
```

- `finishedDiameterMm` 表示用户最终看到的吧唧成品直径.
- `printDiameterMm` 表示包含包边区的完整图片直径.
- `safeDiameterMm` 表示建议放置主体的安全区直径.
- 这三个值由用户选择的常用尺寸预设自动带入, 不要求用户填写商家参数.
- 偏移量保存为相对完整图片圆的归一化值.
- 缩放保存为相对完整图片圆覆盖范围的倍数.
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

## 4. 渲染管线

### 4.1 成品效果

```text
冷银背景
  -> 投影
  -> 金属外壳
  -> 按成品直径裁剪的用户图片
  -> 可选低透明度棱彩膜层和干涉细纹
  -> 边缘高光
```

- 根据 25mm 到 75mm 的成品尺寸线性调整吧唧本体在画布中的显示比例.
- 无工艺不绘制表面光晕, 只保留真实物体必须存在的金属边缘和投影.
- 镭射膜使用 `soft-light` 棱彩层和低透明度 `screen` 细纹, 随观察相位轻微移动.

### 4.2 完整图片范围

```text
透明参考背景
  -> 完整圆形图片
  -> 包边区半透明标识
  -> 成品可见边界
  -> 安全区边界
```

- 包边区是完整图片圆与成品可见圆之间的环形区域.
- 安全区只用于屏幕提示.
- 参考线和色带不写入制作原图.

### 4.3 制作原图

```text
透明画布
  -> 完整圆形裁剪
  -> 用户原图
  -> 300 DPI PNG 元数据
```

- 使用 `round(printDiameterMm / 25.4 * 300)` 计算输出边长.
- 使用相同图片变换绘制完整图片圆.
- 禁止绘制外壳、阴影、背景、工艺效果和参考线.
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
- [x] 验证 58mm 默认制作原图为 827x827 PNG, 圆外透明.
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
