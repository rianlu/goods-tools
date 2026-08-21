# 工艺贴图 AI 生成指南

> 用途: 用即梦/Midjourney 等文生图工具生成工艺贴图原图, 放入 `raw-textures/` 目录,
> 然后运行 `python3 scripts/calibrate_texture.py raw-textures/<文件名> <槽位>` 校准接入.
> 校准脚本会自动: 居中裁方 → 去暗角/亮度热点 → 亮度归一化(适配混合模式) → 缩放到 1024 → 输出到 `public/textures/`.

## 通用要求 (所有贴图)

- **比例 1:1**, 分辨率 ≥ 2048px (校准时缩到 1024, 高分辨率生成可压制 AI 噪点)
- **正俯视平拍**: 无透视、无景深虚化、无倾斜
- **均匀照明**: 无暗角、无中心亮斑、无单侧光
- **铺满全图**: 材质边到边填满, 无物体、无手、无背景、无文字水印
- 多生成几张, 挑**最均匀**的一张 (不要挑构图最"好看"的, 要挑最像"一块平铺材质"的)
- 负面提示词 (支持的工具填上): `text, watermark, logo, vignette, depth of field, blur, perspective, object, hand, border`

## 各槽位提示词

### 1. 素面镭射 → 槽位 `rainbow`

> 当前脚本生成版已接近真实效果, 此槽位可不换; 想换更真实的photo质感再生成.

**English:**
```
Macro photograph of plain holographic foil material, smooth rainbow spectral
gradient bands flowing diagonally across the surface, saturated iridescent
colors, uniform flat lighting, top-down view, texture fills entire frame
edge to edge, no objects, no text, 4k detail
```

**中文 (即梦):**
```
素面镭射膜材质微距摄影, 平滑的彩虹光谱色带斜向流动, 高饱和幻彩色彩,
均匀平光照明, 正俯视平拍, 材质边到边铺满整个画面, 无物体无文字, 4k细节
```

### 2. 碎冰镭射 → 槽位 `cracked-ice`

**English:**
```
Macro photograph of cracked ice holographic foil material, shattered glass
shard mosaic pattern, metallic silver fragments with rainbow iridescent
reflections, sharp angular facets catching light differently, uniform flat
lighting, top-down view, fills entire frame, no text, 4k detail
```

**中文 (即梦):**
```
碎冰镭射膜材质微距摄影, 碎玻璃碎片镶嵌图案, 银色金属碎片带彩虹幻彩反光,
锐利棱角切面反光各异, 均匀平光照明, 正俯视平拍, 铺满整个画面, 无文字, 4k细节
```

### 3. 方格镭射 → 槽位 `lattice`

**English:**
```
Macro photograph of grid pattern holographic foil, tiny square mosaic facets
in regular rows, each small square reflecting a different rainbow color,
metallic mirror sheen, uniform flat lighting, top-down view, fills entire
frame, no text, 4k detail
```

**中文 (即梦):**
```
方格镭射膜材质微距摄影, 规则排列的微小方形镜面格子, 每个小方格反射不同的
彩虹颜色, 金属镜面光泽, 均匀平光照明, 正俯视平拍, 铺满整个画面, 无文字, 4k细节
```

### 4. 珠光 → 槽位 `pearl`

**English:**
```
Macro photograph of pearlescent shimmer material surface, soft iridescent
mother-of-pearl sheen, subtle pink blue green gold color shifts, fine
micro-shimmer particles, bright luminous base, uniform flat lighting,
top-down view, fills entire frame, no text, 4k detail
```

**中文 (即梦):**
```
珠光材质表面微距摄影, 柔和的珍珠母贝幻彩光泽, 粉蓝绿金色微妙渐变流动,
细腻珠光微闪颗粒, 明亮通透底色, 均匀平光照明, 正俯视平拍, 铺满画面, 无文字, 4k细节
```

### 5. 银闪 → 槽位 `silver-glitter` (可选)

> 银闪/金闪默认由程序在本地预渲染(支持粒子闪烁动画), 通常不需要 AI 贴图.
> 如果想要照片质感可以生成, **必须纯黑背景** (渲染用 screen 混合, 黑=透明).

**English:**
```
Macro photograph of fine silver glitter powder evenly scattered on pure
black background, tiny metallic flake particles with sharp specular glints,
uniform density across entire frame, top-down flat view, no text, 4k detail
```

**中文 (即梦):**
```
细银色闪粉均匀撒在纯黑色背景上的微距摄影, 微小金属碎片颗粒带锐利高光反光,
整个画面密度均匀, 正俯视平拍, 无文字, 4k细节
```

### 6. 金闪 → 槽位 `gold-glitter` (可选)

同银闪, 把 silver 换成 gold / 银色换成金色.

## 不需要生成的

- **亮膜 / 哑光**: 高光必须随晃动实时移动, 静态照片做不到, 由程序渐变实时渲染.

## 接入命令

```bash
# 示例: 校准碎冰镭射
python3 scripts/calibrate_texture.py raw-textures/my-cracked-ice.png cracked-ice
# 刷新浏览器即可看到效果 (文件直接覆盖 public/textures/ 同名贴图)
```
