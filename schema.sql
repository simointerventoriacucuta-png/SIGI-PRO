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
  orden INTEGER DEFAULT 0
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
