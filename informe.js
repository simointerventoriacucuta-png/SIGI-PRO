// SIGI Pro - informe mensual con la estructura de la "Guía del informe del interventor y/o contratista":
// 1. Contratista (1.1 a 1.10), 2. Interventoría (2.1 a 2.7), 3. Observaciones y recomendaciones, 4. Anexos.
// El encabezado reproduce el cuadro del formato (sin logos). Si se pasa una plantilla .docx, se conserva la suya y se reemplaza el cuerpo.
const PizZip = require('pizzip');
const docx = require('docx');
const { enLetras } = require('./integraciones.js');

const x = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pesos0 = v => '$ ' + Math.round(Number(v || 0)).toLocaleString('es-CO');
const pesos = v => '$ ' + Number(v || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v, d = 2) => Number(v || 0).toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fecha = f => (f ? `${+f.slice(8, 10)} de ${MESES[+f.slice(5, 7) - 1]} de ${f.slice(0, 4)}` : '—');

// ---------- WordprocessingML ----------
const run = (t, o = {}) => `<w:r><w:rPr>${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}</w:rPr><w:t xml:space="preserve">${x(t)}</w:t></w:r>`;
// Propiedades en el orden del esquema: keepNext, spacing, ind, jc, outlineLvl
const p = (t, o = {}) => `<w:p><w:pPr>${o.nivel != null || (o.b && !o.sz && !o.centro) ? '<w:keepNext/>' : ''}<w:spacing w:before="${o.antes || 0}" w:after="${o.despues ?? 120}"/>${o.sangria ? `<w:ind w:left="${o.sangria}"/>` : ''}<w:jc w:val="${o.centro ? 'center' : o.der ? 'right' : o.izq ? 'left' : 'both'}"/>${o.nivel != null ? `<w:outlineLvl w:val="${o.nivel}"/>` : ''}</w:pPr>${[].concat(t).map(r => (typeof r === 'string' ? run(r, o) : run(r[0], { ...o, ...r[1] }))).join('')}</w:p>`;
// Títulos con nivel de esquema y marcador: alimentan la tabla de contenido (se reinicia en cada informe)
let indice = [];
function encabezado(t, nivel, o) {
  const n = indice.length + 1, marca = `_TocSigi${n}`;
  indice.push({ t, nivel, marca });
  return p(t, { ...o, nivel }).replace('</w:pPr>', `</w:pPr><w:bookmarkStart w:id="${500 + n}" w:name="${marca}"/>`).replace(/<\/w:p>$/, `<w:bookmarkEnd w:id="${500 + n}"/></w:p>`);
}
const titulo = t => encabezado(t, 0, { b: true, antes: 200, despues: 100, izq: true });
const subtitulo = t => encabezado(t, 1, { b: true, antes: 120, despues: 80, izq: true, sangria: 280 });
// Número del contrato con su año, sin repetirlo si el número ya lo trae
const numContrato = c => (!c ? '—' : `${c.numero || '—'}${c.fecha_firma && !String(c.numero || '').includes(c.fecha_firma.slice(0, 4)) ? ' DE ' + c.fecha_firma.slice(0, 4) : ''}`.toUpperCase());
const salto = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
// Tabla de contenido: una línea por título con un campo PAGEREF al marcador (Word y LibreOffice calculan la página)
function tablaContenido() {
  const fld = (t) => `<w:r><w:fldChar w:fldCharType="${t}"/></w:r>`, instr = s => `<w:r><w:instrText xml:space="preserve"> ${s} </w:instrText></w:r>`;
  const linea = (e, i) => `<w:p><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${ANCHO}"/></w:tabs><w:spacing w:before="0" w:after="40"/><w:ind w:left="${e.nivel * 360}"/></w:pPr>`
    + run(e.t, { b: e.nivel === 0, sz: 18 }) + '<w:r><w:tab/></w:r>' + fld('begin') + instr(`PAGEREF ${e.marca} \\h`) + fld('separate') + run('1', { sz: 18 }) + fld('end')
    + '</w:p>';
  return p('TABLA DE CONTENIDO', { b: true, centro: true, sz: 24, despues: 200 }) + indice.map(linea).join('');
}
const bordes = `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(b => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="7F7F7F"/>`).join('')}</w:tblBorders>`;
const ANCHO = 9300;
function tabla(enc, filas, anchos, vacio = 'Sin registros en el periodo.') {
  if (!filas.length) return p(vacio, { i: true, color: '595959' });
  const w = anchos || enc.map(() => 1), tot = w.reduce((s, v) => s + v, 0), dxa = w.map(v => Math.round((v / tot) * ANCHO));
  const sz = enc.length >= 7 ? 15 : 17, cifra = t => /^(\$ |-?[\d.,]+( %)?$)/.test(String(t ?? ''));
  const celda = (t, i, cab) => `<w:tc><w:tcPr><w:tcW w:w="${dxa[i]}" w:type="dxa"/>${cab ? '<w:shd w:val="clear" w:color="auto" w:fill="D9E2F3"/>' : ''}</w:tcPr>${p(String(t ?? ''), { b: cab, sz, despues: 0, izq: cab || !cifra(t), der: !cab && cifra(t) })}</w:tc>`;
  const fila = (f, cab) => `<w:tr>${cab ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${f.map((t, i) => celda(t, i, cab)).join('')}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${ANCHO}" w:type="dxa"/>${bordes}<w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${dxa.map(v => `<w:gridCol w:w="${v}"/>`).join('')}</w:tblGrid>${fila(enc, true)}${filas.map(f => fila(f)).join('')}</w:tbl>${p('', { despues: 60 })}`;
}
// Cuadro de dos columnas: rótulo (sombreado) y valor
function ficha(filas) {
  const dxa = [3000, ANCHO - 3000];
  const fila = ([r, v]) => `<w:tr><w:tc><w:tcPr><w:tcW w:w="${dxa[0]}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="D9E2F3"/></w:tcPr>${p(r, { b: true, sz: 17, despues: 0, izq: true })}</w:tc><w:tc><w:tcPr><w:tcW w:w="${dxa[1]}" w:type="dxa"/></w:tcPr>${String(v ?? '').split('\n').map(l => p(l, { sz: 17, despues: 0, izq: true })).join('')}</w:tc></w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${ANCHO}" w:type="dxa"/>${bordes}<w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${dxa.map(v => `<w:gridCol w:w="${v}"/>`).join('')}</w:tblGrid>${filas.map(fila).join('')}</w:tbl>${p('', { despues: 60 })}`;
}
const firma = (nombre, cargo) => p('', { despues: 600 }) + p('______________________________', { centro: true, despues: 0 }) + p(nombre || ' ', { centro: true, b: true, despues: 0 }) + p(cargo, { centro: true });
const lista = items => items.map(t => p('• ' + t, { sangria: 360, despues: 60 })).join('');

// Foto en línea (las relaciones y los archivos se agregan al paquete al final)
function imagen(f, id) {
  const cx = 2743200, cy = 2057400; // 7,6 × 5,7 cm
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${9000 + id}" name="Foto ${id}"/>`
    + `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">`
    + `<pic:nvPicPr><pic:cNvPr id="${9000 + id}" name="foto${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdSigiFoto${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
    + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}
// Comparativo "antes y después" desde el mismo punto fijo (Guía IDU GU-CO-02: registro cronológico desde un mismo punto)
function cuadroAntesDespues(pares) {
  if (!pares.length) return '';
  const dxa = ANCHO / 2, pie = (f, r) => p(`${r}: ${[fecha(f.fecha), f.abscisa, f.frente].filter(Boolean).join(' · ')}${f.descripcion ? ' — ' + f.descripcion : ''}`, { sz: 16, centro: true, despues: 0 });
  const celda = (f, r) => `<w:tc><w:tcPr><w:tcW w:w="${dxa}" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr>${imagen(f, f.n)}</w:p>${pie(f, r)}</w:tc>`;
  const filas = pares.map(x => `<w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:tcW w:w="${ANCHO}" w:type="dxa"/><w:gridSpan w:val="2"/><w:shd w:val="clear" w:color="auto" w:fill="D9E2F3"/></w:tcPr>${p(`Punto fijo ${x.punto}`, { b: true, sz: 17, despues: 0, centro: true })}</w:tc></w:tr><w:tr><w:trPr><w:cantSplit/></w:trPr>${celda(x.antes, 'ANTES')}${celda(x.despues, 'DESPUÉS')}</w:tr>`).join('');
  return p('Comparativo antes y después desde el mismo punto fijo de toma:', { b: true }) + `<w:tbl><w:tblPr><w:tblW w:w="${ANCHO}" w:type="dxa"/>${bordes}</w:tblPr><w:tblGrid><w:gridCol w:w="${dxa}"/><w:gridCol w:w="${dxa}"/></w:tblGrid>${filas}</w:tbl>${p('', { despues: 60 })}`;
}
function cuadroFotos(fotos) {
  if (!fotos.length) return p('Sin fotos registradas en el periodo.', { i: true, color: '595959' });
  const dxa = ANCHO / 2, sin = `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(b => `<w:${b} w:val="nil"/>`).join('')}</w:tblBorders>`;
  const celda = f => `<w:tc><w:tcPr><w:tcW w:w="${dxa}" w:type="dxa"/></w:tcPr>${f ? `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${imagen(f, f.n)}</w:p>${p([fecha(f.fecha), f.abscisa, f.frente, f.punto && 'punto ' + f.punto].filter(Boolean).join(' · ') + (f.descripcion ? ': ' + f.descripcion : ''), { sz: 16, centro: true })}` : p('')}</w:tc>`;
  let filas = '';
  for (let i = 0; i < fotos.length; i += 2) filas += `<w:tr><w:trPr><w:cantSplit/></w:trPr>${celda(fotos[i])}${celda(fotos[i + 1])}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${ANCHO}" w:type="dxa"/>${sin}</w:tblPr><w:tblGrid><w:gridCol w:w="${dxa}"/><w:gridCol w:w="${dxa}"/></w:tblGrid>${filas}</w:tbl>`;
}

// ---------- Contenido ----------
function fichaContrato(c, d, esObra) {
  const otro = d.contratos.find(k => k.tipo !== c.tipo);
  const susp = c.suspensiones || [];
  const plazo = c.plazo || (c.fecha_inicio && c.fecha_fin ? Math.round((Date.parse(c.fecha_fin) - Date.parse(c.fecha_inicio)) / 86400000) + ' días' : '—');
  return ficha([
    ['CONTRATO No.:', `${c.numero || '—'}${c.fecha_firma ? ' del ' + fecha(c.fecha_firma) : ''}`],
    ['OBJETO:', c.objeto || d.proyecto.objeto || '—'],
    ['VALOR INICIAL:', pesos(c.valor)],
    ['VALOR ADICIONAL:', pesos(c.adiciones)],
    ['PLAZO INICIAL:', plazo],
    ['PLAZO ADICIONAL:', c.prorroga_dias ? c.prorroga_dias + ' días' : 'No aplica'],
    [esObra ? 'CONTRATISTA:' : 'INTERVENTOR:', `${c.contratista || '—'}${c.nit ? ' · NIT ' + c.nit : ''}${c.representante ? '\nRepresentante legal: ' + c.representante : ''}`],
    ['SUPERVISOR:', c.supervisor || '—'],
    [esObra ? 'INTERVENTOR CONTRATO:' : 'CONTRATISTA:', otro ? `${otro.contratista || '—'}\nContrato ${otro.numero || '—'}${otro.fecha_firma ? ' del ' + fecha(otro.fecha_firma) : ''}` : 'No aplica'],
    [`ANTICIPO (${num(c.anticipo_pct, 0)} %)`, pesos((c.valor || 0) * (c.anticipo_pct || 0) / 100)],
    ['FECHA DE INICIACIÓN:', fecha(c.fecha_inicio)],
    ['ACTA DE SUSPENSIÓN:', susp.length ? susp.map(s => `N.º ${s.acta || s.numero} · ${fecha(s.fecha_suspension)}`).join('\n') : 'No aplica'],
    ['ACTA DE REINICIACIÓN:', susp.filter(s => s.fecha_reinicio).map(s => `N.º ${s.numero} · ${fecha(s.fecha_reinicio)}`).join('\n') || 'No aplica'],
    ['FECHA DE TERMINACIÓN:', fecha(c.fecha_fin_vigente) + (c.fecha_fin && c.fecha_fin_vigente !== c.fecha_fin ? ` (inicial ${fecha(c.fecha_fin)})` : '')],
    ['MUNICIPIO:', d.proyecto.ubicacion || '—'],
    ['OFICINA GESTORA:', c.contratante || d.proyecto.entidad || '—'],
  ]);
}
function relacionActas(c, esObra, fin) {
  const filas = [];
  if (c.fecha_inicio) filas.push(['INICIO', fecha(c.fecha_inicio), '']);
  for (const a of c.actas.filter(a => !fin || (a.hasta || a.fecha || '') <= fin)) filas.push([`${esObra ? 'PARCIAL' : 'CUENTA DE COBRO'} ${a.numero}`, fecha(a.hasta || a.fecha), `${a.estado} · ${pesos(a.valor)} · acumulado ${pesos(a.acumulado)}`]);
  for (const o of c.otrosis || []) filas.push([`MODIFICACIÓN ${o.numero}`, fecha(o.fecha), `${o.tipo || ''} · ${o.estado}${o.valor ? ' · ' + pesos(o.valor) : ''}${o.dias ? ' · ' + o.dias + ' días' : ''}`]);
  for (const s of c.suspensiones || []) {
    filas.push([`SUSPENSIÓN ${s.numero}`, fecha(s.fecha_suspension), s.motivo || '']);
    if (s.fecha_reinicio) filas.push([`REINICIACIÓN ${s.numero}`, fecha(s.fecha_reinicio), '']);
  }
  return tabla(['ACTA', 'FECHA', 'OBSERVACIÓN'], filas, [2, 2, 5], 'Sin actas registradas.');
}
const polizasDe = (d, tipo) => d.polizas.filter(x => (tipo === 'obra' ? /obra/i : /interv/i).test(x.contrato || ''));
function cuadroPolizas(pol) {
  const aseg = [...new Set(pol.map(x => x.aseguradora).filter(Boolean))];
  return p([['Nombre de la aseguradora: ', { b: true }], aseg.join(', ') || '—']) +
    tabla(['N.º DE LA PÓLIZA', 'CONCEPTO DEL AMPARO', 'VALOR ASEGURADO', 'DESDE', 'HASTA', 'ESTADO'], pol.map(x => [x.numero || '', x.amparo || '', pesos(x.valor), fecha(x.desde), fecha(x.hasta), x.estado || '']), [2, 3, 2, 2, 2, 1.5], 'Sin pólizas registradas para este contrato.');
}
function reuniones(d) {
  const g = d.gs?.reuniones || [], r = d.social.filter(s => /reuni|socializ|visita|vecindad/i.test(s.tipo || ''));
  const cuadro = g.length ? tabla(['N.º', 'FECHA', 'TIPO', 'LUGAR / COMUNIDAD', 'CONVOCADOS / ASISTENTES', 'TEMAS Y COMPROMISOS', 'ACTA', 'LISTA'],
    g.map((s, i) => [String(i + 1).padStart(2, '0'), fecha(s.fecha), s.tipo || '', [s.lugar, s.comunidad].filter(Boolean).join(' · '), `${s.convocados ?? '—'} / ${s.asistentes ?? '—'}`, [s.temas, s.compromisos && 'Compromisos: ' + s.compromisos].filter(Boolean).join('. '), s.acta || '', s.lista_asistencia || '']), [0.6, 1.4, 1.2, 1.8, 1.2, 3.2, 0.9, 0.7]) : '';
  const otras = r.map((s, i) => p([[`Reunión N.º ${String(g.length + i + 1).padStart(2, '0')} `, { b: true }], `el día ${fecha(s.fecha)}${s.comunidad ? ' con ' + s.comunidad : ''} (${s.tipo}${s.asistentes ? ', ' + s.asistentes + ' asistentes' : ''}): ${s.descripcion || ''}`])).join('');
  return cuadro + otras || p('No se registraron reuniones en el periodo.', { i: true, color: '595959' });
}
// Cuadros de gestión social del mes (PGS del INVÍAS / PGSC de la ANI)
function gestionSocial(d) {
  const g = d.gs;
  if (!g) return '';
  const mo = g.mano_obra, sub = t => p(t, { b: true, sangria: 560, despues: 60 });
  return [
    sub('a) Atención al ciudadano: PQRS (Ley 1755 de 2015)'),
    p(`Recibidas en el mes: ${g.pqrs_recibidas}. Vencidas sin respuesta: ${g.pqrs_mes.filter(x => x.semaforo === 'Vencida').length}. Por vencer: ${g.pqrs_mes.filter(x => x.semaforo === 'Por vencer').length}.`),
    tabla(['RADICADO', 'FECHA', 'TIPO', 'CANAL', 'ASUNTO', 'PLAZO', 'RESPUESTA', 'SEMÁFORO'], g.pqrs_mes.map(x => [x.radicado || '', fecha(x.fecha), x.tipo || '', x.canal || '', x.descripcion || '', fecha(x.plazo), x.fecha_respuesta ? fecha(x.fecha_respuesta) : x.estado || '', x.semaforo]), [1.2, 1.3, 1.1, 1.1, 2.6, 1.3, 1.3, 1.2], 'Sin PQRS en el periodo.'),
    sub('b) Actas de vecindad'),
    p(`Predios con acta de inicio: ${g.vecindad_total}; con acta de cierre: ${g.vecindad_cerradas}.`),
    tabla(['PREDIO', 'DIRECCIÓN / ABSCISA', 'TIPO', 'ACTA DE INICIO', 'ACTA DE CIERRE', 'DAÑOS', 'PAZ Y SALVO', 'ESTADO'], g.vecindad.map(a => [a.predio || '', [a.direccion, a.abscisa].filter(Boolean).join(' · '), a.tipo_inmueble || '', fecha(a.fecha_inicio), a.fecha_cierre ? fecha(a.fecha_cierre) : '—', a.danos || '', a.paz_y_salvo || '', a.estado || '']), [1, 2, 1.1, 1.4, 1.4, 0.8, 0.9, 1.3], 'Sin actas de vecindad en el periodo.'),
    sub('c) Vinculación de mano de obra local'),
    mo ? tabla(['MES', 'TRABAJADORES', 'LOCAL NO CALIFICADA', 'LOCAL CALIFICADA', 'MUJERES', '% LOCAL', 'META %', 'CUMPLE'], [[mo.mes, mo.total, mo.local_no_calificada, mo.local_calificada, mo.mujeres, mo.pct != null ? num(mo.pct, 1) : '—', mo.meta != null ? num(mo.meta, 1) : '—', mo.meta == null || mo.pct == null ? '—' : mo.pct >= mo.meta ? 'Sí' : 'No']]) : p('Sin reporte de mano de obra local para el mes.', { i: true, color: '595959' }),
    sub('d) Cultura vial y capacitaciones a la comunidad'),
    tabla(['FECHA', 'TIPO', 'TEMA', 'PÚBLICO', 'LUGAR', 'ASISTENTES'], g.capacitaciones.map(c => [fecha(c.fecha), c.tipo || '', c.tema || '', c.publico || '', c.lugar || '', c.asistentes ?? '']), [1.4, 1.3, 2.6, 1.4, 1.6, 1], 'Sin actividades de cultura vial o capacitación en el periodo.'),
    sub('e) Afectaciones a predios y servicios públicos'),
    tabla(['FECHA', 'TIPO', 'ABSCISA', 'DESCRIPCIÓN', 'AFECTADOS', 'EMPRESA', 'ACCIÓN', 'ESTADO'], g.afectaciones.map(a => [fecha(a.fecha), a.tipo || '', a.abscisa || '', a.descripcion || '', a.afectados ?? '', a.empresa || '', a.accion || '', a.estado || '']), [1.3, 1.2, 1, 2.4, 0.9, 1.2, 1.8, 1], 'Sin afectaciones abiertas ni registradas en el periodo.'),
    sub('f) Encuestas de satisfacción y veedurías ciudadanas'),
    p(g.encuestas.length ? `Se aplicaron ${g.encuestas.reduce((s, e) => s + (e.encuestados || 0), 0)} encuesta(s); satisfacción: ${num(g.satisfaccion, 1)} %.` : 'No se aplicaron encuestas de satisfacción en el periodo.'),
    p(g.veedurias.length ? 'Veedurías ciudadanas (Ley 850 de 2003): ' + g.veedurias.map(v => `${v.nombre || 'sin nombre'} (${v.registro || 'sin registro'}, ${v.estado || ''}${v.ultima_reunion ? ', última reunión ' + fecha(v.ultima_reunion) : ''})`).join('; ') + '.' : 'No hay veedurías ciudadanas registradas para el proyecto.'),
  ].join('');
}
function ensayos(d) {
  return tabla(['FECHA', 'ENSAYO', 'NORMA', 'ÍTEM / ABSCISA', 'RESULTADO', 'ESPECIFICACIÓN', 'CUMPLE', 'LABORATORIO'],
    d.ensayos.map(e => [fecha(e.fecha), e.ensayo || '', e.norma || '', [e.item, e.abscisa].filter(Boolean).join(' · '), e.resultado || '', e.especificacion || '', e.cumple || '', e.laboratorio || '']), [1.6, 2, 1.3, 1.6, 1.3, 1.5, 0.9, 1.6], 'No se realizaron ensayos en el periodo.');
}

// ---------- Cuadros de control ----------
const pct = v => (v == null ? '—' : num(v, 1) + ' %');
const semaforo = dif => (dif == null ? '' : dif > 5 ? 'Adelantado' : dif >= -5 ? 'Al día' : dif >= -15 ? 'Atraso leve' : 'Atraso crítico');
// Balance de cantidades por capítulo: contratado vigente vs ejecutado (periodo y acumulado) vs saldo, a costo directo
function cuadroBalance(c) {
  const b = c.balance || [];
  if (!b.length) return p('No hay presupuesto cargado para elaborar el balance de cantidades.', { i: true, color: '595959' });
  const t = b.reduce((s, g) => ({ contratado: s.contratado + g.contratado, periodo: s.periodo + g.periodo, acumulado: s.acumulado + g.acumulado, mayores: s.mayores + g.mayores }), { contratado: 0, periodo: 0, acumulado: 0, mayores: 0 });
  const filas = b.map(g => [g.capitulo, pesos0(g.contratado), pesos0(g.periodo), pesos0(g.acumulado), pesos0(g.saldo), pct(g.pct), g.mayores || '']);
  filas.push(['TOTAL COSTO DIRECTO', pesos0(t.contratado), pesos0(t.periodo), pesos0(t.acumulado), pesos0(t.contratado - t.acumulado), pct(t.contratado ? t.acumulado / t.contratado * 100 : 0), t.mayores || '']);
  const mayor = [...b].sort((a, z) => z.periodo - a.periodo)[0];
  return p(`El balance a costo directo (sin AIU ni IVA) muestra una ejecución acumulada de ${pesos0(t.acumulado)} frente a ${pesos0(t.contratado)} contratados vigentes (${pct(t.contratado ? t.acumulado / t.contratado * 100 : 0)}).${t.periodo && mayor ? ` El capítulo con mayor ejecución en el periodo fue «${mayor.capitulo}» (${pesos0(mayor.periodo)}).` : ' En el periodo no se aprobaron cantidades.'}${t.mayores ? ` Hay ${t.mayores} ítem(s) con mayores cantidades ejecutadas que deben soportarse con el balance de mayores y menores cantidades.` : ''}`)
    + tabla(['CAPÍTULO', 'CONTRATADO VIGENTE', 'EJECUTADO PERIODO', 'EJECUTADO ACUMULADO', 'SALDO', '% EJEC.', 'ÍTEMS CON MAYOR CANT.'], filas, [3, 1.8, 1.7, 1.8, 1.7, 1, 1]);
}
function cuadroBalanceItems(c) {
  const it = (c.balance_items || []).filter(i => i.contratada || i.acumulada);
  return tabla(['ÍTEM', 'DESCRIPCIÓN', 'UND', 'CANT. CONTRATADA', 'CANT. PERIODO', 'CANT. ACUMULADA', 'SALDO', '% EJEC.'],
    it.map(i => [i.codigo || '', i.descripcion || '', i.unidad || '', num(i.contratada), num(i.periodo), num(i.acumulada), num(i.saldo), pct(i.contratada ? i.acumulada / i.contratada * 100 : null)]), [0.9, 3.6, 0.7, 1.3, 1.2, 1.3, 1.2, 1], 'Sin ítems con cantidades contratadas o ejecutadas.');
}
// Flujo de caja e inversión del anticipo: actas a la fecha de corte, amortización y neto a pagar
function cuadroFlujo(c) {
  const f = c.flujo || [], ult = f[f.length - 1];
  const txt = c.anticipo ? `El contrato tiene un anticipo del ${num(c.anticipo_pct, 0)} % por ${pesos0(c.anticipo)}, que se amortiza en cada acta en el mismo porcentaje. A la fecha de corte se han amortizado ${pesos0(c.anticipo - (ult ? ult.saldo_anticipo : c.anticipo))} y queda un saldo por amortizar de ${pesos0(ult ? ult.saldo_anticipo : c.anticipo)}.` : 'El contrato no tiene anticipo registrado; el flujo corresponde a los pagos por actas parciales.';
  return p(txt) + tabla(['ACTA', 'FECHA DE CORTE', 'ESTADO', 'VALOR BRUTO', 'AMORTIZ. ANTICIPO', 'NETO A PAGAR', 'ACUMULADO', 'SALDO ANTICIPO'],
    f.map(a => [a.numero, fecha(a.corte), a.estado || '', pesos0(a.valor), pesos0(a.amortizacion), pesos0(a.neto), pesos0(a.acumulado), pesos0(a.saldo_anticipo)]), [0.8, 1.5, 1.4, 1.8, 1.7, 1.8, 1.8, 1.8], 'No hay actas con fecha de corte a la fecha del informe.');
}
// Curva S en tabla: avance programado vs ejecutado, mensual y acumulado
function cuadroCurva(c) {
  const cv = c.curva || [];
  if (!cv.length) return p('No se puede construir la curva S: falta la fecha de inicio del contrato.', { i: true, color: '595959' });
  const u = cv[cv.length - 1], dif = u.prog_acum == null ? null : u.ejec_acum - u.prog_acum;
  return p(`La curva S compara el avance programado (base: ${c.curva_base}) con el avance ejecutado según el valor acumulado de las actas sobre el valor vigente del contrato. Al cierre del periodo el programado acumulado es ${pct(u.prog_acum)} y el ejecutado ${pct(u.ejec_acum)}${dif != null ? `, con una desviación de ${num(dif, 1)} puntos (${semaforo(dif).toLowerCase()})` : ''}.`)
    + tabla(['MES', 'PROGRAMADO MES', 'PROGRAMADO ACUM.', 'EJECUTADO MES', 'EJECUTADO ACUM.', 'DESVIACIÓN', 'ESTADO'],
      cv.map(r => { const df = r.prog_acum == null ? null : r.ejec_acum - r.prog_acum; return [`${MESES[+r.mes.slice(5) - 1]} ${r.mes.slice(0, 4)}`, pct(r.prog_mes), pct(r.prog_acum), pct(r.ejec_mes), pct(r.ejec_acum), df == null ? '—' : num(df, 1), semaforo(df)]; }), [1.6, 1.3, 1.4, 1.3, 1.4, 1.2, 1.4]);
}
// Plazo transcurrido del contrato a la fecha de corte
function plazoTranscurrido(c, corte) {
  const fin = c.fecha_fin_vigente || c.fecha_fin;
  if (!c.fecha_inicio || !fin) return null;
  const tot = (Date.parse(fin) - Date.parse(c.fecha_inicio)) / 86400000, tr = Math.min(tot, Math.max(0, (Date.parse(corte) - Date.parse(c.fecha_inicio)) / 86400000));
  return { total: Math.round(tot), transcurrido: Math.round(tr), restante: Math.round(tot - tr), pct: tot ? tr / tot * 100 : 0 };
}

// Punto de conexión para anexos de otros módulos (SST, ambiental, social...):
// registrarAnexo(fn) con fn(d, utilidades) → { titulo, xml } o null; se agregan dentro del anexo 8 (OTROS).
const anexosRegistrados = [];
const registrarAnexo = fn => anexosRegistrados.push(fn);

// ---------- SST (Decreto 1072 de 2015, Res. 0312 de 2019, Res. 4272 de 2021, GTC 45) ----------
const NOMBRE_SST = { sst: 'Inspecciones y eventos', sst_peligro: 'Matriz de peligros (GTC 45)', sst_inspeccion: 'Inspecciones con lista de chequeo', sst_permiso: 'Permisos de trabajo y ATS', sst_capacitacion: 'Capacitaciones y charlas',
  sst_trabajador: 'Trabajadores', sst_epp: 'Entrega de EPP', sst_seguridad_social: 'Seguridad social (PILA/ARL)', sst_investigacion: 'Investigación de incidentes y accidentes', sst_emergencia: 'Plan de emergencias y simulacros', sst_equipo: 'Maquinaria y preoperacionales', sst_actividad: 'Cronograma, COPASST y COCOLA', sst_documento: 'Soportes del informe SST' };
const sub = t => p(t, { b: true, sangria: 560, despues: 60 });
function sstResumen(d) {
  const a = d.sst_anexos, cap = a.capacitaciones, ss = a.seguridad_social, ok = ss.filter(x => x.verificado === 'Sí').length;
  const insp = a.inspecciones.filter(i => i.cumplimiento != null), prom = insp.length ? insp.reduce((s, i) => s + i.cumplimiento, 0) / insp.length : null;
  return tabla(['ASPECTO', 'RESULTADO DEL PERIODO'], [
    ['Trabajadores activos del contratista', a.trabajadores.filter(t => t.estado !== 'Retirado').length],
    ['Peligros en la matriz con riesgo I o II (no aceptable)', a.peligros.filter(x => ['I', 'II'].includes(x.nivel)).length + ' de ' + a.peligros.length],
    ['Inspecciones con lista de chequeo / cumplimiento promedio', `${a.inspecciones.length} / ${pct(prom)}`],
    ['Permisos de trabajo de alto riesgo emitidos', a.permisos.length + (a.permisos.some(x => x.ats !== 'Sí') ? ' (hay permisos sin ATS)' : '')],
    ['Capacitaciones, charlas e inducciones / asistentes / horas', `${cap.length} / ${cap.reduce((s, x) => s + (x.asistentes || 0), 0)} / ${num(cap.reduce((s, x) => s + (x.horas || 0), 0), 1)}`],
    ['Entregas de EPP registradas', a.epp.reduce((s, x) => s + (x.cantidad || 1), 0)],
    ['Verificación de PILA/ARL por trabajador', ss.length ? `${ok} de ${ss.length} verificados` : 'Sin verificación registrada'],
    ['Incidentes y accidentes investigados', `${a.investigaciones.filter(x => x.investigado).length} de ${a.investigaciones.length}`],
    ['Simulacros y actividades del plan de emergencias', a.emergencias.length],
  ], [6, 3]);
}
function sstCuadros(d) {
  const a = d.sst_anexos;
  return [
    sub('Matriz de identificación de peligros y valoración de riesgos (GTC 45)'),
    tabla(['ACTIVIDAD', 'PELIGRO', 'CLASIFICACIÓN', 'NP', 'NC', 'NR', 'NIVEL', 'MEDIDA DE INTERVENCIÓN'], a.peligros.map(x => [x.actividad || '', x.peligro || '', x.clasificacion || '', x.np ?? '', x.nc ?? '', x.nr ?? '', x.nivel || '', x.intervencion || '']), [2, 2, 1.6, 0.6, 0.6, 0.8, 0.7, 2.6], 'Sin matriz de peligros registrada.'),
    sub('Inspecciones de seguridad con lista de chequeo'),
    tabla(['FECHA', 'TIPO', 'FRENTE', 'CUMPLIMIENTO', 'HALLAZGOS', 'ACCIÓN', 'ESTADO'], a.inspecciones.map(x => [fecha(x.fecha), x.tipo || '', x.frente || '', pct(x.cumplimiento), x.hallazgos || '', x.accion || '', x.estado || '']), [1.4, 1.4, 1.2, 1.1, 2.4, 2, 1]),
    sub('Permisos de trabajo de alto riesgo y análisis de trabajo seguro (ATS)'),
    tabla(['FECHA', 'N.º', 'TIPO', 'FRENTE / ACTIVIDAD', 'ALTURA / PROF. (m)', 'ATS', 'LISTA', 'RESCATE', 'ESTADO'], a.permisos.map(x => [fecha(x.fecha), x.numero || '', x.tipo || '', [x.frente, x.actividad].filter(Boolean).join(' · '), x.altura != null ? num(x.altura, 1) : '', x.ats || '', x.lista_chequeo || '', x.rescate || '', x.estado || '']), [1.4, 0.7, 1.4, 2.4, 1, 0.6, 0.7, 0.8, 1]),
    sub('Capacitaciones, inducciones y charlas'),
    tabla(['FECHA', 'TIPO', 'TEMA', 'FACILITADOR', 'HORAS', 'ASISTENTES'], a.capacitaciones.map(x => [fecha(x.fecha), x.tipo || '', x.tema || '', x.facilitador || '', num(x.horas, 1), x.asistentes ?? '']), [1.4, 1.6, 3, 1.8, 0.8, 1]),
    sub('Entrega de elementos de protección personal (EPP)'),
    tabla(['FECHA', 'TRABAJADOR', 'ELEMENTO', 'CANT.', 'MOTIVO', 'REPOSICIÓN', 'FIRMA'], a.epp.map(x => [fecha(x.fecha), x.trabajador || '', x.elemento || '', x.cantidad ?? 1, x.motivo || '', fecha(x.reposicion), x.firma || '']), [1.4, 2.2, 2, 0.6, 1.6, 1.4, 0.7]),
    sub(`Verificación de aportes a seguridad social del mes (PILA) por trabajador`),
    tabla(['TRABAJADOR', 'PLANILLA', 'IBC', 'EPS', 'AFP', 'ARL', 'CCF', 'VERIFICADO'], a.seguridad_social.map(x => [x.trabajador || '', x.planilla || '', x.ibc ? pesos(x.ibc) : '', x.eps, x.afp, x.arl, x.ccf, x.verificado]), [2.6, 1.4, 1.6, 0.8, 0.8, 0.8, 0.8, 1]),
    sub('Investigación de incidentes y accidentes de trabajo (Res. 1401 de 2007)'),
    tabla(['FECHA', 'TIPO', 'TRABAJADOR', 'DESCRIPCIÓN', 'REPORTE ARL', 'INVESTIGADO', 'CAUSAS', 'ACCIONES', 'ESTADO'], a.investigaciones.map(x => [fecha(x.fecha), x.tipo || '', x.trabajador || '', x.descripcion || '', fecha(x.reporte_arl), fecha(x.investigado), x.causas || '', x.acciones || '', x.estado || '']), [1.2, 1.1, 1.3, 2, 1.1, 1.1, 1.6, 1.6, 0.9], 'No se presentaron incidentes ni accidentes en el periodo.'),
    sub('Plan de emergencias, brigada y simulacros'),
    tabla(['FECHA', 'TIPO', 'ESCENARIO', 'PARTICIPANTES', 'TIEMPO', 'RESULTADO', 'MEJORAS'], a.emergencias.map(x => [fecha(x.fecha), x.tipo || '', x.escenario || '', x.participantes ?? '', x.tiempo || '', x.resultado || '', x.mejoras || '']), [1.4, 1.4, 1.8, 1, 0.9, 2, 2]),
  ].join('');
}
function anexoSST(d, n) {
  const a = d.sst_anexos, g = {};
  for (const x of a.soportes) (g[x.tabla] = g[x.tabla] || []).push(x);
  const fotos = d.fotos.filter(f => /^sst/.test(f.tabla || ''));
  return p(`${n}- SEGURIDAD Y SALUD EN EL TRABAJO (SST)`, { b: true, izq: true }) +
    p('Formatos y soportes del SG-SST del contratista verificados por la interventoría en el periodo (Decreto 1072 de 2015, Res. 0312 de 2019, Res. 4272 de 2021).', { sangria: 360 }) +
    tabla(['FORMATO', 'REGISTROS DEL PERIODO', 'SOPORTES ADJUNTOS'], Object.keys(NOMBRE_SST).slice(0, 10).filter(k => k !== 'sst_trabajador').map(k => [NOMBRE_SST[k],
      { sst: d.sst, sst_peligro: a.peligros, sst_inspeccion: a.inspecciones, sst_permiso: a.permisos, sst_capacitacion: a.capacitaciones, sst_epp: a.epp, sst_seguridad_social: a.seguridad_social, sst_investigacion: a.investigaciones, sst_emergencia: a.emergencias }[k].length, (g[k] || []).length]), [5, 2, 2]) +
    p('Relación de trabajadores del contratista:', { b: true, sangria: 360 }) +
    tabla(['NOMBRE', 'CARGO', 'EPS', 'AFP', 'ARL', 'RIESGO', 'EXAMEN DE INGRESO', 'CERT. ALTURAS HASTA'], a.trabajadores.map(t => [t.nombre || '', t.cargo || '', t.eps || '', t.afp || '', t.arl || '', t.riesgo || '', fecha(t.examen_ingreso), fecha(t.alturas_vence)]), [2.2, 1.6, 1.1, 1.1, 1.1, 0.7, 1.3, 1.3], 'Sin trabajadores registrados.') +
    p('Soportes adjuntos (planillas de asistencia, permisos firmados, FURAT, PILA, fotos):', { b: true, sangria: 360 }) +
    (a.soportes.length ? lista(a.soportes.map(x => `${NOMBRE_SST[x.tabla] || x.tabla}: ${x.nombre}${x.categoria === 'Foto' ? ' (foto)' : ''}${x.descripcion ? ' — ' + x.descripcion : ''} · ${fecha(x.fecha)}`)) : p('Sin soportes adjuntos en el periodo.', { i: true, color: '595959', sangria: 360 })) +
    p(fotos.length ? `Registro fotográfico de SST: fotos N.º ${fotos.map(f => f.n).join(', ')} del anexo 1.` : 'Sin fotos de SST en el periodo.', { sangria: 360 });
}

function capituloContratista(c, d) {
  const act = c.actividades || [], f = d.fisico;
  const bit = d.bitacora, clima = {};
  for (const b of bit) if (b.clima) clima[b.clima] = (clima[b.clima] || 0) + 1;
  const equipos = {};
  for (const b of bit) for (const e of String(b.equipos || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean)) equipos[e] = (equipos[e] || 0) + 1;
  const conPersonal = bit.filter(b => b.personal_obra), promedio = conPersonal.length ? Math.round(conPersonal.reduce((s, b) => s + b.personal_obra, 0) / conPersonal.length) : null;
  const valorMes = c.actas_mes.reduce((s, a) => s + (a.valor || 0), 0);
  const np = d.items_np.filter(i => i.contrato_id === c.id);
  const pz = plazoTranscurrido(c, d.corte || d.fin);
  return [
    titulo(`1.  CONTRATO DE OBRA N.º ${numContrato(c)}`),
    subtitulo('1.1.  INFORMACIÓN GENERAL DEL CONTRATO'), fichaContrato(c, d, true),
    subtitulo('1.2.  RELACIÓN DE ACTAS DEL CONTRATISTA'), relacionActas(c, true, d.fin),
    subtitulo('1.3.  CAMBIOS TÉCNICOS Y/O MODIFICACIONES DEL CONTRATO Y/O PROYECTO'),
    (c.otrosis || []).length ? lista(c.otrosis.map(o => `Otrosí / modificación N.º ${o.numero} del ${fecha(o.fecha)} (${o.tipo}, ${o.estado}): ${o.objeto || 'sin descripción'}.${o.valor ? ' Valor: ' + pesos(o.valor) + '.' : ''}${o.dias ? ' Prórroga: ' + o.dias + ' días.' : ''}`)) : p('En el periodo no se presentaron cambios técnicos ni modificaciones al contrato.'),
    np.length ? p(`Ítems no previstos aprobados: ${np.map(i => `${i.codigo} ${i.descripcion} (${pesos(i.vr_unitario)}/${i.unidad || 'und'})`).join('; ')}.`) : '',
    subtitulo('1.4.  ACTIVIDADES EJECUTADAS POR EL CONTRATISTA'),
    p('1.4.1. ACTIVIDADES TÉCNICAS', { b: true, sangria: 280 }),
    p(`Durante el periodo comprendido entre el ${fecha(d.ini)} y el ${fecha(d.fin)} el contratista ${c.contratista || ''} ${act.length ? `ejecutó ${act.length} ítem(s) de obra, recibidos y medidos por la interventoría en ${c.actas_mes.length} acta(s) parcial(es) con corte en el mes (${c.actas_mes.map(a => 'N.º ' + a.numero).join(', ')}), por un valor de ${pesos(valorMes)}` : 'no presentó actas parciales con corte en el mes'}. El valor acumulado ejecutado asciende a ${pesos(c.acumulado_mes)}, equivalente al ${c.pct != null ? num(c.pct, 1) : '—'} % del valor vigente del contrato${pz ? `, con el ${num(pz.pct, 1)} % del plazo transcurrido (${pz.transcurrido} de ${pz.total} días)` : ''}.`),
    tabla(['ÍTEM', 'DESCRIPCIÓN', 'UND', 'CANT. PERIODO', 'VALOR PERIODO', 'CANT. ACUMULADA', '% EJEC.'],
      act.map(a => [a.codigo || '', a.descripcion, a.unidad || '', num(a.cant_aprobada), pesos(a.vr_acta), num(a.acumulado), num(a.pct * 100, 1) + ' %']), [1, 4, 0.8, 1.3, 1.8, 1.3, 1], 'No hay actas parciales con fecha de corte en el periodo.'),
    (d.capturas || []).length ? p('Memoria de cantidades del periodo (capturas de avance en campo con registro fotográfico):', { b: true }) + tabla(['FECHA', 'ÍTEM', 'ABSCISAS', 'MEDIDAS', 'CANTIDAD', 'ESTADO'], d.capturas.map(v => [fecha(v.fecha), `${v.codigo || ''} ${v.item || ''}`, [abscisa(v.abs_ini), abscisa(v.abs_fin)].filter(Boolean).join(' – ') || v.frente || '', [v.largo ?? (v.abs_fin != null && v.abs_ini != null ? Math.abs(v.abs_fin - v.abs_ini) : null), v.ancho, v.espesor, v.piezas].filter(z => z != null).map(z => num(z)).join(' × '), `${num(v.cantidad)} ${v.unidad || ''}`, v.estado]), [1.4, 3, 2, 1.8, 1.3, 1.1]) : '',
    d.tramos.length ? p('Avance por tramos (abscisado):', { b: true }) + tabla(['TRAMO', 'ABSCISA INICIAL', 'ABSCISA FINAL', 'ACTIVIDAD', 'AVANCE'], d.tramos.map(t => [t.nombre || '', abscisa(t.abs_ini), abscisa(t.abs_fin), t.actividad || '', num(t.avance, 0) + ' %']), [2, 1.5, 1.5, 3, 1]) : '',
    p('Para verificar el cumplimiento de las especificaciones técnicas se realizaron los siguientes ensayos:'), ensayos(d),
    p('1.4.2. ACTIVIDADES ADMINISTRATIVAS', { b: true, sangria: 280 }),
    lista([`Se llevó la bitácora de obra con ${bit.length} anotación(es) en el periodo.`, f.tareas.length ? `Seguimiento a la programación de obra: programado ${num(f.programado, 1)} %, ejecutado ${num(f.real, 1)} %${f.spi != null ? ', índice de cumplimiento (SPI) ' + num(f.spi, 2) : ''}.` : 'No se ha cargado el programa de obra.',
      `Correspondencia del periodo: ${d.correspondencia.length} comunicación(es).`, d.sst_ind ? `Verificación de pago de seguridad social (PILA/ARL): ${d.sst_ind.planillas_ok}.` : 'Verificación de seguridad social del periodo: sin registro.']),
    p('1.4.3. ACTIVIDADES FINANCIERAS', { b: true, sangria: 280 }),
    lista([`Valor ejecutado en el periodo: ${pesos(valorMes)} (${enLetras(valorMes)}).`, `Valor acumulado ejecutado: ${pesos(c.acumulado_mes)}; valor vigente del contrato: ${pesos(c.valor_vigente)}; saldo por ejecutar: ${pesos((c.valor_vigente || 0) - (c.acumulado_mes || 0))}.`,
      c.anticipo_pct ? `Anticipo del ${num(c.anticipo_pct, 0)} %: ${pesos((c.valor || 0) * c.anticipo_pct / 100)}.` : 'El contrato no tiene anticipo registrado.']),
    p('Balance de cantidades por capítulo (contratado vs. ejecutado vs. saldo):', { b: true }), cuadroBalance(c),
    p('Flujo de caja del contrato y amortización del anticipo:', { b: true }), cuadroFlujo(c),
    p('1.4.4. ACTIVIDADES AMBIENTALES, SOCIALES Y DE SST', { b: true, sangria: 280 }),
    d.ambiental.length ? tabla(['FECHA', 'PROGRAMA / FICHA', 'ACTIVIDAD', 'INDICADOR', 'META / LOGRO', 'ESTADO'], d.ambiental.map(a => [fecha(a.fecha), [a.programa, a.ficha].filter(Boolean).join(' · '), a.actividad || '', a.indicador || '', a.meta != null ? `${num(a.meta)} / ${num(a.logro)}` : '', a.estado || '']), [1.4, 2.2, 2.4, 1.6, 1.2, 1]) : p('Sin registros de seguimiento ambiental en el periodo.', { i: true, color: '595959' }),
    d.pmt.length ? p(`Planes de manejo de tránsito vigentes: ${d.pmt.map(m => `${m.frente || ''} (${m.radicado || 'sin radicado'}, hasta ${fecha(m.hasta)}, cumple: ${m.cumple})`).join('; ')}.`) : '',
    d.sst_ind ? p(`SST: ${d.sst_ind.trabajadores} trabajadores; frecuencia de accidentalidad ${num(d.sst_ind.frecuencia)}, severidad ${num(d.sst_ind.severidad)}, ausentismo ${num(d.sst_ind.ausentismo)} % (Res. 0312 de 2019).`) : '',
    d.sst.length ? tabla(['FECHA', 'TIPO', 'FRENTE', 'DESCRIPCIÓN', 'ACCIÓN', 'ESTADO'], d.sst.map(s => [fecha(s.fecha), s.tipo || '', s.frente || '', s.descripcion || s.hallazgo || '', s.accion || '', s.estado || '']), [1.4, 1.6, 1.3, 3, 2, 1]) : '',
    p('Resumen de la gestión en seguridad y salud en el trabajo del periodo (detalle y soportes en el anexo 9):'), sstResumen(d), sstCuadros(d),
    p(`Gestión social: ${d.social.length} actividad(es) en el periodo; PQRS abiertas: ${d.pqrs_abiertas.length}${d.pqrs_vencidas.length ? ', vencidas: ' + d.pqrs_vencidas.length : ''}.`),
    gestionSocial(d),
    p('1.4.5. ACTIVIDADES DE ASEGURAMIENTO DE LA CALIDAD', { b: true, sangria: 280 }),
    p(`Se realizaron ${d.ensayos.length} ensayo(s) en el periodo${d.ensayos.some(e => e.cumple === 'No') ? `, de los cuales ${d.ensayos.filter(e => e.cumple === 'No').length} no cumplieron la especificación` : ''}.`),
    p('1.4.5.1 PRUEBAS Y ENSAYOS', { b: true, sangria: 560 }),
    p(`Laboratorio(s): ${[...new Set(d.ensayos.map(e => e.laboratorio).filter(Boolean))].join(', ') || '—'}. Los resultados se comparan con las especificaciones generales de construcción vigentes del INVÍAS y las particulares del contrato.`),
    subtitulo('1.5. PROGRAMA DE TRABAJO DEL CONTRATISTA'),
    p('1.5.1 Curva S (programado vs. ejecutado acumulado)', { b: true, sangria: 280 }), cuadroCurva(c),
    p('1.5.2 Comparativo programado vs. ejecutado por actividad', { b: true, sangria: 280 }),
    f.tareas.length ? p(`A la fecha de corte el avance físico programado es ${num(f.programado, 1)} % y el ejecutado ${num(f.real, 1)} %${f.spi != null ? `; el índice de cumplimiento (SPI) es ${num(f.spi, 2)}, ${f.spi >= 0.95 ? 'la obra va al día' : f.spi >= 0.85 ? 'la obra presenta un atraso leve que requiere seguimiento' : 'la obra presenta atraso y se requiere un plan de contingencia'}` : ''}.${(() => { const atr = f.tareas.filter(t => !t.resumen && t.avance_real - t.programado < -15); return atr.length ? ` Actividades con atraso crítico: ${atr.map(t => t.nombre).join(', ')}.` : ''; })()}`) + tabla(['EDT', 'ACTIVIDAD', 'INICIO', 'FIN', 'PROGRAMADO', 'EJECUTADO', 'DESVIACIÓN', 'ESTADO'], f.tareas.filter(t => !t.resumen).map(t => [t.wbs || '', t.nombre, fecha(t.inicio), fecha(t.fin), num(t.programado, 1) + ' %', num(t.avance_real, 1) + ' %', num((t.avance_real || 0) - t.programado, 1), semaforo((t.avance_real || 0) - t.programado)]), [0.7, 3.2, 1.5, 1.5, 1.1, 1.1, 1.1, 1.2])
      : p('No se ha cargado el programa de obra en SIGI Pro (Ejecución de obra → Programa de obra).', { i: true, color: '595959' }),
    subtitulo('1.6.  RELACIÓN DEL PERSONAL UTILIZADO POR EL CONTRATISTA'),
    tabla(['CARGO', 'CANTIDAD', 'AFILIACIÓN AL SISTEMA DE SEGURIDAD SOCIAL'], [promedio != null && ['Personal de obra (promedio diario según bitácora)', promedio, d.sst_ind?.planillas_ok || 'Por verificar'], d.sst_ind && ['Trabajadores reportados en el mes (SST)', d.sst_ind.trabajadores, d.sst_ind.planillas_ok]].filter(Boolean), [5, 1.5, 3], 'Sin registro de personal en la bitácora del periodo.'),
    subtitulo('1.7.  RELACIÓN DEL EQUIPO UTILIZADO POR EL CONTRATISTA'),
    tabla(['EQUIPO', 'DÍAS REPORTADOS EN BITÁCORA'], Object.entries(equipos).map(([e, n]) => [e, n]), [6, 3], 'Sin registro de equipos en la bitácora del periodo.'),
    subtitulo('1.8.  INFORME GENERAL DEL ESTADO DEL TIEMPO'),
    p(Object.keys(clima).length ? `Según la bitácora, el estado del tiempo en el periodo fue: ${Object.entries(clima).map(([k, n]) => `${k.toLowerCase()} ${n} día(s)`).join(', ')}.` : 'Sin registro del estado del tiempo en la bitácora del periodo.'),
    subtitulo('1.9.  CUADRO DE CONTROL DE PÓLIZAS DEL CONTRATISTA'), cuadroPolizas(polizasDe(d, 'obra')),
    subtitulo('1.10. REUNIONES DEL CONTRATISTA'), reuniones(d),
    firma(c.representante || c.contratista, 'Contratista de Obra'),
  ].join('');
}
const abscisa = v => (v == null ? '' : `K${Math.floor(v / 1000)}+${String((v % 1000).toFixed(2)).padStart(6, '0')}`);

function capituloInterventoria(c, ob, d) {
  if (!c) return titulo('2. CONTRATO DE INTERVENTORÍA') + p('NO APLICA.');
  const cargos = {};
  for (const x of d.personal.filter(x => !/retirado/i.test(x.estado || ''))) cargos[x.cargo || 'Sin cargo'] = (cargos[x.cargo || 'Sin cargo'] || 0) + 1;
  const gastos = {};
  for (const g of d.gastos) gastos[g.descripcion || 'Otros'] = (gastos[g.descripcion || 'Otros'] || 0) + (g.valor || 0);
  const actasObraMes = ob ? ob.actas_mes : [];
  return [
    titulo(`2. CONTRATO DE INTERVENTORÍA N.º ${numContrato(c)}`),
    subtitulo('2.1.  INFORMACIÓN GENERAL DEL CONTRATO DE INTERVENTORÍA'), fichaContrato(c, d, false),
    p('Obligaciones del interventor: seguimiento técnico, administrativo, financiero, contable, ambiental, social y jurídico del contrato de obra (Ley 1474 de 2011, arts. 83 y 84).'),
    subtitulo('2.2. RELACIÓN DE ACTAS DE LA INTERVENTORÍA'), relacionActas(c, false, d.fin),
    subtitulo('2.3. ACTIVIDADES REALIZADAS POR LA INTERVENTORÍA'),
    p('2.3.1 ACTIVIDADES TÉCNICAS', { b: true, sangria: 280 }),
    lista([actasObraMes.length ? `Revisión y aprobación de ${actasObraMes.length} acta(s) parcial(es) de obra: ${actasObraMes.map(a => `N.º ${a.numero} (${a.estado}, ${pesos(a.valor)})`).join(', ')}.` : 'En el periodo no se presentaron actas parciales de obra.',
      `Verificación de ${d.ensayos.length} ensayo(s) de laboratorio.`, d.tramos.length ? `Control del avance por tramos: ${d.tramos.length} tramo(s) con seguimiento de abscisado.` : 'Control de cantidades de obra ejecutadas.',
      `Registro fotográfico: ${d.fotos.length} foto(s) en el periodo (ver anexo 1).`]),
    p('2.3.2.  ACTIVIDADES ADMINISTRATIVAS', { b: true, sangria: 280 }),
    lista([`Revisión de la bitácora de obra (${d.bitacora.length} anotaciones).`, `Trámite de correspondencia: ${d.correspondencia.length} comunicación(es) en el periodo.`, 'Seguimiento a vencimientos, pólizas y obligaciones contractuales en SIGI Pro.']),
    p('2.3.3. ACTIVIDADES FINANCIERAS', { b: true, sangria: 280 }),
    lista([ob ? `Balance del contrato de obra: acumulado ${pesos(ob.acumulado_mes)} de ${pesos(ob.valor_vigente)} (${ob.pct != null ? num(ob.pct, 1) : '—'} %).` : 'No hay contrato de obra registrado.',
      `Contrato de interventoría: facturado acumulado ${pesos(c.acumulado_mes)} de ${pesos(c.valor_vigente)}.`]),
    p('Cuentas de cobro de la interventoría y curva de ejecución:', { b: true }), cuadroFlujo(c), cuadroCurva(c),
    p('2.3.4. ACTIVIDADES AMBIENTALES', { b: true, sangria: 280 }),
    lista([`Seguimiento a las fichas del PAGA/PMA: ${d.ambiental.length} registro(s); PMT vigentes: ${d.pmt.length}.`, `SST: ${d.sst.length} inspección(es) o evento(s) registrados${d.sst_ind ? `; frecuencia de accidentalidad ${num(d.sst_ind.frecuencia)}` : ''}.`,
      `Gestión social: ${d.social.length} actividad(es); PQRS abiertas ${d.pqrs_abiertas.length}${d.pqrs_vencidas.length ? ' (' + d.pqrs_vencidas.length + ' vencidas)' : ''}.`]),
    p('2.3.5. ACTIVIDADES DE ASEGURAMIENTO DE LA CALIDAD', { b: true, sangria: 280 }),
    p('Verificación de los resultados de laboratorio frente a las especificaciones y control del plan de calidad del contratista y de la interventoría.'),
    subtitulo('2.4. PRUEBAS Y ENSAYOS DE LABORATORIO REALIZADOS POR LA INTERVENTORÍA'), ensayos(d),
    subtitulo('2.5. RELACIÓN DE PERSONAL Y OTROS RECURSOS DE LA INTERVENTORÍA'),
    p('2.5.1 Personal:', { b: true, sangria: 280 }), tabla(['CARGO', 'CANTIDAD'], Object.entries(cargos).map(([k, n]) => [k, n]), [6, 2], 'Sin personal registrado.'),
    p('2.5.2 Otros recursos (gastos del periodo):', { b: true, sangria: 280 }), tabla(['OTROS RECURSOS', 'VALOR'], Object.entries(gastos).map(([k, v]) => [k, pesos(v)]), [6, 2], 'Sin gastos registrados en el periodo.'),
    subtitulo('2.6. CUADRO DE CONTROL DE PÓLIZAS DE LA INTERVENTORÍA'), cuadroPolizas(polizasDe(d, 'interventoria')),
    subtitulo('2.7.  REUNIONES DE LA INTERVENTORÍA'), reuniones(d),
  ].join('');
}

function observaciones(d, ob) {
  const o = [];
  const f = d.fisico;
  if (f.spi != null && f.spi < 0.95) o.push(`El índice de cumplimiento del programa es ${num(f.spi, 2)}: se recomienda requerir al contratista un plan de contingencia.`);
  if (ob && (ob.actividades || []).some(a => a.saldo < -1e-9)) o.push('Hay ítems con cantidades acumuladas superiores a las contratadas: se debe tramitar el balance de mayores y menores cantidades antes de continuar su ejecución.');
  const hoy = d.hoy;
  for (const x of d.polizas.filter(x => x.hasta && x.hasta < hoy && !/vencida|cerrada/i.test(x.estado || ''))) o.push(`La póliza ${x.numero || ''} (${x.amparo || ''}) venció el ${fecha(x.hasta)}: solicitar su ampliación.`);
  const gs = d.gs || {}, venc = (gs.pqrs_mes || []).filter(x => x.semaforo === 'Vencida');
  if (venc.length) o.push(`Hay ${venc.length} PQRS radicada(s) sin respuesta dentro del término de la Ley 1755 de 2015 (${venc.map(x => x.radicado || 'sin radicado').join(', ')}): requerir la respuesta inmediata al contratista.`);
  if (gs.mano_obra?.meta != null && gs.mano_obra.pct != null && gs.mano_obra.pct < gs.mano_obra.meta) o.push(`La vinculación de mano de obra local (${num(gs.mano_obra.pct, 1)} %) está por debajo de la meta del contrato (${num(gs.mano_obra.meta, 1)} %).`);
  for (const a of (gs.afectaciones || []).filter(a => !['Cerrada', 'Atendida'].includes(a.estado))) o.push(`Afectación abierta (${a.tipo || ''}${a.abscisa ? ', ' + a.abscisa : ''}): ${a.descripcion || ''}.`);
  if (gs.satisfaccion != null && gs.satisfaccion < 70) o.push(`La satisfacción de la comunidad es ${num(gs.satisfaccion, 1)} %: reforzar la divulgación y la atención al ciudadano.`);
  if (d.pqrs_vencidas.length) o.push(`Hay ${d.pqrs_vencidas.length} PQRS con el plazo de respuesta vencido (Ley 1755 de 2015).`);
  for (const c of d.contratos.filter(c => c.suspendido)) o.push(`El contrato ${c.numero || ''} se encuentra suspendido (${c.dias_suspendidos} días): verificar la ampliación de las garantías.`);
  const sa = d.sst_anexos;
  if (sa.peligros.some(x => x.nivel === 'I')) o.push(`Hay ${sa.peligros.filter(x => x.nivel === 'I').length} peligro(s) con nivel de riesgo I en la matriz GTC 45: suspender la actividad hasta implementar los controles.`);
  if (sa.investigaciones.some(x => !x.investigado)) o.push('Hay incidentes o accidentes sin investigar: el contratista debe investigarlos dentro de los 15 días siguientes (Res. 1401 de 2007).');
  if (sa.seguridad_social.some(x => x.verificado === 'No')) o.push('Hay trabajadores sin pago verificado de seguridad social en el mes: no deben ingresar a la obra hasta acreditar la PILA.');
  if (sa.permisos.some(x => x.ats !== 'Sí')) o.push('Se emitieron permisos de trabajo de alto riesgo sin ATS: requerir al contratista el análisis antes de iniciar la labor.');
  for (const v of d.vencimientos.filter(v => v.fecha && v.fecha <= d.fin)) o.push(`Pendiente: ${v.descripcion} (${fecha(v.fecha)}).`);
  return titulo('3.  OBSERVACIONES Y RECOMENDACIONES') + (o.length ? lista(o) : p('Sin observaciones en el periodo.')) + p('Actas de recibo con la comunidad y/o el municipio: ' + (d.anexos.recibo?.length || cierres(d).length ? [...(d.anexos.recibo || []).map(a => a.nombre), ...cierres(d).map(a => 'acta de vecindad de cierre del predio ' + (a.predio || a.direccion || ''))].join(', ') : 'no se registraron en el periodo') + '.');
}

const cierres = d => (d.gs?.vecindad || []).filter(a => a.fecha_cierre && a.fecha_cierre >= d.ini && a.fecha_cierre <= d.fin);
// Cada anexo relaciona los soportes adjuntos del mes (archivo, fecha y registro de origen) y los registros del periodo que respalda
const ORIGEN = { ensayo: 'Ensayo', social: 'Gestión social', pqrs: 'PQRS', reunion: 'Reunión', acta_vecindad: 'Acta de vecindad', capacitacion: 'Cultura vial', afectacion: 'Afectación', encuesta: 'Encuesta', veeduria: 'Veeduría', correspondencia: 'Correspondencia', bitacora: 'Bitácora', acta: 'Acta', otrosi: 'Otrosí', poliza: 'Póliza', suspension: 'Suspensión', tramo: 'Tramo', sst: 'SST', ambiental: 'Ambiental', pmt: 'PMT', gasto: 'Gasto', contrato: 'Contrato', proyecto: 'Proyecto' };
function soportes(a) {
  return tabla(['N.º', 'DOCUMENTO ADJUNTO', 'FECHA', 'REGISTRO DE ORIGEN', 'DESCRIPCIÓN'],
    (a || []).map((x, i) => [i + 1, x.nombre || '', fecha(x.fecha), `${ORIGEN[x.tabla] || x.tabla || '—'}${x.registro_id ? ' #' + x.registro_id : ''}`, x.descripcion || '']), [0.5, 3, 1.5, 1.8, 3], 'Sin documentos adjuntos en el periodo.');
}
function anexos(d) {
  const grupo = (n, t, a, extra = '') => subtitulo(`ANEXO ${n}. ${t}`) + extra + soportes(a);
  const fotosTxt = d.fotos.length ? p(`Se incluyen ${d.fotos.length} fotografía(s) del periodo con fecha, abscisa, frente y punto fijo de toma${(d.antes_despues || []).length ? `, y ${d.antes_despues.length} comparativo(s) antes y después desde el mismo punto fijo` : ''}.`) : '';
  const regs = (filas, enc, w) => (filas.length ? tabla(enc, filas, w) : '');
  const util = { p, tabla, ficha, lista, subtitulo, fecha, pesos, num };
  const externos = anexosRegistrados.map(fn => fn(d, util)).filter(Boolean).map(a => p(a.titulo, { b: true }) + a.xml).join('');
  return titulo('4. ANEXOS') +
    subtitulo('ANEXO 1. REGISTRO FOTOGRÁFICO') + fotosTxt + cuadroAntesDespues(d.antes_despues || []) + cuadroFotos(d.fotos) +
    grupo(2, 'PLANOS', d.anexos.planos) +
    grupo(3, 'ENSAYOS DE LABORATORIO', d.anexos.ensayo, regs(d.ensayos.map(e => [fecha(e.fecha), e.ensayo || '', [e.item, e.abscisa].filter(Boolean).join(' · '), e.cumple || '', e.laboratorio || '']), ['FECHA', 'ENSAYO DEL PERIODO', 'ÍTEM / ABSCISA', 'CUMPLE', 'LABORATORIO'], [1.5, 3, 2, 1, 2])) +
    grupo(4, 'ACTAS DE REUNIONES', d.anexos.social, regs((d.gs?.reuniones || []).map(r => [fecha(r.fecha), r.tipo || '', [r.lugar, r.comunidad].filter(Boolean).join(' · '), r.asistentes ?? '', r.acta || 's/n', r.lista_asistencia || '']), ['FECHA', 'REUNIÓN DEL PERIODO', 'LUGAR / COMUNIDAD', 'ASISTENTES', 'ACTA', 'LISTA'], [1.4, 1.4, 2.6, 1, 1, 0.8])) +
    grupo(5, 'ACTAS DE RECIBO DE LA COMUNIDAD Y/O MUNICIPIO', d.anexos.recibo, regs(cierres(d).map(a => [a.predio || '', [a.direccion, a.abscisa].filter(Boolean).join(' · '), fecha(a.fecha_cierre), a.danos || '', a.paz_y_salvo || '']), ['PREDIO', 'DIRECCIÓN / ABSCISA', 'ACTA DE VECINDAD DE CIERRE', 'DAÑOS', 'PAZ Y SALVO'], [1, 2.6, 1.8, 0.8, 1])) +
    grupo(6, 'CORRESPONDENCIA', d.anexos.correspondencia, regs(d.correspondencia.map(c => [fecha(c.fecha), c.radicado || '', c.sentido || '', [c.de, c.para].filter(Boolean).join(' → '), c.asunto || '', c.estado || '']), ['FECHA', 'RADICADO', 'SENTIDO', 'DE → PARA', 'ASUNTO', 'ESTADO'], [1.4, 1.4, 1.1, 2.2, 3.2, 1.1])) +
    grupo(7, 'BITÁCORA DE OBRA', d.anexos.bitacora, d.bitacora.length ? p(`La bitácora registra ${d.bitacora.length} anotación(es) entre el ${fecha(d.bitacora[0].fecha)} y el ${fecha(d.bitacora[d.bitacora.length - 1].fecha)}.`) : '') +
    grupo(8, 'OTROS', d.anexos.otros, (d.contratos.find(c => c.tipo === 'obra')?.balance_items?.length ? p('Balance de cantidades por ítem del contrato de obra:', { b: true }) + cuadroBalanceItems(d.contratos.find(c => c.tipo === 'obra')) : '') + externos) + anexoSST(d, 9);
}

function cuerpo(d) {
  const ob = d.contratos.find(c => c.tipo === 'obra'), it = d.contratos.find(c => c.tipo === 'interventoria');
  const principal = ob || it;
  indice = [];
  const portada = [
    p('', { despues: 1400 }),
    p(d.proyecto.entidad ? d.proyecto.entidad.toUpperCase() : '', { b: true, centro: true, despues: 400 }),
    p([['OBJETO: ', { b: true }], `“${principal?.objeto || d.proyecto.objeto || d.proyecto.nombre}”`], { centro: true, despues: 600 }),
    p(`INFORME DEL CONTRATISTA No. ${d.numero}`, { b: true, centro: true, sz: 32, despues: 200 }),
    p(`(PERIODO DE EJECUCIÓN: DESDE ${fecha(d.ini).toUpperCase()} HASTA ${fecha(d.fin).toUpperCase()})`, { centro: true, despues: 600 }),
    p([['CONTRATISTA: ', { b: true }], ob?.contratista || '—'], { centro: true }),
    p([['CONTRATO Nº ', { b: true }], `${numContrato(ob)}`], { centro: true }),
    it ? p([['INTERVENTORÍA: ', { b: true }], `${it.contratista || '—'} · Contrato Nº ${it.numero || '—'}`], { centro: true }) : '',
    p(d.proyecto.ubicacion || '', { centro: true, antes: 600 }), p(`${MESES[+d.mes.slice(5) - 1].toUpperCase()} DE ${d.mes.slice(0, 4)}`, { centro: true, b: true }),
  ].join('');
  const resto = [
    titulo('INTRODUCCIÓN'), ...introduccion(d, ob, it, principal),
    ob ? capituloContratista(ob, d) : titulo('1. CONTRATO DE OBRA') + p('No hay contrato de obra registrado.'),
    capituloInterventoria(it, ob, d),
    observaciones(d, ob), anexos(d),
    firma(d.director, 'Director de interventoría · Contratista de Interventoría'),
  ].join('');
  return portada + salto + tablaContenido() + salto + resto;
}

// Introducción: localización, objeto, alcance del informe y resumen ejecutivo del estado del contrato al corte
function introduccion(d, ob, it, principal) {
  const c = ob || it, pz = c && plazoTranscurrido(c, d.corte || d.fin), f = d.fisico;
  const ultCurva = c?.curva?.[c.curva.length - 1];
  const estado = c ? (c.suspendido ? 'suspendido' : c.liquidacion ? 'en liquidación' : (c.estado || 'en ejecución').toLowerCase()) : '';
  return [
    p(`El proyecto “${d.proyecto.nombre}” se encuentra localizado en ${d.proyecto.ubicacion || '—'}${d.proyecto.entidad ? ` y es contratado por ${d.proyecto.entidad}` : ''}. Su objeto es: ${d.proyecto.objeto || principal?.objeto || '—'}.`),
    p(`El presente informe No. ${d.numero} consigna el seguimiento técnico, administrativo, financiero, ambiental, social y jurídico del periodo comprendido entre el ${fecha(d.ini)} y el ${fecha(d.fin)}, de acuerdo con la Guía del informe del interventor y/o contratista, y presenta los soportes del periodo en los anexos.`),
    c ? p(`A la fecha de corte el contrato ${c.numero || ''} se encuentra ${estado}; tiene un valor vigente de ${pesos(c.valor_vigente)} y un valor ejecutado acumulado de ${pesos(c.acumulado_mes)} (${c.pct != null ? num(c.pct, 1) : '—'} %)${pz ? `, con ${pz.transcurrido} de ${pz.total} días de plazo transcurridos (${num(pz.pct, 1)} %) y terminación prevista para el ${fecha(c.fecha_fin_vigente)}` : ''}.`) : '',
    c ? p('Resumen ejecutivo del periodo:', { b: true }) + ficha([
      ['Valor vigente del contrato de obra', ob ? `${pesos(ob.valor_vigente)}${ob.adiciones ? ` (incluye adiciones por ${pesos(ob.adiciones)})` : ''}` : 'No aplica'],
      ['Ejecutado en el periodo', ob ? pesos(ob.actas_mes.reduce((s, a) => s + (a.valor || 0), 0)) : '—'],
      ['Ejecutado acumulado (financiero)', ob ? `${pesos(ob.acumulado_mes)} · ${pct(ob.pct)}` : '—'],
      ['Programado acumulado (curva S)', ultCurva ? pct(ultCurva.prog_acum) : '—'],
      ['Avance físico programado / ejecutado', f.tareas.length ? `${pct(f.programado)} / ${pct(f.real)}${f.spi != null ? ` · SPI ${num(f.spi, 2)}` : ''}` : 'Sin programa de obra cargado'],
      ['Plazo transcurrido', pz ? `${pz.transcurrido} de ${pz.total} días (${num(pz.pct, 1)} %) · restan ${pz.restante} días` : '—'],
      ['Ensayos de laboratorio', `${d.ensayos.length}${d.ensayos.some(e => e.cumple === 'No') ? ` (${d.ensayos.filter(e => e.cumple === 'No').length} no cumplen)` : ''}`],
      ['Registro fotográfico', `${d.fotos.length} foto(s) del periodo`],
    ]) : '',
  ];
}

// Documento base con el encabezado del formato (sin logos): título, código, versión, fecha y página
async function base(d) {
  const { Document, Packer, Header, Footer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, VerticalMergeType, PageNumber } = docx;
  const t = (txt, o = {}) => new Paragraph({ alignment: o.centro ? AlignmentType.CENTER : AlignmentType.LEFT, children: [].concat(txt).map(x => (typeof x === 'string' ? new TextRun({ text: x, bold: !!o.b, size: 16 }) : x)) });
  const c = (txt, o = {}) => new TableCell({ width: { size: o.w || 20, type: WidthType.PERCENTAGE }, verticalMerge: o.merge, children: [t(txt, o)] });
  const fila = (i, rot, val) => new TableRow({ children: [...(i === 0 ? [c(d.titulo_formato || 'GUÍA DEL INFORME DEL INTERVENTOR Y/O CONTRATISTA', { b: true, centro: true, w: 60, merge: VerticalMergeType.RESTART })] : [c('', { w: 60, merge: VerticalMergeType.CONTINUE })]), c(rot, { b: true }), c(val)] });
  const pagina = [new TextRun({ children: [PageNumber.CURRENT], size: 16 }), new TextRun({ text: ' de ', size: 16 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16 })];
  const enc = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [fila(0, 'CÓDIGO:', d.formato?.codigo || ''), fila(1, 'VERSIÓN:', d.formato?.version || '2'), fila(2, 'FECHA DE APROBACIÓN:', d.formato?.fecha || ''), new TableRow({ children: [c('', { w: 60, merge: VerticalMergeType.CONTINUE }), c('PÁGINA', { b: true }), new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [t(pagina)] })] })] });
  return Packer.toBuffer(new Document({ styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{ properties: { page: { margin: { top: 2200, bottom: 1100, left: 1300, right: 1300, header: 500 } } }, headers: { default: new Header({ children: [enc] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Informe No. ${d.numero} · ${d.mes} · Página `, size: 16 }), ...pagina] })] }) }, children: [new Paragraph('')] }] }));
}

// Llena el formato: conserva encabezado, pie, estilos y configuración de página; reemplaza el cuerpo
async function informeFormato(d, plantilla, generar = cuerpo) {
  const zip = new PizZip(plantilla || await base(d));
  let xml = zip.file('word/document.xml').asText();
  const ini = xml.indexOf('<w:body>') + 8, fin = xml.lastIndexOf('</w:body>');
  const cuerpoViejo = xml.slice(ini, fin);
  const sect = (cuerpoViejo.match(/<w:sectPr[\s\S]*<\/w:sectPr>\s*$/) || [''])[0];
  // Espacios de nombres que usan las fotos
  if (!/xmlns:wp=/.test(xml)) xml = xml.replace('<w:document ', '<w:document xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ');
  if (!/xmlns:r=/.test(xml)) xml = xml.replace('<w:document ', '<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
  const todas = [...d.fotos, ...(d.antes_despues || []).flatMap(x => [x.antes, x.despues])];
  todas.forEach((f, i) => { f.n = i + 1; });
  zip.file('word/document.xml', xml.slice(0, ini) + generar(d) + sect + xml.slice(fin));
  // Word actualiza la tabla de contenido y los números de página al abrir
  const set = zip.file('word/settings.xml');
  if (set && !/updateFields/.test(set.asText())) zip.file('word/settings.xml', set.asText().replace(/(<w:hdrShapeDefaults|<w:footnotePr|<w:endnotePr|<w:compat[ >]|<w:docVars|<w:rsids|<m:mathPr|<w:attachedSchema|<w:themeFontLang|<w:clrSchemeMapping|<w:decimalSymbol|<w:listSeparator|<\/w:settings>)/, '<w:updateFields w:val="true"/>$1'));
  if (todas.length) {
    let rels = zip.file('word/_rels/document.xml.rels').asText();
    for (const f of todas) {
      const ext = f.tipo_mime === 'image/png' ? 'png' : 'jpg';
      zip.file(`word/media/sigi_foto${f.n}.${ext}`, f.datos);
      rels = rels.replace('</Relationships>', `<Relationship Id="rIdSigiFoto${f.n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/sigi_foto${f.n}.${ext}"/></Relationships>`);
    }
    zip.file('word/_rels/document.xml.rels', rels);
    let tipos = zip.file('[Content_Types].xml').asText();
    for (const [ext, mime] of [['jpg', 'image/jpeg'], ['png', 'image/png']]) if (!new RegExp(`Extension="${ext}"`, 'i').test(tipos)) tipos = tipos.replace('<Types ', '<Types ').replace(/(<Types[^>]*>)/, `$1<Default Extension="${ext}" ContentType="${mime}"/>`);
    zip.file('[Content_Types].xml', tipos);
  }
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ---------- Informe social mensual (PGS / fichas sociales del PAGA) ----------
const TABLAS_SOCIALES = ['social', 'pqrs', 'reunion', 'acta_vecindad', 'mano_obra', 'capacitacion', 'afectacion', 'encuesta', 'veeduria'];
function porFicha(d) {
  const g = d.gs, n = {}, suma = (f, k) => { const c = f || 'Sin ficha'; (n[c] = n[c] || { pqrs: 0, reuniones: 0, vecindad: 0, cultura: 0, afectaciones: 0, otras: 0 })[k]++; };
  g.pqrs_mes.filter(x => x.fecha >= d.ini).forEach(x => suma(x.ficha, 'pqrs'));
  g.reuniones.forEach(x => suma(x.ficha, 'reuniones')); g.vecindad.forEach(x => suma(x.ficha, 'vecindad'));
  g.capacitaciones.forEach(x => suma(x.ficha, 'cultura')); g.afectaciones.forEach(x => suma(x.ficha, 'afectaciones'));
  [...g.encuestas, ...(g.social_mes || [])].forEach(x => suma(x.ficha, 'otras'));
  if (g.mano_obra) suma(g.mano_obra.ficha, 'otras');
  const nombre = c => d.fichas_social.find(f => f.codigo === c);
  return tabla(['FICHA', 'PROGRAMA / PROYECTO', 'PQRS', 'REUNIONES', 'ACTAS VECINDAD', 'CULTURA VIAL', 'AFECTACIONES', 'OTRAS'],
    Object.entries(n).map(([c, v]) => [c, nombre(c) ? `${nombre(c).programa} · ${nombre(c).nombre}` : '—', v.pqrs, v.reuniones, v.vecindad, v.cultura, v.afectaciones, v.otras]), [1.4, 3.6, 0.8, 1, 1, 1, 1.1, 0.8], 'Sin actividades sociales en el periodo.');
}
function cuerpoSocial(d) {
  const g = d.gs, rec = g.pqrs_mes.filter(x => x.fecha >= d.ini), tipos = {};
  for (const x of rec) tipos[x.tipo || 'Sin tipo'] = (tipos[x.tipo || 'Sin tipo'] || 0) + 1;
  const resp = g.pqrs_mes.filter(x => x.fecha_respuesta && x.fecha_respuesta >= d.ini && x.fecha_respuesta <= d.fin);
  const sop = (d.anexos.social || []), fotos = d.fotos.filter(f => TABLAS_SOCIALES.includes(f.tabla));
  return [
    p(`INFORME DE GESTIÓN SOCIAL No. ${d.numero}`, { b: true, centro: true, sz: 26, antes: 200 }),
    p(`(PERIODO: DESDE ${fecha(d.ini).toUpperCase()} HASTA ${fecha(d.fin).toUpperCase()})`, { centro: true }),
    p([['PROYECTO: ', { b: true }], d.proyecto.nombre || '—'], { centro: true, despues: 300 }),
    titulo('1. ACTIVIDADES POR FICHA SOCIAL DEL PAGA'),
    p('Fichas de los programas 6 a 10 de la Guía de Manejo Ambiental del INVÍAS (gestión social, patrimonio, predios y servicios, accesibilidad, y participación, gobernanza e inclusión).'), porFicha(d),
    titulo('2. ATENCIÓN AL CIUDADANO: PQRS'),
    ficha([['Recibidas en el mes', rec.length], ['Respondidas en el mes', resp.length], ['Vencidas sin respuesta', g.pqrs_mes.filter(x => x.semaforo === 'Vencida').length], ['Por tipo', Object.entries(tipos).map(([k, v]) => `${k}: ${v}`).join('\n') || '—']]),
    gestionSocial(d),
    titulo('3. ANEXOS Y SOPORTES DEL MES'),
    lista([...g.reuniones.map(r => `Acta ${r.acta || 's/n'} de la reunión de ${String(r.tipo || '').toLowerCase()} del ${fecha(r.fecha)}${r.lista_asistencia === 'Sí' ? ' y lista de asistencia' : ''}`),
      ...g.vecindad.map(a => `Acta de vecindad ${a.fecha_cierre && a.fecha_cierre >= d.ini ? 'de cierre' : 'de inicio'} del predio ${a.predio || a.direccion || ''}`),
      ...rec.map(x => `PQRS ${x.radicado || 's/n'} (${x.tipo || ''}) y su respuesta`),
      ...sop.map(a => `${a.nombre}${a.descripcion ? ' — ' + a.descripcion : ''}`)]),
    p('Registro fotográfico social', { b: true, izq: true }), cuadroFotos(fotos),
    firma(d.director, 'Director de interventoría'),
  ].join('');
}
async function informeSocial(d) {
  return informeFormato({ ...d, fotos: d.fotos.filter(f => TABLAS_SOCIALES.includes(f.tabla)) }, null, cuerpoSocial);
}
// ---------- Informe SST mensual del contratista (revisado por la interventoría) ----------
const barra = (v, max) => '█'.repeat(max ? Math.round((v || 0) / max * 20) : 0) + ' ' + num(v);
function cuerpoSST(d) {
  const a = d.sst_anexos, ob = d.contratos.find(c => c.tipo === 'obra') || d.contratos[0] || {}, t = a.trabajadores, m = d.sst_mes_datos || {};
  const cuenta = (k, enMes) => t.filter(x => x[k] && (!enMes || (x[k] >= d.ini && x[k] <= d.fin))).length;
  const grupos = ['Administrativo', 'Operativo', 'Subcontratista'].map(g => [g, ...[null, 'arl', 'eps', 'afp', 'ccf'].map(k => t.filter(x => (x.grupo || 'Operativo') === g && (!k || x[k])).length)]);
  const crono = a.cronograma, ejec = crono.filter(x => x.estado === 'Ejecutada').length;
  const venc = f => (f && f < d.hoy ? ' (vencido)' : '');
  const comites = tipo => tabla(['FECHA', 'ACTIVIDAD / TEMAS', 'RESPONSABLE', 'ESTADO'], a.actividades.filter(x => x.tipo === tipo).map(x => [fecha(x.fecha), x.actividad || '', x.responsable || '', x.estado || '']), [1.5, 4, 2, 1.2], 'Sin reuniones registradas en el periodo.');
  const maxF = Math.max(0, ...d.sst_meses.map(x => x.frecuencia || 0)), maxA = Math.max(0, ...d.sst_meses.map(x => x.ausentismo || 0));
  const firmas = [['Elaboró', 'Profesional SST contratista'], ['Revisó', 'Director de obra'], ['Revisó', 'Profesional SST interventoría']];
  let n = 0; const cap = txt => titulo(`${++n}. ${txt}`);
  return [
    p([['OBJETO: ', { b: true }], `“${ob.objeto || d.proyecto.objeto || d.proyecto.nombre}”`], { centro: true, antes: 200 }),
    p(`INFORME No. ${d.numero} SISTEMA DE GESTIÓN DE SEGURIDAD Y SALUD EN EL TRABAJO`, { b: true, centro: true, sz: 26 }),
    p(`(PERIODO: DESDE ${fecha(d.ini).toUpperCase()} HASTA ${fecha(d.fin).toUpperCase()})`, { centro: true }),
    p([['CONTRATISTA: ', { b: true }], ob.contratista || '—', '   ', ['CONTRATO Nº ', { b: true }], ob.numero || '—'], { centro: true, despues: 300 }),
    cap('INTRODUCCIÓN'), p('El presente informe resume la gestión del Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST) del contratista de obra en el periodo, conforme al Decreto 1072 de 2015 (libro 2, parte 2, título 4, capítulo 6) y a los estándares mínimos de la Resolución 0312 de 2019, y la verificación realizada por la interventoría.'),
    cap('DESCRIPCIÓN Y LOCALIZACIÓN DEL PROYECTO'), p(`El proyecto “${d.proyecto.nombre}” se localiza en ${d.proyecto.ubicacion || '—'}.`),
    tabla(['TRAMO', 'ABSCISA INICIAL', 'ABSCISA FINAL', 'ACTIVIDAD'], d.tramos.map(x => [x.nombre || '', abscisa(x.abs_ini), abscisa(x.abs_fin), x.actividad || '']), [2, 1.5, 1.5, 4], 'Sin tramos registrados.'),
    cap('GENERALIDADES'), p('El contratista debe mantener el SG-SST implementado durante la ejecución, con la matriz de peligros (GTC 45), el plan de trabajo anual, el plan de emergencias, los permisos de trabajo de alto riesgo (Res. 4272 de 2021 para trabajo en alturas) y la verificación mensual de aportes a seguridad social.'),
    cap('OBJETIVOS'), lista(['Verificar el cumplimiento de las obligaciones de SST del contratista en el periodo.', 'Prevenir accidentes de trabajo y enfermedades laborales en los frentes de obra.', 'Hacer seguimiento a los indicadores de accidentalidad y ausentismo (art. 30 Res. 0312 de 2019).']),
    cap('RESUMEN DE ACTIVIDADES SST EJECUTADAS'), sstResumen(d),
    cap('INFORMACIÓN DEL CONTRATO DE OBRA'), ficha([['CONTRATO No.:', ob.numero || '—'], ['OBJETO:', ob.objeto || '—'], ['CONTRATISTA:', ob.contratista || '—'], ['VALOR:', pesos(ob.valor_vigente || ob.valor)], ['FECHA DE INICIO:', fecha(ob.fecha_inicio)], ['FECHA DE TERMINACIÓN:', fecha(ob.fecha_fin_vigente || ob.fecha_fin)]]),
    cap('MAQUINARIA Y VEHÍCULOS'), tabla(['EQUIPO', 'PLACA', 'MODELO', 'OPERADOR', 'LICENCIA', 'TÉCNICO-MECÁNICA', 'SOAT', 'PREOPERACIONAL'], a.equipos.map(x => [x.equipo || '', x.placa || '', x.modelo || '', x.operador || '', fecha(x.licencia) + venc(x.licencia), fecha(x.tecnomecanica) + venc(x.tecnomecanica), fecha(x.soat) + venc(x.soat), fecha(x.ultimo_preoperacional)]), [1.6, 1, 0.9, 1.5, 1.3, 1.3, 1.3, 1.3], 'Sin maquinaria registrada.'),
    cap('CUMPLIMIENTO DE OBLIGACIONES SST'), tabla(['OBLIGACIÓN', 'FECHA', 'ESTADO', 'OBSERVACIÓN'], a.actividades.filter(x => x.tipo === 'Obligación contractual').map(x => [x.actividad || '', fecha(x.fecha), x.estado || '', x.observacion || '']), [4, 1.5, 1.3, 2.5], 'Sin obligaciones registradas en el periodo.'),
    cap('PERSONAL MÍNIMO REQUERIDO'), tabla(['NOMBRE', 'CARGO', 'GRUPO', 'INGRESO', 'RETIRO'], t.filter(x => x.grupo === 'Administrativo').map(x => [x.nombre || '', x.cargo || '', x.grupo || '', fecha(x.ingreso), fecha(x.retiro)]), [2.5, 2.5, 1.5, 1.5, 1.5], 'Sin personal administrativo registrado.'),
    cap('CAPACITACIÓN DEL PERSONAL'), tabla(['NOMBRE', 'CARGO', 'INDUCCIÓN', 'CERT. ALTURAS HASTA'], t.map(x => [x.nombre || '', x.cargo || '', fecha(x.induccion), fecha(x.alturas_vence) + venc(x.alturas_vence)]), [3, 2.5, 1.6, 1.8], 'Sin trabajadores registrados.'),
    cap('RELACIÓN DE PERSONAL Y AFILIACIONES'), tabla(['GRUPO', 'TRABAJADORES', 'ARL', 'EPS', 'AFP', 'CAJA'], grupos, [2.5, 1.4, 1, 1, 1, 1]),
    cap('EXÁMENES MÉDICOS OCUPACIONALES'), tabla(['TIPO', 'EN EL PERIODO', 'ACUMULADO'], [['Ingreso', cuenta('examen_ingreso', true), cuenta('examen_ingreso')], ['Periódicos', cuenta('examen_periodico', true), cuenta('examen_periodico')], ['Egreso / retiro', cuenta('examen_retiro', true), cuenta('examen_retiro')]], [4, 2, 2]),
    cap('INDUCCIÓN Y EVALUACIÓN'), p(`Inducciones del periodo: ${cuenta('induccion', true)}; actividades de inducción o reinducción registradas: ${a.capacitaciones.filter(x => /inducci/i.test(x.tipo || '')).length}.`),
    cap('ENTREGA DE DOTACIÓN Y EPP'), tabla(['FECHA', 'TRABAJADOR', 'ELEMENTO', 'CANT.', 'MOTIVO'], a.epp.map(x => [fecha(x.fecha), x.trabajador || '', x.elemento || '', x.cantidad ?? 1, x.motivo || '']), [1.4, 2.5, 2.2, 0.7, 1.8]),
    cap('NOTIFICACIÓN DE RIESGOS'), p(`Trabajadores notificados de los riesgos de su labor en el periodo: ${cuenta('notificacion_riesgos', true)} (acumulado ${cuenta('notificacion_riesgos')} de ${t.length}).`),
    cap('EXÁMENES DE RETIRO Y PAZ Y SALVOS'), tabla(['NOMBRE', 'RETIRO', 'EXAMEN DE RETIRO', 'PAZ Y SALVO'], t.filter(x => x.retiro && x.retiro <= d.fin).map(x => [x.nombre || '', fecha(x.retiro), fecha(x.examen_retiro), x.paz_salvo || 'Pendiente']), [3, 1.6, 1.6, 1.5], 'Sin retiros en el periodo.'),
    cap('EQUIPOS: INSPECCIONES PREOPERACIONALES'), p(`Equipos con inspección preoperacional en el periodo: ${a.equipos.filter(x => (x.ultimo_preoperacional || '') >= d.ini).length} de ${a.equipos.length}.`),
    cap('CHARLAS Y CAPACITACIONES'), tabla(['FECHA', 'TIPO', 'TEMA', 'FACILITADOR', 'HORAS', 'ASISTENTES'], a.capacitaciones.map(x => [fecha(x.fecha), x.tipo || '', x.tema || '', x.facilitador || '', num(x.horas, 1), x.asistentes ?? '']), [1.4, 1.6, 3, 1.8, 0.8, 1]),
    cap('COMITÉ DE CONVIVENCIA LABORAL (COCOLA)'), comites('Reunión COCOLA'),
    cap('COMITÉ PARITARIO DE SST (COPASST)'), comites('Reunión COPASST'),
    cap('REGISTRO DE AUSENTISMO Y ACCIDENTALIDAD'),
    tabla(['MES', 'TRABAJADORES', 'FRECUENCIA AT', 'SEVERIDAD AT', 'AUSENTISMO %'], d.sst_meses.map(x => [x.mes, x.trabajadores, barra(x.frecuencia, maxF), num(x.severidad), barra(x.ausentismo, maxA)]), [1.2, 1.2, 2.6, 1.3, 2.6], 'Sin datos mensuales de SST.'),
    p(`Accidentes en el mes: ${m.accidentes || 0}; días de incapacidad: ${m.dias_incapacidad || 0}. Indicadores según el art. 30 de la Res. 0312 de 2019.`),
    tabla(['FECHA', 'TIPO', 'DESCRIPCIÓN', 'REPORTE ARL', 'INVESTIGADO', 'ESTADO'], a.investigaciones.map(x => [fecha(x.fecha), x.tipo || '', x.descripcion || '', fecha(x.reporte_arl), fecha(x.investigado), x.estado || '']), [1.3, 1.3, 3, 1.3, 1.3, 1], 'No se presentaron incidentes ni accidentes en el periodo.'),
    cap('ANÁLISIS DE TRABAJO SEGURO (ATS) Y PERMISOS DE TRABAJO'), tabla(['FECHA', 'N.º', 'TIPO', 'ACTIVIDAD', 'ATS', 'LISTA', 'RESCATE', 'ESTADO'], a.permisos.map(x => [fecha(x.fecha), x.numero || '', x.tipo || '', x.actividad || '', x.ats || '', x.lista_chequeo || '', x.rescate || '', x.estado || '']), [1.3, 0.7, 1.5, 2.6, 0.6, 0.7, 0.8, 1]),
    cap('PLAN DE EMERGENCIAS (CAMILLA, BOTIQUÍN, EXTINTORES)'), tabla(['FECHA', 'TIPO', 'ESCENARIO', 'RESULTADO', 'PRÓXIMA'], a.emergencias.map(x => [fecha(x.fecha), x.tipo || '', x.escenario || '', x.resultado || '', fecha(x.proxima)]), [1.4, 1.6, 2.4, 3, 1.4]),
    tabla(['INSPECCIÓN', 'FECHA', 'CUMPLIMIENTO', 'HALLAZGOS'], a.inspecciones.filter(x => /botiqu|extint|camilla/i.test(x.tipo || '')).map(x => [x.tipo, fecha(x.fecha), pct(x.cumplimiento), x.hallazgos || '']), [2, 1.5, 1.3, 4], 'Sin inspecciones de botiquín, camilla o extintores en el periodo.'),
    cap('MATRIZ DE PELIGROS'), tabla(['ACTIVIDAD', 'PELIGRO', 'NR', 'NIVEL', 'MEDIDA DE INTERVENCIÓN'], a.peligros.map(x => [x.actividad || '', x.peligro || '', x.nr ?? '', x.nivel || '', x.intervencion || '']), [2.2, 2.4, 0.8, 0.8, 3.5], 'Sin matriz de peligros registrada.'),
    cap('CRONOGRAMA SST'), p(`Indicador de cumplimiento del plan de trabajo: actividades ejecutadas / programadas × 100 = ${ejec} / ${crono.length} × 100 = ${crono.length ? num(ejec / crono.length * 100, 1) : '—'} %.`),
    tabla(['FECHA', 'ACTIVIDAD', 'RESPONSABLE', 'ESTADO'], crono.map(x => [fecha(x.fecha), x.actividad || '', x.responsable || '', x.estado || '']), [1.5, 4.5, 2, 1.2], 'Sin actividades del cronograma en el periodo.'),
    cap('CONCLUSIONES'), lista([`El contratista registra ${t.filter(x => x.estado !== 'Retirado').length} trabajador(es) activo(s) y ${a.seguridad_social.filter(x => x.verificado === 'Sí').length} verificación(es) de PILA en el mes.`,
      `Cumplimiento del cronograma SST: ${crono.length ? num(ejec / crono.length * 100, 1) + ' %' : 'sin programación registrada'}.`,
      `Anexos con soporte cargado: ${d.anexos_sst.filter(x => x.estado === 'Cargado').length} de ${d.anexos_sst.length}; pendientes: ${d.anexos_sst.filter(x => x.estado === 'Pendiente').map(x => x.n).join(', ') || 'ninguno'}.`]),
    titulo('ANEXOS'),
    tabla(['N.º', 'ANEXO', 'SOPORTES DEL MES', 'ESTADO', 'OBSERVACIÓN'], d.anexos_sst.map(x => [x.n, x.nombre, x.soportes, x.estado === 'Cargado' ? '✔ Cargado' : x.estado, x.descripcion]), [0.6, 3.6, 1.2, 1.3, 2.6]),
    p('Evidencia fotográfica (anexo 21):', { b: true }), cuadroFotos(d.fotos),
    `<w:tbl><w:tblPr><w:tblW w:w="${ANCHO}" w:type="dxa"/></w:tblPr><w:tblGrid>${firmas.map(() => `<w:gridCol w:w="${ANCHO / 3}"/>`).join('')}</w:tblGrid><w:tr>${firmas.map(([r, c]) => `<w:tc><w:tcPr><w:tcW w:w="${ANCHO / 3}" w:type="dxa"/></w:tcPr>${p(r, { b: true, centro: true })}${firma(' ', c)}</w:tc>`).join('')}</w:tr></w:tbl>`,
  ].join('');
}
// Solo se incrustan las fotos de SST
function informeSSTFormato(d, plantilla) {
  return informeFormato({ ...d, fotos: d.fotos.filter(f => /^sst/.test(f.tabla || '')), titulo_formato: 'INFORME MENSUAL DEL SG-SST DEL CONTRATISTA' }, plantilla, cuerpoSST);
}

module.exports = { informeFormato, informeSSTFormato, informeSocial, registrarAnexo };

