import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

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
  build: {
    format: 'directory'
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404') && !page.includes('/mi-postulacion')
    })
  ]
});
