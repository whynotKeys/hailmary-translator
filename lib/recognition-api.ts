import { convertToWav, blobToBytes } from "@/lib/audio-utils";

import { getSounds, getSoundBlob } from "@/lib/sound-api";

export type RecognitionCandidate = {
  id: string;
  distance: number;
};

function getRecognitionAPI() {
  const api = window.desktopAPI;

  if (!api) {
    throw new Error("음성 인식 기능은 Electron 앱에서만 사용할 수 있습니다.");
  }

  return api;
}

export function normalizeKorean(text: string) {
  return text
    .normalize("NFC")
    .trim()
    .replace(/[.,!?。！？]+$/g, "")
    .replace(/\s+/g, " ");
}

export async function recognizeKoreanVoice(blob: Blob) {
  const wav = await convertToWav(blob);
  const bytes = await blobToBytes(wav);

  return getRecognitionAPI().recognizeKorean(bytes);
}

export async function recognizeInputSound(blob: Blob) {
  const mappings = await getSounds();

  if (mappings.length === 0) {
    throw new Error("등록된 사운드가 없습니다.");
  }

  if (mappings.length > 30) {
    throw new Error("현재 인식 기능은 등록 사운드 30개까지 지원합니다.");
  }

  const inputWav = await convertToWav(blob);

  if (inputWav.size > 1024 * 1024) {
    throw new Error("입력 녹음이 너무 깁니다.");
  }

  const references = [];

  for (const item of mappings) {
    const soundBlob = await getSoundBlob(item.id);
    const wav = await convertToWav(soundBlob);

    if (wav.size > 1024 * 1024) {
      throw new Error(`"${item.korean}" 녹음이 너무 깁니다.`);
    }

    references.push({
      id: item.id,
      wavBytes: await blobToBytes(wav),
    });
  }

  const result = await getRecognitionAPI().recognizeSound({
    wavBytes: await blobToBytes(inputWav),
    references,
  });

  const matched = result.best
    ? mappings.find((item) => item.id === result.best?.id)
    : undefined;

  return {
    matched: matched ?? null,
    distance: result.best?.distance ?? null,
    candidates: result.candidates,
  };
}
