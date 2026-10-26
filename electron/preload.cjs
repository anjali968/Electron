const { contextBridge } = require("electron");

// Expose only a narrow, fixed API surface. No Node.js or arbitrary IPC access is exposed.
contextBridge.exposeInMainWorld("desktopApp", Object.freeze({
  platform: process.platform,
  appName: "Employee CRUD"
}));
