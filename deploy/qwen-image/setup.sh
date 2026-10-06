#!/usr/bin/env bash
# 在有 GPU 的机器上部署 Qwen-Image GGUF + ComfyUI
# 用法: ./setup.sh [GGUF文件名]    不带参数则列出仓库中的 .gguf 文件
set -euo pipefail

REPO="${REPO:-abenzerps/Qwen-Image-2.1-Uncensored-GGUF}"
DIR="${COMFY_DIR:-$HOME/ComfyUI}"
# 文本编码器 / VAE 默认取 Comfy-Org 的 Qwen-Image 官方拆分文件;
# 若模型页面另有说明,请用环境变量覆盖。
TE_URL="${TE_URL:-https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors}"
VAE_URL="${VAE_URL:-https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors}"

if [ $# -eq 0 ]; then
  echo "仓库 $REPO 中的 GGUF 文件:"
  curl -fsSL "https://huggingface.co/api/models/$REPO" \
    | python3 -c 'import sys,json; [print(" ",s["rfilename"]) for s in json.load(sys.stdin)["siblings"] if s["rfilename"].endswith(".gguf")]'
  echo "选好后运行: $0 <文件名>   (约 12GB 显存选 Q4,24GB 选 Q8)"
  exit 0
fi
GGUF="$1"

[ -d "$DIR" ] || git clone https://github.com/comfyanonymous/ComfyUI "$DIR"
[ -d "$DIR/custom_nodes/ComfyUI-GGUF" ] || git clone https://github.com/city96/ComfyUI-GGUF "$DIR/custom_nodes/ComfyUI-GGUF"

python3 -m venv "$DIR/venv"
# shellcheck disable=SC1091
. "$DIR/venv/bin/activate"
pip install -U pip
# NVIDIA 显卡的 torch 请按 https://pytorch.org 选对应 CUDA 版本(默认源通常已带 CUDA)
pip install -r "$DIR/requirements.txt" -r "$DIR/custom_nodes/ComfyUI-GGUF/requirements.txt"

mkdir -p "$DIR/models/unet" "$DIR/models/text_encoders" "$DIR/models/vae"
dl() { curl -fL -C - --retry 5 -o "$2" "$1"; }   # 支持断点续传
dl "https://huggingface.co/$REPO/resolve/main/$GGUF" "$DIR/models/unet/$(basename "$GGUF")"
dl "$TE_URL"  "$DIR/models/text_encoders/$(basename "$TE_URL")"
dl "$VAE_URL" "$DIR/models/vae/$(basename "$VAE_URL")"

echo "完成。启动: cd $DIR && . venv/bin/activate && python main.py --listen 0.0.0.0"
echo "在界面里用 'Unet Loader (GGUF)' 节点加载模型,文本编码器用 CLIPLoader(type=qwen_image),VAE 用 VAELoader。"
