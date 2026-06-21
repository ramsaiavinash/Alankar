const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    title: 'Alankar Pooja Stores',
    backgroundColor: '#f7f6f2',
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
              detail: 'Sales Management System\nVersion 1.0.0\n\nLocal SQLite storage. Offline-first.',
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
  const db = require('./db');
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

app.whenReady().then(() => {
  createWindow();

  const db = require('./db');
  const { Products, Customers, Bills, Stock, Credit, Reports, Settings, Backup } = db;

  ipcMain.handle('products:list',        ()           => Products.list());
  ipcMain.handle('products:byId',        (_, id)      => Products.byId(id));
  ipcMain.handle('products:byBarcode',   (_, bc)      => Products.byBarcode(bc));
  ipcMain.handle('products:insert',      (_, p)       => Products.insert(p));
  ipcMain.handle('products:update',      (_, p)       => Products.update(p));
  ipcMain.handle('products:remove',      (_, id)      => Products.remove(id));
  ipcMain.handle('products:adjustStock', (_, id, d)   => Products.adjustStock(id, d));

  ipcMain.handle('customers:list',    ()       => Customers.list());
  ipcMain.handle('customers:byPhone', (_, ph)  => Customers.byPhone(ph));
  ipcMain.handle('customers:insert',  (_, c)   => Customers.insert(c));

  ipcMain.handle('bills:save',  (_, b, items) => Bills.save(b, items));
  ipcMain.handle('bills:list',  (_, f, t, m)  => Bills.list(f, t, m));
  ipcMain.handle('bills:byId',  (_, id)       => Bills.byId(id));
  ipcMain.handle('bills:items', (_, id)       => Bills.items(id));

  ipcMain.handle('stock:add',     (_, e) => Stock.add(e));
  ipcMain.handle('stock:history', ()     => Stock.history());

  ipcMain.handle('credit:recordPayment', (_, p) => Credit.recordPayment(p));
  ipcMain.handle('credit:entries',       ()    => Credit.entries());
  ipcMain.handle('credit:payments',      ()    => Credit.payments());
  ipcMain.handle('credit:totals',        ()    => Credit.totals());

  ipcMain.handle('reports:dashboard', ()      => Reports.dashboard());
  ipcMain.handle('reports:gst',       (_, m)  => Reports.gst(m));
  ipcMain.handle('reports:gstFull',   (_, m)  => Reports.gstFull(m));
  ipcMain.handle('reports:monthly',   (_, m)  => Reports.monthly(m));

  ipcMain.handle('settings:getAll',  ()           => Settings.getAll());
  ipcMain.handle('settings:set',     (_, k, v)    => Settings.set(k, v));
  ipcMain.handle('settings:setMany', (_, obj)     => Settings.setMany(obj));

  ipcMain.handle('backup:export',    () => handleBackup());
  ipcMain.handle('backup:getDbPath', () => Backup.getDbPath());

  ipcMain.handle('print:html', (_, htmlContent) => {
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
        });
      }, 400);
    });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
