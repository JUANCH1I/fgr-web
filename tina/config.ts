import { defineConfig } from 'tinacms';

// Tina Cloud: variables a definir en Vercel (ver README / AGENTS.md).
const branch = process.env.VERCEL_GIT_COMMIT_REF || 'main';

// Los archivos de src/datos/*.json se importan directo desde las páginas y componentes,
// así que cada uno es UN documento de Tina con la misma forma que el JSON original.
// Tina descarta al guardar toda clave que no esté en este esquema: si se agrega un campo
// nuevo al JSON, hay que sumarlo acá también.

// --- Ayudas para no repetir ---
const texto = (name: string, label: string, description?: string) => ({
  type: 'string' as const, name, label, ...(description ? { description } : {}),
});
const largo = (name: string, label: string, description?: string) => ({
  type: 'string' as const, name, label, ...(description ? { description } : {}),
  ui: { component: 'textarea' },
});
const opciones = (name: string, label: string, options: string[], description?: string) => ({
  type: 'string' as const, name, label, options, ...(description ? { description } : {}),
});
const si_no = (name: string, label: string, description?: string) => ({
  type: 'boolean' as const, name, label, ...(description ? { description } : {}),
});
const numero = (name: string, label: string, description?: string) => ({
  type: 'number' as const, name, label, ...(description ? { description } : {}),
});
const imagen = (name: string, label: string, description?: string) =>
  texto(name, label, `Nombre del archivo de imagen (ej.: 64d480_xxx~mv2.jpg). ${description ?? ''}`.trim());
const slug = (name = 'slug') =>
  texto(name, 'Slug (parte de la dirección web)', 'ATENCIÓN: no lo cambies. Es parte de la dirección de la página; si lo modificás, el enlace deja de funcionar. Solo minúsculas, números y guiones.');
// "_nota" y "_pendiente" son anotaciones internas: empiezan con guion bajo en el JSON.
const nota = (description: string) => largo('_nota', 'Nota interna', description);
const pendiente = () =>
  largo('_pendiente', 'Pendiente de confirmar', 'Marca un dato que hay que confirmar. No se muestra en el sitio. Dejar vacío si no hay nada pendiente.');
const lista = (name: string, label: string, fields: any[], titulo: (i: any) => string, description?: string) => ({
  type: 'object' as const, name, label, list: true, fields, ...(description ? { description } : {}),
  ui: { itemProps: (item: any) => ({ label: titulo(item) || '(sin título)' }) },
});
const soloEdicion = { allowedActions: { create: false, delete: false } };
const unico = (nombre: string) => ({ include: nombre });

export default defineConfig({
  branch,
  clientId: process.env.TINA_PUBLIC_CLIENT_ID,
  token: process.env.TINA_TOKEN,
  build: { outputFolder: 'admin', publicFolder: 'public' },
  schema: {
    collections: [
      // ---------------------------------------------------------------- sitio.json
      {
        name: 'sitio',
        label: 'Datos del sitio',
        path: 'src/datos',
        format: 'json',
        match: unico('sitio'),
        ui: soloEdicion,
        fields: [
          nota('Datos generales del sitio: nombre, contacto, menú, redes, pie y enlaces de los botones principales. Lo que cambies acá se aplica a todas las páginas.'),
          texto('nombre', 'Nombre completo de la fundación'),
          texto('nombreCorto', 'Nombre corto'),
          texto('dominio', 'Dirección del sitio', 'Dirección completa, con https://. No cambiar sin avisar al equipo técnico.'),
          texto('idioma', 'Idioma', 'Código del idioma (es).'),
          imagen('logo', 'Logo'),
          imagen('imagenCompartir', 'Imagen al compartir en redes', 'Es la que aparece cuando se comparte el sitio en redes sociales o WhatsApp.'),
          {
            type: 'object', name: 'contacto', label: 'Contacto',
            fields: [
              texto('direccion', 'Dirección'),
              texto('ciudad', 'Ciudad'),
              texto('telefono', 'Teléfono'),
              texto('correo', 'Correo electrónico'),
              texto('mapa', 'Enlace al mapa', 'Enlace de Google Maps.'),
            ],
          },
          {
            type: 'object', name: 'enlaces', label: 'Enlaces de los botones principales',
            fields: [
              nota('Notas sobre estos enlaces.'),
              texto('asesor', 'Botón «Hablar ahora con un asesor»', 'A dónde lleva el botón. Puede ser /contacto/ o un enlace de WhatsApp como https://wa.me/593963017631.'),
              texto('resolucion', 'Enlace «Ver resolución»', 'PDF de la resolución (con los documentos de los fundadores tapados). Mientras esté vacío, el enlace no se muestra.'),
            ],
          },
          {
            type: 'object', name: 'formularios', label: 'Formularios',
            fields: [
              nota('Dirección que recibe los formularios de Contacto y de «Evaluar mis estudios». Ahora procesado internamente con Resend en /api/formulario/.'),
              texto('destino', 'Dirección que recibe los formularios', 'No cambiar sin avisar al equipo técnico: si se modifica, los formularios dejan de funcionar.'),
            ],
          },
          lista('menu', 'Menú principal', [
            texto('texto', 'Texto'),
            texto('url', 'Dirección (URL)', 'Ej.: /carreras/'),
            lista('submenu', 'Submenú (opcional)', [
              texto('texto', 'Texto'),
              texto('url', 'Dirección (URL)'),
            ], (i) => i?.texto, 'Opciones desplegables de este ítem. Dejar vacío si no tiene.'),
          ], (i) => i?.texto),
          lista('redes', 'Redes sociales', [
            texto('nombre', 'Red social'),
            texto('url', 'Enlace'),
          ], (i) => i?.nombre),
          {
            type: 'object', name: 'pie', label: 'Pie de página',
            fields: [
              texto('oficinas', 'Texto de oficinas'),
              lista('enlaces', 'Enlaces del pie', [texto('texto', 'Texto'), texto('url', 'Dirección (URL)')], (i) => i?.texto),
              lista('legales', 'Enlaces legales', [texto('texto', 'Texto'), texto('url', 'Dirección (URL)')], (i) => i?.texto),
              largo('resolucion', 'Texto de la resolución'),
            ],
          },
          lista('convenios', 'Convenios (lista de la portada)', [
            texto('nombre', 'Institución'),
            texto('pais', 'País'),
            texto('tipo', 'Tipo de institución'),
          ], (i) => i?.nombre),
          {
            type: 'object', name: 'redirecciones', label: 'Redirecciones del sitio anterior',
            description: 'Direcciones del sitio anterior (Wix) y a dónde llevan ahora. Las de los fondos y las maestrías se agregan solas desde su campo «Ruta anterior». Solo se pueden editar los destinos; para agregar una redirección nueva, consultá al equipo técnico.',
            fields: [
              nota('Notas sobre las redirecciones.'),
              ...['/diplomados', '/microcertifiaciones-academicas', '/fondos', '/inicio', '/home'].map((ruta) => ({
                type: 'string' as const, name: 'r' + ruta.replace(/[^a-z0-9]/gi, '_'), nameOverride: ruta,
                label: `Desde ${ruta}`, description: 'Destino al que lleva esta dirección antigua.',
              })),
            ],
          },
        ],
      },

      // ------------------------------------------------------------- carreras.json
      {
        name: 'carreras',
        label: 'Carreras',
        path: 'src/datos',
        format: 'json',
        match: unico('carreras'),
        ui: soloEdicion,
        fields: [
          nota('Carreras de las universidades aliadas. Cada una genera su ficha en /carreras/<slug>/. Para sumar una carrera, copia un bloque completo, cambia el slug (solo minúsculas, números y guiones) y completa los datos. "orden" define el orden en el listado.'),
          lista('carreras', 'Carreras', [
            slug(),
            texto('nombre', 'Nombre de la carrera'),
            opciones('nivel', 'Nivel', ['Ciclo de Licenciatura (CCC)', 'Licenciatura', 'Profesorado', 'Tecnicatura', 'Maestría', 'Doctorado', 'Especialización']),
            opciones('area', 'Área', ['Salud y Rehabilitación', 'Seguridad', 'Discapacidad e Inclusión Social', 'Tecnología y Negocios', 'Diseño', 'Ciencias Sociales y Educación', 'Agroganadería']),
            texto('universidad', 'Universidad'),
            texto('pais', 'País'),
            texto('titulo', 'Título que se obtiene'),
            texto('tituloIntermedio', 'Título intermedio', 'Opcional. Dejar vacío si no tiene.'),
            texto('duracion', 'Duración', 'Ej.: 2 años y medio'),
            opciones('modalidad', 'Modalidad', ['A distancia', 'A distancia, con instancias presenciales']),
            si_no('instanciasPresenciales', 'Tiene instancias presenciales'),
            largo('detalleModalidad', 'Detalle de la modalidad', 'Opcional. Dejar vacío si no hace falta aclarar.'),
            opciones('viaIngreso', 'Vía de ingreso', ['Con título técnico o tecnológico de 2½ años o más', 'Con bachillerato aprobado', 'Con título previo', 'Con título de grado']),
            largo('requisitos', 'Requisitos de ingreso'),
            largo('perfil', 'Perfil del egresado'),
            lista('plan', 'Plan de estudios', [
              texto('periodo', 'Período', 'Ej.: Primer año · 1.er cuatrimestre'),
              {
                type: 'string', name: 'materias', label: 'Materias', list: true,
                description: 'Una materia por ítem, en el orden en que se cursan.',
              },
            ], (i) => i?.periodo),
            texto('direccion', 'Dirección de la carrera', 'Nombre de quien dirige la carrera.'),
            numero('orden', 'Orden en el listado', 'Define el orden en el listado (1, 2, 3...).'),
          ], (i) => i?.nombre),
        ],
      },

      // --------------------------------------------------------------- fondos.json
      {
        name: 'fondos',
        label: 'Fondos (PCEA)',
        path: 'src/datos',
        format: 'json',
        match: unico('fondos'),
        ui: soloEdicion,
        fields: [
          nota('Los seis fondos del Programa de Cooperación y Excelencia Académica (PCEA). Cada fondo genera su propia página en /fondos/<slug>/. En la oferta, "carrera" es el slug de la ficha (ver Carreras); si queda vacío, la tarjeta se muestra sin enlace a ficha y lleva al asesor. Si "texto" queda vacío, se toma la primera oración del perfil del egresado de la ficha.'),
          lista('fondos', 'Fondos', [
            slug(),
            texto('rutaAnterior', 'Ruta anterior (sitio Wix)', 'Dirección del sitio anterior que ahora redirige a este fondo. No cambiar.'),
            texto('antetitulo', 'Antetítulo', 'Línea chica sobre el título.'),
            texto('titulo', 'Título'),
            largo('resumen', 'Resumen (tarjeta)'),
            imagen('imagenTarjeta', 'Imagen de la tarjeta'),
            imagen('imagenCabecera', 'Imagen de cabecera'),
            largo('entrada', 'Texto de entrada'),
            largo('finalidad', 'Finalidad', 'Opcional. Si queda vacío, no se muestra.'),
            lista('objetivos', 'Objetivos', [
              texto('titulo', 'Título'),
              largo('texto', 'Texto'),
            ], (i) => i?.titulo),
            largo('usoEstrategico', 'Uso estratégico', 'Opcional. Si queda vacío, no se muestra.'),
            lista('oferta', 'Oferta académica', [
              texto('grupo', 'Grupo', 'Ej.: Tecnicaturas, Maestrías...'),
              opciones('nivel', 'Nivel', ['Pregrado', 'Grado', 'Posgrado']),
              lista('carreras', 'Carreras del grupo', [
                texto('nombre', 'Nombre'),
                largo('texto', 'Texto', 'Si queda vacío, se toma la primera oración del perfil del egresado de la ficha.'),
                imagen('imagen', 'Imagen'),
                texto('carrera', 'Ficha de la carrera (slug)', 'Slug de la carrera en «Carreras». Si queda vacío, la tarjeta no enlaza a ninguna ficha y lleva al asesor.'),
                pendiente(),
              ], (i) => i?.nombre),
            ], (i) => [i?.grupo, i?.nivel].filter(Boolean).join(' · ')),
            {
              type: 'object', name: 'cierre', label: 'Cierre de la página',
              fields: [texto('titulo', 'Título'), largo('texto', 'Texto')],
            },
            pendiente(),
          ], (i) => i?.titulo),
        ],
      },

      // -------------------------------------------------------------- cursos.json
      {
        name: 'cursos',
        label: 'Cursos de formación continua',
        path: 'src/datos',
        format: 'json',
        match: unico('cursos'),
        ui: soloEdicion,
        fields: [
          nota('Cursos de Formación continua. Para ocultar uno sin borrarlo, desmarcá «Visible». Los marcados como finalizados en el sitio anterior quedaron ocultos.'),
          lista('cursos', 'Cursos', [
            texto('titulo', 'Título'),
            largo('texto', 'Descripción'),
            opciones('categoria', 'Categoría', ['Diplomatura', 'Curso', 'Micromáster', 'Seminario de posgrado']),
            texto('duracion', 'Duración', 'Ej.: 8 semanas'),
            texto('inicio', 'Inicio', 'Ej.: Abril 2026, o Abierto todo el año.'),
            si_no('visible', 'Visible en el sitio', 'Desmarcá para ocultar el curso sin borrarlo.'),
            imagen('imagen', 'Imagen'),
            pendiente(),
          ], (i) => i?.titulo),
        ],
      },

      // ----------------------------------------------- microcertificaciones.json
      {
        name: 'microcertificaciones',
        label: 'Maestrías y microcertificaciones',
        path: 'src/datos',
        format: 'json',
        match: unico('microcertificaciones'),
        ui: soloEdicion,
        fields: [
          nota('Maestrías cuyos seminarios se pueden cursar como microcertificaciones. Cada maestría genera su página en /microcertificaciones/<slug>/. «Ficha de la carrera» es el slug de su ficha en Carreras. Un seminario lleva «horas» o «tipo». «Pendiente de confirmar» marca un dato que hay que confirmar: no se muestra en el sitio.'),
          lista('maestrias', 'Maestrías', [
            slug(),
            texto('titulo', 'Título'),
            texto('carrera', 'Ficha de la carrera (slug)', 'Slug de la ficha de esta maestría en «Carreras».'),
            largo('resumen', 'Resumen'),
            imagen('imagen', 'Imagen'),
            texto('rutaAnterior', 'Ruta anterior (sitio Wix)', 'Dirección del sitio anterior que ahora redirige a esta maestría. No cambiar.'),
            texto('duracion', 'Duración', 'Ej.: 24 meses'),
            texto('modalidad', 'Modalidad'),
            texto('tituloObtenido', 'Título que se obtiene'),
            opciones('campo', 'Campo', ['Seguridad', 'Ciencias Sociales y Educación', 'Salud y Rehabilitación', 'Discapacidad e Inclusión']),
            lista('areas', 'Áreas', [
              texto('nombre', 'Nombre del área'),
              lista('seminarios', 'Seminarios', [
                texto('nombre', 'Nombre'),
                largo('texto', 'Descripción'),
                numero('horas', 'Horas', 'Completar «Horas» o «Tipo», no ambos.'),
                opciones('tipo', 'Tipo', ['Seminario', 'Taller', 'Práctica profesional', 'Actividad práctica'], 'Completar «Horas» o «Tipo», no ambos.'),
                pendiente(),
              ], (i) => i?.nombre),
              pendiente(),
            ], (i) => i?.nombre),
            pendiente(),
          ], (i) => i?.titulo),
        ],
      },

      // ---------------------------------------------------------- páginas legales
      {
        name: 'legales',
        label: 'Páginas legales',
        path: 'src/contenido/legales',
        format: 'md',
        ui: soloEdicion,
        fields: [
          { type: 'string', name: 'titulo', label: 'Título de la página', isTitle: true, required: true },
          { type: 'rich-text', name: 'body', label: 'Texto', isBody: true },
        ],
      },
    ],
  },
});
