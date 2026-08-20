import { app, BrowserWindow } from "electron";
import http from "http";

import { startServer } from "./app.js";

let server;

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
  server = startServer();

  createWindow();
});

app.on("window-all-closed", async () => {
  if (server) {
    await new Promise((resolve) => {
      server.close(() => {
        console.log("Express server closed.");
        resolve();
      });
    });

    server = null;
  }

  app.quit();
});
