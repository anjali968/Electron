const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");
const http = require("node:http");

let mainWindow;
let apiProcess;

function waitForHealth(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on("error", retry);
      req.setTimeout(1500, () => req.destroy());
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error("API did not become ready."));
      setTimeout(attempt, 500);
    };
    attempt();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 850,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (app.isPackaged) {
    await mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    await mainWindow.loadURL("http://127.0.0.1:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
}

app.whenReady().then(async () => {
  // In dev, the npm script starts the API separately. In a packaged app, spawn the bundled server.
  if (app.isPackaged) {
    const serverEntry = path.join(app.getAppPath(), "server", "app.cjs");
    apiProcess = spawn(process.execPath, [serverEntry], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", EMPLOYEE_DATA_DIR: app.getPath("userData") },
      stdio: "inherit"
    });
    try {
      await waitForHealth("http://127.0.0.1:4000/health");
    } catch (err) {
      console.error(err);
    }
  }
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  if (apiProcess && !apiProcess.killed) apiProcess.kill();
});
