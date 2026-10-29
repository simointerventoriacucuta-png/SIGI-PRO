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
  const r = await fetch('/api/' + ruta, { method: metodo, headers: { 'Content-Type': 'application/json', 'X-Usuario': E.usuario?.id || '' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
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
  nube: I('<path d="M9 24h15a6 6 0 0 0 0-12 8 8 0 0 0-15-2A7 7 0 0 0 9 24z"/>', '#1f5fa8'),
  sincronizar: I('<path d="M6 14a10 10 0 0 1 18-5l2 3M26 18a10 10 0 0 1-18 5l-2-3"/><path d="M26 6v6h-6M6 26v-6h6"/>', '#2e7d32'),
  gasto: I('<rect x="4" y="8" width="24" height="16" rx="2"/><circle cx="16" cy="16" r="4"/><path d="M8 12v0M24 20v0"/>', '#d18b00'),
  costos: I('<circle cx="16" cy="16" r="12"/><path d="M16 4v12l9 6"/>', '#00796b'),
  balance: I('<path d="M4 28h24"/><rect x="7" y="16" width="4" height="12"/><rect x="14" y="10" width="4" height="18"/><rect x="21" y="5" width="4" height="23"/>', '#2e7d32'),
  mayores: I('<path d="M5 22l7-7 5 5 10-10"/><path d="M21 10h6v6"/>', '#c62828'),
  informe: I('<path d="M8 4h11l6 6v18H8z"/><path d="M19 4v6h6"/><path d="M12 22v-4M16 22v-7M20 22v-5"/>'),
  memoria: I('<circle cx="9" cy="9" r="4"/><circle cx="23" cy="9" r="4"/><circle cx="16" cy="23" r="4"/><path d="M12 11l3 9M20 11l-3 9M13 9h6"/>', '#6a1b9a'),
  datos: I('<circle cx="16" cy="16" r="4"/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M7 7l3 3M22 22l3 3M7 25l3-3M22 10l3-3"/>', '#555'),
};

// ---------- Estado ----------
const E = { usuario: null, meta: null, proyectos: [], pid: null, res: null, docs: [], activo: null, cinta: 'inicio', sel: null, lateral: 'pendientes' };
const contrato = tipo => E.res?.contratos.find(c => c.tipo === tipo);

// ---------- Cinta de opciones ----------
// Grupo de edición del presupuesto: aparece en las pestañas Obra e Interventoría
const EDITAR_PRES = ['Editar presupuesto', [['Nuevo capítulo', 'capitulo', () => nuevoItem(0), enPresupuesto], ['Nuevo ítem', 'item', () => nuevoItem(1), enPresupuesto],
  ['Eliminar fila', 'eliminar', eliminarItem, enPresupuesto], ['Pegar desde Excel', 'pegar', pegarExcel, enPresupuesto], ['Importar Excel (.xlsx)', 'pegar', importarExcel, enPresupuesto], ['Exportar a Excel', 'exportar', exportarPresupuesto, enPresupuesto]]];
// Documentos del acta: Excel y Word
const DOC_ACTA = ['Documento del acta', [['Acta en Excel', 'exportar', exportarActa, enActa], ['Acta en Word', 'datos', () => (location.href = `/api/docx/acta/${E.activo.split(':')[1]}`), enActa]]];
const ab = (tipo, vista) => () => abrir(vista + ':' + contrato(tipo)?.id);
const CINTA = {
  inicio: ['Inicio', [
    ['Proyecto', [['Tablero', 'tablero', () => abrir('tablero')], ['Datos del proyecto', 'datos', () => abrir('proyecto')], ['Nuevo proyecto', 'nuevo', nuevoProyecto]]],
    ['Seguimiento', [['Vencimientos', 'vencimiento', () => abrir('tabla:vencimiento')], ['Correspondencia', 'correo', () => abrir('tabla:correspondencia')]]],
    ['Conocimiento', [['Memoria del proyecto', 'memoria', () => mostrarLateral('memoria')], ['Asistente (Claude)', 'memoria', () => mostrarLateral('asistente')], ['Clave del asistente', 'nube', configurarAsistente]]],
    ['Equipo', [['Usuarios', 'personal', () => abrir('usuarios')], ['Auditoría', 'bitacora', () => abrir('auditoria')]]],
    ['Nube', [['Sincronización', 'nube', dialogoSync], ['Sincronizar ahora', 'sincronizar', sincronizarAhora, () => E.res?.sincronizacion?.modo === 'nube']]],
  ]],
  obra: ['Ejecución de obra', [
    ['Contratista', [['Contrato de obra', 'contrato', () => abrir('contrato:obra')], ['Presupuesto de obra', 'presupuesto', ab('obra', 'presupuesto')], ['Otrosíes', 'datos', ab('obra', 'otrosis')], ['Suspensiones', 'vencimiento', ab('obra', 'suspensiones')], ['Liquidación', 'balance', ab('obra', 'liquidacion')]]],
    EDITAR_PRES,
    ['Actas parciales', [['Nueva acta', 'acta', () => nuevaActa('obra')], ['Aprobar lo presentado', 'aprobar', aprobarTodo, enActa]]],
    DOC_ACTA,
    ['Programa y plano', [['Programa de obra (Project)', 'balance', () => abrir('programa')], ['Avance en el plano', 'mayores', () => abrir('plano')]]],
    ['Registros', [['Bitácora', 'bitacora', () => abrir('tabla:bitacora')], ['Ensayos', 'ensayo', () => abrir('tabla:ensayo')]]],
    ['Análisis', [['Balance de obra', 'balance', ab('obra', 'balance')], ['Mayores y menores', 'mayores', ab('obra', 'mayores')]]],
  ]],
  interventoria: ['Contrato de interventoría', [
    ['Contrato propio', [['Contrato de interventoría', 'contrato', () => abrir('contrato:interventoria')], ['Presupuesto de interventoría', 'presupuesto', ab('interventoria', 'presupuesto')], ['Otrosíes', 'datos', ab('interventoria', 'otrosis')], ['Suspensiones', 'vencimiento', ab('interventoria', 'suspensiones')], ['Liquidación', 'balance', ab('interventoria', 'liquidacion')]]],
    EDITAR_PRES,
    ['Facturación', [['Nueva cuenta de cobro', 'acta', () => nuevaActa('interventoria')], ['Balance de facturación', 'balance', ab('interventoria', 'balance')]]],
    DOC_ACTA,
    ['Costos reales', [['Registrar gastos', 'gasto', ab('interventoria', 'gastos')], ['Control de costos', 'costos', ab('interventoria', 'costos')]]],
    ['Recursos', [['Personal', 'personal', () => abrir('tabla:personal')], ['Pólizas', 'poliza', () => abrir('tabla:poliza')]]],
  ]],
  control: ['Control de obra', [
    ['SST', [['Inspecciones y accidentes', 'personal', () => abrir('tabla:sst')], ['Indicadores SST', 'balance', () => abrir('tabla:sst_mes')]]],
    ['Ambiental', [['Fichas PAGA / PMA', 'ensayo', () => abrir('tabla:ambiental')], ['PMT (tránsito)', 'vencimiento', () => abrir('tabla:pmt')]]],
    ['Social', [['Gestión social (PGS) y PQRS', 'correo', () => abrir('tabla:social')]]],
  ]],
  informes: ['Informes', [
    ['Obra', [['Balance de obra', 'balance', ab('obra', 'balance')], ['Mayores y menores cantidades', 'mayores', ab('obra', 'mayores')]]],
    ['Interventoría', [['Control de costos y utilidad', 'costos', ab('interventoria', 'costos')], ['Informe mensual', 'informe', informeMensual]]],
    ['Power BI', [['Gráficos y datos para Power BI', 'balance', () => abrir('graficos')]]],
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
  let h = n('tablero', '📊 Tablero') + n('tabla:vencimiento', '⏰ Vencimientos', 0, r.vencimientos.length) + n('tabla:correspondencia', '✉️ Correspondencia', 0, r.conteos.correspondencia) + n('graficos', '📊 Gráficos y Power BI');
  h += `<div class="seccion obra">EJECUCIÓN DE OBRA · contratista</div>`;
  if (ob) {
    h += n('contrato:obra', '📄 Contrato de obra', 0, ob.numero || '') + n('presupuesto:' + ob.id, '📗 Presupuesto', 0, ob.items + ' ítems') + n('otrosis:' + ob.id, '📝 Otrosíes', 0, ob.otrosis.length) + n('suspensiones:' + ob.id, '⏸️ Suspensiones', 0, ob.suspendido ? 'suspendido' : ob.suspensiones.length) + n('liquidacion:' + ob.id, '🏁 Liquidación', 0, ob.liquidacion?.estado || '');
    h += n('', '📁 Actas parciales', 0, ob.actas.length, true) + ob.actas.map(a => n('acta:' + a.id, `Acta ${a.numero}`, 1, a.estado)).join('');
    h += n('tabla:bitacora', '📓 Bitácora', 0, r.conteos.bitacora) + n('tabla:ensayo', '🧪 Ensayos', 0, r.conteos.ensayo);
    h += n('balance:' + ob.id, '📈 Balance de obra', 0) + n('mayores:' + ob.id, '⚖️ Mayores y menores', 0) + n('programa', '🗓️ Programa de obra', 0) + n('plano', '🗺️ Avance en el plano', 0);
    h += n('', '🌳 Ambiental', 0, '', true) + n('tabla:ambiental', 'Fichas PAGA / PMA', 1) + n('tabla:pmt', 'PMT (tránsito)', 1)
      + n('', '🤝 Social', 0, '', true) + n('tabla:social', 'Gestión social y PQRS', 1)
      + n('', '⛑️ SST', 0, '', true) + n('tabla:sst', 'Inspecciones y accidentes', 1) + n('tabla:sst_mes', 'Indicadores SST', 1);
  }
  h += `<div class="seccion interv">CONTRATO DE INTERVENTORÍA · propio</div>`;
  if (it) {
    h += n('contrato:interventoria', '📄 Contrato de interventoría', 0, it.numero || '') + n('presupuesto:' + it.id, '📗 Presupuesto', 0, it.items + ' ítems') + n('otrosis:' + it.id, '📝 Otrosíes', 0, it.otrosis.length) + n('suspensiones:' + it.id, '⏸️ Suspensiones', 0, it.suspendido ? 'suspendido' : it.suspensiones.length) + n('liquidacion:' + it.id, '🏁 Liquidación', 0, it.liquidacion?.estado || '');
    h += n('', '📁 Cuentas de cobro', 0, it.actas.length, true) + it.actas.map(a => n('acta:' + a.id, `Cuenta ${a.numero}`, 1, a.estado)).join('');
    h += n('gastos:' + it.id, '💵 Gastos reales', 0) + n('costos:' + it.id, '🎯 Control de costos', 0);
    h += n('tabla:personal', '👷 Personal', 0, r.conteos.personal) + n('tabla:poliza', '🛡️ Pólizas', 0, r.conteos.poliza);
    h += n('balance:' + it.id, '📈 Balance de facturación', 0);
  }
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
    tabla: TABLAS[x]?.titulo || x, balance: 'Balance ' + (c?.tipo === 'obra' ? 'obra' : 'interventoría'), mayores: 'Mayores y menores',
    gastos: 'Gastos reales', costos: 'Control de costos', usuarios: 'Usuarios', auditoria: 'Auditoría', otrosis: 'Otrosíes ' + (c?.tipo === 'obra' ? 'obra' : 'interventoría'), programa: 'Programa de obra', plano: 'Avance en el plano', graficos: 'Gráficos y Power BI',
    suspensiones: 'Suspensiones ' + (c?.tipo === 'obra' ? 'obra' : 'interventoría'), liquidacion: 'Liquidación ' + (c?.tipo === 'obra' ? 'obra' : 'interventoría') }[t] || k;
}
// Pestaña de la cinta que corresponde a cada documento
function cintaDe(k) {
  const [t, x] = k.split(':');
  if (t === 'contrato') return x;
  if (['tabla'].includes(t)) return { bitacora: 'obra', ensayo: 'obra', personal: 'interventoria', poliza: 'interventoria', sst: 'control', sst_mes: 'control', ambiental: 'control', pmt: 'control', social: 'control' }[x];
  if (t === 'programa' || t === 'plano') return 'obra';
  if (t === 'graficos') return 'informes';
  if (t === 'acta') return E.res?.contratos.find(c => c.actas.some(a => String(a.id) === x))?.tipo;
  return E.res?.contratos.find(c => String(c.id) === x)?.tipo;
}
function abrir(k) {
  if (!k || k.endsWith('undefined')) return aviso('Este proyecto no tiene ese contrato');
  if (!E.docs.includes(k)) E.docs.push(k);
  E.activo = k; E.sel = null;
  const c = cintaDe(k); if (c) E.cinta = c;
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
    const vista = { tablero: vTablero, proyecto: vProyecto, contrato: vContrato, presupuesto: vPresupuesto, acta: vActa, tabla: vTabla, balance: vBalance, mayores: vMayores, gastos: vGastos, costos: vCostos, usuarios: vUsuarios, auditoria: vAuditoria, otrosis: vOtrosis, programa: vPrograma, plano: vPlano, graficos: vGraficos, suspensiones: vSuspensiones, liquidacion: vLiquidacion }[t];
    await vista(cont, x);
  } catch (e) { cont.innerHTML = `<div class="vacio">Error: ${esc(e.message)}</div>`; }
}
async function refrescar() { E.res = await api('resumen/' + E.pid); pintarCampana(); pintarLateral(); await pintarDocs(); estadoProyecto(); pintarSync(); }

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
window.celda = (v, campo, tipo = 'text', extra = '') => `<td class="edit ${tipo === 'num' ? 'num' : ''}" data-c="${campo}" data-tipo="${tipo}" data-v="${esc(v ?? '')}" ${extra}>${tipo === 'num' ? fmt(v, 2) : esc(v ?? '')}</td>`;

// ---------- Vistas ----------
async function vTablero(cont) {
  const r = E.res, ob = contrato('obra'), it = contrato('interventoria');
  const tarj = (et, va, no = '', p = null) => `<div class="tarjeta"><div class="et">${et}</div><div class="va">${va}</div>${no ? `<div class="no">${no}</div>` : ''}${p != null ? `<div class="barra"><i style="width:${Math.min(100, p * 100)}%"></i></div>` : ''}</div>`;
  const avOb = ob?.presupuesto ? ob.ejecutado / ob.presupuesto : 0, avIt = it?.presupuesto ? it.ejecutado / it.presupuesto : 0;
  const pGas = it?.costo_directo ? it.gastado / it.costo_directo : 0;
  const prox = r.vencimientos.filter(v => v.fecha).slice(0, 6);
  cont.innerHTML = `<h2>${esc(r.proyecto.nombre)}</h2><p class="sub">${esc(r.proyecto.objeto || '')}</p>
  <div class="seccion obra">EJECUCIÓN DE OBRA · ${esc(ob?.contratista || 'contratista')}</div>
  <div class="tarjetas">
    ${tarj('Presupuesto de obra', ob?.presupuesto ? pesos(ob.presupuesto) : 'Sin precios', ob ? ob.items + ' ítems · AIU ' + fmt(ob.aiu_a, 0) + '/' + fmt(ob.aiu_i, 0) + '/' + fmt(ob.aiu_u, 0) : '')}
    ${tarj('Ejecutado (acumulado aprobado)', pesos(ob?.ejecutado), pct(avOb) + ' del contrato', avOb)}
    ${tarj('Actas parciales', ob?.actas.length || 0, ob?.actas.length ? 'Última: ' + ob.actas[ob.actas.length - 1].estado : 'Sin actas')}
    ${tarj('Saldo por ejecutar', pesos((ob?.presupuesto || 0) - (ob?.ejecutado || 0)))}
  </div>
  <div class="seccion interv">CONTRATO DE INTERVENTORÍA ${esc(it?.numero || '')} · ${esc(it?.contratista || '')}</div>
  <div class="tarjetas">
    ${tarj('Valor del contrato', pesos(it?.valor_vigente), esc(it?.estado || '') + (it && Math.abs(it.presupuesto - it.valor) > 1 ? ' · el presupuesto difiere' : ' · presupuesto cuadra'))}
    ${tarj('Facturado (cuentas de cobro)', pesos(it?.ejecutado), pct(avIt) + ' del contrato', avIt)}
    ${tarj('Gastado real', pesos(it?.gastado), pct(pGas) + ' del costo directo', pGas)}
    ${tarj('Utilidad a la fecha', pesos((it?.ejecutado || 0) - (it?.gastado || 0)), 'Facturado − gastado (antes de impuestos)')}
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
async function exportarPresupuesto() { location.href = '/api/xlsx/presupuesto/' + E.activo.split(':')[1]; }
// Elegir un archivo del equipo y leerlo como texto o base64
function elegirArchivo(acepta, comoTexto) {
  return new Promise(ok => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = acepta;
    i.onchange = () => { const f = i.files[0]; if (!f) return ok(null); const r = new FileReader();
      r.onload = () => ok(comoTexto ? r.result : String(r.result).split(',')[1]); comoTexto ? r.readAsText(f) : r.readAsDataURL(f); };
    i.click();
  });
}
async function importarExcel() {
  const archivo = await elegirArchivo('.xlsx', false); if (!archivo) return;
  try { const r = await api('xlsx/importar/' + E.activo.split(':')[1], 'POST', { archivo }); await refrescar(); aviso(`${r.filas} filas importadas del Excel`); } catch (e) { aviso('Error: ' + e.message); }
}
async function exportarPresupuestoCsv() {
  const d = await api('presupuesto/' + E.activo.split(':')[1]);
  const n = v => String(v ?? '').replace('.', ',');
  const lineas = ['sep=;', 'Código;Descripción;Unidad;Cantidad;Vr. unitario;Vr. total', ...d.items.map(i => [i.codigo, `"${(i.descripcion || '').replace(/"/g, '""')}"`, i.unidad || '', i.tipo ? n(i.cantidad) : '', i.tipo ? n(i.vr_unitario) : '', i.tipo ? n(Math.round(i.cantidad * i.vr_unitario * 100) / 100) : ''].join(';'))];
  descargar(`Presupuesto_${d.contrato.tipo}.csv`, '﻿' + lineas.join('\r\n'));
}

// Actas
async function vActa(cont, id) {
  const d = await api('acta/' + id), a = d.acta, esObra = d.contrato.tipo === 'obra';
  const pasos = E.meta.estados_acta, i = pasos.indexOf(a.estado), bloq = i >= E.meta.bloqueo;
  // Acta aprobada o posterior: celdas de solo lectura
  const celda = bloq ? (v, c, tipo = 'text', extra = '') => `<td class="${tipo === 'num' ? 'num' : ''}" ${extra}>${tipo === 'num' ? fmt(v, 2) : esc(v ?? '')}</td>` : window.celda;
  const t = d.totales;
  cont.innerHTML = `<h2>${esObra ? 'Acta parcial de obra' : 'Cuenta de cobro de interventoría'} N.º ${a.numero}</h2>
  <p class="sub">${esc(d.contrato.contratista || '')} · contrato ${esc(d.contrato.numero || '')}</p>
  <table class="grilla" id="g-acta-cab" style="max-width:900px;margin-bottom:10px"><tbody><tr>
    <th>Periodo desde</th>${celda(a.desde, 'desde', 'date')}<th>Hasta</th>${celda(a.hasta, 'hasta', 'date')}<th>Fecha del acta</th>${celda(a.fecha, 'fecha', 'date')}</tr></tbody></table>
  <div class="pasos" id="pasos-acta">${pasos.map((p, k) => `<button class="paso ${k < i ? 'listo' : ''} ${k === i ? 'actual' : ''} ${p === 'Con observaciones' ? 'obs' : ''}" data-n="${k + 1}" data-e="${esc(p)}" ${k === i ? 'disabled' : ''} title="${k === i ? 'Estado actual' : 'Pasar a: ' + esc(p)}">${esc(p)}</button>`).join('')}</div>
  ${bloq ? `<div class="candado">🔒 Acta en estado <b>${esc(a.estado)}</b>: no se puede editar. Solo el director puede reabrirla devolviéndola a un estado anterior.</div>` : ''}
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
  $('#pasos-acta').onclick = async e => {
    const b = e.target.closest('.paso'); if (!b || b.disabled || !confirm(`¿Pasar el acta ${a.numero} a "${b.dataset.e}"?`)) return;
    try { await api('t/acta/' + id, 'PUT', { estado: b.dataset.e }); aviso('Estado: ' + b.dataset.e); await refrescar(); } catch (er) { aviso('Error: ' + er.message); }
  };
}
async function nuevaActa(tipo) {
  const c = contrato(tipo); if (!c) return aviso('No hay contrato de ' + tipo);
  const ult = c.actas[c.actas.length - 1];
  const desde = ult?.hasta ? new Date(new Date(ult.hasta + 'T00:00:00').getTime() + 86400000).toISOString().slice(0, 10) : c.fecha_inicio || hoyISO();
  const a = await api('t/acta', 'POST', { contrato_id: c.id, desde, fecha: hoyISO(), estado: 'Borrador' });
  await refrescar(); abrir('acta:' + a.id); aviso('Acta ' + a.numero + ' creada');
}
// ---------- Otrosíes: historial del valor y del plazo ----------
async function vOtrosis(cont, cid) {
  const c = E.res.contratos.find(x => String(x.id) === cid);
  cont.innerHTML = `<div class="barra-herr"><h2 style="margin:0">Otrosíes y modificaciones · contrato ${esc(c.numero || '')}</h2><span class="esp"></span><button class="btn prim" id="o-nuevo">+ Nuevo otrosí</button></div>
  <div class="tarjetas">
    <div class="tarjeta"><div class="et">Valor original</div><div class="va">${pesos(c.valor)}</div></div>
    <div class="tarjeta"><div class="et">Adiciones firmadas</div><div class="va">${pesos(c.adiciones)}</div><div class="no">${c.valor ? pct(c.adiciones / c.valor) + ' del original' + (c.adiciones > c.valor / 2 ? ' · supera el 50 % (art. 40 Ley 80)' : '') : ''}</div></div>
    <div class="tarjeta"><div class="et">Valor vigente</div><div class="va">${pesos(c.valor_vigente)}</div></div>
    <div class="tarjeta"><div class="et">Plazo</div><div class="va">${esc(c.plazo || '—')}${c.prorroga_dias ? ' + ' + c.prorroga_dias + ' d' : ''}</div><div class="no">Terminación vigente: ${fechaLarga(c.fecha_fin_vigente) || '—'}</div></div>
  </div>
  <div class="grilla-cont"><table class="grilla" id="g-otrosi"><thead><tr><th>N.º</th><th>Fecha</th><th>Tipo</th><th class="num">Valor adicionado</th><th class="num">Días de prórroga</th><th>Objeto / justificación</th><th>Estado</th><th>¿Pólizas ajustadas?</th><th></th></tr></thead><tbody>
  ${c.otrosis.map(o => `<tr data-id="${o.id}"><td>${o.numero}</td>${celda(o.fecha, 'fecha', 'date')}${celda(o.tipo, 'tipo', 'select', 'data-op="Adición|Prórroga|Adición y prórroga|Modificación|Suspensión"')}${celda(o.valor, 'valor', 'num')}${celda(o.dias, 'dias', 'num')}${celda(o.objeto, 'objeto')}${celda(o.estado, 'estado', 'select', 'data-op="En trámite|Firmado|Anulado"')}${celda(o.polizas_ajustadas, 'polizas_ajustadas', 'select', 'data-op="No|Sí"', )}<td><button class="btn" data-borrar="${o.id}" title="Eliminar">✕</button></td></tr>`).join('') || '<tr><td colspan="9" class="sub">Sin otrosíes</td></tr>'}
  </tbody></table></div>
  <p class="sub">Solo los otrosíes en estado Firmado suman al valor y al plazo vigentes. Mientras las pólizas no estén ajustadas, la campana lo recuerda.</p>`;
  const g = $('#g-otrosi');
  editable(g, (td, v) => api('t/otrosi/' + td.closest('tr').dataset.id, 'PUT', { [td.dataset.c]: v }));
  g.addEventListener('click', async e => { const b = e.target.closest('[data-borrar]'); if (b && confirm('¿Eliminar este otrosí?')) { try { await api('t/otrosi/' + b.dataset.borrar, 'DELETE'); refrescar(); } catch (er) { aviso('Error: ' + er.message); } } });
  $('#o-nuevo').onclick = async () => { try { await api('t/otrosi', 'POST', { contrato_id: c.id, fecha: hoyISO(), estado: 'En trámite' }); refrescar(); } catch (e) { aviso('Error: ' + e.message); } };
}

// ---------- Programa de obra (Microsoft Project) ----------
async function vPrograma(cont) {
  const d = await api('programa/' + E.pid);
  const t = d.tareas.filter(x => x.inicio && x.fin);
  const ini = Math.min(...t.map(x => Date.parse(x.inicio))), fin = Math.max(...t.map(x => Date.parse(x.fin)));
  const X = f => (t.length ? ((Date.parse(f) - ini) / Math.max(1, fin - ini)) * 100 : 0);
  const sem = d.spi == null ? '' : d.spi >= 0.95 ? 'bueno' : d.spi >= 0.85 ? '' : 'malo';
  cont.innerHTML = `<div class="barra-herr"><h2 style="margin:0">Programa de obra</h2><span class="esp"></span>
    <button class="btn" id="p-importar">Importar de Project (.xml)</button><button class="btn" id="p-exportar" ${d.tareas.length ? '' : 'disabled'}>Exportar a Project (.xml)</button></div>
  <p class="sub">En Microsoft Project: Archivo → Guardar como → XML. Al importar se reemplaza el programa actual. El avance real se edita aquí y vuelve a Project al exportar.</p>
  <div class="tarjetas">
    <div class="tarjeta"><div class="et">Programado a hoy</div><div class="va">${fmt(d.programado, 1)} %</div></div>
    <div class="tarjeta"><div class="et">Ejecutado</div><div class="va">${fmt(d.real, 1)} %</div><div class="barra"><i style="width:${Math.min(100, d.real)}%"></i></div></div>
    <div class="tarjeta"><div class="et">Índice de cumplimiento (SPI)</div><div class="va ${sem}">${d.spi == null ? '—' : fmt(d.spi, 2)}</div><div class="no">≥ 0,95 al día · 0,85–0,95 atención · &lt; 0,85 atrasado</div></div>
  </div>
  <div class="grilla-cont"><table class="grilla" id="g-programa"><thead><tr><th>EDT</th><th>Actividad</th><th>Inicio</th><th>Fin</th><th class="num">Programado</th><th class="num">Real %</th><th style="width:38%">Diagrama</th></tr></thead><tbody>
  ${d.tareas.map(x => `<tr data-id="${x.id}" class="${x.resumen ? 'cap' : ''}"><td>${esc(x.wbs)}</td><td style="padding-left:${(x.nivel - 1) * 14 + 6}px">${esc(x.nombre)}</td><td>${fechaLarga(x.inicio)}</td><td>${fechaLarga(x.fin)}</td>
    <td class="num">${fmt(x.programado, 1)} %</td>${x.resumen ? `<td class="num">${fmt(x.avance_real, 1)}</td>` : celda(x.avance_real, 'avance_real', 'num', x.avance_real + 5 < x.programado ? 'style="color:#c62828;font-weight:600"' : '')}
    <td><div class="gantt">${x.inicio && x.fin ? `<i style="left:${X(x.inicio)}%;width:${Math.max(0.6, X(x.fin) - X(x.inicio))}%"><b style="width:${Math.min(100, x.avance_real)}%"></b></i>` : ''}<s style="left:${X(d.hoy)}%"></s></div></td></tr>`).join('') || '<tr><td colspan="7" class="sub">Importe el programa desde Microsoft Project</td></tr>'}
  </tbody></table></div>`;
  editable($('#g-programa'), (td, v) => api('t/tarea/' + td.closest('tr').dataset.id, 'PUT', { avance_real: v }));
  $('#p-importar').onclick = async () => {
    const xml = await elegirArchivo('.xml', true); if (!xml) return;
    try { const r = await api('project/' + E.pid, 'POST', { xml }); aviso(`${r.tareas} actividades importadas`); pintarDocs(); } catch (e) { aviso('Error: ' + e.message); }
  };
  $('#p-exportar').onclick = () => (location.href = `/api/project/${E.pid}/xml`);
}

// ---------- Avance en el plano (LandXML de Civil 3D / InfraWorks) ----------
const colorAvance = a => (a >= 100 ? '#2e7d32' : a >= 50 ? '#7cb342' : a > 0 ? '#f9a825' : '#bdbdbd');
// Punto de la polilínea en una abscisa
function puntoEn(al, abs) {
  let falta = abs - al.abs_ini, p = al.puntos;
  for (let i = 1; i < p.length; i++) {
    const l = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    if (falta <= l) { const k = l ? falta / l : 0; return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k]; }
    falta -= l;
  }
  return p[p.length - 1];
}
function tramoPolilinea(al, a, b) {
  const pts = [puntoEn(al, a)];
  let acum = al.abs_ini;
  for (let i = 1; i < al.puntos.length; i++) {
    acum += Math.hypot(al.puntos[i][0] - al.puntos[i - 1][0], al.puntos[i][1] - al.puntos[i - 1][1]);
    if (acum > a && acum < b) pts.push(al.puntos[i]);
  }
  pts.push(puntoEn(al, b));
  return pts;
}
const abscisa = v => (v == null ? '' : `K${Math.floor(v / 1000)}+${String((v % 1000).toFixed(2)).padStart(6, '0')}`);
async function vPlano(cont) {
  const d = await api('plano/' + E.pid);
  const todos = d.alineamientos.flatMap(a => a.puntos);
  let svg = '<p class="sub" style="padding:40px;text-align:center">Importe el eje del corredor desde Civil 3D o InfraWorks (LandXML)</p>';
  if (todos.length) {
    const xs = todos.map(p => p[0]), ys = todos.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const W = 1000, H = 520, m = 30, esc_ = Math.min((W - 2 * m) / Math.max(1, x1 - x0), (H - 2 * m) / Math.max(1, y1 - y0));
    const P = p => `${(m + (p[0] - x0) * esc_).toFixed(1)},${(H - m - (p[1] - y0) * esc_).toFixed(1)}`;
    const lineas = d.alineamientos.map(a => {
      let h = `<polyline points="${a.puntos.map(P).join(' ')}" fill="none" stroke="#9e9e9e" stroke-width="10" stroke-linecap="round"/>`;
      for (const t of d.tramos.filter(t => t.alineamiento_id === a.id && t.abs_ini != null && t.abs_fin != null))
        h += `<polyline points="${tramoPolilinea(a, t.abs_ini, t.abs_fin).map(P).join(' ')}" fill="none" stroke="${colorAvance(t.avance)}" stroke-width="10"><title>${esc(t.nombre || '')} ${abscisa(t.abs_ini)} – ${abscisa(t.abs_fin)}: ${fmt(t.avance, 0)} % ${esc(t.actividad || '')}</title></polyline>`;
      for (let k = Math.ceil(a.abs_ini / 100) * 100; k <= a.abs_ini + a.longitud; k += 100) {
        const [px, py] = P(puntoEn(a, k)).split(',');
        h += `<circle cx="${px}" cy="${py}" r="2.5" fill="#333"/>` + (k % 500 === 0 ? `<text x="${+px + 6}" y="${+py - 6}" font-size="11">${abscisa(k)}</text>` : '');
      }
      const [lx, ly] = P(a.puntos[0]).split(',');
      return h + `<text x="${+lx + 8}" y="${+ly + 16}" font-size="12" font-weight="600">${esc(a.nombre)}</text>`;
    }).join('');
    svg = `<svg viewBox="0 0 ${W} ${H}" class="plano">${lineas}</svg>`;
  }
  const opAl = d.alineamientos.map(a => `${a.id}`).join('|');
  cont.innerHTML = `<div class="barra-herr"><h2 style="margin:0">Avance en el plano</h2><span class="esp"></span>
    <button class="btn" id="pl-importar">Importar eje (LandXML)</button><button class="btn prim" id="pl-tramo" ${d.alineamientos.length ? '' : 'disabled'}>+ Tramo</button></div>
  <p class="sub">En Civil 3D: Salida → Exportar a LandXML; en InfraWorks: Exportar → LandXML. Pase el mouse sobre un tramo para ver su avance.
    <span class="leyenda"><i style="background:#bdbdbd"></i>Sin iniciar <i style="background:#f9a825"></i>En ejecución <i style="background:#7cb342"></i>≥ 50 % <i style="background:#2e7d32"></i>Terminado</span></p>
  ${svg}
  <div class="grilla-cont"><table class="grilla" id="g-tramos"><thead><tr><th>Eje</th><th>Tramo</th><th class="num">Abscisa inicial (m)</th><th class="num">Abscisa final (m)</th><th>Actividad</th><th class="num">Avance %</th><th>Fecha</th><th>Notas</th><th></th></tr></thead><tbody>
  ${d.tramos.map(t => `<tr data-id="${t.id}">${celda(t.alineamiento_id, 'alineamiento_id', 'select', `data-op="${opAl}"`).replace(/>\d+<\/td>$/, `>${esc(d.alineamientos.find(a => a.id === t.alineamiento_id)?.nombre || '')}</td>`)}${celda(t.nombre, 'nombre')}${celda(t.abs_ini, 'abs_ini', 'num')}${celda(t.abs_fin, 'abs_fin', 'num')}${celda(t.actividad, 'actividad')}${celda(t.avance, 'avance', 'num')}${celda(t.fecha, 'fecha', 'date')}${celda(t.notas, 'notas')}<td><button class="btn" data-borrar="${t.id}">✕</button></td></tr>`).join('') || '<tr><td colspan="9" class="sub">Sin tramos</td></tr>'}
  </tbody></table></div>`;
  const g = $('#g-tramos');
  editable(g, (td, v) => api('t/tramo/' + td.closest('tr').dataset.id, 'PUT', { [td.dataset.c]: td.dataset.c === 'alineamiento_id' ? Number(v) : v }));
  g.addEventListener('click', async e => { const b = e.target.closest('[data-borrar]'); if (b && confirm('¿Eliminar este tramo?')) { await api('t/tramo/' + b.dataset.borrar, 'DELETE'); pintarDocs(); } });
  $('#pl-importar').onclick = async () => {
    const xml = await elegirArchivo('.xml,.landxml', true); if (!xml) return;
    try { const r = await api('landxml/' + E.pid, 'POST', { xml }); aviso(`${r.alineamientos} eje(s) importado(s)`); pintarDocs(); } catch (e) { aviso('Error: ' + e.message); }
  };
  $('#pl-tramo').onclick = async () => {
    const a = d.alineamientos[0], ult = d.tramos.filter(t => t.alineamiento_id === a.id).pop();
    const ini = ult?.abs_fin ?? a.abs_ini;
    try { await api('t/tramo', 'POST', { proyecto_id: E.pid, alineamiento_id: a.id, abs_ini: ini, abs_fin: Math.min(ini + 100, a.abs_ini + a.longitud), avance: 0, fecha: hoyISO() }); pintarDocs(); } catch (e) { aviso('Error: ' + e.message); }
  };
}

// ---------- Gráficos y Power BI ----------
function barras(datos, formato = pesos) {
  const max = Math.max(1, ...datos.map(d => Math.abs(d.v)));
  return `<div class="barras">${datos.map(d => `<div class="fila-barra"><span>${esc(d.n)}</span><div><i style="width:${(Math.abs(d.v) / max) * 100}%;background:${d.c || 'var(--azul)'}"></i></div><b>${formato(d.v)}</b></div>`).join('') || '<p class="sub">Sin datos</p>'}</div>`;
}
async function vGraficos(cont) {
  const ob = contrato('obra'), it = contrato('interventoria');
  const [prog, ind] = await Promise.all([api('programa/' + E.pid), api('sst-indicadores/' + E.pid)]);
  const base = location.origin + '/api/bi/' + E.pid + '/';
  const conjuntos = ['contratos', 'actas', 'items', 'gastos', 'programa', 'tramos', 'sst', 'sst_indicadores', 'ambiental', 'pmt', 'social'];
  cont.innerHTML = `<h2>Gráficos y datos para Power BI</h2>
  <div class="dos-col">
    <div><h3 class="h3">Valor por acta de obra</h3>${barras((ob?.actas || []).map(a => ({ n: 'Acta ' + a.numero, v: a.valor })))}</div>
    <div><h3 class="h3">Cuentas de cobro de interventoría</h3>${barras((it?.actas || []).map(a => ({ n: 'Cuenta ' + a.numero, v: a.valor, c: '#2e7d32' })))}</div>
    <div><h3 class="h3">Ejecución de los contratos</h3>${barras([ob && { n: 'Obra ejecutado', v: ob.ejecutado }, ob && { n: 'Obra vigente', v: ob.valor_vigente, c: '#90a4ae' }, it && { n: 'Interv. facturado', v: it.ejecutado, c: '#2e7d32' }, it && { n: 'Interv. gastado', v: it.gastado, c: '#b26a00' }, it && { n: 'Interv. vigente', v: it.valor_vigente, c: '#90a4ae' }].filter(Boolean))}</div>
    <div><h3 class="h3">Programa de obra</h3>${barras([{ n: 'Programado', v: prog.programado, c: '#90a4ae' }, { n: 'Ejecutado', v: prog.real }], v => fmt(v, 1) + ' %')}</div>
    <div><h3 class="h3">SST · frecuencia de accidentalidad</h3>${barras(ind.map(m => ({ n: m.mes, v: m.frecuencia || 0, c: '#c62828' })), v => fmt(v, 2))}</div>
  </div>
  <h3 class="h3" style="margin-top:18px">Conectar Power BI</h3>
  <p class="sub">En Power BI Desktop: <b>Obtener datos → Web</b>, pegue una de estas direcciones y pulse Aceptar. Con SIGI Pro abierto, <b>Actualizar</b> trae los datos al día. Para tableros compartidos en la nube, active la sincronización con Turso o exporte el CSV.</p>
  <table class="grilla" style="max-width:900px"><tbody>${conjuntos.map(c => `<tr><td>${c}</td><td><code>${esc(base + c + '.csv')}</code></td><td><a href="${base + c}.csv">Descargar CSV</a></td></tr>`).join('')}</tbody></table>`;
}

// ---------- Suspensiones y reinicios ----------
async function vSuspensiones(cont, cid) {
  const c = E.res.contratos.find(x => String(x.id) === cid);
  cont.innerHTML = `<div class="barra-herr"><h2 style="margin:0">Suspensiones y reinicios · contrato ${esc(c.numero || '')}</h2><span class="esp"></span><button class="btn prim" id="s-nueva">+ Nueva suspensión</button></div>
  <div class="tarjetas">
    <div class="tarjeta"><div class="et">Estado</div><div class="va">${c.suspendido ? 'Suspendido' : 'En ejecución'}</div></div>
    <div class="tarjeta"><div class="et">Días suspendidos</div><div class="va">${c.dias_suspendidos}</div><div class="no">Corren la fecha de terminación</div></div>
    <div class="tarjeta"><div class="et">Terminación vigente</div><div class="va">${fechaLarga(c.fecha_fin_vigente) || '—'}</div><div class="no">Original ${fechaLarga(c.fecha_fin) || '—'} + ${c.prorroga_dias} d de prórroga + ${c.dias_suspendidos} d suspendidos</div></div>
  </div>
  <div class="grilla-cont"><table class="grilla" id="g-susp"><thead><tr><th>N.º</th><th>Fecha suspensión</th><th>Fecha reinicio</th><th class="num">Días</th><th>Motivo</th><th>Acta</th><th>Estado</th><th>¿Pólizas ajustadas?</th><th></th></tr></thead><tbody>
  ${c.suspensiones.map(x => `<tr data-id="${x.id}"><td>${x.numero}</td>${celda(x.fecha_suspension, 'fecha_suspension', 'date')}${celda(x.fecha_reinicio, 'fecha_reinicio', 'date')}<td class="num">${diasSusp(x)}</td>${celda(x.motivo, 'motivo')}${celda(x.acta, 'acta')}${celda(x.estado, 'estado', 'select', 'data-op="Suspendido|Reiniciado"')}${celda(x.polizas_ajustadas, 'polizas_ajustadas', 'select', 'data-op="No|Sí"')}<td><button class="btn" data-borrar="${x.id}" title="Eliminar">✕</button></td></tr>`).join('') || '<tr><td colspan="9" class="sub">Sin suspensiones</td></tr>'}
  </tbody></table></div>
  <p class="sub">Mientras siga suspendido, los días se cuentan hasta hoy. Al reiniciar hay que ajustar las pólizas; la campana lo recuerda, y también si la suspensión pasa de 30 días.</p>`;
  const g = $('#g-susp');
  editable(g, (td, v) => api('t/suspension/' + td.closest('tr').dataset.id, 'PUT', { [td.dataset.c]: v }));
  g.addEventListener('click', async e => { const b = e.target.closest('[data-borrar]'); if (b && confirm('¿Eliminar esta suspensión?')) { try { await api('t/suspension/' + b.dataset.borrar, 'DELETE'); refrescar(); } catch (er) { aviso('Error: ' + er.message); } } });
  $('#s-nueva').onclick = async () => { try { await api('t/suspension', 'POST', { contrato_id: c.id, fecha_suspension: hoyISO(), estado: 'Suspendido' }); refrescar(); } catch (e) { aviso('Error: ' + e.message); } };
}
const diasSusp = x => { const fin = x.estado === 'Reiniciado' && x.fecha_reinicio ? x.fecha_reinicio : hoyISO(); return x.fecha_suspension ? Math.max(0, Math.round((new Date(fin) - new Date(x.fecha_suspension)) / 86400000)) : 0; };

// ---------- Liquidación del contrato ----------
async function vLiquidacion(cont, cid) {
  const c = E.res.contratos.find(x => String(x.id) === cid);
  const l = c.liquidacion || {}, pl = c.plazos_liquidacion || {};
  const tarj = (et, va, no = '') => `<div class="tarjeta"><div class="et">${et}</div><div class="va">${va}</div>${no ? `<div class="no">${no}</div>` : ''}</div>`;
  const fila = (et, campo, tipo = 'text', extra = '') => `<tr><th>${et}</th>${celda(l[campo], campo, tipo, extra)}</tr>`;
  cont.innerHTML = `<div class="barra-herr"><h2 style="margin:0">Liquidación · contrato ${esc(c.numero || '')}</h2></div>
  <div class="tarjetas">${tarj('Valor vigente', pesos(c.valor_vigente))}${tarj('Ejecutado acumulado', pesos(c.ejecutado), c.actas.length ? 'Hasta la ' + (c.tipo === 'obra' ? 'acta ' : 'cuenta ') + c.actas[c.actas.length - 1].numero : 'Sin actas')}${tarj('Saldo por ejecutar', pesos(c.valor_vigente - c.ejecutado))}</div>
  <h3>Plazos legales (Ley 1150 de 2007, art. 11)</h3>
  <div class="tarjetas">${tarj('Terminación vigente', fechaLarga(c.fecha_fin_vigente) || '—')}${tarj('Bilateral', fechaLarga(pl.bilateral) || '—', '4 meses desde la terminación')}${tarj('Unilateral', fechaLarga(pl.unilateral) || '—', '2 meses más')}${tarj('Judicial', fechaLarga(pl.judicial) || '—', '2 años más')}</div>
  <h3>Ficha de liquidación</h3>
  <div class="grilla-cont"><table class="grilla" id="g-liq"><tbody>
  ${fila('Tipo', 'tipo', 'select', 'data-op="Bilateral|Unilateral|Judicial"')}${fila('Fecha de recibo final', 'fecha_recibo_final', 'date')}${fila('Fecha de liquidación', 'fecha_liquidacion', 'date')}
  ${fila('Valor ejecutado', 'valor_ejecutado', 'num')}${fila('Saldo a favor del contratista', 'saldo_a_favor_contratista', 'num')}${fila('Saldo a favor de la entidad', 'saldo_a_favor_entidad', 'num')}
  ${fila('Devolución de retenciones', 'devolucion_retenciones', 'num')}${fila('Paz y salvos', 'paz_y_salvos')}${fila('Observaciones', 'observaciones')}${fila('Estado', 'estado', 'select', 'data-op="En trámite|Firmada|Cerrada"')}
  </tbody></table></div>
  <p class="sub">La campana avisa 30 días antes de cada vencimiento mientras la liquidación no esté firmada.</p>`;
  editable($('#g-liq'), async (td, v) => {
    const d = { [td.dataset.c]: v };
    if (c.liquidacion) return api('t/liquidacion/' + c.liquidacion.id, 'PUT', d);
    c.liquidacion = await api('t/liquidacion', 'POST', { contrato_id: c.id, valor_ejecutado: c.ejecutado, ...d });
    return c.liquidacion;
  });
}

// ---------- Usuarios y auditoría ----------
const ROL = { director: 'Director', residente: 'Residente', especialista: 'Especialista', administrativo: 'Administrativo', entidad: 'Entidad (solo consulta)' };
async function vUsuarios(cont) {
  const filas = await api('t/usuario');
  cont.innerHTML = `<div class="barra-herr"><h2 style="margin:0">Usuarios</h2><span class="esp"></span><button class="btn prim" id="u-nuevo">+ Nuevo usuario</button></div>
  <p class="sub">Solo el director crea o cambia usuarios. El correo (Gmail) sirve para entrar a la app escribiéndolo.</p>
  <div class="grilla-cont"><table class="grilla" id="g-usuarios"><thead><tr><th>Nombre</th><th>Rol</th><th>Correo (Gmail)</th><th>Activo</th></tr></thead><tbody>
  ${filas.map(f => `<tr data-id="${f.id}">${celda(f.nombre, 'nombre')}${celda(f.rol, 'rol', 'select', `data-op="${E.meta.roles.join('|')}"`)}${celda(f.correo, 'correo')}${celda(f.activo ? 'Sí' : 'No', 'activo', 'select', 'data-op="Sí|No"')}</tr>`).join('')}
  </tbody></table></div>`;
  editable($('#g-usuarios'), async (td, v) => { await api('t/usuario/' + td.closest('tr').dataset.id, 'PUT', { [td.dataset.c]: td.dataset.c === 'activo' ? (v === 'Sí' ? 1 : 0) : v }); await cargarMeta(); });
  $('#u-nuevo').onclick = async () => {
    const nombre = prompt('Nombre del nuevo usuario:'); if (!nombre) return;
    const correo = prompt('Correo de Gmail (opcional):') || null;
    try { await api('t/usuario', 'POST', { nombre, correo, rol: 'residente' }); await cargarMeta(); pintarDocs(); aviso('Usuario creado: cambie el rol en la tabla'); } catch (e) { aviso('Error: ' + e.message); }
  };
}
async function vAuditoria(cont) {
  const filas = await api('auditoria?limite=300');
  const txt = c => { try { const o = JSON.parse(c); return Object.entries(o || {}).map(([k, v]) => Array.isArray(v) ? `${k}: ${v[0] ?? '∅'} → ${v[1] ?? '∅'}` : `${k}: ${v ?? ''}`).join(' · '); } catch { return c || ''; } };
  cont.innerHTML = `<h2>Auditoría</h2><p class="sub">Últimos 300 cambios: quién, cuándo, tabla, registro y cambio</p>
  <div class="grilla-cont"><table class="grilla"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Tabla</th><th>Id</th><th>Cambio</th></tr></thead><tbody>
  ${filas.map(f => `<tr><td>${new Date(f.fecha).toLocaleString('es-CO')}</td><td>${esc(f.usuario || '—')}</td><td>${esc(f.accion)}</td><td>${esc(f.tabla)}</td><td>${esc(f.registro_id)}</td><td>${esc(txt(f.cambio))}</td></tr>`).join('') || '<tr><td colspan="6" class="sub">Sin cambios registrados</td></tr>'}
  </tbody></table></div>`;
}
async function cargarMeta() {
  E.meta = await api('usuarios');
  if (E.usuario) E.usuario = E.meta.usuarios.find(u => u.id === E.usuario.id) || null;
  pintarUsuario();
}
function pintarUsuario() { $('#usuario-nombre').textContent = E.usuario ? `${E.usuario.nombre} · ${ROL[E.usuario.rol] || E.usuario.rol}` : 'Sin usuario'; }
function fijarUsuario(u) { E.usuario = u; guardarLocal('usuario', u.id); pintarUsuario(); $('#dialogo').close(); aviso('Sesión: ' + u.nombre); if (E.pid) refrescar(); }
// Al abrir la app: elegir usuario de la lista o entrar con el correo de Gmail
function elegirUsuario() {
  const ultimo = Number(leerLocal('usuario'));
  $('#dialogo-form').innerHTML = `<h3>¿Quién está usando SIGI Pro?</h3>
    <div class="lista-usuarios">${E.meta.usuarios.map(u => `<button type="button" data-u="${u.id}" class="${u.id === ultimo ? 'actual' : ''}"><b>${esc(u.nombre)}</b> · ${esc(ROL[u.rol] || u.rol)}${u.correo ? ` <span class="sub">${esc(u.correo)}</span>` : ''}</button>`).join('')}</div>
    <p class="sub">O entre con su correo de Gmail registrado:</p>
    <div style="display:flex;gap:6px"><input id="u-correo" type="email" placeholder="nombre@gmail.com" style="flex:1"><button type="button" class="btn" id="u-entrar">Entrar</button></div>
    <p class="sub" id="u-msg"></p>`;
  $('#dialogo').showModal();
  $('.lista-usuarios').onclick = e => { const b = e.target.closest('[data-u]'); if (b) fijarUsuario(E.meta.usuarios.find(u => u.id === Number(b.dataset.u))); };
  const entrar = async () => { try { fijarUsuario(await api('entrar', 'POST', { correo: $('#u-correo').value })); } catch (e) { $('#u-msg').textContent = e.message; } };
  $('#u-entrar').onclick = entrar;
  $('#u-correo').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); entrar(); } };
}
$('#btn-usuario').onclick = elegirUsuario;

// ---------- Búsqueda global (Ctrl+K) ----------
function buscarGlobal() {
  $('#dialogo-form').innerHTML = `<input id="buscar-global" placeholder="Buscar ítems, actas, correspondencia, pólizas, personal… (Esc para cerrar)" autocomplete="off"><div class="resultados" id="resultados"><p class="sub">Escriba al menos 2 letras</p></div>`;
  $('#dialogo').showModal();
  const inp = $('#buscar-global'); let res = [], sel = 0;
  const pintar = () => ($('#resultados').innerHTML = res.map((r, k) => `<div class="resultado ${k === sel ? 'sel' : ''}" data-k="${k}"><div class="g">${esc(r.grupo)}</div>${esc(r.titulo)}</div>`).join('') || '<p class="sub">Sin resultados</p>');
  const ir = k => { const r = res[k]; if (r) { $('#dialogo').close(); abrir(r.abrir); } };
  inp.oninput = () => { clearTimeout(inp.t); inp.t = setTimeout(async () => { res = await api(`buscar/${E.pid}?q=${encodeURIComponent(inp.value)}`); sel = 0; pintar(); }, 200); };
  inp.onkeydown = e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, Math.min(res.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1))); pintar(); }
    if (e.key === 'Enter') { e.preventDefault(); ir(sel); }
  };
  $('#resultados').onclick = e => { const d = e.target.closest('[data-k]'); if (d) ir(Number(d.dataset.k)); };
  inp.focus();
}
$('#btn-buscar').onclick = buscarGlobal;
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!$('#dialogo').open) buscarGlobal(); } });

// ---------- Campana de avisos (próximos 7 días) ----------
async function pintarCampana() {
  try { E.avisos = await api('avisos/' + E.pid); } catch { return; }
  const n = $('#campana-n'); n.hidden = !E.avisos.length; n.textContent = E.avisos.length;
  $('#panel-avisos').innerHTML = E.avisos.map((v, k) => { const d = dias(v.fecha);
    return `<div class="aviso-fila ${d < 0 ? 'vencido' : ''}" data-k="${k}"><div class="f">${fechaLarga(v.fecha)} · ${d < 0 ? 'vencido hace ' + -d + ' d' : d === 0 ? 'HOY' : 'faltan ' + d + ' d'} · ${esc(v.tipo)}</div>${esc(v.texto)}</div>`; }).join('') || '<p class="sub" style="padding:10px">Nada vence en los próximos 7 días.</p>';
}
$('#btn-campana').onclick = e => { e.stopPropagation(); $('#panel-avisos').hidden = !$('#panel-avisos').hidden; };
$('#panel-avisos').onclick = e => { const d = e.target.closest('[data-k]'); if (d) { $('#panel-avisos').hidden = true; abrir(E.avisos[d.dataset.k].abrir); } };
document.addEventListener('click', e => { if (!e.target.closest('#panel-avisos')) $('#panel-avisos').hidden = true; });

async function aprobarTodo() {
  if (!confirm('¿Copiar las cantidades presentadas como aprobadas en todos los ítems de esta acta?')) return;
  await api(`acta/${E.activo.split(':')[1]}/aprobar-todo`, 'POST'); await refrescar(); aviso('Cantidades aprobadas');
}
function informeMensual() {
  const mes = prompt('Mes del informe (AAAA-MM):', new Date().toISOString().slice(0, 7)); if (!mes) return;
  if (!/^\d{4}-\d{2}$/.test(mes.trim())) return alert('Formato de mes no válido: use AAAA-MM');
  location.href = `/api/docx/informe/${E.pid}?mes=${mes.trim()}`;
}
function exportarActa() { location.href = `/api/xlsx/acta/${E.activo.split(':')[1]}`; }

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

// Gastos reales del contrato propio
async function vGastos(cont, cid) {
  const [gastos, pres] = await Promise.all([api('t/gasto?contrato_id=' + cid), api('presupuesto/' + cid)]);
  const items = pres.items.filter(i => i.tipo === 1);
  const nomItem = id => { const i = items.find(x => x.id === id); return i ? `${i.codigo} ${i.descripcion}` : '(sin ítem)'; };
  const opItems = items.map(i => `${i.codigo} ${i.descripcion}`.replace(/\|/g, '/')).join('|');
  const total = gastos.reduce((s, g) => s + (g.valor || 0), 0);
  cont.innerHTML = `<div class="barra-herr"><h2 style="margin:0">Gastos reales de la interventoría</h2><span class="esp"></span><b>Total: ${pesos(total)}</b><button class="btn prim" id="g-nuevo">+ Nuevo gasto</button></div>
  <p class="sub">Registre aquí lo que realmente se paga (nómina, arriendo, vehículo, laboratorio…) y cárguelo a un ítem del presupuesto para comparar.</p>
  <div class="grilla-cont"><table class="grilla" id="g-gastos"><thead><tr><th>Fecha</th><th>Ítem del presupuesto</th><th>Descripción</th><th>Proveedor / persona</th><th>Documento</th><th class="num">Valor</th><th>Pagado</th><th></th></tr></thead><tbody>
  ${gastos.map(g => `<tr data-id="${g.id}">${celda(g.fecha, 'fecha', 'date')}${celda(nomItem(g.item_id), 'item_id', 'select', `data-op="(sin ítem)|${esc(opItems)}"`)}${celda(g.descripcion, 'descripcion')}${celda(g.proveedor, 'proveedor')}${celda(g.documento, 'documento')}${celda(g.valor, 'valor', 'num')}${celda(g.pagado, 'pagado', 'select', 'data-op="No|Sí"')}<td><button class="btn" data-borrar="${g.id}">✕</button></td></tr>`).join('') || '<tr><td colspan="8" class="sub">Sin gastos registrados</td></tr>'}
  </tbody></table></div>`;
  const g = $('#g-gastos');
  editable(g, (td, v) => {
    if (td.dataset.c === 'item_id') { const i = items.find(x => `${x.codigo} ${x.descripcion}`.replace(/\|/g, '/') === v); v = i ? i.id : null; }
    return api('t/gasto/' + td.closest('tr').dataset.id, 'PUT', { [td.dataset.c]: v });
  });
  g.addEventListener('click', async e => { const b = e.target.closest('[data-borrar]'); if (b && confirm('¿Eliminar este gasto?')) { await api('t/gasto/' + b.dataset.borrar, 'DELETE'); refrescar(); } });
  $('#g-nuevo').onclick = async () => { await api('t/gasto', 'POST', { contrato_id: Number(cid), fecha: hoyISO(), valor: 0, pagado: 'No' }); refrescar(); };
}

// Control de costos: presupuestado vs gastado vs facturado, por ítem
async function vCostos(cont, cid) {
  const d = await api('costos/' + cid), t = d.totales;
  const util = t.facturado_cd - t.gastado;
  cont.innerHTML = `<h2>Control de costos del contrato de interventoría ${esc(d.contrato.numero || '')}</h2>
  <p class="sub">Costo directo presupuestado frente a lo gastado de verdad y a lo facturado en las cuentas de cobro (sin estampillas ni IVA)</p>
  <div class="tarjetas">
    <div class="tarjeta"><div class="et">Costo directo presupuestado</div><div class="va">${pesos(t.presupuestado)}</div><div class="no">Valor del contrato ${pesos(t.valor_contrato)}</div></div>
    <div class="tarjeta"><div class="et">Gastado real</div><div class="va">${pesos(t.gastado)}</div><div class="barra"><i style="width:${t.presupuestado ? Math.min(100, t.gastado / t.presupuestado * 100) : 0}%"></i></div>${d.sin_item ? `<div class="no">${pesos(d.sin_item)} sin ítem asignado</div>` : ''}</div>
    <div class="tarjeta"><div class="et">Facturado (costo directo)</div><div class="va">${pesos(t.facturado_cd)}</div><div class="no">Con estampillas e IVA: ${pesos(t.facturado_total)}</div></div>
    <div class="tarjeta"><div class="et">Margen a la fecha</div><div class="va" style="color:${util < 0 ? 'var(--rojo)' : 'var(--verde)'}">${pesos(util)}</div><div class="no">Facturado − gastado</div></div>
  </div>
  <div class="grilla-cont"><table class="grilla"><thead><tr><th>Código</th><th>Descripción</th><th class="num">Presupuestado</th><th class="num">Gastado</th><th class="num">% gastado</th><th class="num">Saldo</th><th class="num">Facturado</th><th class="num">Margen</th></tr></thead><tbody>
  ${d.filas.map(f => f.tipo === 0 ? `<tr class="cap"><td>${esc(f.codigo)}</td><td colspan="7">${esc(f.descripcion)}</td></tr>`
    : `<tr class="${f.gastado > f.presupuestado + 0.5 ? 'alerta' : ''}"><td>${esc(f.codigo)}</td><td>${esc(f.descripcion)}</td><td class="num">${pesos(f.presupuestado)}</td><td class="num">${pesos(f.gastado)}</td><td class="num">${pct(f.pct)}</td><td class="num ${f.saldo < 0 ? 'malo' : ''}">${pesos(f.saldo)}</td><td class="num">${pesos(f.facturado)}</td><td class="num ${f.margen < 0 ? 'malo' : 'bueno'}">${pesos(f.margen)}</td></tr>`).join('')}
  </tbody><tfoot><tr><td></td><td>TOTAL</td><td class="num">${pesos(t.presupuestado)}</td><td class="num">${pesos(t.gastado)}</td><td></td><td class="num">${pesos(t.presupuestado - t.gastado)}</td><td class="num">${pesos(t.facturado_cd)}</td><td class="num">${pesos(util)}</td></tr></tfoot></table></div>`;
}

// Tablas sencillas (control y registros)
const ESTADOS = { vencimiento: 'Pendiente|En trámite|Cumplido|Vencido', personal: 'Propuesto|Aprobado|Vinculado|Por vincular|Retirado',
  poliza: 'Pendiente|Radicada|Aprobada|Vigente|Vencida', correspondencia: 'Abierta|Respondida|Cerrada',
  sst: 'Abierto|En seguimiento|Cerrado', ambiental: 'Abierto|En seguimiento|Cerrado', social: 'Abierto|En trámite|Respondido|Cerrado', pmt: 'En trámite|Aprobado|Implementado|Cerrado' };
const PROGRAMAS_AMB = 'Desarrollo y aplicación de la gestión ambiental (DAGA)|Actividades constructivas|Gestión hídrica|Biótico (flora y fauna)|Instalaciones temporales, maquinaria y equipos|Gestión social|Seguridad y salud en el trabajo';
const TABLAS = {
  vencimiento: { titulo: 'Vencimientos y pendientes', cols: [['fecha', 'Fecha', 'date'], ['tipo', 'Tipo'], ['descripcion', 'Descripción'], ['responsable', 'Responsable'], ['estado', 'Estado', 'select'], ['fuente', 'Fuente']] },
  personal: { titulo: 'Personal de interventoría', cols: [['nombre', 'Nombre'], ['cargo', 'Cargo'], ['dedicacion', 'Dedicación %', 'num'], ['cedula', 'Cédula'], ['matricula', 'Matrícula'], ['telefono', 'Teléfono'], ['correo', 'Correo'], ['estado', 'Estado', 'select'], ['notas', 'Notas']] },
  poliza: { titulo: 'Pólizas y garantías', cols: [['contrato', 'Contrato'], ['amparo', 'Amparo'], ['porcentaje', '%', 'num'], ['valor', 'Valor asegurado', 'num'], ['aseguradora', 'Aseguradora'], ['numero', 'N.º póliza'], ['desde', 'Desde', 'date'], ['hasta', 'Hasta', 'date'], ['estado', 'Estado', 'select'], ['notas', 'Notas']] },
  correspondencia: { titulo: 'Correspondencia', cols: [['fecha', 'Fecha', 'date'], ['sentido', 'Sentido', 'select:Recibida|Enviada'], ['radicado', 'Radicado'], ['de', 'De'], ['para', 'Para'], ['asunto', 'Asunto'], ['requiere_respuesta', '¿Responder?', 'select:Sí|No'], ['plazo', 'Plazo', 'date'], ['estado', 'Estado', 'select'], ['archivo', 'Archivo']] },
  bitacora: { titulo: 'Bitácora de obra', cols: [['fecha', 'Fecha', 'date'], ['clima', 'Clima', 'select:Seco|Lluvia|Lluvia intermitente'], ['frente', 'Frente / abscisa'], ['actividades', 'Actividades'], ['personal_obra', 'Personal', 'num'], ['equipos', 'Equipos'], ['observaciones', 'Observaciones']] },
  sst: { titulo: 'SST · inspecciones, permisos y accidentes', cols: [['fecha', 'Fecha', 'date'], ['tipo', 'Tipo', 'select:Inspección|Charla|Permiso de trabajo|Entrega de EPP|Verificación seguridad social (PILA/ARL)|Trabajo en alturas|Simulacro|Incidente|Accidente'], ['frente', 'Frente'], ['descripcion', 'Descripción'], ['personas', 'Personas', 'num'], ['dias_incapacidad', 'Días incap.', 'num'], ['hallazgo', 'Hallazgo'], ['accion', 'Acción'], ['responsable', 'Responsable'], ['plazo', 'Plazo', 'date'], ['estado', 'Estado', 'select']] },
  sst_mes: { titulo: 'SST · datos mensuales (Res. 0312 de 2019)', cols: [['mes', 'Mes (AAAA-MM)'], ['trabajadores', 'Trabajadores', 'num'], ['accidentes', 'Accidentes', 'num'], ['accidentes_mortales', 'Mortales', 'num'], ['dias_incapacidad', 'Días incapacidad', 'num'], ['dias_cargados', 'Días cargados', 'num'], ['dias_ausencia', 'Días ausencia', 'num'], ['dias_programados', 'Días programados', 'num'], ['planillas_ok', 'PILA/ARL verificada', 'select:Pendiente|Sí|No'], ['notas', 'Notas']] },
  ambiental: { titulo: 'Seguimiento ambiental (PAGA / PMA)', cols: [['fecha', 'Fecha', 'date'], ['programa', 'Programa', 'select:' + PROGRAMAS_AMB], ['ficha', 'Ficha'], ['actividad', 'Actividad'], ['indicador', 'Indicador'], ['meta', 'Meta', 'num'], ['logro', 'Logro', 'num'], ['cantidad', 'Cantidad', 'num'], ['unidad', 'Und'], ['permiso', 'Permiso'], ['hallazgo', 'Hallazgo'], ['accion', 'Acción'], ['plazo', 'Plazo', 'date'], ['estado', 'Estado', 'select']] },
  pmt: { titulo: 'Planes de manejo de tránsito (PMT)', cols: [['frente', 'Frente'], ['abs_ini', 'Abscisa inicial'], ['abs_fin', 'Abscisa final'], ['cierre', 'Cierre', 'select:Total|Parcial|Por carril|Nocturno'], ['interferencia', 'Interferencia', 'select:Baja|Media|Alta'], ['radicado', 'Radicado aprobación'], ['aprobado', 'Aprobado', 'date'], ['desde', 'Vigente desde', 'date'], ['hasta', 'Vigente hasta', 'date'], ['dispositivos', 'Dispositivos'], ['ultima_inspeccion', 'Última inspección', 'date'], ['cumple', 'Cumple', 'select:Pendiente|Sí|No'], ['estado', 'Estado', 'select'], ['notas', 'Notas']] },
  social: { titulo: 'Gestión social (PGS) y PQRS', cols: [['fecha', 'Fecha', 'date'], ['tipo', 'Tipo', 'select:PQRS|Reunión de inicio|Reunión de avance|Reunión de finalización|Socialización|Acta de vecindad|Mano de obra local|Cultura vial|Visita'], ['ficha', 'Ficha'], ['comunidad', 'Comunidad / peticionario'], ['descripcion', 'Descripción'], ['asistentes', 'Asistentes', 'num'], ['responsable', 'Responsable'], ['respuesta', 'Respuesta'], ['plazo', 'Plazo', 'date'], ['estado', 'Estado', 'select']] },
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
  if (tabla === 'sst_mes') {
    const ind = await api('sst-indicadores/' + E.pid);
    cont.insertAdjacentHTML('beforeend', `<h3 style="font-size:13px;margin:14px 0 4px">Indicadores obligatorios (art. 30 Res. 0312 de 2019)</h3>
    <div class="grilla-cont"><table class="grilla"><thead><tr><th>Mes</th><th class="num">Frecuencia AT</th><th class="num">Severidad AT</th><th class="num">AT mortales %</th><th class="num">Ausentismo %</th><th>PILA/ARL</th></tr></thead><tbody>
    ${ind.map(m => `<tr><td>${esc(m.mes)}</td><td class="num">${fmt(m.frecuencia)}</td><td class="num">${fmt(m.severidad)}</td><td class="num">${fmt(m.mortalidad)}</td><td class="num">${fmt(m.ausentismo)}</td><td>${esc(m.planillas_ok)}</td></tr>`).join('') || '<tr><td colspan="6" class="sub">Agregue los datos del mes arriba</td></tr>'}
    </tbody></table></div><p class="sub">Frecuencia = AT del mes ÷ trabajadores × 100 · Severidad = (días de incapacidad + días cargados) ÷ trabajadores × 100 · Ausentismo = días de ausencia ÷ días programados × 100. Verifique las fórmulas con el texto oficial del Ministerio del Trabajo.</p>`);
  }
  if (tabla === 'social') cont.insertAdjacentHTML('beforeend', '<p class="sub">Para las PQRS el plazo se calcula solo: 15 días hábiles (Ley 1755 de 2015), sin contar sábados ni domingos; ajuste los festivos a mano.</p>');
  const g = $('#g-tabla');
  editable(g, (td, v) => api(`t/${tabla}/${td.closest('tr').dataset.id}`, 'PUT', { [td.dataset.c]: v }));
  g.addEventListener('click', async e => { const b = e.target.closest('[data-borrar]'); if (b && confirm('¿Eliminar este registro?')) { await api(`t/${tabla}/${b.dataset.borrar}`, 'DELETE'); refrescar(); } });
  $('#t-nuevo').onclick = async () => { try { await api('t/' + tabla, 'POST', { proyecto_id: E.pid, ...(['bitacora', 'correspondencia', 'ensayo', 'sst', 'ambiental', 'social'].includes(tabla) ? { fecha: hoyISO() } : tabla === 'sst_mes' ? { mes: hoyISO().slice(0, 7) } : {}) }); refrescar(); } catch (e) { aviso('Error: ' + e.message); } };
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
  if (E.lateral === 'asistente') return pintarAsistente(c);
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

// ---------- Asistente (Claude) ----------
E.chat = [];
function pintarAsistente(c) {
  const md = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  c.innerHTML = `<div id="chat" class="chat">${E.chat.map(m => `<div class="msg ${m.role}">${md(m.content)}</div>`).join('') || '<p class="sub">Pregunte sobre el proyecto: saldos, actas, vencimientos, riesgos…</p>'}</div>
    <textarea id="chat-txt" class="chat-txt" placeholder="Escriba su pregunta y pulse Enter"></textarea>`;
  const txt = $('#chat-txt'), chat = $('#chat'); chat.scrollTop = chat.scrollHeight;
  txt.onkeydown = async e => {
    if (e.key !== 'Enter' || e.shiftKey || !txt.value.trim()) return;
    e.preventDefault();
    E.chat.push({ role: 'user', content: txt.value.trim() }); E.chat.push({ role: 'assistant', content: 'Pensando…' }); pintarAsistente(c);
    try { const r = await api('asistente/' + E.pid, 'POST', { mensajes: E.chat.slice(0, -1) }); E.chat[E.chat.length - 1].content = r.texto; }
    catch (er) { E.chat[E.chat.length - 1].content = '⚠️ ' + er.message; }
    if (E.lateral === 'asistente') pintarAsistente(c);
  };
  txt.focus();
}
async function configurarAsistente() {
  const s = await api('asistente/config');
  const clave = prompt((s.configurado ? 'El asistente ya tiene clave. ' : '') + 'Pegue la clave de la API de Claude (console.anthropic.com). Se guarda solo en este equipo:');
  if (!clave) return;
  try { await api('asistente/config', 'POST', { clave }); aviso('Clave del asistente guardada'); } catch (e) { aviso('Error: ' + e.message); }
}

// ---------- Sincronización con la nube (Turso) ----------
function pintarSync() {
  const s = E.res?.sincronizacion || { modo: 'local' };
  const el = $('#estado-sync');
  if (s.modo !== 'nube') { el.textContent = '💻 Solo este equipo'; el.title = 'Los datos están solo en este computador'; el.className = 'sync local'; return; }
  if (s.error) { el.textContent = '⚠️ Sin conexión'; el.title = s.error; el.className = 'sync error'; return; }
  const hace = s.ultima ? Math.round((Date.now() - new Date(s.ultima)) / 1000) : null;
  el.textContent = '☁️ Sincronizado' + (hace != null ? ` · hace ${hace < 60 ? hace + ' s' : Math.round(hace / 60) + ' min'}` : '');
  el.title = 'Base en la nube: los cambios se comparten con los demás computadores'; el.className = 'sync ok';
}
async function sincronizarAhora() { await api('sync/ahora', 'POST'); await refrescar(); aviso('Sincronizado'); }
async function dialogoSync() {
  const s = await api('sync');
  const f = $('#dialogo-form');
  f.innerHTML = `<h3>Sincronización entre computadores</h3>
  ${s.modo === 'nube' ? `<p>Este equipo está conectado a la nube:<br><b>${esc(s.url)}</b></p><p class="sub">${s.error ? '⚠️ ' + esc(s.error) : 'Última sincronización: ' + (s.ultima ? new Date(s.ultima).toLocaleString('es-CO') : '—')}</p>
    <div class="acciones"><button class="btn" id="sync-quitar">Desconectar este equipo</button><button class="btn prim" value="ok">Cerrar</button></div>`
  : `<p class="sub">Pegue los datos de su base en Turso (turso.tech → su base <b>sigi</b>). El token queda guardado solo en este computador.</p>
    <div class="formulario" style="grid-template-columns:110px 1fr"><label>URL</label><input id="sync-url" placeholder="libsql://sigi-usuario.turso.io">
    <label>Token</label><input id="sync-token" type="password" placeholder="eyJhbGciOi..."></div>
    <p class="sub" id="sync-msg">Si la base de la nube está vacía, se suben los datos de este equipo. Si ya tiene datos (de otro computador), este equipo los descarga.</p>
    <div class="acciones"><button class="btn" value="no">Cancelar</button><button class="btn" id="sync-probar">Probar conexión</button><button class="btn prim" id="sync-activar">Conectar</button></div>`}`;
  $('#dialogo').showModal();
  const datos = () => ({ url: $('#sync-url').value.trim(), token: $('#sync-token').value.trim() });
  const msg = t => ($('#sync-msg').innerHTML = t);
  if ($('#sync-probar')) $('#sync-probar').onclick = async ev => {
    ev.preventDefault(); msg('Probando…');
    try { const r = await api('sync/probar', 'POST', datos()); msg(r.ok ? `✅ Conexión correcta. ${r.tieneDatos ? 'La nube ya tiene datos: este equipo los descargará.' : 'La nube está vacía: se subirán los datos de este equipo.'}` : '❌ No se pudo conectar'); }
    catch (e) { msg('❌ ' + esc(e.message)); }
  };
  if ($('#sync-activar')) $('#sync-activar').onclick = async ev => {
    ev.preventDefault(); msg('Conectando y sincronizando… (puede tardar unos segundos)');
    try { const r = await api('sync/activar', 'POST', datos()); $('#dialogo').close(); await cargarProyectos(); aviso(r.yaTeniaDatos ? 'Conectado: datos descargados de la nube' : `Conectado: ${r.subidas} registros subidos a la nube`); }
    catch (e) { msg('❌ ' + esc(e.message)); }
  };
  if ($('#sync-quitar')) $('#sync-quitar').onclick = async ev => {
    ev.preventDefault();
    if (!confirm('¿Desconectar este equipo de la nube? Volverá a usar sus datos locales anteriores.')) return;
    await api('sync/desactivar', 'POST'); $('#dialogo').close(); await cargarProyectos(); aviso('Equipo desconectado de la nube');
  };
}
// Trae los cambios de otros computadores cada 20 s (si no hay una celda en edición)
setInterval(async () => {
  if (E.res?.sincronizacion?.modo !== 'nube' || document.querySelector('td.edit input, td.edit select, dialog[open]')) return;
  try { const antes = JSON.stringify(E.res); E.res = await api('resumen/' + E.pid); pintarSync(); if (JSON.stringify(E.res) !== antes) { pintarArbol(); pintarLateral(); } } catch {}
}, 20000);

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
  $('#estado-proyecto').textContent = `${E.res.proyecto.nombre} · interventoría ${it?.numero || ''} ${it ? pesos(it.valor_vigente) : ''}`;
}
// Versión (la pasa la app de escritorio en la URL) y ventana "Acerca de"
const VERSION = new URLSearchParams(location.search).get('v') || 'desarrollo';
$('#estado-version').textContent = 'SIGI Pro ' + VERSION;
$('#btn-acerca').onclick = () => {
  $('#dialogo-form').innerHTML = `<div class="acerca"><img src="logo.svg" alt=""><div><h3>SIGI <span>Pro</span></h3>
    <p><b>Sistema Integral de Gestión de Interventoría</b></p><p>Versión ${esc(VERSION)}</p>
    <p>Control de contratos de obra e interventoría: presupuesto, actas parciales, mayores y menores cantidades, vencimientos, pólizas, personal, correspondencia, bitácora y ensayos.</p>
    <p>Datos guardados en este equipo · ${E.proyectos.length} proyecto(s)</p></div></div>
    <div class="acciones"><button class="btn prim" value="ok">Cerrar</button></div>`;
  $('#dialogo').showModal();
};
$('#zoom').addEventListener('input', e => { document.body.style.zoom = e.target.value / 100; guardarLocal('zoom', e.target.value); });
const z = leerLocal('zoom'); if (z) { $('#zoom').value = z; document.body.style.zoom = z / 100; }
$('#hoy').textContent = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

cargarMeta().then(() => { elegirUsuario(); return cargarProyectos(); }).catch(e => ($('#contenido-doc').innerHTML = `<div class="vacio">No se pudo conectar con el servidor: ${esc(e.message)}</div>`));
