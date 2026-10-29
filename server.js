// SIGI Pro - servidor interno: API JSON + archivos de la interfaz.
// Base de datos libSQL (local o sincronizada con Turso), ver db.js.
// Uso: node server.js   →   http://localhost:4027
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Base } = require('./db.js');

const PUERTO = process.env.PORT != null ? Number(process.env.PORT) : 4027;
const RAIZ = __dirname;
const DATOS = process.env.SIGI_DATOS || path.join(RAIZ, 'datos');
fs.mkdirSync(DATOS, { recursive: true });
const ESQUEMA = fs.readFileSync(path.join(RAIZ, 'schema.sql'), 'utf8');
const db = new Base(DATOS);

// Tablas que se pueden editar con la API genérica, y la columna que las ata al padre
const TABLAS = {
  proyecto: null, contrato: 'proyecto_id', item: 'contrato_id', acta: 'contrato_id', otrosi: 'contrato_id', gasto: 'contrato_id',
  vencimiento: 'proyecto_id', personal: 'proyecto_id', poliza: 'proyecto_id',
  correspondencia: 'proyecto_id', bitacora: 'proyecto_id', ensayo: 'proyecto_id', usuario: null,
};
// Borrado en cascada explícito (en la nube no se puede confiar en PRAGMA foreign_keys)
const HIJOS = {
  proyecto: [['contrato', 'proyecto_id'], ['vencimiento', 'proyecto_id'], ['personal', 'proyecto_id'], ['poliza', 'proyecto_id'], ['correspondencia', 'proyecto_id'], ['bitacora', 'proyecto_id'], ['ensayo', 'proyecto_id']],
  contrato: [['otrosi', 'contrato_id'], ['acta', 'contrato_id'], ['item', 'contrato_id'], ['gasto', 'contrato_id']],
  acta: [['acta_item', 'acta_id']],
  item: [['item', 'padre_id'], ['acta_item', 'item_id']],
};
const columnas = {};

// ---------- Usuarios, permisos y auditoría ----------
const ROLES = ['director', 'residente', 'especialista', 'administrativo', 'entidad'];
// Qué puede modificar cada rol (POST, PUT, DELETE). La consulta (GET) es libre para todos.
const PERMISOS = {
  director: '*',
  residente: ['item', 'acta', 'acta_item', 'bitacora', 'ensayo', 'vencimiento', 'correspondencia'],
  especialista: ['acta_item', 'bitacora', 'ensayo'],
  administrativo: ['otrosi', 'acta', 'gasto', 'personal', 'poliza', 'correspondencia', 'vencimiento'],
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

async function iniciar() {
  await db.abrir();
  await db.exec(ESQUEMA);
  if (!(await db.all('PRAGMA table_info(usuario)')).some(c => c.name === 'correo')) await db.run('ALTER TABLE usuario ADD COLUMN correo TEXT');
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
    if (hijo === 'acta_item') { await db.run(`DELETE FROM acta_item WHERE ${col} = ?`, id); continue; }
    for (const h of await db.all(`SELECT id FROM ${hijo} WHERE ${col} = ?`, id)) await borrar(hijo, h.id);
  }
  if (tabla === 'gasto' || tabla === 'item') await db.run('UPDATE gasto SET item_id = NULL WHERE item_id = ?', tabla === 'item' ? id : -1);
  await db.run(`DELETE FROM ${tabla} WHERE id = ?`, id);
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

async function presupuesto(contratoId) {
  const c = await db.get('SELECT * FROM contrato WHERE id = ?', contratoId);
  const items = await db.all('SELECT * FROM item WHERE contrato_id = ? ORDER BY orden, id', contratoId);
  let cd = 0, otros = 0;
  for (const it of items) if (it.tipo === 1) { const v = it.cantidad * it.vr_unitario; it.sin_aiu ? (otros += v) : (cd += v); }
  return { contrato: c, items, totales: totales(c, cd, otros) };
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
      acumulado: acum, saldo: it.cantidad - acum, vr_acta: r2(apr * it.vr_unitario), vr_presentado: r2(pres * it.vr_unitario),
      vr_acumulado: r2(acum * it.vr_unitario), pct: it.cantidad ? acum / it.cantidad : 0 };
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
    const finVigente = c.fecha_fin && prorroga ? new Date(new Date(c.fecha_fin + 'T00:00:00Z').getTime() + prorroga * 86400000).toISOString().slice(0, 10) : c.fecha_fin;
    contratos.push({ ...c, otrosis, adiciones, prorroga_dias: prorroga, valor_vigente: r2((c.valor || 0) + adiciones), fecha_fin_vigente: finVigente, presupuesto: pr.totales.total, costo_directo: pr.totales.costo_directo, items: pr.items.filter(i => i.tipo === 1).length, actas, ejecutado, gastado });
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
    poliza: ['amparo', 'aseguradora', 'numero'], bitacora: ['actividades', 'frente', 'observaciones'], ensayo: ['ensayo', 'item', 'abscisa', 'resultado'] };
  const NOMBRE = { vencimiento: 'Vencimientos', correspondencia: 'Correspondencia', personal: 'Personal', poliza: 'Pólizas', bitacora: 'Bitácora', ensayo: 'Ensayos' };
  for (const [tabla, cols] of Object.entries(TEXTO)) {
    const filas = await db.all(`SELECT * FROM ${tabla} WHERE proyecto_id = ? AND (${cols.map(k => k + ' LIKE ?').join(' OR ')}) LIMIT 10`, proyectoId, ...cols.map(() => like));
    for (const f of filas) out.push({ grupo: NOMBRE[tabla], titulo: cols.map(k => f[k]).filter(Boolean).join(' · ') + (f.fecha ? ' · ' + f.fecha : ''), abrir: 'tabla:' + tabla });
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
  for (const o of await db.all(`SELECT o.*, c.tipo ct FROM otrosi o JOIN contrato c ON c.id = o.contrato_id WHERE c.proyecto_id = ? AND o.estado = 'Firmado' AND o.polizas_ajustadas <> 'Sí'`, proyectoId))
    out.push({ fecha: o.fecha || iso(hoy), tipo: 'Pólizas', texto: `Ajustar las pólizas por el otrosí ${o.numero} (${o.ct === 'obra' ? 'obra' : 'interventoría'})`, abrir: 'otrosis:' + o.contrato_id });
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
    input_schema: obj({ tabla: { type: 'string', enum: ['contrato', 'item', 'acta', 'otrosi', 'gasto', 'vencimiento', 'personal', 'poliza', 'correspondencia', 'bitacora', 'ensayo'] },
      filtros: { type: 'object', description: 'Columna → valor, p. ej. {"estado":"Pendiente"}', additionalProperties: { type: ['string', 'number'] } },
      limite: { type: 'integer', minimum: 1, maximum: 200 } }, ['tabla']) },
  { name: 'detalle_acta', description: 'Detalle de un acta parcial o cuenta de cobro: por ítem con movimiento, cantidad contratada, anterior, presentada, aprobada, acumulada, saldo y valores; y los totales.',
    input_schema: obj({ acta_id: { type: 'integer', description: 'id del acta (no el número)' } }, ['acta_id']) },
  { name: 'presupuesto', description: 'Presupuesto de un contrato del proyecto: capítulos, ítems con cantidad y valor unitario, y totales (AIU, IVA).',
    input_schema: obj({ contrato: { type: 'string', enum: ['obra', 'interventoria'] } }, ['contrato']) },
  { name: 'costos_interventoria', description: 'Control de costos del contrato de interventoría: presupuestado, gastado, facturado y margen por ítem.', input_schema: obj({}) },
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
  if (r0 === 'buscar') return enviar(res, 200, await buscar(Number(r1), q.q));
  if (r0 === 'avisos') return enviar(res, 200, await avisos(Number(r1)));

  // Sincronización
  if (r0 === 'sync' && req.method === 'GET') { const cfg = db.config(); return enviar(res, 200, { ...db.estado, url: cfg?.url || null }); }
  if (r0 === 'sync' && req.method !== 'GET') exigir(u, 'sync');
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
      const orden = { item: 'orden, id', acta: 'numero', vencimiento: 'fecha IS NULL, fecha', gasto: 'fecha DESC, id DESC', correspondencia: 'fecha DESC', bitacora: 'fecha DESC', ensayo: 'fecha DESC' }[tabla] || 'id';
      return enviar(res, 200, await db.all(`SELECT * FROM ${tabla}${filtro} ORDER BY ${orden}`, ...(filtro ? [Number(q[padre])] : [])));
    }
    if (req.method !== 'GET') exigir(u, tabla);
    if (req.method === 'POST') {
      const d = limpiar(tabla, await leerCuerpo(req));
      if (tabla === 'item' && d.orden == null) d.orden = (await db.get('SELECT COALESCE(MAX(orden), 0) + 1 m FROM item WHERE contrato_id = ?', d.contrato_id)).m;
      if (tabla === 'acta') await validarEstado(u, null, d);
      if (tabla === 'usuario' && d.rol && !ROLES.includes(d.rol)) throw new Rechazo(400, 'Rol desconocido: ' + d.rol);
      if (tabla === 'otrosi' && d.numero == null) d.numero = (await db.get('SELECT COALESCE(MAX(numero), 0) + 1 m FROM otrosi WHERE contrato_id = ?', d.contrato_id)).m;
      if (tabla === 'acta' && d.numero == null) d.numero = (await db.get('SELECT COALESCE(MAX(numero), 0) + 1 m FROM acta WHERE contrato_id = ?', d.contrato_id)).m;
      const k = Object.keys(d);
      const r = await db.run(`INSERT INTO ${tabla} (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, ...Object.values(d));
      const nuevo = await db.get(`SELECT * FROM ${tabla} WHERE id = ?`, r.id);
      await auditar(u, tabla, r.id, 'crear', d);
      return enviar(res, 200, nuevo);
    }
    if (req.method === 'PUT' && id) {
      const d = limpiar(tabla, await leerCuerpo(req)), k = Object.keys(d);
      const antes = await db.get(`SELECT * FROM ${tabla} WHERE id = ?`, id);
      if (!antes) throw new Rechazo(404, 'No existe');
      if (tabla === 'acta') await validarEstado(u, antes, d);
      if (tabla === 'usuario' && d.rol && !ROLES.includes(d.rol)) throw new Rechazo(400, 'Rol desconocido: ' + d.rol);
      if (k.length) await db.run(`UPDATE ${tabla} SET ${k.map(c => c + ' = ?').join(', ')} WHERE id = ?`, ...Object.values(d), id);
      const cambio = diferencia(antes, d);
      if (Object.keys(cambio).length) await auditar(u, tabla, id, 'editar', cambio);
      return enviar(res, 200, await db.get(`SELECT * FROM ${tabla} WHERE id = ?`, id));
    }
    if (req.method === 'DELETE' && id) {
      if (tabla === 'acta') await actaEditable(id);
      const antes = await db.get(`SELECT * FROM ${tabla} WHERE id = ?`, id);
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
module.exports = iniciar().then(() => new Promise(ok => servidor.listen(PUERTO, '127.0.0.1', () => {
  const p = servidor.address().port;
  console.log(`SIGI listo en http://localhost:${p} (base: ${db.estado.modo})`);
  ok(p);
})));
// Para pruebas: herramientas del asistente
module.exports.asistente = { HERRAMIENTAS, leer, escribir, validarArgs };
