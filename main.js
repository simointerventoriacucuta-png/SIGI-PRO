// SIGI - aplicación de escritorio (Electron). Arranca el servidor interno y abre la ventana.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

if (!app.requestSingleInstanceLock()) app.quit();

// Los datos quedan en %APPDATA%\SIGI Interventoría (o en .\datos si se corre desde el código)
process.env.SIGI_DATOS = app.isPackaged ? path.join(app.getPath('userData'), 'datos') : path.join(__dirname, 'datos');
process.env.PORT = '0';

let ventana;
app.whenReady().then(async () => {
  const puerto = await require('./server.js');
  Menu.setApplicationMenu(null);
  ventana = new BrowserWindow({
    width: 1500, height: 900, minWidth: 1000, minHeight: 650, show: false,
    title: 'SIGI Interventoría', backgroundColor: '#f3f3f3',
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  ventana.maximize();
  ventana.once('ready-to-show', () => ventana.show());
  // Los enlaces externos se abren en el navegador del sistema, no dentro de la app
  ventana.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  ventana.loadURL(`http://127.0.0.1:${puerto}/`);
});
app.on('second-instance', () => { if (ventana) { if (ventana.isMinimized()) ventana.restore(); ventana.focus(); } });
app.on('window-all-closed', () => app.quit());
