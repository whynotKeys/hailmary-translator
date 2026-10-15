const SAMPLE_RATE = 16000;

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function encodeWav(samples: Float32Array): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");

  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));

    view.setInt16(
      44 + i * 2,
      value < 0 ? Math.round(value * 32768) : Math.round(value * 32767),
      true,
    );
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export async function convertToWav(blob: Blob): Promise<Blob> {
  const audioContext = new AudioContext();

  try {
    const source = await audioContext.decodeAudioData(await blob.arrayBuffer());

    const targetLength = Math.ceil(source.duration * SAMPLE_RATE);

    const offline = new OfflineAudioContext(1, targetLength, SAMPLE_RATE);

    const sourceNode = offline.createBufferSource();
    sourceNode.buffer = source;
    sourceNode.connect(offline.destination);
    sourceNode.start();

    const rendered = await offline.startRendering();
    const samples = rendered.getChannelData(0);

    return encodeWav(samples);
  } finally {
    await audioContext.close();
  }
}

export async function blobToBytes(blob: Blob): Promise<number[]> {
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}
