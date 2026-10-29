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
  subir: I('<path d="M16 26V6M8 14l8-8 8 8"/>'),
  bajar: I('<path d="M16 6v20M8 18l8 8 8-8"/>'),
  copiar: I('<rect x="10" y="10" width="16" height="18"/><path d="M6 22V4h14"/>'),
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
  asistente: I('<path d="M16 3l3 9 9 4-9 3-3 10-3-10-9-3 9-4z"/>', '#1f5fa8'),
  datos: I('<circle cx="16" cy="16" r="4"/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M7 7l3 3M22 22l3 3M7 25l3-3M22 10l3-3"/>', '#555'),
};

// ---------- Estado ----------
const E = { deshacer: [], ir: null, filtro: {}, usuario: null, meta: null, proyectos: [], pid: null, res: null, docs: [], activo: null, cinta: 'inicio', sel: null, lateral: 'pendientes' };
const contrato = tipo => E.res?.contratos.find(c => c.tipo === tipo);

// ---------- Cinta de opciones ----------
// Grupo de edición del presupuesto: aparece en las pestañas Obra e Interventoría
const EDITAR_PRES = ['Editar presupuesto', [['Nuevo capítulo', 'capitulo', () => nuevoItem(0), enPresupuesto], ['Nuevo ítem', 'item', () => nuevoItem(1), enPresupuesto],
  ['Eliminar fila', 'eliminar', eliminarItem, enPresupuesto], ['Subir fila (Alt+↑)', 'subir', () => moverItem(-1), enPresupuesto], ['Bajar fila (Alt+↓)', 'bajar', () => moverItem(1), enPresupuesto], ['Pegar desde Excel', 'pegar', pegarExcel, enPresupuesto], ['Importar Excel (.xlsx)', 'pegar', importarExcel, enPresupuesto], ['Exportar a Excel', 'exportar', exportarPresupuesto, enPresupuesto]]];
// Documentos del acta: Excel y Word
const DOC_ACTA = ['Documento del acta', [['Acta en Excel', 'exportar', exportarActa, enActa], ['Acta en Word', 'datos', () => (location.href = `/api/docx/acta/${E.activo.split(':')[1]}`), enActa]]];
const ab = (tipo, vista) => () => abrir(vista + ':' + contrato(tipo)?.id);
const CINTA = {
  inicio: ['Inicio', [
    ['Proyecto', [['Tablero', 'tablero', () => abrir('tablero')], ['Datos del proyecto', 'datos', () => abrir('proyecto')], ['Nuevo proyecto', 'nuevo', nuevoProyecto]]],
    ['Seguimiento', [['Calendario', 'vencimiento', () => abrir('calendario')], ['Vencimientos', 'vencimiento', () => abrir('tabla:vencimiento')], ['Correspondencia', 'correo', () => abrir('tabla:correspondencia')]]],
    ['Conocimiento', [['Memoria del proyecto', 'memoria', () => mostrarLateral('memoria')], ['Asistente ✦', 'asistente', abrirAsistente], ['Clave del asistente', 'nube', configurarAsistente]]],
    ['Equipo', [['Usuarios', 'personal', () => abrir('usuarios')], ['Auditoría', 'bitacora', () => abrir('auditoria')]]],
    ['Nube', [['Sincronización', 'nube', dialogoSync], ['Sincronizar ahora', 'sincronizar', sincronizarAhora, () => E.res?.sincronizacion?.modo === 'nube']]],
  ]],
  obra: ['Ejecución de obra', [
    ['Avance en campo', [['Capturar avance', 'aprobar', capturarAvance], ['Capturas de avance', 'datos', () => abrir('avances')]]],
    ['Contratista', [['Contrato de obra', 'contrato', () => abrir('contrato:obra')], ['Presupuesto de obra', 'presupuesto', ab('obra', 'presupuesto')], ['Otrosíes', 'datos', ab('obra', 'otrosis')], ['Suspensiones', 'vencimiento', ab('obra', 'suspensiones')], ['Liquidación', 'balance', ab('obra', 'liquidacion')]]],
    EDITAR_PRES,
    ['Actas parciales', [['Nueva acta', 'acta', () => nuevaActa('obra')], ['Aprobar lo presentado', 'aprobar', aprobarTodo, enActa], ['Copiar acta anterior', 'copiar', copiarAnterior, enActa]]],
    DOC_ACTA,
    ['Programa y plano', [['Programa de obra (Project)', 'balance', () => abrir('programa')], ['Avance en el plano', 'mayores', () => abrir('plano')]]],
    ['Registros', [['Bitácora', 'bitacora', () => abrir('tabla:bitacora')], ['Ensayos', 'ensayo', () => abrir('tabla:ensayo')], ['Registro fotográfico', 'datos', () => abrir('fotos')]]],
    ['Análisis', [['Balance de obra', 'balance', ab('obra', 'balance')], ['Mayores y menores', 'mayores', ab('obra', 'mayores')]]],
  ]],
  interventoria: ['Contrato de interventoría', [
    ['Contrato propio', [['Contrato de interventoría', 'contrato', () => abrir('contrato:interventoria')], ['Presupuesto de interventoría', 'presupuesto', ab('interventoria', 'presupuesto')], ['Otrosíes', 'datos', ab('interventoria', 'otrosis')], ['Suspensiones', 'vencimiento', ab('interventoria', 'suspensiones')], ['Liquidación', 'balance', ab('interventoria', 'liquidacion')]]],
    EDITAR_PRES,
    ['Facturación', [['Nueva cuenta de cobro', 'acta', () => nuevaActa('interventoria')], ['Balance de facturación', 'balance', ab('interventoria', 'balance')]]],
    DOC_ACTA,
    ['Costos reales', [['Registrar gastos', 'gasto', ab('interventoria', 'gastos')], ['Control de costos', 'costos', ab('interventoria', 'costos')]]],
    ['Requisiciones', [['Nueva RQ', 'nuevo', () => nuevaRQ()], ['Requisiciones (RQ)', 'datos', () => abrir('requisiciones')]]],
    ['Recursos', [['Personal', 'personal', () => abrir('tabla:personal')], ['Pólizas', 'poliza', () => abrir('tabla:poliza')]]],
  ]],
  control: ['Control de obra', [
    ['SST', [['Inspecciones y accidentes', 'personal', () => abrir('tabla:sst')], ['Indicadores SST', 'balance', () => abrir('tabla:sst_mes')], ['Matriz de peligros', 'datos', () => abrir('tabla:sst_peligro')], ['Listas de chequeo', 'ensayo', () => abrir('tabla:sst_inspeccion')], ['Informe SST (Word)', 'acta', () => informeSST()]]],
    ['Anexos SST', [['Permisos y ATS', 'acta', () => abrir('tabla:sst_permiso')], ['Capacitaciones', 'correo', () => abrir('tabla:sst_capacitacion')], ['Trabajadores', 'personal', () => abrir('tabla:sst_trabajador')], ['Entrega de EPP', 'poliza', () => abrir('tabla:sst_epp')], ['PILA / ARL', 'gasto', () => abrir('tabla:sst_seguridad_social')], ['Investigación AT', 'vencimiento', () => abrir('tabla:sst_investigacion')], ['Emergencias', 'balance', () => abrir('tabla:sst_emergencia')], ['Maquinaria', 'costos', () => abrir('tabla:sst_equipo')], ['Comités y cronograma', 'datos', () => abrir('tabla:sst_actividad')], ['Soportes del informe', 'presupuesto', () => abrir('tabla:sst_documento')]]],
    ['Ambiental', [['Fichas PAGA / PMA', 'ensayo', () => abrir('tabla:ambiental')], ['PMT (tránsito)', 'vencimiento', () => abrir('tabla:pmt')]]],
    ['Social', [['PQRS', 'correo', () => abrir('tabla:pqrs')], ['Reuniones', 'personal', () => abrir('tabla:reunion')], ['Actas de vecindad', 'acta', () => abrir('tabla:acta_vecindad')], ['Mano de obra local', 'balance', () => abrir('tabla:mano_obra')], ['Otros (PGS)', 'correo', () => abrir('tabla:social')], ['Informe social', 'informe', informeSocial]]],
  ]],
  informes: ['Informes', [
    ['Obra', [['Balance de obra', 'balance', ab('obra', 'balance')], ['Mayores y menores cantidades', 'mayores', ab('obra', 'mayores')]]],
    ['Interventoría', [['Control de costos y utilidad', 'costos', ab('interventoria', 'costos')], ['Informe mensual', 'informe', informeMensual]]],
    ['Power BI', [['Gráficos y datos para Power BI', 'balance', () => abrir('graficos')]]],
  ]],
};
function enPresupuesto() { return E.activo?.startsWith('presupuesto:'); }
function enActa() { return E.activo?.startsWith('acta:'); }

// Como en Excel: grupos de hasta 3 botones grandes; con más, los primeros 2 grandes y el resto chicos en columnas de 3
function pintarCinta() {
  $('#pestanas-cinta').innerHTML = `<button class="archivo" data-c="archivo">Archivo</button>` + Object.entries(CINTA).map(([k, [t]]) => `<button data-c="${k}" class="${k === E.cinta ? 'activo' : ''}">${t}</button>`).join('');
  const boton = (b, gi, bi, chico) => { const [t, ic, fn, ok] = b; return `<button class="${chico ? 'btn-chico' : 'btn-cinta'}" data-g="${gi}" data-b="${bi}" title="${esc(t)}" ${!fn || (ok && !ok()) ? 'disabled' : ''}>${ICONOS[ic] || ''}<span>${t}</span></button>`; };
  $('#grupos-cinta').innerHTML = CINTA[E.cinta][1].map(([g, botones], gi) => {
    const grandes = botones.length > 3 ? 2 : botones.length;
    let h = botones.slice(0, grandes).map((b, bi) => boton(b, gi, bi)).join('');
    for (let i = grandes; i < botones.length; i += 3) h += `<div class="columna-chica">${botones.slice(i, i + 3).map((b, k) => boton(b, gi, i + k, true)).join('')}</div>`;
    return `<div class="grupo"><div class="grupo-botones">${h}</div><div class="grupo-nombre">${g}</div></div>`;
  }).join('');
}
$('#pestanas-cinta').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.c === 'archivo') { e.stopPropagation(); return menuArchivo(); }
  E.cinta = b.dataset.c; $('.cinta').classList.remove('plegada'); pintarCinta();
});
$('#plegar-cinta').onclick = () => { $('.cinta').classList.toggle('plegada'); guardarLocal('cinta-plegada', $('.cinta').classList.contains('plegada') ? '1' : ''); };
if (leerLocal('cinta-plegada')) $('.cinta').classList.add('plegada');
// Menú Archivo (como la vista Backstage de Office)
function menuArchivo() {
  const m = $('#menu-archivo');
  const ops = [['✦ Leer documento con IA', leerDocumentoIA], null, ['Nuevo proyecto', nuevoProyecto], ['Datos del proyecto', () => abrir('proyecto')], null, ['Exportar presupuesto a Excel', () => enPresupuesto() ? exportarPresupuesto() : aviso('Abra un presupuesto')],
    ['Informe mensual (Word)', informeMensual], null, ['Sincronización entre computadores', dialogoSync], ['Usuarios', () => abrir('usuarios')], ['Auditoría', () => abrir('auditoria')], ['Cambiar de usuario', elegirUsuario], null, ['Acerca de SIGI Pro', () => $('#btn-acerca').click()]];
  m.innerHTML = ops.map((o, i) => (o ? `<button data-i="${i}">${o[0]}</button>` : '<hr>')).join('');
  m.hidden = !m.hidden;
  m.onclick = e => { const b = e.target.closest('[data-i]'); if (b) { m.hidden = true; ops[b.dataset.i][1](); } };
}
document.addEventListener('click', e => { if (!e.target.closest('#menu-archivo')) $('#menu-archivo').hidden = true; });
$('#btn-actualizar').onclick = () => refrescar().then(() => aviso('Actualizado'));
$('#btn-inicio-rapido').onclick = () => abrir('tablero');
$('#btn-captura').onclick = () => capturarAvance();
$('#btn-doc-ia').onclick = () => leerDocumentoIA();
document.addEventListener('keydown', e => { if (e.key === 'F5') { e.preventDefault(); refrescar(); } });
$('#grupos-cinta').addEventListener('click', e => {
  const b = e.target.closest('.btn-cinta'); if (!b || b.disabled) return;
  CINTA[E.cinta][1][b.dataset.g][1][b.dataset.b][2]();
});

// ---------- Explorador ----------
function pintarArbol() {
  if (!E.res) return;
  const r = E.res, ob = contrato('obra'), it = contrato('interventoria');
  const n = (clave, texto, nivel = 0, cuenta = '', carpeta = false) => `<div class="nodo ${carpeta ? 'carpeta' : ''} ${E.activo === clave ? 'activo' : ''}" style="--nivel:${nivel}" ${clave ? `data-k="${clave}"` : ''}>${texto}<span class="cuenta">${cuenta}</span></div>`;
  let h = n('tablero', '📊 Tablero') + n('calendario', '📅 Calendario') + n('tabla:vencimiento', '⏰ Vencimientos', 0, r.vencimientos.length) + n('tabla:correspondencia', '✉️ Correspondencia', 0, r.conteos.correspondencia) + n('graficos', '📊 Gráficos y Power BI') + n('fotos', '📷 Registro fotográfico');
  h += `<div class="seccion obra">EJECUCIÓN DE OBRA · contratista</div>`;
  if (ob) {
    h += n('contrato:obra', '📄 Contrato de obra', 0, ob.numero || '') + n('presupuesto:' + ob.id, '📗 Presupuesto', 0, ob.items + ' ítems') + n('otrosis:' + ob.id, '📝 Otrosíes', 0, ob.otrosis.length) + n('suspensiones:' + ob.id, '⏸️ Suspensiones', 0, ob.suspendido ? 'suspendido' : ob.suspensiones.length) + n('liquidacion:' + ob.id, '🏁 Liquidación', 0, ob.liquidacion?.estado || '');
    h += n('', '📁 Actas parciales', 0, ob.actas.length, true) + ob.actas.map(a => n('acta:' + a.id, `Acta ${a.numero}`, 1, a.estado)).join('');
    h += n('tabla:bitacora', '📓 Bitácora', 0, r.conteos.bitacora) + n('tabla:ensayo', '🧪 Ensayos', 0, r.conteos.ensayo);
    h += n('balance:' + ob.id, '📈 Balance de obra', 0) + n('mayores:' + ob.id, '⚖️ Mayores y menores', 0) + n('avances', '📍 Capturas de avance', 0) + n('programa', '🗓️ Programa de obra', 0) + n('plano', '🗺️ Avance en el plano', 0);
    h += n('', '🌳 Ambiental', 0, '', true) + n('tabla:ambiental', 'Fichas PAGA / PMA', 1) + n('tabla:pmt', 'PMT (tránsito)', 1)
      + n('', '🤝 Social', 0, '', true) + n('tabla:pqrs', 'PQRS', 1) + n('tabla:reunion', 'Reuniones', 1) + n('tabla:acta_vecindad', 'Actas de vecindad', 1)
      + n('tabla:mano_obra', 'Mano de obra local', 1) + n('tabla:capacitacion', 'Cultura vial y capacitaciones', 1) + n('tabla:afectacion', 'Afectaciones a predios y servicios', 1)
      + n('tabla:encuesta', 'Encuestas de satisfacción', 1) + n('tabla:veeduria', 'Veedurías ciudadanas', 1) + n('tabla:social', 'Otras actividades (PGS)', 1)
      + n('', '⛑️ SST', 0, '', true) + n('tabla:sst', 'Inspecciones y accidentes', 1) + n('tabla:sst_mes', 'Indicadores SST', 1)
      + SST_ANEXOS.map(t => n('tabla:' + t, TABLAS[t].titulo.replace('SST · ', ''), 1)).join('');
  }
  h += `<div class="seccion interv">CONTRATO DE INTERVENTORÍA · propio</div>`;
  if (it) {
    h += n('contrato:interventoria', '📄 Contrato de interventoría', 0, it.numero || '') + n('presupuesto:' + it.id, '📗 Presupuesto', 0, it.items + ' ítems') + n('otrosis:' + it.id, '📝 Otrosíes', 0, it.otrosis.length) + n('suspensiones:' + it.id, '⏸️ Suspensiones', 0, it.suspendido ? 'suspendido' : it.suspensiones.length) + n('liquidacion:' + it.id, '🏁 Liquidación', 0, it.liquidacion?.estado || '');
    h += n('', '📁 Cuentas de cobro', 0, it.actas.length, true) + it.actas.map(a => n('acta:' + a.id, `Cuenta ${a.numero}`, 1, a.estado)).join('');
    h += n('gastos:' + it.id, '💵 Gastos reales', 0) + n('costos:' + it.id, '🎯 Control de costos', 0);
    h += n('tabla:personal', '👷 Personal', 0, r.conteos.personal) + n('tabla:poliza', '🛡️ Pólizas', 0, r.conteos.poliza);
    h += n('balance:' + it.id, '📈 Balance de facturación', 0) + n('requisiciones', '🧾 Requisiciones (RQ)', 0, r.rq_pendientes || '');
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
    gastos: 'Gastos reales', costos: 'Control de costos', usuarios: 'Usuarios', auditoria: 'Auditoría', calendario: 'Calendario', otrosis: 'Otrosíes ' + (c?.tipo === 'obra' ? 'obra' : 'interventoría'), programa: 'Programa de obra', plano: 'Avance en el plano', graficos: 'Gráficos y Power BI', fotos: 'Registro fotográfico', avances: 'Capturas de avance', requisiciones: 'Requisiciones (RQ)', rq: 'RQ ' + (E.rqNum?.[x] ?? ''),
    suspensiones: 'Suspensiones ' + (c?.tipo === 'obra' ? 'obra' : 'interventoría'), liquidacion: 'Liquidación ' + (c?.tipo === 'obra' ? 'obra' : 'interventoría') }[t] || k;
}
// Pestaña de la cinta que corresponde a cada documento
function cintaDe(k) {
  const [t, x] = k.split(':');
  if (t === 'contrato') return x;
  if (['tabla'].includes(t)) return { bitacora: 'obra', ensayo: 'obra', personal: 'interventoria', poliza: 'interventoria', sst: 'control', sst_mes: 'control', ...Object.fromEntries(SST_ANEXOS.map(t => [t, 'control'])), ambiental: 'control', pmt: 'control', social: 'control', pqrs: 'control', reunion: 'control', acta_vecindad: 'control', mano_obra: 'control', capacitacion: 'control', afectacion: 'control', encuesta: 'control', veeduria: 'control' }[x];
  if (t === 'programa' || t === 'plano' || t === 'avances') return 'obra';
  if (t === 'graficos') return 'informes';
  if (t === 'requisiciones' || t === 'rq') return 'interventoria';
  if (t === 'calendario') return 'inicio';
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
  const tit = E.activo ? tituloDoc(E.activo) : '';
  $('#ruta-doc').textContent = E.res ? [E.res.proyecto.nombre, tit].filter(Boolean).join('  ›  ') : '';
  $('#titulo-ventana').textContent = (tit ? tit + ' - ' : '') + 'SIGI Pro';
  $('#pestanas-doc').innerHTML = E.docs.map(k => `<div class="pestana-doc ${k === E.activo ? 'activo' : ''}" data-k="${k}">${esc(tituloDoc(k))}<button class="cerrar" title="Cerrar">✕</button></div>`).join('');
  pintarCinta(); pintarArbol(); pintarSugerencias();
  const cont = $('#contenido-doc');
  if (!E.activo) { cont.innerHTML = '<div class="vacio">Abra un elemento del explorador o use la cinta de opciones.</div>'; return; }
  const [t, x] = E.activo.split(':');
  try {
    const vista = { tablero: vTablero, proyecto: vProyecto, contrato: vContrato, presupuesto: vPresupuesto, acta: vActa, tabla: vTabla, balance: vBalance, mayores: vMayores, gastos: vGastos, costos: vCostos, usuarios: vUsuarios, auditoria: vAuditoria, calendario: vCalendario, otrosis: vOtrosis, programa: vPrograma, plano: vPlano, graficos: vGraficos, fotos: vFotos, avances: vAvances, suspensiones: vSuspensiones, liquidacion: vLiquidacion, requisiciones: vRequisiciones, rq: vRQ }[t];
    const sc = cont.querySelector('.grilla-cont')?.scrollTop, scDoc = cont.scrollTop, mismo = pintarDocs.ult === E.activo;
    await vista(cont, x);
    herramientasGrilla(cont);
    if (mismo) { const g = cont.querySelector('.grilla-cont'); if (g && sc) g.scrollTop = sc; cont.scrollTop = scDoc; }
    pintarDocs.ult = E.activo;
    marcarAdjuntos(cont);
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
      if (guardar && campo.value !== valor) {
        try {
          await alGuardar(td, tipo === 'num' ? num(campo.value) : campo.value); aviso('Guardado · Ctrl+Z deshace');
          // Pila de deshacer: se vuelve a guardar el valor anterior en la misma celda
          E.deshacer.push({ vista: E.activo, nombre: td.dataset.c, fn: () => alGuardar(td, tipo === 'num' ? num(valor) : valor) });
          if (E.deshacer.length > 50) E.deshacer.shift();
        } catch (er) { aviso('Error: ' + er.message); }
      }
      await pintarDocs(); if (guardar) refrescarSilencioso();
      if (E.ir) { const { id, c } = E.ir; E.ir = null; $(`#contenido-doc tr[data-id="${id}"] td.edit[data-c="${c}"]`)?.click(); }
    };
    // Enter/flechas: celda de abajo o de arriba en la misma columna; Tab: siguiente celda editable de la fila
    const mover = ev => {
      const tr = td.closest('tr'), filas = [...tr.parentNode.querySelectorAll('tr[data-id]')].filter(f => !f.hidden);
      let dest = null;
      if (ev.key === 'Tab') {
        const celdas = [...tr.querySelectorAll('td.edit')], k = celdas.indexOf(td) + (ev.shiftKey ? -1 : 1);
        dest = celdas[k] || null;
      } else {
        const paso = ev.key === 'ArrowUp' || (ev.key === 'Enter' && ev.shiftKey) ? -1 : 1;
        for (let k = filas.indexOf(tr) + paso; k >= 0 && k < filas.length; k += paso) { const x = filas[k].querySelector(`td.edit[data-c="${td.dataset.c}"]`); if (x) { dest = x; break; } }
      }
      if (dest) E.ir = { id: dest.closest('tr').dataset.id, c: dest.dataset.c };
    };
    campo.addEventListener('blur', () => fin(true));
    campo.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') return fin(false);
      if (ev.key === 'Enter' || ev.key === 'Tab' || (tipo !== 'select' && tipo !== 'date' && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp'))) { ev.preventDefault(); mover(ev); campo.blur(); }
    });
  });
}
async function refrescarSilencioso() { E.res = await api('resumen/' + E.pid); pintarArbol(); pintarLateral(); estadoProyecto(); }
window.celda = (v, campo, tipo = 'text', extra = '') => `<td class="edit ${tipo === 'num' ? 'num' : ''}" data-c="${campo}" data-tipo="${tipo}" data-v="${esc(v ?? '')}" ${extra}>${tipo === 'num' ? fmt(v, 2) : esc(v ?? '')}</td>`;

// ---------- Herramientas de toda grilla: buscar con resaltado, Excel, imprimir ----------
function herramientasGrilla(cont) {
  const g = cont.querySelector('.grilla-cont'); if (!g || cont.querySelector('.barra-grilla')) return;
  const tabla = g.querySelector('table'), clave = E.activo;
  const barra = document.createElement('div'); barra.className = 'barra-grilla';
  barra.innerHTML = `<input type="search" class="buscar-grilla" placeholder="Filtrar filas… (Ctrl+F)" value="${esc(E.filtro[clave] || '')}"><span class="sub cuenta-grilla"></span><span class="esp"></span>
    <button class="btn" data-h="excel" title="Descargar lo que se ve en la grilla como hoja de Excel (CSV)">⬇ Excel</button><button class="btn" data-h="imprimir" title="Imprimir esta vista">🖨 Imprimir</button>`;
  g.before(barra);
  const inp = barra.querySelector('input');
  inp.oninput = () => { E.filtro[clave] = inp.value; filtrarGrilla(tabla, inp.value, barra.querySelector('.cuenta-grilla')); };
  barra.onclick = e => { const b = e.target.closest('[data-h]'); if (!b) return; b.dataset.h === 'excel' ? excelGrilla(tabla) : window.print(); };
  if (inp.value) inp.oninput();
}
function filtrarGrilla(tabla, texto, cuenta) {
  const q = texto.trim().toLowerCase(), filas = [...tabla.tBodies[0].rows];
  tabla.querySelectorAll('mark').forEach(m => m.replaceWith(m.textContent)); tabla.normalize();
  let cap = null, capVisible = false, n = 0;
  const cerrarCap = () => { if (cap) cap.hidden = !(capVisible || !q || cap.textContent.toLowerCase().includes(q)); };
  for (const f of filas) {
    if (f.classList.contains('cap')) { cerrarCap(); cap = f; capVisible = false; continue; }
    const ok = !q || f.textContent.toLowerCase().includes(q);
    f.hidden = !ok; if (ok) { capVisible = true; n++; }
  }
  cerrarCap();
  if (q) for (const f of filas) if (!f.hidden) resaltar(f, q);
  if (cuenta) cuenta.textContent = q ? `${n} fila(s) coinciden` : '';
}
function resaltar(nodo, q) {
  const w = document.createTreeWalker(nodo, NodeFilter.SHOW_TEXT), lista = [];
  while (w.nextNode()) if (w.currentNode.nodeValue.toLowerCase().includes(q)) lista.push(w.currentNode);
  for (const t of lista) {
    const v = t.nodeValue, i = v.toLowerCase().indexOf(q), m = document.createElement('mark');
    m.textContent = v.slice(i, i + q.length);
    const resto = t.splitText(i); resto.nodeValue = resto.nodeValue.slice(q.length); resto.before(m);
  }
}
// Exporta las filas visibles (con subtotales y pie) a CSV que Excel abre con separador ;
function excelGrilla(tabla) {
  const celdaTxt = c => { const v = c.textContent.trim().replace(/^[●]\s*/, '').replace(/^\$\s*/, '').replace(/\s*%$/, ''); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  const lineas = ['sep=;'];
  for (const f of tabla.rows) {
    if (f.hidden) continue;
    const out = []; for (const c of f.cells) { out.push(celdaTxt(c)); for (let k = 1; k < (c.colSpan || 1); k++) out.push(''); }
    lineas.push(out.join(';'));
  }
  descargar(`${tituloDoc(E.activo).replace(/[^\wáéíóúñÁÉÍÓÚÑ.-]+/g, '_')}.csv`, '﻿' + lineas.join('\r\n'));
}
// Ctrl+Z deshace el último cambio hecho en una celda; Ctrl+F va al filtro de la grilla
document.addEventListener('keydown', async e => {
  if (!(e.ctrlKey || e.metaKey) || $('#dialogo').open) return;
  const k = e.key.toLowerCase();
  if (k === 'f' && $('#contenido-doc .buscar-grilla')) { e.preventDefault(); $('#contenido-doc .buscar-grilla').focus(); }
  if (k === 'z' && !e.target.closest('input,textarea,select')) {
    e.preventDefault();
    const u = E.deshacer.pop(); if (!u) return aviso('Nada que deshacer');
    try { await u.fn(); aviso('Deshecho: ' + u.nombre); if (E.activo !== u.vista) abrir(u.vista); else await pintarDocs(); refrescarSilencioso(); } catch (er) { aviso('No se pudo deshacer: ' + er.message); }
  }
});

// Valor en letras (pesos colombianos), como se escribe en actas y cuentas de cobro
function enLetras(valor) {
  const U = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
    'VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const D = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const C = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
  const menorMil = n => {
    if (n === 100) return 'CIEN';
    const r = n % 100, dec = r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' Y ' + U[r % 10] : '');
    return [C[Math.floor(n / 100)], dec].filter(Boolean).join(' ');
  };
  const miles = n => { const m = Math.floor(n / 1000), r = n % 1000; return [m === 1 ? 'MIL' : m ? menorMil(m) + ' MIL' : '', r ? menorMil(r) : ''].filter(Boolean).join(' '); };
  const entero = n => {
    if (n === 0) return 'CERO';
    const b = Math.floor(n / 1e12), mi = Math.floor(n / 1e6) % 1e6, r = n % 1e6;
    return [b ? (b === 1 ? 'UN BILLÓN' : miles(b) + ' BILLONES') : '', mi ? (mi === 1 ? 'UN MILLÓN' : miles(mi) + ' MILLONES') : '', r ? miles(r) : ''].filter(Boolean).join(' ');
  };
  const v = Math.round(Math.abs(Number(valor) || 0) * 100), ent = Math.floor(v / 100), cts = v % 100;
  const t = entero(ent), de = ent && !(ent % 1e6) ? ' DE' : '';
  return (valor < 0 ? 'MENOS ' : '') + t + de + (ent === 1 ? ' PESO' : ' PESOS') + (cts ? ` CON ${entero(cts)} CENTAVOS` : '') + ' M/CTE';
}
window.enLetras = enLetras;
// Semáforo del % ejecutado: verde hasta 90 %, ámbar hasta 100 %, rojo si supera lo contratado
const semaforo = p => `<span class="semaforo ${p > 1 + 1e-9 ? 'rojo' : p >= 0.9 ? 'ambar' : p > 0 ? 'verde' : ''}" title="${p > 1 + 1e-9 ? 'Supera lo contratado' : p >= 0.9 ? 'Cerca del límite contratado' : 'Dentro de lo contratado'}">●</span>`;

// ---------- Vistas ----------
async function vTablero(cont) {
  const r = E.res, ob = contrato('obra'), it = contrato('interventoria');
  const tarj = (et, va, no = '', p = null) => `<div class="tarjeta"><div class="et">${et}</div><div class="va">${va}</div>${no ? `<div class="no">${no}</div>` : ''}${p != null ? `<div class="barra"><i style="width:${Math.min(100, p * 100)}%"></i></div>` : ''}</div>`;
  const avOb = ob?.presupuesto ? ob.ejecutado / ob.presupuesto : 0, avIt = it?.presupuesto ? it.ejecutado / it.presupuesto : 0;
  const pGas = it?.costo_directo ? it.gastado / it.costo_directo : 0;
  const prox = r.vencimientos.filter(v => v.fecha).slice(0, 6);
  const est = await estadoContrato(r);
  cont.innerHTML = `<h2>${esc(r.proyecto.nombre)}</h2><p class="sub">${esc(r.proyecto.objeto || '')}</p>
  ${est}
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
    <div class="caja"><h3>Próximos vencimientos <button class="btn" data-abrir="calendario" style="float:right">📅 Ver calendario</button></h3>${prox.length ? `<table class="grilla"><tbody>${prox.map(v => { const d = dias(v.fecha);
      return `<tr><td>${fechaLarga(v.fecha)}</td><td class="${d < 0 || d <= 3 ? 'malo' : ''}">${d < 0 ? 'Vencido hace ' + -d + ' d' : d === 0 ? 'Hoy' : 'En ' + d + ' d'}</td><td>${esc(v.descripcion)}</td></tr>`; }).join('')}</tbody></table>` : '<p class="sub">No hay vencimientos con fecha.</p>'}
      <p class="sub">${r.vencimientos.filter(v => !v.fecha).length} pendientes sin fecha · ver panel derecho</p></div>
    <div class="caja"><h3>Avance del contrato de obra por acta</h3>${curva(ob)}</div>
  </div>`;
  cont.querySelectorAll('[data-abrir]').forEach(tr => tr.addEventListener('click', () => abrir(tr.dataset.abrir)));
}
// ---------- Estado del contrato de un vistazo (indicadores) ----------
const SEM = { verde: 'Al día', amarillo: 'Atención', rojo: 'Crítico', gris: 'Sin datos' };
const luz = s => `<span class="luz ${s}" title="${SEM[s]}"></span>`;
const mesCorto = m => ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][+m.slice(5, 7) - 1] + ' ' + m.slice(2, 4);
async function estadoContrato(r) {
  let d; try { d = await api('indicadores/' + E.pid); } catch { return ''; }
  const e = d.evm, p = d.plazo, f1 = v => (v == null ? '—' : fmt(v, 1) + ' %'), f2 = v => (v == null ? '—' : fmt(v, 2));
  const spiV = e.spi ?? e.spi_programa;
  const barraP = (et, v, c) => `<div class="fila-barra"><span>${et}</span><div><i style="width:${Math.min(100, v || 0)}%;background:${c}"></i></div><b>${f1(v)}</b></div>`;
  const tarjS = (et, v, s, no) => `<div class="tarjeta sem-${s}"><div class="et">${et}</div><div class="va">${luz(s)} ${f2(v)}</div><div class="no">${no}</div></div>`;
  const lista = (filas, vacio) => (filas.length ? `<table class="grilla"><tbody>${filas.join('')}</tbody></table>` : `<p class="sub">${vacio}</p>`);
  const sst = d.sst;
  return `<div class="seccion obra">ESTADO DEL CONTRATO DE OBRA · corte ${fechaLarga(d.hoy)}</div>
  <div class="tarjetas">
    ${tarjS('SPI · cumplimiento del programa', spiV, e.semaforo_spi, e.spi != null ? `EV / PV = actas ${pesos(e.ev)} / programado ${pesos(e.pv)}` : e.spi_programa != null ? 'Avance real / programado (Project)' : 'Importe el programa de Project para calcularlo')}
    ${tarjS('CPI · físico vs facturado', e.cpi, e.semaforo_cpi, e.cpi != null ? `EV físico ${pesos(e.ev_fisico)} / facturado ${pesos(e.ac)}` : 'Requiere programa con avance real y actas')}
    <div class="tarjeta"><div class="et">Plazo vigente</div><div class="va">${p.dias_total ? p.dias_restantes + ' d restantes' : '—'}</div><div class="no">${p.dias_total ? `${p.dias_transcurridos} de ${p.dias_total} días · termina ${fechaLarga(p.fin)}` : 'Sin acta de inicio o terminación'}${p.suspendido ? ' · <b class="malo">SUSPENDIDO</b>' : ''}</div></div>
    <div class="tarjeta"><div class="et">Variación del cronograma (SV)</div><div class="va ${e.sv == null ? '' : e.sv < 0 ? 'malo' : 'bueno'}">${e.sv == null ? '—' : pesos(e.sv)}</div><div class="no">EV − PV · negativo = atraso</div></div>
  </div>
  <div class="dos-col">
    <div class="caja"><h3>Curva S · programado vs ejecutado</h3>${curvaS(d.curva, e)}</div>
    <div class="caja"><h3>Tiempo, avance físico y financiero</h3><div class="barras">
      ${barraP('Plazo transcurrido', p.pct_tiempo, '#90a4ae')}${barraP('Programado (Project)', e.programado_pct, '#b26a00')}${barraP('Físico real (Project)', p.pct_fisico, 'var(--verde)')}${barraP('Financiero (actas)', p.pct_financiero, 'var(--azul)')}</div>
      <p class="sub">${p.pct_tiempo != null && p.pct_financiero != null ? (p.pct_financiero + 10 < p.pct_tiempo ? '⚠ El avance financiero va más de 10 puntos por debajo del tiempo transcurrido.' : 'El avance financiero acompaña el tiempo transcurrido.') : 'Faltan fechas o valor para comparar.'}
      ${p.pct_fisico != null && p.pct_financiero != null && p.pct_financiero > p.pct_fisico + 5 ? ' ⚠ Se ha facturado más de lo ejecutado físicamente.' : ''}</p>
      <h3>Por capítulo</h3>${barras(d.capitulos.map(c => ({ n: c.capitulo, v: c.pct || 0 })), v => fmt(v, 1) + ' %')}</div>
  </div>
  <div class="tres-col">
    <div class="caja"><h3>Alertas (${d.alertas.length})</h3>${lista(d.alertas.slice(0, 8).map(a => { const x = dias(a.fecha); return `<tr data-abrir="${esc(a.abrir)}" class="clic"><td class="${x != null && x <= 0 ? 'malo' : ''}">${fechaLarga(a.fecha)}</td><td>${esc(a.tipo)}</td><td>${esc(a.texto)}</td></tr>`; }), 'Sin alertas en los próximos 7 días.')}</div>
    <div class="caja"><h3>Pólizas por vencer (30 días)</h3>${lista(d.polizas.map(x => { const y = dias(x.hasta); return `<tr data-abrir="tabla:poliza" class="clic"><td class="${y < 0 ? 'malo' : y <= 15 ? 'malo' : ''}">${y < 0 ? 'Vencida' : 'En ' + y + ' d'}</td><td>${esc(x.amparo || '')}</td><td>${esc(x.contrato || '')} ${esc(x.numero || '')}</td></tr>`; }), 'Ninguna póliza vence en los próximos 30 días.')}</div>
    <div class="caja"><h3>PQRS</h3><div class="va-grande ${d.pqrs.vencidas ? 'malo' : ''}">${d.pqrs.abiertas} abiertas</div><p class="sub">${d.pqrs.vencidas} vencidas · ${d.pqrs.total} en total · plazos de la Ley 1755 de 2015 en días hábiles</p>
      ${lista(d.pqrs.lista.map(s => `<tr data-abrir="tabla:pqrs" class="clic"><td>${fechaLarga(s.fecha)}</td><td>${esc(s.descripcion || '')}</td><td class="${s.plazo && s.plazo < d.hoy ? 'malo' : ''}">${s.plazo ? fechaLarga(s.plazo) : ''}</td></tr>`), '')}</div>
    <div class="caja"><h3>SST ${sst ? '· ' + sst.mes : ''}</h3>${sst ? `<table class="grilla"><tbody>
      <tr><td>Trabajadores</td><td class="num">${sst.trabajadores || 0}</td></tr><tr><td>Frecuencia de accidentalidad</td><td class="num ${sst.frecuencia > 0 ? 'malo' : 'bueno'}">${fmt(sst.frecuencia, 2)}</td></tr>
      <tr><td>Severidad</td><td class="num">${fmt(sst.severidad, 2)}</td></tr><tr><td>Mortalidad</td><td class="num ${sst.mortalidad > 0 ? 'malo' : ''}">${fmt(sst.mortalidad, 2)}</td></tr>
      <tr><td>Ausentismo (%)</td><td class="num">${fmt(sst.ausentismo, 2)}</td></tr><tr><td>Planillas PILA/ARL</td><td class="${sst.planillas_ok === 'Sí' ? 'bueno' : 'malo'}">${esc(sst.planillas_ok || '')}</td></tr></tbody></table>
      <p class="sub">Res. 0312 de 2019 · por cada 100 trabajadores</p>` : '<p class="sub">Sin indicadores SST registrados.</p>'}</div>
    <div class="caja"><h3>Capturas de avance · últimos 7 días (${d.capturas.length})</h3>
      ${d.fotos.length ? `<div class="miniaturas">${d.fotos.map(f => `<img src="/api/adjunto/${f.id}/archivo" alt="${esc(f.descripcion || f.nombre || '')}" title="${esc((f.fecha || '') + ' ' + (f.descripcion || ''))}" loading="lazy">`).join('')}</div>` : ''}
      ${lista(d.capturas.slice(0, 6).map(c => `<tr data-abrir="avances" class="clic"><td>${fechaLarga(c.fecha)}</td><td>${esc(c.codigo || '')} ${esc(c.frente || '')}</td><td class="num">${fmt(c.cantidad, 2)} ${esc(c.unidad || '')}</td></tr>`), 'Sin capturas de campo esta semana.')}</div>
  </div>`;
}
// Curva S mensual en SVG: programado (Project), ejecutado por actas y avance real del programa a hoy; barras = valor de actas del mes
function curvaS(c, e) {
  if (!c.length) return '<p class="sub">Registre las fechas del contrato de obra, el programa de Project o las actas para ver la curva S.</p>';
  const W = 560, H = 230, m = 36, n = c.length, x = i => m + (i + 0.5) * (W - m - 12) / n, y = v => H - 22 - Math.min(100, v) / 100 * (H - 44);
  const maxMes = Math.max(1, ...c.map(k => k.valor_actas_mes)), bw = Math.max(2, Math.min(18, (W - m) / n - 3));
  const linea = (k, col, dash = '') => { const pts = c.map((v, i) => (v[k] == null ? null : `${x(i)},${y(v[k])}`)); const seg = pts.filter(Boolean); return seg.length ? `<polyline points="${seg.join(' ')}" fill="none" stroke="${col}" stroke-width="2" ${dash}/>` : ''; };
  const paso = Math.ceil(n / 8), iHoy = c.findIndex(k => k.mes === hoyISO().slice(0, 7));
  const ejes = [0, 25, 50, 75, 100].map(v => `<line x1="${m}" x2="${W - 12}" y1="${y(v)}" y2="${y(v)}" stroke="#eee"/><text x="${m - 4}" y="${y(v) + 3}" text-anchor="end">${v}%</text>`).join('');
  const barrasM = c.map((k, i) => (k.valor_actas_mes ? `<rect x="${x(i) - bw / 2}" y="${H - 22 - k.valor_actas_mes / maxMes * 50}" width="${bw}" height="${k.valor_actas_mes / maxMes * 50}" fill="#9db8da"><title>${mesCorto(k.mes)}: ${pesos(k.valor_actas_mes)}</title></rect>` : '')).join('');
  const etiq = c.map((k, i) => (i % paso === 0 ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${mesCorto(k.mes)}</text>` : '')).join('');
  const puntos = c.map((k, i) => (k.ejecutado_actas_pct != null ? `<circle cx="${x(i)}" cy="${y(k.ejecutado_actas_pct)}" r="2.5" fill="#1f5fa8"><title>${mesCorto(k.mes)} · ejecutado ${fmt(k.ejecutado_actas_pct, 1)} %${k.programado_pct != null ? ' · programado ' + fmt(k.programado_pct, 1) + ' %' : ''}</title></circle>` : '')).join('');
  const real = iHoy >= 0 && e.real_pct != null ? `<rect x="${x(iHoy) - 4}" y="${y(e.real_pct) - 4}" width="8" height="8" fill="#2e7d32" transform="rotate(45 ${x(iHoy)} ${y(e.real_pct)})"><title>Avance real del programa: ${fmt(e.real_pct, 1)} %</title></rect>` : '';
  const hoyL = iHoy >= 0 ? `<line x1="${x(iHoy)}" x2="${x(iHoy)}" y1="${y(100)}" y2="${H - 22}" stroke="#c62828" stroke-dasharray="3"/><text x="${x(iHoy) + 3}" y="${y(100) + 9}" fill="#c62828">hoy</text>` : '';
  return `<svg class="curva" viewBox="0 0 ${W} ${H}" role="img" aria-label="Curva S">${ejes}${barrasM}${hoyL}${linea('programado_pct', '#b26a00', 'stroke-dasharray="5 3"')}${linea('ejecutado_actas_pct', '#1f5fa8')}${puntos}${real}${etiq}</svg>
  <p class="sub leyenda"><i style="background:#b26a00"></i>Programado (Project) <i style="background:#1f5fa8"></i>Ejecutado por actas <i style="background:#2e7d32"></i>Real del programa a hoy <i style="background:#9db8da"></i>Valor de actas del mes</p>`;
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
  cont.insertAdjacentHTML('afterbegin', `<div class="barra-herr"><span class="esp"></span><button class="btn clip" data-adj="contrato:${c.id}">📎 Documentos del contrato</button></div>`);
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
  <div class="grilla-cont"><table class="grilla congelar" id="g-pres"><thead><tr><th>Código</th><th>Descripción</th><th>Und</th><th class="num">Cantidad</th><th class="num">Vr. unitario</th><th class="num">Vr. total</th><th>Fuera AIU</th><th class="num">Cant. vigente</th><th class="num">Vr. vigente</th><th></th></tr></thead><tbody>
  ${d.items.map(it => it.tipo === 0
    ? `<tr class="cap ${E.sel === it.id ? 'sel' : ''}" data-id="${it.id}">${celda(it.codigo, 'codigo')}${celda(it.descripcion, 'descripcion')}<td></td><td></td><td></td><td class="num">${pesos(subt[it.id] || 0)}</td><td></td><td></td><td></td><td></td></tr>`
    : `<tr class="${E.sel === it.id ? 'sel' : ''}" data-id="${it.id}">${celda(it.codigo, 'codigo')}${celda(it.descripcion, 'descripcion')}${celda(it.unidad, 'unidad')}${celda(it.cantidad, 'cantidad', 'num')}${celda(it.vr_unitario, 'vr_unitario', 'num')}<td class="num">${pesos(it.cantidad * it.vr_unitario)}</td>${celda(it.sin_aiu ? 'Sí' : 'No', 'sin_aiu', 'select', 'data-op="No|Sí"')}<td class="num" ${it.cantidad_vigente !== it.cantidad ? 'style="color:#b26a00;font-weight:600"' : ''}>${fmt(it.cantidad_vigente)}</td><td class="num">${pesos(it.cantidad_vigente * it.vr_unitario)}</td><td>${it.otrosi_id || it.apu ? `<button class="btn" data-apu="${it.id}">APU</button>` : ''}</td></tr>`).join('')}
  </tbody><tfoot><tr><td></td><td>${d.items.filter(i => i.tipo === 1).length} ítems · costo directo ${pesos(d.totales.costo_directo)}</td><td></td><td></td><td>TOTAL</td><td class="num">${pesos(d.totales.total)}</td><td></td><td>Vigente</td><td class="num">${pesos(d.totales_vigentes.total)}</td><td></td></tr></tfoot></table></div>
  <div class="dos-col"><div><h3 style="font-size:13px;margin:12px 0 0">Presupuesto original</h3>${tablaTotales(d.totales)}</div><div><h3 style="font-size:13px;margin:12px 0 0">Vigente (con otrosíes firmados)</h3>${tablaTotales(d.totales_vigentes)}</div></div>`;
  const g = $('#g-pres');
  g.addEventListener('click', e => { const b = e.target.closest('[data-apu]'); if (b) editorApu(d.items.find(i => i.id === Number(b.dataset.apu))); });
  g.addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr && !e.target.closest('td.edit input')) { E.sel = Number(tr.dataset.id); g.querySelectorAll('tr.sel').forEach(x => x.classList.remove('sel')); tr.classList.add('sel'); } });
  editable(g, (td, v) => api('t/item/' + td.closest('tr').dataset.id, 'PUT', { [td.dataset.c]: td.dataset.c === 'sin_aiu' ? (v === 'Sí' ? 1 : 0) : v }));
  g.tabIndex = 0;
  g.addEventListener('keydown', e => { if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.target.closest('input,select')) { e.preventDefault(); moverItem(e.key === 'ArrowUp' ? -1 : 1); } });
}
// Subir o bajar el ítem seleccionado dentro de su capítulo, o el capítulo completo con sus ítems
async function moverItem(paso) {
  if (!E.sel) return aviso('Seleccione primero una fila');
  const cid = Number(E.activo.split(':')[1]), items = (await api('presupuesto/' + cid)).items;
  const sel = items.find(i => i.id === E.sel); if (!sel) return;
  let grupos;
  if (sel.tipo === 0) {
    // Capítulos con sus ítems; el orden final se reparte en el mismo orden de la lista
    grupos = items.filter(i => i.tipo === 0).map(c => [c, ...items.filter(i => i.tipo === 1 && i.padre_id === c.id)]);
  } else grupos = items.filter(i => i.tipo === 1 && i.padre_id === sel.padre_id).map(i => [i]);
  const k = grupos.findIndex(b => b[0].id === sel.id), j = k + paso;
  if (j < 0 || j >= grupos.length) return aviso('Ya está en el extremo');
  const ordenes = grupos.flat().map(i => i.orden).sort((a, b) => a - b);
  [grupos[k], grupos[j]] = [grupos[j], grupos[k]];
  const unicos = new Set(ordenes).size === ordenes.length;
  const cambios = grupos.flat().map((it, n) => [it, unicos ? ordenes[n] : ordenes[0] + n * 0.001]).filter(([it, o]) => it.orden !== o);
  try { for (const [it, o] of cambios) await api('t/item/' + it.id, 'PUT', { orden: o }); await pintarDocs(); aviso(paso < 0 ? 'Fila subida' : 'Fila bajada'); }
  catch (e) { aviso('Error: ' + e.message); }
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
  // Subtotales por capítulo (contratado, esta acta y acumulado)
  const sc = {};
  for (const f of d.filas) if (f.tipo === 1 && f.padre_id) { const s = sc[f.padre_id] ||= { a: 0, ac: 0, c: 0 }; s.a += f.vr_acta; s.ac += f.vr_acumulado; s.c += f.cantidad_vigente * f.vr_unitario; }
  const it1 = d.filas.filter(f => f.tipo === 1), sum = k => it1.reduce((s, f) => s + (f[k] || 0), 0), contratado = it1.reduce((s, f) => s + f.cantidad_vigente * f.vr_unitario, 0);
  cont.innerHTML = `<div class="barra-herr"><h2 style="margin:0">${esObra ? 'Acta parcial de obra' : 'Cuenta de cobro de interventoría'} N.º ${a.numero}</h2><span class="esp"></span><button class="btn clip" data-adj="acta:${a.id}">📎 Soportes y fotos</button></div>
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
  <div class="grilla-cont"><table class="grilla congelar" id="g-acta"><thead><tr><th>Código</th><th>Descripción</th><th>Und</th><th class="num">Contratada</th><th class="num">Vr. unit.</th><th class="num">Anterior</th>
    <th class="num">Presentada</th><th class="num">Aprobada</th><th class="num">Acumulada</th><th class="num">Saldo</th><th class="num">% ejec.</th><th class="num">Vr. esta acta</th><th class="num">Vr. acumulado</th><th>Observación</th></tr></thead><tbody>
  ${d.filas.map(f => f.tipo === 0 ? `<tr class="cap"><td>${esc(f.codigo)}</td><td colspan="9">${esc(f.descripcion)}</td><td class="num">${sc[f.id]?.c ? pct(sc[f.id].ac / sc[f.id].c) : ''}</td><td class="num">${pesos(sc[f.id]?.a || 0)}</td><td class="num">${pesos(sc[f.id]?.ac || 0)}</td><td></td></tr>`
    : `<tr data-id="${f.id}" class="${f.saldo < -1e-9 ? 'alerta' : ''}"><td>${esc(f.codigo)}</td><td>${esc(f.descripcion)}</td><td>${esc(f.unidad)}</td><td class="num" title="Original ${fmt(f.cantidad)}">${fmt(f.cantidad_vigente)}</td><td class="num">${fmt(f.vr_unitario)}</td>
      <td class="num">${fmt(f.anterior)}</td>${celda(f.cant_presentada, 'cant_presentada', 'num')}${celda(f.cant_aprobada, 'cant_aprobada', 'num', f.cant_aprobada !== f.cant_presentada ? 'style="color:#b26a00;font-weight:600"' : '')}
      <td class="num">${fmt(f.acumulado)}</td><td class="num ${f.saldo < -1e-9 ? 'malo' : ''}">${fmt(f.saldo)}</td><td class="num">${semaforo(f.pct)} ${pct(f.pct)}</td><td class="num">${pesos(f.vr_acta)}</td><td class="num">${pesos(f.vr_acumulado)}</td>${celda(f.observacion, 'observacion')}</tr>`).join('')}
  </tbody><tfoot><tr><td></td><td>Costo directo · presentado ${pesos(sum('vr_presentado'))}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td class="num">${contratado ? pct(sum('vr_acumulado') / contratado) : ''}</td><td class="num">${pesos(sum('vr_acta'))}</td><td class="num">${pesos(sum('vr_acumulado'))}</td><td></td></tr></tfoot></table></div>
  <p class="letras"><b>Valor de esta ${esObra ? 'acta' : 'cuenta'}:</b> ${pesos(t.acta.total)} · SON: ${enLetras(t.acta.total)}</p>  <div class="dos-col"><div><h3 style="font-size:13px;margin:12px 0 0">Esta acta (aprobado)</h3>${tablaTotales(t.acta)}</div><div><h3 style="font-size:13px;margin:12px 0 0">Acumulado</h3>${tablaTotales(t.acumulado)}</div></div>
  <h3 style="font-size:13px;margin:16px 0 4px">Lista de chequeo documental <span class="sub" id="chequeo-res"></span></h3>
  <div id="chequeo-acta"></div>`;
  pintarChequeo(id, bloq);
  editable($('#g-acta'), (td, v) => api(`acta/${id}/item/${td.closest('tr').dataset.id}`, 'PUT', { [td.dataset.c]: v }));
  editable($('#g-acta-cab'), (td, v) => api('t/acta/' + id, 'PUT', { [td.dataset.c]: v }));
  $('#pasos-acta').onclick = async e => {
    const b = e.target.closest('.paso'); if (!b || b.disabled || !confirm(`¿Pasar el acta ${a.numero} a "${b.dataset.e}"?`)) return;
    try { await api('t/acta/' + id, 'PUT', { estado: b.dataset.e }); aviso('Estado: ' + b.dataset.e); await refrescar(); } catch (er) { aviso('Error: ' + er.message); }
  };
}
// Lista de chequeo documental: sin todos los obligatorios en "Cumple" o "No aplica" no se aprueba el acta
async function pintarChequeo(id, bloq, ch) {
  ch = ch || await api(`acta/${id}/chequeo`);
  const cont = $('#chequeo-acta'); if (!cont) return;
  $('#chequeo-res').textContent = ch.completo ? '· completa: se puede aprobar' : `· faltan ${ch.faltan} obligatorios para aprobar`;
  const color = { Cumple: '#1b7a3a', 'No cumple': '#b3261e', 'No aplica': '#666', Pendiente: '#b26a00' };
  cont.innerHTML = `<div class="grilla-cont"><table class="grilla" id="g-chequeo"><thead><tr><th>#</th><th>Requisito</th><th>Oblig.</th><th>Estado</th><th>Radicado / folio / enlace SECOP II</th><th>Observación</th>${bloq ? '' : '<th></th>'}</tr></thead><tbody>
  ${ch.filas.map((f, k) => `<tr data-r="${f.id}"><td>${k + 1}</td><td>${esc(f.requisito)}</td><td>${f.obligatorio ? 'Sí' : 'No'}</td>
    <td>${bloq ? `<span style="color:${color[f.estado]}">${esc(f.estado)}</span>` : `<select data-c="estado" style="color:${color[f.estado]}">${ch.estados.map(e => `<option ${e === f.estado ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select>`}</td>
    <td>${bloq ? esc(f.referencia ?? '') : `<input data-c="referencia" value="${esc(f.referencia ?? '')}">`}</td>
    <td>${bloq ? esc(f.observacion ?? '') : `<input data-c="observacion" value="${esc(f.observacion ?? '')}">`}</td>
    ${bloq ? '' : '<td><button type="button" data-borrar title="Quitar requisito">✕</button></td>'}</tr>`).join('')}
  </tbody></table></div>${bloq ? '' : '<button type="button" id="chequeo-nuevo" style="margin-top:6px">+ Requisito</button>'}`;
  if (bloq) return;
  const guardar = async (rid, metodo, cuerpo) => { try { pintarChequeo(id, bloq, await api(`acta/${id}/chequeo/${rid}`, metodo, cuerpo)); } catch (er) { aviso('Error: ' + er.message); } };
  cont.onchange = e => { const c = e.target.dataset.c; if (c) guardar(e.target.closest('tr').dataset.r, 'PUT', { [c]: e.target.value }); };
  cont.onclick = e => {
    if (e.target.closest('[data-borrar]') && confirm('¿Quitar este requisito?')) guardar(e.target.closest('tr').dataset.r, 'DELETE');
    if (e.target.id === 'chequeo-nuevo') { const r = prompt('Nuevo requisito:'); if (r) api(`acta/${id}/chequeo`, 'POST', { requisito: r }).then(x => pintarChequeo(id, bloq, x)).catch(er => aviso('Error: ' + er.message)); }
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
  ${c.otrosis.map(o => `<tr data-id="${o.id}"><td>${o.numero}</td>${celda(o.fecha, 'fecha', 'date')}${celda(o.tipo, 'tipo', 'select', 'data-op="Adición|Prórroga|Adición y prórroga|Modificación|Suspensión"')}${celda(o.valor, 'valor', 'num')}${celda(o.dias, 'dias', 'num')}${celda(o.objeto, 'objeto')}${celda(o.estado, 'estado', 'select', 'data-op="En trámite|Firmado|Anulado"')}${celda(o.polizas_ajustadas, 'polizas_ajustadas', 'select', 'data-op="No|Sí"', )}<td class="acciones"><button class="btn clip" data-adj="otrosi:${o.id}" title="Adjuntos y fotos">📎</button><button class="btn" data-borrar="${o.id}" title="Eliminar">✕</button></td></tr>`).join('') || '<tr><td colspan="9" class="sub">Sin otrosíes</td></tr>'}
  </tbody></table></div>
  <p class="sub">Solo los otrosíes en estado Firmado suman al valor y al plazo vigentes. Mientras las pólizas no estén ajustadas, la campana lo recuerda.</p>
  <div id="o-cant"></div>`;
  const g = $('#g-otrosi');
  editable(g, (td, v) => api('t/otrosi/' + td.closest('tr').dataset.id, 'PUT', { [td.dataset.c]: v }));
  g.addEventListener('click', async e => { const b = e.target.closest('[data-borrar]'); if (b && confirm('¿Eliminar este otrosí?')) { try { await api('t/otrosi/' + b.dataset.borrar, 'DELETE'); refrescar(); } catch (er) { aviso('Error: ' + er.message); } } });
  $('#o-nuevo').onclick = async () => { try { await api('t/otrosi', 'POST', { contrato_id: c.id, fecha: hoyISO(), estado: 'En trámite' }); refrescar(); } catch (e) { aviso('Error: ' + e.message); } };
  if (c.otrosis.length) await cantidadesOtrosi($('#o-cant'), c);
}
// Cantidades que cada otrosí suma o resta por ítem, e ítems no previstos
async function cantidadesOtrosi(cont, c) {
  const items = (await api('presupuesto/' + c.id)).items, porId = new Map(items.map(i => [i.id, i]));
  const filas = (await Promise.all(c.otrosis.map(o => api('t/otrosi_item?otrosi_id=' + o.id)))).flat();
  const otr = new Map(c.otrosis.map(o => [o.id, o]));
  const opOtrosi = c.otrosis.map(o => `<option value="${o.id}">${o.numero} · ${esc(o.estado)}</option>`).join('');
  const opItems = items.filter(i => i.tipo === 1).map(i => `<option value="${i.id}">${esc(i.codigo)} · ${esc((i.descripcion || '').slice(0, 70))}</option>`).join('');
  cont.innerHTML = `<div class="barra-herr" style="margin-top:14px"><h3 style="margin:0;font-size:14px">Cantidades por otrosí</h3><span class="esp"></span><button class="btn prim" id="o-np">+ Nuevo ítem no previsto</button></div>
  <div class="grilla-cont"><table class="grilla" id="g-oitem"><thead><tr><th>Otrosí</th><th>Estado</th><th>Código</th><th>Descripción</th><th>Und</th><th class="num">Contratada original</th><th class="num">Cantidad (+/−)</th><th class="num">Vigente</th><th class="num">Vr. unitario</th><th></th></tr></thead><tbody>
  ${filas.map(f => { const it = porId.get(f.item_id) || {}, o = otr.get(f.otrosi_id) || {}; return `<tr data-id="${f.id}"><td>${o.numero ?? ''}</td><td>${esc(o.estado)}</td><td>${esc(it.codigo)}</td><td>${esc(it.descripcion)}</td><td>${esc(it.unidad)}</td><td class="num">${fmt(it.cantidad)}</td>${celda(f.cantidad, 'cantidad', 'num')}<td class="num">${fmt(it.cantidad_vigente)}</td><td class="num">${fmt(it.vr_unitario)}</td><td>${it.otrosi_id ? `<button class="btn" data-apu="${it.id}">APU</button>` : ''}<button class="btn" data-borrar="${f.id}" title="Eliminar">✕</button></td></tr>`; }).join('') || '<tr><td colspan="10" class="sub">Sin cantidades modificadas</td></tr>'}
  </tbody></table></div>
  <div class="barra-herr" style="margin-top:8px">Otrosí <select id="oi-otrosi">${opOtrosi}</select>
    Ítem <select id="oi-item" style="max-width:420px">${opItems}</select> Cantidad (+/−) <input id="oi-cant" size="8"> <button class="btn" id="oi-agregar">Agregar</button></div>
  <p class="sub">Cantidad contratada vigente = original + cantidades de los otrosíes firmados. Las actas aprobadas conservan su valor.</p>`;
  const g = $('#g-oitem');
  editable(g, (td, v) => api('t/otrosi_item/' + td.closest('tr').dataset.id, 'PUT', { [td.dataset.c]: v }));
  g.addEventListener('click', async e => {
    const a = e.target.closest('[data-apu]'); if (a) return editorApu(porId.get(Number(a.dataset.apu)));
    const b = e.target.closest('[data-borrar]'); if (b && confirm('¿Quitar esta cantidad del otrosí?')) { try { await api('t/otrosi_item/' + b.dataset.borrar, 'DELETE'); refrescar(); } catch (er) { aviso('Error: ' + er.message); } }
  });
  $('#oi-agregar').onclick = async () => {
    const q = num($('#oi-cant').value); if (!q) return aviso('Escriba la cantidad (negativa para restar)');
    try { await api('t/otrosi_item', 'POST', { otrosi_id: Number($('#oi-otrosi').value), item_id: Number($('#oi-item').value), cantidad: q }); refrescar(); } catch (er) { aviso('Error: ' + er.message); }
  };
  $('#o-np').onclick = () => nuevoNoPrevisto(c, items, opOtrosi);
}
// Ítem no previsto: código NP-xx en el capítulo de no previstos, ligado al otrosí, con su APU
function nuevoNoPrevisto(c, items, opOtrosi) {
  const f = $('#dialogo-form');
  f.innerHTML = `<h3>Nuevo ítem no previsto</h3>
  <p><label>Otrosí <select id="np-otrosi">${opOtrosi}</select></label></p>
  <p><label>Descripción <input id="np-desc" size="50"></label></p>
  <p><label>Unidad <input id="np-und" value="UND" size="6"></label> <label>Cantidad <input id="np-cant" value="0" size="8"></label></p>
  <div class="acciones"><button class="btn" value="no">Cancelar</button><button class="btn prim" value="si" id="np-ok">Crear y editar APU</button></div>`;
  $('#dialogo').showModal();
  $('#np-ok').onclick = async ev => {
    ev.preventDefault();
    try {
      const n = Math.max(0, ...items.map(i => Number(/^NP-(\d+)$/.exec(i.codigo || '')?.[1] || 0))) + 1;
      const cap = items.find(i => i.tipo === 0 && i.codigo === 'NP') || await api('t/item', 'POST', { contrato_id: c.id, tipo: 0, codigo: 'NP', descripcion: 'ÍTEMS NO PREVISTOS' });
      const otrosi = Number($('#np-otrosi').value);
      const it = await api('t/item', 'POST', { contrato_id: c.id, padre_id: cap.id, tipo: 1, codigo: 'NP-' + String(n).padStart(2, '0'), descripcion: $('#np-desc').value || 'Ítem no previsto', unidad: $('#np-und').value, cantidad: 0, vr_unitario: 0, otrosi_id: otrosi, apu: JSON.stringify({ renglones: [] }), orden: cap.orden + n / 1000 });
      const q = num($('#np-cant').value);
      if (q) await api('t/otrosi_item', 'POST', { otrosi_id: otrosi, item_id: it.id, cantidad: q });
      $('#dialogo').close(); await refrescar(); editorApu(it);
    } catch (er) { aviso('Error: ' + er.message); }
  };
}
// Editor de APU: materiales, equipo, mano de obra y transporte; el total es el valor unitario
const GRUPOS_APU = ['Materiales', 'Equipo', 'Mano de obra', 'Transporte'];
function editorApu(it) {
  if (!it) return;
  let apu; try { apu = JSON.parse(it.apu || '{}'); } catch { apu = {}; }
  const r = apu.renglones || [], f = $('#dialogo-form');
  const parcial = x => (x.cantidad || 0) * (x.precio || 0), total = () => r.reduce((s, x) => s + parcial(x), 0);
  const pintar = () => {
    f.innerHTML = `<h3>APU · ${esc(it.codigo)} ${esc(it.descripcion)} (${esc(it.unidad || '')})</h3>
    <div class="grilla-cont" style="max-height:55vh"><table class="grilla" id="g-apu"><thead><tr><th>Grupo</th><th>Descripción</th><th>Und</th><th class="num">Cant. / rend.</th><th class="num">Precio</th><th class="num">Parcial</th><th></th></tr></thead><tbody>
    ${GRUPOS_APU.map(gr => { const de = r.map((x, k) => [x, k]).filter(([x]) => x.grupo === gr);
      return `<tr class="cap"><td colspan="5">${gr}</td><td class="num">${pesos(de.reduce((s, [x]) => s + parcial(x), 0))}</td><td><button class="btn" data-mas="${gr}" title="Agregar renglón">+</button></td></tr>`
        + de.map(([x, k]) => `<tr data-k="${k}"><td></td>${celda(x.descripcion, 'descripcion')}${celda(x.unidad, 'unidad')}${celda(x.cantidad, 'cantidad', 'num')}${celda(x.precio, 'precio', 'num')}<td class="num">${pesos(parcial(x))}</td><td><button class="btn" data-quitar="${k}">✕</button></td></tr>`).join(''); }).join('')}
    <tr class="cap"><td colspan="5">VALOR UNITARIO</td><td class="num" id="apu-total">${pesos(total())}</td><td></td></tr></tbody></table></div>
    <div class="acciones"><button class="btn" value="no">Cerrar</button><button class="btn prim" value="si" id="apu-ok">Guardar APU</button></div>`;
    $('#g-apu').addEventListener('click', e => {
      const m = e.target.closest('[data-mas]'), q = e.target.closest('[data-quitar]'), td = e.target.closest('td.edit');
      if (m) { e.preventDefault(); r.push({ grupo: m.dataset.mas, descripcion: '', unidad: '', cantidad: 0, precio: 0 }); return pintar(); }
      if (q) { e.preventDefault(); r.splice(Number(q.dataset.quitar), 1); return pintar(); }
      if (!td || td.querySelector('input')) return;
      const campo = document.createElement('input'); campo.value = td.dataset.v; td.textContent = ''; td.appendChild(campo); campo.focus(); campo.select();
      campo.addEventListener('blur', () => { r[td.closest('tr').dataset.k][td.dataset.c] = td.dataset.tipo === 'num' ? num(campo.value) : campo.value; pintar(); });
      campo.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); campo.blur(); } });
    });
    $('#apu-ok').onclick = async ev => {
      ev.preventDefault();
      try { await api('t/item/' + it.id, 'PUT', { apu: JSON.stringify({ renglones: r }), vr_unitario: Math.round(total() * 100) / 100 }); $('#dialogo').close(); aviso('APU guardado'); refrescar(); } catch (er) { aviso('Error: ' + er.message); }
    };
  };
  pintar(); if (!$('#dialogo').open) $('#dialogo').showModal();
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
      // Lo ejecutado según las capturas de campo, como línea fina sobre el eje
      if (a === d.alineamientos[0]) for (const v of d.avances.filter(v => v.abs_fin != null))
        h += `<polyline points="${tramoPolilinea(a, Math.min(v.abs_ini, v.abs_fin), Math.max(v.abs_ini, v.abs_fin)).map(P).join(' ')}" fill="none" stroke="${v.estado === 'Verificado' ? '#1b5e20' : '#0d47a1'}" stroke-width="4"><title>${esc(v.codigo || '')} ${esc(v.item || '')}: ${fmt(v.cantidad)} ${esc(v.unidad || '')} · ${abscisa(v.abs_ini)} – ${abscisa(v.abs_fin)} · ${fechaLarga(v.fecha)} · ${esc(v.estado)}</title></polyline>`;
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
    <span class="leyenda"><i style="background:#bdbdbd"></i>Sin iniciar <i style="background:#f9a825"></i>En ejecución <i style="background:#7cb342"></i>≥ 50 % <i style="background:#2e7d32"></i>Terminado <i style="background:#0d47a1;height:4px"></i>Capturas de campo <i style="background:#1b5e20;height:4px"></i>Verificadas</span></p>
  ${svg}
  <div class="grilla-cont"><table class="grilla" id="g-tramos"><thead><tr><th>Eje</th><th>Tramo</th><th class="num">Abscisa inicial (m)</th><th class="num">Abscisa final (m)</th><th>Actividad</th><th class="num">Avance %</th><th>Fecha</th><th>Notas</th><th></th></tr></thead><tbody>
  ${d.tramos.map(t => `<tr data-id="${t.id}">${celda(t.alineamiento_id, 'alineamiento_id', 'select', `data-op="${opAl}"`).replace(/>\d+<\/td>$/, `>${esc(d.alineamientos.find(a => a.id === t.alineamiento_id)?.nombre || '')}</td>`)}${celda(t.nombre, 'nombre')}${celda(t.abs_ini, 'abs_ini', 'num')}${celda(t.abs_fin, 'abs_fin', 'num')}${celda(t.actividad, 'actividad')}${celda(t.avance, 'avance', 'num')}${celda(t.fecha, 'fecha', 'date')}${celda(t.notas, 'notas')}<td class="acciones"><button class="btn clip" data-adj="tramo:${t.id}" title="Adjuntos y fotos">📎</button><button class="btn" data-borrar="${t.id}">✕</button></td></tr>`).join('') || '<tr><td colspan="9" class="sub">Sin tramos</td></tr>'}
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
// Columnas agrupadas en SVG: etiquetas + series [{ n, c, v: [] }]
function columnas(etq, series, formato = pesos) {
  if (!etq.length || !series.some(s => s.v.some(Boolean))) return '<p class="sub">Sin datos</p>';
  const W = 560, H = 200, m = 8, n = etq.length, k = series.length, max = Math.max(1, ...series.flatMap(s => s.v.map(v => v || 0)));
  const ancho = (W - 2 * m) / n, bw = Math.max(2, Math.min(20, (ancho - 4) / k)), y = v => H - 22 - (v || 0) / max * (H - 40), paso = Math.ceil(n / 8);
  const rects = etq.map((e, i) => series.map((s, j) => (s.v[i] ? `<rect x="${m + i * ancho + (ancho - bw * k) / 2 + j * bw}" y="${y(s.v[i])}" width="${bw - 1}" height="${H - 22 - y(s.v[i])}" fill="${s.c}"><title>${esc(e)} · ${esc(s.n)}: ${formato(s.v[i])}</title></rect>` : '')).join('')
    + (i % paso === 0 ? `<text x="${m + i * ancho + ancho / 2}" y="${H - 6}" text-anchor="middle">${esc(e)}</text>` : '')).join('');
  return `<svg class="columnas" viewBox="0 0 ${W} ${H}"><text x="${m}" y="10">Máx. ${formato(max)}</text><line x1="${m}" x2="${W - m}" y1="${H - 22}" y2="${H - 22}" stroke="#ccc"/>${rects}</svg>
  <p class="sub leyenda">${series.map(s => `<i style="background:${s.c}"></i>${esc(s.n)}`).join(' ')}</p>`;
}
async function vGraficos(cont) {
  const ob = contrato('obra'), it = contrato('interventoria');
  const vacio = { evm: {}, curva: [], capitulos: [], sst_meses: [], capturas_mes: [] };
  const [prog, d] = await Promise.all([api('programa/' + E.pid).catch(() => ({})), api('indicadores/' + E.pid).catch(() => vacio)]);
  const base = location.origin + '/api/bi/' + E.pid + '/';
  const conjuntos = [['contratos', 'Contratos y valores vigentes'], ['actas', 'Actas y cuentas de cobro'], ['items', 'Ítems con acumulado y saldo'], ['capitulos', 'Avance por capítulo'], ['curva_s', 'Curva S mensual (PV, EV, % programado y ejecutado)'],
    ['valor_ganado', 'Valor ganado a hoy: SPI, CPI, plazo'], ['gastos', 'Gastos de interventoría'], ['programa', 'Programa de obra (Project)'], ['tramos', 'Tramos'], ['capturas_mes', 'Capturas de avance por mes'],
    ['polizas', 'Pólizas'], ['alertas', 'Alertas de 7 días'], ['sst', 'SST'], ['sst_indicadores', 'Indicadores SST por mes'], ['ambiental', 'Ambiental'], ['pmt', 'PMT'], ['social', 'Social y PQRS']];
  const meses = d.curva.filter(k => k.valor_actas_mes || k.valor_interventoria_mes);
  cont.innerHTML = `<h2>Gráficos y datos para Power BI</h2>
  <div class="dos-col">
    <div class="caja"><h3>Curva S del contrato de obra</h3>${curvaS(d.curva, d.evm)}</div>
    <div class="caja"><h3>Valor facturado por mes</h3>${columnas(meses.map(k => mesCorto(k.mes)), [{ n: 'Actas de obra', c: '#1f5fa8', v: meses.map(k => k.valor_actas_mes) }, { n: 'Cuentas de interventoría', c: '#2e7d32', v: meses.map(k => k.valor_interventoria_mes) }])}</div>
    <div class="caja"><h3>Contratado vs ejecutado por capítulo (costo directo)</h3>${columnas(d.capitulos.map(c => c.capitulo.slice(0, 14)), [{ n: 'Contratado', c: '#90a4ae', v: d.capitulos.map(c => c.contratado) }, { n: 'Ejecutado', c: '#1f5fa8', v: d.capitulos.map(c => c.ejecutado) }])}
      ${barras(d.capitulos.map(c => ({ n: c.capitulo, v: c.pct || 0 })), v => fmt(v, 1) + ' %')}</div>
    <div class="caja"><h3>Ejecución de los contratos</h3>${barras([ob && { n: 'Obra ejecutado', v: ob.ejecutado }, ob && { n: 'Obra vigente', v: ob.valor_vigente, c: '#90a4ae' }, it && { n: 'Interv. facturado', v: it.ejecutado, c: '#2e7d32' }, it && { n: 'Interv. gastado', v: it.gastado, c: '#b26a00' }, it && { n: 'Interv. vigente', v: it.valor_vigente, c: '#90a4ae' }].filter(Boolean))}
      <h3>Programa de obra</h3>${barras([{ n: 'Programado', v: prog.programado || 0, c: '#90a4ae' }, { n: 'Ejecutado', v: prog.real || 0 }], v => fmt(v, 1) + ' %')}</div>
    <div class="caja"><h3>Valor por acta de obra</h3>${barras((ob?.actas || []).map(a => ({ n: 'Acta ' + a.numero, v: a.valor })))}
      <h3>Cuentas de cobro de interventoría</h3>${barras((it?.actas || []).map(a => ({ n: 'Cuenta ' + a.numero, v: a.valor, c: '#2e7d32' })))}</div>
    <div class="caja"><h3>Capturas de avance en campo por mes</h3>${columnas(d.capturas_mes.map(k => mesCorto(k.mes)), [{ n: 'Capturas', c: '#b26a00', v: d.capturas_mes.map(k => k.capturas) }], v => fmt(v, 0))}</div>
    <div class="caja"><h3>SST · frecuencia y severidad por mes</h3>${columnas(d.sst_meses.map(m => mesCorto(m.mes)), [{ n: 'Frecuencia', c: '#c62828', v: d.sst_meses.map(m => m.frecuencia) }, { n: 'Severidad', c: '#b26a00', v: d.sst_meses.map(m => m.severidad) }], v => fmt(v, 2))}</div>
  </div>
  <h3 class="h3" style="margin-top:18px">Conectar Power BI</h3>
  <p class="sub">En Power BI Desktop: <b>Obtener datos → Web</b>, pegue una de estas direcciones y pulse Aceptar. Con SIGI Pro abierto, <b>Actualizar</b> trae los datos al día. Cambie <code>.csv</code> por <code>.json</code> si lo prefiere. Para tableros compartidos en la nube, active la sincronización con Turso o exporte el CSV.</p>
  <table class="grilla" style="max-width:1000px"><tbody>${conjuntos.map(([c, t]) => `<tr><td>${c}</td><td>${t}</td><td><code>${esc(base + c + '.csv')}</code></td><td><a href="${base + c}.csv">Descargar CSV</a></td></tr>`).join('')}</tbody></table>`;
}

// ---------- Calendario del proyecto ----------
const TIPOS_CAL = { Vencimiento: '#c62828', Póliza: '#6a1b9a', PQRS: '#d84315', Correspondencia: '#00838f', PMT: '#f9a825', Acta: '#1f5fa8', Contrato: '#174a85', Otrosí: '#5d4037',
  Suspensión: '#455a64', Liquidación: '#880e4f', Social: '#ef6c00', Bitácora: '#6d4c41', Captura: '#2e7d32', Programa: '#b26a00', Ensayo: '#0277bd', SST: '#ad1457', Ambiental: '#558b2f' };
const isoL = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const lunes = d => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
async function vCalendario(cont) {
  const C = E.cal = E.cal || { modo: 'mes', ref: hoyISO(), ocultos: [] };
  const ref = new Date(C.ref + 'T00:00:00');
  let ini, fin, titulo;
  if (C.modo === 'semana') { ini = lunes(ref); fin = new Date(ini); fin.setDate(fin.getDate() + 6); titulo = `Semana del ${fechaLarga(isoL(ini))}`; }
  else if (C.modo === 'agenda') { ini = new Date(ref); fin = new Date(ref); fin.setDate(fin.getDate() + 59); titulo = `Agenda · ${fechaLarga(isoL(ini))} a ${fechaLarga(isoL(fin))}`; }
  else { const p = new Date(ref.getFullYear(), ref.getMonth(), 1); ini = lunes(p); fin = new Date(ini); fin.setDate(fin.getDate() + 41); titulo = p.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }); titulo = titulo[0].toUpperCase() + titulo.slice(1); }
  let ev = [];
  try { ev = await api(`calendario/${E.pid}?desde=${isoL(ini)}&hasta=${isoL(fin)}`); } catch (e) { aviso('Error: ' + e.message); }
  const vis = ev.filter(e => !C.ocultos.includes(e.tipo)), hoy = hoyISO(), porDia = {};
  for (const e of vis) (porDia[e.fecha] = porDia[e.fecha] || []).push(e);
  const chip = e => `<div class="ev ${e.vencido ? 'vencido' : ''}" data-abrir="${esc(e.abrir)}" style="--c:${TIPOS_CAL[e.tipo] || '#777'}" title="${esc(e.tipo + ': ' + e.titulo + (e.vencido ? ' (vencido)' : ''))}">${esc(e.titulo)}</div>`;
  const dia = (d, max) => { const f = isoL(d), l = porDia[f] || [], otro = C.modo === 'mes' && d.getMonth() !== ref.getMonth();
    return `<div class="dia ${f === hoy ? 'hoy' : ''} ${otro ? 'otro' : ''}" data-dia="${f}"><div class="num-dia">${C.modo === 'semana' ? d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }) : d.getDate()}</div>${l.slice(0, max).map(chip).join('')}${l.length > max ? `<div class="mas" data-mas="${f}">+${l.length - max} más</div>` : ''}</div>`; };
  const dias = n => Array.from({ length: n }, (_, i) => { const d = new Date(ini); d.setDate(d.getDate() + i); return d; });
  const cab = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map(x => `<div class="cab-dia">${x}</div>`).join('');
  const cuerpo = C.modo === 'agenda'
    ? (Object.keys(porDia).sort().map(f => `<div class="agenda-dia ${f === hoy ? 'hoy' : ''}"><b>${new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</b>${porDia[f].map(e => `<div class="fila-ag" data-abrir="${esc(e.abrir)}"><span class="pt" style="background:${TIPOS_CAL[e.tipo]}"></span><span class="tipo">${esc(e.tipo)}</span><span class="${e.vencido ? 'malo' : ''}">${esc(e.titulo)}${e.vencido ? ' · vencido' : ''}</span></div>`).join('')}</div>`).join('') || '<p class="sub">No hay eventos en los próximos 60 días.</p>')
    : `<div class="cal-grilla ${C.modo}">${cab}${dias(C.modo === 'semana' ? 7 : 42).map(d => dia(d, C.modo === 'semana' ? 40 : 3)).join('')}</div>`;
  const cuenta = t => ev.filter(e => e.tipo === t).length;
  cont.innerHTML = `<div class="barra-herr"><h2 style="margin:0">Calendario del proyecto</h2><span class="esp"></span>
    <button class="btn" data-mover="-1">◀</button><button class="btn" data-mover="0">Hoy</button><button class="btn" data-mover="1">▶</button>
    ${['mes', 'semana', 'agenda'].map(m => `<button class="btn ${C.modo === m ? 'prim' : ''}" data-modo="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}
    <a class="btn" href="/api/calendario/${E.pid}/ics" download title="Para Google Calendar, Outlook o el calendario del celular">📅 Exportar .ics</a></div>
  <h3 class="cal-titulo">${esc(titulo)} <span class="sub">· ${vis.length} eventos${ev.some(e => e.vencido) ? ` · <b class="malo">${ev.filter(e => e.vencido).length} vencidos</b>` : ''}</span></h3>
  <div class="cal-leyenda">${Object.keys(TIPOS_CAL).map(t => `<label><input type="checkbox" data-tipo="${t}" ${C.ocultos.includes(t) ? '' : 'checked'}><i style="background:${TIPOS_CAL[t]}"></i>${t}${cuenta(t) ? ` (${cuenta(t)})` : ''}</label>`).join('')}</div>
  ${cuerpo}
  <p class="sub">Clic en un evento para abrir su documento · clic en un día libre para crear un vencimiento · los pendientes con fecha pasada salen en rojo.</p>`;
  cont.onclick = async e => {
    const a = e.target.closest('[data-abrir]'); if (a) return abrir(a.dataset.abrir);
    const m = e.target.closest('[data-mover]');
    if (m) { const k = +m.dataset.mover, d = new Date(C.ref + 'T00:00:00');
      if (!k) C.ref = hoyISO(); else { if (C.modo === 'mes') d.setMonth(d.getMonth() + k, 1); else d.setDate(d.getDate() + k * (C.modo === 'semana' ? 7 : 60)); C.ref = isoL(d); }
      return vCalendario(cont); }
    const mo = e.target.closest('[data-modo]'); if (mo) { C.modo = mo.dataset.modo; return vCalendario(cont); }
    const mas = e.target.closest('[data-mas]'); if (mas) { C.modo = 'semana'; C.ref = mas.dataset.mas; return vCalendario(cont); }
    const d = e.target.closest('[data-dia]');
    if (d && !e.target.closest('.ev')) {
      const t = prompt(`Nuevo vencimiento para el ${fechaLarga(d.dataset.dia)}:`); if (!t || !t.trim()) return;
      try { await api('t/vencimiento', 'POST', { proyecto_id: E.pid, fecha: d.dataset.dia, descripcion: t.trim(), tipo: 'Recordatorio', estado: 'Pendiente' }); aviso('Vencimiento creado'); refrescarSilencioso(); vCalendario(cont); } catch (er) { aviso('Error: ' + er.message); }
    }
  };
  cont.querySelectorAll('[data-tipo]').forEach(c => c.onchange = () => { C.ocultos = c.checked ? C.ocultos.filter(x => x !== c.dataset.tipo) : [...C.ocultos, c.dataset.tipo]; vCalendario(cont); });
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
  ${c.suspensiones.map(x => `<tr data-id="${x.id}"><td>${x.numero}</td>${celda(x.fecha_suspension, 'fecha_suspension', 'date')}${celda(x.fecha_reinicio, 'fecha_reinicio', 'date')}<td class="num">${diasSusp(x)}</td>${celda(x.motivo, 'motivo')}${celda(x.acta, 'acta')}${celda(x.estado, 'estado', 'select', 'data-op="Suspendido|Reiniciado"')}${celda(x.polizas_ajustadas, 'polizas_ajustadas', 'select', 'data-op="No|Sí"')}<td class="acciones"><button class="btn clip" data-adj="suspension:${x.id}" title="Adjuntos y fotos">📎</button><button class="btn" data-borrar="${x.id}" title="Eliminar">✕</button></td></tr>`).join('') || '<tr><td colspan="9" class="sub">Sin suspensiones</td></tr>'}
  </tbody></table></div>
  <p class="sub">Mientras siga suspendido, los días se cuentan hasta hoy. Al reiniciar hay que ajustar las pólizas; la campana lo recuerda, y también si la suspensión pasa de 30 días.</p>`;
  const g = $('#g-susp');
  editable(g, (td, v) => api('t/suspension/' + td.closest('tr').dataset.id, 'PUT', { [td.dataset.c]: v }));
  g.addEventListener('click', async e => { const b = e.target.closest('[data-borrar]'); if (b && confirm('¿Eliminar esta suspensión?')) { try { await api('t/suspension/' + b.dataset.borrar, 'DELETE'); refrescar(); } catch (er) { aviso('Error: ' + er.message); } } });
  $('#s-nueva').onclick = async () => { try { await api('t/suspension', 'POST', { contrato_id: c.id, fecha_suspension: hoyISO(), estado: 'Suspendido' }); refrescar(); } catch (e) { aviso('Error: ' + e.message); } };
}
const diasSusp = x => { const fin = x.estado === 'Reiniciado' && x.fecha_reinicio ? x.fecha_reinicio : hoyISO(); return x.fecha_suspension ? Math.max(0, Math.round((new Date(fin) - new Date(x.fecha_suspension)) / 86400000)) : 0; };

// ---------- Requisiciones (RQ) ----------
// Flujo: Borrador → Solicitada → Aprobada / Rechazada → Atendida. Aprueba o rechaza el director; al atender una RQ del contrato de interventoría se registra el gasto.
const COLOR_RQ = { Borrador: '#666', Solicitada: '#b26a00', Aprobada: '#1f5fa8', Rechazada: '#b3261e', Atendida: '#1b7a3a' };
const tipoContrato = id => { const c = E.res?.contratos.find(c => c.id === id); return c ? (c.tipo === 'obra' ? 'Obra' : 'Interventoría') : '—'; };
async function nuevaRQ() {
  const it = contrato('interventoria') || contrato('obra');
  try { const r = await api('t/requisicion', 'POST', { proyecto_id: E.pid, contrato_id: it?.id || null, fecha: hoyISO(), estado: 'Borrador' }); (E.rqNum = E.rqNum || {})[r.id] = r.numero; abrir('rq:' + r.id); aviso('RQ ' + r.numero + ' creada'); }
  catch (e) { aviso('Error: ' + e.message); }
}
async function vRequisiciones(cont) {
  const lista = await api('t/requisicion?proyecto_id=' + E.pid);
  E.rqNum = Object.fromEntries(lista.map(r => [r.id, r.numero]));
  const cuenta = e => lista.filter(r => r.estado === e).length;
  cont.innerHTML = `<div class="barra-herr"><h2 style="margin:0">Requisiciones (RQ)</h2><span class="esp"></span><button class="btn prim" id="rq-nueva">+ Nueva RQ</button></div>
  <div class="tarjetas">${['Borrador', 'Solicitada', 'Aprobada', 'Rechazada', 'Atendida'].map(e => `<div class="tarjeta"><div class="et">${e}</div><div class="va" style="color:${COLOR_RQ[e]}">${cuenta(e)}</div></div>`).join('')}</div>
  <div class="grilla-cont"><table class="grilla" id="g-rq"><thead><tr><th>N.º</th><th>Fecha</th><th>Contrato</th><th>Solicitante</th><th>Frente</th><th>Justificación</th><th>Estado</th><th></th></tr></thead><tbody>
  ${lista.map(r => `<tr data-rq="${r.id}" style="cursor:pointer"><td>${r.numero}</td><td>${esc(r.fecha || '')}</td><td>${tipoContrato(r.contrato_id)}</td><td>${esc(r.solicitante || '')}</td><td>${esc(r.frente || '')}</td><td>${esc(r.justificacion || '')}</td><td style="color:${COLOR_RQ[r.estado]};font-weight:600">${esc(r.estado)}</td><td class="acciones"><button class="btn clip" data-adj="requisicion:${r.id}" title="Adjuntos">📎</button></td></tr>`).join('') || '<tr><td colspan="8" class="sub">Sin requisiciones</td></tr>'}
  </tbody></table></div>
  <p class="sub">El director aprueba o rechaza las RQ solicitadas; la campana avisa las pendientes. Al atender una RQ del contrato de interventoría se crea el gasto en "Gastos reales".</p>`;
  $('#rq-nueva').onclick = nuevaRQ;
  $('#g-rq').onclick = e => { const tr = e.target.closest('[data-rq]'); if (tr && !e.target.closest('[data-adj]')) abrir('rq:' + tr.dataset.rq); };
}
async function vRQ(cont, id) {
  const d = await api('requisicion/' + id), r = d.requisicion;
  (E.rqNum = E.rqNum || {})[r.id] = r.numero;
  const abierta = ['Borrador', 'Solicitada'].includes(r.estado);
  const ro = (v, c, tipo = 'text') => `<td class="${tipo === 'num' ? 'num' : ''}">${tipo === 'num' ? fmt(v, 2) : esc(v ?? '')}</td>`;
  const celda = abierta ? window.celda : ro;
  const c = E.res.contratos.find(x => x.id === r.contrato_id) || null;
  const pres = c ? (await api('presupuesto/' + c.id)).items.filter(x => x.tipo === 1) : [];
  const PASOS = { Borrador: ['Solicitada'], Solicitada: ['Aprobada', 'Rechazada', 'Borrador'], Aprobada: ['Atendida', 'Solicitada'], Rechazada: ['Borrador'], Atendida: ['Aprobada'] }[r.estado] || [];
  const etiqueta = { Solicitada: r.estado === 'Borrador' ? 'Solicitar' : 'Devolver a solicitada', Aprobada: r.estado === 'Atendida' ? 'Reabrir (quitar atención)' : 'Aprobar', Rechazada: 'Rechazar', Borrador: 'Devolver a borrador', Atendida: 'Marcar atendida' };
  cont.innerHTML = `<div class="barra-herr"><h2 style="margin:0">Requisición N.º ${r.numero}</h2> <b style="margin-left:10px;color:${COLOR_RQ[r.estado]}">${esc(r.estado)}</b><span class="esp"></span>
    <button class="btn clip" data-adj="requisicion:${r.id}">📎 Adjuntos</button><button class="btn" id="rq-xlsx">Excel</button><button class="btn" id="rq-docx">Word</button></div>
  <table class="grilla" id="g-rq-cab" style="max-width:900px;margin-bottom:10px"><tbody>
    <tr><th>Fecha</th>${celda(r.fecha, 'fecha', 'date')}<th>Contrato</th>${abierta ? `<td><select id="rq-contrato">${E.res.contratos.map(x => `<option value="${x.id}" ${x.id === r.contrato_id ? 'selected' : ''}>${x.tipo === 'obra' ? 'Obra' : 'Interventoría'} ${esc(x.numero || '')}</option>`).join('')}</select></td>` : `<td>${tipoContrato(r.contrato_id)}</td>`}</tr>
    <tr><th>Solicitante</th>${celda(r.solicitante, 'solicitante')}<th>Frente</th>${celda(r.frente, 'frente')}</tr>
    <tr><th>Justificación</th>${celda(r.justificacion, 'justificacion').replace('<td', '<td colspan="3"')}</tr>
    ${r.aprobado_por ? `<tr><th>Aprobada por</th><td colspan="3">${esc(r.aprobado_por)} · ${esc(r.fecha_aprobacion || '')}</td></tr>` : ''}
    ${r.estado === 'Rechazada' ? `<tr><th>Motivo del rechazo</th><td colspan="3">${esc(r.motivo_rechazo || '')}</td></tr>` : ''}
    ${['Aprobada', 'Atendida'].includes(r.estado) ? `<tr><th>Proveedor</th>${window.celda(r.proveedor, 'proveedor')}<th>Factura / orden</th>${window.celda(r.documento, 'documento')}</tr>` : ''}
    ${r.estado === 'Atendida' ? `<tr><th>Atendida</th><td colspan="3">${esc(r.fecha_atencion || '')}${r.gasto_id ? ' · gasto registrado en el contrato de interventoría' : ''}</td></tr>` : ''}
  </tbody></table>
  <div class="barra-herr" id="rq-pasos">${PASOS.map(e => `<button class="btn ${e === 'Aprobada' || (e === 'Solicitada' && r.estado === 'Borrador') ? 'prim' : ''}" data-e="${e}">${etiqueta[e]}</button>`).join('')}</div>
  <div class="grilla-cont"><table class="grilla" id="g-rq-items"><thead><tr><th>Ítem del presupuesto</th><th>Descripción</th><th>Und</th><th class="num">Cantidad</th><th class="num">Vr. unitario estimado</th><th class="num">Vr. total</th>${abierta ? '<th></th>' : ''}</tr></thead><tbody>
  ${d.items.map(x => `<tr data-id="${x.id}"><td>${abierta ? `<select data-item><option value="">—</option>${pres.map(p => `<option value="${p.id}" ${p.id === x.item_id ? 'selected' : ''}>${esc(((p.codigo || '') + ' ' + p.descripcion).slice(0, 60))}</option>`).join('')}</select>` : esc(x.item_codigo || '')}</td>
    ${celda(x.descripcion, 'descripcion')}${celda(x.unidad, 'unidad')}${celda(x.cantidad, 'cantidad', 'num')}${celda(x.vr_unitario, 'vr_unitario', 'num')}<td class="num">${pesos(x.total)}</td>${abierta ? `<td><button class="btn" data-borrar="${x.id}">✕</button></td>` : ''}</tr>`).join('') || '<tr><td colspan="7" class="sub">Sin ítems</td></tr>'}
  <tr class="cap"><td></td><td>TOTAL ESTIMADO</td><td></td><td></td><td></td><td class="num">${pesos(d.total)}</td>${abierta ? '<td></td>' : ''}</tr>
  </tbody></table></div>${abierta ? '<button class="btn" id="rq-item" style="margin-top:6px">+ Ítem</button>' : ''}`;
  const err = er => aviso('Error: ' + er.message);
  editable($('#g-rq-cab'), (td, v) => api('t/requisicion/' + id, 'PUT', { [td.dataset.c]: v }));
  if (abierta) editable($('#g-rq-items'), (td, v) => api('t/requisicion_item/' + td.closest('tr').dataset.id, 'PUT', { [td.dataset.c]: v }));
  $('#rq-xlsx').onclick = () => (location.href = '/api/xlsx/requisicion/' + id);
  $('#rq-docx').onclick = () => (location.href = '/api/docx/requisicion/' + id);
  if ($('#rq-contrato')) $('#rq-contrato').onchange = e => api('t/requisicion/' + id, 'PUT', { contrato_id: Number(e.target.value) }).then(pintarDocs).catch(err);
  if ($('#rq-item')) $('#rq-item').onclick = () => api('t/requisicion_item', 'POST', { requisicion_id: r.id, cantidad: 1 }).then(pintarDocs).catch(err);
  $('#g-rq-items').addEventListener('change', e => {
    if (!e.target.matches('[data-item]')) return;
    const p = pres.find(p => String(p.id) === e.target.value), tr = e.target.closest('tr');
    const cambio = { item_id: p ? p.id : null };
    if (p && !tr.querySelector('[data-c="descripcion"]').dataset.v) Object.assign(cambio, { descripcion: p.descripcion, unidad: p.unidad, vr_unitario: p.vr_unitario });
    api('t/requisicion_item/' + tr.dataset.id, 'PUT', cambio).then(pintarDocs).catch(err);
  });
  $('#g-rq-items').addEventListener('click', e => { const b = e.target.closest('[data-borrar]'); if (b && confirm('¿Quitar este ítem?')) api('t/requisicion_item/' + b.dataset.borrar, 'DELETE').then(pintarDocs).catch(err); });
  $('#rq-pasos').onclick = async e => {
    const b = e.target.closest('[data-e]'); if (!b) return;
    const cambio = { estado: b.dataset.e };
    if (b.dataset.e === 'Rechazada') { const m = prompt('Motivo del rechazo:'); if (!m) return; cambio.motivo_rechazo = m; }
    else if (!confirm(`¿${etiqueta[b.dataset.e]} la RQ ${r.numero}?`)) return;
    try { await api('t/requisicion/' + id, 'PUT', cambio); aviso('RQ ' + r.numero + ': ' + b.dataset.e); await refrescar(); } catch (er) { err(er); }
  };
}

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

// ---------- Adjuntos y registro fotográfico ----------
// Cualquier botón con data-adj="tabla:id" abre los adjuntos de ese registro
document.addEventListener('click', e => { const b = e.target.closest('[data-adj]'); if (b) { e.stopPropagation(); const [t, id] = b.dataset.adj.split(':'); dialogoAdjuntos(t, Number(id)); } });
async function marcarAdjuntos(cont) {
  const porTabla = {};
  cont.querySelectorAll('[data-adj]').forEach(b => { const t = b.dataset.adj.split(':')[0]; (porTabla[t] = porTabla[t] || []).push(b); });
  for (const [t, botones] of Object.entries(porTabla)) {
    const n = await api(`adjuntos-conteo/${E.pid}?tabla=${t}`);
    for (const b of botones) { const k = n[b.dataset.adj.split(':')[1]]; b.classList.toggle('con', !!k); b.dataset.n = k || ''; }
  }
}
const tamano = n => (n > 1048576 ? fmt(n / 1048576, 1) + ' MB' : fmt(n / 1024, 0) + ' kB');
// Las fotos se reducen a 1920 px (JPEG) antes de subirlas, para no llenar la base
function prepararArchivo(f) {
  return new Promise(ok => {
    const r = new FileReader();
    if (!/^image\/(jpeg|png|webp)/.test(f.type) || f.size < 600 * 1024) { r.onload = () => ok({ nombre: f.name, tipo_mime: f.type || 'application/octet-stream', datos: String(r.result).split(',')[1] }); return r.readAsDataURL(f); }
    r.onload = () => { const img = new Image(); img.onload = () => {
      const k = Math.min(1, 1920 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      ok({ nombre: f.name.replace(/\.\w+$/, '') + '.jpg', tipo_mime: 'image/jpeg', datos: c.toDataURL('image/jpeg', 0.85).split(',')[1] });
    }; img.src = r.result; };
    r.readAsDataURL(f);
  });
}
const ubicacion = () => new Promise(ok => { if (!navigator.geolocation) return ok({}); navigator.geolocation.getCurrentPosition(p => ok({ lat: p.coords.latitude, lon: p.coords.longitude }), () => ok({}), { timeout: 5000 }); });
function miniatura(a) {
  const url = `/api/adjunto/${a.id}/archivo`;
  return `<div class="adj" data-id="${a.id}">${a.categoria === 'Foto' || /^image\//.test(a.tipo_mime) ? `<a href="${url}" target="_blank"><img src="${url}" loading="lazy" alt=""></a>` : `<a class="doc" href="${url}" target="_blank">📄<span>${esc((a.nombre || '').split('.').pop().toUpperCase())}</span></a>`}
    <div class="adj-info"><b title="${esc(a.nombre)}">${esc(a.descripcion || a.nombre)}</b><span>${fechaLarga(a.fecha)}${a.abscisa ? ' · ' + esc(a.abscisa) : ''}${a.frente ? ' · ' + esc(a.frente) : ''}${a.punto ? ' · punto ' + esc(a.punto) : ''}</span>
    <span>${tamano(a.tamano)} · ${esc(a.usuario || '')}${a.lat ? ` · <a href="https://www.google.com/maps?q=${a.lat},${a.lon}" target="_blank">📍 mapa</a>` : ''}</span>
    <span><a href="${url}?descargar=1">Descargar</a> · <a href="#" data-quitar="${a.id}">Eliminar</a></span></div></div>`;
}
function formularioSubir(foto) {
  return `<div class="subir"><select id="adj-cat"><option ${foto ? '' : 'selected'}>Documento</option><option ${foto ? 'selected' : ''}>Foto</option></select>
    <input id="adj-fecha" type="date" value="${hoyISO()}" title="Fecha"><input id="adj-frente" placeholder="Frente"><input id="adj-abscisa" placeholder="Abscisa (K0+000)"><input id="adj-punto" placeholder="Punto fijo" title="Para fotos comparables en el tiempo">
    <input id="adj-desc" placeholder="Descripción" style="flex:1;min-width:180px"><label class="sub"><input type="checkbox" id="adj-gps"> Ubicación</label>
    <label class="btn prim">Elegir archivos…<input id="adj-archivos" type="file" multiple hidden accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.xml,.kmz,.zip"></label></div>`;
}
async function subirArchivos(lista, tabla, registroId) {
  const extra = { proyecto_id: E.pid, tabla, registro_id: registroId, categoria: $('#adj-cat').value, fecha: $('#adj-fecha').value, frente: $('#adj-frente').value, abscisa: $('#adj-abscisa').value, punto: $('#adj-punto').value, descripcion: $('#adj-desc').value };
  if ($('#adj-gps').checked) Object.assign(extra, await ubicacion());
  let n = 0;
  for (const f of lista) {
    aviso(`Subiendo ${++n} de ${lista.length}: ${f.name}`);
    try { await api('adjunto', 'POST', { ...extra, ...(await prepararArchivo(f)), categoria: /^image\//.test(f.type) ? extra.categoria : 'Documento' }); } catch (e) { aviso('Error: ' + e.message); return; }
  }
  aviso(`${n} archivo(s) subido(s)`);
}
async function dialogoAdjuntos(tabla, id) {
  const pintar = async () => {
    const lista = await api(`adjuntos/${E.pid}?tabla=${tabla}&registro_id=${id}`);
    $('#dialogo-form').innerHTML = `<h3>Adjuntos y registro fotográfico</h3>${formularioSubir(['sst', ...SST_ANEXOS, 'ambiental', 'social', 'pqrs', 'reunion', 'acta_vecindad', 'capacitacion', 'afectacion', 'pmt', 'tramo', 'bitacora', 'ensayo'].includes(tabla))}
      <div class="adjuntos">${lista.map(miniatura).join('') || '<p class="sub">Aún no hay archivos. También puede arrastrarlos a esta ventana.</p>'}</div>
      <div class="acciones"><button class="btn prim" value="ok">Cerrar</button></div>`;
    const caja = $('#dialogo-form');
    $('#adj-archivos').onchange = async e => { await subirArchivos([...e.target.files], tabla, id); pintar(); };
    caja.ondragover = e => e.preventDefault();
    caja.ondrop = async e => { e.preventDefault(); await subirArchivos([...e.dataTransfer.files], tabla, id); pintar(); };
    caja.onclick = async e => { const q = e.target.closest('[data-quitar]'); if (q) { e.preventDefault(); if (confirm('¿Eliminar este archivo?')) { try { await api('t/adjunto/' + q.dataset.quitar, 'DELETE'); pintar(); } catch (er) { aviso('Error: ' + er.message); } } } };
  };
  await pintar();
  if (!$('#dialogo').open) $('#dialogo').showModal();
  $('#dialogo').addEventListener('close', () => { $('#dialogo-form').onclick = $('#dialogo-form').ondrop = null; marcarAdjuntos($('#contenido-doc')); }, { once: true });
}
// Registro fotográfico del proyecto: todas las fotos, con filtro por mes y frente
async function vFotos(cont) {
  E.fotoMes = E.fotoMes ?? hoyISO().slice(0, 7);
  const fotos = await api(`adjuntos/${E.pid}?categoria=Foto${E.fotoMes ? '&mes=' + E.fotoMes : ''}`);
  const frentes = [...new Set(fotos.map(f => f.frente).filter(Boolean))];
  const porFecha = {};
  for (const f of fotos.filter(f => !E.fotoFrente || f.frente === E.fotoFrente)) (porFecha[f.fecha] = porFecha[f.fecha] || []).push(f);
  cont.innerHTML = `<div class="barra-herr"><h2 style="margin:0">Registro fotográfico</h2><span class="esp"></span>
    <label class="sub">Mes <input type="month" id="f-mes" value="${E.fotoMes}"></label>
    <label class="sub">Frente <select id="f-frente"><option value="">Todos</option>${frentes.map(f => `<option ${f === E.fotoFrente ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label></div>
  <p class="sub">Tome fotos al menos cada semana y, cuando pueda, desde el mismo punto fijo para comparar el avance. Aquí también aparecen las fotos adjuntas a SST, ambiental, social, tramos y bitácora.</p>
  ${formularioSubir(true)}
  ${Object.entries(porFecha).map(([f, l]) => `<h3 class="h3">${fechaLarga(f)} · ${l.length} foto(s)</h3><div class="adjuntos">${l.map(miniatura).join('')}</div>`).join('') || '<p class="sub" style="padding:30px;text-align:center">No hay fotos en este periodo.</p>'}`;
  $('#f-mes').onchange = e => { E.fotoMes = e.target.value; pintarDocs(); };
  $('#f-frente').onchange = e => { E.fotoFrente = e.target.value; pintarDocs(); };
  $('#adj-archivos').onchange = async e => { await subirArchivos([...e.target.files], 'proyecto', E.pid); pintarDocs(); };
  cont.onclick = async e => { const q = e.target.closest('[data-quitar]'); if (q) { e.preventDefault(); if (confirm('¿Eliminar esta foto?')) { await api('t/adjunto/' + q.dataset.quitar, 'DELETE'); pintarDocs(); } } };
}

// ---------- Captura de avance en campo ----------
// Abscisa escrita como K0+125,5 o en metros → metros
const metros = s => { const t = String(s ?? '').trim().replace(',', '.'); const m = t.match(/^k?\s*(\d+)\s*\+\s*([\d.]+)$/i); return m ? +m[1] * 1000 + +m[2] : t === '' ? null : Number(t); };
// Igual que en el servidor: m = largo, m² = largo × ancho, m³ = largo × ancho × espesor, und = piezas
function calcularCantidad(v, unidad) {
  const largo = v.largo ?? (v.abs_ini != null && v.abs_fin != null ? Math.abs(v.abs_fin - v.abs_ini) : null);
  const u = String(unidad || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const f = [largo, u.includes('2') || u.includes('3') ? v.ancho : null, u.includes('3') ? v.espesor : null, v.piezas].filter(x => x != null && !Number.isNaN(x));
  return f.length ? Math.round(f.reduce((s, x) => s * x, 1) * 100) / 100 : 0;
}
async function capturarAvance() {
  const ob = contrato('obra'); if (!ob) return aviso('No hay contrato de obra');
  const items = (await api('presupuesto/' + ob.id)).items.filter(i => i.tipo === 1);
  const f = $('#dialogo-form');
  f.innerHTML = `<h3>📷 Capturar avance de obra</h3>
    <p class="sub">Registre lo ejecutado con su memoria de cantidades y fotos. La cantidad se suma sola a la cantidad presentada del acta en borrador del periodo; la interventoría la verifica después.</p>
    <div class="formulario captura">
      <label>Ítem</label><select id="av-item"><option value="">— Elija el ítem —</option>${items.map(i => `<option value="${i.id}" data-u="${esc(i.unidad || '')}">${esc(i.codigo || '')} · ${esc(i.descripcion)} (${esc(i.unidad || '')})</option>`).join('')}</select>
      <label>Fecha</label><input id="av-fecha" type="date" value="${hoyISO()}">
      <label>Frente</label><input id="av-frente" placeholder="Calle 5, margen derecha…">
      <label>Abscisas</label><div class="fila-campos"><input id="av-ini" placeholder="Inicial K0+100"><input id="av-fin" placeholder="Final K0+160"></div>
      <label>Medidas</label><div class="fila-campos"><input id="av-largo" placeholder="Largo (m)"><input id="av-ancho" placeholder="Ancho (m)"><input id="av-espesor" placeholder="Espesor (m)"><input id="av-piezas" placeholder="Piezas / veces"></div>
      <label>Cantidad</label><div class="fila-campos"><input id="av-cant" placeholder="Se calcula sola"><span id="av-und" class="sub"></span><span id="av-memoria" class="sub"></span></div>
      <label>Descripción</label><input id="av-desc" placeholder="Qué se ejecutó">
      <label>Fotos</label><div class="fila-campos"><label class="btn prim">Tomar o elegir fotos…<input id="av-fotos" type="file" accept="image/*" capture="environment" multiple hidden></label><span id="av-nfotos" class="sub">Ninguna (obligatorio al menos una)</span></div>
      <label></label><label class="sub"><input type="checkbox" id="av-gps" checked> Guardar mi ubicación (GPS)</label>
    </div>
    <p class="sub" id="av-msg"></p>
    <div class="acciones"><button class="btn" value="no">Cancelar</button><button class="btn prim" id="av-guardar">Guardar captura</button></div>`;
  $('#dialogo').showModal();
  let manual = false, fotos = [];
  const valores = () => { const n = id => { const v = $(id).value.trim().replace(',', '.'); return v === '' ? null : Number(v); }; return { abs_ini: metros($('#av-ini').value), abs_fin: metros($('#av-fin').value), largo: n('#av-largo'), ancho: n('#av-ancho'), espesor: n('#av-espesor'), piezas: n('#av-piezas') }; };
  const recalcular = () => {
    const op = $('#av-item').selectedOptions[0], und = op?.dataset.u || '', v = valores();
    $('#av-und').textContent = und;
    if (!manual) $('#av-cant').value = op?.value ? fmt(calcularCantidad(v, und)) : '';
    const largo = v.largo ?? (v.abs_ini != null && v.abs_fin != null ? Math.abs(v.abs_fin - v.abs_ini) : null);
    $('#av-memoria').textContent = largo != null ? `= ${[largo, v.ancho, v.espesor, v.piezas].filter(x => x != null).map(x => fmt(x)).join(' × ')}` : '';
  };
  f.querySelectorAll('input, select').forEach(e => e.addEventListener('input', recalcular));
  $('#av-cant').addEventListener('input', () => (manual = $('#av-cant').value.trim() !== ''));
  $('#av-fotos').onchange = e => { fotos = [...e.target.files]; $('#av-nfotos').textContent = `${fotos.length} foto(s)`; };
  $('#av-guardar').onclick = async ev => {
    ev.preventDefault();
    const msg = t => ($('#av-msg').textContent = t);
    if (!$('#av-item').value) return msg('Elija el ítem.');
    if (!fotos.length) return msg('Agregue al menos una foto del avance.');
    const v = valores(), cantidad = num($('#av-cant').value);
    if (!cantidad) return msg('La cantidad es cero: escriba las medidas o la cantidad.');
    msg('Guardando…');
    try {
      const gps = $('#av-gps').checked ? await ubicacion() : {};
      const av = await api('t/avance', 'POST', { proyecto_id: E.pid, item_id: Number($('#av-item').value), fecha: $('#av-fecha').value, frente: $('#av-frente').value, descripcion: $('#av-desc').value, ...v, ...gps, ...(manual ? { cantidad } : {}) });
      let n = 0;
      for (const foto of fotos) {
        msg(`Subiendo foto ${++n} de ${fotos.length}…`);
        await api('adjunto', 'POST', { proyecto_id: E.pid, tabla: 'avance', registro_id: av.id, categoria: 'Foto', fecha: av.fecha, frente: av.frente, abscisa: [abscisa(av.abs_ini), abscisa(av.abs_fin)].filter(Boolean).join(' – '), descripcion: av.descripcion || $('#av-item').selectedOptions[0].text, ...gps, ...(await prepararArchivo(foto)) });
      }
      $('#dialogo').close();
      const acta = av.acta_id ? E.res.contratos.flatMap(c => c.actas).find(a => a.id === av.acta_id) : null;
      aviso(`Avance guardado: ${fmt(av.cantidad)} ${$('#av-und').textContent}` + (av.acta_id ? ` sumados al acta ${acta?.numero ?? ''}` : ' (sin acta en borrador: entrará a la próxima acta del periodo)'));
      await refrescar();
    } catch (e) { msg('Error: ' + e.message); }
  };
}
async function vAvances(cont) {
  const lista = await api('avances/' + E.pid);
  const porItem = {};
  for (const a of lista.filter(a => a.estado !== 'Rechazado')) { const k = a.item_id; porItem[k] = porItem[k] || { codigo: a.codigo, item: a.item, unidad: a.unidad, contratada: a.cant_contratada, total: 0, verificado: 0 }; porItem[k].total += a.cantidad || 0; if (a.estado === 'Verificado') porItem[k].verificado += a.cantidad || 0; }
  cont.innerHTML = `<div class="barra-herr"><h2 style="margin:0">Capturas de avance en campo</h2><span class="esp"></span><button class="btn prim" id="av-nuevo">📷 Capturar avance</button></div>
  <p class="sub">Cada captura suma su cantidad a la cantidad presentada del acta en borrador del periodo. Al marcarla Rechazada se descuenta. Una vez el acta se aprueba, sus capturas quedan cerradas.</p>
  <h3 class="h3">Ejecutado en campo por ítem</h3>
  <div class="grilla-cont"><table class="grilla"><thead><tr><th>Código</th><th>Ítem</th><th>Und</th><th class="num">Contratada</th><th class="num">Reportado en campo</th><th class="num">Verificado</th><th class="num">% del contratado</th></tr></thead><tbody>
  ${Object.values(porItem).map(i => `<tr class="${i.total > i.contratada + 1e-9 ? 'alerta' : ''}"><td>${esc(i.codigo)}</td><td>${esc(i.item)}</td><td>${esc(i.unidad)}</td><td class="num">${fmt(i.contratada)}</td><td class="num">${fmt(i.total)}</td><td class="num">${fmt(i.verificado)}</td><td class="num">${i.contratada ? pct(i.total / i.contratada) : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="sub">Aún no hay capturas</td></tr>'}
  </tbody></table></div>
  <h3 class="h3">Capturas</h3>
  <div class="grilla-cont"><table class="grilla" id="g-avances"><thead><tr><th>Fecha</th><th>Ítem</th><th>Frente</th><th>Abscisas</th><th>Memoria</th><th class="num">Cantidad</th><th>Und</th><th>Estado</th><th>Acta</th><th>Reportó</th><th></th></tr></thead><tbody>
  ${lista.map(a => `<tr data-id="${a.id}" class="${a.estado === 'Rechazado' ? 'tachado' : ''}"><td>${fechaLarga(a.fecha)}</td><td>${esc(a.codigo || '')} ${esc(a.item || '')}</td><td>${esc(a.frente || '')}</td><td>${abscisa(a.abs_ini)}${a.abs_fin != null ? ' – ' + abscisa(a.abs_fin) : ''}</td>
    <td>${[a.largo ?? (a.abs_fin != null && a.abs_ini != null ? Math.abs(a.abs_fin - a.abs_ini) : null), a.ancho, a.espesor, a.piezas].filter(x => x != null).map(x => fmt(x)).join(' × ')}</td><td class="num">${fmt(a.cantidad)}</td><td>${esc(a.unidad || '')}</td>
    ${a.acta_estado && E.meta.estados_acta.indexOf(a.acta_estado) >= E.meta.bloqueo ? `<td>${esc(a.estado)}</td>` : celda(a.estado, 'estado', 'select', 'data-op="Reportado|Verificado|Rechazado"')}
    <td>${a.acta_numero ? 'Acta ' + a.acta_numero : '<span class="sub">pendiente</span>'}</td><td>${esc(a.usuario || '')}</td>
    <td class="acciones"><button class="btn clip" data-adj="avance:${a.id}" title="Fotos">📷</button><button class="btn" data-borrar="${a.id}" title="Eliminar">✕</button></td></tr>`).join('') || '<tr><td colspan="11" class="sub">Pulse "Capturar avance" para registrar lo ejecutado con fotos</td></tr>'}
  </tbody></table></div>`;
  const g = $('#g-avances');
  editable(g, (td, v) => api('t/avance/' + td.closest('tr').dataset.id, 'PUT', { [td.dataset.c]: v }));
  g.addEventListener('click', async e => { const b = e.target.closest('[data-borrar]'); if (b && confirm('¿Eliminar esta captura? Su cantidad se descuenta del acta en borrador.')) { try { await api('t/avance/' + b.dataset.borrar, 'DELETE'); refrescar(); } catch (er) { aviso('Error: ' + er.message); } } });
  $('#av-nuevo').onclick = capturarAvance;
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
function informeSocial() {
  const mes = prompt('Mes del informe social (AAAA-MM):', new Date().toISOString().slice(0, 7)); if (!mes) return;
  if (!/^\d{4}-\d{2}$/.test(mes.trim())) return alert('Formato de mes no válido: use AAAA-MM');
  location.href = `/api/docx/informe-social/${E.pid}?mes=${mes.trim()}`;
}
async function copiarAnterior() {
  if (!confirm('¿Copiar las cantidades aprobadas del acta anterior a los ítems que en esta acta aún están en cero?')) return;
  try { const r = await api(`acta/${E.activo.split(':')[1]}/copiar-anterior`, 'POST'); await refrescar(); aviso(`${r.items} ítem(s) copiados del acta ${r.desde}`); } catch (e) { aviso('Error: ' + e.message); }
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
  let may = 0, men = 0, sinJ = 0;
  for (const f of filas) { const v = (f.acumulado - f.cantidad_vigente) * f.vr_unitario; v > 0 ? (may += v) : (men += v); if (f.acumulado - f.cantidad_vigente > 1e-9 && !f.justificacion) sinJ++; }
  cont.innerHTML = `<h2>Mayores y menores cantidades</h2><p class="sub">Acumulado aprobado hasta el acta ${d.acta.numero} frente a lo contratado vigente (original + otrosíes firmados)</p>
  <div class="grilla-cont"><table class="grilla"><thead><tr><th>Código</th><th>Descripción</th><th>Und</th><th class="num">Contratada original</th><th class="num">Contratada vigente</th><th class="num">Ejecutada</th><th class="num">Mayor (+) / menor (−)</th><th class="num">Vr. unitario</th><th class="num">Vr. diferencia</th><th>Justificación técnica</th></tr></thead><tbody>
  ${filas.map(f => { const dif = f.acumulado - f.cantidad_vigente; return `<tr data-id="${f.id}" class="${dif > 1e-9 ? 'alerta' : ''}"><td>${esc(f.codigo)}</td><td>${esc(f.descripcion)}</td><td>${esc(f.unidad)}</td><td class="num">${fmt(f.cantidad)}</td><td class="num">${fmt(f.cantidad_vigente)}</td><td class="num">${fmt(f.acumulado)}</td><td class="num ${dif > 0 ? 'malo' : ''}">${semaforo(f.pct)} ${fmt(dif)}</td><td class="num">${fmt(f.vr_unitario)}</td><td class="num">${pesos(dif * f.vr_unitario)}</td>${celda(f.justificacion, 'justificacion', 'text', dif > 1e-9 && !f.justificacion ? 'style="background:#fff3e0" title="Mayor cantidad sin justificar"' : '')}</tr>`; }).join('')}
  </tbody><tfoot><tr><td></td><td>Mayores ${pesos(may)} · menores ${pesos(men)} · mayores sin justificar: ${sinJ}</td><td></td><td></td><td></td><td></td><td></td><td></td><td class="num">${pesos(may + men)}</td><td></td></tr></tfoot></table></div>`;
  editable(cont.querySelector('table.grilla'), (td, v) => api('t/item/' + td.closest('tr').dataset.id, 'PUT', { justificacion: v }));
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
  ${gastos.map(g => `<tr data-id="${g.id}">${celda(g.fecha, 'fecha', 'date')}${celda(nomItem(g.item_id), 'item_id', 'select', `data-op="(sin ítem)|${esc(opItems)}"`)}${celda(g.descripcion, 'descripcion')}${celda(g.proveedor, 'proveedor')}${celda(g.documento, 'documento')}${celda(g.valor, 'valor', 'num')}${celda(g.pagado, 'pagado', 'select', 'data-op="No|Sí"')}<td class="acciones"><button class="btn clip" data-adj="gasto:${g.id}" title="Adjuntos y fotos">📎</button><button class="btn" data-borrar="${g.id}">✕</button></td></tr>`).join('') || '<tr><td colspan="8" class="sub">Sin gastos registrados</td></tr>'}
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
  sst: 'Abierto|En seguimiento|Cerrado', sst_peligro: 'Abierto|En seguimiento|Cerrado', sst_inspeccion: 'Abierto|En seguimiento|Cerrado', sst_permiso: 'Abierto|Cerrado|Suspendido',
  sst_capacitacion: 'Programada|Realizada|Cancelada', sst_trabajador: 'Activo|Retirado', sst_investigacion: 'Abierto|En seguimiento|Cerrado', sst_emergencia: 'Abierto|Cerrado', sst_equipo: 'Operativo|Fuera de servicio|Retirado', sst_actividad: 'Programada|Ejecutada|Cancelada', sst_documento: 'Cargado|Pendiente|No aplica', ambiental: 'Abierto|En seguimiento|Cerrado', social: 'Abierto|En trámite|Respondido|Cerrado', pqrs: 'Abierta|En trámite|Respondida|Cerrada', reunion: 'Programada|Realizada|Acta firmada',
  acta_vecindad: 'Inicio levantado|Cierre pendiente|Cerrada|Con reclamación', afectacion: 'Abierta|En atención|Atendida|Cerrada', veeduria: 'Activa|Inactiva', pmt: 'En trámite|Aprobado|Implementado|Cerrado' };
// Anexos de SST y preguntas de las listas de chequeo (C cumple, NC no cumple, NA no aplica)
const SST_ANEXOS = ['sst_peligro', 'sst_inspeccion', 'sst_permiso', 'sst_capacitacion', 'sst_trabajador', 'sst_epp', 'sst_seguridad_social', 'sst_investigacion', 'sst_emergencia', 'sst_equipo', 'sst_actividad', 'sst_documento'];
const ANEXOS_SST = ['Afiliaciones', 'Exámenes médicos ocupacionales', 'Inducciones y evaluaciones', 'Entrega de EPP y dotación', 'Notificación de riesgos', 'Exámenes de retiro', 'Paz y salvos', 'Preoperacionales', 'Charlas y capacitaciones', 'Inspecciones', 'Licencia de salud ocupacional', 'Certificación de pagos (revisor fiscal)', 'Planillas de seguridad social del mes', 'Actas COPASST y COCOLA', 'Certificado ARL de accidentalidad', 'Personal administrativo', 'Matriz de peligros', 'Plan de trabajo anual SST', 'Plan de emergencias', 'Inspecciones programadas y gestión documental', 'Evidencia fotográfica', 'Aprobación del informe por la interventoría'];
const LISTAS_SST = {
  EPP: ['Casco con barbuquejo en buen estado', 'Gafas de seguridad', 'Protección auditiva donde hay ruido', 'Guantes según la tarea', 'Botas de seguridad', 'Chaleco reflectivo en la vía', 'Ropa de trabajo / dotación', 'Protección respiratoria donde hay polvo o vapores'],
  Andamios: ['Apoyado sobre base firme y nivelada', 'Plataforma completa y asegurada', 'Barandas y rodapiés', 'Arriostrado o anclado a la estructura', 'Acceso seguro (escalera)', 'Tarjeta de inspección vigente', 'Trabajadores con certificado y arnés en alturas'],
  Excavaciones: ['Talud o entibado según la profundidad y el suelo', 'Material excavado retirado del borde', 'Barreras y señalización perimetral', 'Escalera de acceso y salida', 'Inspección diaria por persona competente', 'Redes de servicios identificadas', 'Control de agua (achique)'],
  Señalización: ['PMT aprobado e implementado', 'Señales preventivas y reglamentarias', 'Conos, canalizadores y barricadas', 'Paleteros con radio y chaleco', 'Iluminación y dispositivos luminosos de noche', 'Delimitación de la zona de trabajo'],
  Extintores: ['Carga vigente (etiqueta)', 'Manómetro en zona verde', 'Pasador y sello', 'Ubicado, señalizado y accesible', 'Tipo adecuado al riesgo', 'Inspección mensual registrada'],
  Botiquín: ['Contenido completo', 'Sin elementos vencidos', 'Camilla con inmovilizadores', 'Ubicado y señalizado', 'Brigadista o primer respondiente en el frente'],
  'Herramientas y equipos': ['Herramientas en buen estado', 'Guardas y protecciones', 'Extensiones y tableros sin daños', 'Maquinaria con preoperacional diario', 'Alarma de reversa y pito'],
  'Orden y aseo': ['Áreas de tránsito despejadas', 'Materiales apilados y estables', 'Residuos clasificados', 'Baterías sanitarias e hidratación', 'Zona de almacenamiento de combustibles'],
};
// Lista de chequeo de una inspección: guarda {pregunta: C|NC|NA} y el servidor calcula el % de cumplimiento
async function dialogoChequeo(id) {
  const r = await api('t/sst_inspeccion/' + id), preg = LISTAS_SST[r.tipo] || [], resp = JSON.parse(r.chequeo || '{}');
  if (!preg.length) return aviso('Escoja primero el tipo de inspección');
  const f = $('#dialogo-form');
  f.innerHTML = `<h3>Lista de chequeo · ${esc(r.tipo)} · ${esc(r.fecha || '')}</h3><table class="grilla"><thead><tr><th>Ítem</th><th>C</th><th>NC</th><th>NA</th></tr></thead><tbody>
  ${preg.map((q, i) => `<tr><td>${esc(q)}</td>${['C', 'NC', 'NA'].map(v => `<td><input type="radio" name="q${i}" value="${v}" ${resp[q] === v ? 'checked' : ''}></td>`).join('')}</tr>`).join('')}</tbody></table>
  <div class="acciones"><button class="btn" value="no">Cancelar</button><button class="btn prim" value="si" id="ch-ok">Guardar</button></div>`;
  $('#dialogo').showModal();
  $('#ch-ok').onclick = async ev => {
    ev.preventDefault();
    const chequeo = {};
    preg.forEach((q, i) => { const m = f.querySelector(`[name="q${i}"]:checked`); if (m) chequeo[q] = m.value; });
    try { await api('t/sst_inspeccion/' + id, 'PUT', { chequeo }); $('#dialogo').close(); refrescar(); } catch (e) { aviso('Error: ' + e.message); }
  };
}
// Informe SST mensual del contratista en Word
function informeSST() {
  const mes = prompt('Mes del informe SST (AAAA-MM)', hoyISO().slice(0, 7));
  if (mes && /^\d{4}-\d{2}$/.test(mes)) location.href = `/api/docx/informe-sst/${E.pid}?mes=${mes}`;
}
const PROGRAMAS_AMB = 'Desarrollo y aplicación de la gestión ambiental (DAGA)|Actividades constructivas|Gestión hídrica|Biótico (flora y fauna)|Instalaciones temporales, maquinaria y equipos|Gestión social|Seguridad y salud en el trabajo';
const TABLAS = {
  vencimiento: { titulo: 'Vencimientos y pendientes', cols: [['fecha', 'Fecha', 'date'], ['tipo', 'Tipo'], ['descripcion', 'Descripción'], ['responsable', 'Responsable'], ['estado', 'Estado', 'select'], ['fuente', 'Fuente']] },
  personal: { titulo: 'Personal de interventoría', cols: [['nombre', 'Nombre'], ['cargo', 'Cargo'], ['dedicacion', 'Dedicación %', 'num'], ['cedula', 'Cédula'], ['matricula', 'Matrícula'], ['telefono', 'Teléfono'], ['correo', 'Correo'], ['estado', 'Estado', 'select'], ['notas', 'Notas']] },
  poliza: { titulo: 'Pólizas y garantías', cols: [['contrato', 'Contrato'], ['amparo', 'Amparo'], ['porcentaje', '%', 'num'], ['valor', 'Valor asegurado', 'num'], ['aseguradora', 'Aseguradora'], ['numero', 'N.º póliza'], ['desde', 'Desde', 'date'], ['hasta', 'Hasta', 'date'], ['estado', 'Estado', 'select'], ['notas', 'Notas']] },
  correspondencia: { titulo: 'Correspondencia', cols: [['fecha', 'Fecha', 'date'], ['sentido', 'Sentido', 'select:Recibida|Enviada'], ['radicado', 'Radicado'], ['de', 'De'], ['para', 'Para'], ['asunto', 'Asunto'], ['requiere_respuesta', '¿Responder?', 'select:Sí|No'], ['plazo', 'Plazo', 'date'], ['estado', 'Estado', 'select'], ['archivo', 'Archivo']] },
  bitacora: { titulo: 'Bitácora de obra', cols: [['fecha', 'Fecha', 'date'], ['clima', 'Clima', 'select:Seco|Lluvia|Lluvia intermitente'], ['frente', 'Frente / abscisa'], ['actividades', 'Actividades'], ['personal_obra', 'Personal', 'num'], ['equipos', 'Equipos'], ['observaciones', 'Observaciones']] },
  sst: { titulo: 'SST · inspecciones, permisos y accidentes', cols: [['fecha', 'Fecha', 'date'], ['tipo', 'Tipo', 'select:Inspección|Charla|Permiso de trabajo|Entrega de EPP|Verificación seguridad social (PILA/ARL)|Trabajo en alturas|Simulacro|Incidente|Accidente'], ['frente', 'Frente'], ['descripcion', 'Descripción'], ['personas', 'Personas', 'num'], ['dias_incapacidad', 'Días incap.', 'num'], ['hallazgo', 'Hallazgo'], ['accion', 'Acción'], ['responsable', 'Responsable'], ['plazo', 'Plazo', 'date'], ['estado', 'Estado', 'select']] },
  sst_mes: { titulo: 'SST · datos mensuales (Res. 0312 de 2019)', cols: [['mes', 'Mes (AAAA-MM)'], ['trabajadores', 'Trabajadores', 'num'], ['accidentes', 'Accidentes', 'num'], ['accidentes_mortales', 'Mortales', 'num'], ['dias_incapacidad', 'Días incapacidad', 'num'], ['dias_cargados', 'Días cargados', 'num'], ['dias_ausencia', 'Días ausencia', 'num'], ['dias_programados', 'Días programados', 'num'], ['planillas_ok', 'PILA/ARL verificada', 'select:Pendiente|Sí|No'], ['notas', 'Notas']] },
  sst_peligro: { titulo: 'SST · matriz de peligros (GTC 45)', cols: [['proceso', 'Proceso'], ['actividad', 'Actividad'], ['rutinaria', 'Rutinaria', 'select:Sí|No'], ['peligro', 'Peligro'], ['clasificacion', 'Clasificación', 'select:Biológico|Físico|Químico|Psicosocial|Biomecánico|Condiciones de seguridad|Fenómenos naturales'], ['efectos', 'Efectos posibles'], ['controles', 'Controles existentes'], ['nd', 'ND', 'select:10|6|2|0'], ['ne', 'NE', 'select:4|3|2|1'], ['nc', 'NC', 'select:100|60|25|10'], ['np', 'NP', 'ro'], ['nr', 'NR', 'ro'], ['nivel', 'Nivel', 'ro'], ['expuestos', 'Expuestos', 'num'], ['intervencion', 'Medida de intervención'], ['responsable', 'Responsable'], ['plazo', 'Plazo', 'date'], ['estado', 'Estado', 'select']] },
  sst_inspeccion: { titulo: 'SST · inspecciones con lista de chequeo', cols: [['fecha', 'Fecha', 'date'], ['tipo', 'Tipo', 'select:' + Object.keys(LISTAS_SST).join('|')], ['frente', 'Frente'], ['inspector', 'Inspector'], ['cumplimiento', '% cumple', 'ro'], ['hallazgos', 'Hallazgos'], ['accion', 'Acción'], ['responsable', 'Responsable'], ['plazo', 'Plazo', 'date'], ['estado', 'Estado', 'select']] },
  sst_permiso: { titulo: 'SST · permisos de trabajo y ATS', cols: [['fecha', 'Fecha', 'date'], ['numero', 'N.º'], ['tipo', 'Tipo', 'select:Trabajo en alturas|Excavación|Trabajo en caliente|Espacio confinado|Eléctrico|Izaje de cargas'], ['frente', 'Frente'], ['actividad', 'Actividad'], ['altura', 'Altura / prof. m', 'num'], ['trabajadores', 'Trabajadores'], ['coordinador', 'Coordinador'], ['emisor', 'Emisor'], ['ats', 'ATS', 'select:Sí|No'], ['lista_chequeo', 'Lista chequeo', 'select:Sí|No'], ['rescate', 'Plan rescate', 'select:Sí|No|No aplica'], ['vigente_hasta', 'Vigente hasta', 'date'], ['estado', 'Estado', 'select']] },
  sst_capacitacion: { titulo: 'SST · capacitaciones y charlas', cols: [['fecha', 'Fecha', 'date'], ['tipo', 'Tipo', 'select:Inducción|Reinducción|Charla de 5 minutos|Capacitación|Trabajo en alturas|Brigada de emergencias|Notificación de riesgos'], ['tema', 'Tema'], ['facilitador', 'Facilitador'], ['horas', 'Horas', 'num'], ['asistentes', 'Asistentes', 'num'], ['lista', 'Nombres de asistentes'], ['evaluacion', 'Evaluación'], ['estado', 'Estado', 'select']] },
  sst_trabajador: { titulo: 'SST · trabajadores del contratista', cols: [['nombre', 'Nombre'], ['documento', 'Documento'], ['cargo', 'Cargo'], ['grupo', 'Grupo', 'select:Administrativo|Operativo|Subcontratista'], ['eps', 'EPS'], ['afp', 'AFP'], ['arl', 'ARL'], ['ccf', 'Caja'], ['riesgo', 'Riesgo ARL', 'select:I|II|III|IV|V'], ['ingreso', 'Ingreso', 'date'], ['retiro', 'Retiro', 'date'], ['examen_ingreso', 'Examen ingreso', 'date'], ['examen_periodico', 'Examen periódico', 'date'], ['examen_retiro', 'Examen retiro', 'date'], ['induccion', 'Inducción', 'date'], ['notificacion_riesgos', 'Notif. riesgos', 'date'], ['paz_salvo', 'Paz y salvo', 'select:Sí|No|No aplica'], ['alturas_vence', 'Cert. alturas hasta', 'date'], ['estado', 'Estado', 'select']] },
  sst_epp: { titulo: 'SST · entrega de EPP y dotación', cols: [['fecha', 'Fecha', 'date'], ['trabajador', 'Trabajador'], ['elemento', 'Elemento', 'select:Casco con barbuquejo|Gafas de seguridad|Protector auditivo|Guantes|Botas de seguridad|Chaleco reflectivo|Overol / dotación|Respirador|Arnés y eslinga|Careta de soldar'], ['cantidad', 'Cant.', 'num'], ['motivo', 'Motivo', 'select:Dotación inicial|Reposición por desgaste|Pérdida|Daño'], ['reposicion', 'Reposición', 'date'], ['firma', 'Firma', 'select:Sí|No']] },
  sst_seguridad_social: { titulo: 'SST · verificación PILA / ARL por trabajador', cols: [['mes', 'Mes (AAAA-MM)'], ['trabajador', 'Trabajador'], ['planilla', 'Planilla PILA'], ['ibc', 'IBC', 'num'], ['eps', 'EPS', 'select:Sí|No|Pendiente'], ['afp', 'AFP', 'select:Sí|No|Pendiente'], ['arl', 'ARL', 'select:Sí|No|Pendiente'], ['ccf', 'CCF', 'select:Sí|No|Pendiente'], ['verificado', 'Verificado', 'select:Sí|No|Pendiente'], ['observacion', 'Observación']] },
  sst_investigacion: { titulo: 'SST · investigación de incidentes y accidentes', cols: [['fecha', 'Fecha evento', 'date'], ['tipo', 'Tipo', 'select:Incidente|Accidente leve|Accidente grave|Accidente mortal'], ['trabajador', 'Trabajador'], ['frente', 'Frente'], ['descripcion', 'Descripción'], ['dias_incapacidad', 'Días incap.', 'num'], ['reporte_arl', 'Reporte ARL (FURAT)', 'date'], ['investigado', 'Investigado', 'date'], ['causas', 'Causas'], ['acciones', 'Acciones'], ['responsable', 'Responsable'], ['plazo', 'Plazo', 'date'], ['estado', 'Estado', 'select']] },
  sst_emergencia: { titulo: 'SST · plan de emergencias y simulacros', cols: [['fecha', 'Fecha', 'date'], ['tipo', 'Tipo', 'select:Plan de emergencias|Simulacro|Brigada|Botiquín|Camilla|Extintores|Punto de encuentro'], ['escenario', 'Escenario'], ['participantes', 'Participantes', 'num'], ['tiempo', 'Tiempo respuesta'], ['resultado', 'Resultado'], ['mejoras', 'Mejoras'], ['proxima', 'Próxima', 'date'], ['estado', 'Estado', 'select']] },
  sst_equipo: { titulo: 'SST · maquinaria y vehículos (preoperacionales)', cols: [['equipo', 'Equipo / vehículo'], ['placa', 'Placa / serie'], ['modelo', 'Modelo'], ['operador', 'Operador'], ['licencia', 'Licencia hasta', 'date'], ['tecnomecanica', 'Técnico-mecánica hasta', 'date'], ['soat', 'SOAT hasta', 'date'], ['ultimo_preoperacional', 'Último preoperacional', 'date'], ['estado', 'Estado', 'select']] },
  sst_actividad: { titulo: 'SST · cronograma, COPASST y COCOLA', cols: [['fecha', 'Fecha', 'date'], ['tipo', 'Tipo', 'select:Cronograma SST|Reunión COPASST|Reunión COCOLA|Obligación contractual'], ['actividad', 'Actividad'], ['responsable', 'Responsable'], ['estado', 'Estado', 'select'], ['observacion', 'Observación']] },
  sst_documento: { titulo: 'SST · soportes del informe (anexos 1 a 22)', cols: [['mes', 'Mes (AAAA-MM)'], ['anexo', 'Anexo', 'select:' + ANEXOS_SST.map((a, i) => (i + 1) + '. ' + a).join('|')], ['descripcion', 'Descripción'], ['estado', 'Estado', 'select']] },
  ambiental: { titulo: 'Seguimiento ambiental (PAGA / PMA)', cols: [['fecha', 'Fecha', 'date'], ['programa', 'Programa', 'select:' + PROGRAMAS_AMB], ['ficha', 'Ficha'], ['actividad', 'Actividad'], ['indicador', 'Indicador'], ['meta', 'Meta', 'num'], ['logro', 'Logro', 'num'], ['cantidad', 'Cantidad', 'num'], ['unidad', 'Und'], ['permiso', 'Permiso'], ['hallazgo', 'Hallazgo'], ['accion', 'Acción'], ['plazo', 'Plazo', 'date'], ['estado', 'Estado', 'select']] },
  pmt: { titulo: 'Planes de manejo de tránsito (PMT)', cols: [['frente', 'Frente'], ['abs_ini', 'Abscisa inicial'], ['abs_fin', 'Abscisa final'], ['cierre', 'Cierre', 'select:Total|Parcial|Por carril|Nocturno'], ['interferencia', 'Interferencia', 'select:Baja|Media|Alta'], ['radicado', 'Radicado aprobación'], ['aprobado', 'Aprobado', 'date'], ['desde', 'Vigente desde', 'date'], ['hasta', 'Vigente hasta', 'date'], ['dispositivos', 'Dispositivos'], ['ultima_inspeccion', 'Última inspección', 'date'], ['cumple', 'Cumple', 'select:Pendiente|Sí|No'], ['estado', 'Estado', 'select'], ['notas', 'Notas']] },
  social: { titulo: 'Gestión social (PGS) y PQRS', cols: [['fecha', 'Fecha', 'date'], ['tipo', 'Tipo', 'select:PQRS|Reunión de inicio|Reunión de avance|Reunión de finalización|Socialización|Acta de vecindad|Mano de obra local|Cultura vial|Visita'], ['ficha', 'Ficha PAGA', 'select:ficha'], ['comunidad', 'Comunidad / peticionario'], ['descripcion', 'Descripción'], ['asistentes', 'Asistentes', 'num'], ['responsable', 'Responsable'], ['respuesta', 'Respuesta'], ['plazo', 'Plazo', 'date'], ['estado', 'Estado', 'select']] },
  pqrs: { titulo: 'PQRS · atención al ciudadano (Ley 1755 de 2015)', cols: [['ficha', 'Ficha PAGA', 'select:ficha'], ['radicado', 'Radicado'], ['fecha', 'Recibida', 'date'], ['tipo', 'Tipo', 'select:Petición|Queja|Reclamo|Sugerencia|Denuncia|Solicitud de documentos|Consulta|Felicitación'], ['canal', 'Canal', 'select:Oficina de atención|Buzón|Correo|Teléfono|Punto móvil|Reunión'], ['peticionario', 'Peticionario'], ['frente', 'Frente'], ['descripcion', 'Asunto'], ['plazo', 'Plazo', 'date'], ['fecha_respuesta', 'Respondida', 'date'], ['respuesta', 'Respuesta'], ['estado', 'Estado', 'select']] },
  reunion: { titulo: 'Reuniones con la comunidad', cols: [['ficha', 'Ficha PAGA', 'select:ficha'], ['fecha', 'Fecha', 'date'], ['tipo', 'Tipo', 'select:Inicio|Avance|Finalización|Extraordinaria|Comité de participación'], ['lugar', 'Lugar'], ['comunidad', 'Comunidad'], ['convocados', 'Convocados', 'num'], ['asistentes', 'Asistentes', 'num'], ['temas', 'Temas'], ['compromisos', 'Compromisos'], ['acta', 'N.º acta'], ['lista_asistencia', 'Lista asistencia', 'select:No|Sí'], ['estado', 'Estado', 'select']] },
  acta_vecindad: { titulo: 'Actas de vecindad por predio (inicio y cierre)', cols: [['ficha', 'Ficha PAGA', 'select:ficha'], ['predio', 'Predio'], ['direccion', 'Dirección'], ['abscisa', 'Abscisa'], ['tipo_inmueble', 'Tipo', 'select:Vivienda|Comercio|Institucional|Lote|Otro'], ['propietario', 'Propietario / ocupante'], ['fecha_inicio', 'Acta inicio', 'date'], ['estado_inicio', 'Estado al inicio'], ['fecha_cierre', 'Acta cierre', 'date'], ['estado_cierre', 'Estado al cierre'], ['danos', 'Daños', 'select:No|Sí'], ['paz_y_salvo', 'Paz y salvo', 'select:No|Sí'], ['estado', 'Estado', 'select']] },
  mano_obra: { titulo: 'Vinculación de mano de obra local', cols: [['ficha', 'Ficha PAGA', 'select:ficha'], ['mes', 'Mes (AAAA-MM)'], ['total', 'Trabajadores', 'num'], ['local_no_calificada', 'Local no calificada', 'num'], ['local_calificada', 'Local calificada', 'num'], ['mujeres', 'Mujeres', 'num'], ['meta', 'Meta % contrato', 'num'], ['notas', 'Notas']] },
  capacitacion: { titulo: 'Cultura vial y capacitaciones a la comunidad', cols: [['ficha', 'Ficha PAGA', 'select:ficha'], ['fecha', 'Fecha', 'date'], ['tipo', 'Tipo', 'select:Cultura vial|Capacitación|Taller|Divulgación'], ['tema', 'Tema'], ['publico', 'Público', 'select:Escolares|Conductores|Motociclistas|Peatones|Comunidad|Trabajadores'], ['lugar', 'Lugar'], ['asistentes', 'Asistentes', 'num'], ['notas', 'Notas']] },
  afectacion: { titulo: 'Afectaciones a predios y servicios públicos', cols: [['ficha', 'Ficha PAGA', 'select:ficha'], ['fecha', 'Fecha', 'date'], ['tipo', 'Tipo', 'select:Predio|Acueducto|Alcantarillado|Energía|Gas|Telecomunicaciones|Acceso vehicular|Acceso peatonal'], ['abscisa', 'Abscisa'], ['descripcion', 'Descripción'], ['afectados', 'Afectados', 'num'], ['empresa', 'Empresa / responsable'], ['accion', 'Acción'], ['fecha_solucion', 'Solucionada', 'date'], ['estado', 'Estado', 'select']] },
  encuesta: { titulo: 'Encuestas de satisfacción', cols: [['ficha', 'Ficha PAGA', 'select:ficha'], ['fecha', 'Fecha', 'date'], ['tipo', 'Tipo', 'select:Atención de PQRS|Reunión|Final de obra|Otra'], ['encuestados', 'Encuestados', 'num'], ['satisfechos', 'Satisfechos', 'num'], ['observaciones', 'Observaciones']] },
  veeduria: { titulo: 'Veedurías ciudadanas (Ley 850 de 2003)', cols: [['nombre', 'Nombre'], ['registro', 'Registro (personería / cámara)'], ['fecha', 'Conformada', 'date'], ['integrantes', 'Integrantes', 'num'], ['ultima_reunion', 'Última reunión', 'date'], ['solicitudes', 'Solicitudes'], ['estado', 'Estado', 'select']] },
  ensayo: { titulo: 'Ensayos de laboratorio', cols: [['fecha', 'Fecha', 'date'], ['ensayo', 'Ensayo'], ['norma', 'Norma'], ['item', 'Ítem'], ['abscisa', 'Abscisa'], ['resultado', 'Resultado'], ['especificacion', 'Especificación'], ['cumple', 'Cumple', 'select:Sí|No|Pendiente'], ['laboratorio', 'Laboratorio']] },
};
// Semáforo de las PQRS y porcentajes de la gestión social
function semaforoPQRS(f) {
  if (f.fecha_respuesta || ['Respondida', 'Cerrada'].includes(f.estado)) return f.fecha_respuesta && f.plazo && f.fecha_respuesta > f.plazo ? ['Fuera de plazo', '#c62828'] : ['A tiempo', 'var(--verde)'];
  const d = dias(f.plazo);
  return d == null ? ['Sin plazo', '#777'] : d < 0 ? ['Vencida', '#c62828'] : d <= 3 ? ['Por vencer', '#e08a00'] : ['En término', 'var(--verde)'];
}
const porc = (a, b) => (b ? fmt(a / b * 100) + ' %' : '—');
const TOTALES = {
  pqrs: fs => `<h3 style="font-size:13px;margin:14px 0 4px">Semáforo de respuesta</h3><div class="grilla-cont"><table class="grilla"><thead><tr><th>Radicado</th><th>Tipo</th><th>Plazo</th><th>Semáforo</th></tr></thead><tbody>${fs.map(f => { const [t, c] = semaforoPQRS(f); return `<tr><td>${esc(f.radicado || '')}</td><td>${esc(f.tipo || '')}</td><td>${esc(f.plazo || '')}</td><td style="color:${c};font-weight:600">● ${t}</td></tr>`; }).join('')}</tbody></table></div>
    <p class="sub">Plazo en días hábiles sin festivos de Colombia (Ley 1755 de 2015, art. 14): 15 días peticiones, quejas y reclamos; 10 días solicitudes de documentos; 30 días consultas. Se calcula al escoger el tipo o la fecha.</p>`,
  mano_obra: fs => `<h3 style="font-size:13px;margin:14px 0 4px">% de mano de obra local por mes</h3><div class="grilla-cont"><table class="grilla"><thead><tr><th>Mes</th><th class="num">% local</th><th class="num">Meta %</th><th>Cumple</th></tr></thead><tbody>${fs.map(f => { const l = (f.local_no_calificada || 0) + (f.local_calificada || 0), v = f.total ? l / f.total * 100 : null; return `<tr><td>${esc(f.mes)}</td><td class="num">${porc(l, f.total)}</td><td class="num">${fmt(f.meta)}</td><td>${f.meta == null || v == null ? '—' : v >= f.meta ? 'Sí' : '<b style="color:#c62828">No</b>'}</td></tr>`; }).join('')}</tbody></table></div>`,
  encuesta: fs => { const e = fs.reduce((s, f) => s + (f.encuestados || 0), 0), k = fs.reduce((s, f) => s + (f.satisfechos || 0), 0); return `<p class="sub">Satisfacción acumulada: ${porc(k, e)} (${k} de ${e} encuestados).</p>`; },
  acta_vecindad: fs => `<p class="sub">${fs.length} predio(s) · con acta de cierre: ${fs.filter(f => f.fecha_cierre).length} · con daños: ${fs.filter(f => f.danos === 'Sí').length}. Adjunte el acta firmada y el registro fotográfico con el 📎 de cada predio.</p>`,
  reunion: () => '<p class="sub">Adjunte el acta y la lista de asistencia con el 📎 de cada reunión: van al anexo 4 del informe mensual.</p>',
};
async function vTabla(cont, tabla) {
  const def = TABLAS[tabla], filas = await api(`t/${tabla}?proyecto_id=${E.pid}`);
  if (!E.fichasSoc) E.fichasSoc = (await api('t/ficha_social')).map(f => f.codigo).join('|');
  const op = t => (t === 'select:ficha' ? E.fichasSoc : t.startsWith('select:') ? t.slice(7) : ESTADOS[tabla] || '');
  cont.innerHTML = `<div class="barra-herr"><h2 style="margin:0">${def.titulo}</h2><span class="esp"></span><button class="btn prim" id="t-nuevo">+ Nueva fila</button></div>
  <div class="grilla-cont"><table class="grilla" id="g-tabla"><thead><tr>${def.cols.map(c => `<th class="${c[2] === 'num' ? 'num' : ''}">${c[1]}</th>`).join('')}<th></th></tr></thead><tbody>
  ${filas.map(f => `<tr data-id="${f.id}">${def.cols.map(([k, , t = 'text']) => {
    if (t === 'ro') return `<td class="${typeof f[k] === 'number' ? 'num' : ''}" title="Calculado">${typeof f[k] === 'number' ? fmt(f[k], k === 'cumplimiento' ? 1 : 0) : esc(f[k] ?? '')}</td>`;
    if (t.startsWith('select')) return celda(f[k], k, 'select', `data-op="${op(t)}"`).replace('<td class="edit', `<td class="edit${k === 'estado' ? '' : ''}`).replace(/>([^<]*)<\/td>$/, k === 'estado' && f[k] ? `><span class="estado ${esc(f[k])}">${esc(f[k])}</span></td>` : '>$1</td>');
    if (['fecha', 'plazo', 'hasta', 'vigente_hasta', 'alturas_vence', 'proxima', 'reposicion', 'licencia', 'tecnomecanica', 'soat'].includes(k)) { const dd = dias(f[k]); const cls = f.estado !== 'Cumplido' && dd != null && dd <= 3 && tabla !== 'bitacora' && tabla !== 'ensayo' ? 'style="color:#c62828;font-weight:600"' : ''; return celda(f[k], k, 'date', cls); }
    return celda(f[k], k, t);
  }).join('')}<td class="acciones">${tabla === 'sst_inspeccion' ? `<button class="btn" data-chequeo="${f.id}" title="Lista de chequeo">☑</button>` : ''}<button class="btn clip" data-adj="${tabla}:${f.id}" title="Adjuntos y fotos">📎</button><button class="btn" data-borrar="${f.id}" title="Eliminar">✕</button></td></tr>`).join('') || `<tr><td colspan="${def.cols.length + 1}" class="sub">Sin registros</td></tr>`}
  </tbody></table></div>`;
  if (tabla === 'sst_mes') {
    const ind = await api('sst-indicadores/' + E.pid);
    cont.insertAdjacentHTML('beforeend', `<h3 style="font-size:13px;margin:14px 0 4px">Indicadores obligatorios (art. 30 Res. 0312 de 2019)</h3>
    <div class="grilla-cont"><table class="grilla"><thead><tr><th>Mes</th><th class="num">Frecuencia AT</th><th class="num">Severidad AT</th><th class="num">AT mortales %</th><th class="num">Ausentismo %</th><th>PILA/ARL</th></tr></thead><tbody>
    ${ind.map(m => `<tr><td>${esc(m.mes)}</td><td class="num">${fmt(m.frecuencia)}</td><td class="num">${fmt(m.severidad)}</td><td class="num">${fmt(m.mortalidad)}</td><td class="num">${fmt(m.ausentismo)}</td><td>${esc(m.planillas_ok)}</td></tr>`).join('') || '<tr><td colspan="6" class="sub">Agregue los datos del mes arriba</td></tr>'}
    </tbody></table></div><p class="sub">Frecuencia = AT del mes ÷ trabajadores × 100 · Severidad = (días de incapacidad + días cargados) ÷ trabajadores × 100 · Ausentismo = días de ausencia ÷ días programados × 100. Verifique las fórmulas con el texto oficial del Ministerio del Trabajo.</p>`);
  }
  if (tabla === 'poliza') { $('#t-nuevo').insertAdjacentHTML('beforebegin', '<button class="btn" id="t-poliza-ia" title="Suba el PDF o la foto de la póliza: la IA lee los amparos y usted confirma">📄 Leer póliza con IA</button> '); $('#t-poliza-ia').onclick = leerDocumentoIA; }
  if (tabla === 'social') cont.insertAdjacentHTML('beforeend', '<p class="sub">Para las PQRS el plazo se calcula solo: 15 días hábiles (Ley 1755 de 2015), sin sábados, domingos ni festivos. Las PQRS con radicado van en Social › PQRS.</p>');
  if (TOTALES[tabla]) cont.insertAdjacentHTML('beforeend', TOTALES[tabla](filas));
  const g = $('#g-tabla');
  editable(g, (td, v) => api(`t/${tabla}/${td.closest('tr').dataset.id}`, 'PUT', { [td.dataset.c]: v }));
  g.addEventListener('click', async e => { const ch = e.target.closest('[data-chequeo]'); if (ch) return dialogoChequeo(Number(ch.dataset.chequeo)); const b = e.target.closest('[data-borrar]'); if (b && confirm('¿Eliminar este registro?')) { await api(`t/${tabla}/${b.dataset.borrar}`, 'DELETE'); refrescar(); } });
  $('#t-nuevo').onclick = async () => { try { await api('t/' + tabla, 'POST', { proyecto_id: E.pid, ...(['bitacora', 'correspondencia', 'ensayo', 'sst', 'ambiental', 'social', 'pqrs', 'reunion', 'capacitacion', 'afectacion', 'encuesta', 'sst_inspeccion', 'sst_permiso', 'sst_capacitacion', 'sst_epp', 'sst_investigacion', 'sst_emergencia', 'sst_actividad'].includes(tabla) ? { fecha: hoyISO() } : tabla === 'acta_vecindad' ? { fecha_inicio: hoyISO() } : ['sst_mes', 'mano_obra', 'sst_seguridad_social', 'sst_documento'].includes(tabla) ? { mes: hoyISO().slice(0, 7) } : {}) }); refrescar(); } catch (e) { aviso('Error: ' + e.message); } };
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

// ---------- Asistente (Gemini, Ollama o Claude) ----------
E.chat = [];
// Markdown sencillo: negrita, código, títulos, listas y tablas (el HTML se escapa antes)
function md(t) {
  const linea = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const celdas = s => s.trim().replace(/^\||\|$/g, '').split('|').map(x => x.trim());
  const out = [], ls = String(t || '').split('\n');
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    if (/^\s*\|.*\|\s*$/.test(l) && /^\s*\|?[\s:|-]+\|?\s*$/.test(ls[i + 1] || '') && (ls[i + 1] || '').includes('-')) {
      let h = `<table class="md-tabla"><tr>${celdas(l).map(c => `<th>${linea(c)}</th>`).join('')}</tr>`; i += 2;
      while (i < ls.length && /^\s*\|.*\|\s*$/.test(ls[i])) h += `<tr>${celdas(ls[i++]).map(c => `<td>${linea(c)}</td>`).join('')}</tr>`;
      out.push(h + '</table>'); i--; continue;
    }
    const lista = l.match(/^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/);
    if (lista) {
      const tag = lista[1] ? 'ol' : 'ul'; let h = `<${tag}>`;
      while (i < ls.length && (ls[i].match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/))) h += `<li>${linea(ls[i++].match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/)[1])}</li>`;
      out.push(h + `</${tag}>`); i--; continue;
    }
    const tit = l.match(/^#{1,4}\s+(.*)$/);
    out.push(tit ? `<div class="md-titulo">${linea(tit[1])}</div>` : l.trim() ? `<div>${linea(l)}</div>` : '<div class="md-espacio"></div>');
  }
  return out.join('');
}
// Sugerencias rápidas según la vista abierta
const SUGERENCIAS = {
  tablero: ['Resume el estado del contrato', '¿Qué vence esta semana?', '¿Cuáles son los principales riesgos del proyecto?'],
  acta: ['¿Qué ítems tienen mayor cantidad?', '¿Hay ítems que superen la cantidad contratada?', 'Resume esta acta'],
  presupuesto: ['¿Cuáles son los ítems de mayor valor?', 'Resume el presupuesto por capítulos'],
  balance: ['¿Cuánto falta por ejecutar?', 'Resume el balance del contrato'],
  mayores: ['¿Qué ítems tienen mayores cantidades?', '¿Cuánto suman las mayores y menores cantidades?'],
  costos: ['¿Cuál es el margen de la interventoría?', '¿En qué ítems se gasta más de lo presupuestado?'],
  gastos: ['¿En qué se ha gastado más?'],
  otrosis: ['Resume los otrosíes y su efecto en valor y plazo'],
  contrato: ['¿Cuál es el valor y el plazo vigentes?'],
  sst: ['Analiza los indicadores del mes'],
  'tabla:vencimiento': ['¿Qué vence esta semana?', 'Crea un vencimiento para el informe mensual'],
  'tabla:correspondencia': ['¿Qué oficios esperan respuesta?', 'Registra una PQRS recibida hoy'],
  'tabla:bitacora': ['Resume la bitácora de la última semana', 'Registra la bitácora de hoy'],
  'tabla:poliza': ['¿Qué pólizas vencen pronto?'],
  'tabla:ensayo': ['¿Hay ensayos con resultados no conformes?'],
  'tabla:personal': ['¿El personal cumple con la dedicación propuesta?'],
};
const sugerencias = () => { const k = E.activo || ''; return SUGERENCIAS[k] || SUGERENCIAS[k.split(':')[0]] || SUGERENCIAS.tablero; };
function pintarSugerencias() {
  const s = $('#chat-sug'); if (!s) return;
  s.innerHTML = sugerencias().map(t => `<button class="sug" data-sug="${esc(t)}">${esc(t)}</button>`).join('');
}
function pintarMensajes() {
  const chat = $('#chat'); if (!chat) return;
  chat.innerHTML = E.chat.map((m, i) => `<div class="msg ${m.role}">${m.role === 'user' ? esc(m.content).replace(/\n/g, '<br>') : md(m.content)}${
    m.estado ? `<div class="pensando">${esc(m.estado)}</div>` : ''}${m.pend ? `<div class="confirmar"><b>¿Confirma esta acción?</b>${m.pend.acciones.map(a => `<div>• ${esc(a)}</div>`).join('')}
    <div class="acciones"><button class="btn" data-conf="0" data-i="${i}">Cancelar</button><button class="btn prim" data-conf="1" data-i="${i}">Guardar</button></div></div>` : ''}</div>`).join('')
    || `<p class="sub">Pregunte sobre el proyecto: saldos, actas, vencimientos, riesgos… El asistente consulta la base y le pide confirmación antes de guardar algo.</p>${E.sinClave ? `<p class="aviso-clave">⚠️ Falta la clave de ${esc(E.proveedorIA || 'Gemini')}. El director la configura en <b>Inicio → Asistente → Clave del asistente</b>.</p>` : ''}`;
  chat.scrollTop = chat.scrollHeight;
}
function pintarAsistente(c) {
  c.innerHTML = `<div class="asistente"><div id="chat" class="chat"></div><div id="chat-sug" class="chat-sug"></div>
    <textarea id="chat-txt" class="chat-txt" placeholder="Escriba su pregunta y pulse Enter (Mayús+Enter: nueva línea)"></textarea>
    <div class="chat-pie"><span class="sub">✦ ${esc(E.proveedorIA || 'Gemini')} · Ctrl+J</span><span><button class="btn" id="chat-poliza" title="Suba cualquier documento u hoja (PDF, foto, Word, Excel) y la IA registra lo que dice">📄 Subir documento</button> <button class="btn" id="chat-limpiar">Nueva conversación</button></span></div></div>`;
  pintarMensajes(); pintarSugerencias();
  const txt = $('#chat-txt');
  txt.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); preguntar(txt.value); } };
  $('#chat-sug').onclick = e => { const b = e.target.closest('[data-sug]'); if (b) preguntar(b.dataset.sug); };
  $('#chat-limpiar').onclick = () => { if (!E.chatOcupado) { E.chat = []; pintarMensajes(); } };
  $('#chat-poliza').onclick = leerDocumentoIA;
  $('#chat').onclick = e => { const b = e.target.closest('[data-conf]'); if (b) confirmarAccion(Number(b.dataset.i), b.dataset.conf === '1'); };
  txt.focus();
}
function abrirAsistente() {
  mostrarLateral('asistente');
  api('asistente/config').then(s => { E.sinClave = !s.configurado; E.proveedorIA = s.nombre; pintarMensajes(); }).catch(() => {});
}
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); if (!$('#dialogo').open) abrirAsistente(); } });
$('#btn-asistente').onclick = abrirAsistente;

async function preguntar(texto) {
  texto = String(texto || '').trim();
  if (!texto || E.chatOcupado) return;
  if ($('#chat-txt')) $('#chat-txt').value = '';
  E.chat.push({ role: 'user', content: texto });
  const historial = E.chat.map(m => ({ role: m.role, content: m.content }));
  E.chat.push({ role: 'assistant', content: '' });
  await conversar({ mensajes: historial, vista: E.activo, titulo: E.activo ? tituloDoc(E.activo) : '' });
}
async function confirmarAccion(i, aprobar) {
  const m = E.chat[i]; if (!m?.pend || E.chatOcupado) return;
  const id = m.pend.id; m.pend = null;
  m.content += aprobar ? '\n\n✔ Acción confirmada.\n\n' : '\n\n✖ Acción cancelada.\n\n';
  E.chat.push(E.chat.splice(i, 1)[0]);
  await conversar({ continuar: id, aprobar });
}
const NOMBRE_HERR = { consultar_tabla: 'Consultando la base', detalle_acta: 'Revisando el acta', presupuesto: 'Leyendo el presupuesto', costos_interventoria: 'Revisando los costos', avisos: 'Revisando los avisos', buscar: 'Buscando en el proyecto' };
// Lee la respuesta en tiempo real (eventos SSE) y va pintando el último mensaje
async function conversar(cuerpo) {
  const m = E.chat[E.chat.length - 1];
  E.chatOcupado = true; m.estado = 'Pensando…'; pintarMensajes();
  try {
    const r = await fetch('/api/asistente/' + E.pid, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Usuario': E.usuario?.id || '' }, body: JSON.stringify(cuerpo) });
    if (!(r.headers.get('content-type') || '').includes('event-stream')) { const d = await r.json(); throw new Error(d.error || r.statusText); }
    const lector = r.body.getReader(), dec = new TextDecoder();
    let resto = '', guardo = false;
    for (;;) {
      const { value, done } = await lector.read(); if (done) break;
      resto += dec.decode(value, { stream: true });
      const partes = resto.split('\n\n'); resto = partes.pop();
      for (const p of partes) {
        const ev = (p.match(/^event: (.*)$/m) || [])[1], d = JSON.parse((p.match(/^data: (.*)$/m) || [])[1] || '{}');
        if (ev === 'texto') { m.content += d.t; m.estado = 'Escribiendo…'; }
        if (ev === 'herramienta') m.estado = (NOMBRE_HERR[d.nombre] || 'Consultando') + '…';
        if (ev === 'confirmar') m.pend = d;
        if (ev === 'guardado') guardo = true;
        if (ev === 'error') m.content += '\n\n⚠️ ' + d.mensaje;
      }
      pintarMensajes();
    }
    if (guardo) await refrescar();
  } catch (er) {
    m.content += (m.content ? '\n\n' : '') + '⚠️ ' + er.message;
    if (/clave/i.test(er.message)) E.sinClave = true;
  }
  m.estado = null; m.content = m.content.trim() || (m.pend ? 'Necesito su confirmación:' : 'Sin respuesta.');
  E.chatOcupado = false;
  if (E.lateral === 'asistente') pintarMensajes();
}
// Elegir el proveedor de IA y sus datos. Las claves se guardan solo en este equipo y nunca se muestran.
async function configurarAsistente() {
  const s = await api('asistente/config');
  const puesta = t => (t ? 'guardada — deje vacío para conservarla' : 'pegue aquí la clave');
  // Por ahora solo Gemini; Ollama y Claude siguen disponibles en el servidor (proveedores.js) para activarlos después
  if (s.proveedor !== 'gemini') s.proveedor = 'gemini';
  $('#dialogo-form').innerHTML = `<h3>Asistente con Gemini (Google)</h3>
    <div class="proveedores">
      <label><input type="radio" name="prov" value="gemini" ${s.proveedor === 'gemini' ? 'checked' : ''}><b>Gemini</b> (Google) · gratis con límites, o con los créditos mensuales de Google AI Pro</label>
    </div>
    <div class="formulario" style="grid-template-columns:150px 1fr">
      <label data-p="claude">Clave de Claude</label><input data-p="claude" id="ia-clave" type="password" placeholder="${puesta(s.tiene_clave)}">
      <label data-p="gemini">Clave de Gemini</label><input data-p="gemini" id="ia-gemini" type="password" placeholder="${puesta(s.tiene_clave_gemini)}">
      <label data-p="gemini">Modelo</label><input data-p="gemini" id="ia-mgemini" value="${esc(s.modelo_gemini)}">
      <label data-p="ollama">Dirección</label><input data-p="ollama" id="ia-url" value="${esc(s.url_ollama)}">
      <label data-p="ollama">Modelo</label><input data-p="ollama" id="ia-mollama" value="${esc(s.modelo_ollama)}">
    </div>
    <p class="sub" id="ia-ayuda"></p>
    <div class="acciones"><button class="btn" value="no">Cancelar</button><button class="btn prim" id="ia-guardar">Guardar</button></div>`;
  const AYUDA = { claude: 'Cree la clave en console.anthropic.com → API Keys (requiere saldo). La suscripción Claude Pro no sirve como clave.',
    gemini: 'Cree la clave en aistudio.google.com → Get API key. Con Google AI Pro active los créditos de Google Cloud en developers.google.com → My Benefits. En el plan gratis Google puede usar los datos para mejorar sus productos.',
    ollama: 'Instale Ollama (ollama.com), ábralo y descargue el modelo una vez con: ollama pull qwen2.5:7b. Necesita un PC con unos 16 GB de RAM.' };
  const mostrar = () => { const p = $('#dialogo-form').querySelector('[name=prov]:checked').value; $('#dialogo-form').querySelectorAll('[data-p]').forEach(e => (e.hidden = e.dataset.p !== p)); $('#ia-ayuda').textContent = AYUDA[p]; };
  $('#dialogo-form').querySelectorAll('[name=prov]').forEach(r => (r.onchange = mostrar)); mostrar();
  $('#dialogo').showModal();
  $('#ia-guardar').onclick = async ev => {
    ev.preventDefault();
    const proveedor = $('#dialogo-form').querySelector('[name=prov]:checked').value;
    try {
      await api('asistente/config', 'POST', { proveedor, clave: $('#ia-clave').value, clave_gemini: $('#ia-gemini').value, modelo_gemini: $('#ia-mgemini').value, url_ollama: $('#ia-url').value, modelo_ollama: $('#ia-mollama').value });
      $('#dialogo').close(); aviso('Asistente configurado'); abrirAsistente();
    } catch (e) { $('#ia-ayuda').textContent = 'Error: ' + e.message; }
  };
}

// ---------- Documentos leídos por la IA ----------
// El usuario sube cualquier archivo (PDF, foto, Word, Excel, CSV); Gemini dice qué es y propone los registros.
// El usuario revisa cada tarjeta y al guardar se crean los registros con el archivo adjunto.
const NOMBRE_TABLA = { poliza: 'Pólizas', correspondencia: 'Correspondencia', ensayo: 'Ensayos', gasto: 'Gastos reales', otrosi: 'Otrosíes', social: 'Gestión social', item: 'Presupuesto', personal: 'Personal', vencimiento: 'Vencimientos', avance: 'Capturas de avance' };
const OCULTOS = ['proyecto_id', 'contrato_id'];
// Campos que se muestran aunque estén vacíos (para completarlos)
const SIEMPRE = { avance: ['item_id', 'cantidad'] };
function leerDocumentoIA() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/pdf,image/*,.docx,.xlsx,.csv,.txt';
  i.onchange = async () => {
    const f = i.files[0]; if (!f) return;
    const archivo = await prepararArchivo(f);
    const caja = $('#dialogo-form');
    caja.innerHTML = `<h3>✦ Leyendo el documento…</h3><p class="sub">${esc(f.name)} · La IA está identificando qué es y qué hay que registrar. Puede tardar un minuto.</p><div class="cargando"></div>`;
    if (!$('#dialogo').open) $('#dialogo').showModal();
    let d;
    try { d = await api('asistente/documento/' + E.pid, 'POST', archivo); }
    catch (e) { caja.innerHTML = `<h3>No se pudo leer el documento</h3><p>${esc(e.message)}</p><div class="acciones"><button class="btn prim" value="ok">Cerrar</button></div>`; return; }
    const ob = contrato('obra');
    E.itemsObra = d.propuestas.some(p => p.tabla === 'avance') && ob ? [{ id: '', codigo: '', descripcion: '— elija —' }, ...(await api('presupuesto/' + ob.id)).items.filter(i => i.tipo === 1)] : [];
    const tarjeta = (p, k) => `<div class="propuesta ${p.permitido ? '' : 'sin-permiso'}" data-k="${k}">
      <label class="prop-cab"><input type="checkbox" data-incluir ${p.permitido ? 'checked' : 'disabled'}> <b>${esc(p.titulo)}</b> <span class="etiqueta">${esc(NOMBRE_TABLA[p.tabla] || p.tabla)}</span>${p.permitido ? '' : ' <span class="sub">(su rol no puede registrar aquí)</span>'}</label>
      <div class="prop-campos">${Object.entries(p.datos).filter(([c, v]) => !OCULTOS.includes(c) && ((v != null && v !== '') || (SIEMPRE[p.tabla] || []).includes(c))).map(([c, v]) => c === 'item_id' ? `<label>ítem del presupuesto<select data-c="item_id" data-num="1">${E.itemsObra.map(i => `<option value="${i.id}" ${i.id === v ? 'selected' : ''}>${esc(i.codigo || '')} ${esc(i.descripcion)} (${esc(i.unidad || '')})</option>`).join('')}</select></label>` : `<label>${esc(c.replace(/_/g, ' '))}<input data-c="${esc(c)}" value="${esc(v ?? '')}"></label>`).join('')}</div></div>`;
    caja.innerHTML = `<h3>✦ ${esc(d.resumen || 'Documento leído')}</h3>
      ${d.observaciones ? `<p class="aviso-clave">💡 ${esc(d.observaciones)}</p>` : ''}
      <p class="sub">Revise y corrija; desmarque lo que no quiera registrar. El archivo quedará adjunto a cada registro (salvo ítems de presupuesto).</p>
      <div class="propuestas">${d.propuestas.map(tarjeta).join('') || '<p class="sub">No encontré nada para registrar en este documento. Puede adjuntarlo a mano con 📎.</p>'}</div>
      <p class="sub" id="doc-msg"></p>
      <div class="acciones"><button class="btn" value="no">Cancelar</button><button class="btn prim" id="doc-guardar" ${d.propuestas.some(p => p.permitido) ? '' : 'disabled'}>Registrar seleccionados</button></div>`;
    $('#doc-guardar').onclick = async ev => {
      ev.preventDefault();
      const elegidas = [...caja.querySelectorAll('.propuesta')].filter(t => t.querySelector('[data-incluir]').checked);
      let n = 0;
      try {
        for (const t of elegidas) {
          const p = d.propuestas[t.dataset.k], datos = { ...p.datos };
          t.querySelectorAll('[data-c]').forEach(e => { const v = e.value.trim(); datos[e.dataset.c] = v === '' ? null : e.dataset.num || typeof p.datos[e.dataset.c] === 'number' || ['cantidad', 'largo', 'ancho', 'espesor', 'piezas', 'abs_ini', 'abs_fin', 'valor', 'porcentaje'].includes(e.dataset.c) ? num(v) : v; });
          if (p.tabla === 'avance' && !datos.item_id) throw new Error(`Elija el ítem del presupuesto en: ${p.titulo}`);
          if (p.tabla === 'avance' && datos.cantidad == null) delete datos.cantidad;
          $('#doc-msg').textContent = `Registrando ${++n} de ${elegidas.length}…`;
          const r = await api('t/' + p.tabla, 'POST', datos);
          if (p.tabla !== 'item') await api('adjunto', 'POST', { proyecto_id: E.pid, tabla: p.tabla, registro_id: r.id, categoria: 'Documento', descripcion: d.resumen || f.name, ...archivo });
        }
        $('#dialogo').close(); aviso(`${n} registro(s) creados desde ${f.name}`); refrescar();
      } catch (e) { $('#doc-msg').textContent = 'Error: ' + e.message; }
    };
  };
  i.click();
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
