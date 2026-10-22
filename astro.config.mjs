import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import fondos from './src/datos/fondos.json' with { type: 'json' };
import microcertificaciones from './src/datos/microcertificaciones.json' with { type: 'json' };

// Old Wix URLs that Google still has indexed: 301 to their new page so they keep their ranking.
// Browsers request accented paths percent-encoded and Vercel matches the raw path, so register both forms.
const ambasFormas = (ruta, destino) => [[ruta, destino], [encodeURI(ruta), destino]];
const redirects = Object.fromEntries([
  ['/quienes-somos', '/la-fundacion/'],
  ...fondos.fondos.flatMap((f) => ambasFormas(f.rutaAnterior, `/fondos/${f.slug}/`)),
  ...microcertificaciones.maestrias.flatMap((m) => ambasFormas(m.rutaAnterior, `/microcertificaciones/${m.slug}/`))
]);

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
