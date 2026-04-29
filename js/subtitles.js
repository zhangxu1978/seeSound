// 字幕处理模块

async function loadSubtitleFont(fontFamily) {
    if (seesound.loadedFonts.has(fontFamily)) {
        return;
    }

    try {
        const fontPath = `/font/${fontFamily}`;
        const font = new FontFace('subtitle-font', `url(${fontPath})`);
        await font.load();
        document.fonts.add(font);
        seesound.loadedFonts.add(fontFamily);
        console.log(`字体加载成功: ${fontFamily}`);
    } catch (err) {
        console.warn(`字体加载失败: ${fontFamily}`, err);
    }
}

async function loadAllSubtitleFonts() {
    const promises = seesound.FONT_LIST.map(font => loadSubtitleFont(font));
    await Promise.all(promises);
}

function parseSRT(content) {
    const subtitles = [];
    const blocks = content.trim().split(/\n\s*\n/);

    for (const block of blocks) {
        const lines = block.split('\n');
        if (lines.length < 3) continue;

        const indexLine = lines[0].trim();
        const timeLine = lines[1].trim();
        const textLines = lines.slice(2);

        const index = parseInt(indexLine);
        if (isNaN(index)) continue;

        const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
        if (!timeMatch) continue;

        const startTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
        const endTime = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
        const text = textLines.join('\n').replace(/<[^>]+>/g, '').trim();

        subtitles.push({ index, startTime, endTime, text });
    }

    return subtitles.sort((a, b) => a.startTime - b.startTime);
}

function formatTimeSRT(seconds) {
    const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
    return `${hrs}:${mins}:${secs},${ms}`;
}

function subtitlesToSRT(subtitleArray) {
    if (!subtitleArray || subtitleArray.length === 0) return '';

    return subtitleArray.map((sub, idx) => {
        return `${idx + 1}\n${formatTimeSRT(sub.startTime)} --> ${formatTimeSRT(sub.endTime)}\n${sub.text}\n`;
    }).join('\n');
}

function renderSubtitleList() {
    const container = document.getElementById('subtitleList');
    const title = document.getElementById('subtitleListTitle');
    const listContainer = document.getElementById('subtitleListContainer');

    if (!seesound.subtitles || seesound.subtitles.length === 0) {
        title.style.display = 'none';
        listContainer.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    title.style.display = 'block';
    listContainer.style.display = 'block';

    container.innerHTML = seesound.subtitles.map((sub, idx) => `
        <div class="subtitle-item" data-index="${idx}" style="padding: 10px; margin-bottom: 8px; background: rgba(255,255,255,0.05); border-radius: 6px;">
            <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 6px; display: flex; gap: 8px; align-items: center;">
                <input type="text" class="subtitle-start-time-input" data-idx="${idx}" value="${sub.startTime}" style="width: 80px; background: transparent; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 4px 6px; color: #fff; font-size: 11px;">
                →
                <input type="text" class="subtitle-end-time-input" data-idx="${idx}" value="${sub.endTime}" style="width: 80px; background: transparent; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 4px 6px; color: #fff; font-size: 11px;">
            </div>
            <div style="display: flex; gap: 8px;">
                <input type="text" class="subtitle-text-input" data-idx="${idx}"
                       value="${sub.text.replace(/"/g, '&quot;')}"
                       style="flex: 1; background: transparent; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 6px 10px; color: #fff; font-size: 13px;">
                <button class="link-subtitle-btn" data-idx="${idx}"
                        style="background: #4a90d9; border: none; color: #fff; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;" title="连接下一字幕">
                    →
                </button>
                <button class="delete-subtitle-btn" data-idx="${idx}"
                        style="background: #ff4444; border: none; color: #fff; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    ×
                </button>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.subtitle-text-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            if (seesound.subtitles[idx]) {
                seesound.subtitles[idx].text = e.target.value;
                seesound.subtitleSettings.subtitles = [...seesound.subtitles];
                updateSubtitlePreview();
            }
        });
    });

    container.querySelectorAll('.subtitle-start-time-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const value = parseFloat(e.target.value);
            if (seesound.subtitles[idx] && !isNaN(value)) {
                seesound.subtitles[idx].startTime = value;
                seesound.subtitleSettings.subtitles = [...seesound.subtitles];
                updateSubtitlePreview();
            }
        });
    });

    container.querySelectorAll('.subtitle-end-time-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const value = parseFloat(e.target.value);
            if (seesound.subtitles[idx] && !isNaN(value)) {
                seesound.subtitles[idx].endTime = value;
                seesound.subtitleSettings.subtitles = [...seesound.subtitles];
                updateSubtitlePreview();
            }
        });
    });

    container.querySelectorAll('.delete-subtitle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            seesound.subtitles.splice(idx, 1);
            seesound.subtitles = seesound.subtitles.map((sub, i) => ({ ...sub, index: i + 1 }));
            seesound.subtitleSettings.subtitles = [...seesound.subtitles];
            renderSubtitleList();
            updateSubtitlePreview();
        });
    });

    container.querySelectorAll('.link-subtitle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            if (idx < seesound.subtitles.length - 1) {
                seesound.subtitles[idx].endTime = seesound.subtitles[idx + 1].startTime;
                seesound.subtitleSettings.subtitles = [...seesound.subtitles];
                renderSubtitleList();
                updateSubtitlePreview();
            }
        });
    });
}

function initSubtitlePreview() {
    const { subtitleCanvas, subtitleCtx, subtitleSettings } = seesound;
    if (!subtitleCanvas || !subtitleCtx) return;

    subtitleCtx.clearRect(0, 0, subtitleCanvas.width, subtitleCanvas.height);

    if (!subtitleSettings.enabled || subtitleSettings.subtitles.length === 0) {
        subtitleCtx.fillStyle = '#666';
        subtitleCtx.font = '16px sans-serif';
        subtitleCtx.textAlign = 'center';
        subtitleCtx.fillText('上传字幕文件并启用后可预览', subtitleCanvas.width / 2, subtitleCanvas.height / 2);
        return;
    }

    subtitleCtx.fillStyle = '#0d0d1a';
    subtitleCtx.fillRect(0, 0, subtitleCanvas.width, subtitleCanvas.height);

    const demoLines = ['上一行动歌词', '▶ 正在演唱的歌词', '下一行动歌词'];
    const previewFontSize = Math.min(subtitleSettings.fontSize * 0.5, 24);
    drawSubtitleText(subtitleCtx, demoLines.join('\n'), subtitleCanvas.width / 2, subtitleCanvas.height / 2 + 12, previewFontSize, true);
}

function updateSubtitlePreview() {
    initSubtitlePreview();
}

function getCurrentSubtitle(currentTime) {
    const { subtitleSettings } = seesound;
    if (!subtitleSettings.subtitles || subtitleSettings.subtitles.length === 0) return null;

    for (let i = 0; i < subtitleSettings.subtitles.length; i++) {
        const sub = subtitleSettings.subtitles[i];
        if (currentTime >= sub.startTime && currentTime <= sub.endTime) {
            const prevSub = i > 0 ? subtitleSettings.subtitles[i - 1] : null;
            const nextSub = i < subtitleSettings.subtitles.length - 1 ? subtitleSettings.subtitles[i + 1] : null;
            return { current: sub, prev: prevSub, next: nextSub, index: i };
        }
    }
    return null;
}

function isCustomFont(fontFamily) {
    return fontFamily.endsWith('.ttf') || fontFamily.endsWith('.otf');
}

function getSubtitleFontFamily() {
    const fontFamily = seesound.subtitleSettings.fontFamily;
    if (!fontFamily) return 'sans-serif';

    if (isCustomFont(fontFamily)) {
        return seesound.loadedFonts.has(fontFamily) ? 'subtitle-font' : 'sans-serif';
    }

    return fontFamily;
}

function drawSubtitleText(ctx, text, x, y, fontSize, isPreview = false) {
    const fontFamily = getSubtitleFontFamily();
    ctx.font = `${fontSize}px "${fontFamily}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (seesound.subtitleSettings.strokeWidth > 0) {
        ctx.strokeStyle = seesound.subtitleSettings.strokeColor;
        ctx.lineWidth = seesound.subtitleSettings.strokeWidth * (isPreview ? 1 : 2);
        ctx.lineJoin = 'round';
        ctx.strokeText(text, x, y);
    }

    ctx.fillStyle = seesound.subtitleSettings.color;
    ctx.fillText(text, x, y);
}

function drawSubtitles(ctx, width, height, currentTime, energy) {
    if (!seesound.subtitleSettings.enabled || seesound.subtitleSettings.subtitles.length === 0) return;

    const subData = getCurrentSubtitle(currentTime);
    if (!subData) return;

    const fontSize = seesound.subtitleSettings.fontSize;
    const posX = width * seesound.subtitleSettings.position.x;
    const posY = height * seesound.subtitleSettings.position.y;

    switch (seesound.subtitleSettings.effect) {
        case 'scrolling':
            drawScrollingSubtitles(ctx, subData, posX, posY, fontSize, currentTime);
            break;
        case 'fadein':
            drawFadeinSubtitles(ctx, subData, posX, posY, fontSize, currentTime);
            break;
        case 'karaoke':
            drawKaraokeSubtitles(ctx, subData, posX, posY, fontSize, currentTime);
            break;
        case 'pop':
            drawPopSubtitles(ctx, subData, posX, posY, fontSize, currentTime);
            break;
        case 'typewriter':
            drawTypewriterSubtitles(ctx, subData, posX, posY, fontSize, currentTime);
            break;
        default:
            drawScrollingSubtitles(ctx, subData, posX, posY, fontSize);
    }
}

function drawScrollingSubtitles(ctx, subData, x, y, fontSize, currentTime) {
    const lineHeight = fontSize * 1.5;
    const startY = y - lineHeight;

    const currentPrevText = subData.prev ? subData.prev.text : '';
    const currentCurrentText = subData.current.text;
    const currentNextText = subData.next ? subData.next.text : '';

    if (seesound.subtitleScrollState.prevSubIndex === -1) {
        seesound.subtitleScrollState.prevSubIndex = subData.index;
        seesound.subtitleScrollState.isAnimating = false;
        seesound.subtitleScrollState.prevPrevText = currentPrevText;
    }

    if (subData.index !== seesound.subtitleScrollState.prevSubIndex) {
        seesound.subtitleScrollState.isAnimating = true;
        seesound.subtitleScrollState.animationStartTime = currentTime;

        seesound.subtitleScrollState.prevPrevText = seesound.subtitleScrollState.prevPrevText || currentPrevText;
        seesound.subtitleScrollState.prevCurrentText = currentCurrentText;
        seesound.subtitleScrollState.prevNextText = currentNextText;

        seesound.subtitleScrollState.prevSubIndex = subData.index;
    }

    if (seesound.subtitleScrollState.isAnimating) {
        const elapsed = currentTime - seesound.subtitleScrollState.animationStartTime;
        const progress = Math.min(1, elapsed / seesound.subtitleScrollState.animationDuration);
        const easedProgress = easeOutQuad(progress);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const row1OffsetY = -lineHeight * easedProgress;
        const row1Alpha = Math.max(0, 0.5 * (1 - easedProgress * 1.5));

        if (seesound.subtitleScrollState.prevPrevText && row1Alpha > 0.01) {
            ctx.globalAlpha = row1Alpha;
            drawSubtitleText(ctx, seesound.subtitleScrollState.prevPrevText, x, startY + row1OffsetY, fontSize * 0.8);
        }

        const row2OffsetY = lineHeight * (1 - easedProgress);
        const row2Alpha = 1.0;

        ctx.globalAlpha = row2Alpha;
        drawSubtitleText(ctx, '▶ ' + seesound.subtitleScrollState.prevCurrentText, x, startY + row2OffsetY, fontSize);

        const row3OffsetY = lineHeight * (2 - easedProgress);
        const row3Alpha = Math.min(0.5, easedProgress * 1.2);

        if (currentNextText && row3Alpha > 0.01) {
            ctx.globalAlpha = row3Alpha;
            drawSubtitleText(ctx, currentNextText, x, startY + row3OffsetY, fontSize * 0.8);
        }

        ctx.restore();

        if (progress >= 1) {
            seesound.subtitleScrollState.isAnimating = false;
            seesound.subtitleScrollState.prevPrevText = currentPrevText;
        }
    } else {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.globalAlpha = 0.5;
        if (currentPrevText) {
            drawSubtitleText(ctx, currentPrevText, x, startY, fontSize * 0.8);
        }

        ctx.globalAlpha = 1.0;
        drawSubtitleText(ctx, '▶ ' + currentCurrentText, x, startY + lineHeight, fontSize);

        ctx.globalAlpha = 0.5;
        if (currentNextText) {
            drawSubtitleText(ctx, currentNextText, x, startY + lineHeight * 2, fontSize * 0.8);
        }

        ctx.restore();
    }

    ctx.globalAlpha = 1.0;
}

function drawFadeinSubtitles(ctx, subData, x, y, fontSize, currentTime) {
    const duration = subData.current.endTime - subData.current.startTime;
    const elapsed = currentTime - subData.current.startTime;
    const progress = Math.min(1, elapsed / duration);

    const chars = subData.current.text.split('');
    const visibleChars = Math.floor(chars.length * progress);

    ctx.globalAlpha = 0.3 + progress * 0.7;
    const text = chars.slice(0, visibleChars).join('');
    drawSubtitleText(ctx, text, x, y, fontSize);
    ctx.globalAlpha = 1.0;
}

function drawKaraokeSubtitles(ctx, subData, x, y, fontSize, currentTime) {
    const duration = subData.current.endTime - subData.current.startTime;
    const elapsed = currentTime - subData.current.startTime;
    const progress = Math.min(1, elapsed / duration);

    const text = subData.current.text;
    const chars = text.split('');
    const highlightIndex = Math.floor(chars.length * progress);

    ctx.font = `${fontSize}px "${getSubtitleFontFamily()}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let offsetX = -ctx.measureText(text).width / 2;
    const lineHeight = fontSize * 1.2;

    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const charWidth = ctx.measureText(char).width;

        if (i < highlightIndex) {
            ctx.fillStyle = '#ffdd00';
            if (seesound.subtitleSettings.strokeWidth > 0) {
                ctx.strokeStyle = '#ff8800';
                ctx.lineWidth = seesound.subtitleSettings.strokeWidth * 2;
                ctx.strokeText(char, x + offsetX + charWidth / 2, y);
            }
            ctx.fillText(char, x + offsetX + charWidth / 2, y);
        } else {
            ctx.fillStyle = seesound.subtitleSettings.color;
            if (seesound.subtitleSettings.strokeWidth > 0) {
                ctx.strokeStyle = seesound.subtitleSettings.strokeColor;
                ctx.lineWidth = seesound.subtitleSettings.strokeWidth * 2;
                ctx.strokeText(char, x + offsetX + charWidth / 2, y);
            }
            ctx.fillText(char, x + offsetX + charWidth / 2, y);
        }

        offsetX += charWidth;
    }
}

function drawPopSubtitles(ctx, subData, x, y, fontSize, currentTime) {
    const duration = subData.current.endTime - subData.current.startTime;
    const elapsed = currentTime - subData.current.startTime;
    const progress = Math.min(1, elapsed / duration);

    let scale = 1;
    let alpha = 1;

    if (progress < 0.1) {
        scale = 0.5 + progress * 5;
        alpha = progress * 10;
    } else if (progress > 0.8) {
        alpha = (1 - progress) * 5;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const text = subData.current.text;
    ctx.font = `${fontSize}px "${getSubtitleFontFamily()}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (seesound.subtitleSettings.strokeWidth > 0) {
        ctx.strokeStyle = seesound.subtitleSettings.strokeColor;
        ctx.lineWidth = seesound.subtitleSettings.strokeWidth * 2;
        ctx.lineJoin = 'round';
        ctx.strokeText(text, 0, 0);
    }

    ctx.fillStyle = seesound.subtitleSettings.color;
    ctx.fillText(text, 0, 0);

    ctx.restore();
}

function drawTypewriterSubtitles(ctx, subData, x, y, fontSize, currentTime) {
    const duration = subData.current.endTime - subData.current.startTime;
    const elapsed = currentTime - subData.current.startTime;
    const progress = Math.min(1, elapsed / duration);

    const chars = subData.current.text.split('');
    const visibleChars = Math.floor(chars.length * progress);
    let text = chars.slice(0, visibleChars).join('');

    if (visibleChars < chars.length && Math.floor(currentTime * 10) % 2 === 0) {
        text += '▌';
    }

    drawSubtitleText(ctx, text, x, y, fontSize);
}

function applySubtitleSettings() {
    console.log('字幕设置已应用:', seesound.subtitleSettings);
}

function handleSrtFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    seesound.subtitleSettings.srtFile = file;
    document.getElementById('srtFilename').textContent = file.name;
    document.getElementById('srtFileInfo').style.display = 'block';

    const reader = new FileReader();
    reader.onload = (event) => {
        seesound.subtitles = parseSRT(event.target.result);
        seesound.subtitleSettings.subtitles = seesound.subtitles;
        console.log('字幕加载成功，共', seesound.subtitles.length, '条');
        renderSubtitleList();
        initSubtitlePreview();
    };
    reader.readAsText(file);
}