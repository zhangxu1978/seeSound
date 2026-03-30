# 🎬 音视频可视化编辑器

一个功能完整的音视频可视化工具，支持视频/音频文件，可调整动画位置和大小，导出带特效的新视频。

## ✨ 功能特性

- 📁 **支持多种格式**: 支持 MP4、MOV、MP3、WAV 等常见音视频格式
- 🎨 **多种动画效果**: 
  - 粒子流动 - 粒子随音乐节奏飞舞
  - 粒子上升 - 粒子从底部升起
  - 频谱柱状 - 经典频谱可视化
  - 波形线条 - 实时波形显示
  - 环形频谱 - 圆形频谱动画
- 🎯 **位置自由调整**: 拖拽移动、缩放大小，支持多种位置预设
- 🎨 **颜色主题**: 紫、粉、蓝、绿、暖色等多种配色方案
- 📤 **所见即所得导出**: 导出原视频+特效的合并视频
- 🔌 **API 接口**: 提供 HTTP API 支持程序化调用

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务器

```bash
npm start
```

服务器将在 http://localhost:3200 启动

### 3. 打开编辑器

在浏览器中访问 http://localhost:3200

## 📖 使用说明

### 界面操作

1. **上传文件**: 点击左侧上传区域选择音频或视频文件
2. **选择效果**: 在右侧面板选择动画类型、颜色主题
3. **调整位置**: 
   - 拖拽动画区域移动位置
   - 拖拽右下角调整大小
   - 或使用位置预设快速定位
4. **预览效果**: 点击播放按钮实时预览
5. **导出视频**: 点击"导出视频"按钮生成最终视频

### 位置预设

- **全屏**: 特效覆盖整个视频
- **底部**: 特效在视频底部（适合字幕区域）
- **顶部**: 特效在视频顶部
- **居中**: 特效在画面中央
- **左下/右下**: 特效在角落

## 🔌 API 接口

### 导出视频

```http
POST /api/export
Content-Type: multipart/form-data

video: <文件>
settings: {
  "effectType": "particles",
  "colors": "purple",
  "sensitivity": 1,
  "particleCount": 150,
  "position": "fullscreen",
  "opacity": 0.8,
  "resolution": "original",
  "quality": "high",
  "overlayRect": {
    "x": 0,
    "y": 0,
    "width": 1920,
    "height": 1080
  }
}
```

**响应**:
```json
{
  "taskId": "uuid-string"
}
```

### 查询导出状态

```http
GET /api/export/status/{taskId}
```

**响应**:
```json
{
  "id": "uuid-string",
  "status": "processing|completed|failed",
  "progress": 75,
  "message": "生成帧 150/200",
  "outputUrl": "/exports/filename.mp4"
}
```

### 下载导出的视频

```http
GET /api/export/download/{taskId}
```

### 健康检查

```http
GET /api/health
```

## 🛠️ 技术栈

- **前端**: HTML5 Canvas + Web Audio API
- **后端**: Node.js + Express
- **视频处理**: FFmpeg
- **音频分析**: 自定义 FFT 实现

## 📁 项目结构

```
.
├── index.html          # 前端编辑器界面
├── server.js           # Node.js 后端服务
├── audio-analyzer.js   # 音频分析模块
├── package.json        # 项目配置
├── uploads/            # 上传文件临时目录
├── exports/            # 导出视频目录
└── temp/               # 临时处理目录
```

## ⚠️ 注意事项

1. **FFmpeg 依赖**: 确保系统已安装 FFmpeg 并添加到 PATH
2. **内存使用**: 处理大视频文件可能需要较多内存
3. **导出时间**: 视频长度和分辨率会影响导出时间
4. **浏览器支持**: 建议使用 Chrome、Edge 等现代浏览器

## 📝 导出流程说明

1. 上传视频/音频文件
2. 服务器分析音频数据（提取频谱信息）
3. 根据设置生成带透明通道的特效帧
4. 使用 FFmpeg 将特效帧叠加到原视频上
5. 输出最终视频文件

**注意**: 导出的视频包含原视频内容和特效动画，是"所见即所得"的结果。

## 🔧 自定义配置

### 修改默认端口

```bash
PORT=8080 npm start
```

### 调整导出质量

在导出设置中选择:
- **高**: CRF 23，画质最佳
- **中**: CRF 28，平衡画质和大小
- **低**: CRF 35，文件最小

## 📄 许可证

MIT License
