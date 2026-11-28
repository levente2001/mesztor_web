import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
        details: resolve(import.meta.dirname, 'details.html'),
        login: resolve(import.meta.dirname, 'login.html'),
        shop: resolve(import.meta.dirname, 'shop.html'),
        checkoutSuccess: resolve(import.meta.dirname, 'checkout-success.html')
      }
    }
  }
});
