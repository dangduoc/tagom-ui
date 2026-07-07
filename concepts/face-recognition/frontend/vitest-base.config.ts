import { defineConfig } from 'vitest/config';

// Ionic ships ESM with extensionless directory imports that Node's resolver
// rejects in jsdom mode — inline them so Vite transforms the imports instead.
export default defineConfig({
  test: {
    server: {
      deps: {
        inline: [/@ionic[\\/]/, /ionicons[\\/]/, /@stencil[\\/]/],
      },
    },
  },
});
