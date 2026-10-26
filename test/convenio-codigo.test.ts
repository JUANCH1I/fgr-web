import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DECLARACION_ACEPTACION,
  ESPERA_REENVIO_SEGUNDOS,
  cuerpoAceptacionConCodigo,
  cuerpoSolicitudCodigo,
  interpretarErrorConvenio,
  leerConvenio,
  mensajeCodigoEnviado,
  prepararCuerpoAceptacion,
  prepararCuerpoCodigo,
  segundosParaReenvio,
  validarConsentimientos
} from '../src/lib/convenio-pure.ts';
import { manejarAceptacionConvenio, manejarCodigoConvenio } from '../src/lib/convenio-proxy.ts';
import { COOKIE_SESION_NOMBRE } from '../src/lib/fgrec-portal.ts';

const HASH = 'ab'.repeat(32);
const dinero = (cents: number, formatted: string) => ({ cents, formatted });
const CLICKWRAP = {
  consentimientoElectronico: 'Consiento usar medios electrónicos (texto de la API).',
  consentimientoContractual: 'Leí y acepto el convenio (texto de la API).',
  avisoElectronico: 'Aviso: puedes pedir una copia en papel (texto de la API).',
  requiereCodigo: true
};

function respuesta(sobre: Record<string, unknown> = {}) {
  return {
    estado: 'GENERADO', version: 3, titulo: 'Convenio de Corresponsabilidad', textoEnBorrador: false, aceptadoEn: null,
    puedeAceptar: true, declaracion: DECLARACION_ACEPTACION,
    resumen: {
      beneficiario: 'Ana', pais: 'Uruguay', carrera: 'Psicomotricidad', modalidad: null, cohorte: 'Marzo 2027', incorporacion: null,
      plan: 'Plan', pvp: dinero(35000, '350,00'), valorMensualPais: dinero(30500, '305,00'),
      beneficio: { etiqueta: 'Beneficio', porcentaje: '5 %' }, total: dinero(1390800, '13.908,00'), cantidadPagos: 53, mesesDeEstudio: 48, resumenPagos: 'x'
    },
    pdf: { sha256: HASH, nombreArchivo: 'c.pdf' },
    ...sobre
  };
}
const conCodigo = () => leerConvenio(respuesta({ clickwrap: CLICKWRAP }));

test('leerConvenio: sin la clave clickwrap el convenio es el de una casilla; con ella trae los textos de la API', () => {
  assert.equal(leerConvenio(respuesta()).clickwrap, null);
  assert.equal(leerConvenio(respuesta({ clickwrap: null })).clickwrap, null);
  assert.deepEqual(conCodigo().clickwrap, {
    consentimientoElectronico: CLICKWRAP.consentimientoElectronico,
    consentimientoContractual: CLICKWRAP.consentimientoContractual,
    avisoElectronico: CLICKWRAP.avisoElectronico
  });
});

test('leerConvenio: un clickwrap pendiente incompleto no se puede aceptar (falla cerrado, sin inventar textos)', () => {
  for (const raro of [{}, { ...CLICKWRAP, consentimientoElectronico: '' }, { ...CLICKWRAP, avisoElectronico: 5 }, { ...CLICKWRAP, requiereCodigo: false }, 'x']) {
    const c = leerConvenio(respuesta({ clickwrap: raro }));
    assert.equal(c.estado, 'SIN_GENERAR', JSON.stringify(raro));
    assert.equal(c.puedeAceptar, false);
  }
  // Un convenio ya aceptado es de solo lectura: no depende de los textos del consentimiento.
  assert.equal(leerConvenio(respuesta({ estado: 'ACEPTADO', aceptadoEn: '2026-10-26T15:00:00.000Z', clickwrap: {} })).estado, 'ACEPTADO');
});

test('validarConsentimientos: hacen falta las dos casillas, cada una con su mensaje', () => {
  assert.deepEqual(validarConsentimientos({ medios: true, convenio: true }), { ok: true });
  const sinMedios: any = validarConsentimientos({ medios: false, convenio: true });
  assert.equal(sinMedios.ok, false);
  assert.match(sinMedios.message, /medios electrónicos/);
  const sinConvenio: any = validarConsentimientos({ medios: true, convenio: false });
  assert.equal(sinConvenio.ok, false);
  assert.match(sinConvenio.message, /leíste y aceptas el convenio/);
  assert.equal((validarConsentimientos({ medios: false, convenio: false }) as any).ok, false);
});

test('cuerpoSolicitudCodigo y cuerpoAceptacionConCodigo: versión, huella, las dos casillas y el código', () => {
  assert.deepEqual(cuerpoSolicitudCodigo(conCodigo()), { version: 3, sha256: HASH, aceptoMediosElectronicos: true, aceptoConvenio: true });
  assert.deepEqual(cuerpoAceptacionConCodigo(conCodigo(), '123456'), {
    version: 3, sha256: HASH, aceptoMediosElectronicos: true, aceptoConvenio: true, codigo: '123456'
  });
  assert.equal(cuerpoAceptacionConCodigo(conCodigo(), '12345'), null);
  assert.equal(cuerpoAceptacionConCodigo(conCodigo(), '12a456'), null);
  // Sin clickwrap, o sin poder aceptar, no hay cuerpo de código.
  assert.equal(cuerpoSolicitudCodigo(leerConvenio(respuesta())), null);
  assert.equal(cuerpoAceptacionConCodigo(leerConvenio(respuesta()), '123456'), null);
  assert.equal(cuerpoSolicitudCodigo(leerConvenio(respuesta({ clickwrap: CLICKWRAP, puedeAceptar: false }))), null);
});

test('prepararCuerpoCodigo: exige las dos casillas, versión y huella; reenvía solo eso', () => {
  const ok = { version: 1, sha256: HASH, aceptoMediosElectronicos: true, aceptoConvenio: true };
  assert.deepEqual(prepararCuerpoCodigo({ ...ok, extra: 'x', codigo: '123456' }), { ok: true, cuerpo: ok });
  assert.equal((prepararCuerpoCodigo({ ...ok, aceptoMediosElectronicos: false }) as any).field, 'aceptoMediosElectronicos');
  assert.equal((prepararCuerpoCodigo({ ...ok, aceptoConvenio: 'true' }) as any).field, 'aceptoConvenio');
  assert.equal((prepararCuerpoCodigo({ ...ok, version: 0 }) as any).field, 'version');
  assert.equal((prepararCuerpoCodigo({ ...ok, sha256: 'x' }) as any).field, 'sha256');
  assert.equal((prepararCuerpoCodigo(null) as any).field, 'aceptoMediosElectronicos');
});

test('prepararCuerpoAceptacion: con código reenvía las casillas y el código; sin esos campos el cuerpo legado no cambia', () => {
  const ok = { version: 1, sha256: HASH, aceptoMediosElectronicos: true, aceptoConvenio: true, codigo: '000123' };
  assert.deepEqual(prepararCuerpoAceptacion({ ...ok, acepto: true, extra: 'x' }), { ok: true, cuerpo: ok });
  assert.equal((prepararCuerpoAceptacion({ ...ok, aceptoMediosElectronicos: false }) as any).field, 'aceptoMediosElectronicos');
  assert.equal((prepararCuerpoAceptacion({ ...ok, aceptoConvenio: undefined }) as any).field, 'aceptoConvenio');
  for (const codigo of [undefined, '', '12345', '1234567', '12 456', 123456, null]) {
    assert.equal((prepararCuerpoAceptacion({ ...ok, codigo }) as any).field, 'codigo', String(codigo));
  }
  // El flujo de una casilla sigue exactamente igual.
  assert.deepEqual(prepararCuerpoAceptacion({ acepto: true, version: 1, sha256: HASH }), { ok: true, cuerpo: { acepto: true, version: 1, sha256: HASH } });
});

test('interpretarErrorConvenio: el código incorrecto dice cuántos intentos quedan', () => {
  const dos = interpretarErrorConvenio(400, 'CODE_INVALID', undefined, 2);
  assert.match(dos.mensaje, /no es correcto/);
  assert.match(dos.mensaje, /2 intentos/);
  assert.equal(dos.nuevoCodigo, false);
  assert.match(interpretarErrorConvenio(400, 'CODE_INVALID', undefined, 1).mensaje, /1 intento\b/);
  const agotado = interpretarErrorConvenio(400, 'CODE_INVALID', undefined, 0);
  assert.equal(agotado.nuevoCodigo, true);
  assert.match(agotado.mensaje, /Pide un código nuevo/);
  assert.equal(interpretarErrorConvenio(400, 'CODE_INVALID').nuevoCodigo, false);
});

test('interpretarErrorConvenio: vencido, no pedido o no disponible piden un código nuevo; ninguno acepta nada', () => {
  for (const [status, code] of [[400, 'CODE_EXPIRED'], [400, 'CODE_REQUIRED'], [503, 'CODE_UNAVAILABLE']] as const) {
    const e = interpretarErrorConvenio(status, code);
    assert.equal(e.nuevoCodigo, true, code);
    assert.match(e.mensaje, /código nuevo|nuevo código/i, code);
    assert.equal(e.yaAceptado, false);
  }
});

test('interpretarErrorConvenio: oferta cambiada, sin correo, ya aceptado, sin código requerido y límite de pedidos', () => {
  assert.equal(interpretarErrorConvenio(409, 'CONVENIO_CHANGED').cambio, true);
  assert.match(interpretarErrorConvenio(409, 'EMAIL_REQUIRED').mensaje, /asesora/);
  assert.equal(interpretarErrorConvenio(409, 'CONVENIO_ACCEPTED').yaAceptado, true);
  const sinCodigo = interpretarErrorConvenio(409, 'CODE_NOT_REQUIRED');
  assert.equal(sinCodigo.cambio, true);
  assert.match(sinCodigo.mensaje, /sin código/);
  const limite = interpretarErrorConvenio(429, 'RATE_LIMITED');
  assert.match(limite.mensaje, /Espera/);
  assert.match(limite.mensaje, /código/);
  assert.equal(limite.nuevoCodigo, false);
});

test('segundosParaReenvio: cuenta regresiva de 60 s, nunca negativa', () => {
  assert.equal(ESPERA_REENVIO_SEGUNDOS, 60);
  assert.equal(segundosParaReenvio(1_000, 1_000), 60);
  assert.equal(segundosParaReenvio(1_000, 1_001), 60);
  assert.equal(segundosParaReenvio(1_000, 31_000), 30);
  assert.equal(segundosParaReenvio(1_000, 60_999), 1);
  assert.equal(segundosParaReenvio(1_000, 61_000), 0);
  assert.equal(segundosParaReenvio(1_000, 999_999), 0);
  assert.equal(segundosParaReenvio(1_000, 0), 60);
});

test('mensajeCodigoEnviado: nombra el correo enmascarado y los 5 minutos de vigencia', () => {
  const m = mensajeCodigoEnviado('a***@e***.com');
  assert.match(m, /Te enviamos un código a a\*\*\*@e\*\*\*\.com/);
  assert.match(m, /5 minutos/);
  assert.match(mensajeCodigoEnviado(undefined), /Te enviamos un código a tu correo/);
});

// ---- proxy ----

function cookiesFalsas(sesion?: string) {
  const llamadas: any[] = [];
  return {
    llamadas,
    get: (n: string) => (n === COOKIE_SESION_NOMBRE && sesion ? { value: sesion } : undefined),
    delete: (name: string, opts: any) => llamadas.push({ m: 'delete', name, opts }),
    set: (name: string, val: string, opts: any) => llamadas.push({ m: 'set', name, val, opts })
  };
}
const peticion = (ruta: string, cuerpo: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://www.fgrec.org/api/portal/${ruta}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-fgrec-portal': '1', origin: 'https://www.fgrec.org', 'x-forwarded-for': '1.2.3.4', 'user-agent': 'UA/1', ...headers },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)
  });
const CUERPO_CODIGO = { version: 3, sha256: HASH, aceptoMediosElectronicos: true, aceptoConvenio: true };

test('ruta de código: CSRF, origen, sesión, JSON y cuerpo incompleto se rechazan sin llamar a FGREC', async () => {
  let llamadas = 0;
  const llamar = (async () => { llamadas++; return { ok: true, status: 200, data: {} }; }) as any;
  const pedir = (request: Request, sesion = 's') => manejarCodigoConvenio({ request, cookies: cookiesFalsas(sesion), llamar });

  assert.equal((await pedir(peticion('convenio-codigo', CUERPO_CODIGO, { 'x-fgrec-portal': '0' }))).status, 403);
  assert.equal((await pedir(peticion('convenio-codigo', CUERPO_CODIGO, { origin: 'https://otro.example' }))).status, 403);
  assert.equal((await pedir(peticion('convenio-codigo', CUERPO_CODIGO), '')).status, 401);
  assert.equal((await pedir(peticion('convenio-codigo', '{no'))).status, 400);
  for (const [cuerpo, campo] of [
    [{ ...CUERPO_CODIGO, aceptoMediosElectronicos: false }, 'aceptoMediosElectronicos'],
    [{ ...CUERPO_CODIGO, aceptoConvenio: false }, 'aceptoConvenio'],
    [{ ...CUERPO_CODIGO, version: undefined }, 'version'],
    [{ ...CUERPO_CODIGO, sha256: 'x' }, 'sha256']
  ] as const) {
    const res = await pedir(peticion('convenio-codigo', cuerpo));
    assert.equal(res.status, 400);
    assert.equal((await res.json()).field, campo);
  }
  assert.equal(llamadas, 0);
});

test('ruta de código: reenvía a convenio/codigo solo el cuerpo permitido, con sesión y contexto firmados; devuelve la respuesta', async () => {
  let recibido: any;
  const llamar = (async (o: any) => { recibido = o; return { ok: true, status: 200, data: { enviadoA: 'a***@e***.com', expiraEn: '2026-10-26T15:05:00.000Z' } }; }) as any;
  const res = await manejarCodigoConvenio({ request: peticion('convenio-codigo', { ...CUERPO_CODIGO, ip: '9.9.9.9', codigo: '123456' }), cookies: cookiesFalsas('tok'), llamar });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { enviadoA: 'a***@e***.com', expiraEn: '2026-10-26T15:05:00.000Z' });
  assert.equal(recibido.metodo, 'POST');
  assert.equal(recibido.rutaRelativa, 'convenio/codigo');
  assert.deepEqual(recibido.cuerpo, CUERPO_CODIGO);
  assert.equal(recibido.sesion, 'tok');
  assert.deepEqual(recibido.contexto, { ip: '1.2.3.4', ua: 'UA/1' });
});

test('ruta de código: conserva status y código de FGREC (incluido el límite de pedidos); 401 borra la cookie', async () => {
  for (const [status, code] of [[409, 'EMAIL_REQUIRED'], [409, 'CODE_NOT_REQUIRED'], [409, 'CONVENIO_ACCEPTED'], [429, 'RATE_LIMITED'], [503, 'CODE_UNAVAILABLE']] as const) {
    const llamar = (async () => ({ ok: false, status, error: { code, message: 'm' } })) as any;
    const res = await manejarCodigoConvenio({ request: peticion('convenio-codigo', CUERPO_CODIGO), cookies: cookiesFalsas('s'), llamar });
    assert.equal(res.status, status);
    assert.equal((await res.json()).code, code);
  }
  const c = cookiesFalsas('s');
  const llamar = (async () => ({ ok: false, status: 401, error: { code: 'SESSION_INVALID', message: 'x' } })) as any;
  assert.equal((await manejarCodigoConvenio({ request: peticion('convenio-codigo', CUERPO_CODIGO), cookies: c, llamar })).status, 401);
  assert.ok(c.llamadas.some((l) => l.m === 'set' && l.opts.maxAge === 0));
});

test('ruta de aceptación: con código reenvía las casillas y el código; CODE_INVALID conserva intentosRestantes', async () => {
  let recibido: any;
  const llamar = (async (o: any) => { recibido = o; return { ok: true, status: 201, data: { version: 3, estado: 'ACEPTADO', aceptadoEn: '2026-10-26T15:00:00.000Z' } }; }) as any;
  const cuerpo = { ...CUERPO_CODIGO, codigo: '123456' };
  const res = await manejarAceptacionConvenio({ request: peticion('convenio-aceptar', { ...cuerpo, ip: '9.9.9.9' }), cookies: cookiesFalsas('tok'), llamar });
  assert.equal(res.status, 201);
  assert.equal(recibido.rutaRelativa, 'convenio/aceptar');
  assert.deepEqual(recibido.cuerpo, cuerpo);

  const invalido = (async () => ({ ok: false, status: 400, error: { code: 'CODE_INVALID', message: 'm', intentosRestantes: 3 } })) as any;
  const mal = await manejarAceptacionConvenio({ request: peticion('convenio-aceptar', cuerpo), cookies: cookiesFalsas('s'), llamar: invalido });
  assert.equal(mal.status, 400);
  assert.deepEqual(await mal.json(), { code: 'CODE_INVALID', message: 'm', intentosRestantes: 3 });
});

test('ruta de aceptación: un código mal formado se rechaza en el sitio y no llama a FGREC', async () => {
  let llamadas = 0;
  const llamar = (async () => { llamadas++; return { ok: true, status: 201, data: {} }; }) as any;
  const res = await manejarAceptacionConvenio({ request: peticion('convenio-aceptar', { ...CUERPO_CODIGO, codigo: '12' }), cookies: cookiesFalsas('s'), llamar });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).field, 'codigo');
  assert.equal(llamadas, 0);
});

// ---- page ----

const page = await readFile(new URL('../src/pages/mi-postulacion/convenio.astro', import.meta.url), 'utf8');
const rutaCodigo = await readFile(new URL('../src/pages/api/portal/convenio-codigo.ts', import.meta.url), 'utf8');

test('página con clickwrap: dos casillas con los textos de la API, aviso y paso del código', () => {
  assert.match(page, /convenio\.clickwrap\.consentimientoElectronico/);
  assert.match(page, /convenio\.clickwrap\.consentimientoContractual/);
  assert.match(page, /convenio\.clickwrap\.avisoElectronico/);
  assert.match(page, /id="chkMedios"/);
  assert.match(page, /id="chkConvenio"/);
  assert.match(page, /id="btnEnviarCodigo"[^>]*>\s*Enviarme el código/);
  assert.match(page, /id="codigoConvenio"[^>]+maxlength="6"/);
  assert.match(page, /autocomplete="one-time-code"/);
  assert.match(page, /id="btnReenviar"/);
  assert.match(page, /RUTA_CODIGO_CONVENIO/);
});

test('página con clickwrap: no repite los textos de consentimiento en el código y conserva PDF y aceptado', () => {
  assert.equal(/Consiento usar medios/.test(page), false);
  assert.equal(/>Resumen<|convenio__resumen|filasResumen/.test(page), false);
  assert.equal(page.includes('El texto de este convenio todavía está en revisión de la Fundación'), false);
  assert.match(page, /<object[^>]+data=\{RUTA_PDF_CONVENIO\}/);
  assert.match(page, /convenio__aceptado/);
});

test('página sin clickwrap: el formulario de una casilla sigue igual', () => {
  assert.match(page, /\{pendiente && aceptacion && !convenio\.clickwrap && \(/);
  assert.match(page, /id="chkAcepto"/);
  assert.match(page, /body: JSON\.stringify\(\{ acepto: true, version, sha256 \}\)/);
  assert.match(page, /Confirmar mi aceptación/);
});

test('ruta del sitio del código: misma cadena de proxy que la aceptación', () => {
  assert.match(rutaCodigo, /export const prerender = false/);
  assert.match(rutaCodigo, /manejarCodigoConvenio\(\{ request, cookies \}\)/);
  assert.match(rutaCodigo, /export const POST/);
});
