// SIGI - interfaz (JavaScript puro, sin librerías)
'use strict';

// ---------- Utilidades ----------
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (v, d = 2) => (v == null || v === '' ? '' : Number(v).toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d }));
const pesos = v => '$ ' + fmt(v, 2);
const pct = v => fmt((v || 0) * 100, 1) + ' %';
const hoyISO = () => new Date().toISOString().slice(0, 10);
const dias = f => (f ? Math.round((new Date(f + 'T00:00:00') - new Date(hoyISO() + 'T00:00:00')) / 86400000) : null);
const fechaLarga = f => (f ? new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

// Números escritos como en Colombia (1.234,56) o con punto decimal (1234.56)
function num(s) {
  s = String(s ?? '').trim().replace(/[$\s]/g, '');
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

async function api(ruta, metodo = 'GET', cuerpo) {
  const r = await fetch('/api/' + ruta, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const d = await r.json();
  if (!r.ok || (d && d.error)) throw new Error(d.error || r.statusText);
  return d;
}
function aviso(t) { $('#estado-mensaje').textContent = t; clearTimeout(aviso.t); aviso.t = setTimeout(() => ($('#estado-mensaje').textContent = ''), 4000); }
function descargar(nombre, texto, tipo = 'text/csv;charset=utf-8') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texto], { type: tipo })); a.download = nombre; a.click(); URL.revokeObjectURL(a.href);
}
const guardarLocal = (k, v) => { try { localStorage.setItem('sigi.' + k, v); } catch (e) {} };
const leerLocal = k => { try { return localStorage.getItem('sigi.' + k); } catch (e) { return null; } };

// ---------- Iconos (SVG en línea) ----------
const I = (cuerpo, color = '#1f5fa8') => `<svg viewBox="0 0 32 32" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${cuerpo}</svg>`;
const ICONOS = {
  tablero: I('<rect x="4" y="4" width="10" height="10"/><rect x="18" y="4" width="10" height="6"/><rect x="18" y="14" width="10" height="14"/><rect x="4" y="18" width="10" height="10"/>'),
  proyecto: I('<path d="M4 9h9l3 3h12v15H4z"/>', '#d18b00'),
  nuevo: I('<path d="M8 4h11l6 6v18H8z"/><path d="M19 4v6h6M16 15v8M12 19h8"/>'),
  contrato: I('<path d="M8 4h16v24H8z"/><path d="M12 10h8M12 15h8M12 20h5"/>'),
  presupuesto: I('<rect x="4" y="5" width="24" height="22"/><path d="M4 11h24M4 17h24M4 22h24M12 5v22"/>', '#2e7d32'),
  capitulo: I('<path d="M5 7h22M5 7v18h22V7"/><path d="M9 12h14" stroke-width="3"/>', '#6a1b9a'),
  item: I('<path d="M6 9h20M6 15h20M6 21h12"/><path d="M24 19v8M20 23h8"/>'),
  eliminar: I('<path d="M7 9h18M12 9V5h8v4M9 9l1 18h12l1-18M14 14v9M18 14v9"/>', '#c62828'),
  pegar: I('<path d="M10 6h12v4H10z"/><path d="M8 8H6v20h20V8h-2"/><path d="M11 16h10M11 21h10"/>', '#2e7d32'),
  exportar: I('<path d="M6 20v8h20v-8M16 4v16M10 14l6 6 6-6"/>', '#2e7d32'),
  acta: I('<path d="M7 4h18v24H7z"/><path d="M11 10h10M11 15h10M11 20l3 3 6-6"/>'),
  aprobar: I('<circle cx="16" cy="16" r="12"/><path d="M10 16l4 4 8-8"/>', '#2e7d32'),
  vencimiento: I('<rect x="4" y="7" width="24" height="21" rx="2"/><path d="M4 13h24M10 4v6M22 4v6"/><path d="M16 17v5l3 2"/>', '#c62828'),
  poliza: I('<path d="M16 4l11 4v8c0 7-5 11-11 13C10 27 5 23 5 16V8z"/><path d="M11 16l4 4 7-7"/>', '#00796b'),
  personal: I('<circle cx="12" cy="11" r="5"/><path d="M3 27c1-6 5-8 9-8s8 2 9 8"/><circle cx="23" cy="12" r="4"/><path d="M22 19c4 0 6 3 7 7"/>'),
  correo: I('<rect x="3" y="7" width="26" height="18"/><path d="M3 8l13 10L29 8"/>', '#d18b00'),
  bitacora: I('<path d="M8 4h17v24H8z"/><path d="M8 4c-2 0-3 1-3 3v18c0 2 1 3 3 3"/><path d="M13 10h8M13 15h8"/>', '#5d4037'),
  ensayo: I('<path d="M12 4h8M13 4v9L6 25c-1 2 0 3 2 3h16c2 0 3-1 2-3l-7-12V4"/><path d="M9 20h14"/>', '#6a1b9a'),
  balance: I('<path d="M4 28h24"/><rect x="7" y="16" width="4" height="12"/><rect x="14" y="10" width="4" height="18"/><rect x="21" y="5" width="4" height="23"/>', '#2e7d32'),
  mayores: I('<path d="M5 22l7-7 5 5 10-10"/><path d="M21 10h6v6"/>', '#c62828'),
  informe: I('<path d="M8 4h11l6 6v18H8z"/><path d="M19 4v6h6"/><path d="M12 22v-4M16 22v-7M20 22v-5"/>'),
  memoria: I('<circle cx="9" cy="9" r="4"/><circle cx="23" cy="9" r="4"/><circle cx="16" cy="23" r="4"/><path d="M12 11l3 9M20 11l-3 9M13 9h6"/>', '#6a1b9a'),
  datos: I('<circle cx="16" cy="16" r="4"/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M7 7l3 3M22 22l3 3M7 25l3-3M22 10l3-3"/>', '#555'),
};

// ---------- Estado ----------
const E = { proyectos: [], pid: null, res: null, docs: [], activo: null, cinta: 'inicio', sel: null, lateral: 'pendientes' };
const contrato = tipo => E.res?.contratos.find(c => c.tipo === tipo);

// ---------- Cinta de opciones ----------
const CINTA = {
  inicio: ['Inicio', [
    ['Proyecto', [['Tablero', 'tablero', () => abrir('tablero')], ['Datos del proyecto', 'datos', () => abrir('proyecto')], ['Nuevo proyecto', 'nuevo', nuevoProyecto]]],
    ['Contratos', [['Contrato de obra', 'contrato', () => abrir('contrato:obra')], ['Contrato de interventoría', 'contrato', () => abrir('contrato:interventoria')]]],
    ['Conocimiento', [['Memoria del proyecto', 'memoria', () => mostrarLateral('memoria')]]],
  ]],
  presupuesto: ['Presupuesto', [
    ['Ver', [['Presupuesto de obra', 'presupuesto', () => abrir('presupuesto:' + contrato('obra')?.id)], ['Presupuesto interventoría', 'presupuesto', () => abrir('presupuesto:' + contrato('interventoria')?.id)]]],
    ['Editar', [['Nuevo capítulo', 'capitulo', () => nuevoItem(0), enPresupuesto], ['Nuevo ítem', 'item', () => nuevoItem(1), enPresupuesto],
      ['Eliminar fila', 'eliminar', eliminarItem, enPresupuesto], ['Pegar desde Excel', 'pegar', pegarExcel, enPresupuesto]]],
    ['Exportar', [['Exportar a Excel (CSV)', 'exportar', exportarPresupuesto, enPresupuesto]]],
  ]],
  ejecucion: ['Ejecución', [
    ['Actas de obra', [['Nueva acta', 'acta', () => nuevaActa('obra')], ['Aprobar lo presentado', 'aprobar', aprobarTodo, enActa], ['Exportar acta (CSV)', 'exportar', exportarActa, enActa]]],
    ['Interventoría', [['Nueva cuenta de cobro', 'acta', () => nuevaActa('interventoria')]]],
    ['Registros de obra', [['Bitácora', 'bitacora', () => abrir('tabla:bitacora')], ['Ensayos de laboratorio', 'ensayo', () => abrir('tabla:ensayo')]]],
  ]],
  control: ['Control', [
    ['Seguimiento', [['Vencimientos', 'vencimiento', () => abrir('tabla:vencimiento')], ['Pólizas', 'poliza', () => abrir('tabla:poliza')],
      ['Personal', 'personal', () => abrir('tabla:personal')], ['Correspondencia', 'correo', () => abrir('tabla:correspondencia')]]],
  ]],
  informes: ['Informes', [
    ['Contrato de obra', [['Balance del contrato', 'balance', () => abrir('balance:' + contrato('obra')?.id)], ['Mayores y menores cantidades', 'mayores', () => abrir('mayores:' + contrato('obra')?.id)]]],
    ['Interventoría', [['Balance interventoría', 'balance', () => abrir('balance:' + contrato('interventoria')?.id)], ['Informe mensual (próximamente)', 'informe', null, () => false]]],
  ]],
};
function enPresupuesto() { return E.activo?.startsWith('presupuesto:'); }
function enActa() { return E.activo?.startsWith('acta:'); }

function pintarCinta() {
  $('#pestanas-cinta').innerHTML = Object.entries(CINTA).map(([k, [t]]) => `<button data-c="${k}" class="${k === E.cinta ? 'activo' : ''}">${t}</button>`).join('');
  $('#grupos-cinta').innerHTML = CINTA[E.cinta][1].map(([g, botones], gi) => `<div class="grupo"><div class="grupo-botones">${
    botones.map(([t, ic, fn, ok], bi) => `<button class="btn-cinta" data-g="${gi}" data-b="${bi}" ${!fn || (ok && !ok()) ? 'disabled' : ''}>${ICONOS[ic] || ''}<span>${t}</span></button>`).join('')
  }</div><div class="grupo-nombre">${g}</div></div>`).join('');
}
$('#pestanas-cinta').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { E.cinta = b.dataset.c; pintarCinta(); } });
$('#grupos-cinta').addEventListener('click', e => {
  const b = e.target.closest('.btn-cinta'); if (!b || b.disabled) return;
  CINTA[E.cinta][1][b.dataset.g][1][b.dataset.b][2]();
});

// ---------- Explorador ----------
function pintarArbol() {
  if (!E.res) return;
  const r = E.res, ob = contrato('obra'), it = contrato('interventoria');
  const n = (clave, texto, nivel = 0, cuenta = '', carpeta = false) => `<div class="nodo ${carpeta ? 'carpeta' : ''} ${E.activo === clave ? 'activo' : ''}" style="--nivel:${nivel}" ${clave ? `data-k="${clave}"` : ''}>${texto}<span class="cuenta">${cuenta}</span></div>`;
  let h = n('tablero', '📊 Tablero');
  h += n('', '📁 Contratos', 0, '', true) + n('contrato:obra', 'Obra', 1, ob?.numero || '') + n('contrato:interventoria', 'Interventoría', 1, it?.numero || '');
  h += n('', '📁 Presupuesto', 0, '', true) + (ob ? n('presupuesto:' + ob.id, 'Obra', 1, ob.items + ' ítems') : '') + (it ? n('presupuesto:' + it.id, 'Interventoría', 1, it.items + ' ítems') : '');
  h += n('', '📁 Actas de obra', 0, ob?.actas.length || 0, true) + (ob?.actas || []).map(a => n('acta:' + a.id, `Acta ${a.numero}`, 1, a.estado)).join('');
  h += n('', '📁 Cuentas interventoría', 0, it?.actas.length || 0, true) + (it?.actas || []).map(a => n('acta:' + a.id, `Cuenta ${a.numero}`, 1, a.estado)).join('');
  h += n('', '📁 Control', 0, '', true) + n('tabla:vencimiento', 'Vencimientos', 1, r.vencimientos.length) + n('tabla:poliza', 'Pólizas', 1, r.conteos.poliza)
    + n('tabla:personal', 'Personal', 1, r.conteos.personal) + n('tabla:correspondencia', 'Correspondencia', 1, r.conteos.correspondencia);
  h += n('', '📁 Registros', 0, '', true) + n('tabla:bitacora', 'Bitácora', 1, r.conteos.bitacora) + n('tabla:ensayo', 'Ensayos', 1, r.conteos.ensayo);
  h += n('', '📁 Informes', 0, '', true) + (ob ? n('balance:' + ob.id, 'Balance obra', 1) + n('mayores:' + ob.id, 'Mayores y menores', 1) : '') + (it ? n('balance:' + it.id, 'Balance interventoría', 1) : '');
  $('#arbol').innerHTML = h;
}
$('#arbol').addEventListener('click', e => { const d = e.target.closest('[data-k]'); if (d) abrir(d.dataset.k); });

// ---------- Documentos en pestañas ----------
function tituloDoc(k) {
  const [t, x] = k.split(':');
  const c = E.res?.contratos.find(c => String(c.id) === x);
  const a = t === 'acta' && E.res?.contratos.flatMap(c => c.actas.map(a => ({ ...a, tipo: c.tipo }))).find(a => String(a.id) === x);
  return { tablero: 'Tablero', proyecto: 'Datos del proyecto', contrato: 'Contrato de ' + (x === 'obra' ? 'obra' : 'interventoría'),
    presupuesto: 'Presupuesto ' + (c?.tipo === 'obra' ? 'obra' : 'interventoría'), acta: a ? (a.tipo === 'obra' ? 'Acta ' : 'Cuenta ') + a.numero : 'Acta',
    tabla: TABLAS[x]?.titulo || x, balance: 'Balance ' + (c?.tipo === 'obra' ? 'obra' : 'interventoría'), mayores: 'Mayores y menores' }[t] || k;
}
function abrir(k) {
  if (!k || k.endsWith('undefined')) return aviso('Este proyecto no tiene ese contrato');
  if (!E.docs.includes(k)) E.docs.push(k);
  E.activo = k; E.sel = null;
  if (k.startsWith('presupuesto:')) E.cinta = 'presupuesto';
  if (k.startsWith('acta:')) E.cinta = 'ejecucion';
  pintarDocs();
}
function cerrar(k) {
  E.docs = E.docs.filter(d => d !== k);
  if (E.activo === k) E.activo = E.docs[E.docs.length - 1] || null;
  pintarDocs();
}
$('#pestanas-doc').addEventListener('click', e => {
  const p = e.target.closest('.pestana-doc'); if (!p) return;
  if (e.target.classList.contains('cerrar')) return cerrar(p.dataset.k);
  E.activo = p.dataset.k; E.sel = null; pintarDocs();
});
async function pintarDocs() {
  $('#pestanas-doc').innerHTML = E.docs.map(k => `<div class="pestana-doc ${k === E.activo ? 'activo' : ''}" data-k="${k}">${esc(tituloDoc(k))}<button class="cerrar" title="Cerrar">✕</button></div>`).join('');
  pintarCinta(); pintarArbol();
  const cont = $('#contenido-doc');
  if (!E.activo) { cont.innerHTML = '<div class="vacio">Abra un elemento del explorador o use la cinta de opciones.</div>'; return; }
  const [t, x] = E.activo.split(':');
  try {
    const vista = { tablero: vTablero, proyecto: vProyecto, contrato: vContrato, presupuesto: vPresupuesto, acta: vActa, tabla: vTabla, balance: vBalance, mayores: vMayores }[t];
    await vista(cont, x);
  } catch (e) { cont.innerHTML = `<div class="vacio">Error: ${esc(e.message)}</div>`; }
}
async function refrescar() { E.res = await api('resumen/' + E.pid); pintarLateral(); await pintarDocs(); estadoProyecto(); }

// ---------- Edición en celda ----------
// Al hacer clic en una celda .edit se cambia por un campo; al salir se guarda con fn(valor)
function editable(cont, alGuardar) {
  cont.addEventListener('click', e => {
    const td = e.target.closest('td.edit'); if (!td || td.querySelector('input,select,textarea')) return;
    const tipo = td.dataset.tipo || 'text', valor = td.dataset.v ?? td.textContent;
    let campo;
    if (tipo === 'select') { campo = document.createElement('select'); campo.innerHTML = td.dataset.op.split('|').map(o => `<option ${o === valor ? 'selected' : ''}>${esc(o)}</option>`).join(''); }
    else { campo = document.createElement('input'); campo.type = tipo === 'date' ? 'date' : 'text'; campo.value = valor; }
    td.textContent = ''; td.appendChild(campo); campo.focus(); if (campo.select) campo.select();
    let hecho = false;
    const fin = async guardar => {
      if (hecho) return; hecho = true;
      if (guardar && campo.value !== valor) { try { await alGuardar(td, tipo === 'num' ? num(campo.value) : campo.value); aviso('Guardado'); } catch (er) { aviso('Error: ' + er.message); } }
      pintarDocs(); if (guardar) refrescarSilencioso();
    };
    campo.addEventListener('blur', () => fin(true));
    campo.addEventListener('keydown', ev => { if (ev.key === 'Enter') campo.blur(); if (ev.key === 'Escape') fin(false); });
  });
}
async function refrescarSilencioso() { E.res = await api('resumen/' + E.pid); pintarArbol(); pintarLateral(); estadoProyecto(); }
const celda = (v, campo, tipo = 'text', extra = '') => `<td class="edit ${tipo === 'num' ? 'num' : ''}" data-c="${campo}" data-tipo="${tipo}" data-v="${esc(v ?? '')}" ${extra}>${tipo === 'num' ? fmt(v, 2) : esc(v ?? '')}</td>`;

// ---------- Vistas ----------
async function vTablero(cont) {
  const r = E.res, ob = contrato('obra'), it = contrato('interventoria');
  const tarj = (et, va, no = '', p = null) => `<div class="tarjeta"><div class="et">${et}</div><div class="va">${va}</div>${no ? `<div class="no">${no}</div>` : ''}${p != null ? `<div class="barra"><i style="width:${Math.min(100, p * 100)}%"></i></div>` : ''}</div>`;
  const avOb = ob?.presupuesto ? ob.ejecutado / ob.presupuesto : 0, avIt = it?.presupuesto ? it.ejecutado / it.presupuesto : 0;
  const prox = r.vencimientos.filter(v => v.fecha).slice(0, 6);
  cont.innerHTML = `<h2>${esc(r.proyecto.nombre)}</h2><p class="sub">${esc(r.proyecto.objeto || '')}</p>
  <div class="tarjetas">
    ${tarj('Contrato de interventoría ' + esc(it?.numero || ''), pesos(it?.valor), esc(it?.estado || ''))}
    ${tarj('Presupuesto de interventoría', pesos(it?.presupuesto), it && Math.abs(it.presupuesto - it.valor) > 1 ? 'Difiere del valor del contrato' : 'Cuadra con el contrato')}
    ${tarj('Facturado interventoría', pesos(it?.ejecutado), pct(avIt), avIt)}
    ${tarj('Presupuesto de obra', ob?.presupuesto ? pesos(ob.presupuesto) : 'Sin precios', ob ? ob.items + ' ítems · AIU ' + fmt(ob.aiu_a, 0) + '/' + fmt(ob.aiu_i, 0) + '/' + fmt(ob.aiu_u, 0) : '')}
    ${tarj('Ejecutado obra (acumulado aprobado)', pesos(ob?.ejecutado), pct(avOb), avOb)}
    ${tarj('Actas de obra', ob?.actas.length || 0, ob?.actas.length ? 'Última: ' + ob.actas[ob.actas.length - 1].estado : 'Sin actas')}
  </div>
  <div class="dos-col">
    <div class="caja"><h3>Próximos vencimientos</h3>${prox.length ? `<table class="grilla"><tbody>${prox.map(v => { const d = dias(v.fecha);
      return `<tr><td>${fechaLarga(v.fecha)}</td><td class="${d < 0 || d <= 3 ? 'malo' : ''}">${d < 0 ? 'Vencido hace ' + -d + ' d' : d === 0 ? 'Hoy' : 'En ' + d + ' d'}</td><td>${esc(v.descripcion)}</td></tr>`; }).join('')}</tbody></table>` : '<p class="sub">No hay vencimientos con fecha.</p>'}
      <p class="sub">${r.vencimientos.filter(v => !v.fecha).length} pendientes sin fecha · ver panel derecho</p></div>
    <div class="caja"><h3>Avance del contrato de obra por acta</h3>${curva(ob)}</div>
  </div>`;
}
function curva(c) {
  if (!c || !c.actas.length) return '<p class="sub">Aún no hay actas de obra.</p>';
  const W = 520, H = 200, m = 34, max = Math.max(c.presupuesto || 0, ...c.actas.map(a => a.acumulado)) || 1, n = c.actas.length;
  const x = i => m + (i + 0.5) * (W - m - 10) / n, y = v => H - 20 - v / max * (H - 40);
  const barras = c.actas.map((a, i) => `<rect x="${x(i) - 12}" y="${y(a.valor)}" width="24" height="${H - 20 - y(a.valor)}" fill="#9db8da"/><text x="${x(i)}" y="${H - 6}" text-anchor="middle">A${a.numero}</text>`).join('');
  const linea = c.actas.map((a, i) => `${i ? 'L' : 'M'}${x(i)},${y(a.acumulado)}`).join(' ');
  return `<svg class="curva" viewBox="0 0 ${W} ${H}"><line x1="${m}" y1="${y(max)}" x2="${W - 10}" y2="${y(max)}" stroke="#c62828" stroke-dasharray="4"/><text x="${m}" y="${y(max) - 4}">Valor del contrato</text>${barras}<path d="${linea}" stroke="#1f5fa8" stroke-width="2" fill="none"/>${c.actas.map((a, i) => `<circle cx="${x(i)}" cy="${y(a.acumulado)}" r="3" fill="#1f5fa8"/>`).join('')}</svg>
  <p class="sub">Barras: valor de cada acta · línea: acumulado</p>`;
}

const CAMPOS_PROYECTO = [['nombre', 'Nombre'], ['entidad', 'Entidad contratante'], ['ubicacion', 'Ubicación'], ['objeto', 'Objeto', 'area'], ['carpeta', 'Carpeta de documentos'], ['memoria', 'Memoria-grafo (JSON)']];
const CAMPOS_CONTRATO = [['numero', 'Número'], ['contratante', 'Contratante'], ['contratista', 'Contratista'], ['nit', 'NIT'], ['representante', 'Representante legal'],
  ['objeto', 'Objeto', 'area'], ['valor', 'Valor del contrato', 'num'], ['plazo', 'Plazo'], ['fecha_firma', 'Fecha de firma', 'date'], ['fecha_inicio', 'Acta de inicio', 'date'],
  ['fecha_fin', 'Fecha de terminación', 'date'], ['supervisor', 'Supervisor'], ['aiu_a', 'Administración %', 'num'], ['aiu_i', 'Imprevistos %', 'num'], ['aiu_u', 'Utilidad %', 'num'],
  ['iva_pct', 'IVA %', 'num'], ['iva_base', 'IVA sobre', 'sel:utilidad|total'], ['estampillas_pct', 'Estampillas y retenciones %', 'num'], ['anticipo_pct', 'Anticipo %', 'num'],
  ['estado', 'Estado'], ['notas', 'Notas', 'area']];
function formulario(cont, titulo, campos, datos, tabla) {
  cont.innerHTML = `<h2>${titulo}</h2><p class="sub">Los cambios se guardan al salir de cada campo.</p><div class="formulario">${campos.map(([k, et, t = '']) => {
    const v = datos[k] ?? '';
    const input = t === 'area' ? `<textarea data-k="${k}" rows="3">${esc(v)}</textarea>`
      : t.startsWith('sel:') ? `<select data-k="${k}">${t.slice(4).split('|').map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`
      : `<input data-k="${k}" data-t="${t}" type="${t === 'date' ? 'date' : 'text'}" value="${esc(t === 'num' && v !== '' ? fmt(v, 2) : v)}">`;
    return `<label>${et}</label>${input}`;
  }).join('')}</div>`;
  cont.querySelectorAll('[data-k]').forEach(el => el.addEventListener('change', async () => {
    const v = el.dataset.t === 'num' ? num(el.value) : el.value;
    try { await api(`t/${tabla}/${datos.id}`, 'PUT', { [el.dataset.k]: v }); datos[el.dataset.k] = v; aviso('Guardado'); refrescarSilencioso(); } catch (e) { aviso('Error: ' + e.message); }
  }));
}
async function vProyecto(cont) { formulario(cont, 'Datos del proyecto', CAMPOS_PROYECTO, await api('t/proyecto/' + E.pid), 'proyecto'); }
async function vContrato(cont, tipo) {
  const c = contrato(tipo); if (!c) return (cont.innerHTML = '<div class="vacio">No hay contrato de este tipo.</div>');
  formulario(cont, 'Contrato de ' + (tipo === 'obra' ? 'obra (vigilado)' : 'interventoría'), CAMPOS_CONTRATO, await api('t/contrato/' + c.id), 'contrato');
}

function tablaTotales(t) {
  const filas = [['Costo directo', t.costo_directo], ['Administración', t.administracion], ['Imprevistos', t.imprevistos], ['Utilidad', t.utilidad],
    ['Estampillas y retenciones', t.estampillas], ['Subtotal antes de IVA', t.subtotal], ['IVA', t.iva], ['Componentes fuera del AIU', t.otros], ['TOTAL', t.total]].filter(f => f[1] != null && (f[1] || f[0] === 'TOTAL'));
  return `<table class="grilla" style="max-width:460px;margin-top:10px"><tbody>${filas.map(([e, v]) => `<tr${e === 'TOTAL' ? ' class="cap"' : ''}><td>${e}</td><td class="num">${pesos(v)}</td></tr>`).join('')}</tbody></table>`;
}

async function vPresupuesto(cont, id) {
  const d = await api('presupuesto/' + id);
  const subt = {};
  for (const it of d.items) if (it.tipo === 1 && it.padre_id) subt[it.padre_id] = (subt[it.padre_id] || 0) + it.cantidad * it.vr_unitario;
  cont.innerHTML = `<h2>Presupuesto · contrato de ${d.contrato.tipo === 'obra' ? 'obra' : 'interventoría'} ${esc(d.contrato.numero || '')}</h2>
  <p class="sub">${esc(d.contrato.contratista || '')} · clic en una celda para editar · seleccione una fila para insertar debajo o eliminar</p>
  <div class="grilla-cont"><table class="grilla" id="g-pres"><thead><tr><th>Código</th><th>Descripción</th><th>Und</th><th class="num">Cantidad</th><th class="num">Vr. unitario</th><th class="num">Vr. total</th><th>Fuera AIU</th></tr></thead><tbody>
  ${d.items.map(it => it.tipo === 0
    ? `<tr class="cap ${E.sel === it.id ? 'sel' : ''}" data-id="${it.id}">${celda(it.codigo, 'codigo')}${celda(it.descripcion, 'descripcion')}<td></td><td></td><td></td><td class="num">${pesos(subt[it.id] || 0)}</td><td></td></tr>`
    : `<tr class="${E.sel === it.id ? 'sel' : ''}" data-id="${it.id}">${celda(it.codigo, 'codigo')}${celda(it.descripcion, 'descripcion')}${celda(it.unidad, 'unidad')}${celda(it.cantidad, 'cantidad', 'num')}${celda(it.vr_unitario, 'vr_unitario', 'num')}<td class="num">${pesos(it.cantidad * it.vr_unitario)}</td>${celda(it.sin_aiu ? 'Sí' : 'No', 'sin_aiu', 'select', 'data-op="No|Sí"')}</tr>`).join('')}
  </tbody></table></div>${tablaTotales(d.totales)}`;
  const g = $('#g-pres');
  g.addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr && !e.target.closest('td.edit input')) { E.sel = Number(tr.dataset.id); g.querySelectorAll('tr.sel').forEach(x => x.classList.remove('sel')); tr.classList.add('sel'); } });
  editable(g, (td, v) => api('t/item/' + td.closest('tr').dataset.id, 'PUT', { [td.dataset.c]: td.dataset.c === 'sin_aiu' ? (v === 'Sí' ? 1 : 0) : v }));
}
async function nuevoItem(tipo) {
  const cid = Number(E.activo.split(':')[1]);
  const items = (await api('presupuesto/' + cid)).items, sel = items.find(i => i.id === E.sel);
  const padre = tipo === 0 ? null : sel ? (sel.tipo === 0 ? sel.id : sel.padre_id) : [...items].reverse().find(i => i.tipo === 0)?.id ?? null;
  const orden = tipo === 0 || !sel ? (items.length ? Math.max(...items.map(i => i.orden)) + 1 : 1) : sel.orden + 0.001 + Math.random() * 0.0001;
  const nuevo = await api('t/item', 'POST', { contrato_id: cid, padre_id: padre, tipo, codigo: '', descripcion: tipo === 0 ? 'NUEVO CAPÍTULO' : 'Nuevo ítem', unidad: tipo ? 'UND' : null, cantidad: 0, vr_unitario: 0, orden });
  E.sel = nuevo.id; await refrescar(); aviso(tipo ? 'Ítem agregado' : 'Capítulo agregado');
}
async function eliminarItem() {
  if (!E.sel) return aviso('Seleccione primero una fila');
  if (!confirm('¿Eliminar la fila seleccionada? Si es un capítulo, se eliminan también sus ítems.')) return;
  await api('t/item/' + E.sel, 'DELETE'); E.sel = null; await refrescar(); aviso('Fila eliminada');
}
function pegarExcel() {
  const cid = Number(E.activo.split(':')[1]);
  const f = $('#dialogo-form');
  f.innerHTML = `<h3>Pegar desde Excel</h3><p class="sub">Copie en Excel las columnas <b>Código · Descripción · Unidad · Cantidad · Vr. unitario</b> y péguelas aquí. Las filas sin unidad ni cantidad se toman como capítulos.</p>
  <textarea id="pegado" placeholder="1&#9;PRELIMINARES&#10;1.1&#9;Localización y replanteo&#9;M2&#9;1.500&#9;4.500"></textarea>
  <div class="acciones"><button class="btn" value="no">Cancelar</button><button class="btn prim" value="si" id="ok-pegar">Agregar al final</button></div>`;
  $('#dialogo').showModal();
  $('#ok-pegar').onclick = async ev => {
    ev.preventDefault();
    const filas = $('#pegado').value.split(/\r?\n/).filter(l => l.trim()).map(l => { const c = l.split('\t'); return { codigo: c[0]?.trim(), descripcion: c[1]?.trim(), unidad: c[2]?.trim(), cantidad: num(c[3]), vr_unitario: num(c[4]) }; });
    if (!filas.length) return;
    const r = await api('pegar', 'POST', { contrato_id: cid, filas }); $('#dialogo').close(); await refrescar(); aviso(r.filas + ' filas agregadas');
  };
}
async function exportarPresupuesto() {
  const d = await api('presupuesto/' + E.activo.split(':')[1]);
  const n = v => String(v ?? '').replace('.', ',');
  const lineas = ['sep=;', 'Código;Descripción;Unidad;Cantidad;Vr. unitario;Vr. total', ...d.items.map(i => [i.codigo, `"${(i.descripcion || '').replace(/"/g, '""')}"`, i.unidad || '', i.tipo ? n(i.cantidad) : '', i.tipo ? n(i.vr_unitario) : '', i.tipo ? n(Math.round(i.cantidad * i.vr_unitario * 100) / 100) : ''].join(';'))];
  descargar(`Presupuesto_${d.contrato.tipo}.csv`, '﻿' + lineas.join('\r\n'));
}

// Actas
async function vActa(cont, id) {
  const d = await api('acta/' + id), a = d.acta, esObra = d.contrato.tipo === 'obra';
  const estados = 'Borrador|Presentada|En revisión|Aprobada|Pagada|Rechazada';
  const t = d.totales;
  cont.innerHTML = `<h2>${esObra ? 'Acta parcial de obra' : 'Cuenta de cobro de interventoría'} N.º ${a.numero}</h2>
  <p class="sub">${esc(d.contrato.contratista || '')} · contrato ${esc(d.contrato.numero || '')}</p>
  <table class="grilla" id="g-acta-cab" style="max-width:900px;margin-bottom:10px"><tbody><tr>
    <th>Periodo desde</th>${celda(a.desde, 'desde', 'date')}<th>Hasta</th>${celda(a.hasta, 'hasta', 'date')}<th>Fecha del acta</th>${celda(a.fecha, 'fecha', 'date')}
    <th>Estado</th>${celda(a.estado, 'estado', 'select', `data-op="${estados}"`)}</tr></tbody></table>
  <div class="tarjetas">
    <div class="tarjeta"><div class="et">Presentado por el contratista</div><div class="va">${pesos(t.presentado.total)}</div></div>
    <div class="tarjeta"><div class="et">Aprobado por la interventoría</div><div class="va">${pesos(t.acta.total)}</div><div class="no">${t.presentado.total ? 'Diferencia ' + pesos(t.acta.total - t.presentado.total) : ''}</div></div>
    <div class="tarjeta"><div class="et">Acumulado con esta acta</div><div class="va">${pesos(t.acumulado.total)}</div></div>
    <div class="tarjeta"><div class="et">Ítems con mayor cantidad</div><div class="va">${d.filas.filter(f => f.tipo === 1 && f.saldo < -1e-9).length}</div><div class="no">Acumulado superior a lo contratado</div></div>
  </div>
  <div class="grilla-cont"><table class="grilla" id="g-acta"><thead><tr><th>Código</th><th>Descripción</th><th>Und</th><th class="num">Contratada</th><th class="num">Vr. unit.</th><th class="num">Anterior</th>
    <th class="num">Presentada</th><th class="num">Aprobada</th><th class="num">Acumulada</th><th class="num">Saldo</th><th class="num">% ejec.</th><th class="num">Vr. esta acta</th><th class="num">Vr. acumulado</th><th>Observación</th></tr></thead><tbody>
  ${d.filas.map(f => f.tipo === 0 ? `<tr class="cap"><td>${esc(f.codigo)}</td><td colspan="13">${esc(f.descripcion)}</td></tr>`
    : `<tr data-id="${f.id}" class="${f.saldo < -1e-9 ? 'alerta' : ''}"><td>${esc(f.codigo)}</td><td>${esc(f.descripcion)}</td><td>${esc(f.unidad)}</td><td class="num">${fmt(f.cantidad)}</td><td class="num">${fmt(f.vr_unitario)}</td>
      <td class="num">${fmt(f.anterior)}</td>${celda(f.cant_presentada, 'cant_presentada', 'num')}${celda(f.cant_aprobada, 'cant_aprobada', 'num', f.cant_aprobada !== f.cant_presentada ? 'style="color:#b26a00;font-weight:600"' : '')}
      <td class="num">${fmt(f.acumulado)}</td><td class="num ${f.saldo < -1e-9 ? 'malo' : ''}">${fmt(f.saldo)}</td><td class="num">${pct(f.pct)}</td><td class="num">${pesos(f.vr_acta)}</td><td class="num">${pesos(f.vr_acumulado)}</td>${celda(f.observacion, 'observacion')}</tr>`).join('')}
  </tbody></table></div>
  <div class="dos-col"><div><h3 style="font-size:13px;margin:12px 0 0">Esta acta (aprobado)</h3>${tablaTotales(t.acta)}</div><div><h3 style="font-size:13px;margin:12px 0 0">Acumulado</h3>${tablaTotales(t.acumulado)}</div></div>`;
  editable($('#g-acta'), (td, v) => api(`acta/${id}/item/${td.closest('tr').dataset.id}`, 'PUT', { [td.dataset.c]: v }));
  editable($('#g-acta-cab'), (td, v) => api('t/acta/' + id, 'PUT', { [td.dataset.c]: v }));
}
async function nuevaActa(tipo) {
  const c = contrato(tipo); if (!c) return aviso('No hay contrato de ' + tipo);
  const ult = c.actas[c.actas.length - 1];
  const desde = ult?.hasta ? new Date(new Date(ult.hasta + 'T00:00:00').getTime() + 86400000).toISOString().slice(0, 10) : c.fecha_inicio || hoyISO();
  const a = await api('t/acta', 'POST', { contrato_id: c.id, desde, fecha: hoyISO(), estado: 'Borrador' });
  await refrescar(); abrir('acta:' + a.id); aviso('Acta ' + a.numero + ' creada');
}
async function aprobarTodo() {
  if (!confirm('¿Copiar las cantidades presentadas como aprobadas en todos los ítems de esta acta?')) return;
  await api(`acta/${E.activo.split(':')[1]}/aprobar-todo`, 'POST'); await refrescar(); aviso('Cantidades aprobadas');
}
function exportarActa() { location.href = `/api/acta/${E.activo.split(':')[1]}/csv`; }

// Balance y mayores/menores
async function vBalance(cont, id) {
  const c = E.res.contratos.find(x => String(x.id) === id);
  const saldo = c.presupuesto - c.ejecutado;
  cont.innerHTML = `<h2>Balance del contrato de ${c.tipo === 'obra' ? 'obra' : 'interventoría'} ${esc(c.numero || '')}</h2><p class="sub">${esc(c.contratista || '')}</p>
  <div class="tarjetas"><div class="tarjeta"><div class="et">Valor del contrato</div><div class="va">${pesos(c.valor)}</div></div>
  <div class="tarjeta"><div class="et">Presupuesto cargado</div><div class="va">${pesos(c.presupuesto)}</div></div>
  <div class="tarjeta"><div class="et">Ejecutado acumulado</div><div class="va">${pesos(c.ejecutado)}</div><div class="barra"><i style="width:${c.presupuesto ? Math.min(100, c.ejecutado / c.presupuesto * 100) : 0}%"></i></div></div>
  <div class="tarjeta"><div class="et">Saldo por ejecutar</div><div class="va">${pesos(saldo)}</div></div></div>
  <table class="grilla" style="max-width:760px"><thead><tr><th>Acta</th><th>Periodo</th><th>Estado</th><th class="num">Valor</th><th class="num">Acumulado</th><th class="num">% del contrato</th></tr></thead><tbody>
  ${c.actas.map(a => `<tr><td>${a.numero}</td><td>${fechaLarga(a.desde)} – ${fechaLarga(a.hasta)}</td><td><span class="estado ${esc(a.estado)}">${esc(a.estado)}</span></td><td class="num">${pesos(a.valor)}</td><td class="num">${pesos(a.acumulado)}</td><td class="num">${c.presupuesto ? pct(a.acumulado / c.presupuesto) : ''}</td></tr>`).join('') || '<tr><td colspan="6">Sin actas</td></tr>'}
  </tbody></table><div class="caja" style="margin-top:12px;max-width:760px">${curva(c)}</div>`;
}
async function vMayores(cont, id) {
  const c = E.res.contratos.find(x => String(x.id) === id);
  if (!c.actas.length) return (cont.innerHTML = '<h2>Mayores y menores cantidades</h2><p class="sub">Se calcula con las actas aprobadas; aún no hay actas.</p>');
  const d = await api('acta/' + c.actas[c.actas.length - 1].id);
  const filas = d.filas.filter(f => f.tipo === 1);
  cont.innerHTML = `<h2>Mayores y menores cantidades</h2><p class="sub">Acumulado aprobado hasta el acta ${d.acta.numero} frente a lo contratado</p>
  <div class="grilla-cont"><table class="grilla"><thead><tr><th>Código</th><th>Descripción</th><th>Und</th><th class="num">Contratada</th><th class="num">Ejecutada</th><th class="num">Mayor (+) / menor (−)</th><th class="num">Vr. unitario</th><th class="num">Vr. diferencia</th></tr></thead><tbody>
  ${filas.map(f => { const dif = f.acumulado - f.cantidad; return `<tr class="${dif > 1e-9 ? 'alerta' : ''}"><td>${esc(f.codigo)}</td><td>${esc(f.descripcion)}</td><td>${esc(f.unidad)}</td><td class="num">${fmt(f.cantidad)}</td><td class="num">${fmt(f.acumulado)}</td><td class="num ${dif > 0 ? 'malo' : ''}">${fmt(dif)}</td><td class="num">${fmt(f.vr_unitario)}</td><td class="num">${pesos(dif * f.vr_unitario)}</td></tr>`; }).join('')}
  </tbody></table></div>`;
}

// Tablas sencillas (control y registros)
const ESTADOS = { vencimiento: 'Pendiente|En trámite|Cumplido|Vencido', personal: 'Propuesto|Aprobado|Vinculado|Por vincular|Retirado',
  poliza: 'Pendiente|Radicada|Aprobada|Vigente|Vencida', correspondencia: 'Abierta|Respondida|Cerrada' };
const TABLAS = {
  vencimiento: { titulo: 'Vencimientos y pendientes', cols: [['fecha', 'Fecha', 'date'], ['tipo', 'Tipo'], ['descripcion', 'Descripción'], ['responsable', 'Responsable'], ['estado', 'Estado', 'select'], ['fuente', 'Fuente']] },
  personal: { titulo: 'Personal de interventoría', cols: [['nombre', 'Nombre'], ['cargo', 'Cargo'], ['dedicacion', 'Dedicación %', 'num'], ['cedula', 'Cédula'], ['matricula', 'Matrícula'], ['telefono', 'Teléfono'], ['correo', 'Correo'], ['estado', 'Estado', 'select'], ['notas', 'Notas']] },
  poliza: { titulo: 'Pólizas y garantías', cols: [['contrato', 'Contrato'], ['amparo', 'Amparo'], ['porcentaje', '%', 'num'], ['valor', 'Valor asegurado', 'num'], ['aseguradora', 'Aseguradora'], ['numero', 'N.º póliza'], ['desde', 'Desde', 'date'], ['hasta', 'Hasta', 'date'], ['estado', 'Estado', 'select'], ['notas', 'Notas']] },
  correspondencia: { titulo: 'Correspondencia', cols: [['fecha', 'Fecha', 'date'], ['sentido', 'Sentido', 'select:Recibida|Enviada'], ['radicado', 'Radicado'], ['de', 'De'], ['para', 'Para'], ['asunto', 'Asunto'], ['requiere_respuesta', '¿Responder?', 'select:Sí|No'], ['plazo', 'Plazo', 'date'], ['estado', 'Estado', 'select'], ['archivo', 'Archivo']] },
  bitacora: { titulo: 'Bitácora de obra', cols: [['fecha', 'Fecha', 'date'], ['clima', 'Clima', 'select:Seco|Lluvia|Lluvia intermitente'], ['frente', 'Frente / abscisa'], ['actividades', 'Actividades'], ['personal_obra', 'Personal', 'num'], ['equipos', 'Equipos'], ['observaciones', 'Observaciones']] },
  ensayo: { titulo: 'Ensayos de laboratorio', cols: [['fecha', 'Fecha', 'date'], ['ensayo', 'Ensayo'], ['norma', 'Norma'], ['item', 'Ítem'], ['abscisa', 'Abscisa'], ['resultado', 'Resultado'], ['especificacion', 'Especificación'], ['cumple', 'Cumple', 'select:Sí|No|Pendiente'], ['laboratorio', 'Laboratorio']] },
};
async function vTabla(cont, tabla) {
  const def = TABLAS[tabla], filas = await api(`t/${tabla}?proyecto_id=${E.pid}`);
  const op = t => (t.startsWith('select:') ? t.slice(7) : ESTADOS[tabla] || '');
  cont.innerHTML = `<div class="barra-herr"><h2 style="margin:0">${def.titulo}</h2><span class="esp"></span><button class="btn prim" id="t-nuevo">+ Nueva fila</button></div>
  <div class="grilla-cont"><table class="grilla" id="g-tabla"><thead><tr>${def.cols.map(c => `<th class="${c[2] === 'num' ? 'num' : ''}">${c[1]}</th>`).join('')}<th></th></tr></thead><tbody>
  ${filas.map(f => `<tr data-id="${f.id}">${def.cols.map(([k, , t = 'text']) => {
    if (t.startsWith('select')) return celda(f[k], k, 'select', `data-op="${op(t)}"`).replace('<td class="edit', `<td class="edit${k === 'estado' ? '' : ''}`).replace(/>([^<]*)<\/td>$/, k === 'estado' && f[k] ? `><span class="estado ${esc(f[k])}">${esc(f[k])}</span></td>` : '>$1</td>');
    if (k === 'fecha' || k === 'plazo' || k === 'hasta') { const dd = dias(f[k]); const cls = f.estado !== 'Cumplido' && dd != null && dd <= 3 && tabla !== 'bitacora' && tabla !== 'ensayo' ? 'style="color:#c62828;font-weight:600"' : ''; return celda(f[k], k, 'date', cls); }
    return celda(f[k], k, t);
  }).join('')}<td><button class="btn" data-borrar="${f.id}" title="Eliminar">✕</button></td></tr>`).join('') || `<tr><td colspan="${def.cols.length + 1}" class="sub">Sin registros</td></tr>`}
  </tbody></table></div>`;
  const g = $('#g-tabla');
  editable(g, (td, v) => api(`t/${tabla}/${td.closest('tr').dataset.id}`, 'PUT', { [td.dataset.c]: v }));
  g.addEventListener('click', async e => { const b = e.target.closest('[data-borrar]'); if (b && confirm('¿Eliminar este registro?')) { await api(`t/${tabla}/${b.dataset.borrar}`, 'DELETE'); refrescar(); } });
  $('#t-nuevo').onclick = async () => { await api('t/' + tabla, 'POST', { proyecto_id: E.pid, ...(tabla === 'bitacora' || tabla === 'correspondencia' || tabla === 'ensayo' ? { fecha: hoyISO() } : {}) }); refrescar(); };
}

// ---------- Panel lateral ----------
function mostrarLateral(p) { E.lateral = p; document.querySelectorAll('.lateral-pestanas button').forEach(b => b.classList.toggle('activo', b.dataset.panel === p)); pintarLateral(); }
document.querySelector('.lateral-pestanas').addEventListener('click', e => { const b = e.target.closest('button'); if (b) mostrarLateral(b.dataset.panel); });
async function pintarLateral() {
  const c = $('#lateral-cuerpo');
  if (E.lateral === 'pendientes') {
    c.innerHTML = (E.res?.vencimientos || []).map(v => { const d = dias(v.fecha);
      return `<div class="pend ${d != null && d <= 3 ? 'urgente' : ''}"><div class="f">${v.fecha ? fechaLarga(v.fecha) + ' · ' + (d < 0 ? 'vencido hace ' + -d + ' d' : d === 0 ? 'HOY' : 'faltan ' + d + ' d') : 'Sin fecha'} · ${esc(v.tipo || '')}</div>${esc(v.descripcion)}</div>`; }).join('') || '<p class="sub">Sin pendientes.</p>';
    return;
  }
  c.innerHTML = `<input id="buscar-memoria" placeholder="Buscar en la memoria del proyecto…" value="${esc(E.buscar || '')}"><div id="res-memoria" class="sub">Escriba para buscar (garantía, personal, valor…)</div>`;
  const inp = $('#buscar-memoria');
  const buscar = async () => {
    E.buscar = inp.value;
    try {
      const m = await api(`memoria/${E.pid}?buscar=${encodeURIComponent(inp.value)}`);
      $('#res-memoria').innerHTML = `<p class="sub">${m.hechos.length} de ${m.total} hechos · actualizado ${esc(m.actualizado)}</p>` + m.hechos.slice(0, 60).map(h => `<div class="hecho"><span class="rel">${esc(h.relacion)}</span> · ${esc(h.de)}${h.a ? ' → ' + esc(h.a) : ''}<div>${esc(typeof h.valor === 'number' ? pesos(h.valor) : h.valor ?? '')}</div>${h.nota ? `<div class="fu">${esc(h.nota)}</div>` : ''}<div class="fu">Fuente: ${esc(h.fuente)}</div></div>`).join('');
    } catch (e) { $('#res-memoria').textContent = e.message; }
  };
  inp.addEventListener('input', () => { clearTimeout(buscar.t); buscar.t = setTimeout(buscar, 250); });
  if (E.buscar) buscar();
}

// ---------- Proyectos ----------
async function nuevoProyecto() {
  const nombre = prompt('Nombre del nuevo proyecto de interventoría:'); if (!nombre) return;
  const p = await api('t/proyecto', 'POST', { nombre });
  await api('t/contrato', 'POST', { proyecto_id: p.id, tipo: 'obra', iva_base: 'utilidad', iva_pct: 19 });
  await api('t/contrato', 'POST', { proyecto_id: p.id, tipo: 'interventoria', iva_base: 'total', iva_pct: 19 });
  await cargarProyectos(p.id); abrir('proyecto');
}
async function cargarProyectos(elegir) {
  E.proyectos = await api('t/proyecto');
  E.pid = Number(elegir || leerLocal('proyecto') || E.proyectos[0]?.id);
  if (!E.proyectos.some(p => p.id === E.pid)) E.pid = E.proyectos[0]?.id;
  $('#sel-proyecto').innerHTML = E.proyectos.map(p => `<option value="${p.id}" ${p.id === E.pid ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('');
  guardarLocal('proyecto', E.pid);
  E.docs = []; E.activo = null;
  await refrescar(); abrir('tablero');
}
$('#sel-proyecto').addEventListener('change', e => cargarProyectos(e.target.value));
function estadoProyecto() {
  const it = contrato('interventoria');
  $('#estado-proyecto').textContent = `${E.res.proyecto.nombre} · interventoría ${it?.numero || ''} ${it ? pesos(it.valor) : ''}`;
}
$('#zoom').addEventListener('input', e => { document.body.style.zoom = e.target.value / 100; guardarLocal('zoom', e.target.value); });
const z = leerLocal('zoom'); if (z) { $('#zoom').value = z; document.body.style.zoom = z / 100; }
$('#hoy').textContent = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

cargarProyectos().catch(e => ($('#contenido-doc').innerHTML = `<div class="vacio">No se pudo conectar con el servidor: ${esc(e.message)}</div>`));
