import { app, BrowserWindow } from "electron";

import { spawn } from "child_process";

import http from "http";

let server;

function startServer() {
  server = spawn("node", ["app.js"], {
    shell: true,

    stdio: "inherit",
  });
}

function waitForServer(url, callback) {
  const request = http.get(url, () => {
    callback();
  });

  request.on("error", () => {
    setTimeout(() => {
      waitForServer(url, callback);
    }, 100);
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
  });

  waitForServer("http://localhost:3000", () => {
    window.loadURL("http://localhost:3000");
  });
}

app.whenReady().then(() => {
  startServer();

  createWindow();
});

app.on("window-all-closed", () => {
  if (server) {
    server.kill();
  }

  app.quit();
});
