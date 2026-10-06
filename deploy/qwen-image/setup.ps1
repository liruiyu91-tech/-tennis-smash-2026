# Windows PowerShell 版: 在有 NVIDIA 显卡的 Windows 上部署 Qwen-Image GGUF + ComfyUI
# 用法: .\setup.ps1              列出仓库中的 .gguf 文件
#       .\setup.ps1 <文件名>     安装并下载
# 前提: 已安装 git 和 Python 3.10-3.12 (安装时勾选 Add to PATH)
param([string]$Gguf)
$ErrorActionPreference = "Stop"

$Repo = if ($env:REPO) { $env:REPO } else { "abenzerps/Qwen-Image-2.1-Uncensored-GGUF" }
$Dir  = if ($env:COMFY_DIR) { $env:COMFY_DIR } else { Join-Path $HOME "ComfyUI" }
$TeUrl  = if ($env:TE_URL)  { $env:TE_URL }  else { "https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors" }
$VaeUrl = if ($env:VAE_URL) { $env:VAE_URL } else { "https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors" }
# PyTorch CUDA 版本源; 新显卡(RTX 50 系)请改成 cu128
$TorchIndex = if ($env:TORCH_INDEX) { $env:TORCH_INDEX } else { "https://download.pytorch.org/whl/cu124" }

if (-not $Gguf) {
  Write-Host "仓库 $Repo 中的 GGUF 文件:"
  (Invoke-RestMethod "https://huggingface.co/api/models/$Repo").siblings |
    Where-Object { $_.rfilename -like "*.gguf" } | ForEach-Object { "  " + $_.rfilename }
  Write-Host "选好后运行: .\setup.ps1 <文件名>   (约 12GB 显存选 Q4, 24GB 选 Q8)"
  exit 0
}

if (-not (Test-Path $Dir)) { git clone https://github.com/comfyanonymous/ComfyUI $Dir }
$Gg = Join-Path $Dir "custom_nodes\ComfyUI-GGUF"
if (-not (Test-Path $Gg)) { git clone https://github.com/city96/ComfyUI-GGUF $Gg }

python -m venv "$Dir\venv"
$Py = "$Dir\venv\Scripts\python.exe"
& $Py -m pip install -U pip
& $Py -m pip install torch torchvision torchaudio --index-url $TorchIndex
& $Py -m pip install -r "$Dir\requirements.txt" -r "$Gg\requirements.txt"

foreach ($d in "unet","text_encoders","vae") { New-Item -ItemType Directory -Force "$Dir\models\$d" | Out-Null }
function Get-Model($url, $out) { curl.exe -L -C - --retry 5 -o $out $url; if ($LASTEXITCODE) { throw "下载失败: $url" } }
Get-Model "https://huggingface.co/$Repo/resolve/main/$Gguf" "$Dir\models\unet\$(Split-Path $Gguf -Leaf)"
Get-Model $TeUrl  "$Dir\models\text_encoders\$(Split-Path $TeUrl -Leaf)"
Get-Model $VaeUrl "$Dir\models\vae\$(Split-Path $VaeUrl -Leaf)"

Write-Host "完成。启动: cd $Dir ; .\venv\Scripts\python.exe main.py"
Write-Host "界面里用 'Unet Loader (GGUF)' 加载模型, CLIPLoader(type=qwen_image) 加载文本编码器, VAELoader 加载 VAE。"
