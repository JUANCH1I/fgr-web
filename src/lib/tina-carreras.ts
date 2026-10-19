import { requestWithMetadata } from '@tinacms/astro/data';
import { CarrerasDocument } from '../../tina/__generated__/types';
import carrerasJson from '../datos/carreras.json';

// Consulta de Tina "simulada": responde con el JSON local en vez de ir a Tina Cloud.
// Así el HTML estático se genera sin red, y el id de la consulta (hash de query + variables)
// es el mismo que ve el admin. Lo editado sin guardar llega como "overlay" desde el panel.
const variables = { relativePath: 'carreras.json' };
const respuesta = {
  data: { carreras: { __typename: 'Carreras', id: 'src/datos/carreras.json', ...carrerasJson } },
  query: CarrerasDocument,
  variables,
};

export const consultaCarreras = () =>
  requestWithMetadata(respuesta as any, { priority: 'primary' }) as Promise<{ data: typeof respuesta.data }>;
