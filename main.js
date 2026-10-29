// SIGI Pro - aplicación de escritorio (Electron). Muestra la bienvenida, arranca el servidor interno y abre la ventana.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

if (!app.requestSingleInstanceLock()) app.quit();
app.setAppUserModelId('co.simo.sigi');

// Los datos quedan en %APPDATA%\SIGI Pro (o en .\datos si se corre desde el código)
process.env.SIGI_DATOS = app.isPackaged ? path.join(app.getPath('userData'), 'datos') : path.join(__dirname, 'datos');
// Puerto fijo (4027) para que Power BI y otros programas siempre encuentren los datos; si está ocupado, uno libre
process.env.PORT = '4027';
process.env.SIGI_PUERTO_LIBRE = '1';
const ICONO = path.join(__dirname, 'build', 'icono.ico');

let ventana;
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  const bienvenida = new BrowserWindow({ width: 620, height: 330, frame: false, resizable: false, transparent: true, alwaysOnTop: true, center: true, icon: ICONO, show: false });
  bienvenida.loadFile(path.join(__dirname, 'public', 'bienvenida.html'), { query: { v: app.getVersion() } });
  bienvenida.once('ready-to-show', () => bienvenida.show());
  const inicio = Date.now();

  const puerto = await require('./server.js');
  ventana = new BrowserWindow({
    width: 1500, height: 900, minWidth: 1000, minHeight: 650, show: false, icon: ICONO,
    title: 'SIGI Pro', backgroundColor: '#f3f3f3',
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  // Los enlaces externos se abren en el navegador del sistema, no dentro de la app
  ventana.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  ventana.loadURL(`http://127.0.0.1:${puerto}/?v=${app.getVersion()}`);
  ventana.once('ready-to-show', () => setTimeout(() => {
    ventana.maximize(); ventana.show();
    if (!bienvenida.isDestroyed()) bienvenida.close();
  }, Math.max(0, 1800 - (Date.now() - inicio))));
});
app.on('second-instance', () => { if (ventana) { if (ventana.isMinimized()) ventana.restore(); ventana.focus(); } });
app.on('window-all-closed', () => app.quit());
