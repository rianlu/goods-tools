# Goods-Tools (谷子周边工具箱) 技术方案 v1.3

> 架构模式: Core 核心底座 + Studios 多品类工作室插槽  
> 渲染技术: Canvas 2D 纯程序化光学着色 (零外部贴图依赖)  
> 运行环境: 100% 浏览器客户端内存，零网络上云  

---

## 1. 架构分层体系

```text
src/
├── core/                                # 🌟 通用核心层 (全品类完全复用)
│   ├── engine/                          # 渲染与光学着色引擎
│   │   ├── lighting.ts                  # 物理光照向量、漫反射、高光与 360° 环形轨迹
│   │   ├── shaders/                     # 工艺着色器
│   │   │   ├── glitter.ts               # 确定性闪粉微粒场 (细银闪、银葱、拉丝、白沙、金闪、珠光)
│   │   │   └── holo.ts                  # 表面光学覆膜 (高透亮膜、哑膜、素面镭射、碎玻璃、十字星芒)
│   │   └── canvas-utils.ts              # 基础几何路径、画稿映射变换、300DPI PNG 注入与下载
│   │
│   ├── geometry/                        # 工业几何换算
│   │   ├── dpi.ts                       # 300 DPI 毫米与像素双向换算 (mmToPixels, pixelsToMm)
│   │   └── transform.ts                 # 通用构图变换 (scale, offsetX, offsetY) 与边界覆盖约束
│   │
│   ├── components/                      # 公共 UI 组件
│   │   ├── Topbar.tsx                   # 顶栏 + 全局品类切换导航 (Studio Switcher)
│   │   ├── StageToolbar.tsx             # 视口比例尺 [ − 100% + 适应 ] + 构图锁定 + 动效播放
│   │   └── ExportModal.tsx              # 通用 300 DPI 制作原图/效果图导出模态对话框
│   │
│   └── types.ts                         # 全局公共类型定义
│
├── studios/                             # 🧰 各品类独立工作室 (按需加载、状态隔离)
│   ├── badge/                           # 🧷 马口铁吧唧工作室
│   │   ├── BadgeRenderer.ts             # 吧唧 5 层物理渲染 (微凸穹顶光照、冲压包边暗影)
│   │   ├── BadgeInspector.tsx           # 吧唧控制面板 (尺寸选择、圆/方模具、双闪工艺矩阵)
│   │   └── presets.ts                   # 25~75mm 吧唧预设与包边公差
│   │
│   └── photocard/                       # 📸 拍立得/小卡工作室
│       ├── PhotocardRenderer.ts         # 拍立得双面纸卡渲染 (圆角冲切、相框模板、卡纸厚度、覆膜)
│       ├── PhotocardInspector.tsx       # 拍立得控制面板 (模板、尺寸、圆角R角、手写签名、双面切换)
│       └── presets.ts                   # 富士Mini/方形/小卡/宽幅 4 款标准尺寸与出血公差
│
├── App.tsx                              # 根应用：全局品类调度路由与 Studio 状态持久化管理
└── styles.css                           # 模块化 Design Token 与响应式样式体系
```

---

## 2. 核心技术实现

### 2.1 纯前端 300 DPI 印刷换算与 PNG pHYs 注入
通过标准公式精确换算物理尺寸与像素尺寸：
$$\text{Pixels} = \text{round}\left(\frac{\text{mm}}{25.4} \times 300\right)$$
在导出时解析 PNG 数据块并在 `IHDR` 后注入 `pHYs` 块（`pixelsPerMeter = round(300 / 0.0254) = 11811`），使 Photoshop 等工业设计软件打开即为标准 300 DPI。

### 2.2 拍立得与小卡 300g 实体质感算法
1. **多层接触软阴影**：基于光源法线偏置与高斯扩散，呈现硬质相纸在桌面的真实立体悬浮；
2. **相框开口与内嵌阴影**：通过 `rect` 裁切并叠加内边框阴影，精确还原相框内部画稿凹陷；
3. **圆角冲切 (R0/R3/R5)**：使用二次贝塞尔曲线平滑裁切卡片轮廓；
4. **手写签名层**：在 Canvas 离屏层动态计算相框底部留白区域几何中心，完成签名文本与日期戳矢量绘制。
