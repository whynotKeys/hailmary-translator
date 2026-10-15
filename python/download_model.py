from pathlib import Path
from huggingface_hub import snapshot_download

# 프로젝트 루트 경로
ROOT = Path(__file__).resolve().parent.parent

# 모델 저장 위치
MODEL_DIR = ROOT / "models" / "whisper-small"

snapshot_download(
    repo_id="Systran/faster-whisper-small",
    local_dir=str(MODEL_DIR),
)

print(f"모델 다운로드 완료: {MODEL_DIR}")