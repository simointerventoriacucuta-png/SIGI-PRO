// Genera build/icono.png e build/icono.ico a partir de public/logo.svg.  Uso: npx electron tools/icono.js
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 256, height: 256, show: false, frame: false, transparent: true, webPreferences: { offscreen: true } });
  const svg = fs.readFileSync(path.join(__dirname, '..', 'public', 'logo.svg'), 'utf8');
  await w.loadURL('data:text/html,' + encodeURIComponent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', '<svg width="256" height="256" ')}</body></html>`));
  await new Promise(r => setTimeout(r, 500));
  const img = await w.webContents.capturePage({ x: 0, y: 0, width: 256, height: 256 });
  const salida = path.join(__dirname, '..', 'build');
  fs.mkdirSync(salida, { recursive: true });
  fs.writeFileSync(path.join(salida, 'icono.png'), img.toPNG());

  // ICO con PNG embebidos (16, 24, 32, 48, 64, 128, 256)
  const tam = [16, 24, 32, 48, 64, 128, 256];
  const pngs = tam.map(t => (t === 256 ? img : img.resize({ width: t, height: t, quality: 'best' })).toPNG());
  const cab = Buffer.alloc(6 + 16 * tam.length);
  cab.writeUInt16LE(0, 0); cab.writeUInt16LE(1, 2); cab.writeUInt16LE(tam.length, 4);
  let off = cab.length;
  tam.forEach((t, i) => {
    const o = 6 + 16 * i;
    cab.writeUInt8(t === 256 ? 0 : t, o); cab.writeUInt8(t === 256 ? 0 : t, o + 1);
    cab.writeUInt16LE(1, o + 4); cab.writeUInt16LE(32, o + 6);
    cab.writeUInt32LE(pngs[i].length, o + 8); cab.writeUInt32LE(off, o + 12);
    off += pngs[i].length;
  });
  fs.writeFileSync(path.join(salida, 'icono.ico'), Buffer.concat([cab, ...pngs]));
  console.log('Ícono generado en', salida);
  app.quit();
});
