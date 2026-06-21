const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let db = null;

// Load database first, with error handling
try {
  db = require('./db');
} catch (err) {
  console.error('FATAL: Could not load database module', err);
  app.whenReady().then(() => {
    dialog.showErrorBox(
      'Database Error',
      'Could not load the database.\n\n' + err.message +
      '\n\nTry running: npm install\nThen restart the app.'
    );
    app.quit();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    title: 'Alankar Pooja Stores',
    backgroundColor: '#EEE5D3',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.setMenuBarVisibility(false);

  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Backup database…', click: handleBackup },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Alankar Pooja Stores',
              message: 'Alankar Pooja Stores',
              detail: 'Sales Management System\nVersion 1.0.5\n\nLocal SQLite storage. Offline-first.\nWith TVS barcode scanner support.',
              buttons: ['OK'],
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function handleBackup() {
  if (!db) { dialog.showErrorBox('Backup error', 'Database not loaded'); return; }
  const dbPath = db.Backup.getDbPath();
  const defaultName = 'alankar-backup-' + new Date().toISOString().split('T')[0] + '.db';
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Backup database',
    defaultPath: defaultName,
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
  });
  if (!result.canceled && result.filePath) {
    try {
      fs.copyFileSync(dbPath, result.filePath);
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        message: 'Backup successful',
        detail: 'Saved to: ' + result.filePath,
      });
    } catch (err) {
      dialog.showErrorBox('Backup failed', err.message);
    }
  }
}

// Wrap a handler with error logging — so errors don't silently fail
function safeHandle(channel, fn) {
  ipcMain.handle(channel, async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      console.error('[IPC ERROR]', channel, err);
      throw new Error(err.message || String(err));
    }
  });
}

// REGISTER ALL IPC HANDLERS BEFORE createWindow — eliminates race condition
function registerHandlers() {
  if (!db) return;
  const { Products, Customers, Bills, Stock, Credit, Reports, Settings, Backup } = db;

  safeHandle('products:list',        ()           => Products.list());
  safeHandle('products:byId',        (_, id)      => Products.byId(id));
  safeHandle('products:byBarcode',   (_, bc)      => Products.byBarcode(bc));
  safeHandle('products:insert',      (_, p)       => Products.insert(p));
  safeHandle('products:update',      (_, p)       => Products.update(p));
  safeHandle('products:remove',      (_, id)      => Products.remove(id));
  safeHandle('products:adjustStock', (_, id, d)   => Products.adjustStock(id, d));

  safeHandle('customers:list',    ()       => Customers.list());
  safeHandle('customers:byPhone', (_, ph)  => Customers.byPhone(ph));
  safeHandle('customers:insert',  (_, c)   => Customers.insert(c));

  safeHandle('bills:save',  (_, b, items) => Bills.save(b, items));
  safeHandle('bills:list',  (_, f, t, m)  => Bills.list(f, t, m));
  safeHandle('bills:byId',  (_, id)       => Bills.byId(id));
  safeHandle('bills:items', (_, id)       => Bills.items(id));

  safeHandle('stock:add',     (_, e) => Stock.add(e));
  safeHandle('stock:history', ()     => Stock.history());

  safeHandle('credit:recordPayment', (_, p) => Credit.recordPayment(p));
  safeHandle('credit:entries',       ()    => Credit.entries());
  safeHandle('credit:payments',      ()    => Credit.payments());
  safeHandle('credit:totals',        ()    => Credit.totals());

  safeHandle('reports:dashboard', ()      => Reports.dashboard());
  safeHandle('reports:gst',       (_, m)  => Reports.gst(m));
  safeHandle('reports:gstFull',   (_, m)  => Reports.gstFull(m));
  safeHandle('reports:monthly',   (_, m)  => Reports.monthly(m));

  safeHandle('settings:getAll',  ()           => Settings.getAll());
  safeHandle('settings:set',     (_, k, v)    => Settings.set(k, v));
  safeHandle('settings:setMany', (_, obj)     => Settings.setMany(obj));

  safeHandle('backup:export',    () => handleBackup());
  safeHandle('backup:getDbPath', () => Backup.getDbPath());

  safeHandle('print:html', (_, htmlContent) => {
    return new Promise((resolve) => {
      const printWindow = new BrowserWindow({
        width: 420,
        height: 700,
        show: false,
        title: 'Print',
        parent: mainWindow,
        webPreferences: { nodeIntegration: false, sandbox: true },
      });
      printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
      printWindow.webContents.once('did-finish-load', () => {
        setTimeout(() => {
          printWindow.webContents.print({ silent: false, printBackground: true }, () => {
            printWindow.close();
            resolve(true);
          });
        }, 400);
      });
    });
  });

  console.log('[IPC] All 30 handlers registered successfully');
}

app.whenReady().then(() => {
  // CRITICAL: Register handlers BEFORE creating window — no race condition possible
  registerHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
