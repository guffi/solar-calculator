import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/solar-calculator/',
  plugins: [react()],
});
