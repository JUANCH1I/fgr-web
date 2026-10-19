import FichaCarrera from '../components/FichaCarrera.astro';
import { consultaCarreras } from './tina-carreras';

// Regiones editables del sitio. El nombre y el wrapper deben coincidir con <TinaIsland>.
export const islas = {
  carrera: {
    wrapper: { tag: 'div' },
    fetch: () => consultaCarreras(),
    component: FichaCarrera,
    propsFromData: (resultado: any, params: URLSearchParams) => ({
      carrera: resultado.data.carreras.carreras.find((c: any) => c.slug === params.get('slug')),
    }),
  },
};
