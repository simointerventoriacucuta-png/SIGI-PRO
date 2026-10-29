// Datos iniciales: Interventoría Hibiscos - Cúcuta (Contrato de Interventoría N.º 058 de 2026)
// Fuente: contrato 058 (cláusulas segunda, cuarta y décima) y memoria_grafo.json del proyecto.
const CARPETA = 'C:\\Users\\ASUS\\Desktop\\PROYECTOS\\INTERVENTORIA CUCUTA';

// [código, descripción, unidad, cantidad] — una fila con solo [código, descripción] es capítulo
const OBRA = [
  ['1', 'PRELIMINARES'],
  ['NP-01', 'LOCALIZACIÓN, NIVELACIÓN Y REPLANTEO', 'M2', 17622.19],
  ['1.2', 'CORTE DE PAVIMENTO', 'ML', 266.42],
  ['NP-02', 'DEMOLICIÓN DE SARDINEL', 'ML', 415],
  ['NP-03', 'DEMOLICIÓN DE ANDÉN', 'M2', 377.95],
  ['1.5', 'EXCAVACIÓN MECÁNICA SIN CLASIFICAR', 'M3', 5460.43],
  ['1.6', 'CONFORMACIÓN DE LA SUBRASANTE', 'M2', 10954.28],
  ['1.7', 'EXCAVACIÓN MANUAL', 'M3', 986.32],
  ['1.8', 'RETIRO DE SOBRANTES (INCLUYE TRANSPORTE Y ESCOMBRERA)', 'M3', 2542.31],
  ['NP-04', 'CERRAMIENTO EN TELA VERDE (H=2.1 M)', 'ML', 2557.88],
  ['NP-05', 'DEMOLICIÓN DE ESTRUCTURAS EN CONCRETO', 'M3', 44],
  ['1.11', 'TRANSPORTE DE MAQUINARIA ENTRE 2 Y 5 KM', 'UND', 500],
  ['2', 'ESTRUCTURA DEL PAVIMENTO'],
  ['NP-06', 'SUMINISTRO E INSTALACIÓN DE COLCHÓN DE ROCA (PIEDRA RAJÓN)', 'M3', 1749.36],
  ['NP-07', 'SUMINISTRO E INSTALACIÓN DE GEOTEXTIL T3100', 'M2', 10954.28],
  ['2.4', 'SUMINISTRO, INSTALACIÓN Y COMPACTACIÓN BASE GRANULAR INCLUYE TRANSPORTE', 'M3', 1643.14],
  ['2.5', 'SUMINISTRO, INSTALACIÓN Y COMPACTACIÓN SUBBASE GRANULAR INCLUYE TRANSPORTE', 'M3', 4147.97],
  ['NP-08', 'CONCRETO HIDRÁULICO DE MR 45', 'M3', 248.4],
  ['2.7', 'ACERO DE REFUERZO Fy=4200 KG/CM2 REFORZAMIENTO PLACAS MR', 'KG', 3500.72],
  ['2.8', 'ACERO DE REFUERZO PARA CANASTILLAS JUNTAS TRANSVERSALES', 'ML', 670],
  ['2.9', 'ESTRUCTURA DE CONFINAMIENTO (INCLUYE ACERO DE REFUERZO)', 'ML', 251.4],
  ['2.10', 'JUNTA DE DILATACIÓN Y CONTRACCIÓN INCLUYE CORTE Y SELLADO DE JUNTAS', 'ML', 474],
  ['2.11', 'IMPRIMACIÓN CON EMULSIÓN ASFÁLTICA CRL-1', 'M2', 12920],
  ['2.12', 'RIEGO DE LIGA CON EMULSIÓN ASFÁLTICA CRR-1', 'M2', 12920],
  ['2.13', 'SUMINISTRO E INSTALACIÓN DE MEZCLA ASFÁLTICA (MDC19) PARA CARPETA RODADURA', 'M3', 347.05],
  ['NP-09', 'SUMINISTRO E INSTALACIÓN DE MEZCLA ASFÁLTICA (MDC25) PARA CARPETA', 'M3', 293.05],
  ['NP-10', 'SUMINISTRO E INSTALACIÓN TSD', 'M2', 5967],
  ['3', 'ESTRUCTURAS EN CONCRETO Y URBANISMO'],
  ['NP-11', 'SARDINEL PREFABRICADO EN CONCRETO (H=0.5 M)', 'ML', 660],
  ['NP-12', 'RAMPA EN CONCRETO 21 MPA, INCLUYE MALLA ELECTROSOLDADA', 'M2', 19],
  ['3.3', 'CONCRETO 21 MPA PARA ANDENES, INCLUYE MALLA ELECTROSOLDADA', 'M2', 378.44],
  ['3.4', 'SUMINISTRO, INSTALACIÓN Y COMPACTACIÓN SUBBASE GRANULAR PARA ANDENES', 'M2', 296.19],
  ['3.5', 'BORDILLO PREFABRICADO EN CONCRETO (H=0.20 M)', 'ML', 1260],
  ['4', 'OBRAS DE MANEJO DE AGUAS'],
  ['NP-13', 'CONCRETO 28 MPA (BOX CULVERT, SUMIDEROS Y DESCOLE DE ALCANTARILLA)', 'M3', 69.09],
  ['4.2', 'ACERO DE REFUERZO Fy=4200 KG/CM2 (BOX CULVERT, SUMIDEROS Y DESCOLE DE ALCANTARILLA)', 'KG', 7774.98],
  ['NP-14', 'REALCE DE POZOS DE INSPECCIÓN, INCLUYE AEROTAPA', 'UND', 9],
  ['NP-15', 'CONSTRUCCIÓN DE POZO DE INSPECCIÓN TIPO I', 'UND', 2],
  ['NP-16', 'CONSTRUCCIÓN DE POZO DE INSPECCIÓN TIPO II A D=1.5', 'UND', 2],
  ['NP-17', 'CONSTRUCCIÓN DE POZO DE INSPECCIÓN TIPO II A D=1.8', 'UND', 6],
  ['NP-18', 'SUMINISTRO E INSTALACIÓN DE REJILLA PARA SUMIDERO DE LONGITUD=1.3 M DE ANCHO X 1 ML', 'UND', 17],
  ['NP-19', 'SUMINISTRO E INSTALACIÓN DE TAPA PARA SUMIDERO', 'UND', 7],
  ['NP-20', 'CONCRETO SOLADO 14 MPA', 'M3', 1.43],
  ['NP-21', 'SUMINISTRO E INSTALACIÓN DE TAPA PARA SUMIDERO S5-S6', 'UND', 7],
  ['NP-22', 'SUMINISTRO E INSTALACIÓN DE REJILLA PARA SUMIDERO DE LONGITUD=3.8 M', 'UND', 4],
  ['NP-23', 'SUMINISTRO E INSTALACIÓN DE TUBERÍA PVC 12"', 'ML', 21.23],
  ['NP-24', 'SUMINISTRO E INSTALACIÓN DE TUBERÍA PVC 18"', 'ML', 19.06],
  ['NP-25', 'SUMINISTRO E INSTALACIÓN DE TUBERÍA PVC 24"', 'ML', 147.76],
  ['NP-26', 'SUMINISTRO E INSTALACIÓN DE TUBERÍA PVC 30"', 'ML', 79],
  ['NP-27', 'SUMINISTRO E INSTALACIÓN DE TUBERÍA PVC 33"', 'ML', 102],
  ['NP-28', 'SUMINISTRO E INSTALACIÓN DE CONCRETO CICLÓPEO (PARA BOX)', 'M3', 34],
  ['NP-29', 'SUMINISTRO E INSTALACIÓN DE JUNTA PARA BOX CULVERT', 'ML', 46],
  ['4.20', 'SUMINISTRO E INSTALACIÓN DE CONCRETO PARA CUNETA Y/O BERMACUNETA', 'M2', 2490.24],
  ['4.21', 'RELLENO COMPACTADO CON MATERIAL SELECCIONADO DE LA EXCAVACIÓN PARA TUBERÍA DE RED PLUVIAL', 'M3', 653.2],
  ['4.22', 'SUMINISTRO E INSTALACIÓN DE AFIRMADO CON RECEBO PARA CONFINAMIENTO LATERAL INCLUYE TRANSPORTE', 'M3', 521.15],
  ['4.23', 'SUMINISTRO E INSTALACIÓN DE GEOTEXTIL NT3000 PARA FILTRO (1.2 M DE ANCHO)', 'ML', 786],
  ['4.24', 'LIMPIEZA DE ALCANTARILLAS', 'ML', 90],
  ['NP-30', 'SUMINISTRO E INSTALACIÓN DE TUBO PVC 8" PERFORADO PARA FILTRO', 'ML', 220],
  ['4.25', 'SUMINISTRO, INSTALACIÓN Y COMPACTACIÓN DE GRAVA 2 1/2" PARA FILTRO (INCLUYE TRANSPORTE)', 'M3', 40.6],
  ['NP-31', 'SUMINISTRO E INSTALACIÓN DE REJILLA PARA SUMIDERO DE LONGITUD=10.3 M', 'UND', 2],
  ['5', 'SEÑALIZACIÓN'],
  ['5.1', 'LÍNEA DE DEMARCACIÓN VIAL CON PINTURA TRÁFICO - PLÁSTICO EN FRÍO (ANCHO 12 CM)', 'ML', 6498.61],
  ['5.2', 'MARCA VIAL CON PINTURA TRÁFICO PARA DEMARCACIÓN DE OBJETOS', 'M2', 59],
  ['5.3', 'MARCA VIAL CON PINTURA TRÁFICO PARA DEMARCACIÓN DE FLECHAS DE ORIENTACIÓN VEHICULAR', 'M2', 34],
  ['5.7', 'PINTURA DE TEXTOS SOBRE LA VÍA CON PINTURA TRÁFICO', 'M2', 1],
  ['6', 'COMPONENTES FUERA DEL AIU'],
  ['6.1', 'IMPLEMENTACIÓN DEL PLAN DE MANEJO DE TRÁNSITO (PMT)', 'GL', 1, 1],
  ['6.2', 'IMPLEMENTACIÓN PMA - HIGIENE - SEGURIDAD Y SALUD EN EL TRABAJO SST / VERIFICACIÓN Y CONTROL DE EJECUCIÓN P.A.G.A', 'GL', 1, 1],
];

// [código, descripción, unidad, cantidad, valor unitario]
const INTERVENTORIA = [
  ['1', 'COSTOS DE PERSONAL'],
  ['1.1', 'Director de interventoría ($7.000.000 x FM 2,30 x 70 %)', 'MES', 10, 11270000],
  ['1.2', 'Residente de interventoría ($5.000.000 x FM 2,30 x 100 %)', 'MES', 10, 11500000],
  ['1.3', 'SISO ($4.000.000 x FM 2,30 x 100 %)', 'MES', 10, 9200000],
  ['1.4', 'Especialista en vías y/o pavimentos - externo PST ($6.940.000 x 1,00 x 40 %)', 'MES', 10, 2776000],
  ['2', 'OTRAS INVERSIONES'],
  ['2.1', 'Apoyo a la residencia (inspector de obra)', 'MES', 10, 1750905],
  ['2.2', 'Servicio de topografía (topógrafo)', 'MES', 10, 3542628],
  ['2.3', 'Servicio de ingeniería ambiental (ingeniero ambiental)', 'MES', 10, 6000000],
  ['2.4', 'Arriendo oficina', 'MES', 10, 1500000],
  ['2.5', 'Servicios públicos y operacionales', 'MES', 10, 350000],
  ['2.6', 'Equipos de cómputo e impresión', 'MES', 10, 500000],
  ['2.7', 'Papelería', 'MES', 10, 350000],
  ['2.8', 'Alquiler de vehículo transporte personal de interventoría (incluye conductor)', 'MES', 10, 4000000],
  ['2.9', 'Desgaste en la máquina de Los Ángeles INV-E-218-2013', 'UND', 2, 150000],
  ['2.10', 'Degradación por abrasión en el equipo Micro-Deval INV-E-238-2013', 'UND', 3, 200000],
  ['2.17', 'Resistencia mecánica por el método del 10 % de finos INV-E-224-2013', 'UND', 4, 200000],
  ['2.18', 'Caras fracturadas INV-E-227-2013', 'UND', 11, 40000],
  ['2.19', 'Angularidad de la fracción fina INV-E-239-2013', 'UND', 12, 80000],
  ['2.20', 'CBR INV-E-148-2013', 'UND', 13, 120000],
];

module.exports = async function sembrar(db) {
  const ins = async (tabla, o) => {
    const k = Object.keys(o);
    return (await db.run(`INSERT INTO ${tabla} (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, ...Object.values(o))).id;
  };
  const items = async (contrato_id, filas) => {
    let padre = null, orden = 0;
    for (const [codigo, descripcion, unidad, cantidad, b] of filas) {
      const cap = unidad == null;
      const vr = filas === OBRA ? 0 : b || 0;
      const sin_aiu = filas === OBRA && b ? 1 : 0;
      const id = await ins('item', { contrato_id, padre_id: cap ? null : padre, tipo: cap ? 0 : 1, codigo, descripcion, unidad: unidad || null, cantidad: cantidad || 0, vr_unitario: vr, sin_aiu, orden: ++orden });
      if (cap) padre = id;
    }
  };

  const p = await ins('proyecto', {
    nombre: 'Interventoría Hibiscos - Cúcuta',
    entidad: 'E-Desarrollo S.A.S. (NIT 901.902.466-8)',
    ubicacion: 'San José de Cúcuta, Norte de Santander',
    objeto: 'Interventoría integral al proyecto Mejoramiento y construcción de la vía a El Carmen de Tonchalá desde el Anillo Vial Occidental sector Las Delicias, Hibiscos hasta la Calle 35 del sector Belén (vía Belén - Las Delicias, 1,612 km)',
    carpeta: CARPETA,
    memoria: CARPETA + '\\00 MEMORIA DEL PROYECTO\\memoria_grafo.json',
  });
  const ci = await ins('contrato', {
    proyecto_id: p, tipo: 'interventoria', numero: '058 de 2026', contratante: 'E-Desarrollo S.A.S.',
    contratista: 'SIMO S.A.S. - Servicio de Interventoría - Montaje y Obra Civil', nit: '829.002.886-5', representante: 'Daniela Andrea Jiménez Correa',
    objeto: 'Interventoría integral - vía Belén - Las Delicias (Hibiscos)', valor: 699995403.76, plazo: '10 meses desde el acta de inicio',
    fecha_firma: '2026-10-27', supervisor: 'Subgerencia de Ejecución de Proyectos - E-Desarrollo', iva_pct: 19, iva_base: 'total', estampillas_pct: 9.55,
    estado: 'Firmado - por legalizar', notas: 'Proceso INT-SMC-022-2026. Adjudicado por Res. 0193 del 22-oct-2026. Pago 90 % por actas según avance físico de la obra, 10 % en la liquidación.',
  });
  const co = await ins('contrato', {
    proyecto_id: p, tipo: 'obra', numero: '(por confirmar)', contratante: 'E-Desarrollo S.A.S.', contratista: '(por confirmar)',
    objeto: 'Mejoramiento y construcción de la vía a El Carmen de Tonchalá - Hibiscos - Calle 35 Belén (1,612 km)', valor: 0,
    aiu_a: 24, aiu_i: 1, aiu_u: 4, iva_pct: 19, iva_base: 'utilidad', estado: 'Por confirmar',
    notas: 'Cantidades tomadas de la cláusula segunda del contrato de interventoría. Faltan los precios unitarios del contrato de obra.',
  });
  await items(co, OBRA);
  await items(ci, INTERVENTORIA);

  const V = async (fecha, tipo, descripcion, fuente) => ins('vencimiento', { proyecto_id: p, fecha, tipo, descripcion, responsable: 'SIMO', estado: 'Pendiente', fuente });
  await V('2026-10-30', 'Garantía', 'Entregar la garantía única: cumplimiento, salarios y calidad (10 % c/u = $69.999.540,38). No constituirla es causal resolutoria', 'Contrato 058, cláusula décima');
  await V(null, 'Documento', 'Conseguir el contrato firmado y la Resolución de adjudicación 0193 del 22-oct-2026', 'Memoria p002');
  await V(null, 'Legalización', 'Registro presupuestal (RP) y aprobación de la garantía, requisitos para el acta de inicio', 'Contrato 058, cláusula vigésima tercera');
  await V(null, 'Acta de inicio', 'Preparar el acta de inicio y presentar las hojas de vida del personal para aprobación', 'Contrato 058');
  await V(null, 'Obra', 'Identificar al contratista de obra, su contrato, valor, pólizas y APU; pedir diseños, licencias y permisos', 'Memoria p005');
  await V(null, 'Supervisión', 'Conocer el nombre del supervisor asignado (Subgerencia de Ejecución de Proyectos)', 'Contrato 058, cláusula décima cuarta');
  await V(null, 'Calidad', 'Entregar el plan de calidad (NTC ISO 9001 / 10005) al firmar el acta de inicio', 'Invitación, Formato 12');
  await V(null, 'Personal', 'Entregar el personal adicional (inspector, topógrafo, ingeniero ambiental) dentro de los 5 días hábiles siguientes al acta de inicio', 'Invitación, numeral 17.2.1');

  const P = async (nombre, cargo, dedicacion, cedula, matricula, telefono, correo, estado = 'Propuesto') =>
    ins('personal', { proyecto_id: p, nombre, cargo, dedicacion, cedula, matricula, telefono, correo, estado });
  await P('Daniela Andrea Jiménez Correa', 'Directora de interventoría', 70, '1.098.817.511', '151037-0568678 STD', '318 504 1618', 'danielaandreajimenez@gmail.com');
  await P('José David Ortiz Bermúdez', 'Residente de interventoría', 100, '1.095.823.544', '68202-408347 STD', '350 342 0854', 'jose_daorbe@hotmail.com');
  await P('Lina Marcela Mendoza Contreras', 'Profesional SISO', 100, '1.096.217.405', '68834-396875 STD', '320 640 2308', null);
  await P('Carol Nataly Villar Herrera', 'Especialista en vías y/o pavimentos', 40, '1.032.481.795', '091037-0562713 CND', '311 238 9668', 'natalyvillar4@gmail.com');
  await P('(por vincular)', 'Inspector de obra', 100, null, null, null, null, 'Por vincular');
  await P('(por vincular)', 'Topógrafo', 100, null, null, null, null, 'Por vincular');
  await P('(por vincular)', 'Ingeniero ambiental', 100, null, null, null, null, 'Por vincular');

  for (const [amparo, vig] of [['Cumplimiento', 'Plazo + 6 meses'], ['Salarios, prestaciones e indemnizaciones', 'Plazo + 3 años'], ['Calidad del servicio', '5 años desde el acta de recibo final']])
    await ins('poliza', { proyecto_id: p, contrato: 'Interventoría 058', amparo, porcentaje: 10, valor: 69999540.38, estado: 'Pendiente', notas: `Vigencia: ${vig}. A favor de E-Desarrollo y del Municipio de Cúcuta (NIT 890.501.434-2)` });
  // Ejemplo de SST con datos ficticios (sin nombres reales): matriz GTC 45, trabajadores y formatos del mes
  const mes = new Date().toISOString().slice(0, 7), dia = n => `${mes}-${String(n).padStart(2, '0')}`;
  for (const [actividad, peligro, clasificacion, nd, ne, nc, intervencion] of [
    ['Excavación de cunetas', 'Derrumbe de paredes de la excavación', 'Condiciones de seguridad', 6, 3, 100, 'Talud o entibado, inspección diaria y permiso de excavación'],
    ['Trabajo en la vía', 'Atropellamiento por vehículos', 'Condiciones de seguridad', 6, 4, 60, 'PMT implementado, paleteros y chaleco reflectivo'],
    ['Corte de concreto', 'Material particulado', 'Químico', 2, 3, 25, 'Corte húmedo y respirador']])
    await ins('sst_peligro', { proyecto_id: p, proceso: 'Construcción', actividad, peligro, clasificacion, nd, ne, nc, np: nd * ne, nr: nd * ne * nc, nivel: nd * ne * nc >= 600 ? 'I' : nd * ne * nc >= 150 ? 'II' : 'III', intervencion, estado: 'Abierto' });
  for (const [i, cargo, grupo] of [[1, 'Residente SST', 'Administrativo'], [2, 'Oficial de obra', 'Operativo'], [3, 'Ayudante de obra', 'Operativo']])
    await ins('sst_trabajador', { proyecto_id: p, nombre: 'Trabajador de ejemplo ' + i, cargo, grupo, eps: 'EPS', afp: 'AFP', arl: 'ARL', ccf: 'Caja', riesgo: 'V', ingreso: dia(1), examen_ingreso: dia(1), induccion: dia(1), notificacion_riesgos: dia(1), estado: 'Activo' });
  await ins('sst_inspeccion', { proyecto_id: p, fecha: dia(5), tipo: 'EPP', frente: 'Frente 1', chequeo: '{"Casco con barbuquejo en buen estado":"C","Botas de seguridad":"C","Chaleco reflectivo en la vía":"NC"}', cumplimiento: 66.67, hallazgos: 'Un trabajador sin chaleco reflectivo', accion: 'Entregar chaleco', estado: 'Cerrado' });
  await ins('sst_permiso', { proyecto_id: p, fecha: dia(6), numero: 'PT-001', tipo: 'Excavación', frente: 'Frente 1', actividad: 'Excavación de cunetas', altura: 1.6, ats: 'Sí', lista_chequeo: 'Sí', rescate: 'No aplica', vigente_hasta: dia(6), estado: 'Cerrado' });
  await ins('sst_capacitacion', { proyecto_id: p, fecha: dia(2), tipo: 'Charla de 5 minutos', tema: 'Uso correcto del EPP', facilitador: 'Residente SST', horas: 0.25, asistentes: 3, estado: 'Realizada' });
  await ins('sst_epp', { proyecto_id: p, fecha: dia(1), trabajador: 'Trabajador de ejemplo 2', elemento: 'Casco con barbuquejo', cantidad: 1, motivo: 'Dotación inicial', firma: 'Sí' });
  for (const i of [1, 2, 3]) await ins('sst_seguridad_social', { proyecto_id: p, mes, trabajador: 'Trabajador de ejemplo ' + i, eps: 'Sí', afp: 'Sí', arl: 'Sí', ccf: 'Sí', verificado: 'Sí' });
  await ins('sst_emergencia', { proyecto_id: p, fecha: dia(10), tipo: 'Botiquín', escenario: 'Campamento', resultado: 'Completo', estado: 'Cerrado' });
  await ins('sst_equipo', { proyecto_id: p, equipo: 'Retroexcavadora', placa: 'EQ-001', modelo: '2018', operador: 'Operador de ejemplo', ultimo_preoperacional: dia(5), estado: 'Operativo' });
  await ins('sst_actividad', { proyecto_id: p, fecha: dia(15), tipo: 'Cronograma SST', actividad: 'Inspección de extintores', responsable: 'Residente SST', estado: 'Ejecutada' });
  await ins('sst_actividad', { proyecto_id: p, fecha: dia(20), tipo: 'Reunión COPASST', actividad: 'Reunión mensual del COPASST', responsable: 'Contratista', estado: 'Ejecutada' });
  await ins('sst_mes', { proyecto_id: p, mes, trabajadores: 3, dias_programados: 78, planillas_ok: 'Sí' });
};
