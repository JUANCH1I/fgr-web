import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import fondos from './src/datos/fondos.json' with { type: 'json' };
import microcertificaciones from './src/datos/microcertificaciones.json' with { type: 'json' };

// Old Wix URLs that Google still has indexed: 301 to their new page so they keep their ranking.
const redirects = {
  '/quienes-somos': '/la-fundacion/',
  ...Object.fromEntries(fondos.fondos.map((f) => [f.rutaAnterior, `/fondos/${f.slug}/`])),
  ...Object.fromEntries(microcertificaciones.maestrias.map((m) => [m.rutaAnterior, `/microcertificaciones/${m.slug}/`]))
};

// https://astro.build/config
export default defineConfig({
  site: 'https://www.fgrec.org',
  output: 'static',
  redirects,
  adapter: vercel({
    webAnalytics: { enabled: false }
  }),
  devToolbar: {
    enabled: false
  },
  vite: {
    build: {
      assetsInlineLimit: 0
    }
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
