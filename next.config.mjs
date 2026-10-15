/** @type {import('next').NextConfig} */
const nextConfig = {
  output:
    "export" /* Next.js의 결과물을 정적 HTML, CSS, JavaScript로 내보내는 설정 */,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
