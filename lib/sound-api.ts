export type SoundMapping = {
  id: string;
  korean: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
};

function getDesktopAPI() {
  if (typeof window === "undefined" || !window.desktopAPI) {
    throw new Error("Electron 데스크톱 앱에서 실행해주세요.");
  }

  return window.desktopAPI;
}

export async function getSounds() {
  return getDesktopAPI().getSounds();
}

export async function saveSound(korean: string, blob: Blob) {
  const buffer = await blob.arrayBuffer();

  const bytes = Array.from(new Uint8Array(buffer));

  return getDesktopAPI().saveSound({
    korean: korean.trim(),
    bytes,
    mimeType: blob.type,
  });
}

export async function deleteSound(id: string) {
  return getDesktopAPI().deleteSound(id);
}

export async function getSoundBlob(id: string) {
  const result = await getDesktopAPI().readSound(id);

  return new Blob([Uint8Array.from(result.bytes)], {
    type: result.mimeType,
  });
}

export async function playSound(id: string) {
  const blob = await getSoundBlob(id);
  const url = URL.createObjectURL(blob);

  try {
    const audio = new Audio(url);

    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("소리 재생에 실패했습니다."));
      audio.play().catch(reject);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function speakKorean(text: string) {
  const synth = window.speechSynthesis;

  const localVoice = synth
    .getVoices()
    .find(
      (voice) =>
        voice.lang.toLowerCase().startsWith("ko") && voice.localService,
    );

  if (!localVoice) {
    throw new Error("PC에 사용 가능한 로컬 한국어 TTS 음성이 없습니다.");
  }

  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.lang = "ko-KR";
  utterance.voice = localVoice;
  utterance.rate = 1;
  utterance.pitch = 1;

  synth.speak(utterance);
}

export async function updateSound(
  id: string,
  korean: string,
): Promise<SoundMapping> {
  return getDesktopAPI().updateSound(id, korean.trim());
}
