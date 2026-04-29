
// SeeSound 服务器主入口
// 原大文件已按功能模块拆分到 /server 目录
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { registerRoutes } = require('./server/routes');
const { uploadsDir, exportsDir, tempDir } = require('./server/config');

const app = express();
const PORT = config.port;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// 确保目录存在
[uploadsDir, exportsDir, tempDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// 注册路由
registerRoutes(app, config);

// 启动服务器
app.listen(PORT, () => {
    console.log(`🎬 SeeSound 音视频可视化服务器运行在 http://localhost:${PORT}`);
    console.log(`📁 导出文件目录: ${exportsDir}`);
});

module.exports = app;

