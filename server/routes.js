
// API 路由模块
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { uploadsDir, exportsDir, tempDir } = require('./config');
const { parseSRT } = require('./subtitles');
const { generateVisualizationFrames, mergeVideoWithEffect, mergeWithBackground } = require('./video-processor');

// 存储任务状态
const exportTasks = new Map();

// 文件上传配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}_${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

// 多文件上传配置
const multiUpload = upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'bgImage', maxCount: 1 },
    { name: 'subtitle', maxCount: 1 }
]);

// 外部程序导出接口配置
const externalUpload = upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'image', maxCount: 1 }
]);

// 注册路由
function registerRoutes(app, config) {
    // 导出视频
    app.post('/api/export', multiUpload, async (req, res) => {
        try {
            const videoFile = req.files?.video?.[0];
            const bgImageFile = req.files?.bgImage?.[0];
            const subtitleFile = req.files?.subtitle?.[0];

            if (!videoFile) {
                return res.status(400).json({ error: '没有上传视频文件' });
            }

            console.log('\n========== 收到导出请求 ==========');
            console.log(`🎬 视频文件: ${videoFile.originalname} (${(videoFile.size / 1024 / 1024).toFixed(2)} MB)`);
            if (bgImageFile) {
                console.log(`🖼️  背景图: ${bgImageFile.originalname}`);
            }
            if (subtitleFile) {
                console.log(`📝 字幕文件: ${subtitleFile.originalname}`);
            }

            const settings = JSON.parse(req.body.settings || '{}');
            console.log(`⚙️  设置: ${JSON.stringify(settings)}`);

            if (settings.bgImageWidth && settings.bgImageHeight) {
                console.log(`🖼️  背景图尺寸: ${settings.bgImageWidth}x${settings.bgImageHeight}`);
            }

            // 解析字幕 - 优先使用设置中的字幕数据
            let subtitleData = null;
            if (settings.subtitle) {
                // 检查是否有已编辑的字幕数据
                if (settings.subtitle.subtitles && settings.subtitle.subtitles.length > 0) {
                    subtitleData = settings.subtitle.subtitles;
                    console.log(`📝 使用编辑后的字幕，共 ${subtitleData.length} 条`);
                } else if (subtitleFile) {
                    // 否则从文件读取
                    try {
                        const srtContent = fs.readFileSync(subtitleFile.path, 'utf8');
                        subtitleData = parseSRT(srtContent);
                        console.log(`📝 从文件解析字幕，共 ${subtitleData.length} 条`);
                    } catch (err) {
                        console.warn(`📝 字幕解析失败:`, err.message);
                    }
                }
            }

            const taskId = uuidv4();
            console.log(`🔑 任务ID: ${taskId}`);

            const outputDir = path.join(tempDir, taskId);
            fs.mkdirSync(outputDir, { recursive: true });

            // 创建任务
            exportTasks.set(taskId, {
                id: taskId,
                status: 'processing',
                progress: 0,
                message: '开始处理...',
                inputPath: videoFile.path,
                bgImagePath: bgImageFile ? bgImageFile.path : null,
                subtitlePath: subtitleFile ? subtitleFile.path : null,
                outputDir,
                settings,
                createdAt: new Date().toISOString()
            });

            res.json({ taskId });

            // 异步处理
            setImmediate(async () => {
                try {
                    const task = exportTasks.get(taskId);

                    // 1. 生成可视化帧
                    console.log(`\n[${taskId}] 🎨 开始生成可视化帧...`);
                    task.message = '生成可视化帧...';
                    const { framesDir, fps, width, height } = await generateVisualizationFrames(
                        videoFile.path, settings, taskId, outputDir, subtitleData
                    );
                    console.log(`[${taskId}] ✅ 可视化帧生成完成`);

                    // 2. 合并视频
                    const outputFilename = `exported_${Date.now()}.mp4`;
                    const outputPath = path.join(exportsDir, outputFilename);

                    console.log(`[${taskId}] 🎬 开始合并视频...`);
                    if (settings.useBgImage && task.bgImagePath) {
                        // 使用背景图作为基底
                        await mergeWithBackground(task.bgImagePath, videoFile.path, framesDir, fps, width, height, outputPath, taskId);
                    } else {
                        // 使用原视频作为基底
                        await mergeVideoWithEffect(videoFile.path, framesDir, fps, width, height, outputPath, taskId);
                    }
                    console.log(`[${taskId}] ✅ 视频合并完成`);

                    // 3. 清理临时文件
                    task.outputPath = outputPath;
                    task.outputUrl = `/exports/${outputFilename}`;
                    task.status = 'completed';
                    task.progress = 100;
                    task.message = '导出完成';

                    console.log(`[${taskId}] 🧹 清理临时文件...`);
                    fs.rmSync(outputDir, { recursive: true, force: true });
                    fs.unlinkSync(videoFile.path);
                    if (task.bgImagePath) {
                        fs.unlinkSync(task.bgImagePath);
                    }
                    if (task.subtitlePath) {
                        fs.unlinkSync(task.subtitlePath);
                    }
                    console.log(`[${taskId}] ✅ 导出完成! 输出: ${outputFilename}`);
                    console.log(`[${taskId}] ========== 导出任务结束 ==========\n`);

                } catch (error) {
                    console.error('导出错误:', error);
                    const task = exportTasks.get(taskId);
                    if (task) {
                        task.status = 'failed';
                        task.error = error.message;
                    }
                }
            });

        } catch (error) {
            console.error('API 错误:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // 查询导出状态
    app.get('/api/export/status/:taskId', (req, res) => {
        const taskId = req.params.taskId;

        const task = exportTasks.get(taskId);
        if (!task) {
            console.log(`❌ 任务不存在: ${taskId}`);
            return res.status(404).json({ error: '任务不存在' });
        }
        res.json(task);
    });

    // 下载导出的视频
    app.get('/api/export/download/:taskId', (req, res) => {
        const taskId = req.params.taskId;
        console.log(`📥 下载请求: ${taskId}`);
        const task = exportTasks.get(taskId);
        if (!task || task.status !== 'completed') {
            console.log(`❌ 下载失败: 视频不存在或未完成`);
            return res.status(404).json({ error: '视频不存在或未完成' });
        }
        console.log(`📥 开始下载: ${task.outputPath}`);
        res.download(task.outputPath, 'visualized_video.mp4');
    });

    // 获取导出列表
    app.get('/api/exports', (req, res) => {
        const exports = Array.from(exportTasks.values())
            .filter(t => t.status === 'completed')
            .map(t => ({
                id: t.id,
                status: t.status,
                url: t.outputUrl,
                createdAt: t.createdAt
            }));
        res.json(exports);
    });

    // 外部程序导出接口
    app.post('/api/export-external', externalUpload, async (req, res) => {
        try {
            const audioFile = req.files?.audio?.[0];
            const imageFile = req.files?.image?.[0];
            const configName = req.body.configName;

            if (!audioFile) {
                return res.status(400).json({ error: '缺少音频文件' });
            }

            if (!imageFile) {
                return res.status(400).json({ error: '缺少图片文件' });
            }

            if (!configName) {
                return res.status(400).json({ error: '缺少配置文件名参数' });
            }

            console.log('\n========== 收到外部导出请求 ==========');
            console.log(`🎵 音频文件: ${audioFile.originalname} (${(audioFile.size / 1024 / 1024).toFixed(2)} MB)`);
            console.log(`🖼️  图片文件: ${imageFile.originalname}`);
            console.log(`⚙️  配置文件名: ${configName}`);

            // 自动补全配置文件路径
            const configPath = path.join(__dirname, '../sound/config', `${configName}.json`);
            console.log(`📁 配置文件路径: ${configPath}`);

            // 读取配置文件
            let settings;
            try {
                const configContent = fs.readFileSync(configPath, 'utf8');
                const config = JSON.parse(configContent);
                // 检查配置文件结构，支持直接的设置对象或包含 effectSettings 的结构
                settings = config.effectSettings || config;
                console.log(`✅ 配置文件读取成功`);
                console.log(`📝 配置内容:`, settings);
            } catch (err) {
                console.error('读取配置文件失败:', err);
                // 清理上传的文件
                fs.unlinkSync(audioFile.path);
                fs.unlinkSync(imageFile.path);
                return res.status(400).json({ error: '读取配置文件失败: ' + err.message });
            }

            const taskId = uuidv4();
            console.log(`🔑 任务ID: ${taskId}`);

            const outputDir = path.join(tempDir, taskId);
            fs.mkdirSync(outputDir, { recursive: true });

            // 创建任务
            exportTasks.set(taskId, {
                id: taskId,
                status: 'processing',
                progress: 0,
                message: '开始处理...',
                inputPath: audioFile.path,
                bgImagePath: imageFile.path,
                outputDir,
                settings,
                createdAt: new Date().toISOString()
            });

            res.json({ taskId });

            // 异步处理
            setImmediate(async () => {
                try {
                    const task = exportTasks.get(taskId);

                    // 1. 生成可视化帧
                    console.log(`\n[${taskId}] 🎨 开始生成可视化帧...`);
                    task.message = '生成可视化帧...';
                    const { framesDir, fps, width, height } = await generateVisualizationFrames(
                        audioFile.path, settings, taskId, outputDir
                    );
                    console.log(`[${taskId}] ✅ 可视化帧生成完成`);

                    // 2. 合并视频 - 使用背景图作为基底
                    const outputFilename = `exported_${Date.now()}.mp4`;
                    const outputPath = path.join(exportsDir, outputFilename);

                    console.log(`[${taskId}] 🎬 开始合并视频...`);
                    await mergeWithBackground(imageFile.path, audioFile.path, framesDir, fps, width, height, outputPath, taskId);
                    console.log(`[${taskId}] ✅ 视频合并完成`);

                    // 3. 清理临时文件
                    task.outputPath = outputPath;
                    task.outputUrl = `/exports/${outputFilename}`;
                    task.status = 'completed';
                    task.progress = 100;
                    task.message = '导出完成';

                    console.log(`[${taskId}] 🧹 清理临时文件...`);
                    fs.rmSync(outputDir, { recursive: true, force: true });
                    fs.unlinkSync(audioFile.path);
                    fs.unlinkSync(imageFile.path);
                    console.log(`[${taskId}] ✅ 导出完成! 输出: ${outputFilename}`);
                    console.log(`[${taskId}] ========== 导出任务结束 ==========\n`);

                } catch (error) {
                    console.error('导出错误:', error);
                    const task = exportTasks.get(taskId);
                    if (task) {
                        task.status = 'failed';
                        task.error = error.message;
                    }
                    // 清理临时目录和上传的文件
                    try {
                        fs.rmSync(outputDir, { recursive: true, force: true });
                        fs.unlinkSync(audioFile.path);
                        fs.unlinkSync(imageFile.path);
                    } catch (e) {
                        // 忽略清理错误
                    }
                }
            });

        } catch (error) {
            console.error('API 错误:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // 健康检查
    app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // GPU 加速状态
    app.get('/api/gpu-status', async (req, res) => {
        const gpuInfo = await require('./gpu-detector').getEncoderConfig();
        res.json(gpuInfo);
    });

    // 客户端配置
    app.get('/api/config', (req, res) => {
        res.json({
            apiBaseUrl: config.apiBaseUrl
        });
    });

    // 静态文件服务
    app.use('/exports', require('express').static(exportsDir));
}

module.exports = {
    registerRoutes,
    exportTasks
};

