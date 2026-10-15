export {};

interface SoundMapping {
  id: string;
  korean: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
}

interface SaveSoundInput {
  korean: string;
  mimeType: string;
  bytes: number[];
}

interface SoundFileData {
  bytes: number[];
  mimeType: string;
}

declare global {
  interface Window {
    desktopAPI?: {
      getSounds: () => Promise<SoundMapping[]>;

      saveSound: (data: SaveSoundInput) => Promise<SoundMapping>;

      readSound: (id: string) => Promise<SoundFileData>;

      deleteSound: (id: string) => Promise<boolean>;

      updateSound: (id: string, korean: string) => Promise<SoundMapping>;

      recognizeKorean: (wavBytes: number[]) => Promise<{
        text: string;
      }>;

      recognizeSound: (payload: {
        wavBytes: number[];
        references: {
          id: string;
          wavBytes: number[];
        }[];
      }) => Promise<{
        best: {
          id: string;
          distance: number;
        } | null;
        candidates: {
          id: string;
          distance: number;
        }[];
      }>;
    };
  }
}
