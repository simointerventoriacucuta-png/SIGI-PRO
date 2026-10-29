// Acceso a la base de datos con libSQL (formato SQLite).
//  - Modo "local": un archivo en el equipo (datos/sigi.db).
//  - Modo "nube": réplica local (datos/replica.db) que lee del archivo y escribe en Turso; se sincroniza sola.
// La configuración de la nube se guarda en datos/sincronizacion.json (solo en este equipo).
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@libsql/client');

const TABLAS_ORDEN = ['proyecto', 'contrato', 'item', 'otrosi', 'otrosi_item', 'acta', 'acta_item', 'gasto', 'vencimiento', 'personal', 'poliza', 'correspondencia', 'bitacora', 'ensayo', 'suspension', 'liquidacion', 'usuario', 'auditoria', 'tarea', 'alineamiento', 'tramo', 'sst', 'sst_mes', 'ambiental', 'pmt', 'social', 'avance', 'adjunto', 'adjunto_dato'];
const archivoUrl = p => 'file:' + p.replace(/\\/g, '/');
const plano = v => (typeof v === 'bigint' ? Number(v) : v);
const filaPlana = r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, plano(v)]));

class Base {
  constructor(carpeta) {
    this.carpeta = carpeta;
    this.archivoConfig = path.join(carpeta, 'sincronizacion.json');
    this.estado = { modo: 'local', ultima: null, error: null };
  }
  config() { try { return JSON.parse(fs.readFileSync(this.archivoConfig, 'utf8')); } catch { return null; } }

  async abrir() {
    if (this.timer) clearInterval(this.timer);
    if (this.c) this.c.close();
    const cfg = this.config();
    if (cfg && cfg.url && cfg.token) {
      this.c = createClient({ url: archivoUrl(path.join(this.carpeta, 'replica.db')), syncUrl: cfg.url, authToken: cfg.token });
      this.estado = { modo: 'nube', url: cfg.url, ultima: null, error: null };
      await this.sincronizar();
      this.timer = setInterval(() => this.sincronizar(), 10000);
    } else {
      this.c = createClient({ url: archivoUrl(path.join(this.carpeta, 'sigi.db')) });
      this.estado = { modo: 'local', ultima: null, error: null };
    }
  }
  async sincronizar() {
    if (this.estado.modo !== 'nube') return;
    try { await this.c.sync(); this.estado.ultima = new Date().toISOString(); this.estado.error = null; }
    catch (e) { this.estado.error = e.message; }
  }

  async all(sql, ...args) { return (await this.c.execute({ sql, args })).rows.map(filaPlana); }
  async get(sql, ...args) { return (await this.all(sql, ...args))[0]; }
  async run(sql, ...args) { const r = await this.c.execute({ sql, args }); return { id: plano(r.lastInsertRowid), cambios: r.rowsAffected }; }
  async exec(sql) { await this.c.executeMultiple(sql); }

  // Prueba una URL y un token sin guardarlos
  static async probar(url, token) {
    const c = createClient({ url, authToken: token });
    try { await c.execute('SELECT 1'); const t = await c.execute("SELECT COUNT(*) n FROM sqlite_master WHERE type = 'table' AND name = 'proyecto'"); return { ok: true, tieneDatos: Number(t.rows[0].n) > 0 }; }
    finally { c.close(); }
  }

  // Activa la nube. Si la base remota está vacía, sube los datos de este equipo conservando los id.
  async activarNube(url, token, esquema) {
    const remota = createClient({ url, authToken: token });
    try {
      await remota.executeMultiple(esquema);
      const hay = Number((await remota.execute('SELECT COUNT(*) n FROM proyecto')).rows[0].n);
      let subidas = 0;
      if (!hay && this.estado.modo === 'local') {
        for (const t of TABLAS_ORDEN) {
          const filas = await this.all(`SELECT * FROM ${t}`);
          for (let i = 0; i < filas.length; i += 200) {
            const lote = filas.slice(i, i + 200).map(f => ({ sql: `INSERT INTO ${t} (${Object.keys(f).join(',')}) VALUES (${Object.keys(f).map(() => '?').join(',')})`, args: Object.values(f) }));
            if (lote.length) await remota.batch(lote, 'write');
          }
          subidas += filas.length;
        }
      }
      fs.writeFileSync(this.archivoConfig, JSON.stringify({ url, token }, null, 2));
      await this.abrir();
      return { ok: true, subidas, yaTeniaDatos: !!hay };
    } finally { remota.close(); }
  }
  async desactivarNube() { try { fs.unlinkSync(this.archivoConfig); } catch {} await this.abrir(); }
}

module.exports = { Base };
