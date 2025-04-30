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
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

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

// Manejar la solicitud para obtener la posición de la ventana
ipcMain.handle('get-window-bounds', () => {
    const bounds = mainWindow.getBounds();
    return bounds;
});

// Manejar la solicitud de captura de pantalla
ipcMain.handle('capture-screen', async (event, bounds) => {
    try {
        // Obtener todas las fuentes de captura de pantalla con mayor resolución
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: {
                width: screen.getPrimaryDisplay().size.width,
                height: screen.getPrimaryDisplay().size.height
            }
        });

        // Crear la carpeta CapturasAuto en el directorio del proyecto
        const capturesDir = path.join(__dirname, 'CapturasAuto');
        
        try {
            if (!fs.existsSync(capturesDir)) {
                fs.mkdirSync(capturesDir, { recursive: true });
            }
        } catch (err) {
            console.error('Error al crear el directorio:', err);
            return { success: false, error: 'No se pudo crear el directorio CapturasAuto' };
        }

        // Generar nombre de archivo único con timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `captura_auto_${timestamp}.png`;
        const filePath = path.join(capturesDir, fileName);

        // Obtener la imagen y guardarla
        const source = sources[0]; // Pantalla principal
        if (source.thumbnail) {
            try {
                // Ajustar las coordenadas según la escala de la pantalla
                const scaleFactor = screen.getPrimaryDisplay().scaleFactor;
                const cropBounds = {
                    x: Math.round(bounds.x * scaleFactor),
                    y: Math.round(bounds.y * scaleFactor),
                    width: Math.round(bounds.width * scaleFactor),
                    height: Math.round(bounds.height * scaleFactor)
                };

                // Capturar y recortar la imagen
                const image = source.thumbnail.crop(cropBounds);
                
                // Guardar la imagen
                fs.writeFileSync(filePath, image.toPNG());
                console.log('Imagen guardada exitosamente en:', filePath);
                
                return { 
                    success: true, 
                    path: filePath,
                    message: 'Captura guardada en CapturasAuto'
                };
            } catch (err) {
                console.error('Error al procesar y guardar la imagen:', err);
                return { 
                    success: false, 
                    error: 'Error al guardar la imagen: ' + err.message 
                };
            }
        }
        return { success: false, error: 'No se pudo obtener la captura de pantalla' };
    } catch (error) {
        console.error('Error en capture-screen:', error);
        return { success: false, error: error.message };
    }
}); 