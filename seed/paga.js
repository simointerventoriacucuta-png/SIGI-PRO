// SIGI Pro - catálogo de fichas del PAGA (Guía de Manejo Ambiental de Proyectos de Infraestructura, modo carretero,
// INVÍAS 2022, adoptada por la Resolución 2335 del 7 de julio de 2022) y matriz de requisitos legales ambientales.
// Los nombres marcados "(verificar)" no se pudieron confirmar en fuentes públicas: ajústelos con el PAGA aprobado del contrato.
// Los programas 6 a 10 son de gestión social: su seguimiento se registra en "Gestión social" usando el mismo código de ficha.
const P = ['1. Desarrollo y aplicación de la gestión ambiental (DAGA)', '2. Actividades constructivas (PAC)', '3. Gestión hídrica (PGH)', '4. Biótico y servicios ecosistémicos (PBSE)',
  '5. Manejo de instalaciones temporales, maquinaria y equipos (PMIT)', '6. Desarrollo local (PDL)', '7. Patrimonio (PPSI)', '8. Predios y servicios (PGS)', '9. Accesibilidad (PA)', '10. Participación, gobernanza e inclusión (PPGI)'];

const FICHAS = [
  [0, 'DAGA-1.1-01', 'Conformación del grupo de gestión social y ambiental', 'Personal ambiental y social vinculado / requerido', 100, '%', 'Mensual'],
  [0, 'DAGA-1.2-02', 'Capacitación y concientización del personal de obra', 'Personas capacitadas / personal de obra', 100, '%', 'Mensual'],
  [0, 'DAGA-1.3-03', 'Cumplimiento de requisitos legales', 'Requisitos cumplidos / requisitos aplicables', 100, '%', 'Mensual'],
  [1, 'PAC-2.1-04', 'Manejo integral de materiales de construcción', 'Acopios cubiertos y demarcados / acopios', 100, '%', 'Semanal'],
  [1, 'PAC-2.2-05', 'Explotación de fuentes de materiales', 'Fuentes con título minero y licencia ambiental / fuentes usadas', 100, '%', 'Mensual'],
  [1, 'PAC-2.3-06', 'Señalización de frentes de obra y sitios temporales', 'Frentes señalizados / frentes activos', 100, '%', 'Semanal'],
  [1, 'PAC-2.4-07', 'Manejo de residuos de construcción y demolición (RCD)', 'RCD aprovechado o dispuesto en sitio autorizado / RCD generado', 100, '%', 'Mensual'],
  [1, 'PAC-2.5-08', 'Manejo de residuos sólidos convencionales y especiales', 'Residuos entregados a gestor autorizado / generados', 100, '%', 'Mensual'],
  [1, 'PAC-2.6-09', 'Ficha 09 del programa de actividades constructivas (verificar)', '', null, '', 'Mensual'],
  [2, 'PGH-3.1-10', 'Manejo de aguas superficiales', 'Cuerpos de agua protegidos / cuerpos de agua intervenidos', 100, '%', 'Mensual'],
  [2, 'PGH-3.2-11', 'Manejo de residuos líquidos domésticos e industriales', 'Baterías sanitarias con mantenimiento / instaladas', 100, '%', 'Semanal'],
  [3, 'PBSE-4.1-12', 'Manejo de remoción de cobertura vegetal y descapote', 'Área descapotada autorizada / área descapotada', 100, '%', 'Mensual'],
  [3, 'PBSE-4.2-13', 'Recuperación de áreas afectadas', 'Área recuperada / área afectada', 100, '%', 'Mensual'],
  [3, 'PBSE-4.3-14', 'Protección de ecosistemas estratégicos', 'Ecosistemas sin afectación / ecosistemas en el área', 100, '%', 'Mensual'],
  [3, 'PBSE-4.4-15', 'Protocolos de manejo de fauna en obra', 'Individuos rescatados y reubicados / avistados', 100, '%', 'Mensual'],
  [3, 'PBSE-4.5-16', 'Protección de fauna en vías', 'Pasos o señales de fauna instalados / programados', 100, '%', 'Trimestral'],
  [3, 'PBSE-4.6-17', 'Compensación ambiental', 'Individuos sembrados / individuos a compensar', 100, '%', 'Trimestral'],
  [4, 'PMIT-5.1-18', 'Instalación, funcionamiento y desmantelamiento de campamentos y sitios de acopio', 'Instalaciones conformes / instalaciones', 100, '%', 'Mensual'],
  [4, 'PMIT-5.2-19', 'Instalación, funcionamiento y desmantelamiento de plantas de trituración, asfalto y concreto (verificar)', '', null, '', 'Mensual'],
  [4, 'PMIT-5.3-20', 'Manejo de maquinaria, equipos y vehículos', 'Equipos con mantenimiento y certificado de emisiones al día / equipos', 100, '%', 'Mensual'],
  [5, 'PDL-6.1-21', 'Vinculación de mano de obra con enfoque de género, derechos y diferencial', 'Mano de obra local vinculada / total', null, '%', 'Mensual'],
  [5, 'PDL-6.2-22', 'Obras de participación comunitaria', '', null, '', 'Mensual'],
  [5, 'PDL-6.3-23', 'Ficha 23 del programa de desarrollo local (verificar)', '', null, '', 'Mensual'],
  [6, 'PPSI-7.1-24', 'Patrimonio arqueológico (verificar)', '', null, '', 'Mensual'],
  [6, 'PPSI-7.2-25', 'Patrimonio cultural', '', null, '', 'Mensual'],
  [6, 'PPSI-7.3-26', 'Patrimonio geológico y paleontológico', '', null, '', 'Mensual'],
  [6, 'PPSI-7.4-27', 'Consulta previa con comunidades étnicas', '', null, '', 'Única'],
  [7, 'PGS-8.1-28', 'Infraestructura de predios y de servicios públicos', 'Actas de vecindad levantadas / predios aledaños', 100, '%', 'Mensual'],
  [7, 'PGS-8.2-29', 'Gestión interinstitucional', '', null, '', 'Mensual'],
  [7, 'PGS-8.3-30', 'Gestión socio predial', '', null, '', 'Mensual'],
  [8, 'PA-9.1-31', 'Accesibilidad (verificar)', 'Accesos peatonales y vehiculares garantizados / afectados', 100, '%', 'Semanal'],
  [9, 'PPGI-10.1-32', 'Atención a la comunidad', 'PQRS respondidas a tiempo / recibidas', 100, '%', 'Mensual'],
  [9, 'PPGI-10.2-33', 'Información y divulgación', 'Reuniones realizadas / programadas', 100, '%', 'Mensual'],
  [9, 'PPGI-10.3-34', 'Cultura vial y participación comunitaria', 'Talleres realizados / programados', 100, '%', 'Trimestral'],
  [9, 'PPGI-10.4-35', 'Inclusión social con perspectiva de género', '', null, '', 'Trimestral'],
  [9, 'PPG-10.5-36', 'Gobernanza', '', null, '', 'Trimestral'],
];

// [norma, quién la emite, lineamiento, ficha relacionada]
const REQUISITOS = [
  ['Decreto 1076 de 2015', 'Ministerio de Ambiente', 'Decreto único del sector ambiente: aprovechamiento forestal, concesión de aguas, ocupación de cauce y vertimientos.', 'DAGA-1.3-03'],
  ['Resolución 2335 de 2022', 'INVÍAS', 'Adopta la Guía de Manejo Ambiental de Proyectos de Infraestructura, modo carretero (PAGA).', 'DAGA-1.3-03'],
  ['Resolución 1257 de 2021', 'Ministerio de Ambiente', 'Gestión integral de RCD: programa de manejo, metas de aprovechamiento y entrega a gestores o sitios autorizados.', 'PAC-2.4-07'],
  ['Ley 685 de 2001 (Código de Minas)', 'Congreso de la República', 'Materiales de construcción solo de fuentes con título minero y licencia ambiental.', 'PAC-2.2-05'],
  ['Resolución 762 de 2022', 'Ministerio de Ambiente', 'Límites de emisión de fuentes móviles terrestres, incluida la maquinaria fuera de carretera.', 'PMIT-5.3-20'],
  ['Resolución 1188 de 2003 / manual de aceites usados', 'Autoridad ambiental (Bogotá D. C.) y CAR', 'Almacenamiento y entrega de aceites usados a acopiadores y movilizadores registrados.', 'PMIT-5.3-20'],
  ['Resolución 627 de 2006', 'Ministerio de Ambiente', 'Estándares de emisión de ruido y ruido ambiental, diurno y nocturno.', 'PAC-2.1-04'],
  ['Resolución 2254 de 2017', 'Ministerio de Ambiente', 'Norma de calidad del aire ambiente (PM10, PM2.5).', 'PAC-2.1-04'],
  ['Resolución 1885 de 2015', 'Ministerio de Transporte', 'Manual de Señalización Vial; capítulo 4: señalización de obras y planes de manejo de tránsito.', 'PAC-2.3-06'],
  ['Ley 1185 de 2008', 'Congreso de la República', 'Protección del patrimonio cultural y arqueológico (ICANH).', 'PPSI-7.1-24'],
];

async function cargarPaga(db, pid) {
  let fichas = 0, requisitos = 0;
  if (!(await db.get('SELECT COUNT(*) n FROM amb_ficha WHERE proyecto_id = ?', pid)).n)
    for (const [i, codigo, nombre, indicador, meta, unidad, periodicidad] of FICHAS) {
      await db.run('INSERT INTO amb_ficha (proyecto_id, programa, codigo, nombre, indicador, meta, unidad, periodicidad) VALUES (?,?,?,?,?,?,?,?)', pid, P[i], codigo, nombre, indicador || null, meta, unidad || null, periodicidad);
      fichas++;
    }
  if (!(await db.get('SELECT COUNT(*) n FROM amb_requisito WHERE proyecto_id = ?', pid)).n)
    for (const r of REQUISITOS) { await db.run('INSERT INTO amb_requisito (proyecto_id, norma, emisor, lineamiento, ficha) VALUES (?,?,?,?,?)', pid, ...r); requisitos++; }
  return { fichas, requisitos };
}

module.exports = { PROGRAMAS: P, FICHAS, REQUISITOS, cargarPaga };
