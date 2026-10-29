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
