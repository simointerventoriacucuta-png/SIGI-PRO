// SIGI Pro - servidor interno: API JSON + archivos de la interfaz.
// Base de datos libSQL (local o sincronizada con Turso), ver db.js.
// Uso: node server.js   →   http://localhost:4027
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Base } = require('./db.js');
const integ = require('./integraciones.js');
const { informeFormato } = require('./informe.js');

const PUERTO = process.env.PORT != null ? Number(process.env.PORT) : 4027;
const RAIZ = __dirname;
const DATOS = process.env.SIGI_DATOS || path.join(RAIZ, 'datos');
fs.mkdirSync(DATOS, { recursive: true });
const ESQUEMA = fs.readFileSync(path.join(RAIZ, 'schema.sql'), 'utf8');
const db = new Base(DATOS);

// Tablas que se pueden editar con la API genérica, y la columna que las ata al padre
const TABLAS = {
  proyecto: null, contrato: 'proyecto_id', item: 'contrato_id', acta: 'contrato_id', otrosi: 'contrato_id', otrosi_item: 'otrosi_id', gasto: 'contrato_id',
  suspension: 'contrato_id', liquidacion: 'contrato_id',
  vencimiento: 'proyecto_id', personal: 'proyecto_id', poliza: 'proyecto_id',
  correspondencia: 'proyecto_id', bitacora: 'proyecto_id', ensayo: 'proyecto_id', usuario: null,
  tarea: 'proyecto_id', alineamiento: 'proyecto_id', tramo: 'proyecto_id', sst: 'proyecto_id', sst_mes: 'proyecto_id', ambiental: 'proyecto_id', pmt: 'proyecto_id', social: 'proyecto_id', adjunto: 'proyecto_id', avance: 'proyecto_id',
};
// Borrado en cascada explícito (en la nube no se puede confiar en PRAGMA foreign_keys)
const HIJOS = {
  proyecto: [['contrato', 'proyecto_id'], ['vencimiento', 'proyecto_id'], ['personal', 'proyecto_id'], ['poliza', 'proyecto_id'], ['correspondencia', 'proyecto_id'], ['bitacora', 'proyecto_id'], ['ensayo', 'proyecto_id'],
    ['tarea', 'proyecto_id'], ['tramo', 'proyecto_id'], ['alineamiento', 'proyecto_id'], ['sst', 'proyecto_id'], ['sst_mes', 'proyecto_id'], ['ambiental', 'proyecto_id'], ['pmt', 'proyecto_id'], ['social', 'proyecto_id'], ['adjunto', 'proyecto_id'], ['avance', 'proyecto_id']],
  alineamiento: [['tramo', 'alineamiento_id']],
  adjunto: [['adjunto_dato', 'adjunto_id']],
  contrato: [['otrosi', 'contrato_id'], ['acta', 'contrato_id'], ['item', 'contrato_id'], ['gasto', 'contrato_id'], ['suspension', 'contrato_id'], ['liquidacion', 'contrato_id']],
  acta: [['acta_item', 'acta_id']],
  otrosi: [['otrosi_item', 'otrosi_id']],
  item: [['item', 'padre_id'], ['acta_item', 'item_id'], ['otrosi_item', 'item_id']],
};
const columnas = {};

// ---------- Usuarios, permisos y auditoría ----------
const ROLES = ['director', 'residente', 'especialista', 'administrativo', 'entidad'];
// Qué puede modificar cada rol (POST, PUT, DELETE). La consulta (GET) es libre para todos.
const PERMISOS = {
  director: '*',
  residente: ['avance', 'adjunto', 'item', 'acta', 'acta_item', 'bitacora', 'ensayo', 'vencimiento', 'correspondencia', 'tarea', 'alineamiento', 'tramo', 'sst', 'sst_mes', 'ambiental', 'pmt', 'social'],
  especialista: ['avance', 'adjunto', 'acta_item', 'bitacora', 'ensayo', 'tramo', 'sst', 'sst_mes', 'ambiental', 'pmt', 'social'],
  administrativo: ['adjunto', 'otrosi', 'otrosi_item', 'suspension', 'liquidacion', 'acta', 'gasto', 'personal', 'poliza', 'correspondencia', 'vencimiento'],
  entidad: [],
};
const puede = (u, recurso) => !!u && (PERMISOS[u.rol] === '*' || (PERMISOS[u.rol] || []).includes(recurso));

// Estados del acta en orden. Desde "Aprobada interventoría" el acta queda bloqueada.
const ESTADOS_ACTA = ['Borrador', 'Radicada', 'En revisión', 'Con observaciones', 'Aprobada interventoría', 'Avalada entidad', 'Pagada'];
const BLOQUEO = ESTADOS_ACTA.indexOf('Aprobada interventoría');
const bloqueada = a => !!a && ESTADOS_ACTA.indexOf(a.estado) >= BLOQUEO;
// Quién puede llevar un acta a cada estado (los primeros cuatro, quien pueda editar actas)
const QUIEN_ESTADO = { 'Aprobada interventoría': ['director'], 'Avalada entidad': ['director', 'administrativo'], Pagada: ['director', 'administrativo'] };

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

async function iniciar() {
  await db.abrir();
  await db.exec(ESQUEMA);
  if (!(await db.all('PRAGMA table_info(usuario)')).some(c => c.name === 'correo')) await db.run('ALTER TABLE usuario ADD COLUMN correo TEXT');
  const colItem = (await db.all('PRAGMA table_info(item)')).map(c => c.name);
  for (const [c, t] of [['otrosi_id', 'INTEGER'], ['apu', 'TEXT']]) if (!colItem.includes(c)) await db.run(`ALTER TABLE item ADD COLUMN ${c} ${t}`);
  for (const t of Object.keys(TABLAS)) columnas[t] = (await db.all(`PRAGMA table_info(${t})`)).map(c => c.name);
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
    if (hijo === 'acta_item' || hijo === 'adjunto_dato') { await db.run(`DELETE FROM ${hijo} WHERE ${col} = ?`, id); continue; }
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
  return { proyecto: p, hoy: new Date().toISOString().slice(0, 10), contratos, vencimientos, conteos, sincronizacion: db.estado };
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
    sst: ['tipo', 'descripcion', 'hallazgo', 'frente'], ambiental: ['programa', 'ficha', 'actividad', 'hallazgo', 'permiso'], social: ['tipo', 'ficha', 'comunidad', 'descripcion'], pmt: ['frente', 'radicado', 'dispositivos'], tarea: ['nombre', 'wbs'] };
  const NOMBRE = { vencimiento: 'Vencimientos', correspondencia: 'Correspondencia', personal: 'Personal', poliza: 'Pólizas', bitacora: 'Bitácora', ensayo: 'Ensayos', sst: 'SST', ambiental: 'Ambiental', social: 'Social', pmt: 'PMT', tarea: 'Programa de obra' };
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
  for (const m of await db.all(`SELECT * FROM pmt WHERE proyecto_id = ? AND estado <> 'Cerrado' AND hasta IS NOT NULL AND hasta <= ? ORDER BY hasta`, proyectoId, limite))
    out.push({ fecha: m.hasta, tipo: 'PMT', texto: `Vence la aprobación del PMT ${m.frente || ''} ${m.abs_ini ? '(' + m.abs_ini + ' a ' + (m.abs_fin || '') + ')' : ''}`.trim(), abrir: 'tabla:pmt' });
  for (const o of await db.all(`SELECT o.*, c.tipo ct FROM otrosi o JOIN contrato c ON c.id = o.contrato_id WHERE c.proyecto_id = ? AND o.estado = 'Firmado' AND o.polizas_ajustadas <> 'Sí'`, proyectoId))
    out.push({ fecha: o.fecha || iso(hoy), tipo: 'Pólizas', texto: `Ajustar las pólizas por el otrosí ${o.numero} (${o.ct === 'obra' ? 'obra' : 'interventoría'})`, abrir: 'otrosis:' + o.contrato_id });
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
  if (d.estado != null && d.estado !== antes?.estado && QUIEN_ESTADO[d.estado] && !QUIEN_ESTADO[d.estado].includes(u.rol))
    throw new Rechazo(403, `El rol ${u.rol} no puede pasar el acta a "${d.estado}"`);
}

// ---------- Asistente con Claude ----------
// La clave de la API se toma de ANTHROPIC_API_KEY o de datos/asistente.json (solo en este equipo)
const ARCH_ASISTENTE = path.join(DATOS, 'asistente.json');
const claveAsistente = () => process.env.ANTHROPIC_API_KEY || (fs.existsSync(ARCH_ASISTENTE) ? JSON.parse(fs.readFileSync(ARCH_ASISTENTE, 'utf8')).clave : null);
const MAX_VUELTAS = 8;

// Herramientas del asistente. Las de lectura se ejecutan solas; las de escritura esperan la confirmación del usuario.
const obj = (props, req = []) => ({ type: 'object', properties: props, required: req, additionalProperties: false });
const txt = d => ({ type: 'string', description: d });
const HERRAMIENTAS = [
  { name: 'consultar_tabla', description: 'Lee registros de una tabla del proyecto actual. Filtros por igualdad exacta; si el valor tiene % se usa LIKE. Devuelve como máximo "limite" filas (50 por defecto).',
    input_schema: obj({ tabla: { type: 'string', enum: ['contrato', 'item', 'acta', 'otrosi', 'suspension', 'liquidacion', 'gasto', 'vencimiento', 'personal', 'poliza', 'correspondencia', 'bitacora', 'ensayo',
      'tarea', 'tramo', 'sst', 'sst_mes', 'ambiental', 'pmt', 'social', 'adjunto'] },
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
  const clave = claveAsistente();
  if (!clave) throw new Rechazo(400, 'Falta la clave de la API de Claude. El director la configura en Inicio → Asistente → Clave del asistente.');
  const Anthropic = require('@anthropic-ai/sdk');
  const cliente = new Anthropic({ apiKey: clave });
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
      const resp = await flujo.finalMessage();
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
  } catch (e) { throw new Rechazo(e instanceof Anthropic.AuthenticationError ? 400 : e.status || 500, errorAmable(e, Anthropic)); }
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

// Plazo en días hábiles (sin sábados ni domingos; los festivos se ajustan a mano). PQRS: 15 días, Ley 1755 de 2015
function diasHabiles(desde, n) {
  const d = new Date(desde + 'T00:00:00Z');
  while (n > 0) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) n--; }
  return d.toISOString().slice(0, 10);
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
  return { mes, ini, fin, hoy, proyecto: r.proyecto, contratos,
    fisico: await avanceFisico(pid, corte),
    tramos: await db.all('SELECT * FROM tramo WHERE proyecto_id = ? ORDER BY alineamiento_id, abs_ini', pid),
    polizas: await db.all('SELECT * FROM poliza WHERE proyecto_id = ? ORDER BY contrato, hasta', pid),
    sst_ind: indicadoresSST(await db.all('SELECT * FROM sst_mes WHERE proyecto_id = ? AND mes = ?', pid, mes))[0] || null,
    sst: await del('sst'), ambiental: await del('ambiental'),
    pmt: await db.all('SELECT * FROM pmt WHERE proyecto_id = ? AND (desde IS NULL OR desde <= ?) AND (hasta IS NULL OR hasta >= ?) ORDER BY frente', pid, fin, ini),
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
      const a = await db.all("SELECT tabla, nombre, descripcion, tipo_mime FROM adjunto WHERE proyecto_id = ? AND categoria <> 'Foto' AND fecha BETWEEN ? AND ?", pid, ini, fin), g = {};
      for (const x of a) { const k = /\.(dwg|dxf|kmz)$/i.test(x.nombre || '') || x.tabla === 'tramo' ? 'planos' : /recibo/i.test(x.descripcion || '') ? 'recibo' : ['ensayo', 'social', 'correspondencia', 'bitacora'].includes(x.tabla) ? x.tabla : 'otros'; (g[k] = g[k] || []).push(x); }
      return g; })(),
    // Registro fotográfico del mes (hasta 24 fotos JPEG o PNG)
    fotos: await Promise.all((await db.all(`SELECT * FROM adjunto WHERE proyecto_id = ? AND categoria = 'Foto' AND tipo_mime IN ('image/jpeg', 'image/png') AND fecha BETWEEN ? AND ? ORDER BY fecha, id LIMIT 24`, pid, ini, fin))
      .map(async a => ({ ...a, datos: Buffer.from((await db.get('SELECT datos FROM adjunto_dato WHERE adjunto_id = ?', a.id)).datos) }))) };
}

// ---------- HTTP ----------
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function enviar(res, codigo, cuerpo, tipo = 'application/json; charset=utf-8') {
  res.writeHead(codigo, { 'Content-Type': tipo, 'Cache-Control': 'no-store' });
  res.end(typeof cuerpo === 'string' || Buffer.isBuffer(cuerpo) ? cuerpo : JSON.stringify(cuerpo));
}
function leerCuerpo(req) {
  return new Promise((ok, mal) => {
    let s = ''; req.on('data', d => (s += d)); req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { mal(e); } });
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
  if (r0 === 'asistente' && r1 === 'config' && req.method === 'GET') return enviar(res, 200, { configurado: !!claveAsistente() });
  if (r0 === 'asistente' && r1 === 'config' && req.method === 'POST') {
    exigir(u, 'asistente');
    const b = await leerCuerpo(req);
    fs.writeFileSync(ARCH_ASISTENTE, JSON.stringify({ clave: String(b.clave || '').trim() }));
    await auditar(u, 'asistente', null, 'configurar', null);
    return enviar(res, 200, { ok: true });
  }
  if (r0 === 'asistente' && req.method === 'POST') return asistenteSSE(req, res, Number(r1), u);
  // ---------- Integraciones ----------
  const archivo = (nombre, tipo, buf) => { res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`); return enviar(res, 200, Buffer.from(buf), tipo); };
  const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (r0 === 'xlsx' && r1 === 'presupuesto') { const d = await presupuesto(Number(r2_)); return archivo(`Presupuesto_${d.contrato.tipo}.xlsx`, XLSX, await integ.xlsxPresupuesto(d)); }
  if (r0 === 'xlsx' && r1 === 'acta') { const d = await detalleActa(Number(r2_)); return archivo(`${d.contrato.tipo === 'obra' ? 'Acta' : 'Cuenta'}_${d.acta.numero}.xlsx`, XLSX, await integ.xlsxActa(d)); }
  if (r0 === 'docx' && r1 === 'informe') { const d = await informeMensual(Number(r2_), q.mes); return archivo(`Informe_mensual_${d.mes}.docx`, DOCX, await informeFormato(d)); }
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
      sst: () => db.all('SELECT * FROM sst WHERE proyecto_id = ?', pid), sst_indicadores: async () => indicadoresSST(await db.all('SELECT * FROM sst_mes WHERE proyecto_id = ? ORDER BY mes', pid)), pmt: () => db.all('SELECT * FROM pmt WHERE proyecto_id = ?', pid), ambiental: () => db.all('SELECT * FROM ambiental WHERE proyecto_id = ?', pid), social: () => db.all('SELECT * FROM social WHERE proyecto_id = ?', pid),
    };
    if (!conjuntos[conjunto]) return enviar(res, 200, { conjuntos: Object.keys(conjuntos).map(k => `/api/bi/${pid}/${k}.csv`) });
    const filas = await conjuntos[conjunto]();
    return ext === 'json' ? enviar(res, 200, filas) : enviar(res, 200, integ.csv(filas), 'text/csv; charset=utf-8');
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
    res.setHeader('Content-Disposition', `${q.descargar ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(a.nombre || 'archivo')}`);
    return enviar(res, 200, Buffer.from(d.datos), a.tipo_mime || 'application/octet-stream');
  }
  if (r0 === 'adjunto' && req.method === 'POST') {
    const b = await leerCuerpo(req);
    // Quien puede modificar el registro puede adjuntarle archivos; el registro fotográfico general, quien lleve bitácora
    exigir(u, !b.tabla || b.tabla === 'proyecto' ? 'bitacora' : b.tabla === 'acta' ? 'acta_item' : b.tabla);
    if (b.tabla === 'acta' && b.registro_id) await actaEditable(Number(b.registro_id));
    const datos = Buffer.from(String(b.datos || ''), 'base64');
    if (!datos.length) throw new Rechazo(400, 'El archivo está vacío');
    if (datos.length > 20 * 1024 * 1024) throw new Rechazo(400, 'El archivo pasa de 20 MB');
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
  if (r0 === 'sync' && r1 === 'desactivar') { await db.desactivarNube(); await iniciar(); return enviar(res, 200, { ok: true }); }
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
  if (r0 === 't' && r1 in TABLAS) {
    const tabla = r1, id = r2_ ? Number(r2_) : null, padre = TABLAS[tabla];
    if (req.method === 'GET') {
      if (id) return enviar(res, 200, (await db.get(`SELECT * FROM ${tabla} WHERE id = ?`, id)) || null);
      const filtro = padre && q[padre] ? ` WHERE ${padre} = ?` : '';
      const orden = { item: 'orden, id', acta: 'numero', vencimiento: 'fecha IS NULL, fecha', gasto: 'fecha DESC, id DESC', correspondencia: 'fecha DESC', bitacora: 'fecha DESC', ensayo: 'fecha DESC', tarea: 'orden, id', tramo: 'alineamiento_id, abs_ini', sst: 'fecha DESC', sst_mes: 'mes DESC', ambiental: 'fecha DESC', pmt: 'id', social: 'fecha DESC' }[tabla] || 'id';
      return enviar(res, 200, await db.all(`SELECT * FROM ${tabla}${filtro} ORDER BY ${orden}`, ...(filtro ? [Number(q[padre])] : [])));
    }
    if (req.method !== 'GET') exigir(u, tabla);
    if (req.method === 'POST') {
      const d = limpiar(tabla, await leerCuerpo(req));
      if (tabla === 'item' && d.orden == null) d.orden = (await db.get('SELECT COALESCE(MAX(orden), 0) + 1 m FROM item WHERE contrato_id = ?', d.contrato_id)).m;
      if (tabla === 'acta') await validarEstado(u, null, d);
      if (tabla === 'usuario' && d.rol && !ROLES.includes(d.rol)) throw new Rechazo(400, 'Rol desconocido: ' + d.rol);
      if (tabla === 'social' && d.tipo === 'PQRS' && !d.plazo) d.plazo = diasHabiles(d.fecha || new Date().toISOString().slice(0, 10), 15);
      if (tabla === 'otrosi' && d.numero == null) d.numero = (await db.get('SELECT COALESCE(MAX(numero), 0) + 1 m FROM otrosi WHERE contrato_id = ?', d.contrato_id)).m;
      if (tabla === 'suspension' && d.numero == null) d.numero = (await db.get('SELECT COALESCE(MAX(numero), 0) + 1 m FROM suspension WHERE contrato_id = ?', d.contrato_id)).m;
      if (tabla === 'acta' && d.numero == null) d.numero = (await db.get('SELECT COALESCE(MAX(numero), 0) + 1 m FROM acta WHERE contrato_id = ?', d.contrato_id)).m;
      if (tabla === 'avance') await prepararAvance(d, u);
      const k = Object.keys(d);
      const r = await db.run(`INSERT INTO ${tabla} (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, ...Object.values(d));
      if (tabla === 'avance') await vincularAvance(r.id);
      // Un acta nueva recoge las capturas de avance pendientes de su periodo
      if (tabla === 'acta') for (const a of await db.all('SELECT id FROM avance WHERE contrato_id = ? AND acta_id IS NULL AND estado <> ? AND fecha >= COALESCE(?, fecha) AND fecha <= COALESCE(?, fecha)', d.contrato_id, 'Rechazado', d.desde ?? null, d.hasta ?? null)) await vincularAvance(a.id);
      const nuevo = await db.get(`SELECT * FROM ${tabla} WHERE id = ?`, r.id);
      await auditar(u, tabla, r.id, 'crear', d);
      return enviar(res, 200, nuevo);
    }
    if (req.method === 'PUT' && id) {
      const d = limpiar(tabla, await leerCuerpo(req)), k = Object.keys(d);
      const antes = await db.get(`SELECT * FROM ${tabla} WHERE id = ?`, id);
      if (!antes) throw new Rechazo(404, 'No existe');
      if (tabla === 'acta') await validarEstado(u, antes, d);
      if (tabla === 'social' && d.tipo === 'PQRS' && !antes.plazo && !d.plazo) d.plazo = diasHabiles(d.fecha || antes.fecha || new Date().toISOString().slice(0, 10), 15);
      if (tabla === 'item' && d.vr_unitario != null && d.vr_unitario !== antes.vr_unitario) await precioLibre(id);
      if (tabla === 'usuario' && d.rol && !ROLES.includes(d.rol)) throw new Rechazo(400, 'Rol desconocido: ' + d.rol);
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
      const antes = await db.get(`SELECT * FROM ${tabla} WHERE id = ?`, id);
      if (tabla === 'avance' && antes) { await prepararAvance({}, u, antes); await moverAvance(antes, -1); }
      await borrar(tabla, id); await auditar(u, tabla, id, 'borrar', antes);
      return enviar(res, 200, { ok: true });
    }
  }
  enviar(res, 404, { error: 'Ruta no encontrada' });
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    const archivo = path.normalize(path.join(RAIZ, 'public', url.pathname === '/' ? 'index.html' : url.pathname));
    if (!archivo.startsWith(path.join(RAIZ, 'public')) || !fs.existsSync(archivo)) return enviar(res, 404, 'No encontrado', 'text/plain');
    enviar(res, 200, fs.readFileSync(archivo), TIPOS[path.extname(archivo)] || 'application/octet-stream');
  } catch (e) {
    if (e instanceof Rechazo) return enviar(res, e.codigo, { error: e.message });
    console.error(e);
    const sinRed = /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i.test(e.message);
    enviar(res, 500, { error: sinRed ? 'Sin conexión con la nube: puede consultar, pero los cambios no se guardaron. Revise el internet.' : e.message });
  }
});
// Al arrancar desde la app de escritorio (main.js) se usa un puerto libre que se lee de aquí
module.exports = iniciar().then(() => new Promise((ok, mal) => {
  const listo = () => { const p = servidor.address().port; console.log(`SIGI listo en http://localhost:${p} (base: ${db.estado.modo})`); ok(p); };
  servidor.once('error', e => {
    if (e.code === 'EADDRINUSE' && process.env.SIGI_PUERTO_LIBRE) servidor.listen(0, '127.0.0.1', listo); else mal(e);
  });
  servidor.listen(PUERTO, '127.0.0.1', listo);
}));
// Para pruebas: herramientas del asistente
module.exports.asistente = { HERRAMIENTAS, leer, escribir, validarArgs };
