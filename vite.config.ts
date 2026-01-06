
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vercel 배포 최적화 및 React HMR 지원을 위한 Vite 설정
export default defineConfig({
  plugins: [react()],
  base: './', // 상대 경로 설정을 통해 다양한 호스팅 환경 대응
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 3000,
  }
});
