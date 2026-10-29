-- SIGI - Sistema Integral de Gestión de Interventoría
-- Esquema de la base de datos (SQLite). Se ejecuta en cada arranque: solo crea lo que falta.

CREATE TABLE IF NOT EXISTS proyecto (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  entidad TEXT,
  ubicacion TEXT,
  objeto TEXT,
  carpeta TEXT,            -- carpeta de documentos del proyecto
  memoria TEXT,            -- ruta del memoria_grafo.json
  creado TEXT DEFAULT (date('now'))
);

-- Un proyecto tiene dos contratos: el de obra (vigilado) y el de interventoría (propio)
CREATE TABLE IF NOT EXISTS contrato (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('obra','interventoria')),
  numero TEXT,
  contratante TEXT,
  contratista TEXT,
  nit TEXT,
  representante TEXT,
  objeto TEXT,
  valor REAL DEFAULT 0,
  plazo TEXT,
  fecha_firma TEXT,
  fecha_inicio TEXT,
  fecha_fin TEXT,
  supervisor TEXT,
  aiu_a REAL DEFAULT 0,          -- % administración
  aiu_i REAL DEFAULT 0,          -- % imprevistos
  aiu_u REAL DEFAULT 0,          -- % utilidad
  iva_pct REAL DEFAULT 19,
  iva_base TEXT DEFAULT 'utilidad' CHECK (iva_base IN ('utilidad','total')),
  estampillas_pct REAL DEFAULT 0, -- % sobre el subtotal (interventoría)
  anticipo_pct REAL DEFAULT 0,
  estado TEXT DEFAULT 'Por iniciar',
  notas TEXT
);

-- Presupuesto: capítulos (tipo 0) e ítems (tipo 1)
CREATE TABLE IF NOT EXISTS item (
  id INTEGER PRIMARY KEY,
  contrato_id INTEGER NOT NULL REFERENCES contrato(id) ON DELETE CASCADE,
  padre_id INTEGER REFERENCES item(id) ON DELETE CASCADE,
  tipo INTEGER NOT NULL DEFAULT 1,
  codigo TEXT,
  descripcion TEXT,
  unidad TEXT,
  cantidad REAL DEFAULT 0,
  vr_unitario REAL DEFAULT 0,
  sin_aiu INTEGER DEFAULT 0,      -- 1 = va por fuera del AIU (PMT, PMA...)
  orden INTEGER DEFAULT 0,
  otrosi_id INTEGER,              -- ítem no previsto: otrosí que lo aprobó
  apu TEXT,                       -- análisis de precio unitario (JSON)
  justificacion TEXT              -- justificación técnica de mayores/menores cantidades
);

-- Actas parciales (equivalen a las "estimaciones")
CREATE TABLE IF NOT EXISTS acta (
  id INTEGER PRIMARY KEY,
  contrato_id INTEGER NOT NULL REFERENCES contrato(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  desde TEXT,
  hasta TEXT,
  fecha TEXT,
  estado TEXT DEFAULT 'Borrador',  -- Borrador, Radicada, En revisión, Con observaciones, Aprobada interventoría, Avalada entidad, Pagada
  observaciones TEXT,
  UNIQUE (contrato_id, numero)
);

CREATE TABLE IF NOT EXISTS acta_item (
  acta_id INTEGER NOT NULL REFERENCES acta(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES item(id) ON DELETE CASCADE,
  cant_presentada REAL DEFAULT 0,  -- lo que cobra el contratista
  cant_aprobada REAL DEFAULT 0,    -- lo que aprueba la interventoría
  observacion TEXT,
  PRIMARY KEY (acta_id, item_id)
);

-- Costos reales del contrato propio (interventoría): nómina, arriendo, vehículo, laboratorio...
CREATE TABLE IF NOT EXISTS gasto (
  id INTEGER PRIMARY KEY,
  contrato_id INTEGER NOT NULL REFERENCES contrato(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES item(id) ON DELETE SET NULL,  -- ítem del presupuesto al que se carga
  fecha TEXT,
  descripcion TEXT,
  proveedor TEXT,
  documento TEXT,           -- factura, cuenta de cobro, planilla
  valor REAL DEFAULT 0,
  pagado TEXT DEFAULT 'No'
);

CREATE TABLE IF NOT EXISTS vencimiento (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  fecha TEXT,
  tipo TEXT,
  descripcion TEXT,
  responsable TEXT,
  estado TEXT DEFAULT 'Pendiente',
  fuente TEXT
);

CREATE TABLE IF NOT EXISTS personal (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  nombre TEXT,
  cargo TEXT,
  dedicacion REAL,
  cedula TEXT,
  matricula TEXT,
  telefono TEXT,
  correo TEXT,
  estado TEXT DEFAULT 'Propuesto',
  notas TEXT
);

CREATE TABLE IF NOT EXISTS poliza (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  contrato TEXT,          -- Obra / Interventoría
  aseguradora TEXT,
  numero TEXT,
  amparo TEXT,
  porcentaje REAL,
  valor REAL,
  desde TEXT,
  hasta TEXT,
  estado TEXT DEFAULT 'Pendiente',
  notas TEXT
);

CREATE TABLE IF NOT EXISTS correspondencia (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  fecha TEXT,
  sentido TEXT,           -- Enviada / Recibida
  radicado TEXT,
  de TEXT,
  para TEXT,
  asunto TEXT,
  requiere_respuesta TEXT,
  plazo TEXT,
  estado TEXT DEFAULT 'Abierta',
  archivo TEXT
);

CREATE TABLE IF NOT EXISTS bitacora (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  fecha TEXT,
  clima TEXT,
  frente TEXT,
  actividades TEXT,
  personal_obra INTEGER,
  equipos TEXT,
  observaciones TEXT
);

CREATE TABLE IF NOT EXISTS ensayo (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  fecha TEXT,
  ensayo TEXT,
  norma TEXT,
  item TEXT,
  abscisa TEXT,
  resultado TEXT,
  especificacion TEXT,
  cumple TEXT,
  laboratorio TEXT
);

-- Usuarios de la app (sin contraseña por ahora). Rol: director, residente, especialista, administrativo, entidad
CREATE TABLE IF NOT EXISTS usuario (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'residente',
  correo TEXT,              -- cuenta de Gmail con la que entra
  activo INTEGER DEFAULT 1
);

-- Bitácora de cambios: quién, cuándo, tabla, id y cambio (JSON con antes/después)
CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY,
  fecha TEXT NOT NULL,
  usuario_id INTEGER,
  usuario TEXT,
  tabla TEXT,
  registro_id TEXT,
  accion TEXT,              -- crear, editar, borrar
  cambio TEXT
);

-- Otrosíes y modificaciones: adición de valor y prórroga, con historial
CREATE TABLE IF NOT EXISTS otrosi (
  id INTEGER PRIMARY KEY,
  contrato_id INTEGER NOT NULL REFERENCES contrato(id) ON DELETE CASCADE,
  numero INTEGER,
  fecha TEXT,
  tipo TEXT DEFAULT 'Adición',      -- Adición, Prórroga, Adición y prórroga, Modificación, Suspensión
  valor REAL DEFAULT 0,             -- valor adicionado (con AIU/IVA)
  dias INTEGER DEFAULT 0,           -- días de prórroga
  objeto TEXT,                      -- qué modifica y por qué
  estado TEXT DEFAULT 'Firmado',    -- En trámite, Firmado, Anulado
  polizas_ajustadas TEXT DEFAULT 'No'
);

-- Programa de obra (importado de Microsoft Project)
CREATE TABLE IF NOT EXISTS tarea (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  wbs TEXT,
  nombre TEXT,
  nivel INTEGER DEFAULT 1,
  inicio TEXT,
  fin TEXT,
  avance_real REAL DEFAULT 0,     -- % ejecutado
  resumen INTEGER DEFAULT 0,
  hito INTEGER DEFAULT 0,
  orden INTEGER DEFAULT 0
);

-- Alineamientos del corredor (LandXML de Civil 3D o InfraWorks) y tramos con su avance
CREATE TABLE IF NOT EXISTS alineamiento (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  nombre TEXT,
  abs_ini REAL DEFAULT 0,
  longitud REAL DEFAULT 0,
  puntos TEXT                    -- JSON [[este, norte], ...]
);
CREATE TABLE IF NOT EXISTS tramo (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  alineamiento_id INTEGER REFERENCES alineamiento(id) ON DELETE CASCADE,
  nombre TEXT,
  abs_ini REAL,
  abs_fin REAL,
  actividad TEXT,
  avance REAL DEFAULT 0,          -- % ejecutado
  fecha TEXT,
  notas TEXT
);

-- Seguridad y salud en el trabajo (Decreto 1072 de 2015, Res. 0312 de 2019): inspecciones, permisos, incidentes y accidentes
CREATE TABLE IF NOT EXISTS sst (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  fecha TEXT,
  tipo TEXT,                      -- Inspección, Charla, Permiso de trabajo, Entrega de EPP, Verificación seguridad social, Incidente, Accidente
  frente TEXT,
  descripcion TEXT,
  personas INTEGER,
  dias_incapacidad INTEGER,       -- solo accidentes
  hallazgo TEXT,
  accion TEXT,
  responsable TEXT,
  plazo TEXT,
  estado TEXT DEFAULT 'Abierto'
);
-- Datos mensuales para los indicadores obligatorios (art. 30 Res. 0312)
CREATE TABLE IF NOT EXISTS sst_mes (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  mes TEXT,                       -- AAAA-MM
  trabajadores INTEGER,
  accidentes INTEGER DEFAULT 0,
  accidentes_mortales INTEGER DEFAULT 0,
  dias_incapacidad INTEGER DEFAULT 0,
  dias_cargados INTEGER DEFAULT 0,
  dias_ausencia INTEGER DEFAULT 0,  -- ausentismo por causa médica
  dias_programados INTEGER DEFAULT 0,
  planillas_ok TEXT DEFAULT 'Pendiente', -- verificación PILA / ARL del contratista
  notas TEXT
);

-- Anexos de SST que exige la interventoría (Decreto 1072 de 2015, Res. 0312 de 2019, Res. 4272 de 2021, Res. 1401 de 2007, GTC 45)
-- Matriz de identificación de peligros y valoración de riesgos (GTC 45): NP = ND × NE, NR = NP × NC
CREATE TABLE IF NOT EXISTS sst_peligro (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  proceso TEXT,
  actividad TEXT,
  rutinaria TEXT DEFAULT 'Sí',
  peligro TEXT,
  clasificacion TEXT,             -- Biológico, Físico, Químico, Psicosocial, Biomecánico, Condiciones de seguridad, Fenómenos naturales
  efectos TEXT,
  controles TEXT,                 -- controles existentes (fuente, medio, individuo)
  nd INTEGER,                     -- nivel de deficiencia: 10, 6, 2, 0
  ne INTEGER,                     -- nivel de exposición: 4, 3, 2, 1
  nc INTEGER,                     -- nivel de consecuencia: 100, 60, 25, 10
  np INTEGER,
  nr INTEGER,
  nivel TEXT,                     -- I, II, III, IV
  aceptabilidad TEXT,
  expuestos INTEGER,
  intervencion TEXT,              -- eliminación, sustitución, ingeniería, administrativos, EPP
  responsable TEXT,
  plazo TEXT,
  estado TEXT DEFAULT 'Abierto'
);
-- Inspecciones con lista de chequeo (C cumple / NC no cumple / NA)
CREATE TABLE IF NOT EXISTS sst_inspeccion (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  fecha TEXT,
  tipo TEXT,                      -- EPP, Andamios, Excavaciones, Señalización, Extintores, Botiquín, Herramientas y equipos, Orden y aseo
  frente TEXT,
  inspector TEXT,
  chequeo TEXT,                   -- JSON {pregunta: 'C'|'NC'|'NA'}
  cumplimiento REAL,              -- % de C sobre (C + NC)
  hallazgos TEXT,
  accion TEXT,
  responsable TEXT,
  plazo TEXT,
  estado TEXT DEFAULT 'Abierto'
);
-- Permisos de trabajo de alto riesgo con su análisis de trabajo seguro (ATS)
CREATE TABLE IF NOT EXISTS sst_permiso (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  fecha TEXT,
  numero TEXT,
  tipo TEXT,                      -- Trabajo en alturas, Excavación, Trabajo en caliente, Espacio confinado, Eléctrico, Izaje de cargas
  frente TEXT,
  actividad TEXT,
  altura REAL,                    -- m (alturas) o profundidad (excavación)
  trabajadores TEXT,
  coordinador TEXT,               -- coordinador de trabajo en alturas o persona competente
  emisor TEXT,
  ats TEXT DEFAULT 'No',
  lista_chequeo TEXT DEFAULT 'No',
  rescate TEXT DEFAULT 'No',      -- plan de rescate (Res. 4272 de 2021)
  vigente_hasta TEXT,
  estado TEXT DEFAULT 'Abierto'
);
-- Capacitaciones, inducciones y charlas con asistentes
CREATE TABLE IF NOT EXISTS sst_capacitacion (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  fecha TEXT,
  tipo TEXT,                      -- Inducción, Reinducción, Charla de 5 minutos, Capacitación, Trabajo en alturas, Brigada de emergencias
  tema TEXT,
  facilitador TEXT,
  horas REAL,
  asistentes INTEGER,
  lista TEXT,                     -- nombres de los asistentes (la planilla firmada va como adjunto)
  evaluacion TEXT,
  estado TEXT DEFAULT 'Realizada'
);
-- Trabajadores del contratista: afiliaciones y certificados
CREATE TABLE IF NOT EXISTS sst_trabajador (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  nombre TEXT,
  documento TEXT,
  cargo TEXT,
  eps TEXT,
  afp TEXT,
  arl TEXT,
  grupo TEXT DEFAULT 'Operativo', -- Administrativo, Operativo, Subcontratista
  ccf TEXT,                       -- caja de compensación familiar
  riesgo TEXT,                    -- clase de riesgo ARL I a V (construcción: V)
  ingreso TEXT,
  retiro TEXT,
  examen_ingreso TEXT,            -- fechas de los exámenes médicos ocupacionales
  examen_periodico TEXT,
  examen_retiro TEXT,
  induccion TEXT,
  notificacion_riesgos TEXT,
  paz_salvo TEXT,
  alturas_vence TEXT,             -- vencimiento del certificado de trabajo en alturas
  estado TEXT DEFAULT 'Activo'
);
-- Entrega de elementos de protección personal por trabajador
CREATE TABLE IF NOT EXISTS sst_epp (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  fecha TEXT,
  trabajador TEXT,
  elemento TEXT,
  cantidad INTEGER DEFAULT 1,
  motivo TEXT,                    -- Dotación inicial, Reposición por desgaste, Pérdida
  reposicion TEXT,                -- fecha prevista de reposición
  firma TEXT DEFAULT 'Sí'
);
-- Verificación mensual de aportes a seguridad social (PILA) por trabajador
CREATE TABLE IF NOT EXISTS sst_seguridad_social (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  mes TEXT,                       -- AAAA-MM
  trabajador TEXT,
  planilla TEXT,                  -- número de la planilla PILA
  ibc REAL,
  eps TEXT DEFAULT 'Pendiente',
  afp TEXT DEFAULT 'Pendiente',
  arl TEXT DEFAULT 'Pendiente',
  ccf TEXT DEFAULT 'Pendiente',
  verificado TEXT DEFAULT 'Pendiente',
  observacion TEXT
);
-- Reporte e investigación de incidentes y accidentes (Res. 1401 de 2007: investigar dentro de los 15 días)
CREATE TABLE IF NOT EXISTS sst_investigacion (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  fecha TEXT,                     -- fecha del evento
  tipo TEXT,                      -- Incidente, Accidente leve, Accidente grave, Accidente mortal
  trabajador TEXT,
  frente TEXT,
  descripcion TEXT,
  dias_incapacidad INTEGER,
  reporte_arl TEXT,               -- fecha del FURAT (2 días hábiles)
  investigado TEXT,               -- fecha de la investigación
  causas TEXT,                    -- causas inmediatas y básicas
  acciones TEXT,
  responsable TEXT,
  plazo TEXT,
  estado TEXT DEFAULT 'Abierto'
);
-- Plan de emergencias, brigada y simulacros
CREATE TABLE IF NOT EXISTS sst_emergencia (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  fecha TEXT,
  tipo TEXT,                      -- Plan de emergencias, Simulacro, Brigada, Botiquín, Extintores, Punto de encuentro
  escenario TEXT,
  participantes INTEGER,
  tiempo TEXT,                    -- tiempo de respuesta o evacuación
  resultado TEXT,
  mejoras TEXT,
  proxima TEXT,                   -- próxima revisión o simulacro
  estado TEXT DEFAULT 'Abierto'
);

-- Maquinaria y vehículos: documentos e inspección preoperacional
CREATE TABLE IF NOT EXISTS sst_equipo (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  equipo TEXT,
  placa TEXT,
  modelo TEXT,
  operador TEXT,
  licencia TEXT,                  -- vencimiento de la licencia de conducción
  tecnomecanica TEXT,
  soat TEXT,
  ultimo_preoperacional TEXT,
  estado TEXT DEFAULT 'Operativo'
);
-- Cronograma del plan de trabajo SST, reuniones COPASST / COCOLA y obligaciones contractuales
CREATE TABLE IF NOT EXISTS sst_actividad (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  fecha TEXT,
  tipo TEXT,                      -- Cronograma SST, Reunión COPASST, Reunión COCOLA, Obligación contractual
  actividad TEXT,
  responsable TEXT,
  estado TEXT DEFAULT 'Programada',
  observacion TEXT
);
-- Soportes mensuales del informe SST (anexos 1 a 22); el archivo va como adjunto del registro
CREATE TABLE IF NOT EXISTS sst_documento (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  mes TEXT,
  anexo TEXT,                     -- "N. nombre del anexo"
  descripcion TEXT,
  estado TEXT DEFAULT 'Cargado'
);

-- Control ambiental: seguimiento a las fichas del PAGA o del PMA
CREATE TABLE IF NOT EXISTS ambiental (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  fecha TEXT,
  programa TEXT,                  -- Gestión institucional, Actividades constructivas, Gestión hídrica, Biótico, Maquinaria y transporte, SST, Gestión social
  ficha TEXT,                     -- código de la ficha en el PAGA/PMA del proyecto
  actividad TEXT,
  indicador TEXT,
  meta REAL,
  logro REAL,
  cantidad REAL,                  -- p. ej. m³ de RCD, árboles talados
  unidad TEXT,
  permiso TEXT,                   -- aprovechamiento forestal, ocupación de cauce, vertimientos, sitio de disposición
  hallazgo TEXT,
  accion TEXT,
  plazo TEXT,
  estado TEXT DEFAULT 'Abierto'
);

-- Plan de Manejo de Tránsito por frente de obra
CREATE TABLE IF NOT EXISTS pmt (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  frente TEXT,
  abs_ini TEXT,
  abs_fin TEXT,
  cierre TEXT,                    -- Total, Parcial, Por carril, Nocturno
  interferencia TEXT,             -- Baja, Media, Alta
  radicado TEXT,                  -- aprobación de la secretaría de tránsito
  aprobado TEXT,                  -- fecha de aprobación
  desde TEXT,
  hasta TEXT,                     -- vigencia
  dispositivos TEXT,              -- señales, conos, barricadas, canalizadores, paleteros
  ultima_inspeccion TEXT,
  cumple TEXT DEFAULT 'Pendiente',
  estado TEXT DEFAULT 'En trámite',
  notas TEXT
);

-- Anexos ambientales (Guía de Manejo Ambiental de Proyectos de Infraestructura del INVÍAS, PAGA del contrato)
-- Catálogo de fichas del PAGA con su indicador, meta y periodicidad
CREATE TABLE IF NOT EXISTS amb_ficha (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  programa TEXT,
  codigo TEXT,                    -- p. ej. PAC-2.1, PGH-3.1
  nombre TEXT,
  indicador TEXT,
  meta REAL,
  unidad TEXT,
  periodicidad TEXT,              -- Diaria, Semanal, Mensual, Trimestral, Única
  responsable TEXT,
  presupuesto REAL,               -- presupuesto PAGA programado de la ficha
  ejecutado REAL,                 -- ejecutado acumulado
  notas TEXT                      -- avances y modificaciones de la ficha en el PAGA
);

-- Matriz de requisitos legales ambientales
CREATE TABLE IF NOT EXISTS amb_requisito (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  norma TEXT,
  emisor TEXT,
  lineamiento TEXT,
  ficha TEXT,
  cumple TEXT DEFAULT 'Pendiente',
  evidencia TEXT
);

-- Permisos ambientales y fuentes de materiales (Decreto 1076 de 2015; Ley 685 de 2001)
CREATE TABLE IF NOT EXISTS amb_permiso (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  tipo TEXT,                      -- Aprovechamiento forestal, Ocupación de cauce, Concesión de aguas, Vertimientos, Fuente de materiales, Sitio de disposición de RCD, Emisiones atmosféricas
  autoridad TEXT,                 -- CAR o autoridad ambiental
  acto TEXT,                      -- resolución o auto
  fecha TEXT,
  vence TEXT,
  titular TEXT,
  titulo_minero TEXT,             -- fuentes de materiales: título minero o RUCOM
  autorizado TEXT,                -- caudal, volumen o individuos autorizados
  obligaciones TEXT,
  estado TEXT DEFAULT 'En trámite'
);

-- Residuos de construcción y demolición (Res. 1257 de 2021)
CREATE TABLE IF NOT EXISTS rcd (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  fecha TEXT,
  frente TEXT,
  tipo TEXT,                      -- Aprovechable, No aprovechable, Peligroso
  generado REAL,
  aprovechado REAL,
  dispuesto REAL,
  unidad TEXT DEFAULT 't',
  sitio TEXT,                     -- gestor, punto limpio o sitio de disposición final autorizado
  certificado TEXT,               -- certificado o manifiesto del gestor
  notas TEXT
);

-- Inventario forestal y compensación
CREATE TABLE IF NOT EXISTS forestal (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  fecha TEXT,
  codigo TEXT,
  especie TEXT,
  nombre_comun TEXT,
  abscisa TEXT,
  dap REAL,                       -- diámetro a la altura del pecho, cm
  altura REAL,
  volumen REAL,                   -- m³
  tratamiento TEXT,               -- Conservar, Poda, Tala, Bloqueo y traslado
  permiso TEXT,
  compensar REAL,                 -- individuos a sembrar
  sembrados REAL,
  estado TEXT DEFAULT 'Inventariado'
);

-- Consumo de agua por fuente
CREATE TABLE IF NOT EXISTS agua (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  fecha TEXT,
  fuente TEXT,
  uso TEXT,
  volumen REAL,                   -- m³
  permiso TEXT,
  notas TEXT
);

-- Maquinaria y vehículos: mantenimiento, emisiones y aceites usados
CREATE TABLE IF NOT EXISTS maquinaria (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  equipo TEXT,
  placa TEXT,
  ultimo_mtto TEXT,
  proximo_mtto TEXT,
  emisiones TEXT,                 -- certificado de revisión técnico-mecánica y de emisiones
  vence_emisiones TEXT,
  aceite REAL,                    -- galones de aceite usado entregados
  gestor_aceite TEXT,
  cumple TEXT DEFAULT 'Pendiente',
  notas TEXT
);

-- Monitoreos ambientales (ruido, aire, agua)
CREATE TABLE IF NOT EXISTS monitoreo (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  fecha TEXT,
  tipo TEXT,
  punto TEXT,
  parametro TEXT,
  resultado REAL,
  limite REAL,
  unidad TEXT,
  norma TEXT,
  laboratorio TEXT,
  cumple TEXT DEFAULT 'Pendiente'
);

-- Lista de chequeo ambiental de obra
CREATE TABLE IF NOT EXISTS amb_chequeo (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  fecha TEXT,
  frente TEXT,
  aspecto TEXT,
  cumple TEXT DEFAULT 'Sí',
  observacion TEXT,
  accion TEXT,
  plazo TEXT,
  estado TEXT DEFAULT 'Abierto'
);

-- Inspecciones al PMT y estado de los dispositivos (Manual de Señalización Vial, cap. 4)
CREATE TABLE IF NOT EXISTS pmt_inspeccion (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  fecha TEXT,
  frente TEXT,
  dispositivo TEXT,
  requeridos REAL,
  instalados REAL,
  condicion TEXT,                 -- Buena, Regular, Mala
  cumple TEXT DEFAULT 'Sí',
  observacion TEXT,
  accion TEXT
);

-- Gestión social: fichas del PGS (atención a la comunidad, divulgación, predios, mano de obra local, cultura vial)
CREATE TABLE IF NOT EXISTS social (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  fecha TEXT,
  ficha TEXT,
  tipo TEXT,                      -- PQRS, Reunión de inicio/avance/finalización, Socialización, Acta de vecindad, Mano de obra local, Cultura vial, Visita
  comunidad TEXT,
  descripcion TEXT,
  asistentes INTEGER,
  responsable TEXT,
  respuesta TEXT,
  plazo TEXT,                     -- PQRS: 15 días hábiles (Ley 1755 de 2015)
  estado TEXT DEFAULT 'Abierto'
);

CREATE TABLE IF NOT EXISTS suspension (
  id INTEGER PRIMARY KEY,
  contrato_id INTEGER NOT NULL REFERENCES contrato(id) ON DELETE CASCADE,
  numero INTEGER,
  fecha_suspension TEXT,
  fecha_reinicio TEXT,              -- vacía mientras siga suspendido
  motivo TEXT,
  acta TEXT,                        -- número o referencia del acta de suspensión
  estado TEXT DEFAULT 'Suspendido', -- Suspendido, Reiniciado
  polizas_ajustadas TEXT DEFAULT 'No'
);

CREATE TABLE IF NOT EXISTS liquidacion (
  id INTEGER PRIMARY KEY,
  contrato_id INTEGER NOT NULL UNIQUE REFERENCES contrato(id) ON DELETE CASCADE,
  tipo TEXT DEFAULT 'Bilateral',    -- Bilateral, Unilateral, Judicial
  fecha_recibo_final TEXT,
  fecha_liquidacion TEXT,
  valor_ejecutado REAL DEFAULT 0,
  saldo_a_favor_contratista REAL DEFAULT 0,
  saldo_a_favor_entidad REAL DEFAULT 0,
  devolucion_retenciones REAL DEFAULT 0,
  paz_y_salvos TEXT,
  observaciones TEXT,
  estado TEXT DEFAULT 'En trámite'  -- En trámite, Firmada, Cerrada
);

-- Cantidades que cada otrosí suma (+) o resta (−) a un ítem del presupuesto
CREATE TABLE IF NOT EXISTS otrosi_item (
  id INTEGER PRIMARY KEY,
  otrosi_id INTEGER NOT NULL REFERENCES otrosi(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES item(id) ON DELETE CASCADE,
  cantidad REAL DEFAULT 0,
  vr_unitario REAL                  -- opcional, para ítems nuevos
);

-- Archivos adjuntos y registro fotográfico de cualquier registro (póliza, acta, otrosí, SST...)
-- El contenido va aparte (adjunto_dato) para que las listas carguen rápido; ambos se sincronizan con Turso
CREATE TABLE IF NOT EXISTS adjunto (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  tabla TEXT,                     -- a qué pertenece: poliza, acta, otrosi... o 'proyecto' para el registro general
  registro_id INTEGER,
  categoria TEXT DEFAULT 'Documento', -- Documento, Foto
  nombre TEXT,
  tipo_mime TEXT,
  tamano INTEGER,
  fecha TEXT,
  frente TEXT,
  abscisa TEXT,
  punto TEXT,                     -- punto fijo de toma (fotos comparables en el tiempo)
  descripcion TEXT,
  lat REAL,
  lon REAL,
  usuario TEXT,
  creado TEXT
);
CREATE TABLE IF NOT EXISTS adjunto_dato (
  adjunto_id INTEGER PRIMARY KEY REFERENCES adjunto(id) ON DELETE CASCADE,
  datos BLOB
);

-- Captura de avance en campo: memoria de cantidades por abscisa con registro fotográfico.
-- La cantidad entra sola a la cantidad presentada del acta en borrador del periodo.
CREATE TABLE IF NOT EXISTS avance (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  contrato_id INTEGER REFERENCES contrato(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES item(id) ON DELETE CASCADE,
  fecha TEXT,
  frente TEXT,
  abs_ini REAL,                   -- metros
  abs_fin REAL,
  largo REAL, ancho REAL, espesor REAL, piezas REAL,
  cantidad REAL DEFAULT 0,
  descripcion TEXT,
  estado TEXT DEFAULT 'Reportado', -- Reportado, Verificado, Rechazado
  acta_id INTEGER,                 -- acta a la que se sumó
  usuario TEXT,
  lat REAL, lon REAL
);

-- Lista de chequeo documental de cada acta (hoja de ruta, punto 9)
CREATE TABLE IF NOT EXISTS acta_requisito (
  id INTEGER PRIMARY KEY,
  acta_id INTEGER NOT NULL REFERENCES acta(id) ON DELETE CASCADE,
  orden INTEGER DEFAULT 0,
  requisito TEXT NOT NULL,
  obligatorio INTEGER DEFAULT 1,
  estado TEXT DEFAULT 'Pendiente',  -- Pendiente, Cumple, No cumple, No aplica
  referencia TEXT,                  -- radicado, folio o enlace de SECOP II
  observacion TEXT
);

-- Requisiciones (RQ): pedidos internos de bienes o servicios, con aprobación del director
CREATE TABLE IF NOT EXISTS requisicion (
  id INTEGER PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  contrato_id INTEGER REFERENCES contrato(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  fecha TEXT,
  solicitante TEXT,
  frente TEXT,
  justificacion TEXT,
  estado TEXT DEFAULT 'Borrador',   -- Borrador, Solicitada, Aprobada, Rechazada, Atendida
  aprobado_por TEXT,
  fecha_aprobacion TEXT,
  motivo_rechazo TEXT,
  proveedor TEXT,
  documento TEXT,                   -- factura u orden con que se atendió
  fecha_atencion TEXT,
  gasto_id INTEGER                  -- gasto creado al atenderla (contrato de interventoría)
);
CREATE TABLE IF NOT EXISTS requisicion_item (
  id INTEGER PRIMARY KEY,
  requisicion_id INTEGER NOT NULL REFERENCES requisicion(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES item(id) ON DELETE SET NULL,
  descripcion TEXT,
  unidad TEXT,
  cantidad REAL DEFAULT 0,
  vr_unitario REAL DEFAULT 0
);
