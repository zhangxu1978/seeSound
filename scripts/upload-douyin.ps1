# 抖音上传脚本调用入口
# 用法：
#   .\upload-douyin.ps1 "D:\path\to\video.mp4"
#   .\upload-douyin.ps1 "D:\path\to\video.mp4" -Title "我的标题"
#   .\upload-douyin.ps1 "D:\path\to\video.mp4" -SkipPublish

$ScriptPath = Join-Path $PSScriptRoot "douyin-upload.ps1"
& $ScriptPath @args
