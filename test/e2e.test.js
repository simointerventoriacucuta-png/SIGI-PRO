// Pruebas de punta a punta de SIGI Pro: API + interfaz con Playwright.
// Correr con:  npm test
// Levanta el servidor en una carpeta temporal (SIGI_DATOS) y un puerto libre (PORT=0).
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const RAIZ = path.join(__dirname, '..');
let srv, base, datos, navegador, terminando = false;
const errores = []; // errores de página, consola y respuestas inesperadas

// ---------- Servidor ----------
before(async () => {
  datos = fs.mkdtempSync(path.join(os.tmpdir(), 'sigi-prueba-'));
  srv = spawn(process.execPath, ['server.js'], { cwd: RAIZ, env: { ...process.env, SIGI_DATOS: datos, PORT: '0', ANTHROPIC_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let salida = '';
  srv.stderr.on('data', d => { salida += d; process.stderr.write('[servidor] ' + d); });
  base = await new Promise((ok, mal) => {
    const t = setTimeout(() => mal(new Error('El servidor no arrancó: ' + salida)), 30000);
    srv.stdout.on('data', d => { salida += d; const m = /localhost:(\d+)/.exec(salida); if (m) { clearTimeout(t); ok('http://127.0.0.1:' + m[1]); } });
    srv.on('exit', c => mal(new Error('El servidor terminó con código ' + c + ': ' + salida)));
  });
  srv.on('exit', (c, sen) => { if (!terminando) { errores.push(`el servidor terminó (código ${c}, señal ${sen})`); process.stderr.write('[servidor] terminó ' + c + ' ' + sen + '\n' + salida.slice(-3000)); } });
  srv.stdout.on('data', d => { salida += d; });
  navegador = await chromium.launch();
});
after(async () => {
  if (navegador) await navegador.close();
  terminando = true;
  if (srv) srv.kill();
  try { fs.rmSync(datos, { recursive: true, force: true }); } catch {}
});

// ---------- API ----------
async function api(ruta, { metodo = 'GET', cuerpo, usuario = 1, esperado = 200 } = {}) {
  const r = await fetch(base + '/api/' + ruta, { method: metodo, headers: { 'Content-Type': 'application/json', 'X-Usuario': String(usuario || '') }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const texto = await r.text();
  assert.equal(r.status, esperado, `${metodo} /api/${ruta} → ${r.status} (se esperaba ${esperado}): ${texto.slice(0, 300)}`);
  try { return JSON.parse(texto); } catch { return texto; }
}
// Marca como "Cumple" la lista de chequeo documental del acta (requisito para aprobarla)
async function cumplirChequeo(actaId) {
  for (const f of (await api(`acta/${actaId}/chequeo`)).filas) await api(`acta/${actaId}/chequeo/${f.id}`, { metodo: 'PUT', cuerpo: { estado: 'Cumple' } });
}
const USU = { director: 1, residente: 2, especialista: 3, administrativo: 4, entidad: 5 };
async function proyecto() {
  const pid = (await api('t/proyecto'))[0].id;
  const r = await api('resumen/' + pid);
  return { pid, r, obra: r.contratos.find(c => c.tipo === 'obra'), interv: r.contratos.find(c => c.tipo === 'interventoria') };
}

test('API: usuarios y roles iniciales', async () => {
  const m = await api('usuarios');
  assert.deepEqual(m.usuarios.map(u => u.rol), ['director', 'residente', 'especialista', 'administrativo', 'entidad']);
  assert.ok(m.estados_acta.includes('Aprobada interventoría'));
});

test('API: crear, editar y borrar en cada tabla (con auditoría)', async () => {
  const { pid, obra } = await proyecto();
  const casos = {
    vencimiento: { proyecto_id: pid, descripcion: 'Prueba vencimiento', fecha: '2030-01-01' },
    personal: { proyecto_id: pid, nombre: 'Persona de prueba', cargo: 'Inspector' },
    poliza: { proyecto_id: pid, amparo: 'Cumplimiento', numero: 'P-0001' },
    correspondencia: { proyecto_id: pid, asunto: 'Oficio de prueba', fecha: '2026-01-01' },
    bitacora: { proyecto_id: pid, actividades: 'Excavación de prueba', fecha: '2026-01-01' },
    ensayo: { proyecto_id: pid, ensayo: 'Densidad de prueba', fecha: '2026-01-01' },
    item: { contrato_id: obra.id, tipo: 1, codigo: 'T.1', descripcion: 'Ítem de prueba', unidad: 'M3', cantidad: 10, vr_unitario: 1000 },
    gasto: { contrato_id: obra.id, descripcion: 'Gasto de prueba', valor: 5000 },
    otrosi: { contrato_id: obra.id, tipo: 'Modificación', estado: 'En trámite' },
    acta: { contrato_id: obra.id, estado: 'Borrador' },
    usuario: { nombre: 'Usuario de prueba', rol: 'residente' },
    proyecto: { nombre: 'Proyecto de prueba' },
    contrato: { proyecto_id: pid, tipo: 'obra', numero: 'C-PRUEBA' },
    suspension: { contrato_id: obra.id, fecha_suspension: '2026-01-01', estado: 'Suspendido' },
    liquidacion: { contrato_id: obra.id, tipo: 'Bilateral' },
    tarea: { proyecto_id: pid, nombre: 'Tarea de prueba', inicio: '2026-01-01', fin: '2026-02-01' },
    tramo: { proyecto_id: pid, nombre: 'Tramo de prueba', abs_ini: 0, abs_fin: 100 },
    sst: { proyecto_id: pid, tipo: 'Inspección', descripcion: 'Inspección de prueba', fecha: '2026-01-01' },
    sst_mes: { proyecto_id: pid, mes: '2026-01', trabajadores: 10 },
    ambiental: { proyecto_id: pid, actividad: 'Riego de prueba', fecha: '2026-01-01' },
    pmt: { proyecto_id: pid, frente: 'Frente de prueba' },
    social: { proyecto_id: pid, tipo: 'PQRS', descripcion: 'Petición de prueba', fecha: '2026-01-02' },
  };
  for (const [tabla, datos] of Object.entries(casos)) {
    const n = await api('t/' + tabla, { metodo: 'POST', cuerpo: datos });
    assert.ok(n.id, tabla + ' sin id');
    const campo = { vencimiento: 'descripcion', personal: 'nombre', poliza: 'numero', correspondencia: 'asunto', bitacora: 'actividades', ensayo: 'ensayo', item: 'descripcion', gasto: 'descripcion',
      otrosi: 'objeto', acta: 'observaciones', usuario: 'nombre', proyecto: 'nombre', contrato: 'numero', suspension: 'motivo', liquidacion: 'observaciones', tarea: 'nombre', tramo: 'nombre',
      sst: 'descripcion', sst_mes: 'notas', ambiental: 'actividad', pmt: 'frente', social: 'descripcion', avance: 'descripcion' }[tabla];
    const e = await api(`t/${tabla}/${n.id}`, { metodo: 'PUT', cuerpo: { [campo]: 'Editado ' + tabla } });
    assert.equal(e[campo], 'Editado ' + tabla);
    await api(`t/${tabla}/${n.id}`, { metodo: 'DELETE' });
    assert.equal(await api(`t/${tabla}/${n.id}`), null);
    const aud = await api('auditoria?limite=5');
    assert.ok(aud.some(a => a.tabla === tabla && a.accion === 'borrar' && a.registro_id === String(n.id)), 'falta auditoría de ' + tabla);
  }
  await api('t/no_existe', { esperado: 404 });
  await api('t/item/999999', { metodo: 'PUT', cuerpo: { codigo: 'x' }, esperado: 404 });
});

test('API: permisos por rol (401/403)', async () => {
  const { pid, obra } = await proyecto();
  await api('t/bitacora', { metodo: 'POST', cuerpo: { proyecto_id: pid }, usuario: 0, esperado: 401 });
  for (const tabla of ['bitacora', 'vencimiento', 'item', 'gasto', 'usuario', 'proyecto'])
    await api('t/' + tabla, { metodo: 'POST', cuerpo: { proyecto_id: pid, contrato_id: obra.id, nombre: 'x' }, usuario: USU.entidad, esperado: 403 });
  await api('t/gasto', { metodo: 'POST', cuerpo: { contrato_id: obra.id }, usuario: USU.residente, esperado: 403 });
  await api('t/usuario', { metodo: 'POST', cuerpo: { nombre: 'x' }, usuario: USU.administrativo, esperado: 403 });
  await api('pegar', { metodo: 'POST', cuerpo: { contrato_id: obra.id, filas: [] }, usuario: USU.especialista, esperado: 403 });
  await api('sync/ahora', { metodo: 'POST', usuario: USU.residente, esperado: 403 });
  await api('asistente/config', { metodo: 'POST', cuerpo: { clave: 'x' }, usuario: USU.residente, esperado: 403 });
  // La consulta es libre
  await api('resumen/' + pid, { usuario: USU.entidad });
  await api('t/usuario', { metodo: 'POST', cuerpo: { nombre: 'x', rol: 'rey' }, esperado: 400 });
  await api('entrar', { metodo: 'POST', cuerpo: { correo: 'nadie@example.com' }, esperado: 404 });
});

test('API: flujo de estados del acta y bloqueo', async () => {
  const { obra } = await proyecto();
  const it = await api('t/item', { metodo: 'POST', cuerpo: { contrato_id: obra.id, tipo: 1, codigo: 'E.1', descripcion: 'Ítem estados', unidad: 'M2', cantidad: 100, vr_unitario: 2000 } });
  const a = await api('t/acta', { metodo: 'POST', cuerpo: { contrato_id: obra.id, estado: 'Borrador' } });
  await api(`acta/${a.id}/item/${it.id}`, { metodo: 'PUT', cuerpo: { cant_presentada: 120 }, usuario: USU.especialista });
  await api(`acta/${a.id}/aprobar-todo`, { metodo: 'POST', usuario: USU.residente });
  let d = await api('acta/' + a.id);
  const f = d.filas.find(x => x.id === it.id);
  assert.equal(f.cant_aprobada, 120);
  assert.ok(f.saldo < 0, 'debe marcar mayor cantidad');
  await api('t/acta/' + a.id, { metodo: 'PUT', cuerpo: { estado: 'Inventado' }, esperado: 400 });
  for (const e of ['Radicada', 'En revisión', 'Con observaciones']) await api('t/acta/' + a.id, { metodo: 'PUT', cuerpo: { estado: e }, usuario: USU.residente });
  await api('t/acta/' + a.id, { metodo: 'PUT', cuerpo: { estado: 'Aprobada interventoría' }, usuario: USU.residente, esperado: 403 });
  await api('t/acta/' + a.id, { metodo: 'PUT', cuerpo: { estado: 'Aprobada interventoría' }, esperado: 409 }); // falta la lista de chequeo
  await cumplirChequeo(a.id);
  await api('t/acta/' + a.id, { metodo: 'PUT', cuerpo: { estado: 'Aprobada interventoría' } });
  // Bloqueada
  await api(`acta/${a.id}/item/${it.id}`, { metodo: 'PUT', cuerpo: { cant_presentada: 1 }, esperado: 409 });
  await api(`acta/${a.id}/aprobar-todo`, { metodo: 'POST', esperado: 409 });
  await api('t/acta/' + a.id, { metodo: 'PUT', cuerpo: { hasta: '2026-02-01' }, esperado: 409 });
  await api('t/acta/' + a.id, { metodo: 'DELETE', esperado: 409 });
  await api('t/acta/' + a.id, { metodo: 'PUT', cuerpo: { estado: 'Avalada entidad' }, usuario: USU.administrativo });
  await api('t/acta/' + a.id, { metodo: 'PUT', cuerpo: { estado: 'En revisión' }, usuario: USU.administrativo, esperado: 403 });
  await api('t/acta/' + a.id, { metodo: 'PUT', cuerpo: { estado: 'En revisión' } }); // el director reabre
  await api(`acta/${a.id}/item/${it.id}`, { metodo: 'PUT', cuerpo: { cant_presentada: 1 } });
  const csv = await api(`acta/${a.id}/csv`);
  assert.match(csv, /Cant\. contratada/);
  assert.match(csv, /Ítem estados/);
  await api('t/acta/' + a.id, { metodo: 'DELETE' });
  await api('t/item/' + it.id, { metodo: 'DELETE' });
});

test('API: otrosíes, valor y plazo vigentes y aviso de pólizas', async () => {
  const { pid, obra } = await proyecto();
  const o = await api('t/otrosi', { metodo: 'POST', cuerpo: { contrato_id: obra.id, tipo: 'Adición y prórroga', valor: 1000000, dias: 30, estado: 'En trámite' } });
  let c = (await api('resumen/' + pid)).contratos.find(x => x.id === obra.id);
  assert.equal(c.valor_vigente, obra.valor_vigente, 'un otrosí en trámite no suma');
  await api('t/otrosi/' + o.id, { metodo: 'PUT', cuerpo: { estado: 'Firmado' }, usuario: USU.administrativo });
  c = (await api('resumen/' + pid)).contratos.find(x => x.id === obra.id);
  assert.equal(c.valor_vigente, obra.valor_vigente + 1000000);
  assert.equal(c.prorroga_dias, obra.prorroga_dias + 30);
  let av = await api('avisos/' + pid);
  assert.ok(av.some(a => a.texto.includes('otrosí ' + o.numero)), 'falta aviso de pólizas');
  await api('t/otrosi/' + o.id, { metodo: 'PUT', cuerpo: { polizas_ajustadas: 'Sí' } });
  av = await api('avisos/' + pid);
  assert.ok(!av.some(a => a.texto.includes('otrosí ' + o.numero + ' ')), 'el aviso debe desaparecer');
  // Otrosí sin el campo de pólizas (valor nulo): también debe avisar
  await api('t/otrosi/' + o.id, { metodo: 'PUT', cuerpo: { polizas_ajustadas: '' } });
  av = await api('avisos/' + pid);
  assert.ok(av.some(a => a.texto.includes('otrosí ' + o.numero)), 'un otrosí firmado con pólizas sin dato debe avisar');
  await api('t/otrosi/' + o.id, { metodo: 'DELETE' });
});

test('API: búsqueda, avisos, memoria, costos, sincronización e importación pegada desde Excel', async () => {
  const { pid, obra, interv } = await proyecto();
  assert.deepEqual(await api(`buscar/${pid}?q=a`), []);
  const v = await api('t/vencimiento', { metodo: 'POST', cuerpo: { proyecto_id: pid, descripcion: 'Entrega zeta de prueba', fecha: new Date().toISOString().slice(0, 10), estado: 'Pendiente' } });
  const b = await api(`buscar/${pid}?q=zeta`);
  assert.ok(b.some(x => x.abrir === 'tabla:vencimiento'));
  assert.ok((await api('avisos/' + pid)).some(x => x.texto === 'Entrega zeta de prueba'));
  await api('t/vencimiento/' + v.id, { metodo: 'DELETE' });
  await api('memoria/' + pid);
  const k = await api('costos/' + interv.id);
  assert.ok(k.totales);
  assert.equal((await api('sync')).modo, 'local');
  const antes = (await api('presupuesto/' + obra.id)).items.length;
  const r = await api('pegar', { metodo: 'POST', cuerpo: { contrato_id: obra.id, filas: [{ codigo: '99', descripcion: 'CAPÍTULO PEGADO' }, { codigo: '99.1', descripcion: 'Ítem pegado', unidad: 'M2', cantidad: 3, vr_unitario: 10 }] } });
  assert.equal(r.filas, 2);
  const items = (await api('presupuesto/' + obra.id)).items;
  assert.equal(items.length, antes + 2);
  const cap = items.find(i => i.codigo === '99'), hijo = items.find(i => i.codigo === '99.1');
  assert.equal(hijo.padre_id, cap.id);
  await api('t/item/' + cap.id, { metodo: 'DELETE' });
  assert.ok(!(await api('presupuesto/' + obra.id)).items.some(i => i.codigo === '99.1'), 'borrar el capítulo borra sus ítems');
  const asis = await api('asistente/config');
  assert.equal(typeof asis.configurado, 'boolean');
});

// ---------- Archivos de ejemplo ----------
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const esZip = b => Buffer.from(b).subarray(0, 2).toString() === 'PK';
async function binario(ruta) {
  const r = await fetch(base + '/api/' + ruta, { headers: { 'X-Usuario': '1' } });
  assert.equal(r.status, 200, ruta + ' → ' + r.status + ' ' + (r.status !== 200 ? await r.text() : ''));
  return { tipo: r.headers.get('content-type'), disp: r.headers.get('content-disposition'), buf: Buffer.from(await r.arrayBuffer()) };
}
// Microsoft Project XML con muchas tareas (más de 64 kB) y tildes, para probar la lectura del cuerpo por partes
function projectXml(n = 400) {
  const t = [`<Task><UID>0</UID><ID>0</ID><Name>Proyecto</Name><OutlineLevel>0</OutlineLevel><Start>2026-01-01T08:00:00</Start><Finish>2026-12-31T17:00:00</Finish><Summary>1</Summary></Task>`,
    `<Task><UID>1</UID><Name>Construcción vía</Name><WBS>1</WBS><OutlineLevel>1</OutlineLevel><Start>2026-01-01T08:00:00</Start><Finish>2026-12-31T17:00:00</Finish><Summary>1</Summary><PercentComplete>10</PercentComplete></Task>`];
  for (let i = 0; i < n; i++) t.push(`<Task><UID>${i + 2}</UID><Name>Excavación mecánica señalización ñandú ${i}</Name><WBS>1.${i + 1}</WBS><OutlineLevel>2</OutlineLevel><Start>2026-01-0${1 + (i % 9)}T08:00:00</Start><Finish>2026-03-01T17:00:00</Finish><PercentComplete>${i % 100}</PercentComplete></Task>`);
  return `<?xml version="1.0" encoding="UTF-8"?><Project xmlns="http://schemas.microsoft.com/project"><Name>Prueba</Name><Tasks>${t.join('')}</Tasks></Project>`;
}
const LANDXML = `<?xml version="1.0"?><LandXML xmlns="http://www.landxml.org/schema/LandXML-1.2" version="1.2"><Alignments>
<Alignment name="Eje de prueba" length="300" staStart="0"><CoordGeom>
<Line><Start>1000 5000</Start><End>1000 5100</End></Line>
<Curve rot="ccw"><Start>1000 5100</Start><Center>1100 5100</Center><End>1100 5200</End></Curve>
<Line><Start>1100 5200</Start><End>1200 5200</End></Line>
</CoordGeom></Alignment></Alignments></LandXML>`;
async function excelPresupuesto() {
  const ExcelJS = require('exceljs');
  const libro = new ExcelJS.Workbook(), h = libro.addWorksheet('Presupuesto');
  h.addRow(['Presupuesto de prueba']);
  h.addRow(['Ítem', 'Descripción', 'Unidad', 'Cantidad', 'Valor unitario']);
  h.addRow(['77', 'CAPÍTULO IMPORTADO']);
  h.addRow(['77.1', 'Base granular importada', 'M3', 12.5, 85000]);
  h.addRow(['77.2', 'Sub-base importada', 'M3', 3, 60000]);
  return Buffer.from(await libro.xlsx.writeBuffer()).toString('base64');
}

test('API: otrosí con cantidades por ítem (cantidad vigente) y bloqueo del precio pagado', async () => {
  const { obra } = await proyecto();
  const it = await api('t/item', { metodo: 'POST', cuerpo: { contrato_id: obra.id, tipo: 1, codigo: 'V.1', descripcion: 'Ítem vigente', unidad: 'M3', cantidad: 10, vr_unitario: 100 } });
  const o = await api('t/otrosi', { metodo: 'POST', cuerpo: { contrato_id: obra.id, tipo: 'Modificación', estado: 'En trámite' } });
  const oi = await api('t/otrosi_item', { metodo: 'POST', cuerpo: { otrosi_id: o.id, item_id: it.id, cantidad: 5 }, usuario: USU.administrativo });
  const vig = async () => (await api('presupuesto/' + obra.id)).items.find(i => i.id === it.id).cantidad_vigente;
  assert.equal(await vig(), 10, 'en trámite no cambia la cantidad');
  await api('t/otrosi/' + o.id, { metodo: 'PUT', cuerpo: { estado: 'Firmado', polizas_ajustadas: 'Sí' } });
  assert.equal(await vig(), 15);
  const a = await api('t/acta', { metodo: 'POST', cuerpo: { contrato_id: obra.id } });
  await api(`acta/${a.id}/item/${it.id}`, { metodo: 'PUT', cuerpo: { cant_presentada: 12, cant_aprobada: 12 } });
  const f = (await api('acta/' + a.id)).filas.find(x => x.id === it.id);
  assert.equal(f.saldo, 3, 'el saldo usa la cantidad vigente');
  await cumplirChequeo(a.id);
  await api('t/acta/' + a.id, { metodo: 'PUT', cuerpo: { estado: 'Aprobada interventoría' } });
  await api('t/item/' + it.id, { metodo: 'PUT', cuerpo: { vr_unitario: 200 }, esperado: 409 });
  await api('t/item/' + it.id, { metodo: 'PUT', cuerpo: { descripcion: 'Ítem vigente (renombrado)' } });
  await api('t/acta/' + a.id, { metodo: 'PUT', cuerpo: { estado: 'Borrador' } });
  await api('t/acta/' + a.id, { metodo: 'DELETE' });
  await api('t/otrosi/' + o.id, { metodo: 'DELETE' });
  assert.equal(await api('t/otrosi_item/' + oi.id), null, 'borrar el otrosí borra sus cantidades');
  await api('t/item/' + it.id, { metodo: 'DELETE' });
});

test('API: suspensiones, terminación vigente y liquidación', async () => {
  const { pid, obra } = await proyecto();
  const hace = d => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  const s = await api('t/suspension', { metodo: 'POST', cuerpo: { contrato_id: obra.id, fecha_suspension: hace(40), estado: 'Suspendido' }, usuario: USU.administrativo });
  assert.equal(s.numero, obra.suspensiones.length + 1);
  let c = (await api('resumen/' + pid)).contratos.find(x => x.id === obra.id);
  assert.equal(c.suspendido, true);
  assert.equal(c.dias_suspendidos - obra.dias_suspendidos, 40);
  assert.ok((await api('avisos/' + pid)).some(a => a.tipo === 'Suspensión'), 'una suspensión de más de 30 días avisa');
  await api('t/suspension/' + s.id, { metodo: 'PUT', cuerpo: { estado: 'Reiniciado', fecha_reinicio: hace(10) } });
  c = (await api('resumen/' + pid)).contratos.find(x => x.id === obra.id);
  assert.equal(c.dias_suspendidos - obra.dias_suspendidos, 30);
  assert.ok((await api('avisos/' + pid)).some(a => a.texto.includes('reinicio de la suspensión ' + s.numero)));
  await api('t/suspension', { metodo: 'POST', cuerpo: { contrato_id: obra.id }, usuario: USU.residente, esperado: 403 });
  await api('t/suspension/' + s.id, { metodo: 'DELETE' });
  const l = await api('t/liquidacion', { metodo: 'POST', cuerpo: { contrato_id: obra.id, valor_ejecutado: 1 }, usuario: USU.administrativo });
  await api('t/liquidacion/' + l.id, { metodo: 'PUT', cuerpo: { estado: 'Firmada' } });
  await api('t/liquidacion/' + l.id, { metodo: 'DELETE' });
});

test('API: captura de avance con foto (suma al acta, verificar, rechazar, borrar y bloqueo)', async () => {
  const { pid, obra } = await proyecto();
  const it = await api('t/item', { metodo: 'POST', cuerpo: { contrato_id: obra.id, tipo: 1, codigo: 'AV.1', descripcion: 'Pavimento de prueba', unidad: 'M2', cantidad: 1000, vr_unitario: 50 } });
  const a = await api('t/acta', { metodo: 'POST', cuerpo: { contrato_id: obra.id, desde: '2030-01-01', hasta: '2030-01-31' } });
  const pres = async () => (await api('acta/' + a.id)).filas.find(x => x.id === it.id).cant_presentada;
  // m² = largo (por abscisas) × ancho
  const av = await api('t/avance', { metodo: 'POST', cuerpo: { proyecto_id: pid, item_id: it.id, fecha: '2030-01-10', abs_ini: 100, abs_fin: 160, ancho: 7 }, usuario: USU.especialista });
  assert.equal(av.cantidad, 420);
  assert.equal(av.acta_id, a.id);
  assert.equal(av.contrato_id, obra.id);
  assert.equal(await pres(), 420);
  const foto = await api('adjunto', { metodo: 'POST', cuerpo: { proyecto_id: pid, tabla: 'avance', registro_id: av.id, categoria: 'Foto', nombre: 'avance.png', tipo_mime: 'image/png', datos: PNG, fecha: '2030-01-10' }, usuario: USU.especialista });
  assert.equal((await api('avances/' + pid)).find(x => x.id === av.id).fotos, 1);
  // Otra captura y verificación (no cambia la suma)
  const av2 = await api('t/avance', { metodo: 'POST', cuerpo: { proyecto_id: pid, item_id: it.id, fecha: '2030-01-11', largo: 10, ancho: 2 } });
  assert.equal(await pres(), 440);
  await api('t/avance/' + av.id, { metodo: 'PUT', cuerpo: { estado: 'Verificado' } });
  assert.equal(await pres(), 440);
  // Rechazar descuenta; volver a reportar suma de nuevo
  await api('t/avance/' + av2.id, { metodo: 'PUT', cuerpo: { estado: 'Rechazado' } });
  assert.equal(await pres(), 420);
  assert.equal((await api('t/avance/' + av2.id)).acta_id, null);
  await api('t/avance/' + av2.id, { metodo: 'PUT', cuerpo: { estado: 'Reportado' } });
  assert.equal(await pres(), 440);
  // Borrar descuenta
  await api('t/avance/' + av2.id, { metodo: 'DELETE' });
  assert.equal(await pres(), 420);
  // Acta aprobada: la captura queda cerrada
  await cumplirChequeo(a.id);
  await api('t/acta/' + a.id, { metodo: 'PUT', cuerpo: { estado: 'Aprobada interventoría' } });
  await api('t/avance/' + av.id, { metodo: 'PUT', cuerpo: { estado: 'Rechazado' }, esperado: 409 });
  await api('t/avance/' + av.id, { metodo: 'DELETE', esperado: 409 });
  await api('t/avance', { metodo: 'POST', cuerpo: { proyecto_id: pid, item_id: 999999 }, esperado: 400 });
  await api('t/avance', { metodo: 'POST', cuerpo: { proyecto_id: pid, item_id: it.id }, usuario: USU.entidad, esperado: 403 });
  await api('t/acta/' + a.id, { metodo: 'PUT', cuerpo: { estado: 'Borrador' } });
  await api('t/avance/' + av.id, { metodo: 'DELETE' });
  assert.equal(await pres(), 0);
  assert.equal(await api('t/adjunto/' + foto.id), null, 'las fotos de la captura se borran con ella');
  await api('t/acta/' + a.id, { metodo: 'DELETE' });
  await api('t/item/' + it.id, { metodo: 'DELETE' });
});

test('API: adjuntos (subir, listar, descargar, borrar y permisos)', async () => {
  const { pid } = await proyecto();
  const b = await api('t/bitacora', { metodo: 'POST', cuerpo: { proyecto_id: pid, fecha: '2026-02-01', actividades: 'Con adjunto' } });
  const doc = await api('adjunto', { metodo: 'POST', cuerpo: { proyecto_id: pid, tabla: 'bitacora', registro_id: b.id, nombre: 'nota ñ.txt', tipo_mime: 'text/plain', datos: Buffer.from('hola señor').toString('base64') }, usuario: USU.residente });
  assert.equal(doc.categoria, 'Documento');
  assert.equal(doc.tamano, Buffer.byteLength('hola señor'));
  assert.deepEqual(await api(`adjuntos-conteo/${pid}?tabla=bitacora`), { [b.id]: 1 });
  assert.equal((await api(`adjuntos/${pid}?tabla=bitacora&registro_id=${b.id}`)).length, 1);
  const d = await binario(`adjunto/${doc.id}/archivo?descargar=1`);
  assert.equal(d.buf.toString(), 'hola señor');
  assert.match(d.disp, /attachment/);
  const foto = await api('adjunto', { metodo: 'POST', cuerpo: { proyecto_id: pid, nombre: 'f.png', tipo_mime: 'image/png', datos: PNG, fecha: '2026-02-03' } });
  assert.equal(foto.categoria, 'Foto');
  assert.ok((await api(`adjuntos/${pid}?categoria=Foto&mes=2026-02`)).some(x => x.id === foto.id));
  await api('adjunto', { metodo: 'POST', cuerpo: { proyecto_id: pid, nombre: 'v.txt', datos: '' }, esperado: 400 });
  await api('adjunto', { metodo: 'POST', cuerpo: { proyecto_id: pid, nombre: 'x.txt', datos: 'eA==' }, usuario: USU.entidad, esperado: 403 });
  await api('adjunto/999999/archivo', { esperado: 404 });
  await api('t/bitacora/' + b.id, { metodo: 'DELETE' });
  assert.equal(await api('t/adjunto/' + doc.id), null, 'borrar el registro borra sus adjuntos');
  await api('t/adjunto/' + foto.id, { metodo: 'DELETE' });
});

test('API: exportes Excel, Word del acta e informe mensual', async () => {
  const { pid, obra } = await proyecto();
  const a = await api('t/acta', { metodo: 'POST', cuerpo: { contrato_id: obra.id, desde: '2026-01-01', hasta: '2026-01-31', fecha: '2026-02-01' } });
  await api('adjunto', { metodo: 'POST', cuerpo: { proyecto_id: pid, nombre: 'mes.png', tipo_mime: 'image/png', categoria: 'Foto', datos: PNG, fecha: '2026-01-15' } });
  for (const [ruta, nombre] of [[`xlsx/presupuesto/${obra.id}`, /Presupuesto_obra\.xlsx/], [`xlsx/acta/${a.id}`, /Acta_\d+\.xlsx/], [`docx/acta/${a.id}`, /Acta_\d+\.docx/],
    [`docx/informe/${pid}?mes=2026-01`, /Informe_mensual_2026-01\.docx/], [`docx/informe/${pid}?mes=malo`, /Informe_mensual_\d{4}-\d{2}\.docx/]]) {
    const r = await binario(ruta);
    assert.ok(esZip(r.buf), ruta + ' no es un archivo de Office');
    assert.match(r.disp, nombre);
  }
  await api('t/acta/' + a.id, { metodo: 'DELETE' });
});

test('API: importaciones (Excel, Project XML, LandXML) y archivos dañados', async () => {
  const { pid, obra } = await proyecto();
  const r = await api(`xlsx/importar/${obra.id}`, { metodo: 'POST', cuerpo: { archivo: await excelPresupuesto() } });
  assert.equal(r.filas, 3);
  const items = (await api('presupuesto/' + obra.id)).items;
  const cap = items.find(i => i.codigo === '77'), base_ = items.find(i => i.codigo === '77.1');
  assert.equal(cap.tipo, 0);
  assert.equal(base_.padre_id, cap.id);
  assert.equal(base_.cantidad, 12.5);
  assert.equal(base_.vr_unitario, 85000);
  await api('t/item/' + cap.id, { metodo: 'DELETE' });
  await api(`xlsx/importar/${obra.id}`, { metodo: 'POST', cuerpo: { archivo: Buffer.from('no es excel').toString('base64') }, esperado: 400 });
  await api(`xlsx/importar/${obra.id}`, { metodo: 'POST', cuerpo: { archivo: 'eA==' }, usuario: USU.entidad, esperado: 403 });
  // Project
  const xml = projectXml();
  assert.ok(Buffer.byteLength(xml) > 70000);
  const p = await api('project/' + pid, { metodo: 'POST', cuerpo: { xml } });
  assert.equal(p.tareas, 401);
  const tareas = await api('t/tarea?proyecto_id=' + pid);
  assert.equal(tareas.length, 401);
  assert.ok(tareas.every(t => !t.nombre.includes('�')), 'las tildes del XML no deben dañarse');
  assert.ok(tareas.some(t => t.nombre === 'Excavación mecánica señalización ñandú 399'));
  const prog = await api('programa/' + pid + '?fecha=2026-02-01');
  assert.ok(prog.programado > 0 && prog.spi != null);
  const x = await binario(`project/${pid}/xml`);
  assert.match(x.buf.toString(), /<Tasks>/);
  await api('project/' + pid, { metodo: 'POST', cuerpo: { xml: '<nada/>' }, esperado: 400 });
  await api('project/' + pid, { metodo: 'POST', cuerpo: { xml }, usuario: USU.especialista, esperado: 403 });
  // LandXML
  const l = await api('landxml/' + pid, { metodo: 'POST', cuerpo: { xml: LANDXML } });
  assert.equal(l.alineamientos, 1);
  const plano = await api('plano/' + pid);
  const al = plano.alineamientos.find(a => a.nombre === 'Eje de prueba');
  assert.ok(al.puntos.length > 10 && al.longitud > 0);
  const tr = await api('t/tramo', { metodo: 'POST', cuerpo: { proyecto_id: pid, alineamiento_id: al.id, abs_ini: 0, abs_fin: 50, avance: 40 }, usuario: USU.especialista });
  await api('t/alineamiento/' + al.id, { metodo: 'DELETE' });
  assert.equal(await api('t/tramo/' + tr.id), null, 'borrar el eje borra sus tramos');
  // JSON dañado
  const malo = await fetch(base + '/api/t/bitacora', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Usuario': '1' }, body: '{malo' });
  assert.equal(malo.status, 400);
});

test('API: datos para Power BI (CSV y JSON), SST y PQRS', async () => {
  const { pid } = await proyecto();
  const m = await api('t/sst_mes', { metodo: 'POST', cuerpo: { proyecto_id: pid, mes: '2026-03', trabajadores: 50, accidentes: 1, dias_incapacidad: 4, dias_programados: 1000, dias_ausencia: 10 } });
  const ind = (await api('sst-indicadores/' + pid)).find(x => x.mes === '2026-03');
  assert.equal(ind.frecuencia, 2); assert.equal(ind.severidad, 8); assert.equal(ind.ausentismo, 1);
  const lista = await api(`bi/${pid}/`);
  assert.ok(lista.conjuntos.length >= 10);
  for (const url of lista.conjuntos) {
    const c = url.replace(/^\/api\//, '');
    const csv = await binario(c);
    assert.match(csv.tipo, /text\/csv/);
    assert.ok(Array.isArray(await api(c.replace(/\.csv$/, '.json'))), c);
  }
  await api('t/sst_mes/' + m.id, { metodo: 'DELETE' });
  const pq = await api('t/social', { metodo: 'POST', cuerpo: { proyecto_id: pid, tipo: 'PQRS', fecha: '2026-10-30' } });
  assert.equal(pq.plazo, '2026-11-24', 'PQRS: 15 días hábiles sin festivos (2 y 16 de noviembre)');
  await api('t/social/' + pq.id, { metodo: 'DELETE' });
});

// ---------- Interfaz ----------
const ARCH = path.join(os.tmpdir(), 'sigi-prueba-archivos-' + process.pid);
function archivosEjemplo() {
  fs.mkdirSync(ARCH, { recursive: true });
  const f = { png: path.join(ARCH, 'foto avance.png'), txt: path.join(ARCH, 'acta de vecindad.txt'), project: path.join(ARCH, 'programa.xml'), landxml: path.join(ARCH, 'eje.xml'), xlsx: path.join(ARCH, 'presupuesto.xlsx') };
  fs.writeFileSync(f.png, Buffer.from(PNG, 'base64'));
  fs.writeFileSync(f.txt, 'Documento de prueba');
  fs.writeFileSync(f.project, projectXml(5));
  fs.writeFileSync(f.landxml, LANDXML);
  return f;
}
async function abrirApp(usuario) {
  const ctx = await navegador.newContext({ acceptDownloads: true, viewport: { width: 1500, height: 950 } });
  const page = await ctx.newPage();
  const estado = { propios: [], prompt: null }; // códigos 4xx esperados y respuesta a los prompt()
  page.on('pageerror', e => errores.push(`[${usuario}] pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(`[${usuario}] consola: ${m.text()}`); });
  page.on('response', r => {
    const s = r.status();
    if (s >= 500 || (s >= 400 && !estado.propios.includes(s))) errores.push(`[${usuario}] ${s} ${r.request().method()} ${r.url()}`);
  });
  page.on('dialog', d => (d.type() === 'prompt' ? (estado.prompt != null ? d.accept(estado.prompt) : d.dismiss()) : d.accept()));
  await page.goto(base + '/');
  await page.click(`[data-u="${usuario}"]`);
  await page.waitForSelector('#arbol [data-k="tablero"]');
  await page.waitForTimeout(300);
  return { page, ctx, estado };
}
const pausa = (p, ms = 300) => p.waitForTimeout(ms);
const boton = t => `#grupos-cinta button[title="${t}"]`;
async function cinta(page, pestana, t) { await page.click(`#pestanas-cinta [data-c="${pestana}"]`); await page.click(boton(t)); await pausa(page); }
async function cerrarDialogo(page) { if (await page.evaluate(() => document.querySelector('#dialogo').open)) await page.evaluate(() => document.querySelector('#dialogo').close()); }
async function editarCelda(page, sel, valor) {
  await page.click(sel);
  const campo = page.locator(sel + ' input, ' + sel + ' select').first();
  if (await campo.evaluate(e => e.tagName) === 'SELECT') { await campo.selectOption(valor); await campo.evaluate(e => e.blur()); }
  else { await campo.fill(valor); await campo.press('Enter'); }
  await page.waitForTimeout(500);
}
const ultimoId = (page, tabla) => page.evaluate(t => Math.max(...[...document.querySelectorAll(t + ' tr[data-id]')].map(r => Number(r.dataset.id))), tabla);
async function descarga(page, accion) {
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), accion()]);
  const ruta = await d.path();
  return { nombre: d.suggestedFilename(), buf: fs.readFileSync(ruta) };
}

test('Interfaz: director recorre cada pestaña y botón de la cinta y cada nodo del explorador', async () => {
  const antes = errores.length;
  const { page, ctx } = await abrirApp(USU.director);
  const pestanas = await page.$$eval('#pestanas-cinta button', bs => bs.map(b => b.dataset.c));
  assert.deepEqual(pestanas, ['archivo', 'inicio', 'obra', 'interventoria', 'control', 'informes']);
  // Abra un presupuesto y un acta para que se habiliten sus botones
  const nodos0 = await page.$$eval('#arbol [data-k]', ns => ns.map(n => n.dataset.k));
  for (const c of pestanas.filter(c => c !== 'archivo')) {
    for (const contexto of [null, nodos0.find(k => k.startsWith('presupuesto:')), nodos0.find(k => k.startsWith('acta:'))]) {
      if (contexto) { await page.click(`#arbol [data-k="${contexto}"]`); await pausa(page); }
      await page.click(`#pestanas-cinta [data-c="${c}"]`);
      const lista = await page.$$eval('#grupos-cinta [data-g]', bs => bs.map(b => [b.dataset.g, b.dataset.b, b.title, b.disabled]));
      for (const [g, b, titulo, apagado] of lista) {
        if (apagado || /Eliminar fila/.test(titulo)) continue;
        if (contexto) await page.click(`#arbol [data-k="${contexto}"]`);
        await page.click(`#pestanas-cinta [data-c="${c}"]`);
        const espera = page.waitForEvent('download', { timeout: 1500 }).catch(() => null);
        const archivo = page.waitForEvent('filechooser', { timeout: 1500 }).catch(() => null);
        const msg0 = await page.textContent('#estado-mensaje');
        await page.click(`#grupos-cinta [data-g="${g}"][data-b="${b}"]`);
        await Promise.all([espera, archivo]);
        await pausa(page);
        // Todo botón habilitado hace algo: abre una vista, un diálogo, un panel, una descarga o un aviso
        await cerrarDialogo(page);
        const msg = await page.textContent('#estado-mensaje');
        assert.ok(!/^Error/.test(msg) || msg === msg0 || /sin configurar/i.test(msg), `"${titulo}" (${c}) mostró: ${msg}`);
      }
    }
  }
  // Los botones chicos de la cinta funcionan (Otrosíes, Suspensiones, Liquidación)
  for (const [t, k] of [['Otrosíes', 'otrosis:'], ['Suspensiones', 'suspensiones:'], ['Liquidación', 'liquidacion:']]) {
    await cinta(page, 'obra', t);
    assert.ok((await page.evaluate(() => document.querySelector('.pestana-doc.activo')?.dataset.k)).startsWith(k), `el botón "${t}" no abrió su vista`);
  }
  // Menú Archivo
  await page.click('#pestanas-cinta [data-c="archivo"]');
  assert.ok(await page.isVisible('#menu-archivo'));
  await page.click('#menu-archivo button:has-text("Auditoría")'); await pausa(page);
  assert.match(await page.textContent('#contenido-doc'), /Auditoría/);
  // Cada nodo del explorador
  const nodos = await page.$$eval('#arbol [data-k]', ns => ns.map(n => n.dataset.k));
  assert.ok(nodos.length >= 25, 'el explorador debe tener nodos');
  for (const k of nodos) {
    await page.click(`#arbol [data-k="${k}"]`);
    await pausa(page, 250);
    const txt = await page.textContent('#contenido-doc');
    assert.ok(!/^\s*Error/.test(txt), `la vista ${k} muestra un error: ${txt.slice(0, 200)}`);
  }
  // Barra superior: actualizar, inicio, acerca de, zoom, plegar la cinta, asistente
  await page.click('#btn-actualizar'); await pausa(page);
  await page.click('#btn-inicio-rapido'); await pausa(page);
  await page.click('#btn-acerca'); await cerrarDialogo(page);
  await page.click('#btn-asistente'); await pausa(page);
  await page.click('#plegar-cinta'); await page.click('#plegar-cinta');
  await page.fill('#zoom', '110');
  await ctx.close();
  assert.deepEqual(errores.slice(antes), []);
});

test('Interfaz: presupuesto, tablas, gastos, otrosíes, suspensiones, liquidación, campana y búsqueda', async () => {
  const antes = errores.length;
  const { page, ctx } = await abrirApp(USU.director);
  const nodos = await page.$$eval('#arbol [data-k]', ns => ns.map(n => n.dataset.k));
  const ob = nodos.find(k => k.startsWith('presupuesto:'));
  // Presupuesto: capítulo, ítem, editar, exportar, eliminar, pegar e importar Excel
  await page.click(`#arbol [data-k="${ob}"]`); await pausa(page);
  await cinta(page, 'obra', 'Nuevo capítulo');
  await cinta(page, 'obra', 'Nuevo ítem');
  await editarCelda(page, '#g-pres tr.sel td[data-c="descripcion"]', 'Ítem desde la interfaz');
  await editarCelda(page, '#g-pres tr:has-text("Ítem desde la interfaz") td[data-c="cantidad"]', '1.234,5');
  assert.equal(Number(await page.locator('#g-pres tr:has-text("Ítem desde la interfaz") td[data-c="cantidad"]').getAttribute('data-v')), 1234.5);
  await page.click('#pestanas-cinta [data-c="obra"]');
  const x = await descarga(page, () => page.click(boton('Exportar a Excel')));
  assert.equal(x.nombre, 'Presupuesto_obra.xlsx'); assert.ok(esZip(x.buf));
  for (const fila of ['Ítem desde la interfaz', 'NUEVO CAPÍTULO']) {
    const n = await page.locator(`#g-pres tr:has-text("${fila}")`).count();
    await page.locator(`#g-pres tr:has-text("${fila}") td:nth-child(6)`).last().click();
    await cinta(page, 'obra', 'Eliminar fila');
    assert.equal(await page.locator(`#g-pres tr:has-text("${fila}")`).count(), n - 1, 'no se eliminó ' + fila);
  }
  await cinta(page, 'obra', 'Pegar desde Excel');
  await page.fill('#pegado', '88\tCAPÍTULO EXCEL\n88.1\tÍtem Excel\tML\t2,5\t1.000');
  await page.click('#ok-pegar'); await pausa(page);
  assert.equal(await page.locator('#g-pres tr:has-text("Ítem Excel")').count(), 1);
  await page.click('#g-pres tr:has-text("CAPÍTULO EXCEL") td:nth-child(6)');
  await cinta(page, 'obra', 'Eliminar fila');
  const xlsx = path.join(ARCH, 'presupuesto.xlsx'); archivosEjemplo();
  fs.writeFileSync(xlsx, Buffer.from(await excelPresupuesto(), 'base64'));
  await page.click('#pestanas-cinta [data-c="obra"]');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click(boton('Importar Excel (.xlsx)'))]);
  await fc.setFiles(xlsx); await pausa(page, 800);
  assert.equal(await page.locator('#g-pres tr:has-text("Base granular importada")').count(), 1);
  await page.click('#g-pres tr:has-text("CAPÍTULO IMPORTADO") td:nth-child(6)');
  await cinta(page, 'obra', 'Eliminar fila');

  // Tablas de registros: nueva fila, editar, adjuntar, borrar
  for (const t of ['vencimiento', 'correspondencia', 'bitacora', 'ensayo', 'personal', 'poliza', 'sst', 'sst_mes', 'ambiental', 'pmt', 'social']) {
    await page.click(`#arbol [data-k="tabla:${t}"]`); await pausa(page);
    if (await page.locator('#bit-tabla').count()) { await page.click('#bit-tabla'); await pausa(page); } // la bitácora abre como libreta
    const n0 = await page.locator('#g-tabla tbody tr[data-id]').count();
    await page.click('#t-nuevo'); await pausa(page);
    assert.equal(await page.locator('#g-tabla tbody tr[data-id]').count(), n0 + 1, 'no se creó la fila en ' + t);
    const id = await ultimoId(page, '#g-tabla');
    const col = await page.locator(`#g-tabla tr[data-id="${id}"] td.edit[data-tipo="text"]`).first().getAttribute('data-c');
    await editarCelda(page, `#g-tabla tr[data-id="${id}"] td[data-c="${col}"]`, 'Texto de prueba ' + t);
    assert.equal(await page.locator(`#g-tabla tr[data-id="${id}"] td[data-c="${col}"]`).getAttribute('data-v'), 'Texto de prueba ' + t);
    if (t === 'bitacora') {
      // Adjuntos del registro
      await page.click(`#g-tabla [data-adj="bitacora:${id}"]`); await pausa(page);
      await page.setInputFiles('#adj-archivos', [path.join(ARCH, 'foto avance.png'), path.join(ARCH, 'acta de vecindad.txt')]); await pausa(page, 800);
      assert.equal(await page.locator('#dialogo .adjuntos .adj').count(), 2);
      await page.click('#dialogo [data-quitar]'); await pausa(page);
      assert.equal(await page.locator('#dialogo .adjuntos .adj').count(), 1);
      await page.click('#dialogo button[value="ok"]'); await pausa(page);
      assert.match(await page.getAttribute(`#g-tabla [data-adj="bitacora:${id}"]`, 'class'), /\bcon\b/);
    }
    await page.click(`#g-tabla [data-borrar="${id}"]`); await pausa(page);
    assert.equal(await page.locator(`#g-tabla tr[data-id="${id}"]`).count(), 0, 'no se borró la fila en ' + t);
  }

  // Gastos reales
  await page.click(`#arbol [data-k="${nodos.find(k => k.startsWith('gastos:'))}"]`); await pausa(page);
  await page.click('#g-nuevo'); await pausa(page);
  const gid = await ultimoId(page, '#g-gastos');
  await editarCelda(page, `#g-gastos tr[data-id="${gid}"] td[data-c="valor"]`, '150000');
  await page.click(`#g-gastos [data-borrar="${gid}"]`); await pausa(page);
  assert.equal(await page.locator(`#g-gastos tr[data-id="${gid}"]`).count(), 0);

  // Otrosí: crear, firmar, sumar cantidad a un ítem; la campana avisa de las pólizas
  await page.click(`#arbol [data-k="${nodos.find(k => k.startsWith('otrosis:'))}"]`); await pausa(page);
  await page.click('#o-nuevo'); await pausa(page);
  const oid = await ultimoId(page, '#g-otrosi');
  await editarCelda(page, `#g-otrosi tr[data-id="${oid}"] td[data-c="valor"]`, '2000000');
  await editarCelda(page, `#g-otrosi tr[data-id="${oid}"] td[data-c="estado"]`, 'Firmado');
  await page.selectOption('#oi-otrosi', String(oid));
  await page.fill('#oi-cant', '5'); await page.click('#oi-agregar'); await pausa(page);
  assert.ok(await page.locator('#g-oitem tr[data-id]').count() >= 1);
  await page.click('#btn-campana');
  assert.match(await page.textContent('#panel-avisos'), /Ajustar las pólizas/);
  await page.click('#panel-avisos .aviso-fila:has-text("Ajustar las pólizas")'); await pausa(page);
  await page.click(`#g-otrosi [data-borrar="${oid}"]`); await pausa(page);
  assert.equal(await page.locator(`#g-otrosi tr[data-id="${oid}"]`).count(), 0);

  // Suspensión y reinicio
  await page.click(`#arbol [data-k="${nodos.find(k => k.startsWith('suspensiones:'))}"]`); await pausa(page);
  await page.click('#s-nueva'); await pausa(page);
  const sid = await ultimoId(page, '#g-susp');
  assert.match(await page.textContent('#contenido-doc'), /Suspendido/);
  await editarCelda(page, `#g-susp tr[data-id="${sid}"] td[data-c="motivo"]`, 'Ola invernal');
  await page.click(`#g-susp [data-borrar="${sid}"]`); await pausa(page);
  // Liquidación: la primera edición crea la ficha
  await page.click(`#arbol [data-k="${nodos.find(k => k.startsWith('liquidacion:'))}"]`); await pausa(page);
  await editarCelda(page, '#g-liq td[data-c="paz_y_salvos"]', 'Pendiente parafiscales');
  await editarCelda(page, '#g-liq td[data-c="observaciones"]', 'Sin observaciones');
  assert.equal(await page.locator('#g-liq td[data-c="observaciones"]').getAttribute('data-v'), 'Sin observaciones');

  // Usuarios: crear uno (prompt) y auditoría
  await page.click('#pestanas-cinta [data-c="inicio"]');
  await cinta(page, 'inicio', 'Usuarios');
  assert.ok(await page.locator('#g-usuarios tr[data-id]').count() >= 5);
  await cinta(page, 'inicio', 'Auditoría');
  assert.ok(await page.locator('#contenido-doc tbody tr').count() > 5);
  assert.match(await page.textContent('#contenido-doc'), /Director de interventoría/);

  // Búsqueda Ctrl+K
  await page.keyboard.press('Control+k');
  await page.fill('#buscar-global', 'Cumplimiento');
  await page.waitForSelector('#resultados .resultado', { timeout: 3000 });
  await page.keyboard.press('Enter'); await pausa(page);
  assert.ok(!(await page.evaluate(() => document.querySelector('#dialogo').open)));
  await page.click('#btn-buscar');
  await page.fill('#buscar-global', 'zzzzzz-no-existe'); await pausa(page, 600);
  assert.match(await page.textContent('#resultados'), /Sin resultados/);
  await page.keyboard.press('Escape');
  await page.click('#btn-usuario'); await page.click('[data-u="1"]'); await pausa(page);
  await ctx.close();
  assert.deepEqual(errores.slice(antes), []);
});

test('Interfaz: acta (estados, bloqueo, Excel, Word), captura de avance con foto e informe mensual', async () => {
  const antes = errores.length;
  const { page, ctx, estado } = await abrirApp(USU.director);
  const f = archivosEjemplo();
  await cinta(page, 'obra', 'Nueva acta');
  assert.match(await page.textContent('#contenido-doc'), /Acta parcial de obra/);
  const actaId = (await page.evaluate(() => document.querySelector('.pestana-doc.activo').dataset.k)).split(':')[1];
  const filaId = await page.locator('#g-acta tr[data-id]').first().getAttribute('data-id');
  const item = (await api('t/item/' + filaId));
  // Captura de avance con foto: se suma a la cantidad presentada del acta en borrador
  await page.click('#btn-captura'); await pausa(page);
  await page.selectOption('#av-item', String(filaId));
  await page.fill('#av-largo', '3'); await page.fill('#av-ancho', '2'); await page.fill('#av-espesor', '0,5'); await page.fill('#av-piezas', '1');
  await page.fill('#av-cant', '4');
  await page.uncheck('#av-gps');
  await page.click('#av-guardar'); await pausa(page);
  assert.match(await page.textContent('#av-msg'), /foto/, 'sin foto no se guarda');
  await page.setInputFiles('#av-fotos', f.png);
  await page.click('#av-guardar'); await pausa(page, 1200);
  assert.ok(!(await page.evaluate(() => document.querySelector('#dialogo').open)), 'el diálogo de captura debe cerrarse');
  let d = await api('acta/' + actaId);
  assert.equal(d.filas.find(x => x.id === Number(filaId)).cant_presentada, 4, 'la captura se suma al acta ' + item.codigo);
  // Rechazar y borrar desde la lista de capturas
  await page.click('#arbol [data-k="avances"]'); await pausa(page);
  const avId = await ultimoId(page, '#g-avances');
  assert.equal((await api(`adjuntos/${(await proyecto()).pid}?tabla=avance&registro_id=${avId}`)).length, 1, 'la foto quedó adjunta');
  await editarCelda(page, `#g-avances tr[data-id="${avId}"] td[data-c="estado"]`, 'Rechazado');
  d = await api('acta/' + actaId);
  assert.equal(d.filas.find(x => x.id === Number(filaId)).cant_presentada, 0, 'rechazar descuenta del acta');
  await editarCelda(page, `#g-avances tr[data-id="${avId}"] td[data-c="estado"]`, 'Reportado');
  await page.click(`#g-avances [data-borrar="${avId}"]`); await pausa(page);
  d = await api('acta/' + actaId);
  assert.equal(d.filas.find(x => x.id === Number(filaId)).cant_presentada, 0, 'borrar descuenta del acta');

  // Acta: editar, aprobar todo, exportar, estados y bloqueo
  await page.click(`#arbol [data-k="acta:${actaId}"]`); await pausa(page);
  await editarCelda(page, '#g-acta tr[data-id] td[data-c="cant_presentada"]', '5');
  await cinta(page, 'obra', 'Aprobar lo presentado');
  assert.equal(Number(await page.locator('#g-acta tr[data-id] td[data-c="cant_aprobada"]').first().getAttribute('data-v')), 5);
  await editarCelda(page, '#g-acta-cab td[data-c="hasta"]', '2026-03-31');
  await page.click('#pestanas-cinta [data-c="obra"]');
  const xl = await descarga(page, () => page.click(boton('Acta en Excel')));
  assert.match(xl.nombre, /^Acta_\d+\.xlsx$/); assert.ok(esZip(xl.buf));
  await page.click('#pestanas-cinta [data-c="obra"]');
  const wd = await descarga(page, () => page.click(boton('Acta en Word')));
  assert.match(wd.nombre, /^Acta_\d+\.docx$/); assert.ok(esZip(wd.buf));
  await cumplirChequeo(actaId);
  for (const e of ['Radicada', 'En revisión', 'Aprobada interventoría']) { await page.click(`#pasos-acta [data-e="${e}"]`); await pausa(page, 500); }
  assert.ok(await page.isVisible('.candado'));
  assert.equal(await page.locator('#g-acta td.edit').count(), 0, 'el acta aprobada no debe tener celdas editables');
  await page.click('#pasos-acta [data-e="Borrador"]'); await pausa(page, 500);
  assert.ok(!(await page.isVisible('.candado')));
  await api('t/acta/' + actaId, { metodo: 'DELETE' });

  // Informe mensual (Word)
  estado.prompt = '2026-01';
  await page.click('#pestanas-cinta [data-c="informes"]');
  const inf = await descarga(page, () => page.click(boton('Informe mensual')));
  assert.equal(inf.nombre, 'Informe_mensual_2026-01.docx'); assert.ok(esZip(inf.buf));
  estado.prompt = null;

  // Programa de obra (Project) y plano (LandXML)
  await page.click('#arbol [data-k="programa"]'); await pausa(page);
  let [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#p-importar')]);
  await fc.setFiles(f.project); await pausa(page, 800);
  assert.ok(await page.locator('#g-programa tr[data-id]').count() >= 5);
  const pr = await descarga(page, () => page.click('#p-exportar'));
  assert.match(pr.buf.toString(), /Excavación mecánica/);
  await page.click('#arbol [data-k="plano"]'); await pausa(page);
  [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#pl-importar')]);
  await fc.setFiles(f.landxml); await pausa(page, 800);
  assert.ok(await page.isVisible('svg.plano'));
  await page.click('#pl-tramo'); await pausa(page);
  const tid = await ultimoId(page, '#g-tramos');
  await editarCelda(page, `#g-tramos tr[data-id="${tid}"] td[data-c="avance"]`, '60');
  await page.click(`#g-tramos [data-borrar="${tid}"]`); await pausa(page);
  assert.equal(await page.locator(`#g-tramos tr[data-id="${tid}"]`).count(), 0);

  // Registro fotográfico y Power BI
  await page.click('#arbol [data-k="fotos"]'); await pausa(page);
  await page.fill('#f-mes', ''); await page.dispatchEvent('#f-mes', 'change'); await pausa(page);
  await page.setInputFiles('#adj-archivos', f.png); await pausa(page, 800);
  const nf = await page.locator('#contenido-doc .adj').count();
  assert.ok(nf >= 1);
  await page.click('#contenido-doc [data-quitar]'); await pausa(page);
  assert.equal(await page.locator('#contenido-doc .adj').count(), nf - 1);
  await page.click('#arbol [data-k="graficos"]'); await pausa(page);
  const bi = await descarga(page, () => page.click('#contenido-doc a[href$="/actas.csv"]'));
  assert.match(bi.buf.toString(), /numero/);
  await ctx.close();
  assert.deepEqual(errores.slice(antes), []);
});

test('Interfaz: vistas de ambiental, social y correo', async () => {
  const antes = errores.length;
  const { page, ctx } = await abrirApp(USU.director);
  const nodos = await page.$$eval('#arbol [data-k^="tabla:"]', ns => ns.map(n => n.dataset.k.slice(6)));
  const AMB = ['amb_ficha', 'amb_requisito', 'ambiental', 'amb_permiso', 'rcd', 'forestal', 'agua', 'maquinaria', 'monitoreo', 'amb_chequeo', 'pmt', 'pmt_inspeccion'];
  const SOC = ['pqrs', 'reunion', 'acta_vecindad', 'mano_obra', 'capacitacion', 'afectacion', 'encuesta', 'veeduria', 'social'];
  for (const t of [...AMB, ...SOC]) {
    assert.ok(nodos.includes(t), 'falta el nodo ' + t + ' en el explorador');
    await page.click(`#arbol [data-k="tabla:${t}"]`); await pausa(page);
    assert.ok(!/^\s*Error/.test(await page.textContent('#contenido-doc')), 'la vista ' + t + ' muestra un error');
    const n0 = await page.locator('#g-tabla tbody tr[data-id]').count();
    await page.click('#t-nuevo'); await pausa(page);
    assert.equal(await page.locator('#g-tabla tbody tr[data-id]').count(), n0 + 1, 'no se creó la fila en ' + t);
    const id = await ultimoId(page, '#g-tabla');
    await page.click(`#g-tabla [data-borrar="${id}"]`); await pausa(page);
    assert.equal(await page.locator(`#g-tabla tr[data-id="${id}"]`).count(), 0, 'no se borró la fila en ' + t);
  }
  // Correo (Gmail): la configuración solo la ve el director; sin cuenta, revisar avisa sin romper nada
  await cinta(page, 'inicio', 'Correo (Gmail)');
  assert.ok(await page.isVisible('#co-correo'));
  await cerrarDialogo(page);
  await cinta(page, 'inicio', 'Revisar ahora');
  assert.match(await page.textContent('#estado-mensaje'), /Gmail|correo/i);
  await ctx.close();
  assert.deepEqual(errores.slice(antes), []);
  const cfg = await api('correo/config');
  assert.ok(!/"(clave|password|contrasena)":"[^"]+"/i.test(JSON.stringify(cfg)), 'la configuración no debe devolver la contraseña');
  await api('correo/config', { usuario: USU.entidad, esperado: 403 });
  await api('correo/revisar', { metodo: 'POST', usuario: USU.residente, esperado: 403 });
  await api('correo/estado');
});

test('Interfaz: rol de solo consulta (entidad) recibe 403 sin romper la página', async () => {
  const antes = errores.length;
  const { page, ctx, estado } = await abrirApp(USU.entidad);
  estado.propios.push(403);
  const msg = () => page.textContent('#estado-mensaje');
  await cinta(page, 'obra', 'Presupuesto de obra');
  for (const b of ['Nuevo capítulo', 'Nuevo ítem', 'Nueva acta']) {
    await cinta(page, 'obra', b);
    assert.match(await msg(), /permiso/, `"${b}" debe avisar que no hay permiso`);
  }
  await cinta(page, 'inicio', 'Vencimientos');
  await page.click('#t-nuevo'); await pausa(page);
  assert.match(await msg(), /permiso/);
  const nodos = await page.$$eval('#arbol [data-k]', ns => ns.map(n => n.dataset.k));
  await page.click(`#arbol [data-k="${nodos.find(k => k.startsWith('gastos:'))}"]`); await pausa(page);
  await page.click('#g-nuevo'); await pausa(page);
  assert.match(await msg(), /permiso/);
  await page.click(`#arbol [data-k="${nodos.find(k => k.startsWith('suspensiones:'))}"]`); await pausa(page);
  await page.click('#s-nueva'); await pausa(page);
  assert.match(await msg(), /permiso/);
  // Editar una celda de un registro existente
  await page.click('#arbol [data-k="tabla:poliza"]'); await pausa(page);
  const pid = await ultimoId(page, '#g-tabla');
  await editarCelda(page, `#g-tabla tr[data-id="${pid}"] td[data-c="notas"]`, 'No debería guardarse');
  assert.notEqual(await page.locator(`#g-tabla tr[data-id="${pid}"] td[data-c="notas"]`).getAttribute('data-v'), 'No debería guardarse');
  // Captura de avance con foto
  await page.click('#btn-captura'); await pausa(page);
  await page.selectOption('#av-item', { index: 1 });
  await page.fill('#av-cant', '1'); await page.uncheck('#av-gps');
  await page.setInputFiles('#av-fotos', path.join(ARCH, 'foto avance.png'));
  await page.click('#av-guardar'); await pausa(page);
  assert.match(await page.textContent('#av-msg'), /permiso/);
  await cerrarDialogo(page);
  await ctx.close();
  assert.deepEqual(errores.slice(antes), []);
});

after(() => { try { fs.rmSync(ARCH, { recursive: true, force: true }); } catch {} });
