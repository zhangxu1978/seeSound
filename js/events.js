// 事件绑定模块

// 字幕事件绑定
function bindSubtitleEvents() {
    const modal = document.getElementById('subtitleModal');
    const subtitleBtn = document.getElementById('subtitleBtn');
    const closeBtn = document.getElementById('closeSubtitleModal');
    const applyBtn = document.getElementById('applySubtitleBtn');

    if (subtitleBtn) {
        subtitleBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            applySubtitleSettings();
            modal.style.display = 'none';
        });
    }

    document.getElementById('subtitleEnabled')?.addEventListener('change', (e) => {
        seesound.subtitleSettings.enabled = e.target.checked;
        initSubtitlePreview();
    });

    document.getElementById('exportSubtitleBtn')?.addEventListener('click', () => {
        if (seesound.subtitleSettings.subtitles && seesound.subtitleSettings.subtitles.length > 0) {
            const srtContent = seesound.subtitleSettings.subtitles.map((sub, idx) => {
                const startHrs = Math.floor(sub.startTime / 3600).toString().padStart(2, '0');
                const startMins = Math.floor((sub.startTime % 3600) / 60).toString().padStart(2, '0');
                const startSecs = Math.floor(sub.startTime % 60).toString().padStart(2, '0');
                const startMs = Math.floor((sub.startTime % 1) * 1000).toString().padStart(3, '0');
                const endHrs = Math.floor(sub.endTime / 3600).toString().padStart(2, '0');
                const endMins = Math.floor((sub.endTime % 3600) / 60).toString().padStart(2, '0');
                const endSecs = Math.floor(sub.endTime % 60).toString().padStart(2, '0');
                const endMs = Math.floor((sub.endTime % 1) * 1000).toString().padStart(3, '0');
                return `${idx + 1}\n${startHrs}:${startMins}:${startSecs},${startMs} --> ${endHrs}:${endMins}:${endSecs},${endMs}\n${sub.text}`;
            }).join('\n\n');
            const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const fileName = seesound.subtitleSettings.srtFile ? seesound.subtitleSettings.srtFile.name.replace('.srt', '_edited.srt') : 'subtitles_edited.srt';
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    });

    document.getElementById('batchLinkSubtitleBtn')?.addEventListener('click', () => {
        if (seesound.subtitles && seesound.subtitles.length > 1) {
            for (let i = 0; i < seesound.subtitles.length - 1; i++) {
                seesound.subtitles[i].endTime = seesound.subtitles[i + 1].startTime;
            }
            seesound.subtitleSettings.subtitles = [...seesound.subtitles];
            renderSubtitleList();
            updateSubtitlePreview();
        }
    });

    document.getElementById('subtitleFont')?.addEventListener('change', (e) => {
        seesound.subtitleSettings.fontFamily = e.target.value;
        loadSubtitleFont(seesound.subtitleSettings.fontFamily).then(() => {
            initSubtitlePreview();
        });
    });

    document.getElementById('subtitleFontSize')?.addEventListener('input', (e) => {
        seesound.subtitleSettings.fontSize = parseInt(e.target.value);
        document.getElementById('subtitleFontSizeValue').textContent = e.target.value;
        initSubtitlePreview();
    });

    document.getElementById('subtitleEffect')?.addEventListener('change', (e) => {
        seesound.subtitleSettings.effect = e.target.value;
        initSubtitlePreview();
    });

    document.getElementById('subtitleStrokeWidth')?.addEventListener('input', (e) => {
        seesound.subtitleSettings.strokeWidth = parseInt(e.target.value);
        document.getElementById('subtitleStrokeWidthValue').textContent = e.target.value;
    });

    document.querySelectorAll('.color-option[data-subcolor]').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.color-option[data-subcolor]').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            seesound.subtitleSettings.color = opt.dataset.subcolor;
        });
    });

    document.querySelectorAll('.color-option[data-stroke]').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.color-option[data-stroke]').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            seesound.subtitleSettings.strokeColor = opt.dataset.stroke;
        });
    });

    document.getElementById('srtUpload')?.addEventListener('click', () => {
        document.getElementById('srtFile').click();
    });

    document.getElementById('srtFile')?.addEventListener('change', handleSrtFileSelect);
}

// 绑定事件
function bindEvents() {
    document.getElementById('fileUpload').addEventListener('click', () => {
        document.getElementById('mediaFile').click();
    });
    document.getElementById('mediaFile').addEventListener('change', handleFileSelect);

    document.getElementById('bgUpload').addEventListener('click', () => {
        document.getElementById('bgImageFile').click();
    });
    document.getElementById('bgImageFile').addEventListener('change', handleBgImageSelect);
    document.getElementById('removeBgBtn').addEventListener('click', removeBgImage);

    document.getElementById('playBtn').addEventListener('click', togglePlay);
    document.getElementById('progressBar').addEventListener('click', seekVideo);
    document.getElementById('exportBtn').addEventListener('click', exportVideo);

    document.getElementById('saveConfigBtn').addEventListener('click', saveConfig);
    document.getElementById('loadConfigBtn').addEventListener('click', () => {
        document.getElementById('configFile').click();
    });
    document.getElementById('configFile').addEventListener('change', loadConfigFile);

    document.getElementById('effectType').addEventListener('change', (e) => {
        seesound.effectSettings.type = e.target.value;
        updateSettingsVisibility();
        initParticles();
    });

    document.querySelectorAll('.color-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            seesound.effectSettings.colors = opt.dataset.colors;
        });
    });

    bindSlider('sensitivity', 'sensitivityValue', 'sensitivity');
    bindSlider('opacity', 'opacityValue', 'opacity');

    bindSlider('barCount', 'barCountValue', 'barCount', true);
    bindSlider('barWidth', 'barWidthValue', 'barWidth', true);
    bindSlider('barGap', 'barGapValue', 'barGap');
    bindSlider('barRadius', 'barRadiusValue', 'barRadius', true);
    document.getElementById('barDirection').addEventListener('change', (e) => seesound.effectSettings.barDirection = e.target.value);
    document.getElementById('gradientDirection').addEventListener('change', (e) => seesound.effectSettings.gradientDirection = e.target.value);
    document.getElementById('mirrorEffect').addEventListener('change', (e) => seesound.effectSettings.mirrorEffect = e.target.checked);
    document.getElementById('barBrick').addEventListener('change', (e) => {
        seesound.effectSettings.barBrick = e.target.checked;
        seesound.brickPositions = [];
    });

    document.getElementById('waveOrigin').addEventListener('change', (e) => seesound.effectSettings.waveOrigin = e.target.value);
    bindSlider('amplitude', 'amplitudeValue', 'amplitude');
    bindSlider('frequency', 'frequencyValue', 'frequency');
    bindSlider('lineWidth', 'lineWidthValue', 'lineWidth');
    bindSlider('waveLines', 'waveLinesValue', 'waveLines', true);
    document.getElementById('glowEffect').addEventListener('change', (e) => seesound.effectSettings.glowEffect = e.target.checked);

    document.getElementById('transformType').addEventListener('change', (e) => seesound.effectSettings.transformType = e.target.value);
    bindSlider('transformIntensity', 'transformIntensityValue', 'transformIntensity', true);
    bindSlider('transformSpeed', 'transformSpeedValue', 'transformSpeed');

    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            seesound.effectSettings.position = btn.dataset.position;
            applyPositionPreset(seesound.effectSettings.position);
        });
    });
}