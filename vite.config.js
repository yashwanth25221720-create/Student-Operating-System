import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-accordion', '@radix-ui/react-alert-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-dialog', '@radix-ui/react-toast', '@radix-ui/react-select', '@radix-ui/react-tabs', '@radix-ui/react-tooltip'],
          'vendor-animation': ['framer-motion', 'three'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-other': ['lucide-react', 'date-fns', 'clsx', 'tailwind-merge'],
        },
      },
    },
    chunkSizeWarningLimit: 650,
  },
});
