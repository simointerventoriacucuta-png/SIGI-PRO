// SIGI - Sistema Integral de Gestión de Interventoría
// Servidor local: Node.js puro (sin dependencias) + SQLite integrado (node:sqlite).
// Uso: node server.js   →   http://localhost:4027
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PUERTO = process.env.PORT != null ? Number(process.env.PORT) : 4027;
const RAIZ = __dirname;
const DATOS = process.env.SIGI_DATOS || path.join(RAIZ, 'datos');
fs.mkdirSync(DATOS, { recursive: true });

const db = new DatabaseSync(path.join(DATOS, 'sigi.db'));
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
db.exec(fs.readFileSync(path.join(RAIZ, 'schema.sql'), 'utf8'));
if (!db.prepare('SELECT COUNT(*) n FROM proyecto').get().n) require('./seed/cucuta.js')(db);

// Tablas que se pueden editar con la API genérica, y la columna que las ata al padre
const TABLAS = {
  proyecto: null, contrato: 'proyecto_id', item: 'contrato_id', acta: 'contrato_id', gasto: 'contrato_id',
  vencimiento: 'proyecto_id', personal: 'proyecto_id', poliza: 'proyecto_id',
  correspondencia: 'proyecto_id', bitacora: 'proyecto_id', ensayo: 'proyecto_id',
};
const columnas = {};
for (const t of Object.keys(TABLAS)) columnas[t] = db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);

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

function presupuesto(contratoId) {
  const c = db.prepare('SELECT * FROM contrato WHERE id = ?').get(contratoId);
  const items = db.prepare('SELECT * FROM item WHERE contrato_id = ? ORDER BY orden, id').all(contratoId);
  let cd = 0, otros = 0;
  for (const it of items) if (it.tipo === 1) { const v = it.cantidad * it.vr_unitario; it.sin_aiu ? (otros += v) : (cd += v); }
  return { contrato: c, items, totales: totales(c, cd, otros) };
}

// Detalle de un acta: por ítem, cantidad contratada, anterior, esta acta, acumulado y saldo
function detalleActa(actaId) {
  const acta = db.prepare('SELECT * FROM acta WHERE id = ?').get(actaId);
  if (!acta) return null;
  const { contrato: c, items } = presupuesto(acta.contrato_id);
  const ant = new Map(db.prepare(`SELECT ai.item_id, SUM(ai.cant_aprobada) q FROM acta_item ai JOIN acta a ON a.id = ai.acta_id
    WHERE a.contrato_id = ? AND a.numero < ? GROUP BY ai.item_id`).all(acta.contrato_id, acta.numero).map(r => [r.item_id, r.q]));
  const act = new Map(db.prepare('SELECT * FROM acta_item WHERE acta_id = ?').all(actaId).map(r => [r.item_id, r]));
  const filas = items.map(it => {
    if (it.tipo !== 1) return { ...it };
    const a = act.get(it.id) || {}, anterior = ant.get(it.id) || 0;
    const pres = a.cant_presentada || 0, apr = a.cant_aprobada || 0, acum = anterior + apr;
    return { ...it, anterior, cant_presentada: pres, cant_aprobada: apr, observacion: a.observacion || '',
      acumulado: acum, saldo: it.cantidad - acum, vr_acta: r2(apr * it.vr_unitario), vr_presentado: r2(pres * it.vr_unitario),
      vr_acumulado: r2(acum * it.vr_unitario), pct: it.cantidad ? acum / it.cantidad : 0 };
  });
  const suma = (k, f = () => true) => filas.filter(x => x.tipo === 1 && f(x)).reduce((s, x) => s + x[k], 0);
  const conAiu = x => !x.sin_aiu, sinAiu = x => !!x.sin_aiu;
  return {
    acta, contrato: c, filas,
    totales: {
      presentado: totales(c, suma('vr_presentado', conAiu), suma('vr_presentado', sinAiu)),
      acta: totales(c, suma('vr_acta', conAiu), suma('vr_acta', sinAiu)),
      acumulado: totales(c, suma('vr_acumulado', conAiu), suma('vr_acumulado', sinAiu)),
    },
  };
}

// Control de costos del contrato propio: por ítem, presupuestado vs gastado real vs facturado (cuentas de cobro aprobadas)
function costos(contratoId) {
  const { contrato: c, items, totales: tp } = presupuesto(contratoId);
  const gastado = new Map(db.prepare('SELECT item_id, SUM(valor) v FROM gasto WHERE contrato_id = ? GROUP BY item_id').all(contratoId).map(r => [r.item_id, r.v]));
  const facturado = new Map(db.prepare(`SELECT ai.item_id, SUM(ai.cant_aprobada) q FROM acta_item ai JOIN acta a ON a.id = ai.acta_id
    WHERE a.contrato_id = ? GROUP BY ai.item_id`).all(contratoId).map(r => [r.item_id, r.q]));
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

function resumen(proyectoId) {
  const p = db.prepare('SELECT * FROM proyecto WHERE id = ?').get(proyectoId);
  const contratos = db.prepare('SELECT * FROM contrato WHERE proyecto_id = ? ORDER BY tipo').all(proyectoId).map(c => {
    const pr = presupuesto(c.id);
    const actas = db.prepare('SELECT * FROM acta WHERE contrato_id = ? ORDER BY numero').all(c.id).map(a => {
      const d = detalleActa(a.id);
      return { ...a, valor: d.totales.acta.total, acumulado: d.totales.acumulado.total };
    });
    const ejecutado = actas.length ? actas[actas.length - 1].acumulado : 0;
    const gastado = db.prepare('SELECT COALESCE(SUM(valor), 0) v FROM gasto WHERE contrato_id = ?').get(c.id).v;
    return { ...c, presupuesto: pr.totales.total, costo_directo: pr.totales.costo_directo, items: pr.items.filter(i => i.tipo === 1).length, actas, ejecutado, gastado };
  });
  const hoy = new Date().toISOString().slice(0, 10);
  const vencimientos = db.prepare(`SELECT * FROM vencimiento WHERE proyecto_id = ? AND estado <> 'Cumplido'
    ORDER BY fecha IS NULL, fecha`).all(proyectoId);
  const cuenta = t => db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE proyecto_id = ?`).get(proyectoId).n;
  return { proyecto: p, hoy, contratos, vencimientos,
    conteos: { personal: cuenta('personal'), poliza: cuenta('poliza'), correspondencia: cuenta('correspondencia'), bitacora: cuenta('bitacora'), ensayo: cuenta('ensayo') } };
}

// Búsqueda en la memoria-grafo del proyecto (memoria_grafo.json)
function memoria(proyectoId, buscar) {
  const p = db.prepare('SELECT memoria FROM proyecto WHERE id = ?').get(proyectoId);
  if (!p || !p.memoria || !fs.existsSync(p.memoria)) return { error: 'El proyecto no tiene memoria-grafo' };
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

  if (r0 === 'resumen') return enviar(res, 200, resumen(Number(r1)));
  if (r0 === 'presupuesto') return enviar(res, 200, presupuesto(Number(r1)));
  if (r0 === 'costos') return enviar(res, 200, costos(Number(r1)));
  if (r0 === 'memoria') return enviar(res, 200, memoria(Number(r1), q.buscar));

  if (r0 === 'acta' && req.method === 'GET' && r2_ === 'csv') {
    const d = detalleActa(Number(r1));
    const cols = [['codigo', 'Código'], ['descripcion', 'Descripción'], ['unidad', 'Und'], ['cantidad', 'Cant. contratada'], ['vr_unitario', 'Vr. unitario'],
      ['anterior', 'Cant. anterior'], ['cant_presentada', 'Cant. presentada'], ['cant_aprobada', 'Cant. aprobada'], ['acumulado', 'Cant. acumulada'],
      ['saldo', 'Saldo'], ['vr_acta', 'Vr. esta acta'], ['vr_acumulado', 'Vr. acumulado'], ['observacion', 'Observación']];
    res.setHeader('Content-Disposition', `attachment; filename="Acta_${d.acta.numero}.csv"`);
    return enviar(res, 200, csv(d.filas, cols), 'text/csv; charset=utf-8');
  }
  if (r0 === 'acta' && req.method === 'GET') return enviar(res, 200, detalleActa(Number(r1)) || { error: 'No existe' });
  if (r0 === 'acta' && r2_ === 'item' && req.method === 'PUT') {
    const b = await leerCuerpo(req);
    const prev = db.prepare('SELECT * FROM acta_item WHERE acta_id = ? AND item_id = ?').get(Number(r1), Number(r3)) || {};
    const v = { cant_presentada: 0, cant_aprobada: 0, observacion: null, ...prev, ...b };
    db.prepare(`INSERT INTO acta_item (acta_id, item_id, cant_presentada, cant_aprobada, observacion) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (acta_id, item_id) DO UPDATE SET cant_presentada = excluded.cant_presentada, cant_aprobada = excluded.cant_aprobada, observacion = excluded.observacion`)
      .run(Number(r1), Number(r3), Number(v.cant_presentada) || 0, Number(v.cant_aprobada) || 0, v.observacion ?? null);
    return enviar(res, 200, { ok: true });
  }
  if (r0 === 'acta' && r2_ === 'aprobar-todo' && req.method === 'POST') {
    db.prepare('UPDATE acta_item SET cant_aprobada = cant_presentada WHERE acta_id = ?').run(Number(r1));
    return enviar(res, 200, { ok: true });
  }

  // Pegar filas desde Excel: [{codigo, descripcion, unidad, cantidad, vr_unitario}] — una fila sin unidad ni cantidad es capítulo
  if (r0 === 'pegar' && req.method === 'POST') {
    const b = await leerCuerpo(req);
    let orden = db.prepare('SELECT COALESCE(MAX(orden), 0) m FROM item WHERE contrato_id = ?').get(b.contrato_id).m;
    let padre = b.padre_id || null, n = 0;
    const ins = db.prepare('INSERT INTO item (contrato_id, padre_id, tipo, codigo, descripcion, unidad, cantidad, vr_unitario, orden) VALUES (?,?,?,?,?,?,?,?,?)');
    db.exec('BEGIN');
    try {
      for (const f of b.filas) {
        const cap = !f.unidad && !f.cantidad;
        const r = ins.run(b.contrato_id, cap ? null : padre, cap ? 0 : 1, f.codigo || null, f.descripcion || '', f.unidad || null, Number(f.cantidad) || 0, Number(f.vr_unitario) || 0, ++orden);
        if (cap) padre = Number(r.lastInsertRowid);
        n++;
      }
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    return enviar(res, 200, { ok: true, filas: n });
  }

  // API genérica: /api/t/:tabla[/:id]
  if (r0 === 't' && r1 in TABLAS) {
    const tabla = r1, id = r2_ ? Number(r2_) : null, padre = TABLAS[tabla];
    if (req.method === 'GET') {
      if (id) return enviar(res, 200, db.prepare(`SELECT * FROM ${tabla} WHERE id = ?`).get(id) || null);
      const filtro = padre && q[padre] ? ` WHERE ${padre} = ?` : '';
      const orden = { item: 'orden, id', acta: 'numero', vencimiento: 'fecha IS NULL, fecha', gasto: 'fecha DESC, id DESC', correspondencia: 'fecha DESC', bitacora: 'fecha DESC', ensayo: 'fecha DESC' }[tabla] || 'id';
      return enviar(res, 200, db.prepare(`SELECT * FROM ${tabla}${filtro} ORDER BY ${orden}`).all(...(filtro ? [Number(q[padre])] : [])));
    }
    if (req.method === 'POST') {
      const d = limpiar(tabla, await leerCuerpo(req));
      if (tabla === 'item' && d.orden == null) d.orden = db.prepare('SELECT COALESCE(MAX(orden), 0) + 1 m FROM item WHERE contrato_id = ?').get(d.contrato_id).m;
      if (tabla === 'acta' && d.numero == null) d.numero = db.prepare('SELECT COALESCE(MAX(numero), 0) + 1 m FROM acta WHERE contrato_id = ?').get(d.contrato_id).m;
      const k = Object.keys(d);
      const r = db.prepare(`INSERT INTO ${tabla} (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`).run(...Object.values(d));
      return enviar(res, 200, db.prepare(`SELECT * FROM ${tabla} WHERE id = ?`).get(Number(r.lastInsertRowid)));
    }
    if (req.method === 'PUT' && id) {
      const d = limpiar(tabla, await leerCuerpo(req)), k = Object.keys(d);
      if (k.length) db.prepare(`UPDATE ${tabla} SET ${k.map(c => c + ' = ?').join(', ')} WHERE id = ?`).run(...Object.values(d), id);
      return enviar(res, 200, db.prepare(`SELECT * FROM ${tabla} WHERE id = ?`).get(id));
    }
    if (req.method === 'DELETE' && id) {
      db.prepare(`DELETE FROM ${tabla} WHERE id = ?`).run(id);
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
    console.error(e);
    enviar(res, 500, { error: e.message });
  }
});
// Al arrancar desde la app de escritorio (main.js) se usa un puerto libre que se lee de aquí
module.exports = new Promise(ok => servidor.listen(PUERTO, '127.0.0.1', () => {
  const p = servidor.address().port;
  console.log(`SIGI listo en http://localhost:${p}`);
  ok(p);
}));
