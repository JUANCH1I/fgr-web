import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contarCaracteres,
  debeMostrarContador,
  superaMaximo,
  textoEnviable,
  formatearFechaCarta,
  claveRespaldoCarta,
  leerRespaldo,
  serializarRespaldo,
  fusionarBorrador,
  resumirExpediente,
  interpretarErrorCarta,
  crearAutoguardado,
  type EstadoAutoguardado,
  type ResultadoGuardado
} from '../src/lib/carta-pure.ts';

test('contarCaracteres cuenta puntos de código como el servidor', () => {
  assert.equal(contarCaracteres('abc'), 3);
  assert.equal(contarCaracteres('a😀b'), 3);
  assert.equal(contarCaracteres(''), 0);
});

test('contador visible solo cerca del límite y límite estricto', () => {
  assert.equal(debeMostrarContador(89_999), false);
  assert.equal(debeMostrarContador(90_000), true);
  assert.equal(superaMaximo(100_000), false);
  assert.equal(superaMaximo(100_001), true);
});

test('textoEnviable rechaza vacío y solo espacios', () => {
  assert.equal(textoEnviable(''), false);
  assert.equal(textoEnviable('  \n\t '), false);
  assert.equal(textoEnviable(' hola '), true);
});

test('formatearFechaCarta devuelve fecha larga o vacío', () => {
  assert.match(formatearFechaCarta('2026-10-16T15:00:00.000Z'), /16 de octubre de 2026/);
  assert.equal(formatearFechaCarta(null), '');
  assert.equal(formatearFechaCarta('no-es-fecha'), '');
});

test('respaldo: serializa, lee y descarta datos corruptos', () => {
  assert.equal(claveRespaldoCarta('abc'), 'fgrec_carta_borrador:abc');
  const r = { version: 2, texto: 'hola\nmundo', sincronizado: false };
  assert.deepEqual(leerRespaldo(serializarRespaldo(r)), r);
  assert.equal(leerRespaldo(null), null);
  assert.equal(leerRespaldo('{no json'), null);
  assert.equal(leerRespaldo(JSON.stringify({ texto: 1 })), null);
});

test('fusionarBorrador: el respaldo sin sincronizar de la misma versión gana', () => {
  const servidor = { version: 1, texto: 'viejo' };
  const f = fusionarBorrador(servidor, { version: 1, texto: 'nuevo más largo', sincronizado: false });
  assert.deepEqual(f, { texto: 'nuevo más largo', recuperadoDelRespaldo: true });
});

test('fusionarBorrador: gana el servidor si el respaldo está sincronizado, es de otra versión, vacío o igual', () => {
  const servidor = { version: 2, texto: 'del servidor' };
  const base = { texto: 'local', version: 2, sincronizado: false };
  assert.equal(fusionarBorrador(servidor, { ...base, sincronizado: true }).recuperadoDelRespaldo, false);
  assert.equal(fusionarBorrador(servidor, { ...base, version: 1 }).recuperadoDelRespaldo, false);
  assert.equal(fusionarBorrador(servidor, { ...base, texto: '   ' }).recuperadoDelRespaldo, false);
  assert.equal(fusionarBorrador(servidor, { ...base, texto: 'del servidor' }).recuperadoDelRespaldo, false);
  assert.equal(fusionarBorrador(servidor, null).texto, 'del servidor');
});

test('resumirExpediente: documentos obligatorios y carta determinan si pasa a revisión', () => {
  const reqs = [
    { obligatorio: true, estado: 'RECIBIDO' },
    { obligatorio: true, estado: 'PENDIENTE' },
    { obligatorio: false, estado: 'PENDIENTE' }
  ];
  const a = resumirExpediente(reqs, true);
  assert.equal(a.obligatoriosTotal, 2);
  assert.equal(a.obligatoriosCompletos, 1);
  assert.equal(a.listoParaRevision, false);
  const b = resumirExpediente([{ obligatorio: true, estado: 'VALIDADO' }], false);
  assert.equal(b.documentosCompletos, true);
  assert.equal(b.listoParaRevision, false);
  assert.equal(resumirExpediente([{ obligatorio: true, estado: 'VALIDADO' }], true).listoParaRevision, true);
  assert.equal(resumirExpediente([{ obligatorio: true, estado: 'OBSERVADO' }], true).documentosCompletos, false);
});

test('interpretarErrorCarta clasifica los errores del contrato', () => {
  assert.equal(interpretarErrorCarta(401).sesionVencida, true);
  assert.equal(interpretarErrorCarta(409, 'LETTER_SENT').yaEnviada, true);
  assert.equal(interpretarErrorCarta(429).fatal, false);
  assert.equal(interpretarErrorCarta(413, 'PAYLOAD_TOO_LARGE').fatal, true);
  assert.equal(interpretarErrorCarta(400, 'INVALID_INPUT', 'vacía').mensaje, 'vacía');
  assert.equal(interpretarErrorCarta(503, 'PORTAL_DISABLED').fatal, false);
});

// --- Autoguardado con temporizadores falsos ---------------------------------------------------

function entorno(respuestas: ResultadoGuardado[], textoInicial?: string) {
  let ahora = 0;
  const timers = new Map<number, { en: number; fn: () => void }>();
  let id = 0;
  const guardados: string[] = [];
  const estados: EstadoAutoguardado[] = [];
  const confirmados: string[] = [];
  const pendientes: Array<() => void> = [];
  const a = crearAutoguardado({
    textoInicial,
    retrasoMs: 2000,
    esperasReintentoMs: [4000, 8000],
    setTimer: (fn, ms) => {
      timers.set(++id, { en: ahora + ms, fn });
      return id;
    },
    clearTimer: (i) => {
      timers.delete(i as number);
    },
    guardar: (texto) => {
      guardados.push(texto);
      const r = respuestas.shift() ?? { ok: true };
      return new Promise((res) => pendientes.push(() => res(r)));
    },
    alCambiarEstado: (e) => estados.push(e),
    alConfirmar: (t) => confirmados.push(t)
  });
  async function avanzar(ms: number) {
    ahora += ms;
    for (const [i, t] of [...timers]) {
      if (t.en <= ahora) {
        timers.delete(i);
        t.fn();
      }
    }
    await Promise.resolve();
  }
  async function resolver() {
    pendientes.shift()?.();
    await new Promise((r) => setImmediate(r));
  }
  return { a, avanzar, resolver, guardados, estados, confirmados, timers };
}

test('autoguardado: debounce de 2 s, un solo guardado por ráfaga de tecleo', async () => {
  const e = entorno([]);
  e.a.cambiar('h');
  await e.avanzar(1500);
  e.a.cambiar('ho');
  await e.avanzar(1500); // 3 s desde el primero, solo 1,5 s desde el último
  assert.deepEqual(e.guardados, []);
  await e.avanzar(600);
  assert.deepEqual(e.guardados, ['ho']);
  await e.resolver();
  assert.equal(e.a.estado(), 'guardado');
  assert.deepEqual(e.confirmados, ['ho']);
  assert.equal(e.a.haySinGuardar(), false);
});

test('autoguardado: vaciar guarda de inmediato y no hace nada si no hay cambios', async () => {
  const e = entorno([], 'base');
  e.a.vaciar();
  assert.deepEqual(e.guardados, []);
  e.a.cambiar('base + más');
  e.a.vaciar();
  assert.deepEqual(e.guardados, ['base + más']);
  await e.resolver();
  assert.equal(e.a.estado(), 'guardado');
});

test('autoguardado: volver al texto ya guardado cancela el guardado pendiente', async () => {
  const e = entorno([], 'igual');
  e.a.cambiar('igual!');
  e.a.cambiar('igual');
  await e.avanzar(5000);
  assert.deepEqual(e.guardados, []);
  assert.equal(e.a.estado(), 'guardado');
});

test('autoguardado: si el texto cambia mientras guarda, encadena otro guardado y no pierde la última versión', async () => {
  const e = entorno([]);
  e.a.cambiar('uno');
  await e.avanzar(2000);
  assert.deepEqual(e.guardados, ['uno']);
  e.a.cambiar('uno dos'); // durante el vuelo
  await e.resolver();
  assert.equal(e.a.haySinGuardar(), true);
  await e.avanzar(2000);
  assert.deepEqual(e.guardados, ['uno', 'uno dos']);
  await e.resolver();
  assert.equal(e.a.estado(), 'guardado');
  assert.deepEqual(e.confirmados, ['uno', 'uno dos']);
});

test('autoguardado: ante error reintenta con espera creciente y se recupera', async () => {
  const e = entorno([{ ok: false }, { ok: false }, { ok: true }]);
  e.a.cambiar('texto');
  await e.avanzar(2000);
  await e.resolver();
  assert.equal(e.a.estado(), 'error');
  await e.avanzar(3999);
  assert.equal(e.guardados.length, 1);
  await e.avanzar(1);
  assert.equal(e.guardados.length, 2);
  await e.resolver();
  assert.equal(e.a.estado(), 'error');
  await e.avanzar(8000);
  assert.equal(e.guardados.length, 3);
  await e.resolver();
  assert.equal(e.a.estado(), 'guardado');
  assert.equal(e.a.haySinGuardar(), false);
});

test('autoguardado: un error fatal detiene los reintentos', async () => {
  const e = entorno([{ ok: false, fatal: true, mensaje: 'enviada' }]);
  e.a.cambiar('x');
  await e.avanzar(2000);
  await e.resolver();
  assert.equal(e.a.estado(), 'detenido');
  assert.equal(e.timers.size, 0);
  e.a.cambiar('xy');
  await e.avanzar(60000);
  assert.equal(e.guardados.length, 1);
});

test('autoguardado: detener cancela lo pendiente y reanudar lo reprograma', async () => {
  const e = entorno([]);
  e.a.cambiar('abc');
  e.a.detener();
  await e.avanzar(10000);
  assert.deepEqual(e.guardados, []);
  e.a.reanudar();
  await e.avanzar(2000);
  assert.deepEqual(e.guardados, ['abc']);
});
