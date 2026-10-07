import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
    },
    build: {
      target: 'es2022',
      minify: 'esbuild',
      cssMinify: true,
      sourcemap: false,
      emptyOutDir: true,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 4000,
      rollupOptions: {
        output: {
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
          manualChunks(id) {
            if (id.includes('node_modules')) {
              // 1. Heavy Excel processing and file generation
              if (id.includes('xlsx')) {
                return 'vendor-xlsx';
              }
              // 2. Heavy PDF and canvas export engines
              if (
                id.includes('jspdf') ||
                id.includes('html2canvas') ||
                id.includes('canvg') ||
                id.includes('dompurify')
              ) {
                return 'vendor-pdf';
              }
              // 3. Recharts & D3 statistical charting engines
              if (id.includes('recharts') || id.includes('d3')) {
                return 'vendor-charts';
              }
              // 4. Cloud Firestore and Firebase Auth client
              if (id.includes('firebase')) {
                return 'vendor-firebase';
              }
              // 5. Lucide React SVG icon catalog
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              // 6. Motion animation engine
              if (id.includes('motion')) {
                return 'vendor-motion';
              }
              // 7. Visual celebration effects
              if (id.includes('canvas-confetti')) {
                return 'vendor-confetti';
              }
            }
          },
        },
      },
    },
    esbuild: {
      drop: isProd ? ['debugger'] : [],
      legalComments: 'none',
    },
    server: {
      // HMR is disabled in AI Studio environment
      hmr: false,
      watch: null,
    },
  };
});
