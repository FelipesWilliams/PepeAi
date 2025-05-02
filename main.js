const { app, BrowserWindow, Tray, screen, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');

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
  mainWindow = new BrowserWindow({
    width: screen.getPrimaryDisplay().workAreaSize.width,
    height: screen.getPrimaryDisplay().workAreaSize.height,
    frame: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    hasShadow: false,
    enableLargerThanScreen: true,
    movable: false,
    resizable: false
  });

  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.maximize();
  mainWindow.loadFile('index.html');

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

// Obtener las coordenadas de la ventana
ipcMain.handle('get-window-bounds', () => {
  return mainWindow.getBounds();
});

// Nueva implementación de captura de pantalla
ipcMain.handle('capture-screen', async (event, frameBounds) => {
  try {
    // Obtener la pantalla principal
    const primaryDisplay = screen.getPrimaryDisplay();
    const { scaleFactor } = primaryDisplay;

    // Configurar la captura con resolución máxima
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: primaryDisplay.size.width * scaleFactor,
        height: primaryDisplay.size.height * scaleFactor
      }
    });

    if (!sources || sources.length === 0) {
      throw new Error('No se pudo acceder a la pantalla');
    }

    // Preparar directorio de capturas
    const capturesDir = path.join(__dirname, 'CapturasAuto');
    if (!fs.existsSync(capturesDir)) {
      fs.mkdirSync(capturesDir, { recursive: true });
    }

    // Calcular coordenadas exactas considerando el factor de escala
    const captureArea = {
      x: Math.round(frameBounds.x * scaleFactor),
      y: Math.round(frameBounds.y * scaleFactor),
      width: Math.round(frameBounds.width * scaleFactor),
      height: Math.round(frameBounds.height * scaleFactor)
    };

    // Verificar dimensiones válidas
    if (captureArea.width <= 0 || captureArea.height <= 0) {
      throw new Error('Dimensiones de captura inválidas');
    }

    // Realizar la captura
    const source = sources[0];
    const image = source.thumbnail.crop(captureArea);

    // Generar nombre de archivo con timestamp y dimensiones
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dimensions = `${frameBounds.width}x${frameBounds.height}`;
    const fileName = `captura_${timestamp}_${dimensions}.png`;
    const filePath = path.join(capturesDir, fileName);

    // Guardar la imagen
    fs.writeFileSync(filePath, image.toPNG());

    console.log('Captura realizada:', {
      ruta: filePath,
      dimensiones: dimensions,
      area: captureArea
    });

    return {
      success: true,
      path: filePath
    };

  } catch (error) {
    console.error('Error en la captura:', error);
    return {
      success: false,
      error: error.message
    };
  }
}); 