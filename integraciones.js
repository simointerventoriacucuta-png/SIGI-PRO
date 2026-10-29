// SIGI Pro - integraciones con otras aplicaciones:
//  Excel (.xlsx), Word (.docx), Microsoft Project (XML), Autodesk Civil 3D / InfraWorks (LandXML) y Power BI (CSV/JSON).
const ExcelJS = require('exceljs');
const docx = require('docx');

const r2 = v => Math.round((v + Number.EPSILON) * 100) / 100;
const FORMATO_PESOS = '"$" #,##0.00';

// ---------- Excel ----------
function hojaConEncabezado(libro, nombre, titulo, cols) {
  const h = libro.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 3 }] });
  h.getCell('A1').value = titulo;
  h.getCell('A1').font = { bold: true, size: 13 };
  h.getRow(3).values = cols.map(c => c[1]);
  h.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.getRow(3).eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F5FA8' } }; c.alignment = { wrapText: true, vertical: 'middle' }; });
  cols.forEach((c, i) => { const col = h.getColumn(i + 1); col.width = c[2] || 14; if (c[3]) col.numFmt = c[3]; });
  return h;
}
function totalesEnHoja(h, totales, desde) {
  let f = desde;
  const NOMBRES = { costo_directo: 'Costo directo', administracion: 'Administración', imprevistos: 'Imprevistos', utilidad: 'Utilidad', estampillas: 'Estampillas y retenciones', subtotal: 'Subtotal', iva: 'IVA', otros: 'Ítems sin AIU', total: 'TOTAL' };
  for (const [k, v] of Object.entries(totales)) {
    if (!v && k !== 'total') continue;
    h.getCell(f, 2).value = NOMBRES[k] || k; h.getCell(f, 3).value = v; h.getCell(f, 3).numFmt = FORMATO_PESOS;
    if (k === 'total') { h.getCell(f, 2).font = { bold: true }; h.getCell(f, 3).font = { bold: true }; }
    f++;
  }
}

async function xlsxPresupuesto(d) {
  const libro = new ExcelJS.Workbook();
  const c = d.contrato;
  const h = hojaConEncabezado(libro, 'Presupuesto', `Presupuesto ${c.tipo === 'obra' ? 'de obra' : 'de interventoría'} · contrato ${c.numero || ''}`,
    [['codigo', 'Código', 10], ['descripcion', 'Descripción', 60], ['unidad', 'Und', 8], ['cantidad', 'Cantidad', 14, '#,##0.00'], ['vr_unitario', 'Vr. unitario', 18, FORMATO_PESOS], ['total', 'Vr. total', 20, FORMATO_PESOS]]);
  let f = 4;
  for (const it of d.items) {
    const fila = h.getRow(f);
    if (it.tipo === 0) { fila.values = [it.codigo, it.descripcion]; fila.font = { bold: true }; }
    else { fila.values = [it.codigo, it.descripcion, it.unidad, it.cantidad, it.vr_unitario]; h.getCell(f, 6).value = { formula: `D${f}*E${f}`, result: r2(it.cantidad * it.vr_unitario) }; }
    f++;
  }
  totalesEnHoja(h, d.totales, f + 1);
  return libro.xlsx.writeBuffer();
}

async function xlsxActa(d) {
  const libro = new ExcelJS.Workbook();
  const a = d.acta, esObra = d.contrato.tipo === 'obra';
  const h = hojaConEncabezado(libro, esObra ? `Acta ${a.numero}` : `Cuenta ${a.numero}`,
    `${esObra ? 'Acta parcial de obra' : 'Cuenta de cobro'} N.º ${a.numero} · ${a.desde || ''} a ${a.hasta || ''} · ${a.estado}`,
    [['codigo', 'Código', 10], ['descripcion', 'Descripción', 50], ['unidad', 'Und', 7], ['cantidad', 'Contratada', 13, '#,##0.00'], ['vr_unitario', 'Vr. unitario', 16, FORMATO_PESOS],
      ['anterior', 'Anterior', 12, '#,##0.00'], ['cant_presentada', 'Presentada', 12, '#,##0.00'], ['cant_aprobada', 'Aprobada', 12, '#,##0.00'], ['acumulado', 'Acumulada', 12, '#,##0.00'],
      ['saldo', 'Saldo', 12, '#,##0.00'], ['vr_acta', 'Vr. esta acta', 18, FORMATO_PESOS], ['vr_acumulado', 'Vr. acumulado', 18, FORMATO_PESOS], ['observacion', 'Observación', 30]]);
  let f = 4;
  for (const x of d.filas) {
    const fila = h.getRow(f);
    if (x.tipo === 0) { fila.values = [x.codigo, x.descripcion]; fila.font = { bold: true }; }
    else {
      fila.values = [x.codigo, x.descripcion, x.unidad, x.cantidad, x.vr_unitario, x.anterior, x.cant_presentada, x.cant_aprobada, x.acumulado, x.saldo, x.vr_acta, x.vr_acumulado, x.observacion];
      if (x.saldo < -1e-9) fila.font = { color: { argb: 'FFC62828' } };
    }
    f++;
  }
  totalesEnHoja(h, d.totales.acta, f + 1);
  return libro.xlsx.writeBuffer();
}

// Lee un presupuesto de Excel: busca la fila de encabezados (descripción, unidad, cantidad, valor unitario).
// Una fila sin unidad ni cantidad es capítulo.
async function leerPresupuestoXlsx(buffer) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  const h = libro.worksheets[0];
  const texto = v => (v == null ? '' : typeof v === 'object' ? (v.result ?? v.text ?? (v.richText ? v.richText.map(t => t.text).join('') : '')) : v);
  const numero = v => { const t = texto(v); if (typeof t === 'number') return t; const n = Number(String(t).replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  let cols = null, filaEnc = 0;
  for (let f = 1; f <= Math.min(30, h.rowCount) && !cols; f++) {
    const c = {};
    h.getRow(f).eachCell((celda, i) => {
      const t = String(texto(celda.value)).toLowerCase();
      if (/descrip/.test(t)) c.descripcion = i;
      else if (/^(item|ítem|c[oó]d)/.test(t)) c.codigo = i;
      else if (/^(und|unid)/.test(t)) c.unidad = i;
      else if (/^cant/.test(t)) c.cantidad = i;
      else if (/unit/.test(t)) c.vr_unitario = i;
    });
    if (c.descripcion && (c.cantidad || c.vr_unitario)) { cols = c; filaEnc = f; }
  }
  if (!cols) throw new Error('No encontré la fila de encabezados (Descripción, Unidad, Cantidad, Valor unitario) en la primera hoja');
  const filas = [];
  for (let f = filaEnc + 1; f <= h.rowCount; f++) {
    const r = h.getRow(f), v = k => (cols[k] ? r.getCell(cols[k]).value : null);
    const descripcion = String(texto(v('descripcion')) || '').trim();
    if (!descripcion) continue;
    if (/^(total|subtotal|costo directo|administraci|imprevist|utilidad|iva)/i.test(descripcion)) continue;
    filas.push({ codigo: String(texto(v('codigo')) || '').trim(), descripcion, unidad: String(texto(v('unidad')) || '').trim(), cantidad: numero(v('cantidad')), vr_unitario: numero(v('vr_unitario')) });
  }
  return filas;
}

// ---------- Word ----------
const pesos = v => '$ ' + Number(v || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cant = v => Number(v || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Valor en letras (pesos colombianos)
function enLetras(valor) {
  const U = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE',
    'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const D = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const C = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
  const cientos = n => {
    if (n === 100) return 'CIEN';
    const c = Math.floor(n / 100), r = n % 100;
    const dec = r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' Y ' + U[r % 10] : '');
    return [C[c], dec].filter(Boolean).join(' ');
  };
  const entero = Math.floor(Math.abs(valor)), centavos = Math.round((Math.abs(valor) - entero) * 100);
  const partes = [];
  const milm = Math.floor(entero / 1e9), mill = Math.floor((entero % 1e9) / 1e6), mil = Math.floor((entero % 1e6) / 1e3), resto = entero % 1e3;
  const millones = milm * 1000 + mill;
  if (millones) partes.push(millones === 1 ? 'UN MILLÓN' : (milm ? (milm === 1 ? 'MIL' : cientos(milm) + ' MIL') + (mill ? ' ' + cientos(mill) : '') : cientos(mill)) + ' MILLONES');
  if (mil) partes.push(mil === 1 ? 'MIL' : cientos(mil) + ' MIL');
  if (resto) partes.push(cientos(resto));
  let t = (partes.join(' ') || 'CERO') + (millones && !mil && !resto ? ' DE' : '') + ' PESOS';
  if (centavos) t += ` CON ${cientos(centavos)} CENTAVOS`;
  return t + ' M/CTE';
}

async function docxActa(d) {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, PageOrientation } = docx;
  const a = d.acta, c = d.contrato, esObra = c.tipo === 'obra', t = d.totales.acta;
  const celda = (texto, opc = {}) => new TableCell({ children: [new Paragraph({ alignment: opc.der ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text: String(texto ?? ''), bold: !!opc.negrita, size: 16 })] })] });
  const enc = ['Código', 'Descripción', 'Und', 'Contratada', 'Vr. unitario', 'Anterior', 'Esta acta', 'Acumulada', 'Saldo', 'Vr. esta acta'];
  const filas = [new TableRow({ tableHeader: true, children: enc.map(e => celda(e, { negrita: true })) })];
  for (const x of d.filas) {
    if (x.tipo === 0) { filas.push(new TableRow({ children: [celda(x.codigo, { negrita: true }), celda(x.descripcion, { negrita: true }), ...Array(8).fill(0).map(() => celda(''))] })); continue; }
    filas.push(new TableRow({ children: [celda(x.codigo), celda(x.descripcion), celda(x.unidad), celda(cant(x.cantidad), { der: true }), celda(pesos(x.vr_unitario), { der: true }),
      celda(cant(x.anterior), { der: true }), celda(cant(x.cant_aprobada), { der: true }), celda(cant(x.acumulado), { der: true }), celda(cant(x.saldo), { der: true }), celda(pesos(x.vr_acta), { der: true })] }));
  }
  const NOMBRES = { costo_directo: 'Costo directo', administracion: 'Administración', imprevistos: 'Imprevistos', utilidad: 'Utilidad', estampillas: 'Estampillas y retenciones', subtotal: 'Subtotal', iva: 'IVA', otros: 'Ítems sin AIU', total: 'TOTAL' };
  const resumen = Object.entries(t).filter(([k, v]) => v || k === 'total').map(([k, v]) => new TableRow({ children: [celda(NOMBRES[k] || k, { negrita: k === 'total' }), celda(pesos(v), { der: true, negrita: k === 'total' })] }));
  const p = (texto, opc = {}) => new Paragraph({ spacing: { after: 120 }, alignment: opc.centro ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text: texto, bold: !!opc.negrita, size: opc.size || 20 })] });
  const doc = new Document({
    sections: [{
      properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, children: [new TextRun(`${esObra ? 'ACTA PARCIAL DE OBRA' : 'CUENTA DE COBRO'} N.º ${a.numero}`)] }),
        p(`Contrato: ${c.numero || ''}    Contratista: ${c.contratista || ''}    NIT: ${c.nit || ''}`),
        p(`Objeto: ${c.objeto || ''}`),
        p(`Periodo: ${a.desde || '—'} a ${a.hasta || '—'}    Fecha del acta: ${a.fecha || '—'}    Estado: ${a.estado}`),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: filas }),
        p(''),
        new Table({ width: { size: 45, type: WidthType.PERCENTAGE }, rows: resumen }),
        p(''),
        p(`Valor de esta acta: ${pesos(t.total)} (${enLetras(t.total)}).`, { negrita: true }),
        p(`Valor acumulado con esta acta: ${pesos(d.totales.acumulado.total)}.`),
        p(''), p(''),
        p('______________________________                    ______________________________', { centro: true }),
        p(esObra ? 'Contratista de obra                                              Interventoría' : 'Interventoría                                              Supervisor de la entidad', { centro: true }),
      ],
    }],
  });
  return Packer.toBuffer(doc);
}

// Informe mensual de interventoría (datos de informeMensual en server.js)

// ---------- Microsoft Project (XML: Archivo → Guardar como → XML) ----------
function etiqueta(xml, nombre) { const m = xml.match(new RegExp(`<${nombre}>([\\s\\S]*?)</${nombre}>`)); return m ? m[1].trim() : null; }
const desXml = s => (s == null ? s : s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'));
function leerProject(xml) {
  const tareas = [];
  const bloque = etiqueta(xml, 'Tasks');
  if (!bloque) throw new Error('El archivo no parece un XML de Microsoft Project (falta <Tasks>)');
  for (const m of bloque.matchAll(/<Task>([\s\S]*?)<\/Task>/g)) {
    const t = m[1];
    const nombre = desXml(etiqueta(t, 'Name'));
    if (!nombre || etiqueta(t, 'IsNull') === '1') continue;
    tareas.push({
      uid: Number(etiqueta(t, 'UID')), wbs: etiqueta(t, 'WBS') || etiqueta(t, 'OutlineNumber'), nombre,
      nivel: Number(etiqueta(t, 'OutlineLevel')) || 0, inicio: (etiqueta(t, 'Start') || '').slice(0, 10) || null, fin: (etiqueta(t, 'Finish') || '').slice(0, 10) || null,
      avance_real: Number(etiqueta(t, 'PercentComplete')) || 0, resumen: etiqueta(t, 'Summary') === '1' ? 1 : 0, hito: etiqueta(t, 'Milestone') === '1' ? 1 : 0,
    });
  }
  return tareas.filter(t => t.nivel > 0 || tareas.length === 1);
}
// Avance programado a una fecha: proporción lineal del tiempo transcurrido
function programado(t, hoy) {
  if (!t.inicio || !t.fin) return 0;
  const i = Date.parse(t.inicio), f = Date.parse(t.fin), h = Date.parse(hoy);
  if (h <= i) return 0; if (h >= f) return 100;
  return Math.round(((h - i) / Math.max(1, f - i)) * 1000) / 10;
}
function xmlProject(nombreProyecto, tareas) {
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project"><Name>${esc(nombreProyecto)}</Name><Tasks>
${tareas.map((t, i) => `<Task><UID>${i + 1}</UID><ID>${i + 1}</ID><Name>${esc(t.nombre)}</Name><WBS>${esc(t.wbs || '')}</WBS><OutlineLevel>${t.nivel || 1}</OutlineLevel>${t.inicio ? `<Start>${t.inicio}T08:00:00</Start>` : ''}${t.fin ? `<Finish>${t.fin}T17:00:00</Finish>` : ''}<PercentComplete>${Math.round(t.avance_real || 0)}</PercentComplete><Summary>${t.resumen ? 1 : 0}</Summary><Milestone>${t.hito ? 1 : 0}</Milestone></Task>`).join('\n')}
</Tasks></Project>`;
}

// ---------- Autodesk Civil 3D / InfraWorks (LandXML) ----------
// Toma los alineamientos con su geometría (líneas, curvas y espirales) como polilínea N/E con abscisa.
function leerLandXML(xml) {
  const out = [];
  for (const m of xml.matchAll(/<Alignment\b([^>]*)>([\s\S]*?)<\/Alignment>/g)) {
    const attr = k => { const r = m[1].match(new RegExp(`\\b${k}="([^"]*)"`)); return r ? r[1] : null; };
    const geom = etiqueta(m[2], 'CoordGeom');
    if (!geom) continue;
    const pts = [];
    const par = s => { const [n, e] = s.trim().split(/\s+/).map(Number); return [e, n]; }; // LandXML guarda "Norte Este"
    for (const g of geom.matchAll(/<(Line|Curve|Spiral)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
      const ini = etiqueta(g[3], 'Start'), fin = etiqueta(g[3], 'End'), cen = etiqueta(g[3], 'Center');
      if (!ini || !fin) continue;
      const a = par(ini), b = par(fin);
      if (!pts.length) pts.push(a);
      if (g[1] === 'Curve' && cen) {
        // Arco discretizado en 12 tramos
        const c = par(cen), r = Math.hypot(a[0] - c[0], a[1] - c[1]);
        let t0 = Math.atan2(a[1] - c[1], a[0] - c[0]), t1 = Math.atan2(b[1] - c[1], b[0] - c[0]);
        const horario = /rot="cw"/.test(g[2]);
        if (horario && t1 > t0) t1 -= 2 * Math.PI; if (!horario && t1 < t0) t1 += 2 * Math.PI;
        for (let k = 1; k < 12; k++) { const t = t0 + (t1 - t0) * k / 12; pts.push([c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)]); }
      }
      pts.push(b);
    }
    if (pts.length < 2) continue;
    const longitud = pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
    out.push({ nombre: desXml(attr('name')) || 'Alineamiento', abs_ini: Number(attr('staStart')) || 0, longitud: Number(attr('length')) || r2(longitud), puntos: pts.map(p => [r2(p[0]), r2(p[1])]) });
  }
  if (!out.length) throw new Error('No encontré alineamientos (<Alignment> con <CoordGeom>) en el LandXML');
  return out;
}

// ---------- Power BI (CSV o JSON por la web: Obtener datos → Web) ----------
function csv(filas) {
  if (!filas.length) return '﻿';
  const cols = Object.keys(filas[0]);
  const esc = v => { const s = v == null ? '' : String(v); return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '﻿' + [cols.join(','), ...filas.map(f => cols.map(c => esc(f[c])).join(','))].join('\r\n');
}

// ---------- Requisiciones (RQ) ----------
function encabezadoRQ(d) {
  const r = d.requisicion, c = d.contrato;
  return [[`Requisición N.º`, r.numero], ['Fecha', r.fecha || ''], ['Estado', r.estado], ['Contrato', c ? `${c.tipo === 'obra' ? 'Obra' : 'Interventoría'} ${c.numero || ''}` : ''],
    ['Solicitante', r.solicitante || ''], ['Frente', r.frente || ''], ['Justificación', r.justificacion || ''], ['Aprobada por', r.aprobado_por ? `${r.aprobado_por} (${r.fecha_aprobacion || ''})` : ''],
    ...(r.estado === 'Rechazada' ? [['Motivo del rechazo', r.motivo_rechazo || '']] : []), ...(r.estado === 'Atendida' ? [['Atendida', `${r.fecha_atencion || ''} · ${r.proveedor || ''} · ${r.documento || ''}`]] : [])];
}
async function xlsxRequisicion(d) {
  const libro = new ExcelJS.Workbook(), h = libro.addWorksheet(`RQ ${d.requisicion.numero}`);
  h.getCell('A1').value = `REQUISICIÓN N.º ${d.requisicion.numero}`; h.getCell('A1').font = { bold: true, size: 13 };
  let f = 3;
  for (const [k, v] of encabezadoRQ(d)) { h.getCell(f, 1).value = k; h.getCell(f, 1).font = { bold: true }; h.getCell(f, 2).value = v; f++; }
  f++;
  const enc = ['Ítem presupuesto', 'Descripción', 'Und', 'Cantidad', 'Vr. unitario estimado', 'Vr. total'];
  h.getRow(f).values = enc; h.getRow(f).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.getRow(f).eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F5FA8' } }; });
  [16, 50, 8, 12, 20, 20].forEach((w, i) => (h.getColumn(i + 1).width = w));
  const ini = ++f;
  for (const x of d.items) {
    h.getRow(f).values = [x.item_codigo || '', x.descripcion || '', x.unidad || '', x.cantidad, x.vr_unitario];
    h.getCell(f, 6).value = { formula: `D${f}*E${f}`, result: x.total };
    h.getCell(f, 4).numFmt = '#,##0.00'; h.getCell(f, 5).numFmt = FORMATO_PESOS; h.getCell(f, 6).numFmt = FORMATO_PESOS; f++;
  }
  h.getCell(f, 5).value = 'TOTAL'; h.getCell(f, 5).font = { bold: true };
  h.getCell(f, 6).value = { formula: `SUM(F${ini}:F${Math.max(ini, f - 1)})`, result: d.total }; h.getCell(f, 6).numFmt = FORMATO_PESOS; h.getCell(f, 6).font = { bold: true };
  return libro.xlsx.writeBuffer();
}
async function docxRequisicion(d) {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel } = docx;
  const celda = (texto, opc = {}) => new TableCell({ children: [new Paragraph({ alignment: opc.der ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text: String(texto ?? ''), bold: !!opc.negrita, size: 18 })] })] });
  const p = (texto, opc = {}) => new Paragraph({ spacing: { after: 120 }, alignment: opc.centro ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text: texto, bold: !!opc.negrita, size: 20 })] });
  const filas = [new TableRow({ tableHeader: true, children: ['Ítem', 'Descripción', 'Und', 'Cantidad', 'Vr. unitario', 'Vr. total'].map(e => celda(e, { negrita: true })) }),
    ...d.items.map(x => new TableRow({ children: [celda(x.item_codigo || ''), celda(x.descripcion), celda(x.unidad), celda(cant(x.cantidad), { der: true }), celda(pesos(x.vr_unitario), { der: true }), celda(pesos(x.total), { der: true })] })),
    new TableRow({ children: [celda(''), celda('TOTAL ESTIMADO', { negrita: true }), celda(''), celda(''), celda(''), celda(pesos(d.total), { der: true, negrita: true })] })];
  const doc = new Document({ sections: [{ children: [
    new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, children: [new TextRun(`REQUISICIÓN N.º ${d.requisicion.numero}`)] }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: encabezadoRQ(d).map(([k, v]) => new TableRow({ children: [celda(k, { negrita: true }), celda(v)] })) }),
    p(''), new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: filas }), p(''),
    p(`Valor estimado: ${pesos(d.total)} (${enLetras(d.total)}).`, { negrita: true }), p(''), p(''),
    p('______________________________                    ______________________________', { centro: true }),
    p('Solicitante                                                            Director de interventoría', { centro: true }),
  ] }] });
  return Packer.toBuffer(doc);
}

module.exports = { xlsxRequisicion, docxRequisicion, xlsxPresupuesto, xlsxActa, leerPresupuestoXlsx, docxActa, enLetras, pesos, leerProject, programado, xmlProject, leerLandXML, csv };
