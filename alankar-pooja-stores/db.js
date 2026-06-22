const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const userDataPath = app.getPath('userData');
if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
const dbPath = path.join(userDataPath, 'alankar.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Other',
    unit TEXT DEFAULT 'Piece',
    hsn TEXT DEFAULT '',
    gst_rate REAL DEFAULT 5,
    selling_price REAL NOT NULL,
    cost_price REAL DEFAULT 0,
    stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 10,
    barcode TEXT UNIQUE,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
  CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE,
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    credit_balance REAL DEFAULT 0,
    total_purchases REAL DEFAULT 0,
    purchase_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'New',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

  CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_number TEXT UNIQUE NOT NULL,
    customer_name TEXT DEFAULT 'Walk-in',
    customer_phone TEXT DEFAULT '',
    buyer_gstin TEXT DEFAULT '',
    cashier TEXT DEFAULT 'Admin',
    subtotal REAL DEFAULT 0,
    cgst REAL DEFAULT 0,
    sgst REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    payment_mode TEXT DEFAULT 'Cash',
    bill_date TEXT DEFAULT (date('now','localtime')),
    bill_time TEXT DEFAULT (time('now','localtime')),
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(bill_date);
  CREATE INDEX IF NOT EXISTS idx_bills_phone ON bills(customer_phone);

  CREATE TABLE IF NOT EXISTS bill_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    product_name TEXT NOT NULL,
    hsn TEXT DEFAULT '',
    qty REAL DEFAULT 1,
    rate REAL DEFAULT 0,
    gst_rate REAL DEFAULT 0,
    base_amount REAL DEFAULT 0,
    gst_amount REAL DEFAULT 0,
    total_amount REAL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);

  CREATE TABLE IF NOT EXISTS stock_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    qty_added REAL DEFAULT 0,
    cost_price REAL DEFAULT 0,
    supplier TEXT DEFAULT '',
    supplier_gstin TEXT DEFAULT '',
    invoice_no TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    entry_date TEXT DEFAULT (date('now','localtime')),
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS credit_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER REFERENCES bills(id),
    customer_phone TEXT NOT NULL,
    customer_name TEXT DEFAULT '',
    amount REAL DEFAULT 0,
    payment_mode TEXT DEFAULT 'Cash',
    notes TEXT DEFAULT '',
    payment_date TEXT DEFAULT (date('now','localtime')),
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_credit_phone ON credit_payments(customer_phone);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

const defaultSettings = {
  store_name:    'Alankar Pooja Stores',
  store_address: 'Hyderabad, Telangana',
  store_phone:   '9000000000',
  store_email:   '',
  gstin:         '36AABCA1234Z1Z5',
  cashier_name:  'Admin',
  bill_footer:   'Thank you for your purchase! Visit Again. Jai Mata Di',
  print_size:    '80mm',
  // TSC label printer settings
  tsc_label_width:  '38',  // mm — single label width
  tsc_label_height: '25',  // mm — single label height
  tsc_column_gap:   '2',   // mm — gap between the 2 columns
  tsc_row_gap:      '2',   // mm — gap between rows
  tsc_columns:      '2',   // labels per row (TE244 = 2)
  tsc_printer_name: 'TSC TE244',
};
for (const [k, v] of Object.entries(defaultSettings)) {
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(k, v);
}

const productCount = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
if (productCount === 0) {
  const seed = db.prepare(`
    INSERT INTO products (name,category,unit,hsn,gst_rate,selling_price,cost_price,stock,min_stock,barcode)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `);
  const seedData = [
    ['Agarbatti Premium Pack','Agarbatti & Dhoop','Pack','3307',5,45,28,120,20,'8901234567001'],
    ['Clay Diya Set of 10','Diyas & Lamps','Pack','6914',5,30,18,8,15,'8901234567002'],
    ['Kumkum Powder 50g','Camphor & Kumkum','Pack','3304',12,20,10,55,10,'8901234567003'],
    ['Camphor Tablets Box','Camphor & Kumkum','Box','2914',5,35,20,40,10,'8901234567004'],
    ['Tulsi Garland','Flowers & Garlands','Piece','0604',0,25,12,6,10,'8901234567005'],
    ['Brass Diya Small','Diyas & Lamps','Piece','8311',12,150,90,22,5,'8901234567006'],
    ['Puja Thali Set','Puja Thali','Piece','7323',12,350,200,12,3,'8901234567007'],
    ['Sandalwood Powder 100g','Camphor & Kumkum','Pack','3307',12,80,45,30,8,'8901234567008'],
    ['Cotton Wicks (100pcs)','Diyas & Lamps','Pack','5601',5,15,8,60,15,'8901234567009'],
    ['Coconut Medium','Coconut & Fruits','Piece','0801',0,30,18,25,10,'8901234567010'],
    ['Ganesha Idol Brass','Idols & Murtis','Piece','8311',12,850,500,8,3,'8901234567011'],
    ['Lakshmi Idol Medium','Idols & Murtis','Piece','8311',12,650,400,10,3,'8901234567012'],
    ['Sacred Thread Bundle','Sacred Threads','Bundle','5605',5,40,22,45,10,'8901234567013'],
    ['Hanuman Chalisa Book','Books & Mantras','Piece','4901',0,25,15,30,10,'8901234567014'],
    ['Pure Ghee Lamp Oil','Diyas & Lamps','Pack','1517',5,180,120,18,5,'8901234567015'],
  ];
  db.transaction(() => seedData.forEach(r => seed.run(...r)))();
}

const Products = {
  list:        () => db.prepare('SELECT * FROM products WHERE is_active=1 ORDER BY name').all(),
  byId:        (id) => db.prepare('SELECT * FROM products WHERE id=?').get(id),
  byBarcode:   (bc) => db.prepare('SELECT * FROM products WHERE barcode=?').get(bc) || null,
  insert:      (p) => db.prepare(`
    INSERT INTO products (name,category,unit,hsn,gst_rate,selling_price,cost_price,stock,min_stock,barcode)
    VALUES (@name,@category,@unit,@hsn,@gst_rate,@selling_price,@cost_price,@stock,@min_stock,@barcode)
  `).run(p),
  update:      (p) => db.prepare(`
    UPDATE products SET name=@name, category=@category, unit=@unit, hsn=@hsn,
    gst_rate=@gst_rate, selling_price=@selling_price, cost_price=@cost_price,
    min_stock=@min_stock, barcode=@barcode, updated_at=datetime('now','localtime')
    WHERE id=@id
  `).run(p),
  remove:      (id) => db.prepare('UPDATE products SET is_active=0 WHERE id=?').run(id),
  adjustStock: (id, delta) => db.prepare(
    "UPDATE products SET stock = MAX(0, stock + ?), updated_at=datetime('now','localtime') WHERE id=?"
  ).run(delta, id),
};

const Customers = {
  list:    () => db.prepare('SELECT * FROM customers ORDER BY name').all(),
  byPhone: (ph) => db.prepare('SELECT * FROM customers WHERE phone=?').get(ph) || null,
  insert:  (c) => db.prepare(`
    INSERT OR IGNORE INTO customers (name, phone, email, address)
    VALUES (@name, @phone, @email, @address)
  `).run(c),
  upsert: (data) => {
    if (!data.phone) return null;
    const existing = Customers.byPhone(data.phone);
    if (existing) {
      db.prepare(`
        UPDATE customers SET
          name = COALESCE(NULLIF(@name,''), name),
          credit_balance = credit_balance + @creditDelta,
          total_purchases = total_purchases + @totalDelta,
          purchase_count = purchase_count + 1,
          status = CASE
            WHEN purchase_count + 1 >= 10 THEN 'Loyal'
            WHEN purchase_count + 1 >= 3  THEN 'Regular'
            ELSE status
          END
        WHERE phone=@phone
      `).run(data);
    } else {
      db.prepare(`
        INSERT INTO customers (name, phone, credit_balance, total_purchases, purchase_count, status)
        VALUES (@name, @phone, @creditDelta, @totalDelta, 1, 'New')
      `).run(data);
    }
  },
};

const Bills = {
  save: db.transaction((bill, items) => {
    // Insert with placeholder bill_number, then update with sequential number based on id
    const placeholder = 'TEMP-' + Date.now();
    const res = db.prepare(`
      INSERT INTO bills (bill_number,customer_name,customer_phone,buyer_gstin,cashier,subtotal,cgst,sgst,discount,total,payment_mode,bill_date,bill_time)
      VALUES (?,@customer_name,@customer_phone,@buyer_gstin,@cashier,@subtotal,@cgst,@sgst,@discount,@total,@payment_mode,@bill_date,@bill_time)
    `).run(placeholder, {
      customer_name: bill.customer_name,
      customer_phone: bill.customer_phone,
      buyer_gstin: bill.buyer_gstin || '',
      cashier: bill.cashier || 'Admin',
      subtotal: bill.subtotal,
      cgst: bill.cgst,
      sgst: bill.sgst,
      discount: bill.discount,
      total: bill.total,
      payment_mode: bill.payment_mode,
      bill_date: bill.bill_date,
      bill_time: bill.bill_time,
    });
    const billId = res.lastInsertRowid;
    const billNum = 'BILL-' + String(billId).padStart(6, '0');
    db.prepare('UPDATE bills SET bill_number=? WHERE id=?').run(billNum, billId);

    const itemStmt = db.prepare(`
      INSERT INTO bill_items (bill_id,product_id,product_name,hsn,qty,rate,gst_rate,base_amount,gst_amount,total_amount)
      VALUES (@bill_id,@product_id,@product_name,@hsn,@qty,@rate,@gst_rate,@base_amount,@gst_amount,@total_amount)
    `);
    for (const item of items) {
      itemStmt.run({ bill_id: billId, ...item });
      if (item.product_id) Products.adjustStock(item.product_id, -item.qty);
    }

    if (bill.customer_phone) {
      Customers.upsert({
        name: bill.customer_name,
        phone: bill.customer_phone,
        creditDelta: bill.payment_mode === 'Credit' ? bill.total : 0,
        totalDelta: bill.total,
      });
    }
    return { billId, billNum };
  }),

  list: (from, to, mode) => {
    let q = 'SELECT * FROM bills WHERE bill_date BETWEEN ? AND ?';
    const params = [from, to];
    if (mode) { q += ' AND payment_mode=?'; params.push(mode); }
    return db.prepare(q + ' ORDER BY id DESC').all(...params);
  },

  byId:  (id) => db.prepare('SELECT * FROM bills WHERE id=?').get(id),
  items: (billId) => db.prepare('SELECT * FROM bill_items WHERE bill_id=?').all(billId),
};

const Stock = {
  add: (entry) => db.transaction(() => {
    db.prepare(`
      INSERT INTO stock_entries (product_id,product_name,qty_added,cost_price,supplier,supplier_gstin,invoice_no,notes)
      VALUES (@product_id,@product_name,@qty_added,@cost_price,@supplier,@supplier_gstin,@invoice_no,@notes)
    `).run({
      product_id: entry.product_id, product_name: entry.product_name,
      qty_added: entry.qty_added, cost_price: entry.cost_price,
      supplier: entry.supplier || '', supplier_gstin: entry.supplier_gstin || '',
      invoice_no: entry.invoice_no || '', notes: entry.notes || '',
    });
    Products.adjustStock(entry.product_id, entry.qty_added);
    if (entry.cost_price > 0) {
      db.prepare("UPDATE products SET cost_price=?, updated_at=datetime('now','localtime') WHERE id=?")
        .run(entry.cost_price, entry.product_id);
    }
    return { ok: true };
  })(),

  history: (limit = 200) => db.prepare('SELECT * FROM stock_entries ORDER BY id DESC LIMIT ?').all(limit),
};

const Credit = {
  recordPayment: db.transaction((payment) => {
    db.prepare(`
      INSERT INTO credit_payments (bill_id, customer_phone, customer_name, amount, payment_mode, notes)
      VALUES (@bill_id, @customer_phone, @customer_name, @amount, @payment_mode, @notes)
    `).run(payment);
    db.prepare('UPDATE customers SET credit_balance = MAX(0, credit_balance - ?) WHERE phone=?')
      .run(payment.amount, payment.customer_phone);
    return { ok: true };
  }),

  entries: () => db.prepare(`
    SELECT
      b.id, b.bill_number, b.customer_name, b.customer_phone, b.bill_date,
      b.total,
      COALESCE((SELECT SUM(amount) FROM credit_payments WHERE customer_phone = b.customer_phone AND created_at >= b.created_at), 0) AS paid_amount,
      MAX(0, b.total - COALESCE((SELECT SUM(amount) FROM credit_payments WHERE customer_phone = b.customer_phone AND created_at >= b.created_at), 0)) AS due_amount
    FROM bills b
    WHERE b.payment_mode='Credit'
    ORDER BY b.id DESC
  `).all(),

  payments: () => db.prepare('SELECT * FROM credit_payments ORDER BY id DESC LIMIT 100').all(),

  totals: () => ({
    outstanding: db.prepare('SELECT COALESCE(SUM(credit_balance),0) AS v FROM customers WHERE credit_balance>0').get().v,
    debtors:     db.prepare('SELECT COUNT(*) AS v FROM customers WHERE credit_balance>0').get().v,
    collected:   db.prepare('SELECT COALESCE(SUM(amount),0) AS v FROM credit_payments').get().v,
  }),
};

const Reports = {
  dashboard: () => ({
    todaySales:  db.prepare("SELECT COALESCE(SUM(total),0) AS v FROM bills WHERE bill_date=date('now','localtime')").get().v,
    todayCount:  db.prepare("SELECT COUNT(*) AS v FROM bills WHERE bill_date=date('now','localtime')").get().v,
    monthSales:  db.prepare("SELECT COALESCE(SUM(total),0) AS v FROM bills WHERE strftime('%Y-%m',bill_date)=strftime('%Y-%m','now','localtime')").get().v,
    monthCount:  db.prepare("SELECT COUNT(*) AS v FROM bills WHERE strftime('%Y-%m',bill_date)=strftime('%Y-%m','now','localtime')").get().v,
    totalCredit: db.prepare('SELECT COALESCE(SUM(credit_balance),0) AS v FROM customers WHERE credit_balance>0').get().v,
    creditCount: db.prepare('SELECT COUNT(*) AS v FROM customers WHERE credit_balance>0').get().v,
    lowStock:    db.prepare('SELECT COUNT(*) AS v FROM products WHERE is_active=1 AND stock < min_stock').get().v,
    totalProducts: db.prepare('SELECT COUNT(*) AS v FROM products WHERE is_active=1').get().v,
    totalCustomers: db.prepare('SELECT COUNT(*) AS v FROM customers').get().v,
    recentBills:  db.prepare('SELECT * FROM bills ORDER BY id DESC LIMIT 8').all(),
    payMix:       db.prepare(`
      SELECT payment_mode, COUNT(*) AS cnt, COALESCE(SUM(total),0) AS total
      FROM bills WHERE strftime('%Y-%m',bill_date)=strftime('%Y-%m','now','localtime')
      GROUP BY payment_mode
    `).all(),
    topProducts:  db.prepare(`
      SELECT bi.product_name, SUM(bi.qty) AS qty_sold, SUM(bi.total_amount) AS revenue
      FROM bill_items bi JOIN bills b ON b.id=bi.bill_id
      WHERE strftime('%Y-%m',b.bill_date)=strftime('%Y-%m','now','localtime')
      GROUP BY bi.product_name ORDER BY revenue DESC LIMIT 5
    `).all(),
    lowStockItems: db.prepare('SELECT name, stock, min_stock FROM products WHERE is_active=1 AND stock<min_stock ORDER BY stock ASC LIMIT 6').all(),
  }),

  gst: (month) => db.prepare(`
    SELECT bi.gst_rate,
      COALESCE(SUM(bi.base_amount),0) AS taxable,
      COALESCE(SUM(bi.gst_amount/2),0) AS cgst,
      COALESCE(SUM(bi.gst_amount/2),0) AS sgst,
      COALESCE(SUM(bi.gst_amount),0)   AS total_gst,
      COUNT(*) AS txn_count
    FROM bill_items bi JOIN bills b ON b.id=bi.bill_id
    WHERE strftime('%Y-%m',b.bill_date)=?
    GROUP BY bi.gst_rate ORDER BY bi.gst_rate
  `).all(month),

  gstFull: (month) => {
    // Sales by GST rate (Output GST)
    const salesByRate = db.prepare(`
      SELECT bi.gst_rate,
        COALESCE(SUM(bi.total_amount),0) AS sales_amount,
        COALESCE(SUM(bi.base_amount),0)  AS taxable,
        COALESCE(SUM(bi.gst_amount/2),0) AS cgst,
        COALESCE(SUM(bi.gst_amount/2),0) AS sgst,
        COALESCE(SUM(bi.gst_amount),0)   AS total_gst
      FROM bill_items bi JOIN bills b ON b.id=bi.bill_id
      WHERE strftime('%Y-%m',b.bill_date)=?
      GROUP BY bi.gst_rate ORDER BY bi.gst_rate
    `).all(month);

    // Purchases (from stock_entries) by GST rate (Input GST)
    // taxable = qty * cost_price (assumed pre-GST cost)
    // gst rate comes from current product master
    const purchasesByRate = db.prepare(`
      SELECT p.gst_rate,
        COALESCE(SUM(se.qty_added * se.cost_price * (1 + p.gst_rate/100.0)),0) AS purchase_amount,
        COALESCE(SUM(se.qty_added * se.cost_price),0)                          AS taxable,
        COALESCE(SUM(se.qty_added * se.cost_price * p.gst_rate/100.0 / 2),0)   AS cgst,
        COALESCE(SUM(se.qty_added * se.cost_price * p.gst_rate/100.0 / 2),0)   AS sgst,
        COALESCE(SUM(se.qty_added * se.cost_price * p.gst_rate/100.0),0)       AS total_gst
      FROM stock_entries se JOIN products p ON p.id = se.product_id
      WHERE strftime('%Y-%m', se.entry_date) = ?
      GROUP BY p.gst_rate ORDER BY p.gst_rate
    `).all(month);

    const salesItems = db.prepare(`
      SELECT bi.product_name, bi.hsn, SUM(bi.qty) AS qty,
        bi.gst_rate,
        COALESCE(SUM(bi.base_amount),0) AS taxable,
        COALESCE(SUM(bi.gst_amount/2),0) AS cgst,
        COALESCE(SUM(bi.gst_amount/2),0) AS sgst,
        COALESCE(SUM(bi.total_amount),0) AS total
      FROM bill_items bi JOIN bills b ON b.id=bi.bill_id
      WHERE strftime('%Y-%m',b.bill_date)=?
      GROUP BY bi.product_name, bi.hsn, bi.gst_rate
      ORDER BY total DESC
    `).all(month);

    const purchaseItems = db.prepare(`
      SELECT se.product_name, p.hsn, p.gst_rate,
        SUM(se.qty_added) AS qty,
        COALESCE(SUM(se.qty_added * se.cost_price),0) AS taxable,
        COALESCE(SUM(se.qty_added * se.cost_price * p.gst_rate/100.0 / 2),0) AS cgst,
        COALESCE(SUM(se.qty_added * se.cost_price * p.gst_rate/100.0 / 2),0) AS sgst,
        COALESCE(SUM(se.qty_added * se.cost_price * (1 + p.gst_rate/100.0)),0) AS total
      FROM stock_entries se JOIN products p ON p.id = se.product_id
      WHERE strftime('%Y-%m', se.entry_date) = ?
      GROUP BY se.product_name, p.hsn, p.gst_rate
      ORDER BY total DESC
    `).all(month);

    return { salesByRate, purchasesByRate, salesItems, purchaseItems };
  },

  monthly: (month) => ({
    bills: db.prepare("SELECT * FROM bills WHERE strftime('%Y-%m',bill_date)=? ORDER BY bill_date").all(month),
    daily: db.prepare(`
      SELECT bill_date, COUNT(*) AS cnt,
        COALESCE(SUM(total),0) AS revenue,
        COALESCE(SUM(cgst+sgst),0) AS gst
      FROM bills WHERE strftime('%Y-%m',bill_date)=?
      GROUP BY bill_date ORDER BY bill_date
    `).all(month),
    payMix: db.prepare(`
      SELECT payment_mode, COUNT(*) AS cnt, COALESCE(SUM(total),0) AS amount
      FROM bills WHERE strftime('%Y-%m',bill_date)=?
      GROUP BY payment_mode
    `).all(month),
    topProds: db.prepare(`
      SELECT bi.product_name,
        SUM(bi.qty) AS qty,
        COALESCE(SUM(bi.total_amount),0) AS revenue,
        COALESCE(SUM(bi.gst_amount),0)   AS gst
      FROM bill_items bi JOIN bills b ON b.id=bi.bill_id
      WHERE strftime('%Y-%m',b.bill_date)=?
      GROUP BY bi.product_name ORDER BY revenue DESC LIMIT 15
    `).all(month),
  }),
};

const Settings = {
  getAll: () => {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  },
  set: (key, value) => db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value),
  setMany: (obj) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    db.transaction(() => Object.entries(obj).forEach(([k, v]) => stmt.run(k, v)))();
  },
};

const Backup = {
  export: (destPath) => {
    db.backup(destPath).then(() => true).catch(() => false);
    fs.copyFileSync(dbPath, destPath);
    return { ok: true, path: destPath };
  },
  getDbPath: () => dbPath,
};

module.exports = { Products, Customers, Bills, Stock, Credit, Reports, Settings, Backup };
