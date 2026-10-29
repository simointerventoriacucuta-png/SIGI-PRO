// SIGI Pro - servidor interno: API JSON + archivos de la interfaz.
// Base de datos libSQL (local o sincronizada con Turso), ver db.js.
// Uso: node server.js   →   http://localhost:4027
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Base } = require('./db.js');
const integ = require('./integraciones.js');
const { informeFormato, informeSSTFormato, informeAmbiental, informeSocial } = require('./informe.js');
const { cargarPaga } = require('./seed/paga.js');
const prov = require('./proveedores.js');
const { crearCorreo } = require('./correo.js');

const PUERTO = process.env.PORT != null ? Number(process.env.PORT) : 4027;
const RAIZ = __dirname;
const DATOS = process.env.SIGI_DATOS || path.join(RAIZ, 'datos');
fs.mkdirSync(DATOS, { recursive: true });
const ESQUEMA = fs.readFileSync(path.join(RAIZ, 'schema.sql'), 'utf8');
const db = new Base(DATOS);

// Anexos de SST de la interventoría (ver schema.sql)
const SST_ANEXOS = ['sst_peligro', 'sst_inspeccion', 'sst_permiso', 'sst_capacitacion', 'sst_trabajador', 'sst_epp', 'sst_seguridad_social', 'sst_investigacion', 'sst_emergencia', 'sst_equipo', 'sst_actividad', 'sst_documento'];

// Anexos ambientales del PAGA y del PMT (ver schema.sql)
const AMB = ['amb_ficha', 'amb_requisito', 'amb_permiso', 'rcd', 'forestal', 'agua', 'maquinaria', 'monitoreo', 'amb_chequeo', 'pmt_inspeccion'];

// Tablas que se pueden editar con la API genérica, y la columna que las ata al padre
const TABLAS = {
  proyecto: null, contrato: 'proyecto_id', item: 'contrato_id', acta: 'contrato_id', otrosi: 'contrato_id', otrosi_item: 'otrosi_id', gasto: 'contrato_id',
  suspension: 'contrato_id', liquidacion: 'contrato_id',
  vencimiento: 'proyecto_id', personal: 'proyecto_id', poliza: 'proyecto_id',
  correspondencia: 'proyecto_id', bitacora: 'proyecto_id', ensayo: 'proyecto_id', usuario: null,
  tarea: 'proyecto_id', alineamiento: 'proyecto_id', tramo: 'proyecto_id', sst: 'proyecto_id', sst_mes: 'proyecto_id', ...Object.fromEntries(SST_ANEXOS.map(t => [t, 'proyecto_id'])), ambiental: 'proyecto_id', pmt: 'proyecto_id', ...Object.fromEntries(AMB.map(t => [t, 'proyecto_id'])), social: 'proyecto_id', adjunto: 'proyecto_id', avance: 'proyecto_id',
  requisicion: 'proyecto_id', requisicion_item: 'requisicion_id',
  pqrs: 'proyecto_id', reunion: 'proyecto_id', acta_vecindad: 'proyecto_id', mano_obra: 'proyecto_id', capacitacion: 'proyecto_id', afectacion: 'proyecto_id', encuesta: 'proyecto_id', veeduria: 'proyecto_id', ficha_social: null,
};
// Borrado en cascada explícito (en la nube no se puede confiar en PRAGMA foreign_keys)
const HIJOS = {
  proyecto: [['contrato', 'proyecto_id'], ['vencimiento', 'proyecto_id'], ['personal', 'proyecto_id'], ['poliza', 'proyecto_id'], ['correspondencia', 'proyecto_id'], ['bitacora', 'proyecto_id'], ['ensayo', 'proyecto_id'],
    ['tarea', 'proyecto_id'], ['tramo', 'proyecto_id'], ['alineamiento', 'proyecto_id'], ['sst', 'proyecto_id'], ['sst_mes', 'proyecto_id'], ...SST_ANEXOS.map(t => [t, 'proyecto_id']), ['ambiental', 'proyecto_id'], ['pmt', 'proyecto_id'], ...AMB.map(t => [t, 'proyecto_id']), ['social', 'proyecto_id'], ['adjunto', 'proyecto_id'], ['avance', 'proyecto_id'], ['requisicion', 'proyecto_id'],
    ['pqrs', 'proyecto_id'], ['reunion', 'proyecto_id'], ['acta_vecindad', 'proyecto_id'], ['mano_obra', 'proyecto_id'], ['capacitacion', 'proyecto_id'], ['afectacion', 'proyecto_id'], ['encuesta', 'proyecto_id'], ['veeduria', 'proyecto_id']],

  requisicion: [['requisicion_item', 'requisicion_id']],
  alineamiento: [['tramo', 'alineamiento_id']],
  adjunto: [['adjunto_dato', 'adjunto_id']],
  contrato: [['otrosi', 'contrato_id'], ['acta', 'contrato_id'], ['item', 'contrato_id'], ['gasto', 'contrato_id'], ['suspension', 'contrato_id'], ['liquidacion', 'contrato_id'], ['requisicion', 'contrato_id']],
  acta: [['acta_item', 'acta_id'], ['acta_requisito', 'acta_id']],
  otrosi: [['otrosi_item', 'otrosi_id']],
  item: [['item', 'padre_id'], ['acta_item', 'item_id'], ['otrosi_item', 'item_id']],
};
const columnas = {};

// ---------- Usuarios, permisos y auditoría ----------
const ROLES = ['director', 'residente', 'especialista', 'administrativo', 'entidad'];
// Qué puede modificar cada rol (POST, PUT, DELETE). La consulta (GET) es libre para todos.
const PERMISOS = {
  director: '*',
  residente: ['avance', 'adjunto', 'item', 'acta', 'acta_item', 'bitacora', 'ensayo', 'vencimiento', 'correspondencia', 'tarea', 'alineamiento', 'tramo', 'sst', 'sst_mes', ...SST_ANEXOS, 'ambiental', 'pmt', 'social', 'pqrs', 'reunion', 'acta_vecindad', 'mano_obra', 'capacitacion', 'afectacion', 'encuesta', 'veeduria', ...AMB, 'requisicion', 'requisicion_item'],
  especialista: ['avance', 'adjunto', 'acta_item', 'bitacora', 'ensayo', 'tramo', 'sst', 'sst_mes', ...SST_ANEXOS, 'ambiental', 'pmt', 'social', 'pqrs', 'reunion', 'acta_vecindad', 'mano_obra', 'capacitacion', 'afectacion', 'encuesta', 'veeduria', ...AMB, 'requisicion', 'requisicion_item'],
  administrativo: ['adjunto', 'otrosi', 'otrosi_item', 'suspension', 'liquidacion', 'acta', 'gasto', 'personal', 'poliza', 'correspondencia', 'vencimiento', 'requisicion', 'requisicion_item'],
  entidad: [],
};
const puede = (u, recurso) => !!u && (PERMISOS[u.rol] === '*' || (PERMISOS[u.rol] || []).includes(recurso));

// Estados del acta en orden. Desde "Aprobada interventoría" el acta queda bloqueada.
const ESTADOS_ACTA = ['Borrador', 'Radicada', 'En revisión', 'Con observaciones', 'Aprobada interventoría', 'Avalada entidad', 'Pagada'];
const BLOQUEO = ESTADOS_ACTA.indexOf('Aprobada interventoría');
const bloqueada = a => !!a && ESTADOS_ACTA.indexOf(a.estado) >= BLOQUEO;
// Quién puede llevar un acta a cada estado (los primeros cuatro, quien pueda editar actas)
const QUIEN_ESTADO = { 'Aprobada interventoría': ['director'], 'Avalada entidad': ['director', 'administrativo'], Pagada: ['director', 'administrativo'] };

// Requisiciones (RQ): estados, transiciones permitidas y quién puede hacerlas
const ESTADOS_RQ = ['Borrador', 'Solicitada', 'Aprobada', 'Rechazada', 'Atendida'];
const PASOS_RQ = { Borrador: ['Solicitada'], Solicitada: ['Aprobada', 'Rechazada', 'Borrador'], Aprobada: ['Atendida', 'Solicitada'], Rechazada: ['Borrador'], Atendida: ['Aprobada'] };
const QUIEN_RQ = { Aprobada: ['director'], Rechazada: ['director'], Atendida: ['director', 'administrativo'] };
const rqCerrada = r => !!r && !['Borrador', 'Solicitada'].includes(r.estado);

class Rechazo extends Error { constructor(codigo, msg) { super(msg); this.codigo = codigo; } }

async function usuarioDe(req) {
  const id = Number(req.headers['x-usuario']);
  return id ? (await db.get('SELECT * FROM usuario WHERE id = ? AND activo = 1', id)) || null : null;
}
function exigir(u, recurso) {
  if (!u) throw new Rechazo(401, 'Elija un usuario para hacer cambios');
  if (!puede(u, recurso)) throw new Rechazo(403, `El rol ${u.rol} no tiene permiso para modificar ${recurso}`);
}
async function auditar(u, tabla, registroId, accion, cambio) {
  await db.run('INSERT INTO auditoria (fecha, usuario_id, usuario, tabla, registro_id, accion, cambio) VALUES (?,?,?,?,?,?,?)',
    new Date().toISOString(), u?.id ?? null, u ? `${u.nombre} (${u.rol})` : null, tabla, registroId == null ? null : String(registroId), accion, cambio == null ? null : JSON.stringify(cambio));
}
// Solo lo que cambió: { campo: [antes, después] }
function diferencia(antes, despues) {
  const d = {};
  for (const k of Object.keys(despues)) if ((antes?.[k] ?? null) !== (despues[k] ?? null)) d[k] = [antes?.[k] ?? null, despues[k] ?? null];
  return d;
}
// ---------- Lista de chequeo documental del acta ----------
const ESTADOS_REQ = ['Pendiente', 'Cumple', 'No cumple', 'No aplica'];
// Requisitos usuales para tramitar un acta de pago en obra vial (se pueden ajustar por acta)
const REQUISITOS = {
  obra: ['Oficio de radicación del acta por el contratista', 'Memorias de cálculo de cantidades', 'Registro fotográfico del periodo',
    'Resultados de ensayos de laboratorio que soportan los ítems', 'Planilla de seguridad social y parafiscales del periodo (art. 50 Ley 789 de 2002)',
    'Pólizas vigentes y ajustadas a otrosíes', 'Informe de SST y ambiental del periodo', 'Factura electrónica',
    'Amortización del anticipo y retenciones calculadas', 'Publicación de soportes en SECOP II'],
  interventoria: ['Informe mensual de interventoría', 'Planilla de seguridad social y parafiscales del periodo', 'Factura electrónica o cuenta de cobro',
    'Certificado de cumplimiento del supervisor', 'Pólizas vigentes', 'Publicación de soportes en SECOP II'],
};
async function chequeo(actaId) {
  const a = await db.get('SELECT a.*, c.tipo FROM acta a JOIN contrato c ON c.id = a.contrato_id WHERE a.id = ?', actaId);
  if (!a) throw new Rechazo(404, 'No existe el acta');
  let filas = await db.all('SELECT * FROM acta_requisito WHERE acta_id = ? ORDER BY orden, id', actaId);
  if (!filas.length) {
    let n = 0;
    for (const r of REQUISITOS[a.tipo] || REQUISITOS.obra) await db.run('INSERT INTO acta_requisito (acta_id, orden, requisito) VALUES (?,?,?)', actaId, ++n, r);
    filas = await db.all('SELECT * FROM acta_requisito WHERE acta_id = ? ORDER BY orden, id', actaId);
  }
  const faltan = filas.filter(f => f.obligatorio && !['Cumple', 'No aplica'].includes(f.estado));
  return { estados: ESTADOS_REQ, filas, completo: !faltan.length, faltan: faltan.length };
}
async function detalleRQ(id) {
  const r = await db.get('SELECT * FROM requisicion WHERE id = ?', id);
  if (!r) throw new Rechazo(404, 'No existe la requisición');
  const contrato = r.contrato_id ? await db.get('SELECT * FROM contrato WHERE id = ?', r.contrato_id) : null;
  const items = await db.all(`SELECT ri.*, i.codigo item_codigo, i.descripcion item_descripcion FROM requisicion_item ri LEFT JOIN item i ON i.id = ri.item_id
    WHERE ri.requisicion_id = ? ORDER BY ri.id`, id);
  for (const x of items) x.total = r2((x.cantidad || 0) * (x.vr_unitario || 0));
  return { requisicion: r, contrato, items, total: r2(items.reduce((s, x) => s + x.total, 0)) };
}
// Cambio de datos o de estado de una RQ; al atenderla en el contrato de interventoría se registra el gasto
async function validarRQ(u, antes, d) {
  if (d.estado != null && !ESTADOS_RQ.includes(d.estado)) throw new Rechazo(400, 'Estado desconocido: ' + d.estado);
  const nuevo = d.estado != null && d.estado !== (antes?.estado || 'Borrador') ? d.estado : null;
  if (!antes) { if (d.estado && d.estado !== 'Borrador') throw new Rechazo(400, 'La requisición nace en Borrador'); return; }
  const otros = Object.keys(d).filter(k => !['estado', 'motivo_rechazo', 'proveedor', 'documento', 'fecha_atencion'].includes(k));
  if (rqCerrada(antes) && otros.length) throw new Rechazo(409, `La RQ ${antes.numero} está "${antes.estado}" y no se puede editar`);
  if (!nuevo) return;
  if (!PASOS_RQ[antes.estado]?.includes(nuevo)) throw new Rechazo(409, `No se puede pasar de "${antes.estado}" a "${nuevo}"`);
  if (QUIEN_RQ[nuevo] && !QUIEN_RQ[nuevo].includes(u.rol)) throw new Rechazo(403, `El rol ${u.rol} no puede pasar la RQ a "${nuevo}"`);
  if (['Aprobada', 'Atendida'].includes(antes.estado) && nuevo !== 'Atendida' && u.rol !== 'director') throw new Rechazo(403, 'Solo el director puede devolver una RQ aprobada o atendida');
  if (nuevo === 'Solicitada') {
    const n = (await db.get('SELECT COUNT(*) n FROM requisicion_item WHERE requisicion_id = ? AND cantidad > 0', antes.id)).n;
    if (!n) throw new Rechazo(400, 'Agregue al menos un ítem con cantidad antes de solicitar la RQ');
  }
  if (nuevo === 'Rechazada' && !String(d.motivo_rechazo ?? antes.motivo_rechazo ?? '').trim()) throw new Rechazo(400, 'Escriba el motivo del rechazo');
  if (nuevo === 'Aprobada' && antes.estado === 'Solicitada') { d.aprobado_por = u.nombre; d.fecha_aprobacion = new Date().toISOString().slice(0, 10); }
  if (nuevo === 'Atendida') {
    d.fecha_atencion = d.fecha_atencion || new Date().toISOString().slice(0, 10);
    const c = antes.contrato_id && await db.get('SELECT * FROM contrato WHERE id = ?', antes.contrato_id);
    if (c && c.tipo !== 'obra' && !antes.gasto_id) {
      const det = await detalleRQ(antes.id), item = det.items.find(x => x.item_id)?.item_id || null;
      const g = await db.run('INSERT INTO gasto (contrato_id, item_id, fecha, descripcion, proveedor, documento, valor, pagado) VALUES (?,?,?,?,?,?,?,?)',
        c.id, item, d.fecha_atencion, `RQ ${antes.numero}: ${antes.justificacion || det.items.map(x => x.descripcion).join(', ')}`.slice(0, 300),
        d.proveedor ?? antes.proveedor ?? null, d.documento ?? antes.documento ?? null, det.total, 'No');
      d.gasto_id = g.id;
      await auditar(u, 'gasto', g.id, 'crear', { desde_rq: antes.numero, valor: det.total });
    }
  }
  // Si el director la devuelve desde Atendida, se quita el gasto que se había creado
  if (antes.estado === 'Atendida' && nuevo === 'Aprobada' && antes.gasto_id) { await db.run('DELETE FROM gasto WHERE id = ?', antes.gasto_id); d.gasto_id = null; }
}
async function rqEditable(rqId) {
  const r = await db.get('SELECT * FROM requisicion WHERE id = ?', rqId);
  if (!r) throw new Rechazo(404, 'No existe la requisición');
  if (rqCerrada(r)) throw new Rechazo(409, `La RQ ${r.numero} está "${r.estado}" y no se puede editar`);
}
async function actaEditable(actaId) {
  const a = await db.get('SELECT * FROM acta WHERE id = ?', actaId);
  if (bloqueada(a)) throw new Rechazo(409, `El acta ${a.numero} está "${a.estado}" y no se puede editar`);
  return a;
}

// El precio de un ítem ya pagado en un acta aprobada no puede cambiar (cambiaría el valor del acta cerrada)
async function precioLibre(itemId) {
  const a = (await db.all('SELECT a.numero, a.estado FROM acta_item ai JOIN acta a ON a.id = ai.acta_id WHERE ai.item_id = ? AND ai.cant_aprobada <> 0', itemId)).find(bloqueada);
  if (a) throw new Rechazo(409, `El ítem está en el acta ${a.numero} "${a.estado}": su valor unitario no se puede cambiar`);
}

// Fichas sociales del PAGA según la Guía de Manejo Ambiental del INVÍAS 2022 (programas 6 a 10). Los códigos se comparten con el área ambiental.
const FICHAS_SOCIALES = [
  ['PDL-6.1-21', '6. Gestión social y desarrollo local', 'Mano de obra contratada con enfoque de género, de derechos y diferencial'],
  ['PDL-6.2-22', '6. Gestión social y desarrollo local', 'Obras de participación comunitaria'],
  ['PDL-6.3-23', '6. Gestión social y desarrollo local', 'Desarrollo local (según el PAGA del proyecto)'],
  ['PPSI-7.1-24', '7. Patrimonio', 'Patrimonio (según el PAGA del proyecto)'],
  ['PPSI-7.2-25', '7. Patrimonio', 'Protección del patrimonio cultural'],
  ['PPSI-7.3-26', '7. Patrimonio', 'Protección del patrimonio geológico y paleontológico'],
  ['PPSI-7.4-27', '7. Patrimonio', 'Acompañamiento a la consulta previa con comunidades étnicas'],
  ['PGS-8.1-28', '8. Predios y servicios', 'Infraestructura de predios y servicios públicos'],
  ['PGS-8.2-29', '8. Predios y servicios', 'Apoyo a la gestión interinstitucional'],
  ['PGS-8.3-30', '8. Predios y servicios', 'Acompañamiento a la gestión socio predial'],
  ['PA-9.1-31', '9. Accesibilidad', 'Accesibilidad de la población e integración territorial'],
  ['PPGI-10.1-32', '10. Participación, gobernanza e inclusión', 'Atención a la comunidad'],
  ['PPGI-10.2-33', '10. Participación, gobernanza e inclusión', 'Información y divulgación'],
  ['PPGI-10.3-34', '10. Participación, gobernanza e inclusión', 'Cultura vial y participación comunitaria'],
  ['PPGI-10.4-35', '10. Participación, gobernanza e inclusión', 'Inclusión social con perspectiva de género y transversalización'],
  ['PPG-10.5-36', '10. Participación, gobernanza e inclusión', 'Gobernanza'],
];
// Ficha por defecto de cada registro social
const FICHA_DE = { pqrs: 'PPGI-10.1-32', reunion: 'PPGI-10.2-33', acta_vecindad: 'PGS-8.3-30', mano_obra: 'PDL-6.1-21', capacitacion: 'PPGI-10.3-34', afectacion: 'PGS-8.1-28', encuesta: 'PPGI-10.1-32' };

async function iniciar() {
  await db.abrir();
  await db.exec(ESQUEMA);
  if (!(await db.all('PRAGMA table_info(usuario)')).some(c => c.name === 'correo')) await db.run('ALTER TABLE usuario ADD COLUMN correo TEXT');
  const colItem = (await db.all('PRAGMA table_info(item)')).map(c => c.name);
  for (const [c, t] of [['otrosi_id', 'INTEGER'], ['apu', 'TEXT'], ['justificacion', 'TEXT']]) if (!colItem.includes(c)) await db.run(`ALTER TABLE item ADD COLUMN ${c} ${t}`);
  const colCorr = (await db.all('PRAGMA table_info(correspondencia)')).map(c => c.name);
  for (const c of ['origen', 'message_id', 'resumen_ia', 'vencimientos_ia']) if (!colCorr.includes(c)) await db.run(`ALTER TABLE correspondencia ADD COLUMN ${c} TEXT`);
  await db.run('CREATE INDEX IF NOT EXISTS correspondencia_mid ON correspondencia (message_id)');
  // Bitácora tipo libreta: hora, incidentes, visitas y firmas (bases creadas antes de estas columnas)
  const colBit = (await db.all('PRAGMA table_info(bitacora)')).map(c => c.name);
  for (const c of ['hora', 'incidentes', 'visitas', 'firma_residente', 'firma_interventoria']) if (!colBit.includes(c)) await db.run(`ALTER TABLE bitacora ADD COLUMN ${c} TEXT`);
  for (const t of Object.keys(TABLAS)) columnas[t] = (await db.all(`PRAGMA table_info(${t})`)).map(c => c.name);
  for (const f of FICHAS_SOCIALES) await db.run('INSERT OR IGNORE INTO ficha_social (codigo, programa, nombre) VALUES (?,?,?)', ...f);
  if (!(await db.get('SELECT COUNT(*) n FROM proyecto')).n) await require('./seed/cucuta.js')(db);
  // Usuarios iniciales, uno por rol (nombres genéricos; se cambian desde la app)
  if (!(await db.get('SELECT COUNT(*) n FROM usuario')).n)
    for (const [nombre, rol] of [['Director de interventoría', 'director'], ['Residente de obra', 'residente'], ['Especialista', 'especialista'], ['Administrativo', 'administrativo'], ['Entidad contratante', 'entidad']])
      await db.run('INSERT INTO usuario (nombre, rol) VALUES (?, ?)', nombre, rol);
  // Estados antiguos del acta
  for (const [viejo, nuevo] of [['Presentada', 'Radicada'], ['Aprobada', 'Aprobada interventoría'], ['Rechazada', 'Con observaciones']])
    await db.run('UPDATE acta SET estado = ? WHERE estado = ?', nuevo, viejo);
}

async function borrar(tabla, id) {
  for (const [hijo, col] of HIJOS[tabla] || []) {
    if (hijo === 'acta_item' || hijo === 'adjunto_dato' || hijo === 'acta_requisito') { await db.run(`DELETE FROM ${hijo} WHERE ${col} = ?`, id); continue; }
    for (const h of await db.all(`SELECT id FROM ${hijo} WHERE ${col} = ?`, id)) await borrar(hijo, h.id);
  }
  if (tabla === 'otrosi') await db.run('UPDATE item SET otrosi_id = NULL WHERE otrosi_id = ?', id);
  if (tabla === 'gasto' || tabla === 'item') await db.run('UPDATE gasto SET item_id = NULL WHERE item_id = ?', tabla === 'item' ? id : -1);
  await db.run(`DELETE FROM ${tabla} WHERE id = ?`, id);
  // Los adjuntos del registro borrado
  if (tabla !== 'adjunto') for (const a of await db.all('SELECT id FROM adjunto WHERE tabla = ? AND registro_id = ?', tabla, id)) await borrar('adjunto', a.id);
}

const r2 = v => Math.round((v + Number.EPSILON) * 100) / 100;

// Totales de un contrato a partir de un costo directo (con y sin AIU)
function totales(c, cd, otros = 0) {
  if (c.iva_base === 'total') {
    const est = (c.estampillas_pct || 0) / 100;
    const sub = est < 1 ? cd / (1 - est) : cd;
    const iva = sub * (c.iva_pct || 0) / 100;
    return { costo_directo: r2(cd), estampillas: r2(sub - cd), subtotal: r2(sub), iva: r2(iva), otros: r2(otros), total: r2(sub + iva + otros) };
  }
  const a = cd * c.aiu_a / 100, i = cd * c.aiu_i / 100, u = cd * c.aiu_u / 100, iva = u * (c.iva_pct || 0) / 100;
  return { costo_directo: r2(cd), administracion: r2(a), imprevistos: r2(i), utilidad: r2(u), iva: r2(iva), otros: r2(otros), total: r2(cd + a + i + u + iva + otros) };
}

// Cantidades que suman o restan los otrosíes firmados, por ítem
async function cambiosOtrosi(contratoId) {
  return new Map((await db.all(`SELECT oi.item_id, SUM(oi.cantidad) q FROM otrosi_item oi JOIN otrosi o ON o.id = oi.otrosi_id
    WHERE o.contrato_id = ? AND o.estado = 'Firmado' GROUP BY oi.item_id`, contratoId)).map(r => [r.item_id, r.q]));
}

// Presupuesto original y vigente (cantidad contratada vigente = original + otrosíes firmados)
async function presupuesto(contratoId) {
  const c = await db.get('SELECT * FROM contrato WHERE id = ?', contratoId);
  const items = await db.all('SELECT * FROM item WHERE contrato_id = ? ORDER BY orden, id', contratoId);
  const cambios = await cambiosOtrosi(contratoId);
  let cd = 0, otros = 0, cdV = 0, otrosV = 0;
  for (const it of items) {
    if (it.tipo !== 1) continue;
    it.cantidad_vigente = r2((it.cantidad || 0) + (cambios.get(it.id) || 0));
    const v = it.cantidad * it.vr_unitario, vv = it.cantidad_vigente * it.vr_unitario;
    if (it.sin_aiu) { otros += v; otrosV += vv; } else { cd += v; cdV += vv; }
  }
  return { contrato: c, items, totales: totales(c, cd, otros), totales_vigentes: totales(c, cdV, otrosV) };
}

// Detalle de un acta: por ítem, cantidad contratada, anterior, esta acta, acumulado y saldo
async function detalleActa(actaId) {
  const acta = await db.get('SELECT * FROM acta WHERE id = ?', actaId);
  if (!acta) return null;
  const { contrato: c, items } = await presupuesto(acta.contrato_id);
  const ant = new Map((await db.all(`SELECT ai.item_id, SUM(ai.cant_aprobada) q FROM acta_item ai JOIN acta a ON a.id = ai.acta_id
    WHERE a.contrato_id = ? AND a.numero < ? GROUP BY ai.item_id`, acta.contrato_id, acta.numero)).map(r => [r.item_id, r.q]));
  const act = new Map((await db.all('SELECT * FROM acta_item WHERE acta_id = ?', actaId)).map(r => [r.item_id, r]));
  const filas = items.map(it => {
    if (it.tipo !== 1) return { ...it };
    const a = act.get(it.id) || {}, anterior = ant.get(it.id) || 0;
    const pres = a.cant_presentada || 0, apr = a.cant_aprobada || 0, acum = anterior + apr;
    return { ...it, anterior, cant_presentada: pres, cant_aprobada: apr, observacion: a.observacion || '',
      acumulado: acum, saldo: it.cantidad_vigente - acum, vr_acta: r2(apr * it.vr_unitario), vr_presentado: r2(pres * it.vr_unitario),
      vr_acumulado: r2(acum * it.vr_unitario), pct: it.cantidad_vigente ? acum / it.cantidad_vigente : 0 };
  });
  const suma = (k, f) => filas.filter(x => x.tipo === 1 && f(x)).reduce((s, x) => s + x[k], 0);
  const conAiu = x => !x.sin_aiu, sinAiu = x => !!x.sin_aiu;
  const tot = k => totales(c, suma(k, conAiu), suma(k, sinAiu));
  return { acta, contrato: c, filas, totales: { presentado: tot('vr_presentado'), acta: tot('vr_acta'), acumulado: tot('vr_acumulado') } };
}

// Control de costos del contrato propio: por ítem, presupuestado vs gastado real vs facturado (cuentas de cobro aprobadas)
async function costos(contratoId) {
  const { contrato: c, items, totales: tp } = await presupuesto(contratoId);
  const gastado = new Map((await db.all('SELECT item_id, SUM(valor) v FROM gasto WHERE contrato_id = ? GROUP BY item_id', contratoId)).map(r => [r.item_id, r.v]));
  const facturado = new Map((await db.all(`SELECT ai.item_id, SUM(ai.cant_aprobada) q FROM acta_item ai JOIN acta a ON a.id = ai.acta_id
    WHERE a.contrato_id = ? GROUP BY ai.item_id`, contratoId)).map(r => [r.item_id, r.q]));
  const filas = items.map(it => {
    if (it.tipo !== 1) return { ...it };
    const pres = it.cantidad * it.vr_unitario, gas = gastado.get(it.id) || 0, fac = (facturado.get(it.id) || 0) * it.vr_unitario;
    return { ...it, presupuestado: r2(pres), gastado: r2(gas), facturado: r2(fac), saldo: r2(pres - gas), margen: r2(fac - gas), pct: pres ? gas / pres : 0 };
  });
  const s = k => r2(filas.filter(f => f.tipo === 1).reduce((t, f) => t + f[k], 0));
  const sinItem = r2(gastado.get(null) || 0);
  const cdFacturado = s('facturado');
  return { contrato: c, filas, sin_item: sinItem,
    totales: { presupuestado: s('presupuestado'), gastado: r2(s('gastado') + sinItem), facturado_cd: cdFacturado,
      facturado_total: totales(c, cdFacturado).total, valor_contrato: tp.total } };
}

const hoyISO = () => new Date().toISOString().slice(0, 10);
const sumarDias = (f, n) => (f && n ? new Date(new Date(f + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10) : f);
const diasEntre = (a, b) => (a && b ? Math.max(0, Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000)) : 0);
const sumarMeses = (f, n) => { if (!f) return null; const d = new Date(f + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
// Plazos de liquidación (Ley 1150 de 2007, art. 11) contados desde la terminación vigente
const plazosLiquidacion = fin => (fin ? { bilateral: sumarMeses(fin, 4), unilateral: sumarMeses(fin, 6), judicial: sumarMeses(fin, 30) } : null);

async function resumen(proyectoId) {
  const p = await db.get('SELECT * FROM proyecto WHERE id = ?', proyectoId);
  const contratos = [];
  for (const c of await db.all('SELECT * FROM contrato WHERE proyecto_id = ? ORDER BY tipo', proyectoId)) {
    const pr = await presupuesto(c.id);
    const actas = [];
    for (const a of await db.all('SELECT * FROM acta WHERE contrato_id = ? ORDER BY numero', c.id)) {
      const d = await detalleActa(a.id);
      actas.push({ ...a, valor: d.totales.acta.total, acumulado: d.totales.acumulado.total });
    }
    const ejecutado = actas.length ? actas[actas.length - 1].acumulado : 0;
    const gastado = (await db.get('SELECT COALESCE(SUM(valor), 0) v FROM gasto WHERE contrato_id = ?', c.id)).v;
    // Valor y plazo vigentes = originales + otrosíes firmados
    const otrosis = await db.all('SELECT * FROM otrosi WHERE contrato_id = ? ORDER BY numero, id', c.id);
    const firmados = otrosis.filter(o => o.estado === 'Firmado');
    const adiciones = r2(firmados.reduce((s, o) => s + (o.valor || 0), 0)), prorroga = firmados.reduce((s, o) => s + (o.dias || 0), 0);
    // Suspensiones: los días suspendidos (hasta hoy si sigue suspendido) corren la terminación
    const suspensiones = await db.all('SELECT * FROM suspension WHERE contrato_id = ? ORDER BY numero, id', c.id);
    const diasSusp = suspensiones.reduce((s, x) => s + diasEntre(x.fecha_suspension, x.estado === 'Reiniciado' && x.fecha_reinicio ? x.fecha_reinicio : hoyISO()), 0);
    const finVigente = sumarDias(c.fecha_fin, prorroga + diasSusp);
    const liquidacion = (await db.get('SELECT * FROM liquidacion WHERE contrato_id = ?', c.id)) || null;
    contratos.push({ ...c, otrosis, suspensiones, dias_suspendidos: diasSusp, suspendido: suspensiones.some(x => x.estado === 'Suspendido'), liquidacion, plazos_liquidacion: plazosLiquidacion(finVigente), adiciones, prorroga_dias: prorroga, valor_vigente: r2((c.valor || 0) + adiciones), fecha_fin_vigente: finVigente, presupuesto: pr.totales.total, costo_directo: pr.totales.costo_directo, items: pr.items.filter(i => i.tipo === 1).length, actas, ejecutado, gastado });
  }
  const vencimientos = await db.all(`SELECT * FROM vencimiento WHERE proyecto_id = ? AND estado <> 'Cumplido' ORDER BY fecha IS NULL, fecha`, proyectoId);
  const conteos = {};
  for (const t of ['personal', 'poliza', 'correspondencia', 'bitacora', 'ensayo']) conteos[t] = (await db.get(`SELECT COUNT(*) n FROM ${t} WHERE proyecto_id = ?`, proyectoId)).n;
  const rq_pendientes = (await db.get("SELECT COUNT(*) n FROM requisicion WHERE proyecto_id = ? AND estado = 'Solicitada'", proyectoId)).n;
  return { rq_pendientes, proyecto: p, hoy: new Date().toISOString().slice(0, 10), contratos, vencimientos, conteos, sincronizacion: db.estado };
}

// Búsqueda en la memoria-grafo del proyecto (memoria_grafo.json)
async function memoria(proyectoId, buscar) {
  const p = await db.get('SELECT memoria FROM proyecto WHERE id = ?', proyectoId);
  if (!p || !p.memoria || !fs.existsSync(p.memoria)) return { error: 'El proyecto no tiene memoria-grafo en este equipo' };
  const g = JSON.parse(fs.readFileSync(p.memoria, 'utf8'));
  const nodos = Object.fromEntries(g.nodos.map(n => [n.id, n]));
  const nom = id => (id && nodos[id] ? nodos[id].nombre : id || '');
  const b = (buscar || '').toLowerCase();
  const hechos = g.hechos.filter(h => !h.invalidado).map(h => ({
    id: h.id, de: nom(h.de), relacion: h.relacion, a: nom(h.a), valor: h.valor, nota: h.nota,
    desde: h.desde, hasta: h.hasta, fuente: nom(h.fuente), ruta: nodos[h.fuente]?.datos?.ruta || '',
  })).filter(h => !b || JSON.stringify(h).toLowerCase().includes(b));
  return { actualizado: g.actualizado, total: g.hechos.length, hechos };
}

// Búsqueda global (Ctrl+K): ítems, actas y registros del proyecto
async function buscar(proyectoId, texto) {
  const t = (texto || '').trim();
  if (t.length < 2) return [];
  const like = '%' + t + '%', out = [];
  const contratos = await db.all('SELECT id, tipo FROM contrato WHERE proyecto_id = ?', proyectoId);
  for (const c of contratos) {
    const nombre = c.tipo === 'obra' ? 'Presupuesto de obra' : 'Presupuesto de interventoría';
    for (const it of await db.all('SELECT id, codigo, descripcion FROM item WHERE contrato_id = ? AND (codigo LIKE ? OR descripcion LIKE ?) ORDER BY orden LIMIT 15', c.id, like, like))
      out.push({ grupo: nombre, titulo: [it.codigo, it.descripcion].filter(Boolean).join(' · '), abrir: 'presupuesto:' + c.id });
    for (const o of await db.all('SELECT numero, tipo, objeto FROM otrosi WHERE contrato_id = ? AND (objeto LIKE ? OR tipo LIKE ?)', c.id, like, like))
      out.push({ grupo: 'Otrosíes', titulo: `Otrosí ${o.numero} · ${o.tipo}${o.objeto ? ' · ' + o.objeto : ''}`, abrir: 'otrosis:' + c.id });
    for (const a of await db.all('SELECT id, numero, estado, observaciones FROM acta WHERE contrato_id = ? AND (CAST(numero AS TEXT) = ? OR estado LIKE ? OR observaciones LIKE ?) ORDER BY numero', c.id, t.replace(/\D/g, ''), like, like))
      out.push({ grupo: c.tipo === 'obra' ? 'Actas parciales' : 'Cuentas de cobro', titulo: `${c.tipo === 'obra' ? 'Acta' : 'Cuenta'} ${a.numero} · ${a.estado}`, abrir: 'acta:' + a.id });
  }
  const TEXTO = { vencimiento: ['descripcion', 'tipo', 'responsable'], correspondencia: ['asunto', 'radicado', 'de', 'para'], personal: ['nombre', 'cargo'],
    poliza: ['amparo', 'aseguradora', 'numero'], bitacora: ['actividades', 'frente', 'observaciones'], ensayo: ['ensayo', 'item', 'abscisa', 'resultado'],
    sst: ['tipo', 'descripcion', 'hallazgo', 'frente'], ambiental: ['programa', 'ficha', 'actividad', 'hallazgo', 'permiso'], social: ['tipo', 'ficha', 'comunidad', 'descripcion'], pmt: ['frente', 'radicado', 'dispositivos'], pqrs: ['radicado', 'tipo', 'descripcion', 'frente'], reunion: ['tipo', 'lugar', 'comunidad', 'temas'], acta_vecindad: ['predio', 'direccion', 'abscisa'], afectacion: ['tipo', 'descripcion', 'empresa'], tarea: ['nombre', 'wbs'] };
  const NOMBRE = { vencimiento: 'Vencimientos', correspondencia: 'Correspondencia', personal: 'Personal', poliza: 'Pólizas', bitacora: 'Bitácora', ensayo: 'Ensayos', sst: 'SST', ambiental: 'Ambiental', social: 'Social', pmt: 'PMT', pqrs: 'PQRS', reunion: 'Reuniones', acta_vecindad: 'Actas de vecindad', afectacion: 'Afectaciones', tarea: 'Programa de obra' };
  for (const [tabla, cols] of Object.entries(TEXTO)) {
    const filas = await db.all(`SELECT * FROM ${tabla} WHERE proyecto_id = ? AND (${cols.map(k => k + ' LIKE ?').join(' OR ')}) LIMIT 10`, proyectoId, ...cols.map(() => like));
    for (const f of filas) out.push({ grupo: NOMBRE[tabla], titulo: cols.map(k => f[k]).filter(Boolean).join(' · ') + (f.fecha ? ' · ' + f.fecha : ''), abrir: tabla === 'tarea' ? 'programa' : 'tabla:' + tabla });
  }
  return out.slice(0, 60);
}

// Campana: vencimientos, pólizas y respuestas pendientes de los próximos 7 días (y los ya vencidos)
async function avisos(proyectoId) {
  const hoy = new Date(), iso = d => d.toISOString().slice(0, 10);
  const limite = iso(new Date(hoy.getTime() + 7 * 86400000));
  const out = [];
  for (const v of await db.all(`SELECT * FROM vencimiento WHERE proyecto_id = ? AND estado <> 'Cumplido' AND fecha IS NOT NULL AND fecha <= ? ORDER BY fecha`, proyectoId, limite))
    out.push({ fecha: v.fecha, tipo: v.tipo || 'Vencimiento', texto: v.descripcion, abrir: 'tabla:vencimiento' });
  for (const p of await db.all(`SELECT * FROM poliza WHERE proyecto_id = ? AND COALESCE(estado, '') NOT IN ('Vencida', 'Cerrada') AND hasta IS NOT NULL AND hasta <= ? AND hasta >= ? ORDER BY hasta`, proyectoId, limite, iso(hoy)))
    out.push({ fecha: p.hasta, tipo: 'Póliza', texto: `${p.amparo || ''} ${p.numero || ''} (${p.contrato || ''}) vence`, abrir: 'tabla:poliza' });
  for (const c of await db.all(`SELECT * FROM correspondencia WHERE proyecto_id = ? AND requiere_respuesta = 'Sí' AND COALESCE(estado, '') NOT IN ('Cerrada', 'Respondida') AND plazo IS NOT NULL AND plazo <= ? ORDER BY plazo`, proyectoId, limite))
    out.push({ fecha: c.plazo, tipo: 'Respuesta', texto: `${c.radicado || ''} ${c.asunto || ''}`.trim(), abrir: 'tabla:correspondencia' });
  for (const [tabla, nombre, campo] of [['sst', 'SST', 'descripcion'], ['ambiental', 'Ambiental', 'actividad'], ['social', 'Social', 'descripcion']])
    for (const r of await db.all(`SELECT * FROM ${tabla} WHERE proyecto_id = ? AND COALESCE(estado, '') <> 'Cerrado' AND plazo IS NOT NULL AND plazo <= ? ORDER BY plazo`, proyectoId, limite))
      out.push({ fecha: r.plazo, tipo: nombre, texto: [r.tipo || r.componente, r.accion || r[campo]].filter(Boolean).join(': '), abrir: 'tabla:' + tabla });
  for (const r of await db.all(`SELECT * FROM pqrs WHERE proyecto_id = ? AND COALESCE(estado, '') NOT IN ('Respondida', 'Cerrada') AND plazo IS NOT NULL AND plazo <= ? ORDER BY plazo`, proyectoId, limite))
    out.push({ fecha: r.plazo, tipo: 'PQRS', texto: `${r.plazo < iso(hoy) ? 'Vencida' : 'Por vencer'}: ${r.tipo || 'PQRS'} ${r.radicado || ''} ${r.descripcion || ''}`.replace(/\s+/g, ' ').trim(), abrir: 'tabla:pqrs' });
  for (const a of await db.all(`SELECT * FROM acta_vecindad WHERE proyecto_id = ? AND estado = 'Cierre pendiente'`, proyectoId))
    out.push({ fecha: a.fecha_inicio || iso(hoy), tipo: 'Social', texto: `Levantar el acta de vecindad de cierre del predio ${a.predio || a.direccion || ''}`.trim(), abrir: 'tabla:acta_vecindad' });
  for (const m of await db.all(`SELECT * FROM pmt WHERE proyecto_id = ? AND estado <> 'Cerrado' AND hasta IS NOT NULL AND hasta <= ? ORDER BY hasta`, proyectoId, limite))
    out.push({ fecha: m.hasta, tipo: 'PMT', texto: `Vence la aprobación del PMT ${m.frente || ''} ${m.abs_ini ? '(' + m.abs_ini + ' a ' + (m.abs_fin || '') + ')' : ''}`.trim(), abrir: 'tabla:pmt' });
  // Permisos ambientales: aviso con 30 días porque su renovación se tramita ante la autoridad ambiental
  const mes30 = iso(new Date(hoy.getTime() + 30 * 86400000));
  for (const p of await db.all(`SELECT * FROM amb_permiso WHERE proyecto_id = ? AND COALESCE(estado, '') NOT IN ('Cerrado', 'Negado') AND vence IS NOT NULL AND vence <= ? ORDER BY vence`, proyectoId, mes30))
    out.push({ fecha: p.vence, tipo: 'Permiso ambiental', texto: `${p.vence < iso(hoy) ? 'Vencido' : 'Vence'}: ${p.tipo || 'permiso'} ${p.acto || ''} (${p.autoridad || ''})`.trim(), abrir: 'tabla:amb_permiso' });
  for (const m of await db.all('SELECT * FROM maquinaria WHERE proyecto_id = ? AND vence_emisiones IS NOT NULL AND vence_emisiones <= ? ORDER BY vence_emisiones', proyectoId, limite))
    out.push({ fecha: m.vence_emisiones, tipo: 'Emisiones', texto: `Certificado de emisiones de ${m.equipo || ''} ${m.placa || ''}`.trim(), abrir: 'tabla:maquinaria' });
  for (const c of await db.all(`SELECT * FROM amb_chequeo WHERE proyecto_id = ? AND cumple = 'No' AND COALESCE(estado, '') <> 'Cerrado' AND plazo IS NOT NULL AND plazo <= ? ORDER BY plazo`, proyectoId, limite))
    out.push({ fecha: c.plazo, tipo: 'Ambiental', texto: `${c.aspecto || ''}: ${c.accion || c.observacion || ''}`, abrir: 'tabla:amb_chequeo' });
  for (const o of await db.all(`SELECT o.*, c.tipo ct FROM otrosi o JOIN contrato c ON c.id = o.contrato_id WHERE c.proyecto_id = ? AND o.estado = 'Firmado' AND o.polizas_ajustadas <> 'Sí'`, proyectoId))
    out.push({ fecha: o.fecha || iso(hoy), tipo: 'Pólizas', texto: `Ajustar las pólizas por el otrosí ${o.numero} (${o.ct === 'obra' ? 'obra' : 'interventoría'})`, abrir: 'otrosis:' + o.contrato_id });
  for (const r of await db.all(`SELECT * FROM requisicion WHERE proyecto_id = ? AND estado IN ('Solicitada', 'Aprobada') ORDER BY fecha`, proyectoId))
    out.push({ fecha: r.fecha || iso(hoy), tipo: 'RQ', texto: r.estado === 'Solicitada' ? `RQ ${r.numero} pendiente de aprobar (${r.solicitante || ''})` : `RQ ${r.numero} aprobada, pendiente de atender`, abrir: 'requisiciones' });
  for (const c of (await resumen(proyectoId)).contratos) {
    const nombre = c.tipo === 'obra' ? 'obra' : 'interventoría';
    for (const x of c.suspensiones) {
      if (x.estado === 'Suspendido' && diasEntre(x.fecha_suspension, iso(hoy)) > 30)
        out.push({ fecha: x.fecha_suspension, tipo: 'Suspensión', texto: `Contrato de ${nombre} suspendido hace ${diasEntre(x.fecha_suspension, iso(hoy))} días (suspensión ${x.numero})`, abrir: 'suspensiones:' + c.id });
      if (x.estado === 'Reiniciado' && x.polizas_ajustadas !== 'Sí')
        out.push({ fecha: x.fecha_reinicio || iso(hoy), tipo: 'Pólizas', texto: `Ajustar las pólizas por el reinicio de la suspensión ${x.numero} (${nombre})`, abrir: 'suspensiones:' + c.id });
    }
    const pl = c.plazos_liquidacion, liq = c.liquidacion;
    if (!pl || (liq && ['Firmada', 'Cerrada'].includes(liq.estado))) continue;
    const alerta = iso(new Date(hoy.getTime() + 30 * 86400000));
    for (const [k, txt] of [['bilateral', 'liquidación bilateral'], ['unilateral', 'liquidación unilateral'], ['judicial', 'liquidación judicial (caducidad)']])
      if (pl[k] >= iso(hoy) && pl[k] <= alerta) out.push({ fecha: pl[k], tipo: 'Liquidación', texto: `Vence el plazo de ${txt} del contrato de ${nombre}`, abrir: 'liquidacion:' + c.id });
  }
  out.push(...await avisosSST(proyectoId, iso(hoy), limite));
  // Correos de Gmail: importados en el último día y vencimientos sugeridos por la IA sin confirmar
  const nuevos = (await db.get(`SELECT COUNT(*) n FROM correspondencia WHERE proyecto_id = ? AND origen = 'Gmail' AND estado = 'Abierta' AND fecha >= ?`, proyectoId, iso(new Date(hoy.getTime() - 86400000)))).n;
  if (nuevos) out.push({ fecha: iso(hoy), tipo: 'Gmail', texto: `${nuevos} ${nuevos === 1 ? 'correo nuevo' : 'correos nuevos'}`, abrir: 'tabla:correspondencia' });
  for (const c of await db.all(`SELECT id, asunto, fecha FROM correspondencia WHERE proyecto_id = ? AND vencimientos_ia IS NOT NULL`, proyectoId))
    out.push({ fecha: c.fecha || iso(hoy), tipo: 'Sugerencia IA', texto: `Vencimientos sugeridos: ${c.asunto || ''}`, abrir: 'tabla:correspondencia' });
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// Reglas del acta: estado válido, quién lo puede poner y bloqueo después de aprobada
async function validarEstado(u, antes, d) {
  if (d.estado != null && !ESTADOS_ACTA.includes(d.estado)) throw new Rechazo(400, 'Estado desconocido: ' + d.estado);
  if (bloqueada(antes)) {
    // Bloqueada: solo se cambia el estado (avanzar, o el director la reabre)
    if (Object.keys(d).some(k => k !== 'estado') || d.estado == null)
      throw new Rechazo(409, `El acta ${antes.numero} está "${antes.estado}" y no se puede editar`);
    if (ESTADOS_ACTA.indexOf(d.estado) < BLOQUEO && u.rol !== 'director') throw new Rechazo(403, 'Solo el director puede reabrir un acta aprobada');
  }
  if (antes && d.estado != null && ESTADOS_ACTA.indexOf(d.estado) >= BLOQUEO && !bloqueada(antes)) {
    const ch = await chequeo(antes.id);
    if (!ch.completo) throw new Rechazo(409, `Faltan ${ch.faltan} requisitos obligatorios de la lista de chequeo documental para aprobar el acta`);
  }
  if (d.estado != null && d.estado !== antes?.estado && QUIEN_ESTADO[d.estado] && !QUIEN_ESTADO[d.estado].includes(u.rol))
    throw new Rechazo(403, `El rol ${u.rol} no puede pasar el acta a "${d.estado}"`);
}

// ---------- Asistente (Gemini por defecto, Ollama local o Claude) ----------
// La configuración y las claves se guardan en datos/asistente.json (solo en este equipo).
// Claude también toma la clave de ANTHROPIC_API_KEY.
const ARCH_ASISTENTE = path.join(DATOS, 'asistente.json');
const PROVEEDORES = ['gemini', 'ollama', 'claude'];
const configAsistente = () => { const c = fs.existsSync(ARCH_ASISTENTE) ? JSON.parse(fs.readFileSync(ARCH_ASISTENTE, 'utf8')) : {}; return { proveedor: 'gemini', ...c, clave: c.clave || process.env.ANTHROPIC_API_KEY || null }; };
const asistenteListo = c => (c.proveedor === 'gemini' ? !!c.clave_gemini : c.proveedor === 'ollama' ? true : !!c.clave);
const NOMBRE_PROVEEDOR = { claude: 'Claude', gemini: 'Gemini', ollama: 'Ollama (local)' };
const MAX_VUELTAS = 8;

// Herramientas del asistente. Las de lectura se ejecutan solas; las de escritura esperan la confirmación del usuario.
const obj = (props, req = []) => ({ type: 'object', properties: props, required: req, additionalProperties: false });
const txt = d => ({ type: 'string', description: d });
const HERRAMIENTAS = [
  { name: 'consultar_tabla', description: 'Lee registros de una tabla del proyecto actual. Filtros por igualdad exacta; si el valor tiene % se usa LIKE. Devuelve como máximo "limite" filas (50 por defecto).',
    input_schema: obj({ tabla: { type: 'string', enum: ['contrato', 'item', 'acta', 'otrosi', 'suspension', 'liquidacion', 'gasto', 'vencimiento', 'personal', 'poliza', 'correspondencia', 'bitacora', 'ensayo',
      'tarea', 'tramo', 'sst', 'sst_mes', ...SST_ANEXOS, 'ambiental', 'pmt', ...AMB, 'social', 'pqrs', 'reunion', 'acta_vecindad', 'mano_obra', 'capacitacion', 'afectacion', 'encuesta', 'veeduria', 'adjunto'] },
      filtros: { type: 'object', description: 'Columna → valor, p. ej. {"estado":"Pendiente"}', additionalProperties: { type: ['string', 'number'] } },
      limite: { type: 'integer', minimum: 1, maximum: 200 } }, ['tabla']) },
  { name: 'detalle_acta', description: 'Detalle de un acta parcial o cuenta de cobro: por ítem con movimiento, cantidad contratada, anterior, presentada, aprobada, acumulada, saldo y valores; y los totales.',
    input_schema: obj({ acta_id: { type: 'integer', description: 'id del acta (no el número)' } }, ['acta_id']) },
  { name: 'presupuesto', description: 'Presupuesto de un contrato del proyecto: capítulos, ítems con cantidad y valor unitario, y totales (AIU, IVA).',
    input_schema: obj({ contrato: { type: 'string', enum: ['obra', 'interventoria'] } }, ['contrato']) },
  { name: 'costos_interventoria', description: 'Control de costos del contrato de interventoría: presupuestado, gastado, facturado y margen por ítem.', input_schema: obj({}) },
  { name: 'programa_obra', description: 'Avance físico del programa de obra (importado de Project) a una fecha: programado, ejecutado, SPI y cada actividad.', input_schema: obj({ fecha: txt('AAAA-MM-DD; hoy si se omite') }) },
  { name: 'indicadores_sst', description: 'Indicadores mensuales de SST (Res. 0312 de 2019): frecuencia y severidad de accidentalidad, mortalidad, ausentismo y verificación de PILA/ARL.', input_schema: obj({}) },
  { name: 'avisos', description: 'Vencimientos, pólizas, respuestas pendientes y ajustes de pólizas de los próximos 7 días (y los vencidos).', input_schema: obj({}) },
  { name: 'buscar', description: 'Búsqueda de texto en ítems, otrosíes, actas, vencimientos, correspondencia, personal, pólizas, bitácora y ensayos.',
    input_schema: obj({ texto: { type: 'string', minLength: 2 } }, ['texto']) },
  { name: 'crear_vencimiento', description: 'ESCRITURA: crea un vencimiento o pendiente del proyecto. El usuario debe confirmarlo en la pantalla.',
    input_schema: obj({ fecha: txt('AAAA-MM-DD'), descripcion: txt('Qué vence'), tipo: txt('Tipo, p. ej. Informe, Póliza, Respuesta'), responsable: txt('Responsable') }, ['fecha', 'descripcion']) },
  { name: 'registrar_bitacora', description: 'ESCRITURA: registra una anotación diaria en la bitácora de obra. El usuario debe confirmarlo.',
    input_schema: obj({ fecha: txt('AAAA-MM-DD'), actividades: txt('Actividades del día'), frente: txt('Frente o tramo'), clima: txt('Clima'), observaciones: txt('Observaciones') }, ['fecha', 'actividades']) },
  { name: 'registrar_correspondencia', description: 'ESCRITURA: registra un oficio, PQRS o comunicación en la correspondencia. El usuario debe confirmarlo.',
    input_schema: obj({ fecha: txt('AAAA-MM-DD'), sentido: { type: 'string', enum: ['Recibida', 'Enviada'] }, asunto: txt('Asunto'), de: txt('Remitente'), para: txt('Destinatario'),
      radicado: txt('Número de radicado'), requiere_respuesta: { type: 'string', enum: ['Sí', 'No'] }, plazo: txt('Plazo de respuesta AAAA-MM-DD') }, ['fecha', 'sentido', 'asunto']) },
];
const ESCRITURA = { crear_vencimiento: 'vencimiento', registrar_bitacora: 'bitacora', registrar_correspondencia: 'correspondencia' };

// Valida los argumentos contra el esquema (tipos, enumerados y obligatorios)
function validarArgs(h, a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) throw new Rechazo(400, 'Argumentos inválidos');
  const s = h.input_schema;
  for (const k of s.required) if (a[k] == null || a[k] === '') throw new Rechazo(400, 'Falta ' + k);
  for (const [k, v] of Object.entries(a)) {
    const p = s.properties[k];
    if (!p) throw new Rechazo(400, 'Argumento desconocido: ' + k);
    if (p.enum && !p.enum.includes(v)) throw new Rechazo(400, `${k} debe ser uno de: ${p.enum.join(', ')}`);
    if (p.type === 'string' && typeof v !== 'string') throw new Rechazo(400, k + ' debe ser texto');
    if (p.type === 'integer' && !Number.isInteger(v)) throw new Rechazo(400, k + ' debe ser entero');
    if (p.type === 'object' && (typeof v !== 'object' || v === null || Array.isArray(v))) throw new Rechazo(400, k + ' debe ser un objeto');
  }
  for (const k of ['fecha', 'plazo']) if (a[k] != null && !/^\d{4}-\d{2}-\d{2}$/.test(a[k])) throw new Rechazo(400, k + ' debe tener el formato AAAA-MM-DD');
}

async function contratoDe(pid, tipo) {
  const c = await db.get('SELECT id FROM contrato WHERE proyecto_id = ? AND tipo = ?', pid, tipo);
  if (!c) throw new Rechazo(404, 'El proyecto no tiene contrato de ' + tipo);
  return c.id;
}
async function consultarTabla(pid, { tabla, filtros = {}, limite = 50 }) {
  const donde = [TABLAS[tabla] === 'proyecto_id' ? 'proyecto_id = ?' : 'contrato_id IN (SELECT id FROM contrato WHERE proyecto_id = ?)'], vals = [pid];
  if (tabla === 'contrato') donde[0] = 'proyecto_id = ?';
  for (const [k, v] of Object.entries(filtros)) {
    if (!columnas[tabla].includes(k)) throw new Rechazo(400, `La tabla ${tabla} no tiene la columna ${k}. Columnas: ${columnas[tabla].join(', ')}`);
    if (typeof v !== 'string' && typeof v !== 'number') throw new Rechazo(400, 'Filtro inválido en ' + k);
    donde.push(typeof v === 'string' && v.includes('%') ? `${k} LIKE ?` : `${k} = ?`); vals.push(v);
  }
  const filas = await db.all(`SELECT * FROM ${tabla} WHERE ${donde.join(' AND ')} ORDER BY id LIMIT ?`, ...vals, Math.min(Number(limite) || 50, 200));
  return { tabla, columnas: columnas[tabla], filas };
}
const LECTURA = {
  consultar_tabla: consultarTabla,
  programa_obra: (pid, { fecha }) => avanceFisico(pid, /^\d{4}-\d{2}-\d{2}$/.test(fecha || '') ? fecha : new Date().toISOString().slice(0, 10)),
  indicadores_sst: async pid => indicadoresSST(await db.all('SELECT * FROM sst_mes WHERE proyecto_id = ? ORDER BY mes', pid)),
  detalle_acta: async (pid, { acta_id }) => {
    const ok = await db.get('SELECT a.id FROM acta a JOIN contrato c ON c.id = a.contrato_id WHERE a.id = ? AND c.proyecto_id = ?', acta_id, pid);
    if (!ok) throw new Rechazo(404, 'No existe esa acta en este proyecto');
    const d = await detalleActa(acta_id);
    return { ...d, filas: d.filas.filter(f => f.tipo !== 1 || f.cant_presentada || f.cant_aprobada || f.acumulado)
      .map(f => f.tipo !== 1 ? { capitulo: f.descripcion } : { codigo: f.codigo, descripcion: f.descripcion, unidad: f.unidad, contratada: f.cantidad, vr_unitario: f.vr_unitario, anterior: f.anterior,
        presentada: f.cant_presentada, aprobada: f.cant_aprobada, acumulada: f.acumulado, saldo: f.saldo, vr_acta: f.vr_acta, pct: r2(f.pct * 100), observacion: f.observacion || undefined }) };
  },
  presupuesto: async (pid, { contrato }) => {
    const p = await presupuesto(await contratoDe(pid, contrato));
    return { totales: p.totales, items: p.items.map(i => i.tipo !== 1 ? { capitulo: i.descripcion } : { id: i.id, codigo: i.codigo, descripcion: i.descripcion, unidad: i.unidad, cantidad: i.cantidad, vr_unitario: i.vr_unitario }) };
  },
  costos_interventoria: async pid => {
    const c = await costos(await contratoDe(pid, 'interventoria'));
    return { totales: c.totales, sin_item: c.sin_item, filas: c.filas.filter(f => f.tipo === 1).map(({ codigo, descripcion, presupuestado, gastado, facturado, margen }) => ({ codigo, descripcion, presupuestado, gastado, facturado, margen })) };
  },
  avisos: pid => avisos(pid),
  buscar: (pid, { texto }) => buscar(pid, texto),
};

// Ejecuta una herramienta de lectura; el error vuelve como texto para que Claude lo corrija
async function leer(pid, nombre, args) {
  try {
    const h = HERRAMIENTAS.find(x => x.name === nombre);
    if (!h || !LECTURA[nombre]) throw new Rechazo(400, 'Herramienta desconocida: ' + nombre);
    validarArgs(h, args);
    const s = JSON.stringify(await LECTURA[nombre](pid, args));
    return { content: s.length > 30000 ? s.slice(0, 30000) + '… (resultado recortado: use filtros)' : s };
  } catch (e) { return { content: 'Error: ' + e.message, is_error: true }; }
}
async function escribir(pid, u, nombre, args) {
  const tabla = ESCRITURA[nombre];
  exigir(u, tabla);
  const d = { proyecto_id: pid, ...args };
  const k = Object.keys(d);
  const r = await db.run(`INSERT INTO ${tabla} (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, ...Object.values(d));
  await auditar(u, tabla, r.id, 'crear (asistente)', d);
  return { id: r.id, tabla };
}
const describir = (n, a) => ({ crear_vencimiento: `Crear vencimiento del ${a.fecha}: ${a.descripcion}`, registrar_bitacora: `Registrar en la bitácora del ${a.fecha}: ${a.actividades}`,
  registrar_correspondencia: `Registrar correspondencia ${String(a.sentido).toLowerCase()} del ${a.fecha}: ${a.asunto}` }[n]);

// Conversaciones detenidas esperando la confirmación de una escritura (se olvidan después de una hora)
const PENDIENTES = new Map();

function errorAmable(e, Anthropic) {
  if (e instanceof Rechazo) return e.message;
  if (e instanceof Anthropic.AuthenticationError) return 'La clave de la API de Claude no es válida';
  if (e instanceof Anthropic.RateLimitError) return 'El asistente está ocupado: intente en un minuto';
  if (e instanceof Anthropic.APIConnectionError) return 'Sin conexión con el servicio de Claude. Revise el internet.';
  return e.message;
}

async function sistemaAsistente(pid, u) {
  const r = await resumen(pid);
  const datos = { proyecto: r.proyecto, hoy: r.hoy, vencimientos: r.vencimientos,
    contratos: r.contratos.map(c => ({ id: c.id, tipo: c.tipo, numero: c.numero, contratista: c.contratista, valor: c.valor, valor_vigente: c.valor_vigente, fecha_fin_vigente: c.fecha_fin_vigente,
      presupuesto: c.presupuesto, ejecutado: c.ejecutado, gastado: c.gastado,
      actas: c.actas.map(a => ({ id: a.id, numero: a.numero, estado: a.estado, desde: a.desde, hasta: a.hasta, valor: a.valor, acumulado: a.acumulado })) })) };
  return `Eres el asistente de SIGI Pro, un sistema de gestión de interventoría de obras viales en Colombia.
Respondes en español, con precisión y de forma breve, como un ingeniero de interventoría con experiencia en contratación estatal (Ley 80, Ley 1474, Ley 1150).
Usa los datos del proyecto que se dan abajo y consulta con las herramientas lo que falte; si algo no está en los datos, dilo. Valores en pesos colombianos.
Formato: markdown sencillo (**negrita**, listas con "-", tablas con "|").
Usa las herramientas de ESCRITURA solo cuando el usuario pida registrar algo; la aplicación le pedirá confirmación antes de guardarlo. No inventes datos para completarlas: pregunta lo que falte.
Usuario actual: ${u ? `${u.nombre} (${u.rol})` : 'sin identificar'}.

DATOS DEL PROYECTO (JSON):
${JSON.stringify(datos)}`;
}

// Bucle de herramientas con respuesta en tiempo real. ev(evento, datos) envía cada evento al navegador.
async function asistente(pid, b, u, ev) {
  const cfg = configAsistente();
  if (cfg.proveedor === 'claude' && !cfg.clave) throw new Rechazo(400, 'Falta la clave de la API de Claude. El director la configura en Inicio → Asistente → Clave del asistente.');
  const Anthropic = require('@anthropic-ai/sdk');
  const cliente = cfg.proveedor === 'claude' ? new Anthropic({ apiKey: cfg.clave }) : null;
  // Una vuelta del modelo: devuelve { content, stop_reason } en el formato de Claude
  const turno = async (sistema, mensajes) => {
    if (cfg.proveedor === 'gemini') return prov.turnoGemini(cfg, sistema, mensajes, HERRAMIENTAS, t => ev('texto', { t }));
    if (cfg.proveedor === 'ollama') return prov.turnoOllama(cfg, sistema, mensajes, HERRAMIENTAS, t => ev('texto', { t }));
    const flujo = cliente.beta.messages.stream({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', cache_control: { type: 'ephemeral' }, text: sistema }],
      tools: HERRAMIENTAS,
      messages: mensajes,
    });
    flujo.on('text', t => ev('texto', { t }));
    return flujo.finalMessage();
  };
  let mensajes;
  if (b.continuar) {
    const p = PENDIENTES.get(b.continuar);
    if (!p || p.pid !== pid || p.uid !== (u?.id ?? null)) throw new Rechazo(404, 'La acción ya no está pendiente');
    PENDIENTES.delete(b.continuar);
    mensajes = p.mensajes;
    const resultados = [...p.resultados];
    for (const t of p.escrituras) {
      if (!b.aprobar) { resultados.push({ type: 'tool_result', tool_use_id: t.id, content: 'El usuario canceló esta acción; no se guardó nada.', is_error: true }); continue; }
      try { const r = await escribir(pid, u, t.name, t.input); resultados.push({ type: 'tool_result', tool_use_id: t.id, content: JSON.stringify({ guardado: true, ...r }) }); ev('guardado', { tabla: r.tabla }); }
      catch (e) { resultados.push({ type: 'tool_result', tool_use_id: t.id, content: 'Error: ' + e.message, is_error: true }); }
    }
    mensajes.push({ role: 'user', content: resultados });
  } else {
    mensajes = (b.mensajes || []).slice(-20).filter(m => String(m.content || '').trim()).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) }));
    while (mensajes.length && mensajes[0].role !== 'user') mensajes.shift();
    if (!mensajes.length) throw new Rechazo(400, 'Escriba una pregunta');
    const ult = mensajes[mensajes.length - 1];
    if (b.vista) ult.content = `[Vista abierta en la aplicación: ${String(b.titulo || '').slice(0, 120)} (${String(b.vista).slice(0, 60)})]\n${ult.content}`;
  }
  const sistema = await sistemaAsistente(pid, u);
  try {
    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      const resp = await turno(sistema, mensajes);
      if (resp.stop_reason === 'refusal') return ev('texto', { t: '\n\nEl asistente no puede responder esa consulta. Intente formularla de otra manera.' });
      mensajes.push({ role: 'assistant', content: resp.content });
      if (resp.stop_reason === 'pause_turn') continue;
      if (resp.stop_reason !== 'tool_use') return;
      const resultados = [], escrituras = [];
      for (const t of resp.content.filter(x => x.type === 'tool_use')) {
        if (!ESCRITURA[t.name]) { ev('herramienta', { nombre: t.name }); resultados.push({ type: 'tool_result', tool_use_id: t.id, ...(await leer(pid, t.name, t.input)) }); continue; }
        try { validarArgs(HERRAMIENTAS.find(x => x.name === t.name), t.input); exigir(u, ESCRITURA[t.name]); escrituras.push(t); }
        catch (e) { resultados.push({ type: 'tool_result', tool_use_id: t.id, content: 'Error: ' + e.message, is_error: true }); }
      }
      if (escrituras.length) {
        for (const [k, p] of PENDIENTES) if (Date.now() - p.creado > 3600000) PENDIENTES.delete(k);
        const id = require('node:crypto').randomUUID();
        PENDIENTES.set(id, { pid, uid: u?.id ?? null, mensajes, resultados, escrituras, creado: Date.now() });
        return ev('confirmar', { id, acciones: escrituras.map(t => describir(t.name, t.input)) });
      }
      mensajes.push({ role: 'user', content: resultados });
      ev('texto', { t: '\n\n' });
    }
    ev('texto', { t: '\n\n(Se alcanzó el límite de consultas para esta pregunta: pídame que continúe si hace falta.)' });
  } catch (e) {
    if (e instanceof prov.ErrorProveedor) throw new Rechazo(e.codigo, e.message);
    throw new Rechazo(e instanceof Anthropic.AuthenticationError ? 400 : e.status || 500, errorAmable(e, Anthropic));
  }
}

// ---------- Lectura de documentos con IA ----------
// Convierte el archivo en partes para Gemini: PDF e imágenes van tal cual; Excel, CSV, Word y texto, como texto
async function partesDocumento(b) {
  const mime = b.tipo_mime || '', nombre = String(b.nombre || ''), buf = Buffer.from(String(b.datos || ''), 'base64');
  if (!buf.length) throw new Rechazo(400, 'El archivo está vacío');
  if (/^application\/pdf$|^image\/(jpeg|png|webp)$/.test(mime)) return [{ inlineData: { mimeType: mime, data: buf.toString('base64') } }];
  let texto;
  if (/\.xlsx$/i.test(nombre) || /spreadsheetml/.test(mime)) {
    const ExcelJS = require('exceljs'), libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buf);
    const val = v => (v == null ? '' : typeof v === 'object' ? (v.result ?? v.text ?? (v.richText ? v.richText.map(t => t.text).join('') : v instanceof Date ? v.toISOString().slice(0, 10) : '')) : v);
    texto = libro.worksheets.map(h => `### Hoja "${h.name}"\n` + h.getSheetValues().slice(1, 1500).filter(Boolean).map(f => f.slice(1).map(val).join(' | ')).join('\n')).join('\n\n');
  } else if (/\.docx$/i.test(nombre) || /wordprocessingml/.test(mime)) {
    const xml = new (require('pizzip'))(buf).file('word/document.xml').asText();
    texto = xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  } else if (/\.(csv|txt)$/i.test(nombre) || /^text\//.test(mime)) texto = buf.toString('utf8');
  else throw new Rechazo(400, 'Formato no soportado: suba PDF, foto, Word (.docx), Excel (.xlsx), CSV o texto');
  return [{ text: `Contenido del archivo "${nombre}":\n${texto.slice(0, 200000)}` }];
}
const INSTRUCCION_DOCUMENTO = `Eres un ingeniero de interventoría de obras viales en Colombia. Te entregan un documento del proyecto. Identifica qué es ("tipo") y extrae SOLO los datos que aparezcan en él, para registrarlos en el sistema de interventoría:
- poliza: póliza de garantía (cumplimiento, anticipo, salarios, estabilidad, calidad, responsabilidad civil): un elemento por amparo.
- oficio: carta, oficio, comunicación o correo recibido o enviado (radicado, remitente, destinatario, asunto, si requiere respuesta y en cuántos días).
- ensayo: informe o resultados de laboratorio: un elemento por ensayo.
- factura: factura, cuenta de cobro o soporte de gasto.
- otrosi: otrosí, adición, prórroga, modificación o suspensión del contrato.
- reunion: acta de reunión con la comunidad, socialización o comité (inicio, avance o finalización), con asistentes y compromisos.
- pqrs: derecho de petición, queja, reclamo, sugerencia, denuncia o consulta de la comunidad (Ley 1755 de 2015).
- presupuesto: cuadro de cantidades/presupuesto (ítems con código, descripción, unidad, cantidad y valor unitario).
- personal: lista de personal (nombre, cargo, dedicación).
- avance: apuntes, reporte o planilla de obra ejecutada en campo (qué se hizo, dónde y cuánto): un elemento por cada actividad ejecutada en "avances", con el código del ítem del presupuesto de obra que corresponda (de la lista que se te da; si no hay uno claro, déjalo vacío), abscisas como texto tal cual (p. ej. K0+120) y medidas en metros.
- otro: cualquier otro documento.
Además, en "vencimientos" lista toda obligación o fecha límite que el documento imponga (fecha AAAA-MM-DD y qué hay que hacer).
Fechas AAAA-MM-DD. Valores en pesos como número sin puntos. Porcentajes como número. No inventes: deja vacío lo que no esté. En "resumen" explica en 1 o 2 frases qué es el documento y en "observaciones" lo que la interventoría debería revisar.`;
const txtE = { type: 'string' }, numE = { type: 'number' };
const ESQUEMA_DOCUMENTO = { type: 'object', required: ['tipo', 'resumen'], properties: {
  tipo: { type: 'string', enum: ['poliza', 'oficio', 'ensayo', 'factura', 'otrosi', 'reunion', 'pqrs', 'presupuesto', 'personal', 'avance', 'otro'] },
  avances: { type: 'array', items: { type: 'object', properties: { fecha: txtE, codigo_item: txtE, actividad: txtE, frente: txtE, abscisa_inicial: txtE, abscisa_final: txtE, largo: numE, ancho: numE, espesor: numE, piezas: numE, cantidad: numE } } },
  resumen: txtE, observaciones: txtE, contrato: { type: 'string', enum: ['Obra', 'Interventoría'], description: 'a qué contrato corresponde, si se sabe' },
  poliza: { type: 'object', properties: { aseguradora: txtE, numero: txtE, tomador: txtE, asegurado: txtE,
    amparos: { type: 'array', items: { type: 'object', properties: { amparo: txtE, porcentaje: numE, valor: numE, desde: txtE, hasta: txtE } } } } },
  oficio: { type: 'object', properties: { fecha: txtE, sentido: { type: 'string', enum: ['Recibida', 'Enviada'] }, radicado: txtE, de: txtE, para: txtE, asunto: txtE, requiere_respuesta: { type: 'boolean' }, plazo_dias: numE } },
  ensayos: { type: 'array', items: { type: 'object', properties: { fecha: txtE, ensayo: txtE, norma: txtE, item: txtE, abscisa: txtE, resultado: txtE, especificacion: txtE, cumple: { type: 'string', enum: ['Sí', 'No', 'Pendiente'] }, laboratorio: txtE } } },
  factura: { type: 'object', properties: { fecha: txtE, proveedor: txtE, documento: txtE, descripcion: txtE, valor: numE } },
  otrosi: { type: 'object', properties: { fecha: txtE, tipo: { type: 'string', enum: ['Adición', 'Prórroga', 'Adición y prórroga', 'Modificación', 'Suspensión'] }, valor: numE, dias: numE, objeto: txtE } },
  reunion: { type: 'object', properties: { fecha: txtE, tipo: txtE, lugar: txtE, comunidad: txtE, descripcion: txtE, compromisos: txtE, acta: txtE, convocados: numE, asistentes: numE } },
  pqrs: { type: 'object', properties: { fecha: txtE, radicado: txtE, tipo: { type: 'string', enum: ['Petición', 'Queja', 'Reclamo', 'Sugerencia', 'Denuncia', 'Solicitud de documentos', 'Consulta', 'Felicitación'] }, canal: txtE, peticionario: txtE, frente: txtE, descripcion: txtE } },
  items: { type: 'array', items: { type: 'object', properties: { codigo: txtE, descripcion: txtE, unidad: txtE, cantidad: numE, vr_unitario: numE } } },
  personas: { type: 'array', items: { type: 'object', properties: { nombre: txtE, cargo: txtE, dedicacion: numE } } },
  vencimientos: { type: 'array', items: { type: 'object', properties: { fecha: txtE, descripcion: txtE, responsable: txtE } } },
} };
// Convierte lo que leyó la IA en registros propuestos para las tablas del programa
async function propuestasDocumento(pid, d, nombre, u) {
  const contratos = await db.all('SELECT id, tipo FROM contrato WHERE proyecto_id = ?', pid);
  const cid = t => contratos.find(c => c.tipo === t)?.id;
  const contratoDoc = d.contrato === 'Interventoría' ? 'interventoria' : 'obra';
  const hoy = new Date().toISOString().slice(0, 10), out = [];
  const add = (tabla, titulo, datos) => out.push({ tabla, titulo, datos, permitido: puede(u, tabla) });
  if (d.tipo === 'poliza' && d.poliza) for (const a of d.poliza.amparos || [])
    add('poliza', `Póliza ${d.poliza.numero || ''} · ${a.amparo || ''}`, { proyecto_id: pid, contrato: d.contrato || 'Obra', aseguradora: d.poliza.aseguradora, numero: d.poliza.numero, amparo: a.amparo, porcentaje: a.porcentaje, valor: a.valor, desde: a.desde, hasta: a.hasta, estado: a.hasta && a.hasta < hoy ? 'Vencida' : 'Vigente', notas: ['Leída con IA', d.poliza.tomador && 'Tomador: ' + d.poliza.tomador].filter(Boolean).join(' · ') });
  if (d.tipo === 'oficio' && d.oficio) {
    const o = d.oficio, f = o.fecha || hoy;
    add('correspondencia', `Oficio ${o.radicado || ''}: ${o.asunto || ''}`, { proyecto_id: pid, fecha: f, sentido: o.sentido || 'Recibida', radicado: o.radicado, de: o.de, para: o.para, asunto: o.asunto, requiere_respuesta: o.requiere_respuesta ? 'Sí' : 'No', plazo: o.requiere_respuesta ? diasHabiles(f, o.plazo_dias || 15) : null, estado: 'Abierta', archivo: nombre });
  }
  if (d.tipo === 'ensayo') for (const e of d.ensayos || []) add('ensayo', `Ensayo ${e.ensayo || ''} ${e.abscisa || ''}`, { proyecto_id: pid, ...e });
  if (d.tipo === 'factura' && d.factura && cid('interventoria')) add('gasto', `Gasto: ${d.factura.proveedor || ''} ${d.factura.documento || ''}`, { contrato_id: cid('interventoria'), ...d.factura, pagado: 'No' });
  if (d.tipo === 'otrosi' && d.otrosi && cid(contratoDoc)) add('otrosi', `Otrosí (${d.otrosi.tipo || ''}) del contrato de ${contratoDoc === 'obra' ? 'obra' : 'interventoría'}`, { contrato_id: cid(contratoDoc), ...d.otrosi, estado: 'En trámite' });
  if (d.tipo === 'reunion' && d.reunion) { const x = d.reunion, t = x.tipo || '';
    add('reunion', `Reunión: ${t} ${x.comunidad || ''}`, { proyecto_id: pid, fecha: x.fecha || hoy, tipo: /inicio/i.test(t) ? 'Inicio' : /final|cierre/i.test(t) ? 'Finalización' : /comit/i.test(t) ? 'Comité de participación' : /extra/i.test(t) ? 'Extraordinaria' : 'Avance',
      lugar: x.lugar, comunidad: x.comunidad, convocados: x.convocados, asistentes: x.asistentes, temas: x.descripcion, compromisos: x.compromisos, acta: x.acta, estado: 'Realizada' }); }
  if (d.tipo === 'pqrs' && d.pqrs) add('pqrs', `PQRS ${d.pqrs.radicado || ''}: ${d.pqrs.tipo || ''}`, { proyecto_id: pid, ...d.pqrs, fecha: d.pqrs.fecha || hoy, tipo: d.pqrs.tipo || 'Petición', estado: 'Abierta' });
  if (d.tipo === 'presupuesto' && cid(contratoDoc)) for (const it of (d.items || []).slice(0, 500)) add('item', `${it.codigo || ''} ${it.descripcion || ''}`, { contrato_id: cid(contratoDoc), tipo: it.unidad || it.cantidad ? 1 : 0, ...it });
  if (d.tipo === 'personal') for (const p of d.personas || []) add('personal', `${p.nombre || ''} · ${p.cargo || ''}`, { proyecto_id: pid, ...p, estado: 'Propuesto' });
  if (d.tipo === 'avance' && cid('obra')) {
    const items = await db.all('SELECT id, codigo, descripcion, unidad FROM item WHERE contrato_id = ? AND tipo = 1', cid('obra'));
    const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
    const metros = t => { const m = String(t ?? '').replace(',', '.').match(/k?\s*(\d+)\s*\+\s*([\d.]+)/i); return m ? +m[1] * 1000 + +m[2] : t === '' || t == null || Number.isNaN(Number(t)) ? null : Number(t); };
    for (const a of d.avances || []) {
      const it = items.find(i => a.codigo_item && norm(i.codigo) === norm(a.codigo_item)) || items.find(i => a.actividad && norm(i.descripcion).includes(norm(a.actividad).slice(0, 25)));
      add('avance', `${a.fecha || hoy} · ${it ? (it.codigo || '') + ' ' + it.descripcion : '⚠️ elija el ítem: ' + (a.actividad || '')}`, { proyecto_id: pid, item_id: it?.id ?? null, fecha: a.fecha || hoy, frente: a.frente,
        abs_ini: metros(a.abscisa_inicial), abs_fin: metros(a.abscisa_final), largo: a.largo, ancho: a.ancho, espesor: a.espesor, piezas: a.piezas, cantidad: a.cantidad, descripcion: a.actividad });
    }
  }
  for (const v of d.vencimientos || []) if (v.fecha) add('vencimiento', `Vence ${v.fecha}: ${v.descripcion || ''}`, { proyecto_id: pid, fecha: v.fecha, tipo: { poliza: 'Póliza', oficio: 'Respuesta', otrosi: 'Contrato' }[d.tipo] || 'Documento', descripcion: v.descripcion, responsable: v.responsable, estado: 'Pendiente', fuente: nombre });
  return out;
}

// Respuesta en tiempo real (Server-Sent Events). Los errores antes del primer evento salen como JSON.
async function asistenteSSE(req, res, pid, u) {
  const b = await leerCuerpo(req);
  const ev = (nombre, datos) => {
    if (!res.headersSent) res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store' });
    res.write(`event: ${nombre}\ndata: ${JSON.stringify(datos)}\n\n`);
  };
  try { await asistente(pid, b, u, ev); }
  catch (e) { if (!res.headersSent) throw e; ev('error', { mensaje: e.message }); }
  ev('fin', {}); res.end();
}

// ---------- Captura de avance ----------
// Cantidad según la unidad del ítem: m = largo, m² = largo × ancho, m³ = largo × ancho × espesor, und = piezas
function cantidadAvance(d, unidad) {
  const largo = d.largo ?? (d.abs_ini != null && d.abs_fin != null ? Math.abs(d.abs_fin - d.abs_ini) : null);
  const u = String(unidad || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const f = [largo, u.includes('2') || u.includes('3') ? d.ancho : null, u.includes('3') ? d.espesor : null, d.piezas].filter(v => v != null && v !== '');
  return f.length ? r2(f.reduce((s, v) => s * Number(v), 1)) : 0;
}
async function prepararAvance(d, u, antes) {
  // Una captura ya incluida en un acta cerrada no se puede cambiar ni borrar
  if (antes?.acta_id && bloqueada(await db.get('SELECT * FROM acta WHERE id = ?', antes.acta_id))) throw new Rechazo(409, 'Esta captura ya está en un acta aprobada y no se puede cambiar');
  if (!antes) d.usuario = u.nombre;
  const v = { ...antes, ...d };
  if (v.item_id) {
    const it = await db.get('SELECT contrato_id, unidad FROM item WHERE id = ?', v.item_id);
    if (!it) throw new Rechazo(400, 'El ítem no existe');
    if (!antes || d.item_id != null) d.contrato_id = it.contrato_id;
    if ((d.cantidad == null || d.cantidad === '') && ['largo', 'ancho', 'espesor', 'piezas', 'abs_ini', 'abs_fin', 'item_id'].some(k => k in d)) d.cantidad = cantidadAvance(v, it.unidad);
  }
}
// Suma (signo 1) o resta (−1) la captura a la cantidad presentada de su acta, si el acta sigue abierta
async function moverAvance(av, signo) {
  if (!av?.acta_id || !av.item_id || av.estado === 'Rechazado') return;
  const a = await db.get('SELECT * FROM acta WHERE id = ?', av.acta_id);
  if (!a || bloqueada(a)) return;
  await db.run(`INSERT INTO acta_item (acta_id, item_id, cant_presentada, cant_aprobada) VALUES (?, ?, ?, 0)
    ON CONFLICT (acta_id, item_id) DO UPDATE SET cant_presentada = MAX(0, ROUND(cant_presentada + excluded.cant_presentada, 4))`, a.id, av.item_id, signo * (av.cantidad || 0));
}
// Busca el acta abierta (borrador o con observaciones) cuyo periodo incluye la fecha de la captura
async function vincularAvance(id) {
  const av = await db.get('SELECT * FROM avance WHERE id = ?', id);
  if (!av || av.acta_id || av.estado === 'Rechazado' || !av.contrato_id || !av.item_id) return;
  const a = await db.get(`SELECT id FROM acta WHERE contrato_id = ? AND estado IN ('Borrador', 'Con observaciones') AND (desde IS NULL OR desde <= ?) AND (hasta IS NULL OR hasta >= ?) ORDER BY numero DESC LIMIT 1`, av.contrato_id, av.fecha, av.fecha);
  if (!a) return;
  await db.run('UPDATE avance SET acta_id = ? WHERE id = ?', a.id, id);
  await moverAvance({ ...av, acta_id: a.id }, 1);
}

// Festivos de Colombia (Ley 51 de 1983): fijos, trasladables al lunes y los que dependen de la Pascua
function pascua(a) {
  const b = a % 19, c = Math.floor(a / 100), d = a % 100, e = (19 * b + c - Math.floor(c / 4) - Math.floor((c - Math.floor((8 * c + 13) / 25)) / 3) + 15) % 30;
  const f = (32 + 2 * (c % 4) + 2 * Math.floor(d / 4) - e - (d % 4)) % 7, g = Math.floor((b + 11 * e + 19 * f) / 433);
  const m = Math.floor((e + f - 7 * g + 90) / 25);
  return new Date(Date.UTC(a, m - 1, (e + f - 7 * g + 33 * m + 19) % 32));
}
const festivosCache = {};
function festivos(a) {
  if (festivosCache[a]) return festivosCache[a];
  const iso = d => d.toISOString().slice(0, 10), dia = (m, d) => new Date(Date.UTC(a, m - 1, d));
  const lunes = d => { while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1); return d; };
  const p = pascua(a), mas = n => new Date(p.getTime() + n * 86400000);
  const fijos = [[1, 1], [5, 1], [7, 20], [8, 7], [12, 8], [12, 25]].map(([m, d]) => dia(m, d));
  const mover = [[1, 6], [3, 19], [6, 29], [8, 15], [10, 12], [11, 1], [11, 11]].map(([m, d]) => lunes(dia(m, d)));
  return (festivosCache[a] = new Set([...fijos, ...mover, mas(-3), mas(-2), lunes(mas(39)), lunes(mas(60)), lunes(mas(68))].map(iso)));
}
// Plazo en días hábiles (sin sábados, domingos ni festivos de Colombia)
function diasHabiles(desde, n) {
  const d = new Date(desde + 'T00:00:00Z');
  while (n > 0) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6 && !festivos(d.getUTCFullYear()).has(d.toISOString().slice(0, 10))) n--; }
  return d.toISOString().slice(0, 10);
}
// Ley 1755 de 2015, art. 14: 15 días en general, 10 para documentos e información, 30 para consultas
const diasPQRS = tipo => (/documento|informaci/i.test(tipo || '') ? 10 : /consulta/i.test(tipo || '') ? 30 : 15);

// GTC 45: NP = ND × NE, NR = NP × NC, nivel de riesgo e interpretación
function nivelRiesgo(nr) {
  if (nr >= 600) return ['I', 'No aceptable: situación crítica, suspender actividades hasta controlar el riesgo'];
  if (nr >= 150) return ['II', 'No aceptable o aceptable con control específico: corregir y adoptar medidas de control'];
  if (nr >= 40) return ['III', 'Mejorable: mejorar si es posible'];
  return ['IV', 'Aceptable: mantener los controles existentes'];
}
// Campos calculados de los anexos de SST (matriz de peligros y lista de chequeo)
function calcularSST(tabla, d, antes = {}) {
  const v = k => (d[k] !== undefined ? d[k] : antes[k]);
  if (tabla === 'sst_peligro' && ['nd', 'ne', 'nc'].some(k => k in d)) {
    const nd = Number(v('nd')), ne = Number(v('ne')), nc = Number(v('nc'));
    if (nd > 0 && ne > 0 && nc > 0) { d.np = nd * ne; d.nr = d.np * nc; [d.nivel, d.aceptabilidad] = nivelRiesgo(d.nr); }
  }
  if (tabla === 'sst_inspeccion' && 'chequeo' in d) {
    const r = Object.values(typeof d.chequeo === 'string' ? JSON.parse(d.chequeo || '{}') : d.chequeo || {});
    if (typeof d.chequeo !== 'string') d.chequeo = JSON.stringify(d.chequeo);
    const c = r.filter(x => x === 'C').length, nc = r.filter(x => x === 'NC').length;
    d.cumplimiento = c + nc ? r2((c / (c + nc)) * 100) : null;
  }
}

// Avisos de los anexos de SST
async function avisosSST(pid, hoy, limite) {
  const out = [], q = (sql, ...a) => db.all(sql, pid, ...a);
  for (const t of ['sst_peligro', 'sst_inspeccion', 'sst_investigacion'])
    for (const r of await q(`SELECT * FROM ${t} WHERE proyecto_id = ? AND COALESCE(estado, '') <> 'Cerrado' AND plazo IS NOT NULL AND plazo <= ? ORDER BY plazo`, limite))
      out.push({ fecha: r.plazo, tipo: 'SST', texto: { sst_peligro: `Medida de intervención (${r.peligro || 'peligro'}): ${r.intervencion || ''}`, sst_inspeccion: `Cierre de hallazgos de la inspección de ${r.tipo || ''}: ${r.accion || r.hallazgos || ''}`, sst_investigacion: `Acciones de la investigación del ${r.tipo || 'evento'}: ${r.acciones || ''}` }[t].trim(), abrir: 'tabla:' + t });
  for (const r of await q(`SELECT * FROM sst_permiso WHERE proyecto_id = ? AND estado = 'Abierto' AND vigente_hasta IS NOT NULL AND vigente_hasta < ?`, hoy))
    out.push({ fecha: r.vigente_hasta, tipo: 'SST', texto: `Permiso de ${(r.tipo || 'trabajo').toLowerCase()} ${r.numero || ''} vencido y sin cerrar`, abrir: 'tabla:sst_permiso' });
  for (const r of await q(`SELECT * FROM sst_permiso WHERE proyecto_id = ? AND estado = 'Abierto' AND (ats <> 'Sí' OR (tipo = 'Trabajo en alturas' AND (lista_chequeo <> 'Sí' OR rescate <> 'Sí')))`))
    out.push({ fecha: r.fecha || hoy, tipo: 'SST', texto: `Permiso ${r.numero || ''} (${r.tipo || ''}) sin ATS, lista de chequeo o plan de rescate`, abrir: 'tabla:sst_permiso' });
  for (const r of await q(`SELECT * FROM sst_investigacion WHERE proyecto_id = ? AND investigado IS NULL AND fecha IS NOT NULL`)) {
    const vence = sumarDias(r.fecha, 15);
    if (vence <= limite) out.push({ fecha: vence, tipo: 'SST', texto: `Investigar el ${(r.tipo || 'evento').toLowerCase()} del ${r.fecha} (15 días, Res. 1401 de 2007)`, abrir: 'tabla:sst_investigacion' });
    if (/accidente/i.test(r.tipo || '') && !r.reporte_arl) out.push({ fecha: diasHabiles(r.fecha, 2), tipo: 'SST', texto: `Reportar a la ARL (FURAT) el accidente del ${r.fecha}${r.trabajador ? ' de ' + r.trabajador : ''}`, abrir: 'tabla:sst_investigacion' });
  }
  for (const r of await q(`SELECT * FROM sst_trabajador WHERE proyecto_id = ? AND estado = 'Activo' AND alturas_vence IS NOT NULL AND alturas_vence <= ?`, limite))
    out.push({ fecha: r.alturas_vence, tipo: 'SST', texto: `Vence el certificado de trabajo en alturas de ${r.nombre || 'un trabajador'}`, abrir: 'tabla:sst_trabajador' });
  for (const r of await q(`SELECT * FROM sst_epp WHERE proyecto_id = ? AND reposicion IS NOT NULL AND reposicion <= ? AND reposicion >= ?`, limite, hoy))
    out.push({ fecha: r.reposicion, tipo: 'SST', texto: `Reponer ${r.elemento || 'EPP'} a ${r.trabajador || ''}`.trim(), abrir: 'tabla:sst_epp' });
  for (const r of await q(`SELECT * FROM sst_emergencia WHERE proyecto_id = ? AND COALESCE(estado, '') <> 'Cerrado' AND proxima IS NOT NULL AND proxima <= ?`, limite))
    out.push({ fecha: r.proxima, tipo: 'SST', texto: `${r.tipo || 'Emergencias'}: próxima revisión o simulacro (${r.escenario || ''})`, abrir: 'tabla:sst_emergencia' });
  for (const r of await q(`SELECT * FROM sst_equipo WHERE proyecto_id = ? AND estado = 'Operativo'`))
    for (const [k, n] of [['soat', 'SOAT'], ['tecnomecanica', 'revisión técnico-mecánica'], ['licencia', 'licencia de conducción del operador']])
      if (r[k] && r[k] <= limite) out.push({ fecha: r[k], tipo: 'SST', texto: `Vence ${n} de ${r.equipo || ''} ${r.placa || ''}`.trim(), abrir: 'tabla:sst_equipo' });
  for (const r of await q(`SELECT * FROM sst_actividad WHERE proyecto_id = ? AND estado = 'Programada' AND fecha IS NOT NULL AND fecha <= ?`, limite))
    out.push({ fecha: r.fecha, tipo: 'SST', texto: `${r.tipo || 'Actividad SST'}: ${r.actividad || ''}`, abrir: 'tabla:sst_actividad' });
  const ultimo = await db.get(`SELECT MAX(fecha) f FROM sst_emergencia WHERE proyecto_id = ? AND tipo = 'Simulacro'`, pid);
  if (!ultimo.f || ultimo.f < sumarMeses(hoy, -12)) out.push({ fecha: hoy, tipo: 'SST', texto: 'No hay simulacro de emergencia en los últimos 12 meses (Res. 0312 de 2019)', abrir: 'tabla:sst_emergencia' });
  const mesAnt = sumarMeses(hoy.slice(0, 7) + '-01', -1).slice(0, 7);
  const pend = await db.get(`SELECT COUNT(*) n FROM sst_seguridad_social WHERE proyecto_id = ? AND mes = ? AND verificado <> 'Sí'`, pid, mesAnt);
  if (pend.n) out.push({ fecha: hoy, tipo: 'SST', texto: `${pend.n} trabajador(es) sin verificar la PILA de ${mesAnt}`, abrir: 'tabla:sst_seguridad_social' });
  return out;
}

// Indicadores obligatorios del SG-SST (Res. 0312 de 2019, art. 30), por mes
function indicadoresSST(meses) {
  return meses.map(m => {
    const t = m.trabajadores || 0, f = (n, d) => (d ? r2((n / d) * 100) : null);
    return { mes: m.mes, trabajadores: t,
      frecuencia: f(m.accidentes || 0, t),                                    // AT en el mes / trabajadores × 100
      severidad: f((m.dias_incapacidad || 0) + (m.dias_cargados || 0), t),    // (días incapacidad + días cargados) / trabajadores × 100
      mortalidad: f(m.accidentes_mortales || 0, m.accidentes || 0),           // AT mortales / AT del periodo × 100
      ausentismo: f(m.dias_ausencia || 0, m.dias_programados || 0),           // días de ausencia / días programados × 100
      planillas_ok: m.planillas_ok };
  });
}

// Avance físico a una fecha: programado vs ejecutado ponderado por duración, y SPI
async function avanceFisico(pid, hoy) {
  const tareas = (await db.all('SELECT * FROM tarea WHERE proyecto_id = ? ORDER BY orden, id', pid)).map(t => ({ ...t, programado: integ.programado(t, hoy) }));
  const hojas = tareas.filter(t => !t.resumen);
  const peso = t => Math.max(1, (Date.parse(t.fin) - Date.parse(t.inicio)) / 86400000 || 1);
  const tot = hojas.reduce((s, t) => s + peso(t), 0) || 1;
  const prog = hojas.reduce((s, t) => s + t.programado * peso(t), 0) / tot, real = hojas.reduce((s, t) => s + (t.avance_real || 0) * peso(t), 0) / tot;
  return { hoy, tareas, programado: r2(prog), real: r2(real), spi: prog ? r2(real / prog) : null };
}

// Anexo ambiental del mes: fichas del PAGA con su avance, permisos, RCD, forestal, agua, maquinaria, monitoreos, chequeo y PMT
async function ambientalMes(pid, ini, fin, del) {
  const todos = t => db.all(`SELECT * FROM ${t} WHERE proyecto_id = ? ORDER BY id`, pid);
  const seg = await del('ambiental');
  const social = await del('social');
  // Las fichas sociales (programas 6 a 10) se alimentan de "Gestión social" con el mismo código de ficha
  const fichas = (await todos('amb_ficha')).map(f => { const r = seg.filter(s => s.ficha && s.ficha === f.codigo); return { ...f, registros: r.length + social.filter(s => s.ficha && s.ficha === f.codigo).length, logro: r.reduce((a, s) => a + (s.logro || 0), 0), actividades: r }; });
  const rcd = await del('rcd'), suma = k => r2(rcd.reduce((a, x) => a + (x[k] || 0), 0));
  const forestal = await todos('forestal');
  return { fichas, seguimiento: seg, requisitos: await todos('amb_requisito'), permisos: await todos('amb_permiso'), rcd, rcd_tot: { generado: suma('generado'), aprovechado: suma('aprovechado'), dispuesto: suma('dispuesto'), pct: suma('generado') ? r2(suma('aprovechado') / suma('generado') * 100) : null },
    forestal: forestal.filter(f => f.fecha >= ini && f.fecha <= fin), forestal_tot: { inventario: forestal.length, intervenidos: forestal.filter(f => ['Tala', 'Bloqueo y traslado'].includes(f.tratamiento)).length, compensar: forestal.reduce((a, f) => a + (f.compensar || 0), 0), sembrados: forestal.reduce((a, f) => a + (f.sembrados || 0), 0) },
    agua: await del('agua'), maquinaria: await todos('maquinaria'), monitoreos: await del('monitoreo'), chequeo: await del('amb_chequeo'), pmt_insp: await del('pmt_inspeccion'),
    soportes: await db.all(`SELECT tabla, registro_id, nombre, descripcion, categoria, fecha FROM adjunto WHERE proyecto_id = ? AND tabla IN (${['ambiental', 'pmt', ...AMB].map(() => '?').join(',')}) AND fecha BETWEEN ? AND ? ORDER BY tabla, fecha`, pid, 'ambiental', 'pmt', ...AMB, ini, fin) };
}

// Gestión social del mes para el informe: PQRS con semáforo, reuniones, actas de vecindad, mano de obra local y demás
async function gestionSocial(pid, mes, ini, fin, corte) {
  const t = (tabla, extra = '') => db.all(`SELECT * FROM ${tabla} WHERE proyecto_id = ?${extra}`, pid);
  const enMes = f => f && f >= ini && f <= fin;
  const pqrs = (await t('pqrs', ' ORDER BY fecha')).filter(p => (p.fecha || '') <= fin).map(p => {
    const cerrada = ['Respondida', 'Cerrada'].includes(p.estado), resp = p.fecha_respuesta || (cerrada ? corte : null);
    return { ...p, semaforo: resp ? (p.plazo && resp > p.plazo ? 'Respondida fuera de plazo' : 'Respondida a tiempo') : p.plazo && p.plazo < corte ? 'Vencida' : p.plazo && p.plazo <= diasHabiles(corte, 3) ? 'Por vencer' : 'En término', cerrada };
  });
  const mo = (await t('mano_obra', ' ORDER BY mes')).find(m => m.mes === mes) || null;
  const enc = (await t('encuesta')).filter(e => enMes(e.fecha)), ne = enc.reduce((s, e) => s + (e.encuestados || 0), 0);
  const av = await t('acta_vecindad', ' ORDER BY predio');
  return { pqrs_mes: pqrs.filter(p => enMes(p.fecha) || enMes(p.fecha_respuesta) || !p.cerrada), pqrs_recibidas: pqrs.filter(p => enMes(p.fecha)).length,
    reuniones: (await t('reunion', ' ORDER BY fecha')).filter(r => enMes(r.fecha)),
    vecindad: av.filter(a => enMes(a.fecha_inicio) || enMes(a.fecha_cierre)), vecindad_total: av.length, vecindad_cerradas: av.filter(a => a.fecha_cierre).length,
    mano_obra: mo && { ...mo, pct: mo.total ? r2(((mo.local_no_calificada || 0) + (mo.local_calificada || 0)) / mo.total * 100) : null },
    capacitaciones: (await t('capacitacion', ' ORDER BY fecha')).filter(c => enMes(c.fecha)),
    afectaciones: (await t('afectacion', ' ORDER BY fecha')).filter(a => enMes(a.fecha) || !['Cerrada', 'Atendida'].includes(a.estado)),
    encuestas: enc, satisfaccion: ne ? r2(enc.reduce((s, e) => s + (e.satisfechos || 0), 0) / ne * 100) : null,
    veedurias: await t('veeduria') };
}

// Cuadros de control del informe mensual: balance por capítulo, curva S, flujo de anticipo
// y fotos "antes" del mismo punto fijo.
async function extrasInforme(pid, contratos, ini, fin, tareas) {
  const finMes = m => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).toISOString().slice(0, 10);
  for (const c of contratos) {
    // Balance de cantidades y valores (costo directo) por capítulo, a la fecha de corte
    const ultima = c.actas.filter(a => (a.hasta || a.fecha || '') <= fin).pop();
    const filas = ultima ? (await detalleActa(ultima.id)).filas : (await presupuesto(c.id)).items;
    const delMes = new Map();
    for (const a of c.actas_mes) for (const f of (await detalleActa(a.id)).filas) if (f.tipo === 1 && f.cant_aprobada) delMes.set(f.id, (delMes.get(f.id) || 0) + f.cant_aprobada);
    const caps = new Map(), capDe = new Map(filas.filter(f => f.tipo !== 1).map(f => [f.id, f]));
    const items = [];
    for (const f of filas.filter(f => f.tipo === 1)) {
      const vig = f.cantidad_vigente ?? f.cantidad ?? 0, acum = f.acumulado || 0, mesQ = delMes.get(f.id) || 0, vu = f.vr_unitario || 0;
      const cap = capDe.get(f.padre_id), k = cap ? `${cap.codigo || ''} ${cap.descripcion || ''}`.trim() : 'Sin capítulo';
      if (!caps.has(k)) caps.set(k, { capitulo: k, contratado: 0, periodo: 0, acumulado: 0, items: 0, mayores: 0 });
      const g = caps.get(k);
      g.contratado += vig * vu; g.periodo += mesQ * vu; g.acumulado += acum * vu; g.items++; if (acum - vig > 1e-9) g.mayores++;
      items.push({ codigo: f.codigo, descripcion: f.descripcion, unidad: f.unidad, contratada: vig, periodo: mesQ, acumulada: acum, saldo: vig - acum, vu });
    }
    c.balance = [...caps.values()].map(g => ({ ...g, saldo: g.contratado - g.acumulado, pct: g.contratado ? (g.acumulado / g.contratado) * 100 : 0 }));
    c.balance_items = items;
    // Flujo de caja: actas a la fecha, amortización proporcional del anticipo y neto a pagar
    const ant = (c.valor || 0) * (c.anticipo_pct || 0) / 100;
    let amortAcum = 0, acum = 0;
    c.flujo = c.actas.filter(a => (a.hasta || a.fecha || '') <= fin).map(a => {
      const amort = Math.max(0, Math.min(ant - amortAcum, (a.valor || 0) * (c.anticipo_pct || 0) / 100));
      amortAcum += amort; acum += a.valor || 0;
      return { numero: a.numero, corte: a.hasta || a.fecha, estado: a.estado, valor: a.valor || 0, amortizacion: amort, neto: (a.valor || 0) - amort, acumulado: acum, saldo_anticipo: ant - amortAcum };
    });
    c.anticipo = ant;
    // Curva S: programado y ejecutado (financiero) acumulados por mes, desde el inicio hasta el mes del informe
    c.curva = [];
    if (c.fecha_inicio && c.fecha_inicio <= fin) {
      const hojas = (tareas || []).filter(t => !t.resumen && t.inicio && t.fin);
      const peso = t => Math.max(1, (Date.parse(t.fin) - Date.parse(t.inicio)) / 86400000 || 1), tot = hojas.reduce((s, t) => s + peso(t), 0);
      const finC = c.fecha_fin_vigente || c.fecha_fin, conPrograma = c.tipo === 'obra' && hojas.length;
      const prog = f => (conPrograma ? hojas.reduce((s, t) => s + integ.programado(t, f) * peso(t), 0) / tot
        : finC ? integ.programado({ inicio: c.fecha_inicio, fin: finC }, f) : null);
      let m = c.fecha_inicio.slice(0, 7), antP = 0, antE = 0;
      while (m <= fin.slice(0, 7) && c.curva.length < 120) {
        const fm = finMes(m), pr = prog(fm);
        const eAcum = c.valor_vigente ? ((c.actas.filter(a => (a.hasta || a.fecha || '') <= fm).pop() || {}).acumulado || 0) / c.valor_vigente * 100 : 0;
        c.curva.push({ mes: m, prog_mes: pr == null ? null : pr - antP, prog_acum: pr, ejec_mes: eAcum - antE, ejec_acum: eAcum });
        antP = pr || 0; antE = eAcum;
        m = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 1)).toISOString().slice(0, 7);
      }
      c.curva_base = conPrograma ? 'programa de obra cargado' : 'distribución lineal del plazo vigente';
    }
  }
  // Por cada punto fijo fotografiado en el mes: la primera foto de ese punto (antes del periodo) y la última del mes
  const puntos = (await db.all(`SELECT DISTINCT punto FROM adjunto WHERE proyecto_id = ? AND categoria = 'Foto' AND punto IS NOT NULL AND punto <> '' AND fecha BETWEEN ? AND ?`, pid, ini, fin)).map(r => r.punto);
  const antes_despues = [], q = `SELECT * FROM adjunto WHERE proyecto_id = ? AND categoria = 'Foto' AND tipo_mime IN ('image/jpeg', 'image/png') AND punto = ?`;
  const conDatos = async f => ({ ...f, datos: Buffer.from((await db.get('SELECT datos FROM adjunto_dato WHERE adjunto_id = ?', f.id)).datos) });
  for (const pt of puntos.slice(0, 8)) {
    const a = await db.get(`${q} AND fecha < ? ORDER BY fecha, id LIMIT 1`, pid, pt, ini);
    const b = await db.get(`${q} AND fecha BETWEEN ? AND ? ORDER BY fecha DESC, id DESC LIMIT 1`, pid, pt, ini, fin);
    if (a && b) antes_despues.push({ punto: pt, antes: await conDatos(a), despues: await conDatos(b) });
  }
  return { antes_despues };
}

// Tablero de indicadores del contrato de obra (valor ganado, curva S, plazo, pólizas, PQRS, SST, capturas y alertas).
// Valor ganado (EVM, PMI): BAC = valor vigente; PV = % programado (Project) × BAC; EV = valor de las cantidades
// aprobadas en actas (precios del contrato); EV físico = % real del programa × BAC; AC = lo facturado por actas.
// SPI = EV / PV (atraso si < 1). CPI = EV físico / AC: < 1 indica que se ha facturado más de lo ejecutado físicamente.
// Semáforo: ≥ 0,95 verde · 0,85–0,95 amarillo · < 0,85 rojo (umbral de la entidad; se puede ajustar por contrato).
const semaforo = v => (v == null ? 'gris' : v >= 0.95 ? 'verde' : v >= 0.85 ? 'amarillo' : 'rojo');
const finMes = m => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).toISOString().slice(0, 10);
async function indicadores(pid) {
  const r = await resumen(pid), hoy = r.hoy;
  const ob = r.contratos.find(c => c.tipo === 'obra'), it = r.contratos.find(c => c.tipo !== 'obra');
  const tareas = await db.all('SELECT * FROM tarea WHERE proyecto_id = ? ORDER BY orden, id', pid);
  const hojas = tareas.filter(t => !t.resumen && t.inicio && t.fin);
  const peso = t => Math.max(1, (Date.parse(t.fin) - Date.parse(t.inicio)) / 86400000 || 1), tot = hojas.reduce((s, t) => s + peso(t), 0) || 1;
  const progA = f => (hojas.length ? r2(hojas.reduce((s, t) => s + integ.programado(t, f) * peso(t), 0) / tot) : null);
  const realPct = hojas.length ? r2(hojas.reduce((s, t) => s + (t.avance_real || 0) * peso(t), 0) / tot) : null;
  const bac = ob?.valor_vigente || ob?.presupuesto || 0;
  const actas = ob ? ob.actas.filter(a => a.estado !== 'Borrador') : [];
  const fA = a => a.hasta || a.fecha || '';
  const acumA = f => { const x = actas.filter(a => fA(a) && fA(a) <= f); return x.length ? x[x.length - 1].acumulado : 0; };
  // Meses de la curva S: del inicio a la terminación vigente (o al programa), máximo 72
  const fechas = [ob?.fecha_inicio, ob?.fecha_fin_vigente, ...hojas.flatMap(t => [t.inicio, t.fin]), ...actas.map(fA)].filter(Boolean).sort();
  const curva = [];
  if (fechas.length) {
    let m = fechas[0].slice(0, 7); const ult = fechas[fechas.length - 1].slice(0, 7);
    while (m <= ult && curva.length < 72) {
      const fm = finMes(m), pasado = m <= hoy.slice(0, 7), corte = fm < hoy ? fm : hoy;
      const prog = progA(fm), ej = pasado ? acumA(corte) : null;
      const deMes = c => (c ? c.actas.filter(a => a.estado !== 'Borrador' && fA(a).slice(0, 7) === m).reduce((s, a) => s + (a.valor || 0), 0) : 0);
      curva.push({ mes: m, programado_pct: prog, pv: prog == null ? null : r2(prog / 100 * bac), ejecutado_actas_pct: ej == null || !bac ? null : r2(ej / bac * 100), ev: ej,
        real_programa_pct: m === hoy.slice(0, 7) ? realPct : null, valor_actas_mes: r2(deMes(ob)), valor_interventoria_mes: r2(deMes(it)) });
      m = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 1)).toISOString().slice(0, 7);
    }
  }
  const progHoy = progA(hoy), ev = actas.length ? actas[actas.length - 1].acumulado : 0;
  const pv = progHoy == null ? null : r2(progHoy / 100 * bac), evFis = realPct == null ? null : r2(realPct / 100 * bac);
  const spi = pv ? r2(ev / pv) : null, spiProg = progHoy ? r2(realPct / progHoy) : null, cpi = evFis != null && ev ? r2(evFis / ev) : null;
  // Plazo transcurrido vs avance
  const dTot = ob ? diasEntre(ob.fecha_inicio, ob.fecha_fin_vigente) : 0, dPas = ob?.fecha_inicio ? Math.min(dTot, diasEntre(ob.fecha_inicio, hoy)) : 0;
  const plazo = { inicio: ob?.fecha_inicio || null, fin: ob?.fecha_fin_vigente || null, dias_total: dTot, dias_transcurridos: dPas, dias_restantes: Math.max(0, dTot - dPas),
    pct_tiempo: dTot ? r2(dPas / dTot * 100) : null, pct_financiero: bac ? r2(ev / bac * 100) : null, pct_fisico: realPct, suspendido: !!ob?.suspendido };
  // Avance por capítulo (última acta aprobada o el presupuesto)
  const capitulos = [];
  if (ob) {
    const filas = actas.length ? (await detalleActa(actas[actas.length - 1].id)).filas : (await presupuesto(ob.id)).items;
    let cap = { capitulo: 'Sin capítulo', contratado: 0, ejecutado: 0 };
    for (const f of filas) {
      if (f.tipo !== 1) { if (cap.contratado || cap.ejecutado) capitulos.push(cap); cap = { capitulo: [f.codigo, f.descripcion].filter(Boolean).join(' '), contratado: 0, ejecutado: 0 }; continue; }
      cap.contratado += (f.cantidad_vigente ?? f.cantidad ?? 0) * (f.vr_unitario || 0); cap.ejecutado += f.vr_acumulado || 0;
    }
    if (cap.contratado || cap.ejecutado) capitulos.push(cap);
    for (const c of capitulos) { c.contratado = r2(c.contratado); c.ejecutado = r2(c.ejecutado); c.pct = c.contratado ? r2(c.ejecutado / c.contratado * 100) : null; }
  }
  const en30 = new Date(Date.parse(hoy) + 30 * 86400000).toISOString().slice(0, 10), hace7 = new Date(Date.parse(hoy) - 7 * 86400000).toISOString().slice(0, 10);
  const polizas = await db.all(`SELECT * FROM poliza WHERE proyecto_id = ? AND COALESCE(estado, '') NOT IN ('Cerrada') AND hasta IS NOT NULL AND hasta <= ? ORDER BY hasta`, pid, en30);
  const pqrs = await db.all('SELECT * FROM pqrs WHERE proyecto_id = ? ORDER BY fecha', pid);
  const abiertas = pqrs.filter(s => !['Cerrada', 'Respondida'].includes(s.estado) && !s.fecha_respuesta);
  const sstMeses = indicadoresSST(await db.all('SELECT * FROM sst_mes WHERE proyecto_id = ? ORDER BY mes', pid));
  const sst = sstMeses.find(m => m.mes === hoy.slice(0, 7)) || sstMeses[sstMeses.length - 1] || null;
  const capturas = await db.all(`SELECT a.id, a.fecha, a.frente, a.abs_ini, a.abs_fin, a.cantidad, a.estado, i.codigo, i.descripcion item, i.unidad FROM avance a LEFT JOIN item i ON i.id = a.item_id WHERE a.proyecto_id = ? AND a.estado <> 'Rechazado' AND a.fecha >= ? ORDER BY a.fecha DESC, a.id DESC`, pid, hace7);
  const fotos = await db.all(`SELECT id, nombre, fecha, descripcion FROM adjunto WHERE proyecto_id = ? AND categoria = 'Foto' AND tipo_mime IN ('image/jpeg', 'image/png') AND fecha >= ? ORDER BY fecha DESC, id DESC LIMIT 6`, pid, hace7);
  const porMes = await db.all(`SELECT substr(fecha, 1, 7) mes, COUNT(*) capturas, SUM(cantidad) cantidad FROM avance WHERE proyecto_id = ? AND estado <> 'Rechazado' AND fecha IS NOT NULL GROUP BY 1 ORDER BY 1`, pid);
  return { hoy, evm: { bac, pv, ev, ev_fisico: evFis, ac: ev, programado_pct: progHoy, real_pct: realPct, spi, spi_programa: spiProg, cpi, sv: pv == null ? null : r2(ev - pv),
      semaforo_spi: semaforo(spi ?? spiProg), semaforo_cpi: semaforo(cpi), tiene_programa: hojas.length > 0 },
    plazo, curva, capitulos, polizas, pqrs: { total: pqrs.length, abiertas: abiertas.length, vencidas: abiertas.filter(s => s.plazo && s.plazo < hoy).length, lista: abiertas.slice(0, 5) },
    sst, sst_meses: sstMeses, capturas, fotos, capturas_mes: porMes, alertas: await avisos(pid) };
}

// Calendario del proyecto: todas las fechas de la base en un rango [desde, hasta] (AAAA-MM-DD).
// Cada evento: { fecha, tipo, titulo, abrir, vencido } — "abrir" es la misma clave que usa avisos() para abrir el documento.
async function calendario(pid, desde, hasta) {
  const hoy = hoyISO(), ev = [], en = f => f && f >= desde && f <= hasta;
  const add = (fecha, tipo, titulo, abrir, pendiente = false) => { if (en(fecha)) ev.push({ fecha, tipo, titulo: String(titulo || '').trim() || tipo, abrir, vencido: !!(pendiente && fecha < hoy) }); };
  const filas = (t, extra = '') => db.all(`SELECT * FROM ${t} WHERE proyecto_id = ?${extra}`, pid);
  for (const v of await filas('vencimiento')) add(v.fecha, 'Vencimiento', v.descripcion, 'tabla:vencimiento', v.estado !== 'Cumplido');
  for (const p of await filas('poliza')) add(p.hasta, 'Póliza', `Vence ${p.amparo || 'póliza'} ${p.numero || ''} (${p.contrato || ''})`, 'tabla:poliza', !['Vencida', 'Cerrada'].includes(p.estado));
  for (const s of await filas('social')) {
    const abierta = !['Cerrado', 'Respondido'].includes(s.estado);
    if (s.tipo === 'PQRS') { add(s.fecha, 'PQRS', 'PQRS recibida: ' + (s.descripcion || ''), 'tabla:social'); add(s.plazo, 'PQRS', 'Plazo de respuesta PQRS: ' + (s.descripcion || ''), 'tabla:social', abierta); }
    else { add(s.fecha, 'Social', [s.tipo, s.comunidad, s.descripcion].filter(Boolean).join(' · '), 'tabla:social'); add(s.plazo, 'Social', 'Plazo: ' + (s.descripcion || s.tipo || ''), 'tabla:social', abierta); }
  }
  for (const q of await filas('pqrs')) { const abierta = !['Cerrada', 'Respondida'].includes(q.estado) && !q.fecha_respuesta;
    add(q.fecha, 'PQRS', `${q.tipo || 'PQRS'} recibida ${q.radicado || ''}: ${q.descripcion || ''}`, 'tabla:pqrs'); add(q.plazo, 'PQRS', `Plazo de respuesta ${q.radicado || ''}: ${q.descripcion || ''}`, 'tabla:pqrs', abierta); }
  for (const r of await filas('reunion')) add(r.fecha, 'Reunión', `Reunión de ${String(r.tipo || '').toLowerCase()} ${r.lugar || r.comunidad || ''}`, 'tabla:reunion', r.estado === 'Programada');
  for (const a of await filas('acta_vecindad')) { add(a.fecha_inicio, 'Acta de vecindad', `Inicio predio ${a.predio || a.direccion || ''}`, 'tabla:acta_vecindad'); add(a.fecha_cierre, 'Acta de vecindad', `Cierre predio ${a.predio || a.direccion || ''}`, 'tabla:acta_vecindad'); }
  for (const v of await filas('veeduria')) { add(v.fecha, 'Veeduría', `Conformación ${v.nombre || ''}`, 'tabla:veeduria'); add(v.ultima_reunion, 'Veeduría', `Reunión ${v.nombre || ''}`, 'tabla:veeduria'); }
  for (const c of await filas('correspondencia')) add(c.plazo, 'Correspondencia', `Responder ${c.radicado || ''} ${c.asunto || ''}`, 'tabla:correspondencia', c.requiere_respuesta === 'Sí' && !['Cerrada', 'Respondida'].includes(c.estado));
  for (const m of await filas('pmt')) { add(m.desde, 'PMT', `Inicia vigencia PMT ${m.frente || ''}`, 'tabla:pmt'); add(m.hasta, 'PMT', `Vence PMT ${m.frente || ''}`, 'tabla:pmt', m.estado !== 'Cerrado'); }
  for (const b of await filas('bitacora')) add(b.fecha, 'Bitácora', [b.frente, b.actividades].filter(Boolean).join(': ').slice(0, 120), 'tabla:bitacora');
  for (const e of await filas('ensayo')) add(e.fecha, 'Ensayo', [e.ensayo, e.abscisa, e.resultado].filter(Boolean).join(' · '), 'tabla:ensayo');
  for (const s of await filas('sst')) add(s.plazo, 'SST', [s.tipo, s.accion || s.descripcion].filter(Boolean).join(': '), 'tabla:sst', s.estado !== 'Cerrado');
  for (const a of await filas('ambiental')) add(a.plazo, 'Ambiental', [a.componente || a.programa, a.accion || a.actividad].filter(Boolean).join(': '), 'tabla:ambiental', a.estado !== 'Cerrado');
  for (const p of await filas('amb_permiso')) add(p.vence, 'Permiso ambiental', `Vence ${p.tipo || 'permiso'} ${p.acto || ''} (${p.autoridad || ''})`, 'tabla:amb_permiso', !['Cerrado', 'Negado'].includes(p.estado));
  for (const m of await filas('monitoreo')) add(m.fecha, 'Ambiental', `Monitoreo ${m.tipo || ''} ${m.punto || ''}`, 'tabla:monitoreo');
  for (const m of await filas('maquinaria')) { add(m.proximo_mtto, 'Ambiental', `Mantenimiento ${m.equipo || ''} ${m.placa || ''}`, 'tabla:maquinaria', true); add(m.vence_emisiones, 'Ambiental', `Vence certificado de emisiones ${m.equipo || ''} ${m.placa || ''}`, 'tabla:maquinaria', true); }
  for (const c of await filas('amb_chequeo')) if (c.cumple === 'No') add(c.plazo, 'Ambiental', `${c.aspecto || ''}: ${c.accion || c.observacion || ''}`, 'tabla:amb_chequeo', c.estado !== 'Cerrado');
  for (const i of await filas('pmt_inspeccion')) add(i.fecha, 'PMT', `Inspección PMT ${i.frente || ''} · ${i.dispositivo || ''}`, 'tabla:pmt_inspeccion');
  for (const a of await db.all(`SELECT a.*, i.codigo FROM avance a LEFT JOIN item i ON i.id = a.item_id WHERE a.proyecto_id = ? AND a.estado <> 'Rechazado'`, pid))
    add(a.fecha, 'Captura', `Avance ${a.codigo || ''} ${a.frente || ''} ${a.cantidad != null ? '· ' + a.cantidad : ''}`, 'avances');
  for (const t of await db.all('SELECT * FROM tarea WHERE proyecto_id = ? AND resumen = 0', pid)) {
    if (t.hito) add(t.inicio, 'Programa', '◆ ' + t.nombre, 'programa');
    else { add(t.inicio, 'Programa', 'Inicia: ' + t.nombre, 'programa'); add(t.fin, 'Programa', 'Termina: ' + t.nombre + ` (${Math.round(t.avance_real || 0)} %)`, 'programa', (t.avance_real || 0) < 100); }
  }
  for (const c of (await resumen(pid)).contratos) {
    const nom = c.tipo === 'obra' ? 'obra' : 'interventoría', A = c.tipo === 'obra' ? 'Acta' : 'Cuenta';
    add(c.fecha_inicio, 'Contrato', `Acta de inicio · contrato de ${nom}`, 'contrato:' + c.tipo);
    add(c.fecha_fin_vigente, 'Contrato', `Terminación vigente · contrato de ${nom}`, 'contrato:' + c.tipo);
    for (const a of c.actas) { add(a.fecha, 'Acta', `${A} ${a.numero} (${a.estado})`, 'acta:' + a.id); if (a.hasta !== a.fecha) add(a.hasta, 'Acta', `Corte ${A.toLowerCase()} ${a.numero}`, 'acta:' + a.id); }
    for (const o of c.otrosis) add(o.fecha, 'Otrosí', `Otrosí ${o.numero} · ${o.tipo || ''} (${nom})`, 'otrosis:' + c.id);
    for (const x of c.suspensiones) { add(x.fecha_suspension, 'Suspensión', `Suspensión ${x.numero} (${nom})`, 'suspensiones:' + c.id); add(x.fecha_reinicio, 'Suspensión', `Reinicio ${x.numero} (${nom})`, 'suspensiones:' + c.id); }
    const pl = c.plazos_liquidacion, liq = c.liquidacion, pend = !(liq && ['Firmada', 'Cerrada'].includes(liq.estado));
    if (pl) { add(pl.bilateral, 'Liquidación', `Límite liquidación bilateral (${nom})`, 'liquidacion:' + c.id, pend); add(pl.unilateral, 'Liquidación', `Límite liquidación unilateral (${nom})`, 'liquidacion:' + c.id, pend); }
  }
  return ev.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.tipo.localeCompare(b.tipo));
}
// iCalendar (RFC 5545): eventos de día completo, CRLF, texto escapado y líneas plegadas a 75 octetos
function ics(nombre, eventos) {
  const tx = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const plegar = l => { const b = Buffer.from(l, 'utf8'); if (b.length <= 75) return l; const out = []; let cur = '', n = 0;
    for (const ch of l) { const k = Buffer.byteLength(ch); if (n + k > (out.length ? 74 : 75)) { out.push(cur); cur = ''; n = 0; } cur += ch; n += k; } out.push(cur); return out.join('\r\n '); };
  const d = f => f.replace(/-/g, ''), sello = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SIGI Pro//Calendario de obra//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + tx(nombre)];
  eventos.forEach((e, i) => lineas.push('BEGIN:VEVENT', `UID:${d(e.fecha)}-${i}-${crypto.createHash('sha1').update(e.tipo + e.titulo + e.fecha).digest('hex').slice(0, 12)}@sigi-pro`, 'DTSTAMP:' + sello,
    'DTSTART;VALUE=DATE:' + d(e.fecha), 'DTEND;VALUE=DATE:' + d(sumarDias(e.fecha, 1)), 'SUMMARY:' + tx(`[${e.tipo}] ${e.titulo}`), 'CATEGORIES:' + tx(e.tipo), 'TRANSP:TRANSPARENT', 'END:VEVENT'));
  lineas.push('END:VCALENDAR');
  return lineas.map(plegar).join('\r\n') + '\r\n';
}

// Datos del informe mensual de interventoría (mes AAAA-MM)
async function informeMensual(pid, mes) {
  mes = /^\d{4}-\d{2}$/.test(mes || '') ? mes : new Date().toISOString().slice(0, 7);
  const ini = mes + '-01', fin = new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7), 0)).toISOString().slice(0, 10);
  const enMes = f => f && f >= ini && f <= fin, hoy = new Date().toISOString().slice(0, 10), corte = fin < hoy ? fin : hoy;
  const r = await resumen(pid);
  const contratos = r.contratos.map(c => {
    const hasta = c.actas.filter(a => (a.hasta || a.fecha || '') <= fin);
    const acumulado = hasta.length ? hasta[hasta.length - 1].acumulado : 0;
    return { ...c, actas_mes: c.actas.filter(a => enMes(a.hasta || a.fecha)), acumulado_mes: acumulado, pct: c.valor_vigente ? r2((acumulado / c.valor_vigente) * 100) : null };
  });
  // Actividades del periodo: ítems con cantidad aprobada en las actas con corte en el mes
  for (const c of contratos) {
    c.actividades = [];
    for (const a of c.actas_mes) c.actividades.push(...(await detalleActa(a.id)).filas.filter(f => f.tipo === 1 && f.cant_aprobada));
  }
  const del = t => db.all(`SELECT * FROM ${t} WHERE proyecto_id = ? AND fecha BETWEEN ? AND ? ORDER BY fecha`, pid, ini, fin);
  const social = await db.all('SELECT * FROM social WHERE proyecto_id = ? ORDER BY fecha', pid);
  const pqrs = social.filter(s => s.tipo === 'PQRS' && s.estado !== 'Cerrado' && s.estado !== 'Respondido');
  const fisico = await avanceFisico(pid, corte);
  return { mes, ini, fin, hoy, corte, proyecto: r.proyecto, contratos, ...(await extrasInforme(pid, contratos, ini, fin, fisico.tareas)),
    fisico,
    tramos: await db.all('SELECT * FROM tramo WHERE proyecto_id = ? ORDER BY alineamiento_id, abs_ini', pid),
    polizas: await db.all('SELECT * FROM poliza WHERE proyecto_id = ? ORDER BY contrato, hasta', pid),
    sst_ind: indicadoresSST(await db.all('SELECT * FROM sst_mes WHERE proyecto_id = ? AND mes = ?', pid, mes))[0] || null,
    sst: await del('sst'), ambiental: await del('ambiental'),
    sst_anexos: {
      peligros: await db.all("SELECT * FROM sst_peligro WHERE proyecto_id = ? AND (COALESCE(estado, '') <> 'Cerrado' OR plazo BETWEEN ? AND ?) ORDER BY nr DESC, id", pid, ini, fin),
      inspecciones: await del('sst_inspeccion'), permisos: await del('sst_permiso'), capacitaciones: await del('sst_capacitacion'),
      epp: await del('sst_epp'), investigaciones: await del('sst_investigacion'), emergencias: await del('sst_emergencia'),
      seguridad_social: await db.all('SELECT * FROM sst_seguridad_social WHERE proyecto_id = ? AND mes = ? ORDER BY trabajador', pid, mes),
      trabajadores: await db.all("SELECT * FROM sst_trabajador WHERE proyecto_id = ? AND (ingreso IS NULL OR ingreso <= ?) AND (retiro IS NULL OR retiro >= ?) ORDER BY nombre", pid, fin, ini),
      soportes: await db.all(`SELECT tabla, nombre, descripcion, categoria, fecha FROM adjunto WHERE proyecto_id = ? AND tabla LIKE 'sst%' AND fecha BETWEEN ? AND ? ORDER BY tabla, fecha`, pid, ini, fin) },
    pmt: await db.all('SELECT * FROM pmt WHERE proyecto_id = ? AND (desde IS NULL OR desde <= ?) AND (hasta IS NULL OR hasta >= ?) ORDER BY frente', pid, fin, ini),
    amb: await ambientalMes(pid, ini, fin, del),
    gs: await gestionSocial(pid, mes, ini, fin, corte),
    social: social.filter(s => enMes(s.fecha)), pqrs_abiertas: pqrs, pqrs_vencidas: pqrs.filter(s => s.plazo && s.plazo < corte),
    vencimientos: r.vencimientos,
    director: (await db.get("SELECT nombre FROM usuario WHERE rol = 'director' AND activo = 1 ORDER BY id"))?.nombre || 'Director de interventoría',
    // Datos adicionales para la guía del informe del interventor y/o contratista
    numero: (() => { const ob = r.contratos.find(c => c.tipo === 'obra') || r.contratos[0]; const i = ob?.fecha_inicio; return i ? Math.max(1, (+mes.slice(0, 4) - +i.slice(0, 4)) * 12 + (+mes.slice(5, 7) - +i.slice(5, 7)) + 1) : +mes.slice(5, 7); })(),
    capturas: await db.all(`SELECT a.*, i.codigo, i.descripcion item, i.unidad FROM avance a LEFT JOIN item i ON i.id = a.item_id WHERE a.proyecto_id = ? AND a.estado <> 'Rechazado' AND a.fecha BETWEEN ? AND ? ORDER BY a.fecha`, pid, ini, fin),
    bitacora: await del('bitacora'), ensayos: await del('ensayo'), correspondencia: await del('correspondencia'),
    personal: await db.all('SELECT * FROM personal WHERE proyecto_id = ? ORDER BY id', pid),
    gastos: await db.all('SELECT g.* FROM gasto g JOIN contrato c ON c.id = g.contrato_id WHERE c.proyecto_id = ? AND g.fecha BETWEEN ? AND ?', pid, ini, fin),
    items_np: await db.all("SELECT i.* FROM item i JOIN contrato c ON c.id = i.contrato_id WHERE c.proyecto_id = ? AND i.otrosi_id IS NOT NULL", pid),
    anexos: await (async () => {
      const a = await db.all("SELECT tabla, registro_id, nombre, descripcion, tipo_mime, fecha FROM adjunto WHERE proyecto_id = ? AND categoria <> 'Foto' AND fecha BETWEEN ? AND ?", pid, ini, fin), g = {};
      for (const x of a) { const t = `${x.nombre || ''} ${x.descripcion || ''}`, k = /\.(dwg|dxf|kmz|kml)$/i.test(x.nombre || '') || /plano/i.test(t) || ['tramo', 'alineamiento'].includes(x.tabla) ? 'planos' : /recibo/i.test(t) ? 'recibo' : ['pqrs', 'reunion', 'acta_vecindad', 'mano_obra', 'capacitacion', 'afectacion', 'encuesta', 'veeduria'].includes(x.tabla) || /reuni|comit/i.test(t) ? 'social' : ['ensayo', 'social', 'correspondencia', 'bitacora'].includes(x.tabla) ? x.tabla : ['ambiental', 'pmt', ...AMB].includes(x.tabla) ? 'ambiental' : 'otros'; (g[k] = g[k] || []).push(x); }
      return g; })(),
    // Registro fotográfico del mes (hasta 24 fotos JPEG o PNG)
    fotos: await Promise.all((await db.all(`SELECT * FROM adjunto WHERE proyecto_id = ? AND categoria = 'Foto' AND tipo_mime IN ('image/jpeg', 'image/png') AND fecha BETWEEN ? AND ? ORDER BY fecha, id LIMIT 24`, pid, ini, fin))
      .map(async a => ({ ...a, datos: Buffer.from((await db.get('SELECT datos FROM adjunto_dato WHERE adjunto_id = ?', a.id)).datos) }))) };
}

// Informe SST mensual del contratista: datos del mes y estado de los 22 anexos
const ANEXOS_SST = ['Afiliaciones', 'Exámenes médicos ocupacionales', 'Inducciones y evaluaciones', 'Entrega de EPP y dotación', 'Notificación de riesgos', 'Exámenes de retiro', 'Paz y salvos', 'Preoperacionales', 'Charlas y capacitaciones', 'Inspecciones', 'Licencia de salud ocupacional', 'Certificación de pagos (revisor fiscal)', 'Planillas de seguridad social del mes', 'Actas COPASST y COCOLA', 'Certificado ARL de accidentalidad', 'Personal administrativo', 'Matriz de peligros', 'Plan de trabajo anual SST', 'Plan de emergencias', 'Inspecciones programadas y gestión documental', 'Evidencia fotográfica', 'Aprobación del informe por la interventoría'];
// Qué tablas soportan cada anexo además de sst_documento (número de anexo → tablas)
const FUENTE_ANEXO = { 1: ['sst_trabajador'], 2: ['sst_trabajador'], 3: ['sst_capacitacion'], 4: ['sst_epp'], 5: ['sst_capacitacion'], 6: ['sst_trabajador'], 7: ['sst_trabajador'], 8: ['sst_equipo'], 9: ['sst_capacitacion'], 10: ['sst_inspeccion', 'sst'],
  13: ['sst_seguridad_social'], 14: ['sst_actividad'], 15: ['sst_investigacion'], 17: ['sst_peligro'], 18: ['sst_actividad'], 19: ['sst_emergencia'], 20: ['sst_permiso', 'sst_investigacion', 'sst_inspeccion'] };
async function informeSST(pid, mes) {
  const d = await informeMensual(pid, mes), { ini, fin } = d;
  const del = t => db.all(`SELECT * FROM ${t} WHERE proyecto_id = ? AND fecha BETWEEN ? AND ? ORDER BY fecha`, pid, ini, fin);
  d.sst_anexos.equipos = await db.all('SELECT * FROM sst_equipo WHERE proyecto_id = ? ORDER BY equipo', pid);
  d.sst_anexos.actividades = await del('sst_actividad');
  d.sst_anexos.cronograma = d.sst_anexos.actividades.filter(a => a.tipo === 'Cronograma SST');
  d.sst_meses = indicadoresSST(await db.all('SELECT * FROM sst_mes WHERE proyecto_id = ? AND mes <= ? ORDER BY mes', pid, mes)).slice(-12);
  d.sst_mes_datos = await db.get('SELECT * FROM sst_mes WHERE proyecto_id = ? AND mes = ?', pid, mes);
  d.personal_sst = (await db.all('SELECT * FROM personal WHERE proyecto_id = ?', pid)).filter(x => /sst|siso|seguridad/i.test(x.cargo || ''));
  const docs = await db.all('SELECT * FROM sst_documento WHERE proyecto_id = ? AND mes = ?', pid, mes);
  const adj = await db.all(`SELECT tabla, registro_id, categoria FROM adjunto WHERE proyecto_id = ? AND tabla LIKE 'sst%' AND fecha BETWEEN ? AND ?`, pid, ini, fin);
  const adjDoc = await db.all(`SELECT a.registro_id FROM adjunto a JOIN sst_documento s ON s.id = a.registro_id WHERE a.tabla = 'sst_documento' AND s.proyecto_id = ? AND s.mes = ?`, pid, mes);
  d.anexos_sst = ANEXOS_SST.map((nombre, i) => {
    const n = i + 1, propios = docs.filter(x => parseInt(x.anexo) === n);
    const soportes = adjDoc.filter(a => propios.some(x => x.id === a.registro_id)).length + adj.filter(a => (FUENTE_ANEXO[n] || []).includes(a.tabla)).length
      + (n === 21 ? d.fotos.filter(f => /^sst/.test(f.tabla || '')).length : 0);
    return { n, nombre, soportes, estado: propios.some(x => x.estado === 'No aplica') ? 'No aplica' : soportes ? 'Cargado' : 'Pendiente', descripcion: propios.map(x => x.descripcion).filter(Boolean).join('; ') };
  });
  return d;
}

// ---------- Correo (Gmail por IMAP) ----------
// La IA del correo usa la lectura de documentos con Gemini (proveedores.js) y la clave del asistente (clave_gemini)
async function analizarCorreo(c) {
  const cfg = configAsistente();
  if (!cfg.clave_gemini) return null;
  const partes = [{ text: `Correo electrónico recibido por la interventoría.\nFecha: ${c.fecha}\nDe: ${c.de}\nPara: ${c.para}\nAsunto: ${c.asunto}\n\n${String(c.texto).slice(0, 30000)}` }];
  // Los adjuntos que Gemini lee directamente (PDF e imágenes), hasta 3 y 10 MB
  for (const a of c.adjuntos.filter(a => /^application\/pdf$|^image\/(jpeg|png|webp)$/.test(a.mime) && a.contenido.length < 10e6).slice(0, 3))
    partes.push({ text: `Adjunto "${a.nombre}":` }, { inlineData: { mimeType: a.mime, data: a.contenido.toString('base64') } });
  const d = await prov.leerDocumentoGemini(cfg, partes, INSTRUCCION_DOCUMENTO + '\nEs un correo electrónico: clasifícalo normalmente como "oficio" (sentido Recibida); si no fija plazo de respuesta y es un derecho de petición, usa 15 días hábiles.', ESQUEMA_DOCUMENTO);
  const o = d.oficio || {}, req = d.tipo === 'oficio' ? !!o.requiere_respuesta : null;
  const plazo = req ? diasHabiles(o.fecha || c.fecha, o.plazo_dias || 15) : null;
  const venc = (d.vencimientos || []).filter(v => v.descripcion).map(v => ({ fecha: v.fecha || null, descripcion: v.descripcion, responsable: v.responsable || null, tipo: 'Correspondencia' }));
  if (plazo && !venc.some(v => v.fecha === plazo)) venc.unshift({ fecha: plazo, descripcion: `Responder: ${c.asunto}`.slice(0, 300), responsable: null, tipo: 'Respuesta' });
  return { resumen: [d.resumen, d.observaciones].filter(Boolean).join(' · '), requiere_respuesta: req == null ? null : req ? 'Sí' : 'No', plazo, radicado: o.radicado || null, vencimientos: venc };
}
const correo = crearCorreo({ db, datos: DATOS, auditar, analizar: analizarCorreo });

// ---------- HTTP ----------
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function enviar(res, codigo, cuerpo, tipo = 'application/json; charset=utf-8') {
  res.writeHead(codigo, { 'Content-Type': tipo, 'Cache-Control': 'no-store' });
  res.end(typeof cuerpo === 'string' || Buffer.isBuffer(cuerpo) ? cuerpo : JSON.stringify(cuerpo));
}
// Tamaño máximo del cuerpo: 5 MB en general; 30 MB donde llega un archivo en base64 (20 MB de archivo ≈ 27 MB en base64)
const MAX_CUERPO = 5 * 1024 * 1024, MAX_ARCHIVO = 30 * 1024 * 1024;
const RUTAS_ARCHIVO = /^\/api\/(adjunto|asistente\/documento|xlsx\/importar)(\/|$)/;
function leerCuerpo(req) {
  const MAX = RUTAS_ARCHIVO.test(req.url.split('?')[0]) ? MAX_ARCHIVO : MAX_CUERPO;
  return new Promise((ok, mal) => {
    const trozos = []; let n = 0, excedido = false;
    req.on('data', d => { if (excedido) return; n += d.length; if (n > MAX) { excedido = true; trozos.length = 0; return mal(new Rechazo(413, 'La petición es demasiado grande')); } trozos.push(d); });
    req.on('end', () => { if (excedido) return; const s = Buffer.concat(trozos).toString('utf8'); try { ok(s ? JSON.parse(s) : {}); } catch { mal(new Rechazo(400, 'El cuerpo de la petición no es JSON válido')); } });
    req.on('error', mal);
  });
}
function limpiar(tabla, datos) {
  const out = {};
  for (const [k, v] of Object.entries(datos)) if (k !== 'id' && columnas[tabla].includes(k)) out[k] = v === '' ? null : v;
  return out;
}
function csv(filas, cols) {
  const esc = v => { const s = v == null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '﻿sep=;\r\n' + [cols.map(c => c[1]).join(';'), ...filas.map(f => cols.map(c => esc(f[c[0]])).join(';'))].join('\r\n');
}

async function api(req, res, url) {
  const partes = url.pathname.split('/').filter(Boolean).slice(1); // sin 'api'
  const q = Object.fromEntries(url.searchParams);
  const [r0, r1, r2_, r3] = partes;
  const u = await usuarioDe(req);

  if (r0 === 'usuarios' && req.method === 'GET') return enviar(res, 200, { usuarios: await db.all('SELECT * FROM usuario WHERE activo = 1 ORDER BY id'), roles: ROLES, permisos: PERMISOS, estados_acta: ESTADOS_ACTA, bloqueo: BLOQUEO });
  // Entrar con el correo (Gmail) registrado en un usuario
  if (r0 === 'entrar' && req.method === 'POST') {
    const correo = String((await leerCuerpo(req)).correo || '').trim().toLowerCase();
    const yo = correo && (await db.get('SELECT * FROM usuario WHERE activo = 1 AND lower(correo) = ?', correo));
    if (!yo) throw new Rechazo(404, 'Ese correo no está registrado. Pídale al director que lo agregue en Usuarios.');
    return enviar(res, 200, yo);
  }
  if (r0 === 'auditoria' && req.method === 'GET') return enviar(res, 200, await db.all('SELECT * FROM auditoria ORDER BY id DESC LIMIT ?', Number(q.limite) || 200));
  if (r0 === 'asistente' && r1 === 'config' && req.method === 'GET') {
    // Nunca se devuelven las claves, solo si están puestas
    const c = configAsistente();
    return enviar(res, 200, { configurado: asistenteListo(c), proveedor: c.proveedor, nombre: NOMBRE_PROVEEDOR[c.proveedor], tiene_clave: !!c.clave, tiene_clave_gemini: !!c.clave_gemini,
      modelo_gemini: c.modelo_gemini || 'gemini-flash-latest', url_ollama: c.url_ollama || 'http://127.0.0.1:11434', modelo_ollama: c.modelo_ollama || 'qwen2.5:7b' });
  }
  if (r0 === 'asistente' && r1 === 'config' && req.method === 'POST') {
    exigir(u, 'asistente');
    const b = await leerCuerpo(req), c = fs.existsSync(ARCH_ASISTENTE) ? JSON.parse(fs.readFileSync(ARCH_ASISTENTE, 'utf8')) : {};
    if (b.proveedor != null && !PROVEEDORES.includes(b.proveedor)) throw new Rechazo(400, 'Proveedor desconocido');
    // Las claves vacías no borran las guardadas
    for (const k of ['proveedor', 'clave', 'clave_gemini', 'modelo_gemini', 'url_ollama', 'modelo_ollama']) if (b[k] != null && String(b[k]).trim() !== '') c[k] = String(b[k]).trim();
    fs.writeFileSync(ARCH_ASISTENTE, JSON.stringify(c));
    await auditar(u, 'asistente', null, 'configurar', null);
    return enviar(res, 200, { ok: true });
  }
  // Cualquier documento (PDF, foto, Word, Excel, CSV) → Gemini lo clasifica y propone los registros a crear (no guarda nada)
  if (r0 === 'asistente' && r1 === 'documento' && req.method === 'POST') {
    if (!u) throw new Rechazo(401, 'Elija un usuario para hacer cambios');
    const b = await leerCuerpo(req);
    const partes = await partesDocumento(b);
    // Ítems del presupuesto de obra, para que la IA pueda reconocer apuntes de ejecución
    const ob = await db.get("SELECT id FROM contrato WHERE proyecto_id = ? AND tipo = 'obra'", Number(r2_));
    if (ob) partes.push({ text: 'Ítems del presupuesto de obra (código | descripción | unidad):\n' + (await db.all('SELECT codigo, descripcion, unidad FROM item WHERE contrato_id = ? AND tipo = 1 ORDER BY orden, id', ob.id)).map(i => `${i.codigo || ''} | ${i.descripcion} | ${i.unidad || ''}`).join('\n') });
    let d;
    try {
      // 1) qué es el documento; 2) sus datos con el esquema de ese tipo (la lista de datos es obligatoria)
      const cfg = configAsistente(), P = ESQUEMA_DOCUMENTO.properties;
      d = await prov.leerDocumentoGemini(cfg, partes, INSTRUCCION_DOCUMENTO + '\n\nEn este paso responde solo tipo, resumen, observaciones y contrato.', { type: 'object', required: ['tipo', 'resumen'], properties: { tipo: P.tipo, resumen: P.resumen, observaciones: P.observaciones, contrato: P.contrato } });
      const clave = { poliza: 'poliza', oficio: 'oficio', ensayo: 'ensayos', factura: 'factura', otrosi: 'otrosi', reunion: 'reunion', presupuesto: 'items', personal: 'personas', avance: 'avances' }[d.tipo];
      const datos = await prov.leerDocumentoGemini(cfg, partes, INSTRUCCION_DOCUMENTO + `\n\nEl documento es de tipo "${d.tipo}". Extrae TODOS sus datos${clave ? ` en "${clave}" (todos los elementos, uno por fila o renglón)` : ''} y las fechas límite en "vencimientos".`,
        { type: 'object', required: clave ? [clave] : [], properties: { ...(clave ? { [clave]: P[clave] } : {}), vencimientos: P.vencimientos } });
      Object.assign(d, datos);
    }
    catch (e) { if (e instanceof prov.ErrorProveedor) throw new Rechazo(e.codigo, e.message); throw e; }
    return enviar(res, 200, { tipo: d.tipo, resumen: d.resumen, observaciones: d.observaciones, propuestas: await propuestasDocumento(Number(r2_), d, b.nombre, u) });
  }
  if (r0 === 'asistente' && req.method === 'POST') return asistenteSSE(req, res, Number(r1), u);
  // ---------- Integraciones ----------
  const archivo = (nombre, tipo, buf) => { res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`); return enviar(res, 200, Buffer.from(buf), tipo); };
  const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (r0 === 'xlsx' && r1 === 'presupuesto') { const d = await presupuesto(Number(r2_)); return archivo(`Presupuesto_${d.contrato.tipo}.xlsx`, XLSX, await integ.xlsxPresupuesto(d)); }
  if (r0 === 'xlsx' && r1 === 'acta') { const d = await detalleActa(Number(r2_)); return archivo(`${d.contrato.tipo === 'obra' ? 'Acta' : 'Cuenta'}_${d.acta.numero}.xlsx`, XLSX, await integ.xlsxActa(d)); }
  if (r0 === 'docx' && r1 === 'informe-social') { const d = await informeMensual(Number(r2_), q.mes); d.fichas_social = await db.all('SELECT * FROM ficha_social ORDER BY id'); d.gs.social_mes = d.social; return archivo(`Informe_social_${d.mes}.docx`, DOCX, await informeSocial(d)); }
  if (r0 === 'docx' && r1 === 'informe-sst') { const d = await informeSST(Number(r2_), q.mes); return archivo(`Informe_SST_${d.mes}.docx`, DOCX, await informeSSTFormato(d)); }
  if (r0 === 'docx' && r1 === 'informe') { const d = await informeMensual(Number(r2_), q.mes); return archivo(`Informe_mensual_${d.mes}.docx`, DOCX, await informeFormato(d)); }
  if (r0 === 'docx' && r1 === 'informe-ambiental') { const d = await informeMensual(Number(r2_), q.mes); return archivo(`Informe_ambiental_${d.mes}.docx`, DOCX, await informeAmbiental(d)); }
  if (r0 === 'requisicion' && req.method === 'GET') return enviar(res, 200, await detalleRQ(Number(r1)));
  if (r0 === 'xlsx' && r1 === 'requisicion') { const d = await detalleRQ(Number(r2_)); return archivo(`RQ_${d.requisicion.numero}.xlsx`, XLSX, await integ.xlsxRequisicion(d)); }
  if (r0 === 'docx' && r1 === 'requisicion') { const d = await detalleRQ(Number(r2_)); return archivo(`RQ_${d.requisicion.numero}.docx`, DOCX, await integ.docxRequisicion(d)); }
  if (r0 === 'docx' && r1 === 'acta') { const d = await detalleActa(Number(r2_)); return archivo(`${d.contrato.tipo === 'obra' ? 'Acta' : 'Cuenta'}_${d.acta.numero}.docx`, DOCX, await integ.docxActa(d)); }
  if (r0 === 'xlsx' && r1 === 'importar' && req.method === 'POST') {
    exigir(u, 'item');
    const b = await leerCuerpo(req), cid = Number(r2_);
    const filas = await integ.leerPresupuestoXlsx(Buffer.from(b.archivo || '', 'base64'));
    let orden = (await db.get('SELECT COALESCE(MAX(orden), 0) m FROM item WHERE contrato_id = ?', cid)).m, padre = null;
    for (const f of filas) {
      const cap = !f.unidad && !f.cantidad;
      const r = await db.run('INSERT INTO item (contrato_id, padre_id, tipo, codigo, descripcion, unidad, cantidad, vr_unitario, orden) VALUES (?,?,?,?,?,?,?,?,?)',
        cid, cap ? null : padre, cap ? 0 : 1, f.codigo || null, f.descripcion, f.unidad || null, f.cantidad, f.vr_unitario, ++orden);
      if (cap) padre = r.id;
    }
    await auditar(u, 'item', null, 'importar-excel', { contrato_id: cid, filas: filas.length });
    return enviar(res, 200, { ok: true, filas: filas.length });
  }
  // Microsoft Project: importar (reemplaza el programa) y exportar
  if (r0 === 'project' && req.method === 'POST') {
    exigir(u, 'tarea');
    const pid = Number(r1), tareas = integ.leerProject((await leerCuerpo(req)).xml || '');
    for (const t of await db.all('SELECT id FROM tarea WHERE proyecto_id = ?', pid)) await db.run('DELETE FROM tarea WHERE id = ?', t.id);
    let orden = 0;
    for (const t of tareas) await db.run('INSERT INTO tarea (proyecto_id, wbs, nombre, nivel, inicio, fin, avance_real, resumen, hito, orden) VALUES (?,?,?,?,?,?,?,?,?,?)',
      pid, t.wbs, t.nombre, t.nivel, t.inicio, t.fin, t.avance_real, t.resumen, t.hito, ++orden);
    await auditar(u, 'tarea', null, 'importar-project', { tareas: tareas.length });
    return enviar(res, 200, { ok: true, tareas: tareas.length });
  }
  if (r0 === 'project' && r2_ === 'xml') {
    const p = await db.get('SELECT nombre FROM proyecto WHERE id = ?', Number(r1));
    return archivo('Programa_SIGI.xml', 'application/xml', integ.xmlProject(p?.nombre, await db.all('SELECT * FROM tarea WHERE proyecto_id = ? ORDER BY orden, id', Number(r1))));
  }
  if (r0 === 'calendario') {
    const pid = Number(r1), fecha = f => (/^\d{4}-\d{2}-\d{2}$/.test(f || '') ? f : null);
    if (r2_ === 'ics') {
      const p = await db.get('SELECT nombre FROM proyecto WHERE id = ?', pid);
      res.setHeader('Content-Disposition', `attachment; filename="calendario-sigi-${pid}.ics"`);
      return enviar(res, 200, ics('SIGI Pro · ' + (p?.nombre || 'Proyecto'), await calendario(pid, fecha(q.desde) || '1900-01-01', fecha(q.hasta) || '2999-12-31')), 'text/calendar; charset=utf-8');
    }
    return enviar(res, 200, await calendario(pid, fecha(q.desde) || hoyISO().slice(0, 8) + '01', fecha(q.hasta) || sumarDias(hoyISO(), 60)));
  }
  if (r0 === 'indicadores') return enviar(res, 200, await indicadores(Number(r1)));
  if (r0 === 'programa') return enviar(res, 200, await avanceFisico(Number(r1), q.fecha || new Date().toISOString().slice(0, 10)));
  // Autodesk (LandXML de Civil 3D / InfraWorks) y avance en el plano
  if (r0 === 'landxml' && req.method === 'POST') {
    exigir(u, 'alineamiento');
    const pid = Number(r1), alins = integ.leerLandXML((await leerCuerpo(req)).xml || '');
    for (const a of alins) await db.run('INSERT INTO alineamiento (proyecto_id, nombre, abs_ini, longitud, puntos) VALUES (?,?,?,?,?)', pid, a.nombre, a.abs_ini, a.longitud, JSON.stringify(a.puntos));
    await auditar(u, 'alineamiento', null, 'importar-landxml', { alineamientos: alins.map(a => a.nombre) });
    return enviar(res, 200, { ok: true, alineamientos: alins.length });
  }
  if (r0 === 'plano') {
    const alineamientos = (await db.all('SELECT * FROM alineamiento WHERE proyecto_id = ? ORDER BY id', Number(r1))).map(a => ({ ...a, puntos: JSON.parse(a.puntos || '[]') }));
    return enviar(res, 200, { alineamientos, tramos: await db.all('SELECT * FROM tramo WHERE proyecto_id = ? ORDER BY alineamiento_id, abs_ini', Number(r1)),
      avances: await db.all(`SELECT a.*, i.codigo, i.descripcion item, i.unidad FROM avance a LEFT JOIN item i ON i.id = a.item_id WHERE a.proyecto_id = ? AND a.estado <> 'Rechazado' AND a.abs_ini IS NOT NULL ORDER BY a.fecha`, Number(r1)) });
  }
  // Power BI: /api/bi/:proyecto/:conjunto.csv o .json  (en Power BI: Obtener datos → Web)
  if (r0 === 'bi') {
    const pid = Number(r1), [conjunto, ext] = String(r2_ || '').split('.');
    const r = await resumen(pid);
    const conjuntos = {
      actas: () => r.contratos.flatMap(c => c.actas.map(a => ({ contrato: c.tipo, numero: a.numero, desde: a.desde, hasta: a.hasta, fecha: a.fecha, estado: a.estado, valor: a.valor, acumulado: a.acumulado, valor_contrato: c.valor_vigente }))),
      contratos: () => r.contratos.map(c => ({ tipo: c.tipo, numero: c.numero, contratista: c.contratista, valor_original: c.valor, adiciones: c.adiciones, valor_vigente: c.valor_vigente, presupuesto: c.presupuesto, ejecutado: c.ejecutado, gastado: c.gastado, fecha_inicio: c.fecha_inicio, fecha_fin_vigente: c.fecha_fin_vigente })),
      items: async () => { const out = []; for (const c of r.contratos) { const ult = c.actas[c.actas.length - 1]; const d = ult ? await detalleActa(ult.id) : null;
        for (const f of (d ? d.filas : (await presupuesto(c.id)).items).filter(x => x.tipo === 1)) out.push({ contrato: c.tipo, codigo: f.codigo, descripcion: f.descripcion, unidad: f.unidad, cantidad: f.cantidad, vr_unitario: f.vr_unitario, acumulado: f.acumulado || 0, saldo: f.saldo ?? f.cantidad, pct: f.pct || 0 }); } return out; },
      gastos: () => db.all('SELECT g.fecha, g.descripcion, g.proveedor, g.valor, g.pagado FROM gasto g JOIN contrato c ON c.id = g.contrato_id WHERE c.proyecto_id = ?', pid),
      programa: async () => (await db.all('SELECT * FROM tarea WHERE proyecto_id = ?', pid)).map(t => ({ wbs: t.wbs, nombre: t.nombre, inicio: t.inicio, fin: t.fin, avance_real: t.avance_real, programado: integ.programado(t, r.hoy) })),
      tramos: () => db.all('SELECT nombre, abs_ini, abs_fin, actividad, avance, fecha FROM tramo WHERE proyecto_id = ?', pid),
      curva_s: async () => (await indicadores(pid)).curva,
      valor_ganado: async () => { const x = await indicadores(pid); return [{ fecha: x.hoy, ...x.evm, ...Object.fromEntries(Object.entries(x.plazo).map(([k, v]) => ['plazo_' + k, v])) }]; },
      capitulos: async () => (await indicadores(pid)).capitulos,
      capturas_mes: async () => (await indicadores(pid)).capturas_mes,
      polizas: () => db.all('SELECT contrato, aseguradora, numero, amparo, valor, desde, hasta, estado FROM poliza WHERE proyecto_id = ?', pid),
      alertas: () => avisos(pid),
      sst: () => db.all('SELECT * FROM sst WHERE proyecto_id = ?', pid), sst_indicadores: async () => indicadoresSST(await db.all('SELECT * FROM sst_mes WHERE proyecto_id = ? ORDER BY mes', pid)), pmt: () => db.all('SELECT * FROM pmt WHERE proyecto_id = ?', pid), ambiental: () => db.all('SELECT * FROM ambiental WHERE proyecto_id = ?', pid), social: () => db.all('SELECT * FROM social WHERE proyecto_id = ?', pid),
    };
    if (!conjuntos[conjunto]) return enviar(res, 200, { conjuntos: Object.keys(conjuntos).map(k => `/api/bi/${pid}/${k}.csv`) });
    const filas = await conjuntos[conjunto]();
    return ext === 'json' ? enviar(res, 200, filas) : enviar(res, 200, integ.csv(filas), 'text/csv; charset=utf-8');
  }
  if (r0 === 'amb-catalogo' && req.method === 'POST') {
    exigir(u, 'amb_ficha');
    const r = await cargarPaga(db, Number(r1));
    await auditar(u, 'amb_ficha', null, 'catálogo PAGA', r);
    return enviar(res, 200, r);
  }
  if (r0 === 'sst-indicadores') return enviar(res, 200, indicadoresSST(await db.all('SELECT * FROM sst_mes WHERE proyecto_id = ? ORDER BY mes', Number(r1))));
  // ---------- Adjuntos y registro fotográfico ----------
  if (r0 === 'adjuntos') {
    const f = ['proyecto_id = ?'], a = [Number(r1)];
    for (const k of ['tabla', 'registro_id', 'categoria']) if (q[k]) { f.push(k + ' = ?'); a.push(k === 'registro_id' ? Number(q[k]) : q[k]); }
    if (q.mes) { f.push('substr(fecha, 1, 7) = ?'); a.push(q.mes); }
    return enviar(res, 200, await db.all(`SELECT * FROM adjunto WHERE ${f.join(' AND ')} ORDER BY fecha DESC, id DESC`, ...a));
  }
  // Cuántos adjuntos tiene cada registro de una tabla: { registro_id: n }
  if (r0 === 'adjuntos-conteo') return enviar(res, 200, Object.fromEntries((await db.all('SELECT registro_id, COUNT(*) n FROM adjunto WHERE proyecto_id = ? AND tabla = ? GROUP BY registro_id', Number(r1), q.tabla)).map(r => [r.registro_id, r.n])));
  if (r0 === 'adjunto' && r2_ === 'archivo') {
    const a = await db.get('SELECT * FROM adjunto WHERE id = ?', Number(r1)), d = await db.get('SELECT datos FROM adjunto_dato WHERE adjunto_id = ?', Number(r1));
    if (!a || !d) return enviar(res, 404, { error: 'No existe' });
    // Solo se muestran en la app los tipos inofensivos; lo demás (HTML, SVG, XML...) se descarga, para que un adjunto
    // no pueda ejecutar código con el origen de la app (XSS almacenado). Además nosniff y CSP sandbox.
    const mime = String(a.tipo_mime || ''), seguro = /^(image\/(jpeg|png|gif|webp|bmp)|application\/pdf|text\/plain|video\/(mp4|webm)|audio\/[\w.+-]+)$/i.test(mime);
    res.setHeader('Content-Disposition', `${q.descargar || !seguro ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(a.nombre || 'archivo')}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!/^application\/pdf$/i.test(mime)) res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self'; media-src 'self'");
    return enviar(res, 200, Buffer.from(d.datos), seguro ? mime : 'application/octet-stream');
  }
  if (r0 === 'adjunto' && req.method === 'POST') {
    const b = await leerCuerpo(req);
    // Quien puede modificar el registro puede adjuntarle archivos; el registro fotográfico general, quien lleve bitácora
    exigir(u, !b.tabla || b.tabla === 'proyecto' ? 'bitacora' : b.tabla === 'acta' ? 'acta_item' : b.tabla);
    if (b.tabla === 'acta' && b.registro_id) await actaEditable(Number(b.registro_id));
    const datos = Buffer.from(String(b.datos || ''), 'base64');
    if (!datos.length) throw new Rechazo(400, 'El archivo está vacío');
    if (datos.length > 20 * 1024 * 1024) throw new Rechazo(400, 'El archivo pasa de 20 MB');
    if (b.tipo_mime && !/^[\w.+-]+\/[\w.+-]+$/.test(String(b.tipo_mime))) throw new Rechazo(400, 'Tipo de archivo inválido');
    if (!Number.isInteger(Number(b.proyecto_id)) || !(await db.get('SELECT id FROM proyecto WHERE id = ?', Number(b.proyecto_id)))) throw new Rechazo(400, 'Proyecto inexistente');
    const r = await db.run(`INSERT INTO adjunto (proyecto_id, tabla, registro_id, categoria, nombre, tipo_mime, tamano, fecha, frente, abscisa, punto, descripcion, lat, lon, usuario, creado)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, Number(b.proyecto_id), b.tabla || 'proyecto', b.registro_id ? Number(b.registro_id) : null,
      b.categoria || (/^image\//.test(b.tipo_mime) ? 'Foto' : 'Documento'), b.nombre, b.tipo_mime, datos.length, b.fecha || new Date().toISOString().slice(0, 10),
      b.frente || null, b.abscisa || null, b.punto || null, b.descripcion || null, b.lat ?? null, b.lon ?? null, u.nombre, new Date().toISOString());
    await db.run('INSERT INTO adjunto_dato (adjunto_id, datos) VALUES (?, ?)', r.id, datos);
    await auditar(u, 'adjunto', r.id, 'crear', { tabla: b.tabla, registro_id: b.registro_id, nombre: b.nombre, tamano: datos.length });
    return enviar(res, 200, await db.get('SELECT * FROM adjunto WHERE id = ?', r.id));
  }
  if (r0 === 'avances') return enviar(res, 200, await db.all(`SELECT a.*, i.codigo, i.descripcion item, i.unidad, i.cantidad cant_contratada, ac.numero acta_numero, ac.estado acta_estado,
    (SELECT COUNT(*) FROM adjunto f WHERE f.tabla = 'avance' AND f.registro_id = a.id) fotos
    FROM avance a LEFT JOIN item i ON i.id = a.item_id LEFT JOIN acta ac ON ac.id = a.acta_id WHERE a.proyecto_id = ? ORDER BY a.fecha DESC, a.id DESC`, Number(r1)));
  // Correo (Gmail): solo el director configura; la contraseña nunca sale por la API
  if (r0 === 'correo') {
    if (r1 === 'config' && req.method === 'GET') { exigir(u, 'correo'); return enviar(res, 200, { ...correo.publica(), ia: !!configAsistente().clave_gemini }); }
    if (r1 === 'estado') return enviar(res, 200, correo.publica().estado);
    if (req.method !== 'GET' && r1 !== 'vencimientos') exigir(u, 'correo');
    if (r1 === 'config' && req.method === 'POST') { const b = await leerCuerpo(req); correo.guardar(b); await auditar(u, 'correo', null, 'configurar', { correo: b.correo, carpeta: b.carpeta, minutos: b.minutos }); return enviar(res, 200, correo.publica()); }
    if (r1 === 'probar' && req.method === 'POST') {
      const b = await leerCuerpo(req);
      try { return enviar(res, 200, await correo.probar(correo.conClave(b))); }
      catch (e) { return enviar(res, 200, { ok: false, error: /auth|credentials|Invalid/i.test(e.responseText || e.message) ? 'Gmail rechazó el usuario o la contraseña de aplicación' : e.message }); }
    }
    if (r1 === 'revisar' && req.method === 'POST') return enviar(res, 200, await correo.revisar());
    // Crear los vencimientos que sugirió la IA para una correspondencia (confirmación del usuario)
    if (r1 === 'vencimientos' && req.method === 'POST') {
      exigir(u, 'vencimiento');
      const c = await db.get('SELECT * FROM correspondencia WHERE id = ?', Number(r2_));
      if (!c || !c.vencimientos_ia) throw new Rechazo(404, 'No hay vencimientos sugeridos');
      const ids = [];
      for (const v of JSON.parse(c.vencimientos_ia)) {
        const r = await db.run('INSERT INTO vencimiento (proyecto_id, fecha, tipo, descripcion, responsable, estado, fuente) VALUES (?,?,?,?,?,?,?)', c.proyecto_id, v.fecha || null, v.tipo || 'Respuesta', v.descripcion, v.responsable || null, 'Pendiente', `Correo: ${c.asunto || ''}`.slice(0, 200));
        ids.push(r.id); await auditar(u, 'vencimiento', r.id, 'crear', v);
      }
      await db.run('UPDATE correspondencia SET vencimientos_ia = NULL WHERE id = ?', c.id);
      return enviar(res, 200, { ok: true, creados: ids.length });
    }
  }
  if (r0 === 'buscar') return enviar(res, 200, await buscar(Number(r1), q.q));
  if (r0 === 'avisos') return enviar(res, 200, await avisos(Number(r1)));

  // Sincronización
  if (r0 === 'sync' && req.method === 'GET') { const cfg = db.config(); return enviar(res, 200, { ...db.estado, url: cfg?.url || null }); }
  if (r0 === 'sync' && req.method !== 'GET') exigir(u, 'sync');
  if (r0 === 't' && r1 === 'alineamiento' && req.method === 'GET') {
    // Sin la geometría (puede ser grande); se lee completa en /api/plano
    return enviar(res, 200, await db.all('SELECT id, proyecto_id, nombre, abs_ini, longitud FROM alineamiento WHERE proyecto_id = ?', Number(q.proyecto_id)));
  }
  if (r0 === 'sync' && r1 === 'probar') { const b = await leerCuerpo(req); return enviar(res, 200, await Base.probar(b.url, b.token)); }
  if (r0 === 'sync' && r1 === 'activar') { const b = await leerCuerpo(req); const r = await db.activarNube(b.url, b.token, ESQUEMA); await iniciar(); await auditar(u, 'sync', null, 'activar', { url: b.url }); return enviar(res, 200, r); }
  if (r0 === 'sync' && r1 === 'desactivar') { await db.desactivarNube(); await iniciar(); await auditar(u, 'sync', null, 'desactivar', null); return enviar(res, 200, { ok: true }); }
  if (r0 === 'sync' && r1 === 'ahora') { await db.sincronizar(); return enviar(res, 200, db.estado); }

  if (r0 === 'resumen') return enviar(res, 200, await resumen(Number(r1)));
  if (r0 === 'presupuesto') return enviar(res, 200, await presupuesto(Number(r1)));
  if (r0 === 'costos') return enviar(res, 200, await costos(Number(r1)));
  if (r0 === 'memoria') return enviar(res, 200, await memoria(Number(r1), q.buscar));

  if (r0 === 'acta' && req.method === 'GET' && r2_ === 'csv') {
    const d = await detalleActa(Number(r1));
    const cols = [['codigo', 'Código'], ['descripcion', 'Descripción'], ['unidad', 'Und'], ['cantidad', 'Cant. contratada'], ['vr_unitario', 'Vr. unitario'],
      ['anterior', 'Cant. anterior'], ['cant_presentada', 'Cant. presentada'], ['cant_aprobada', 'Cant. aprobada'], ['acumulado', 'Cant. acumulada'],
      ['saldo', 'Saldo'], ['vr_acta', 'Vr. esta acta'], ['vr_acumulado', 'Vr. acumulado'], ['observacion', 'Observación']];
    res.setHeader('Content-Disposition', `attachment; filename="Acta_${d.acta.numero}.csv"`);
    return enviar(res, 200, csv(d.filas, cols), 'text/csv; charset=utf-8');
  }
  if (r0 === 'acta' && r2_ === 'chequeo') {
    const aid = Number(r1);
    if (req.method === 'GET') return enviar(res, 200, await chequeo(aid));
    exigir(u, 'acta'); await actaEditable(aid);
    const b = await leerCuerpo(req);
    if (b.estado != null && !ESTADOS_REQ.includes(b.estado)) throw new Rechazo(400, 'Estado desconocido: ' + b.estado);
    if (req.method === 'POST') {
      if (!String(b.requisito || '').trim()) throw new Rechazo(400, 'Escriba el requisito');
      const o = (await db.get('SELECT COALESCE(MAX(orden), 0) + 1 m FROM acta_requisito WHERE acta_id = ?', aid)).m;
      const r = await db.run('INSERT INTO acta_requisito (acta_id, orden, requisito, obligatorio) VALUES (?,?,?,?)', aid, o, String(b.requisito).trim(), b.obligatorio === 0 ? 0 : 1);
      await auditar(u, 'acta_requisito', r.id, 'crear', { acta_id: aid, requisito: b.requisito });
      return enviar(res, 200, await chequeo(aid));
    }
    const antes = await db.get('SELECT * FROM acta_requisito WHERE id = ? AND acta_id = ?', Number(r3), aid);
    if (!antes) throw new Rechazo(404, 'No existe el requisito');
    if (req.method === 'DELETE') { await db.run('DELETE FROM acta_requisito WHERE id = ?', antes.id); await auditar(u, 'acta_requisito', antes.id, 'borrar', antes); return enviar(res, 200, await chequeo(aid)); }
    if (req.method === 'PUT') {
      const d = {}; for (const k of ['estado', 'referencia', 'observacion', 'obligatorio', 'requisito']) if (k in b) d[k] = b[k] === '' ? null : b[k];
      const k = Object.keys(d);
      if (k.length) await db.run(`UPDATE acta_requisito SET ${k.map(c => c + ' = ?').join(', ')} WHERE id = ?`, ...Object.values(d), antes.id);
      await auditar(u, 'acta_requisito', antes.id, 'editar', diferencia(antes, d));
      return enviar(res, 200, await chequeo(aid));
    }
  }
  if (r0 === 'acta' && req.method === 'GET') return enviar(res, 200, (await detalleActa(Number(r1))) || { error: 'No existe' });
  if (r0 === 'acta' && r2_ === 'item' && req.method === 'PUT') {
    exigir(u, 'acta_item'); await actaEditable(Number(r1));
    const b = await leerCuerpo(req);
    const prev = (await db.get('SELECT * FROM acta_item WHERE acta_id = ? AND item_id = ?', Number(r1), Number(r3))) || {};
    const v = { cant_presentada: 0, cant_aprobada: 0, observacion: null, ...prev, ...b };
    await db.run(`INSERT INTO acta_item (acta_id, item_id, cant_presentada, cant_aprobada, observacion) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (acta_id, item_id) DO UPDATE SET cant_presentada = excluded.cant_presentada, cant_aprobada = excluded.cant_aprobada, observacion = excluded.observacion`,
      Number(r1), Number(r3), Number(v.cant_presentada) || 0, Number(v.cant_aprobada) || 0, v.observacion ?? null);
    await auditar(u, 'acta_item', `${r1}/${r3}`, 'editar', diferencia(prev, b));
    return enviar(res, 200, { ok: true });
  }
  if (r0 === 'acta' && r2_ === 'aprobar-todo' && req.method === 'POST') {
    exigir(u, 'acta_item'); await actaEditable(Number(r1));
    await auditar(u, 'acta_item', r1, 'aprobar-todo', null);
    await db.run('UPDATE acta_item SET cant_aprobada = cant_presentada WHERE acta_id = ?', Number(r1));
    return enviar(res, 200, { ok: true });
  }

  // Copiar las cantidades aprobadas del acta anterior a los ítems que en esta acta aún están en cero
  if (r0 === 'acta' && r2_ === 'copiar-anterior' && req.method === 'POST') {
    exigir(u, 'acta_item'); const a = await actaEditable(Number(r1));
    const ant = await db.get('SELECT id, numero FROM acta WHERE contrato_id = ? AND numero < ? ORDER BY numero DESC LIMIT 1', a.contrato_id, a.numero);
    if (!ant) throw new Rechazo(409, 'No hay un acta anterior de la cual copiar');
    const ya = new Set((await db.all('SELECT item_id FROM acta_item WHERE acta_id = ? AND (cant_presentada <> 0 OR cant_aprobada <> 0)', a.id)).map(r => r.item_id));
    let n = 0;
    for (const r of await db.all('SELECT item_id, cant_aprobada FROM acta_item WHERE acta_id = ? AND cant_aprobada <> 0', ant.id)) {
      if (ya.has(r.item_id)) continue;
      await db.run(`INSERT INTO acta_item (acta_id, item_id, cant_presentada, cant_aprobada) VALUES (?, ?, ?, ?)
        ON CONFLICT (acta_id, item_id) DO UPDATE SET cant_presentada = excluded.cant_presentada, cant_aprobada = excluded.cant_aprobada`, a.id, r.item_id, r.cant_aprobada, r.cant_aprobada);
      n++;
    }
    await auditar(u, 'acta_item', r1, 'copiar-anterior', { desde_acta: ant.numero, items: n });
    return enviar(res, 200, { ok: true, items: n, desde: ant.numero });
  }

  // Pegar filas desde Excel: [{codigo, descripcion, unidad, cantidad, vr_unitario}] — una fila sin unidad ni cantidad es capítulo
  if (r0 === 'pegar' && req.method === 'POST') {
    exigir(u, 'item');
    const b = await leerCuerpo(req);
    let orden = (await db.get('SELECT COALESCE(MAX(orden), 0) m FROM item WHERE contrato_id = ?', b.contrato_id)).m;
    let padre = b.padre_id || null, n = 0;
    for (const f of b.filas) {
      const cap = !f.unidad && !f.cantidad;
      const r = await db.run('INSERT INTO item (contrato_id, padre_id, tipo, codigo, descripcion, unidad, cantidad, vr_unitario, orden) VALUES (?,?,?,?,?,?,?,?,?)',
        b.contrato_id, cap ? null : padre, cap ? 0 : 1, f.codigo || null, f.descripcion || '', f.unidad || null, Number(f.cantidad) || 0, Number(f.vr_unitario) || 0, ++orden);
      if (cap) padre = r.id;
      n++;
    }
    await auditar(u, 'item', null, 'pegar', { contrato_id: b.contrato_id, filas: n });
    return enviar(res, 200, { ok: true, filas: n });
  }

  // API genérica: /api/t/:tabla[/:id]
  if (r0 === 't' && Object.hasOwn(TABLAS, r1)) {
    const tabla = r1, id = r2_ ? Number(r2_) : null, padre = TABLAS[tabla];
    if (req.method === 'GET') {
      if (id) return enviar(res, 200, (await db.get(`SELECT * FROM ${tabla} WHERE id = ?`, id)) || null);
      const filtro = padre && q[padre] ? ` WHERE ${padre} = ?` : '';
      const orden = { item: 'orden, id', acta: 'numero', vencimiento: 'fecha IS NULL, fecha', gasto: 'fecha DESC, id DESC', correspondencia: 'fecha DESC', bitacora: 'fecha DESC', ensayo: 'fecha DESC', tarea: 'orden, id', tramo: 'alineamiento_id, abs_ini', sst: 'fecha DESC', sst_mes: 'mes DESC', sst_inspeccion: 'fecha DESC', sst_permiso: 'fecha DESC', sst_capacitacion: 'fecha DESC', sst_epp: 'fecha DESC', sst_seguridad_social: 'mes DESC, trabajador', sst_investigacion: 'fecha DESC', sst_emergencia: 'fecha DESC', sst_trabajador: 'nombre', sst_peligro: 'nr DESC, id', sst_equipo: 'equipo', sst_actividad: 'fecha DESC', sst_documento: 'mes DESC, anexo', ambiental: 'fecha DESC', pmt: 'id', amb_ficha: 'programa, codigo', amb_permiso: 'vence IS NULL, vence', rcd: 'fecha DESC', forestal: 'codigo, id', agua: 'fecha DESC', maquinaria: 'equipo', monitoreo: 'fecha DESC', amb_chequeo: 'fecha DESC', pmt_inspeccion: 'fecha DESC', social: 'fecha DESC', requisicion: 'numero DESC', pqrs: 'fecha DESC, id DESC', reunion: 'fecha DESC', acta_vecindad: 'predio', mano_obra: 'mes DESC', capacitacion: 'fecha DESC', afectacion: 'fecha DESC', encuesta: 'fecha DESC', veeduria: 'id' }[tabla] || 'id';
      return enviar(res, 200, await db.all(`SELECT * FROM ${tabla}${filtro} ORDER BY ${orden}`, ...(filtro ? [Number(q[padre])] : [])));
    }
    if (req.method !== 'GET') exigir(u, tabla);
    if (req.method === 'POST') {
      const d = limpiar(tabla, await leerCuerpo(req));
      if (tabla === 'item' && d.orden == null) d.orden = (await db.get('SELECT COALESCE(MAX(orden), 0) + 1 m FROM item WHERE contrato_id = ?', d.contrato_id)).m;
      if (tabla === 'acta') await validarEstado(u, null, d);
      if (tabla === 'requisicion') { await validarRQ(u, null, d); if (d.numero == null) d.numero = (await db.get('SELECT COALESCE(MAX(numero), 0) + 1 m FROM requisicion WHERE proyecto_id = ?', d.proyecto_id)).m; if (!d.solicitante) d.solicitante = u.nombre; }
      if (tabla === 'requisicion_item') await rqEditable(d.requisicion_id);
      if (tabla === 'usuario' && d.rol && !ROLES.includes(d.rol)) throw new Rechazo(400, 'Rol desconocido: ' + d.rol);
      if (FICHA_DE[tabla] && !d.ficha) d.ficha = FICHA_DE[tabla];
      if (tabla === 'pqrs' && !d.plazo) d.plazo = diasHabiles(d.fecha || new Date().toISOString().slice(0, 10), diasPQRS(d.tipo));
      if (tabla === 'social' && d.tipo === 'PQRS' && !d.plazo) d.plazo = diasHabiles(d.fecha || new Date().toISOString().slice(0, 10), 15);
      if (tabla === 'avance') await prepararAvance(d, u);
      calcularSST(tabla, d);
      // Consecutivo de actas/otrosíes/suspensiones calculado dentro del mismo INSERT (atómico): evita números repetidos
      // cuando dos usuarios crean a la vez y la base está en la nube (entre SELECT e INSERT hay espera de red)
      const auto = ['otrosi', 'acta', 'suspension'].includes(tabla) && d.numero == null;
      const k = Object.keys(d);
      const r = auto
        ? await db.run(`INSERT INTO ${tabla} (${[...k, 'numero'].join(',')}) VALUES (${k.map(() => '?').join(',')}${k.length ? ',' : ''}(SELECT COALESCE(MAX(numero), 0) + 1 FROM ${tabla} WHERE contrato_id = ?))`, ...Object.values(d), d.contrato_id ?? null)
        : await db.run(`INSERT INTO ${tabla} (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, ...Object.values(d));
      if (tabla === 'avance') await vincularAvance(r.id);
      // Un acta nueva recoge las capturas de avance pendientes de su periodo
      if (tabla === 'acta') for (const a of await db.all('SELECT id FROM avance WHERE contrato_id = ? AND acta_id IS NULL AND estado <> ? AND fecha >= COALESCE(?, fecha) AND fecha <= COALESCE(?, fecha)', d.contrato_id, 'Rechazado', d.desde ?? null, d.hasta ?? null)) await vincularAvance(a.id);
      const nuevo = await db.get(`SELECT * FROM ${tabla} WHERE id = ?`, r.id);
      await auditar(u, tabla, r.id, 'crear', auto ? { ...d, numero: nuevo?.numero } : d);
      return enviar(res, 200, nuevo);
    }
    if (req.method === 'PUT' && id) {
      const d = limpiar(tabla, await leerCuerpo(req)), k = Object.keys(d);
      const antes = await db.get(`SELECT * FROM ${tabla} WHERE id = ?`, id);
      if (!antes) throw new Rechazo(404, 'No existe');
      if (tabla === 'acta') await validarEstado(u, antes, d);
      if (tabla === 'pqrs' && (d.tipo != null || d.fecha != null) && !('plazo' in d)) d.plazo = diasHabiles(d.fecha || antes.fecha || new Date().toISOString().slice(0, 10), diasPQRS(d.tipo ?? antes.tipo));
      if (tabla === 'requisicion') await validarRQ(u, antes, d);
      if (tabla === 'requisicion_item') await rqEditable(antes.requisicion_id);
      if (tabla === 'social' && d.tipo === 'PQRS' && !antes.plazo && !d.plazo) d.plazo = diasHabiles(d.fecha || antes.fecha || new Date().toISOString().slice(0, 10), 15);
      if (tabla === 'item' && d.vr_unitario != null && d.vr_unitario !== antes.vr_unitario) await precioLibre(id);
      if (tabla === 'usuario' && d.rol && !ROLES.includes(d.rol)) throw new Rechazo(400, 'Rol desconocido: ' + d.rol);
      calcularSST(tabla, d, antes);
      if (tabla === 'avance') { await prepararAvance(d, u, antes); if (k.length) await moverAvance(antes, -1); }
      if (k.length) await db.run(`UPDATE ${tabla} SET ${Object.keys(d).map(c => c + ' = ?').join(', ')} WHERE id = ?`, ...Object.values(d), id);
      if (tabla === 'avance' && k.length) {
        const av = await db.get('SELECT * FROM avance WHERE id = ?', id);
        if (av.estado === 'Rechazado') await db.run('UPDATE avance SET acta_id = NULL WHERE id = ?', id);
        else if (av.acta_id) await moverAvance(av, 1); else await vincularAvance(id);
      }
      const cambio = diferencia(antes, d);
      if (Object.keys(cambio).length) await auditar(u, tabla, id, 'editar', cambio);
      return enviar(res, 200, await db.get(`SELECT * FROM ${tabla} WHERE id = ?`, id));
    }
    if (req.method === 'DELETE' && id) {
      if (tabla === 'acta') await actaEditable(id);
      if (tabla === 'requisicion') await rqEditable(id);
      if (tabla === 'requisicion_item') { const x = await db.get('SELECT requisicion_id FROM requisicion_item WHERE id = ?', id); if (x) await rqEditable(x.requisicion_id); }
      const antes = await db.get(`SELECT * FROM ${tabla} WHERE id = ?`, id);
      if (tabla === 'avance' && antes) { await prepararAvance({}, u, antes); await moverAvance(antes, -1); }
      await borrar(tabla, id); await auditar(u, tabla, id, 'borrar', antes);
      return enviar(res, 200, { ok: true });
    }
  }
  enviar(res, 404, { error: 'Ruta no encontrada' });
}

// Defensa contra DNS rebinding: solo se atienden peticiones dirigidas a este equipo por su nombre local
const HOST_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const PUBLICO = path.join(RAIZ, 'public');
const servidor = http.createServer(async (req, res) => {
  if (!HOST_LOCAL.test(req.headers.host || '')) return enviar(res, 403, { error: 'Host no permitido' });
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { return enviar(res, 400, { error: 'URL inválida' }); }
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    const archivo = path.normalize(path.join(PUBLICO, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!archivo.startsWith(PUBLICO + path.sep) || !fs.existsSync(archivo) || !fs.statSync(archivo).isFile()) return enviar(res, 404, 'No encontrado', 'text/plain');
    enviar(res, 200, fs.readFileSync(archivo), TIPOS[path.extname(archivo)] || 'application/octet-stream');
  } catch (e) {
    if (e instanceof Rechazo) return enviar(res, e.codigo, { error: e.message });
    console.error(e);
    const sinRed = /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i.test(e.message);
    enviar(res, 500, { error: sinRed ? 'Sin conexión con la nube: puede consultar, pero los cambios no se guardaron. Revise el internet.' : e.message });
  }
});
// Un error asíncrono suelto no debe tumbar el servidor (la app de escritorio depende de él)
process.on('unhandledRejection', e => console.error('Promesa rechazada sin capturar:', e));
// Al arrancar desde la app de escritorio (main.js) se usa un puerto libre que se lee de aquí
module.exports = iniciar().then(() => correo.programar()).then(() => new Promise((ok, mal) => {
  const listo = () => { const p = servidor.address().port; console.log(`SIGI listo en http://localhost:${p} (base: ${db.estado.modo})`); ok(p); };
  servidor.once('error', e => {
    if (e.code === 'EADDRINUSE' && process.env.SIGI_PUERTO_LIBRE) servidor.listen(0, '127.0.0.1', listo); else mal(e);
  });
  servidor.listen(PUERTO, '127.0.0.1', listo);
}));
// Para pruebas: herramientas del asistente
module.exports.asistente = { HERRAMIENTAS, leer, escribir, validarArgs };
