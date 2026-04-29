
# SeeSound 项目重构说明

## 概述

已成功将原本的两个大文件（`app.js` 和 `server.js`）按功能模块拆分为更小、更易维护的代码结构。

---

## 前端拆分 (app.js → /js 目录)

### 文件结构

```
/js/
├── state.js         # 全局状态和配置
├── utils.js         # 工具函数
├── subtitles.js     # 字幕处理模块
├── effects.js       # 特效绘制模块
├── events.js        # 事件绑定模块
├── export.js        # 导出功能模块
├── init.js          # 初始化模块
└── (新) app.js      # 主入口文件
```

### 模块说明

| 文件 | 职责 | 主要内容 |
|------|------|----------|
| `state.js` | 全局状态 | 音频、视频、画布、特效设置、字幕设置、颜色主题、字体列表等 |
| `utils.js` | 工具函数 | `formatTime`, `roundRect`, `easeOutQuad`, `bindSlider`, `updateSettingsVisibility` |
| `subtitles.js` | 字幕处理 | 字幕解析、字体加载、字幕绘制（滚动、淡入、卡拉OK、弹出、打字机） |
| `effects.js` | 特效绘制 | 粒子、频谱、波形、环形、粒子上升等特效，画布变形 |
| `events.js` | 事件绑定 | UI 事件、字幕事件处理 |
| `export.js` | 导出功能 | 文件上传、画布大小、拖拽调整、播放控制、浏览器录制、服务器导出 |
| `init.js` | 初始化 | 配置加载、模块初始化 |

### 兼容性

- 保留了原 `app.js` 文件（重写为新入口）
- 更新了 `index.html` 按顺序引入所有模块

---

## 后端拆分 (server.js → /server 目录)

### 文件结构

```
/server/
├── config.js        # 配置模块
├── gpu-detector.js  # GPU 加速检测
├── subtitles.js     # 字幕处理模块
├── effects.js       # 特效绘制模块
├── video-processor.js # 视频处理模块
├── routes.js        # API 路由模块
└── (新) server.js   # 主入口文件
```

### 模块说明

| 文件 | 职责 | 主要内容 |
|------|------|----------|
| `config.js` | 配置 | 颜色主题、目录路径定义 |
| `gpu-detector.js` | GPU 检测 | FFmpeg 编码器检测、GPU 配置缓存 |
| `subtitles.js` | 字幕处理 | SRT 解析、字幕绘制、字体注册 |
| `effects.js` | 特效绘制 | 与前端一致的特效渲染逻辑 |
| `video-processor.js` | 视频处理 | 帧生成、FFmpeg 合成、GPU 加速编码 |
| `routes.js` | API 路由 | `/api/export`、`/api/export/status`、`/api/export-external` 等 |

### 兼容性

- 保留了 `server.js.backup` 备份原文件
- 新 `server.js` 保持相同的导出接口

---

## 使用说明

### 前端

确保 `index.html` 中的脚本按正确顺序引入（已更新）：

```html
&lt;script src="js/state.js"&gt;&lt;/script&gt;
&lt;script src="js/utils.js"&gt;&lt;/script&gt;
&lt;script src="js/subtitles.js"&gt;&lt;/script&gt;
&lt;script src="js/effects.js"&gt;&lt;/script&gt;
&lt;script src="js/events.js"&gt;&lt;/script&gt;
&lt;script src="js/export.js"&gt;&lt;/script&gt;
&lt;script src="js/init.js"&gt;&lt;/script&gt;
&lt;script src="app.js"&gt;&lt;/script&gt;
```

### 后端

直接运行 `node server.js` 即可，代码已模块化但接口保持不变。

---

## 改进点

1. **可读性**：每个文件职责单一，更容易理解
2. **可维护性**：修改某个功能只需关注对应模块
3. **可扩展性**：新增功能只需添加新模块
4. **代码复用**：前后端共享部分逻辑结构

