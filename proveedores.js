// SIGI Pro - proveedores de IA para el asistente: Gemini (Google) y Ollama (local, gratis).
// El asistente trabaja con mensajes en el formato de Claude (bloques text, tool_use y tool_result);
// cada función convierte ese formato al del proveedor y devuelve { content, stop_reason } en formato Claude.
const crypto = require('node:crypto');

class ErrorProveedor extends Error { constructor(codigo, msg) { super(msg); this.codigo = codigo; } }

// Gemini acepta un subconjunto de JSON Schema: sin additionalProperties ni tipos múltiples
function esquemaGemini(s) {
  if (Array.isArray(s)) return s.map(esquemaGemini);
  if (!s || typeof s !== 'object') return s;
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'additionalProperties') continue;
    out[k] = k === 'type' && Array.isArray(v) ? v[0] : esquemaGemini(v);
  }
  if (out.type === 'object' && out.properties && !Object.keys(out.properties).length) delete out.properties;
  return out;
}
const textoDe = c => (typeof c === 'string' ? c : (c || []).filter(b => b.type === 'text').map(b => b.text).join(''));

// ---------- Gemini (API de Google AI Studio) ----------
function contenidosGemini(mensajes) {
  const nombres = {}; // id de tool_use → nombre de la herramienta
  return mensajes.map(m => {
    if (typeof m.content === 'string') return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] };
    const parts = [];
    for (const b of m.content) {
      if (b.type === 'text' && b.text) parts.push({ text: b.text });
      if (b.type === 'tool_use') { nombres[b.id] = b.name; parts.push(b._gemini || { functionCall: { name: b.name, args: b.input } }); }
      if (b.type === 'tool_result') {
        let r; try { r = JSON.parse(b.content); } catch { r = { resultado: b.content }; }
        parts.push({ functionResponse: { name: nombres[b.tool_use_id] || 'herramienta', response: Array.isArray(r) || typeof r !== 'object' || r === null ? { resultado: r } : r } });
      }
    }
    return { role: m.role === 'assistant' ? 'model' : 'user', parts };
  });
}
// Si el modelo está saturado (503) o pidió esperar (429), reintenta con pausa y luego con un modelo alterno
const ALTERNOS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
const espera = ms => new Promise(ok => setTimeout(ok, ms));
async function turnoGemini(cfg, sistema, mensajes, herramientas, alTexto) {
  if (!cfg.clave_gemini) throw new ErrorProveedor(400, 'Falta la clave de Gemini. El director la configura en Inicio → Asistente → Clave del asistente.');
  const modelos = [...new Set([cfg.modelo_gemini || ALTERNOS[0], ...ALTERNOS])];
  let ultimo;
  for (const modelo of modelos) for (let intento = 0; intento < 2; intento++) {
    try { return await llamarGemini(cfg, modelo, sistema, mensajes, herramientas, alTexto); }
    catch (e) { if (!e.saturado) throw e; ultimo = e; await espera(1500 * (intento + 1)); }
  }
  throw ultimo;
}
async function llamarGemini(cfg, modelo, sistema, mensajes, herramientas, alTexto) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:streamGenerateContent?alt=sse`, {
    method: 'POST', signal: AbortSignal.timeout(120000), headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.clave_gemini },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: sistema }] }, contents: contenidosGemini(mensajes),
      tools: [{ functionDeclarations: herramientas.map(h => ({ name: h.name, description: h.description, parameters: esquemaGemini(h.input_schema) })) }] }),
  });
  if (!r.ok) {
    const t = await r.text();
    if (r.status === 400 && /API key/i.test(t) || r.status === 401 || r.status === 403) throw new ErrorProveedor(400, 'La clave de Gemini no es válida o no tiene acceso a la API');
    if (r.status === 404) throw new ErrorProveedor(400, `El modelo "${modelo}" no existe en Gemini. Revise el nombre del modelo en la configuración.`);
    if (r.status === 429 || r.status === 503) throw Object.assign(new ErrorProveedor(r.status, r.status === 503 ? 'Gemini está saturado en este momento: intente de nuevo en unos minutos.' : 'Se alcanzó el límite de consultas de Gemini: intente en un minuto o revise sus créditos.'), { saturado: true });
    throw new ErrorProveedor(502, 'Error de Gemini: ' + t.slice(0, 300));
  }
  const content = [];
  let texto = '', buf = '', bloqueado = false;
  const dec = new TextDecoder();
  for await (const trozo of r.body) {
    buf += dec.decode(trozo, { stream: true }).replace(/\r\n/g, '\n');
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const linea = buf.slice(0, i).split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5)).join('');
      buf = buf.slice(i + 2);
      if (!linea.trim()) continue;
      const d = JSON.parse(linea), cand = d.candidates?.[0];
      if (d.promptFeedback?.blockReason || cand?.finishReason === 'SAFETY') bloqueado = true;
      for (const p of cand?.content?.parts || []) {
        if (p.text && !p.thought) { texto += p.text; alTexto(p.text); }
        // Se guarda la parte completa: los modelos nuevos exigen devolver su "thoughtSignature"
        if (p.functionCall) content.push({ type: 'tool_use', id: 'g_' + crypto.randomUUID(), name: p.functionCall.name, input: p.functionCall.args || {}, _gemini: p });
      }
    }
  }
  if (texto) content.unshift({ type: 'text', text: texto });
  return { content, stop_reason: bloqueado ? 'refusal' : content.some(b => b.type === 'tool_use') ? 'tool_use' : 'end_turn' };
}

// ---------- Ollama (modelo en el propio computador) ----------
function mensajesOllama(sistema, mensajes) {
  const out = [{ role: 'system', content: sistema }];
  for (const m of mensajes) {
    if (typeof m.content === 'string') { out.push({ role: m.role, content: m.content }); continue; }
    const usos = m.content.filter(b => b.type === 'tool_use'), resultados = m.content.filter(b => b.type === 'tool_result');
    if (m.role === 'assistant') out.push({ role: 'assistant', content: textoDe(m.content), ...(usos.length ? { tool_calls: usos.map(b => ({ function: { name: b.name, arguments: b.input } })) } : {}) });
    else if (resultados.length) for (const b of resultados) out.push({ role: 'tool', content: String(b.content) });
    else out.push({ role: 'user', content: textoDe(m.content) });
  }
  return out;
}
async function turnoOllama(cfg, sistema, mensajes, herramientas, alTexto) {
  const url = (cfg.url_ollama || 'http://127.0.0.1:11434').replace(/\/$/, ''), modelo = cfg.modelo_ollama || 'qwen2.5:7b';
  let r;
  try {
    r = await fetch(url + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelo, stream: false, messages: mensajesOllama(sistema, mensajes), tools: herramientas.map(h => ({ type: 'function', function: { name: h.name, description: h.description, parameters: h.input_schema } })) }) });
  } catch { throw new ErrorProveedor(503, `No se pudo conectar con Ollama en ${url}. Instálelo desde ollama.com y ábralo.`); }
  if (!r.ok) {
    const t = await r.text();
    if (r.status === 404) throw new ErrorProveedor(400, `Ollama no tiene el modelo "${modelo}". Descárguelo con: ollama pull ${modelo}`);
    throw new ErrorProveedor(502, 'Error de Ollama: ' + t.slice(0, 300));
  }
  const msg = (await r.json()).message || {};
  const content = [];
  if (msg.content) { content.push({ type: 'text', text: msg.content }); alTexto(msg.content); }
  for (const c of msg.tool_calls || []) {
    let args = c.function?.arguments || {};
    if (typeof args === 'string') { try { args = JSON.parse(args); } catch { args = {}; } }
    content.push({ type: 'tool_use', id: 'o_' + crypto.randomUUID(), name: c.function?.name, input: args });
  }
  return { content, stop_reason: content.some(b => b.type === 'tool_use') ? 'tool_use' : 'end_turn' };
}

// ---------- Lectura de documentos con Gemini ----------
// Envía el documento (PDF/foto en línea o su texto) y pide la respuesta en JSON con el esquema dado
async function leerDocumentoGemini(cfg, partes, instruccion, esquema) {
  if (!cfg.clave_gemini) throw new ErrorProveedor(400, 'Falta la clave de Gemini. El director la configura en Inicio → Asistente → Clave del asistente.');
  const modelos = [...new Set([cfg.modelo_gemini || ALTERNOS[0], ...ALTERNOS])];
  let ultimo;
  for (const modelo of modelos) for (let intento = 0; intento < 2; intento++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: 'POST', signal: AbortSignal.timeout(180000), headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.clave_gemini },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [...partes, { text: instruccion }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: esquemaGemini(esquema) } }),
    });
    if (r.status === 429 || r.status === 503) { ultimo = new ErrorProveedor(r.status, 'Gemini está saturado en este momento: intente de nuevo en unos minutos.'); await espera(1500 * (intento + 1)); continue; }
    if (!r.ok) { const t = await r.text(); throw new ErrorProveedor(r.status === 400 && /API key/i.test(t) || r.status === 403 ? 400 : 502, r.status === 403 || /API key/i.test(t) ? 'La clave de Gemini no es válida o no tiene acceso a la API' : 'Gemini no pudo leer el documento: ' + t.slice(0, 200)); }
    const d = await r.json(), texto = (d.candidates?.[0]?.content?.parts || []).filter(p => p.text && !p.thought).map(p => p.text).join('');
    try { return JSON.parse(texto); } catch { throw new ErrorProveedor(502, 'Gemini respondió en un formato inesperado; intente de nuevo.'); }
  }
  throw ultimo;
}

module.exports = { turnoGemini, turnoOllama, leerDocumentoGemini, ErrorProveedor, esquemaGemini };
