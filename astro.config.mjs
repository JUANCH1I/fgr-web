import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tina from '@tinacms/astro/integration';
import { tinaAdminDevRedirect } from '@tinacms/astro/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.fgrec.org',
  output: 'static',
  adapter: vercel({
    webAnalytics: { enabled: false }
  }),
  devToolbar: {
    enabled: false
  },
  vite: {
    plugins: [tinaAdminDevRedirect()],
    build: {
      assetsInlineLimit: 0
    }
  },
  build: {
    format: 'directory'
  },
  integrations: [
    tina(),
    sitemap({
      filter: (page) => !page.includes('/404') && !page.includes('/mi-postulacion')
    })
  ]
});
