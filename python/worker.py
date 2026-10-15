
import json
import os
import sys
from pathlib import Path

import numpy as np
from scipy.fft import dct
from scipy.io import wavfile
from scipy.spatial.distance import cdist

# stdout은 Electron과 통신하는 JSON 전용
# 디버그 메시지는 stderr로 출력
ROOT = Path(__file__).resolve().parent.parent

MODEL_DIR = Path(
    os.environ.get(
        "MODEL_DIR",
        str(ROOT / "models" / "whisper-small")
    )
)

os.environ["HF_HUB_OFFLINE"] = "1"

_whisper = None


def get_whisper():
    global _whisper

    if _whisper is None:
        from faster_whisper import WhisperModel

        if not (MODEL_DIR / "model.bin").exists():
            raise RuntimeError(
                f"Whisper 모델을 찾을 수 없습니다: {MODEL_DIR}"
            )

        _whisper = WhisperModel(
            str(MODEL_DIR),
            device="cpu",
            compute_type="int8",
        )

    return _whisper


def recognize_korean(wav_path):
    model = get_whisper()

    segments, _ = model.transcribe(
        wav_path,
        language="ko",
        beam_size=5,
        vad_filter=True,
    )

    return " ".join(
        segment.text.strip()
        for segment in segments
    ).strip()


def read_audio(wav_path):
    rate, data = wavfile.read(wav_path)

    if rate != 16000:
        raise ValueError("16kHz WAV 파일만 지원합니다.")

    if data.ndim != 1:
        raise ValueError("모노 WAV 파일만 지원합니다.")

    if data.dtype != np.int16:
        raise ValueError("16-bit PCM WAV 파일만 지원합니다.")

    audio = data.astype(np.float32) / 32768.0

    if len(audio) < 1600:
        raise ValueError("녹음이 너무 짧습니다.")

    if len(audio) > rate * 6.1:
        raise ValueError("6초 이하의 녹음만 지원합니다.")

    # 10ms 단위로 앞뒤 무음 영역을 제거
    frame = 160
    blocks = len(audio) // frame

    if blocks == 0:
        raise ValueError("녹음이 너무 짧습니다.")

    energies = np.array([
        np.sqrt(np.mean(
            audio[i * frame:(i + 1) * frame] ** 2
        ))
        for i in range(blocks)
    ])

    threshold = max(0.008, float(energies.max()) * 0.08)
    active = np.where(energies >= threshold)[0]

    if len(active) == 0:
        raise ValueError("인식할 소리가 없습니다.")

    start = max(0, int(active[0]) * frame - 1600)
    end = min(
        len(audio),
        (int(active[-1]) + 1) * frame + 1600
    )

    trimmed = audio[start:end]

    if len(trimmed) < 3200:
        raise ValueError("유효한 소리가 너무 짧습니다.")

    return trimmed


def mel_filterbank(sample_rate=16000, n_fft=512, n_mels=32):
    def hz_to_mel(hz):
        return 2595.0 * np.log10(1 + hz / 700.0)

    def mel_to_hz(mel):
        return 700.0 * (10 ** (mel / 2595.0) - 1)

    mel_points = np.linspace(
        hz_to_mel(80),
        hz_to_mel(7600),
        n_mels + 2
    )

    hz_points = mel_to_hz(mel_points)
    bins = np.floor(
        (n_fft + 1) * hz_points / sample_rate
    ).astype(int)

    filters = np.zeros(
        (n_mels, n_fft // 2 + 1),
        dtype=np.float32
    )

    for m in range(1, n_mels + 1):
        left = bins[m - 1]
        center = bins[m]
        right = bins[m + 1]

        for k in range(left, center):
            if center > left:
                filters[m - 1, k] = (
                    (k - left) / (center - left)
                )

        for k in range(center, right):
            if right > center:
                filters[m - 1, k] = (
                    (right - k) / (right - center)
                )

    return filters


MEL_FILTERS = mel_filterbank()


def extract_mfcc(wav_path):
    audio = read_audio(wav_path)

    # 32ms 프레임, 20ms 간격
    frame_size = 512
    hop = 320

    if len(audio) < frame_size:
        raise ValueError("소리가 너무 짧습니다.")

    frames = np.lib.stride_tricks.sliding_window_view(
        audio, frame_size
    )[::hop]

    window = np.hanning(frame_size).astype(np.float32)

    spectrum = np.abs(
        np.fft.rfft(frames * window, axis=1)
    ) ** 2

    mel_energy = spectrum @ MEL_FILTERS.T
    log_mel = np.log(mel_energy + 1e-8)

    mfcc = dct(
        log_mel,
        type=2,
        axis=1,
        norm="ortho"
    )[:, :13]

    # 평균 제거 및 분산 정규화
    mean = mfcc.mean(axis=0)
    std = mfcc.std(axis=0) + 1e-6

    return ((mfcc - mean) / std).astype(np.float32)


def dtw_distance(a, b):
    costs = cdist(a, b, metric="euclidean")
    n, m = costs.shape

    previous = np.full(m + 1, np.inf)
    previous[0] = 0.0

    for i in range(1, n + 1):
        current = np.full(m + 1, np.inf)

        for j in range(1, m + 1):
            current[j] = costs[i - 1, j - 1] + min(
                previous[j],
                current[j - 1],
                previous[j - 1]
            )

        previous = current

    # 프레임 수에 따른 대략적인 거리 정규화
    return float(previous[m] / max(n, m))


def match_sound(wav_path, references):
    target = extract_mfcc(wav_path)
    results = []

    for ref in references:
        try:
            source = extract_mfcc(ref["wavPath"])

            distance = dtw_distance(target, source)

            results.append({
                "id": ref["id"],
                "distance": round(distance, 4)
            })
        except Exception as error:
            print(
                f"Skipping {ref.get('id')}: {error}",
                file=sys.stderr
            )

    results.sort(key=lambda item: item["distance"])

    return {
        "best": results[0] if results else None,
        "candidates": results[:3]
    }


def handle_request(request):
    kind = request["kind"]

    if kind == "stt":
        return {
            "text": recognize_korean(request["wavPath"])
        }

    if kind == "match":
        return match_sound(
            request["wavPath"],
            request["references"]
        )

    raise ValueError(f"지원하지 않는 요청: {kind}")


def send(message):
    print(
        json.dumps(message, ensure_ascii=True),
        flush=True
    )


def main():
    send({"type": "ready"})

    for line in sys.stdin:
        try:
            request = json.loads(line)
            result = handle_request(request)

            send({
                "requestId": request["requestId"],
                "ok": True,
                "result": result
            })
        except Exception as error:
            send({
                "requestId": (
                    request.get("requestId")
                    if isinstance(request, dict)
                    else None
                ),
                "ok": False,
                "error": str(error)
            })


if __name__ == "__main__":
    main()
