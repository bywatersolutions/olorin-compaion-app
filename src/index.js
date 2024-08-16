const { app, BrowserWindow, Tray, Menu, Notification } = require("electron");
const path = require("path");
const WebSocket = require("ws");
const localShortcut = require("electron-localshortcut");
const printer = require("printer");
const pdfPrinter = require("pdf-to-printer");
const fs = require("fs");
const { env } = require("node:process");

// Setting the envronment variable OLORIN_CONF_FILE to a fully qualified
// file path ( e.g. "C:\opt\olorin_options.json" ) will cause the companion
// application to utilize *only* that path and file.
const olorin_config_file = process.env.OLORIN_CONFIG_FILE;

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

    let paths = olorin_config_file
      ? [olorin_config_file]
      : [
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

    console.log("FOUND EXISTING OPTIONS FILE: ", file_to_use, "\r\n");

    if (!file_to_use) {
      // Default to Olorin Companion directory
      file_to_use = olorin_options_filename;
    }

    console.log("USING OPTIONS FILE: ", file_to_use, "\r\n");
    
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
    console.log("WRITING OPTIONS FILE TO: ", file_to_use);
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
    console.log("printFunction()", data);
    const htmlCode = data.content;
    const printer = data.printer;

    let file_to_use = findOptionsFile();
    let conf = fs.readFileSync(file_to_use);
    conf = JSON.parse(conf);

    // If the extension doesn't send us the data, read it from the config by printer name
    const pageHeight   = conf[printer + "_height"]        ||  data.pageHeight;
    const pageWidth    = conf[printer + "_width"]         ||  data.pageWidth;
    const marginTop    = conf[printer + "_margin_top"]    ||  data.marginTop;
    const marginRight  = conf[printer + "_margin_right"]  ||  data.marginRight;
    const marginLeft   = conf[printer + "_margin_left"]   ||  data.marginLeft;
    const marginBottom = conf[printer + "_margin_bottom"] ||  data.marginBottom;
    const orientation  = conf[printer + "_orientation"]   ||  data.orientation;

    const printerName = conf[printer];

    console.log("NAME: ",        printerName );
    console.log("HEIGHT: ",      pageHeight);
    console.log("WIDTH: ",       pageWidth);
    console.log("MTOP: ",        marginTop);
    console.log("MRIGHT: ",      marginRight);
    console.log("MLEFT: ",       marginLeft);
    console.log("MBOTTOM: ",     marginBottom);
    console.log("ORIENTATION: ", orientation);

    // check if any of them is zero , then pass A4 as default
    if (pageHeight != 0 && pageWidth != 0) {
      var printToPdfOptions = (pageSize = {
        width: parseFloat(pageWidth),
        height: parseFloat(pageHeight),
      });
    } else {
      var printToPdfOptions = (pageSize = "A4");
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
      pageSize: printToPdfOptions,
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

    console.log("PRINTER OPTIONS: ", options);
    console.log("HTML: ", htmlCode);

    backgroundWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: true,
      },
    });

    // This code saves the HTML to a temp file first, not actually necessary
    // backgroundWindow.loadFile( html_file )
    // let html_file = app.getPath("temp") + path.sep + "printer.html";
    // console.log("HTML FILE: ", html_file );
    // fs.writeFileSync( html_file, htmlCode );

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

  function generatePDF(printerLabel, printToPdfOptions, ws, orientation) {
    console.log("PRINTER: ", printerLabel);
    console.log("PAGE PROP", printToPdfOptions);
    console.log("ORIENTATION: ", orientation);

    const pdfPath = path.join(__dirname, "printer.pdf");
    console.log("PDF PATH: ", pdfPath);

    backgroundWindow.webContents
      .printToPDF(printToPdfOptions)
      .then((data) => {
        fs.writeFile(pdfPath, data, (error) => {
          if (error) {
            console.error("Failed to save PDF to path:", error);
            return;
          }

          const platform = process.platform;
          console.log("PLATFORM: ", platform);

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

		  console.log("PRINTER LABEL", printerLabel);
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
