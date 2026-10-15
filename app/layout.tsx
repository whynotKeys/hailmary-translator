import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import "./globals.css";

const mona10x12 = localFont({
  src: "../public/fonts/Mona10x12.woff2",
  display: "swap",
  weight: "45 920",
  style: "normal",
  variable: "--font-Mona10x12",
});

export const metadata: Metadata = {
  title: "사운드 번역기 · Sound Translator",
  description: "한국어 단어와 녹음한 사운드를 연결하는 오프라인 번역기",
  icons: {
    icon: [
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`dark bg-background ${mona10x12.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
