import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// 🌟 THÊM DÒNG NÀY: Import plugin Tailwind
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // 🌟 THÊM VÀO ĐÂY: Khai báo plugin tailwindcss()
  plugins: [react(), tailwindcss()],
  
  build: {
    chunkSizeWarningLimit: 1000, 
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'EVAL' && warning.id && warning.id.includes('lottie-web')) {
          return;
        }
        warn(warning);
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('lottie-react') || id.includes('lottie-web')) {
              return 'vendor-lottie';
            }
            return 'vendor'; 
          }
        }
      }
    }
  }
});