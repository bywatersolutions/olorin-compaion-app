const { app, BrowserWindow, Tray, Menu } = require("electron");
const path = require("path");
const WebSocket = require("ws");
const localShortcut = require("electron-localshortcut");
const printer = require("printer");
const pdfPrinter = require("pdf-to-printer");
const fs = require("fs");
const { Notification } = require("electron");

const olorin_options_filename = "olorin_options.json";

let mainWindow;
let wss;
let appTray;
let backgroundWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 400,
    show: true,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      nodeIntegration: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  mainWindow.on("minimize", (event) => {
    event.preventDefault(); // Prevent the window from being minimized
    mainWindow.hide(); // Hide the window instead
  });

  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault(); // Prevent the window from being closed
      mainWindow.hide(); // Hide the window instead
    }
    return false;
  });

  // Start the WebSocket server
  wss = new WebSocket.Server({
    port: 9696,
  });

  wss.on("listening", () => {
    console.log("WebSocket server is listening on port 9696");
  });

  wss.on("connection", (ws) => {
    console.log("WebSocket client connected");

    ws.on("message", (message) => {
      var data = JSON.parse(message);
      //console.log('Received message:', data);
      //console.log(data.text);
      if (data.id) {
        switch (data.text) {
          case "list-printer":
            listPrinter(ws);
            break;
          case "printer-command":
            printFunction(data, ws);
            break;
          case "get-options":
            getOptions(ws);
            break;
          case "set-options":
            console.log("SETTING OPTIONS");
            setOptions(data.options, ws);
            break;

          default:
            break;
        }
      }

      // Handle received message here
    });

    ws.on("close", () => {
      console.log("WebSocket client disconnected");
    });
  });

  // Look for the options file in the following places in order:
  // * Olorin executable directory
  // * User home directory
  // * Roaming Add Data
  // * Program Data
  // * C:\
  // These will render to:
  // EXE_DIR\olorin_options.json
  // C:\Users\USERNAME\olorin_options.json
  // C:\Users\USERNAME\AppData\Roaming\olorin_options.json
  // C:\Users\USERNAME\AppData\Roaming\Olorin Companion\olorin_options.json
  // C:\olorin_options.json
  // respectively most of the time

  function findOptionsFile() {
    let file_to_use = "";

    let paths = [
      olorin_options_filename,
      app.getPath("home") + "\\" + olorin_options_filename,
      app.getPath("appData") + "\\" + olorin_options_filename,
      app.getPath("userData") + "\\" + olorin_options_filename,
      app.getPath("sessionData") + "\\" + olorin_options_filename,
      "C:\\" + olorin_options_filename,
    ];

    for (const i in paths) {
      const p = paths[i];
      console.log("CHECKING PATH ", p);

      if (fs.existsSync(p)) {
        file_to_use = p;
      }
    }

    if (!file_to_use) {
      // Default to Olorin Companion directory
      file_to_use = olorin_options_filename;
    }
    return file_to_use;
  }

  function getOptions(ws) {
    let file_to_use = findOptionsFile();
    if (fs.existsSync(file_to_use)) {
      let data = fs.readFileSync(file_to_use);
      data = JSON.parse(data);
      //console.log("GETTING OPTIONS DATA", data );
      ws.send(JSON.stringify(data));
    } else {
      ws.send(JSON.stringify({}));
    }
  }

  function setOptions(data, ws) {
    console.log("SETTING OPTIONS DATA", data);
    let str = JSON.stringify(data);
    //console.log("DATA AS STRING", str)
    let file_to_use = findOptionsFile();
    fs.writeFileSync(file_to_use, JSON.stringify(data));
    ws.send(JSON.stringify({ success: true }));
  }

  function listPrinter(ws) {
    const printers = printer.getPrinters();
    const data = {
      id: "printerList",
      printer: printers,
    };
    ws.send(JSON.stringify(data));
  }

  function printFunction(data, ws) {
    const htmlCode = data.content;
    const printerName = data.printer;
    const pageHeight = data.pageHeight;
    const pageWidth = data.pageWidth;
    const marginTop = data.marginTop;
    const marginRight = data.marginRight;
    const marginLeft = data.marginLeft;
    const marginBottom = data.marginBottom;
    const orientation = data.orientation;
    // check if any of them is zero , then pass A4 as default
    if (pageHeight != 0 && pageWidth != 0) {
      var pageProperty = (pageSize = {
        width: parseFloat(pageWidth),
        height: parseFloat(pageHeight),
      });
    } else {
      var pageProperty = (pageSize = "A4");
    }
    // check if margin availabe
    if (marginTop && marginRight && marginLeft && marginBottom) {
      var marginproperty = {
        top: parseFloat(marginTop),
        bottom: parseFloat(marginBottom),
        left: parseFloat(marginLeft),
        right: parseFloat(marginBottom),
      };
    } else {
      var marginproperty = {
        marginType: 0,
      };
    }
    var options = {
      pageSize: pageProperty,
      margins: marginproperty,
      printBackground: true,
    };
    // check if orientation is not Automatic
    // if(orientation != 'Automatic'){
    //   if(orientation == 'Portrait'){
    //     var landscape = false
    //   }else if(orientation == 'Landscape'){
    //     var landscape = true
    //   }
    //   options.landscape = landscape
    // }

    console.log(options);
    backgroundWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: true,
      },
    });
    backgroundWindow.loadURL(
      `data:text/html;charset=UTF-8,${encodeURIComponent(htmlCode)}`
    );

    backgroundWindow.webContents.on("did-finish-load", () => {
      generatePDF(printerName, options, ws, orientation);
    });

    backgroundWindow.on("closed", () => {
      backgroundWindow = null;
    });
  }

  function generatePDF(printerLabel, pageProperty, ws, orientation) {
    const pdfPath = path.join(__dirname, "printer.pdf");
    backgroundWindow.webContents
      .printToPDF(pageProperty)
      .then((data) => {
        fs.writeFile(pdfPath, data, (error) => {
          if (error) {
            console.error("Failed to save PDF:", error);
            return;
          }
          const platform = process.platform;
          console.log(platform);
          if (platform.includes("darwin")) {
            // Mac specific code
            printer.printFile({
              filename: pdfPath,
              printer: printerLabel,
            });
            console.log("Running on Mac");
            new Notification({
              title: "Olorin Alert",
              body: "Print Successfull",
            }).show();
          } else if (platform.includes("win")) {
            // Windows specific code
            let printerOption = {
              printer: printerLabel, // Replace with the name of your printer
              win32: ["-print-settings", "fit"], // Optional print settings for Windows
              silent: true, // Enable silent printing
              scale: "noscale", // Without noscale it will try to scale to fit, bad for labels
            };
            // Add orientation option if necessary
            if (orientation) {
              if (orientation == "Portrait") {
                printerOption["orientation"] = "portrait";
              } else if (orientation == "Landscape") {
                printerOption["orientation"] = "landscape";
              }
            }
            pdfPrinter
              .print(pdfPath, printerOption)
              .then(() => {
                new Notification({
                  title: "Olorin Alert",
                  body: "Print Successfull",
                }).show();
              })
              .catch((error) => {
                new Notification({
                  title: "Olorin Alert",
                  body: error,
                }).show();
              });
            console.log("Running on Windows");
          } else if (platform.includes("linux")) {
            // Linux specific code
            printer.printFile({
              filename: pdfPath,
              printer: printerLabel,
            });
            console.log("Running on Linux");
          }
        });
      })
      .catch((err) => {
        console.log(err);
        new Notification({
          title: "Olorin Alert",
          body: "Please check all the page configuration",
        }).show();
      });
  }
  const template = [
    {
      role: "window",
      submenu: [
        {
          role: "minimize",
        },
        {
          role: "close",
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Create the tray icon
  const trayIconPath = path.join(__dirname, "tray-icon.png");
  appTray = new Tray(trayIconPath);

  // Create a context menu for the tray icon
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open",
      click: () => {
        mainWindow.show(); // Show the main window when "Open" is clicked
      },
    },
    {
      label: "Quit",
      click: () => {
        app.isQuitting = true; // Set the quitting flag to true
        app.quit(); // Quit the app when "Quit" is clicked
      },
    },
  ]);

  // Set the context menu for the tray icon
  appTray.setContextMenu(contextMenu);

  // Show the main window when the tray icon is clicked
  appTray.on("click", () => {
    mainWindow.show();
  });
  // Register a global shortcut to show/hide the main window when a specific key combination is pressed
  localShortcut.register(mainWindow, "Ctrl+Shift+M", () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// app.on('ready', () => {
//   app.dock.setIcon(path.join(__dirname, 'icon.png')); // Path to your icon file
//   app.setName('Olorin'); // Set the name of your app
//   // Create and show your browser window or main UI here
// });
