#Requires -Version 5.1
<#
.SYNOPSIS
    上传视频到抖音创作者中心

.DESCRIPTION
    通过 Chrome 浏览器自动化，将本地视频文件上传到抖音创作者平台。
    前提：Chrome 已开启远程调试端口 (--remote-debugging-port=48840)

.PARAMETER FilePath
    要上传的视频文件路径（支持中文路径）

.PARAMETER Title
    视频标题（可选，不填则留空）

.PARAMETER Description
    作品简介（可选，不填则留空）

.PARAMETER PublishTime
    定时发布时间（可选，格式：yyyy-MM-dd HH:mm）
    示例：-PublishTime "2026-04-13 20:00"
    注意：必须距今2小时以上，且不超过14天

.PARAMETER SkipPublish
    跳过发布步骤，仅上传到编辑页面

.EXAMPLE
    .\douyin-upload.ps1 "D:\video\my_song.mp4"
    .\douyin-upload.ps1 "D:\video\my_song.mp4" -Title "我的新歌" -Description "原创音乐"
    .\douyin-upload.ps1 "D:\video\my_song.mp4" -PublishTime "2026-04-13 20:00"
    .\douyin-upload.ps1 "D:\video\my_song.mp4" -SkipPublish
#>

param(
    [Parameter(Mandatory = $true, Position = 0, HelpMessage = "要上传的视频文件路径")]
    [ValidateScript({ Test-Path $_ -PathType Leaf })]
    [string]$FilePath,

    [Parameter(Mandatory = $false, HelpMessage = "视频标题")]
    [string]$Title,

    [Parameter(Mandatory = $false, HelpMessage = "作品简介")]
    [string]$Description,

    [Parameter(Mandatory = $false, HelpMessage = "定时发布时间（格式：yyyy-MM-dd HH:mm）")]
    [string]$PublishTime,

    [Parameter(Mandatory = $false, HelpMessage = "跳过发布步骤")]
    [switch]$SkipPublish
)

$ErrorActionPreference = "Stop"

# ========== 配置 ==========
$CDP_PORT = 48840
$UPLOAD_URL = "https://creator.douyin.com/creator-micro/content/upload"
$UPLOAD_TIMEOUT_MS = 120000
$POLL_INTERVAL_MS = 2000

# ========== 工具函数 ==========
function Get-AgentBrowser {
    param([string]$ExtraArgs = "")
    $result = agent-browser --cdp $CDP_PORT snapshot $ExtraArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "无法连接到 Chrome（端口 $CDP_PORT）。请确保 Chrome 已启动并开启远程调试。"
    }
    return $result
}

function Find-Ref {
    # 从快照中查找指定模式的 ref
    param([string]$Pattern, [string]$Snapshot)
    if ($Snapshot -match $Pattern) {
        return $matches[1]
    }
    return $null
}

# ========== 主流程 ==========
Write-Host "`n========== 抖音视频上传脚本 ==========" -ForegroundColor Magenta
Write-Host "文件: $FilePath" -ForegroundColor White
if ($Title)       { Write-Host "标题: $Title" -ForegroundColor White }
if ($Description) { Write-Host "简介: $Description" -ForegroundColor White }
if ($PublishTime) { Write-Host "定时: $PublishTime" -ForegroundColor White }
Write-Host ""

# 1. 检查文件
$absolutePath = (Resolve-Path $FilePath).Path
Write-Host "[1/7] 检查文件: $absolutePath" -ForegroundColor Yellow
if (-not (Test-Path $absolutePath)) {
    throw "文件不存在: $absolutePath"
}
$fileSizeMB = [math]::Round((Get-Item $absolutePath).Length / 1MB, 1)
Write-Host "    文件大小: ${fileSizeMB}MB" -ForegroundColor Gray

# 2. 打开上传页面
Write-Host "`n[2/7] 打开抖音创作者上传页面..." -ForegroundColor Yellow
agent-browser --cdp $CDP_PORT open $UPLOAD_URL 2>&1 | Out-Null
Start-Sleep -Seconds 3

# 3. 放弃旧草稿（如果存在）
Write-Host "`n[3/7] 检查并放弃旧草稿..." -ForegroundColor Yellow
$snapshot = Get-AgentBrowser

if ($snapshot -match '放弃发布|放弃[^的]') {
    Write-Host "    发现旧草稿，点击放弃..." -ForegroundColor Gray
    # 用 ref 方式点击
    if ($snapshot -match '放弃(?:发布)?\s+\[ref=(\w+)\]') {
        agent-browser --cdp $CDP_PORT click $matches[1] 2>&1 | Out-Null
    } elseif ($snapshot -match '放弃\s+\[ref=(\w+)\]') {
        agent-browser --cdp $CDP_PORT click $matches[1] 2>&1 | Out-Null
    }
    Start-Sleep -Seconds 2
}

# 4. 上传文件
Write-Host "`n[4/7] 上传文件..." -ForegroundColor Yellow
Write-Host "    触发文件选择..." -ForegroundColor Gray
$result = agent-browser --cdp $CDP_PORT upload "input[type=file]" $absolutePath 2>&1
Write-Host "    上传命令已触发" -ForegroundColor Gray

# 5. 等待上传完成
$timeoutSec = $UPLOAD_TIMEOUT_MS / 1000
Write-Host "`n[5/7] 等待上传完成（超时: ${timeoutSec}s）..." -ForegroundColor Yellow
$elapsed = 0
$uploadComplete = $false

while ($elapsed -lt $UPLOAD_TIMEOUT_MS) {
    Start-Sleep -Milliseconds $POLL_INTERVAL_MS
    $elapsed += $POLL_INTERVAL_MS

    $snapshot = Get-AgentBrowser

    # 完成标志：进度条消失 + 出现预览视频
    if ($snapshot -match "预览视频" -and $snapshot -notmatch "上传进度") {
        $uploadComplete = $true
        $elapsedSec = [math]::Round($elapsed / 1000, 1)
        Write-Host "`n    [v] 上传完成！耗时: ${elapsedSec}s" -ForegroundColor Green
        break
    }

    # 显示进度
    if ($snapshot -match "(\d+)%") {
        $percent = $matches[1]
        $bar = ("=" * [math]::Floor([Math]::Min($percent, 100) / 5)) + (" " * (20 - [math]::Floor([Math]::Min($percent, 100) / 5)))
        Write-Host "`r    进度: [$bar] ${percent}%  " -NoNewline -ForegroundColor Cyan
    }

    if ($elapsed -ge $UPLOAD_TIMEOUT_MS) {
        Write-Host "`n    [!] 上传超时，继续后续步骤..." -ForegroundColor Yellow
        break
    }
}

if (-not $uploadComplete) {
    Write-Host "    [!] 未能确认上传状态，请手动检查" -ForegroundColor Yellow
}

Start-Sleep -Seconds 1

# 6. 填写标题和简介
Write-Host "`n[6/7] 填写发布信息..." -ForegroundColor Yellow
$snapshot = Get-AgentBrowser

# 6a. 标题
if ($Title) {
    Write-Host "    填写标题: $Title" -ForegroundColor Gray
    $ref = Find-Ref 'textbox.*填写作品标题.*\[ref=(\w+)\]' $snapshot
    if ($ref) {
        # 用 fill 清空并重新填写（比 type 更可靠）
        agent-browser --cdp $CDP_PORT fill $ref $Title 2>&1 | Out-Null
        Write-Host "    [v] 标题已填写" -ForegroundColor Green
    } else {
        Write-Host "    [!] 未找到标题输入框" -ForegroundColor Yellow
    }
}

# 6b. 简介
if ($Description) {
    Write-Host "    填写简介: $Description" -ForegroundColor Gray
    $ref = Find-Ref 'editable.*contenteditable.*\[ref=(\w+)\]' $snapshot
    if ($ref) {
        agent-browser --cdp $CDP_PORT fill $ref $Description 2>&1 | Out-Null
        Write-Host "    [v] 简介已填写" -ForegroundColor Green
    } else {
        Write-Host "    [!] 未找到简介输入框" -ForegroundColor Yellow
    }
}

# 6c. 定时发布时间
if ($PublishTime) {
    Write-Host "    设置定时发布: $PublishTime" -ForegroundColor Gray
    $snapshot = Get-AgentBrowser

    # 先点击定时发布复选框
    $ref = Find-Ref 'checkbox "定时发布".*\[ref=(\w+)\]' $snapshot
    if ($ref) {
        agent-browser --cdp $CDP_PORT click $ref 2>&1 | Out-Null
        Start-Sleep -Seconds 1

        # 找到日期时间输入框并填入时间
        $snapshot = Get-AgentBrowser
        $dtRef = Find-Ref 'textbox "日期和时间".*\[ref=(\w+)\]' $snapshot
        if ($dtRef) {
            agent-browser --cdp $CDP_PORT fill $dtRef $PublishTime 2>&1 | Out-Null
            Write-Host "    [v] 定时发布时间已设置" -ForegroundColor Green
        } else {
            Write-Host "    [!] 未找到日期时间输入框" -ForegroundColor Yellow
        }
    } else {
        Write-Host "    [!] 未找到定时发布复选框" -ForegroundColor Yellow
    }
}

# 7. 发布
if (-not $SkipPublish) {
    Write-Host "`n[7/7] 点击发布..." -ForegroundColor Yellow
    Start-Sleep -Seconds 1
    $snapshot = Get-AgentBrowser

    $ref = Find-Ref 'button "发布" \[ref=(\w+)\]' $snapshot
    if ($ref) {
        agent-browser --cdp $CDP_PORT click $ref 2>&1 | Out-Null
        Write-Host "    [v] 已点击发布！" -ForegroundColor Green
    } else {
        Write-Host "    [!] 未找到发布按钮，请手动发布" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[Done] 已跳过发布，文件已在编辑页面" -ForegroundColor Cyan
}

Write-Host "`n========== 上传完成 ==========`n" -ForegroundColor Magenta
