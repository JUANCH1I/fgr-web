import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const customLoader = (filePath: string, key: string) => {
  return {
    name: 'custom-json-array-loader',
    load: async ({ store, logger }: any) => {
      const fs = await import('node:fs');
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const items = raw[key] || [];
      store.clear();
      for (const item of items) {
        store.set({
          id: item.slug || item.id || String(Math.random()),
          data: item,
        });
      }
    }
  };
};

export const collections = {
  legales: defineCollection({
    loader: glob({ pattern: '*.md', base: './src/contenido/legales' }),
    schema: z.object({ titulo: z.string() }),
  }),
  carreras: defineCollection({
    loader: customLoader('src/datos/carreras.json', 'carreras'),
    schema: z.object({
      slug: z.string(),
      nombre: z.string(),
    }).passthrough(),
  }),
  cursos: defineCollection({
    loader: customLoader('src/datos/cursos.json', 'cursos'),
    schema: z.object({
      nombre: z.string(),
    }).passthrough(),
  }),
  fondos: defineCollection({
    loader: customLoader('src/datos/fondos.json', 'fondos'),
    schema: z.object({
      slug: z.string().optional(),
    }).passthrough(),
  }),
  microcertificaciones: defineCollection({
    loader: customLoader('src/datos/microcertificaciones.json', 'maestrias'),
    schema: z.object({
      titulo: z.string().optional(),
    }).passthrough(),
  })
};
