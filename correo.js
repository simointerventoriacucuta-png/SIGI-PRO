// SIGI Pro - lectura de correos de Gmail por IMAP (imap.gmail.com:993, TLS) con contraseña de aplicación.
// La configuración (incluida la contraseña) se guarda SOLO en este equipo: datos/correo.json.
// Cada correo nuevo crea un registro en correspondencia y sus adjuntos van a la tabla adjunto.
const fs = require('node:fs');
const path = require('node:path');

const USUARIO_AUTO = { id: null, nombre: 'Gmail', rol: 'automático' }; // en auditoría: "Gmail (automático)"
const POR_DEFECTO = { correo: '', clave: '', carpeta: 'INBOX', filtro_de: '', filtro_asunto: '', minutos: 15, marcar_leido: false, activo: true, proyecto_id: null, ultimo_uid: 0, uidvalidity: null };

// Radicado en el asunto: "Rad. 2026-001234", "Radicado No. ABC-123", "Oficio N° 456"
function radicadoDe(asunto) {
  const m = String(asunto || '').match(/\b(?:rad(?:icado)?|oficio)\.?\s*(?:n[o°º.]*\.?\s*)?[:#]?\s*([A-Z0-9][A-Z0-9\-\/.]{2,})/i);
  return m ? m[1].replace(/[.\-\/]+$/, '') : null;
}
// Suma días hábiles (lunes a viernes; no descuenta festivos de Colombia)
function diasHabiles(desde, n) {
  const d = new Date(desde + 'T00:00:00Z');
  let k = 0;
  while (k < n) { d.setUTCDate(d.getUTCDate() + 1); const s = d.getUTCDay(); if (s !== 0 && s !== 6) k++; }
  return d.toISOString().slice(0, 10);
}
const seguro = s => String(s || 'adjunto').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 120);

// Análisis con Gemini (API REST generateContent). Devuelve { resumen, requiere_respuesta, dias_habiles, vencimientos: [{fecha|dias_habiles, descripcion, tipo}] }
async function analizarGemini(clave, c) {
  const texto = `Eres asistente de una interventoría de obras viales en Colombia. Lee este correo y responde SOLO JSON con:
{"resumen": "máx. 3 frases", "requiere_respuesta": true|false, "dias_habiles": número de días hábiles para responder o null,
 "vencimientos": [{"descripcion": "...", "tipo": "Respuesta|Entrega|Visita|Pago|Póliza|Otro", "fecha": "AAAA-MM-DD" o null, "dias_habiles": número o null}]}
Si el correo no fija plazo pero es un derecho de petición, usa 15 días hábiles (Ley 1755 de 2015). No inventes fechas.
Fecha del correo: ${c.fecha}
De: ${c.de}
Asunto: ${c.asunto}
Cuerpo:
${String(c.texto || '').slice(0, 12000)}`;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: texto }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }),
  });
  if (!r.ok) throw new Error('Gemini respondió ' + r.status);
  const d = await r.json();
  return JSON.parse(d.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '{}');
}

function crearCorreo({ db, datos, auditar, claveIA, crearCliente, analizar }) {
  const ARCHIVO = path.join(datos, 'correo.json');
  const estado = { revisando: false, ultima: null, nuevos: 0, error: null, timer: null };

  const leer = () => { try { return { ...POR_DEFECTO, ...JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')) }; } catch { return { ...POR_DEFECTO }; } };
  const escribir = cfg => fs.writeFileSync(ARCHIVO, JSON.stringify(cfg, null, 2));
  // Lo que se puede mostrar en la interfaz: nunca la contraseña
  const publica = () => { const c = leer(); const { clave, ...resto } = c; return { ...resto, tiene_clave: !!clave, estado: { ultima: estado.ultima, ultima_importacion: estado.ultima_importacion || null, nuevos: estado.nuevos, error: estado.error, revisando: estado.revisando } }; };

  const nuevoCliente = crearCliente || (cfg => {
    const { ImapFlow } = require('imapflow');
    return new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: cfg.correo, pass: String(cfg.clave).replace(/\s+/g, '') }, logger: false });
  });

  async function probar(cfg) {
    const c = nuevoCliente(cfg);
    await c.connect();
    try { const st = await c.status(cfg.carpeta || 'INBOX', { messages: true, unseen: true }); return { ok: true, mensajes: st.messages, sin_leer: st.unseen }; }
    finally { await c.logout().catch(() => {}); }
  }

  // Guarda un correo ya interpretado (formato de mailparser). Devuelve el id o null si ya existía.
  async function registrar(cfg, m, uid) {
    const mid = m.messageId || `uid-${cfg.uidvalidity}-${uid}@${cfg.correo}`;
    if (await db.get('SELECT id FROM correspondencia WHERE message_id = ?', mid)) return null;
    const fecha = (m.date ? new Date(m.date) : new Date()).toISOString().slice(0, 10);
    const de = m.from?.text || '', para = m.to?.text || '', asunto = m.subject || '(sin asunto)';
    const r = await db.run(`INSERT INTO correspondencia (proyecto_id, fecha, sentido, radicado, de, para, asunto, estado, origen, message_id) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      cfg.proyecto_id, fecha, 'Recibida', radicadoDe(asunto), de, para, asunto, 'Abierta', 'Gmail', mid);
    const adj = [];
    const dir = path.join(datos, 'adjuntos', 'correspondencia', String(r.id));
    for (const a of m.attachments || []) {
      if (a.related) continue; // imágenes incrustadas en el cuerpo
      fs.mkdirSync(dir, { recursive: true });
      let nombre = seguro(a.filename), k = 1;
      while (fs.existsSync(path.join(dir, nombre))) nombre = `${k++}_${seguro(a.filename)}`;
      fs.writeFileSync(path.join(dir, nombre), a.content);
      await db.run('INSERT INTO adjunto (tabla, registro_id, nombre, tipo, tamano, ruta, fecha) VALUES (?,?,?,?,?,?,?)',
        'correspondencia', r.id, nombre, a.contentType || null, a.size || a.content?.length || 0, path.relative(datos, path.join(dir, nombre)), new Date().toISOString());
      adj.push(nombre);
    }
    if (adj.length) await db.run('UPDATE correspondencia SET archivo = ? WHERE id = ?', adj.join(', '), r.id);
    await auditar(USUARIO_AUTO, 'correspondencia', r.id, 'importar', { message_id: mid, de, asunto, adjuntos: adj });
    // IA: solo sugerencias; los vencimientos se crean cuando el usuario confirma
    const clave = claveIA();
    if (clave || analizar) {
      try {
        const s = await (analizar || analizarGemini)(clave, { fecha, de, asunto, texto: m.text || '' });
        const venc = (s.vencimientos || []).map(v => ({ descripcion: String(v.descripcion || asunto), tipo: v.tipo || 'Respuesta', fecha: v.fecha || (v.dias_habiles ? diasHabiles(fecha, Number(v.dias_habiles)) : null) }));
        const resp = s.requiere_respuesta ? 'Sí' : 'No';
        const plazo = s.requiere_respuesta && s.dias_habiles ? diasHabiles(fecha, Number(s.dias_habiles)) : null;
        await db.run('UPDATE correspondencia SET resumen_ia = ?, vencimientos_ia = ?, requiere_respuesta = ?, plazo = ? WHERE id = ?',
          String(s.resumen || ''), venc.length ? JSON.stringify(venc) : null, resp, plazo, r.id);
      } catch (e) { console.error('IA del correo:', e.message); }
    }
    return r.id;
  }

  // Revisa los correos nuevos desde el último UID procesado. `cliente` permite inyectar uno simulado en pruebas.
  async function revisar() {
    if (estado.revisando) return { ok: false, error: 'Ya se está revisando' };
    const cfg = leer();
    if (!cfg.correo || !cfg.clave) return { ok: false, error: 'Correo sin configurar' };
    if (!cfg.proyecto_id) cfg.proyecto_id = (await db.get('SELECT id FROM proyecto ORDER BY id LIMIT 1'))?.id;
    if (!cfg.proyecto_id) return { ok: false, error: 'No hay proyecto' };
    estado.revisando = true;
    const { simpleParser } = require('mailparser');
    const c = nuevoCliente(cfg);
    const creados = [];
    try {
      await c.connect();
      const lock = await c.getMailboxLock(cfg.carpeta || 'INBOX');
      try {
        const uv = String(c.mailbox?.uidValidity ?? '');
        if (cfg.uidvalidity && cfg.uidvalidity !== uv) cfg.ultimo_uid = 0; // la carpeta se recreó: el Message-ID evita duplicados
        cfg.uidvalidity = uv;
        const criterio = { uid: `${(Number(cfg.ultimo_uid) || 0) + 1}:*` };
        if (cfg.filtro_de) criterio.from = cfg.filtro_de;
        if (cfg.filtro_asunto) criterio.subject = cfg.filtro_asunto;
        const uids = ((await c.search(criterio, { uid: true })) || []).filter(x => x > (Number(cfg.ultimo_uid) || 0)).sort((a, b) => a - b);
        for (const uid of uids) {
          const msg = await c.fetchOne(String(uid), { source: true }, { uid: true }); // fetch no marca como leído (BODY.PEEK)
          const id = await registrar(cfg, await simpleParser(msg.source), uid);
          if (id) creados.push(id);
          if (cfg.marcar_leido) await c.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
          cfg.ultimo_uid = uid;
        }
        // si no hubo coincidencias, avanzar el puntero al último UID de la carpeta para no repetir búsquedas
        const sig = Number(c.mailbox?.uidNext) - 1;
        if (sig > cfg.ultimo_uid) cfg.ultimo_uid = sig;
      } finally { lock.release(); }
      const actual = leer(); escribir({ ...actual, ultimo_uid: cfg.ultimo_uid, uidvalidity: cfg.uidvalidity, proyecto_id: actual.proyecto_id || cfg.proyecto_id });
      estado.error = null;
      if (creados.length) { estado.nuevos = creados.length; estado.ultima_importacion = new Date().toISOString(); }
      return { ok: true, nuevos: creados.length, ids: creados };
    } catch (e) {
      estado.error = /auth|credentials|Invalid/i.test(e.responseText || e.message) ? 'Gmail rechazó el usuario o la contraseña de aplicación' : e.message;
      return { ok: false, error: estado.error };
    } finally {
      estado.revisando = false; estado.ultima = new Date().toISOString();
      await c.logout().catch(() => {});
    }
  }

  function programar() {
    if (estado.timer) clearInterval(estado.timer);
    estado.timer = null;
    const cfg = leer();
    if (!cfg.activo || !cfg.correo || !cfg.clave) return;
    const min = Math.max(1, Number(cfg.minutos) || 15);
    estado.timer = setInterval(() => revisar().catch(e => (estado.error = e.message)), min * 60000);
    estado.timer.unref?.();
    setTimeout(() => revisar().catch(() => {}), 5000).unref?.();
  }

  function guardar(b) {
    const cfg = leer();
    for (const k of ['correo', 'carpeta', 'filtro_de', 'filtro_asunto']) if (b[k] != null) cfg[k] = String(b[k]).trim();
    if (b.clave) cfg.clave = String(b.clave).replace(/\s+/g, ''); // si viene vacía se conserva la guardada
    if (b.minutos != null) cfg.minutos = Math.max(1, Number(b.minutos) || 15);
    if (b.marcar_leido != null) cfg.marcar_leido = !!b.marcar_leido;
    if (b.activo != null) cfg.activo = !!b.activo;
    if (b.proyecto_id) cfg.proyecto_id = Number(b.proyecto_id);
    if (!cfg.carpeta) cfg.carpeta = 'INBOX';
    if (b.carpeta != null && b.carpeta !== leer().carpeta) { cfg.ultimo_uid = 0; cfg.uidvalidity = null; }
    escribir(cfg);
    programar();
  }
  // Para probar sin guardar: lo escrito en el formulario, con la clave guardada si no se escribió otra
  const conClave = b => { const c = leer(); return { ...c, ...b, clave: b.clave ? String(b.clave).replace(/\s+/g, '') : c.clave }; };

  return { leer, publica, guardar, probar, revisar, programar, registrar, conClave, estado };
}

module.exports = { crearCorreo, radicadoDe, diasHabiles, analizarGemini };
