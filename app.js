
// SeeSound 主入口文件
// 原大文件已按功能模块拆分到 /js 目录

// 加载顺序很重要！
// 1. state.js - 全局状态和配置（必须先加载）
// 2. utils.js - 工具函数
// 3. subtitles.js - 字幕处理模块
// 4. effects.js - 特效绘制模块（依赖 state, utils, subtitles）
// 5. events.js - 事件绑定（依赖前面的）
// 6. export.js - 导出功能（依赖前面的）
// 7. init.js - 初始化模块
// 8. app.js - 入口（本文件）

// 在 index.html 中应该按顺序引入所有 JS 文件
// 本文件保留用于向后兼容，实际功能已拆分

console.log('SeeSound 主文件加载完成');
console.log('注意：功能已模块化，请确保在 HTML 中按顺序引入 /js 目录下的所有文件');

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        init();
    });
} else {
    init();
}

