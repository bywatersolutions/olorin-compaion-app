const { app, BrowserWindow, Tray, Menu } = require('electron');
const path = require('path');
const WebSocket = require('ws');
const localShortcut = require('electron-localshortcut');
const printer = require('printer');
const pdfPrinter = require('pdf-to-printer');
const fs = require('fs');
const { Notification } = require('electron')

let mainWindow;
let wss;
let appTray;
let backgroundWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 400,
    show: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('minimize', (event) => {
    event.preventDefault(); // Prevent the window from being minimized
    mainWindow.hide(); // Hide the window instead
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault(); // Prevent the window from being closed
      mainWindow.hide(); // Hide the window instead
    }
    return false;
  });

  // Start the WebSocket server
  wss = new WebSocket.Server({ port: 9696 });

  wss.on('listening', () => {
    console.log('WebSocket server is listening on port 9696');
  });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    ws.on('message', (message) => {
      // console.log('Received message:', message);
      var data = JSON.parse(message);
      if(data.id){
        switch (data.text) {
          case 'list-printer':
              listPrinter(ws)
            break;
          case 'printer-command':
            printFunction(data,ws)
            break;
        
          default:
            break;
        }
      }

      // Handle received message here
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });
  function listPrinter(ws){
    const printers = printer.getPrinters();
    const data = {
      id:'printerList',
      printer:printers
    }
    ws.send(JSON.stringify(data));
  }

  function printFunction(data,ws){
    const htmlCode = data.content
    const printerName = data.printer
    backgroundWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: true,
      },
    });
    backgroundWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(htmlCode)}`);
  
  
    backgroundWindow.webContents.on('did-finish-load', () => {
      generatePDF(printerName,ws);
    });
  
    backgroundWindow.on('closed', () => {
      backgroundWindow = null;
    });
  }

  function generatePDF(printerLabel,ws) {
  const pdfPath = path.join(__dirname, 'printer.pdf');
  backgroundWindow.webContents.printToPDF({
    pageSize: 'A4'
  }).then(data => {
    fs.writeFile(pdfPath, data, (error) => {
        if (error) {
          console.error('Failed to save PDF:', error);
          return;
        }
        const platform = process.platform;
        console.log(platform);
        if(platform.includes('darwin')){
          // Mac specific code
          printer.printFile({ filename: pdfPath, printer: printerLabel});
          console.log('Running on Mac');
          new Notification({
                title: 'Olorin Alert',
                body: 'Print Successfull'
              }).show()
        }
        else if (platform.includes('win')) {
          // Windows specific code
            pdfPrinter.print(pdfPath, {
              printer: printerLabel, // Replace with the name of your printer
              win32: ['-print-settings', 'fit'], // Optional print settings for Windows
              silent: true // Enable silent printing
            }).then(() => {
              new Notification({
                title: 'Olorin Alert',
                body: 'Print Successfull'
              }).show()
            })
            .catch((error) => {
              new Notification({
                title: 'Olorin Alert',
                body: error
              }).show()
            });
          console.log('Running on Windows');
        } else if (platform.includes('linux')) {
          // Linux specific code
          printer.printFile({ filename: pdfPath, printer: printerLabel});
          console.log('Running on Linux');
        } 
      });
  }
  )
}
const template = [
  {
    role: 'window',
    submenu: [
      { role: 'minimize' },
      { role: 'close' }
    ]
  }
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

  // Create the tray icon
  const trayIconPath = path.join(__dirname, 'tray-icon.png');
  appTray = new Tray(trayIconPath);
   

  // Create a context menu for the tray icon
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open',
      click: () => {
        mainWindow.show(); // Show the main window when "Open" is clicked
      },
    },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true; // Set the quitting flag to true
        app.quit(); // Quit the app when "Quit" is clicked
      },
    },
  ]);

  // Set the context menu for the tray icon
  appTray.setContextMenu(contextMenu);

  // Show the main window when the tray icon is clicked
  appTray.on('click', () => {
    mainWindow.show();
  });
  // Register a global shortcut to show/hide the main window when a specific key combination is pressed
  localShortcut.register(mainWindow, 'Ctrl+Shift+M', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
  
}

app.whenReady().then(createWindow);

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
