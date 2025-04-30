const { app, BrowserWindow, Tray, screen, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let tray = null;

function createTray() {
  // Asegurarse de que solo haya una instancia del tray
  if (tray === null) {
    // Crear el icono en la barra de tareas
    tray = new Tray(path.join(__dirname, 'iconnn.png'));
    tray.setToolTip('Camera Frame App');
    
    // Alternar la visibilidad de la ventana al hacer clic en el icono
    tray.on('click', () => {
      if (!mainWindow.isVisible()) {
        mainWindow.show();
        mainWindow.maximize();
      } else {
        mainWindow.hide();
      }
    });
  }
}

function createWindow() {
  // Obtener el tamaño de la pantalla principal
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    skipTaskbar: false,
    hasShadow: false,
    // Estas opciones son clave para permitir la interacción con ventanas debajo
    focusable: true,
    clickThrough: true
  });

  // Hacer que la ventana ignore los clics en áreas transparentes
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  mainWindow.loadFile('index.html');
  mainWindow.maximize();

  // Crear el tray icon
  createTray();

  // Configurar los eventos IPC
  ipcMain.on('minimize-window', () => {
    mainWindow.hide();
  });

  ipcMain.on('close-window', () => {
    // Al cerrar, destruir el tray y cerrar la aplicación
    if (tray) {
      tray.destroy();
      tray = null;
    }
    app.quit();
  });

  // Escuchar eventos para habilitar/deshabilitar la captura de mouse
  ipcMain.on('set-ignore-mouse-events', (event, ignore) => {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
  });

  // Manejar el cierre de la ventana
  mainWindow.on('close', (event) => {
    // Si el cierre viene del botón X (close-window), no prevenir el cierre
    if (!app.isQuitting) {
      if (tray) {
        tray.destroy();
        tray = null;
      }
    }
  });
}

// Asegurarse de que solo haya una instancia de la aplicación
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}); 