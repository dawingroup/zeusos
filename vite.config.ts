// ============================================================================
// VITE CONFIGURATION
// ZeusOS - Production Build Configuration
// ============================================================================

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProduction = mode === 'production';

  return {
    plugins: [
      react(),
      isProduction && visualizer({
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
      }),
    ].filter(Boolean),
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@/app': path.resolve(__dirname, './src/app'),
        '@/core': path.resolve(__dirname, './src/core'),
        '@/subsidiaries': path.resolve(__dirname, './src/subsidiaries'),
        '@/extensions': path.resolve(__dirname, './src/extensions'),
        '@/finishes': path.resolve(__dirname, './src/subsidiaries/finishes'),
        '@/assets': path.resolve(__dirname, './src/assets'),
        '@/styles': path.resolve(__dirname, './src/styles'),
        '@/modules': path.resolve(__dirname, './src/modules'),
        '@/shared': path.resolve(__dirname, './src/shared'),
        '@/testing': path.resolve(__dirname, './src/testing'),
        '@/integration': path.resolve(__dirname, './src/integration'),
      },
    },

    build: {
      target: 'es2020',
      outDir: 'dist',
      sourcemap: isProduction ? 'hidden' : true,
      minify: isProduction ? 'terser' : false,
      
      terserOptions: isProduction
        ? {
            compress: {
              // Drop noisy console.log + console.debug but keep console.info /
              // console.warn / console.error so diagnostic logs from hooks
              // (e.g. useCabinetGizmo, useSceneViewport, the floor-clamp
              // warning) survive to the user's console.
              pure_funcs: ['console.log', 'console.debug'],
              drop_debugger: true,
            },
            // Preserve function and class names so React component names
            // survive in minified error stacks (otherwise
            // "at Es (CabinetDetailPanel.tsx:72)" instead of
            // "at CabinetDetailPanel (CabinetDetailPanel.tsx:22)").
            keep_fnames: true,
            keep_classnames: true,
          }
        : undefined,

      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            'vendor-ui': ['lucide-react', 'recharts', 'framer-motion'],
            'vendor-mui': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
            'vendor-pdf': ['@react-pdf/renderer', 'jspdf', 'jspdf-autotable'],
          },
          
          chunkFileNames: isProduction
            ? 'assets/[name]-[hash].js'
            : 'assets/[name].js',
          
          entryFileNames: isProduction
            ? 'assets/[name]-[hash].js'
            : 'assets/[name].js',
          
          assetFileNames: isProduction
            ? 'assets/[name]-[hash].[ext]'
            : 'assets/[name].[ext]',
        },
      },

      chunkSizeWarningLimit: 500,
      reportCompressedSize: true,
    },

    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
      ],
    },

    server: {
      // Honour PORT from the environment (set by the Claude Code preview
      // runtime when autoPort is true) so the dev server can be assigned
      // any free port. Falls back to 3000 for direct `npm run dev` use.
      port: process.env.PORT ? Number(process.env.PORT) : 3000,
      strictPort: false,
      open: false,
      cors: true,
    },

    preview: {
      port: 4173,
      open: true,
    },

    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(
        process.env.npm_package_version || '0.1.0'
      ),
      'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
      // Polyfill for libraries that use Node.js Buffer (e.g., @react-pdf/renderer)
      global: 'globalThis',
    },
  };
})
