import os
from pathlib import Path
from faster_whisper import WhisperModel

os.environ["HF_HUB_OFFLINE"] = "1"

ROOT = Path(__file__).resolve().parent.parent

MODEL_DIR = Path(
    os.environ.get(
        "MODEL_DIR",
        str(ROOT / "models" / "whisper-small")
    )
)

model = WhisperModel(
    str(MODEL_DIR),
    device="cpu",
    compute_type="int8"
)

def recognize_korean(audio_path: str) -> str:
    segments, _ = model.transcribe(
        audio_path,
        language="ko",
        beam_size=5,
        vad_filter=True
    )

    return " ".join(
        segment.text.strip()
        for segment in segments
    ).strip()
