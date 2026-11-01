const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  nativeTheme,
  session,
  screen,
} = require("electron");
const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  APP_NAME,
  APP_ID,
  readPrivateConfig,
  trustedNavigation,
  smokeDataDirectory,
  smokeScreenshotPath,
} = require("./runtime.cjs");

app.setName(APP_NAME);
app.setAppUserModelId(APP_ID);
const isSmokeTest = process.argv.includes("--smoke-test");
let mainWindow;
let apiServer;
let trackerApp;
let appOrigin;
let quitting = false;
let closedStore = false;
let startupTimer;

try {
  const isolatedDirectory = smokeDataDirectory(process.argv);
  const profileDirectory =
    isolatedDirectory || path.join(app.getPath("appData"), APP_NAME);
  mkdirSync(profileDirectory, { recursive: true });
  app.setPath("userData", profileDirectory);
} catch {
  app.quit();
}

function closeStore() {
  if (trackerApp && !closedStore) {
    trackerApp.locals.close();
    closedStore = true;
  }
}

function finishSmoke(result) {
  clearTimeout(startupTimer);
  const report = {
    ...result,
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(
    path.join(app.getPath("userData"), "smoke-result.json"),
    JSON.stringify(report, null, 2),
  );
  process.exitCode = result.ok ? 0 : 1;
  app.quit();
}

async function smokeWindow(window) {
  // A packaged smoke test reads the real renderer and API without adding entries.
  const details = await window.webContents.executeJavaScript(`(async () => {
    const response = await fetch('/api/bootstrap');
    const data = await response.json();
    const deadline = Date.now() + 15000;
    while (!document.querySelector('main') && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const worldDeadline = Date.now() + 15000;
    let world;
    while (Date.now() < worldDeadline) {
      world = document.querySelector('.garden-render-preview') || document.querySelector('[data-world-ready]');
      if (world?.dataset.worldReady === 'fallback') break;
      if (world?.dataset.worldReady === 'true' && Number(world.dataset.worldTriangles || 0) > 0) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = world?.querySelector('canvas');
    return {
      title: document.title,
      apiStatus: response.status,
      entryCount: Array.isArray(data.entries) ? data.entries.length : -1,
      today: data.today,
      renderedMain: Boolean(document.querySelector('main')),
      hasHeading: Boolean(document.querySelector('h1')),
      bodyCharacters: document.body.textContent.length,
      worldReady: world?.dataset.worldReady || 'missing',
      worldTriangles: Number(world?.dataset.worldTriangles || 0),
      worldDrawCalls: Number(world?.dataset.worldDrawCalls || 0),
      canvasWidth: canvas?.width || 0,
      canvasHeight: canvas?.height || 0,
      rendererNodeDisabled: typeof window.require === 'undefined' && typeof window.process === 'undefined'
    };
  })()`);
  const ok =
    details.apiStatus === 200 &&
    details.entryCount >= 0 &&
    details.renderedMain &&
    details.hasHeading &&
    details.rendererNodeDisabled &&
    (details.worldReady === "fallback" ||
      (details.worldReady === "true" && details.worldTriangles > 0));
  const screenshotPath = smokeScreenshotPath(process.argv);
  if (screenshotPath) {
    mkdirSync(path.dirname(screenshotPath), { recursive: true });
    const screenshot = await window.webContents.capturePage();
    writeFileSync(screenshotPath, screenshot.toPNG());
  }
  finishSmoke({
    ok,
    ...details,
    sandboxed: window.webContents.getLastWebPreferences().sandbox,
    screenshotSaved: Boolean(screenshotPath),
  });
}

function installMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: APP_NAME,
        submenu: [
          {
            label: "About Momentum",
            click: () =>
              dialog.showMessageBox(mainWindow, {
                type: "info",
                title: "Momentum",
                message: "Momentum",
                detail: `Your daily tracker for nutrition, training, focus, and practice.\nVersion ${app.getVersion()}\nYour entries are saved privately on this computer.`,
              }),
          },
          { type: "separator" },
          { role: "quit", label: "Exit Momentum" },
        ],
      },
      { role: "editMenu" },
      {
        label: "View",
        submenu: [
          {
            id: "momentum-back",
            label: "Previous page",
            accelerator: "Alt+Left",
            enabled: false,
            click: () => {
              const history = mainWindow?.webContents.navigationHistory;
              if (history?.canGoBack()) history.goBack();
            },
          },
          {
            id: "momentum-forward",
            label: "Next page",
            accelerator: "Alt+Right",
            enabled: false,
            click: () => {
              const history = mainWindow?.webContents.navigationHistory;
              if (history?.canGoForward()) history.goForward();
            },
          },
          { type: "separator" },
          { role: "reload" },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
    ]),
  );
}

function updateHistoryMenu() {
  const history = mainWindow?.webContents.navigationHistory;
  const menu = Menu.getApplicationMenu();
  if (!history || !menu) return;
  menu.getMenuItemById("momentum-back").enabled = history.canGoBack();
  menu.getMenuItemById("momentum-forward").enabled = history.canGoForward();
}

async function launch() {
  const projectDirectory = app.getAppPath();
  const dataDirectory = app.getPath("userData");
  mkdirSync(dataDirectory, { recursive: true });
  const config = readPrivateConfig({
    dataDirectory,
    projectDirectory,
    packaged: app.isPackaged,
  });
  const { createApp } = await import(
    pathToFileURL(path.join(projectDirectory, "server", "app.js")).href
  );
  trackerApp = createApp({
    dbPath: path.join(dataDirectory, "tracker.sqlite"),
    staticDir: path.join(projectDirectory, "dist"),
    apiKey: config.apiKey,
    model: config.model,
  });
  await new Promise((resolve, reject) => {
    apiServer = trackerApp.listen(0, "127.0.0.1", resolve);
    apiServer.once("error", reject);
  });
  appOrigin = `http://127.0.0.1:${apiServer.address().port}`;

  nativeTheme.themeSource = "dark";
  const appSession = session.fromPartition("persist:momentum");
  appSession.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  appSession.setPermissionCheckHandler(() => false);
  appSession.webRequest.onHeadersReceived((details, callback) => {
    if (!trustedNavigation(details.url, appOrigin))
      return callback({ responseHeaders: details.responseHeaders });
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-src 'none'; frame-ancestors 'none'",
        ],
      },
    });
  });

  const workArea = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    title: APP_NAME,
    width: Math.min(1480, workArea.width),
    height: Math.min(980, workArea.height),
    minWidth: Math.min(800, workArea.width),
    minHeight: Math.min(650, workArea.height),
    show: false,
    backgroundColor: "#0c100e",
    icon: path.join(projectDirectory, "desktop", "assets", "momentum.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: true,
      backgroundThrottling: !isSmokeTest,
      devTools: !app.isPackaged,
      session: appSession,
    },
  });
  installMenu();
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("did-navigate", updateHistoryMenu);
  mainWindow.webContents.on("did-navigate-in-page", updateHistoryMenu);
  mainWindow.webContents.on("will-prevent-unload", (event) => {
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: "question",
      title: "Unsaved check-in",
      message: "You have an unsaved check-in. Leave without saving?",
      buttons: ["Keep editing", "Discard changes"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (choice === 1) event.preventDefault();
  });
  mainWindow.webContents.on("will-navigate", (event, target) => {
    if (!trustedNavigation(target, appOrigin)) event.preventDefault();
  });
  mainWindow.webContents.on("will-redirect", (event, target) => {
    if (!trustedNavigation(target, appOrigin)) event.preventDefault();
  });
  mainWindow.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  mainWindow.on("page-title-updated", (event) => event.preventDefault());
  mainWindow.once("ready-to-show", () => {
    if (!isSmokeTest) mainWindow.show();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  await mainWindow.loadURL(`${appOrigin}/`);
  if (isSmokeTest) await smokeWindow(mainWindow);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(async () => {
    if (isSmokeTest)
      startupTimer = setTimeout(
        () =>
          finishSmoke({ ok: false, error: "Application startup timed out." }),
        45000,
      );
    try {
      await launch();
    } catch {
      // Keep filesystem locations, configuration, and upstream errors out of dialogs.
      if (isSmokeTest)
        finishSmoke({ ok: false, error: "Application startup failed." });
      else {
        dialog.showErrorBox(
          "Momentum could not start",
          "Close any other Momentum windows and try opening the app again. Your saved entries have not been removed.",
        );
        app.quit();
      }
    }
  });
}

app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => {
  // At this point every window has accepted its beforeunload check. Do not
  // prevent this event and recursively call app.quit(): that leaves Electron
  // partway through shutdown, with no visible window but live child processes.
  if (quitting) return;
  quitting = true;
  clearTimeout(startupTimer);
  if (apiServer) {
    apiServer.closeAllConnections();
    if (apiServer.listening) apiServer.close();
  }
  // node:sqlite's close is synchronous, so WAL data is closed before Electron
  // completes its normal process teardown. No tracking write is outstanding.
  closeStore();
});
