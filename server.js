const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');
require('dotenv').config();

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

// --- SESSION MIDDLEWARE CONFIGURATION ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'autocare_secret_key_123',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // Session valid for 24 hours
}));

// Make user info available across all EJS templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// --- AUTHENTICATION MIDDLEWARE ---
// Protects internal CRM pages from unauthenticated users
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

// ==========================================
// --- AUTHENTICATION ROUTES ---
// ==========================================

// 1. Render Login Page
app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { error: null });
});

// 2. Handle Login Submission
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
    
    if (result.rows.length === 0) {
      return res.render('login', { error: 'Invalid username or password' });
    }

    const user = result.rows[0];

    // Verify hashed password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.render('login', { error: 'Invalid username or password' });
    }

    // Save user session
    req.session.user = {
      id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role
    };

    res.redirect('/');
  } catch (err) {
    console.error('Login Error:', err);
    res.render('login', { error: 'An unexpected error occurred. Please try again.' });
  }
});

// 3. Render Registration Page
app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

// 4. Handle Registration Submission
app.post('/register', async (req, res) => {
  const { username, password, full_name } = req.body;

  try {
    // Check if username already exists
    const existing = await db.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
    if (existing.rows.length > 0) {
      return res.render('register', { error: 'Username is already taken' });
    }

    // Hash the password securely
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Save user
    await db.query(
      'INSERT INTO users (username, password_hash, full_name) VALUES ($1, $2, $3)',
      [username.trim(), password_hash, full_name.trim()]
    );

    res.redirect('/login');
  } catch (err) {
    console.error('Registration Error:', err);
    res.render('register', { error: 'Error creating account.' });
  }
});

// 5. Handle Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// ==========================================
// --- PROTECTED MODULE ROUTES ---
// (Apply `requireAuth` middleware to restrict access)
// ==========================================

app.get('/', requireAuth, (req, res) => {
  res.render('index');
});

// --- HOME / DASHBOARD ---
app.get('/', (req, res) => {
  res.render('index');
});

// --- MODULE 1: CUSTOMER DATA ---
// Only loads customers when a search query is submitted, avoiding data dump on load
app.get('/customers', requireAuth, async (req, res) => {
  try {
    const search = req.query.search || '';
    let customers = [];
    
    if (search.trim() !== '') {
      const query = `
        SELECT * FROM customers 
        WHERE customer_name ILIKE $1 OR vehicle_number ILIKE $1 OR phone_no ILIKE $1
        ORDER BY created_at DESC
      `;
      const result = await db.query(query, [`%${search.trim()}%`]);
      customers = result.rows;
    }

    res.render('customers', { customers, search });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database Error');
  }
});

// Add New Customer
app.post('/customers/new',requireAuth, async (req, res) => {
  const { customer_name, vehicle_number, address1, address2, city, state, phone_no, branch_name, engine_no, chassis_no } = req.body;
  try {
    await db.query(
      `INSERT INTO customers (customer_name, vehicle_number, address1, address2, city, state, phone_no, branch_name, engine_no, chassis_no) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [customer_name, vehicle_number, address1, address2, city, state, phone_no, branch_name, engine_no, chassis_no]
    );
    res.redirect('/customers');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error saving customer.');
  }
});

// View Customer Detail & Visit History
app.get('/customers/:id', requireAuth, async (req, res) => {
  try {
    const customerId = req.params.id;
    const custRes = await db.query('SELECT * FROM customers WHERE customer_id = $1', [customerId]);
    if (custRes.rows.length === 0) return res.status(404).send('Customer not found');

    const visitsRes = await db.query(
      'SELECT * FROM customer_visits WHERE customer_id = $1 ORDER BY visit_date DESC',
      [customerId]
    );

    res.render('customer-detail', { customer: custRes.rows[0], visits: visitsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database Error');
  }
});

// Render Edit Customer Page
app.get('/customers/:id/edit', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM customers WHERE customer_id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).send('Customer not found');
    res.render('edit-customer', { customer: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database Error');
  }
});

// Update Customer Record
app.post('/customers/:id/edit', requireAuth, async (req, res) => {
  const { customer_name, vehicle_number, address1, address2, city, state, phone_no, branch_name, engine_no, chassis_no } = req.body;
  try {
    await db.query(
      `UPDATE customers SET customer_name=$1, vehicle_number=$2, address1=$3, address2=$4, city=$5, state=$6, phone_no=$7, branch_name=$8, engine_no=$9, chassis_no=$10 WHERE customer_id=$11`,
      [customer_name, vehicle_number, address1, address2, city, state, phone_no, branch_name, engine_no, chassis_no, req.params.id]
    );
    res.redirect(`/customers/${req.params.id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating customer profile.');
  }
});

// Add Visit Record
app.post('/customers/:id/visits/new', requireAuth, async (req, res) => {
  const customerId = req.params.id;
  const { visit_date, odometer_reading, service_type, work_description, parts_replaced, bill_amount } = req.body;
  try {
    await db.query(
      `INSERT INTO customer_visits (customer_id, visit_date, odometer_reading, service_type, work_description, parts_replaced, bill_amount) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [customerId, visit_date, odometer_reading || null, service_type, work_description, parts_replaced, bill_amount]
    );
    res.redirect(`/customers/${customerId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error recording visit.');
  }
});

// ==========================================
// --- MODULE 3: STOCK MANAGEMENT ---
// ==========================================

// 1. Search & View Stock Items
// --- MODULE 3: STOCK MANAGEMENT (Search Only, No Initial Load) ---
app.get('/stock', requireAuth, async (req, res) => {
  try {
    const search = req.query.search || '';
    let items = [];

    // Only query database if the user typed something in the search bar
    if (search.trim() !== '') {
      const query = `
        SELECT * FROM spare_parts_inventory 
        WHERE product_code ILIKE $1 OR product_name ILIKE $1 OR source ILIKE $1
        ORDER BY product_name ASC
      `;
      const result = await db.query(query, [`%${search.trim()}%`]);
      items = result.rows;
    } else {
      // Else, show top 50 items by closing stock
      const query = `
        SELECT * FROM spare_parts_inventory 
        ORDER BY closing_stock DESC LIMIT 50
      `;
      const result = await db.query(query);
      items = result.rows;
    }

    res.render('stock', { items, search });
  } catch (err) {
    console.error('Stock Route Error:', err);
    res.status(500).send('Database Error');
  }
});
// 2. Add New Spare Part Item
app.post('/stock/new', requireAuth, async (req, res) => {
  const { product_code, product_name, closing_stock, source, mrp_price, purchase_price } = req.body;
  try {
    await db.query(
      `INSERT INTO spare_parts_inventory (product_code, product_name, closing_stock, source, mrp_price, purchase_price)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        product_code, 
        product_name, 
        closing_stock || 0, 
        source, 
        mrp_price || 0.00, 
        purchase_price || 0.00
      ]
    );
    res.redirect('/stock');
  } catch (err) {
    console.error('Error adding stock:', err);
    res.status(500).send('Error adding stock item.');
  }
});

// 3. Render Edit Stock Item Page
app.get('/stock/:id/edit', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM spare_parts_inventory WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).send('Stock item not found');
    res.render('edit-stock', { item: rows[0] });
  } catch (err) {
    console.error('Error fetching stock for edit:', err);
    res.status(500).send('Database Error');
  }
});

// 4. Update Stock Item
app.post('/stock/:id/edit', requireAuth, async (req, res) => {
  const { product_code, product_name, closing_stock, source, mrp_price, purchase_price } = req.body;
  try {
    await db.query(
      `UPDATE spare_parts_inventory 
       SET product_code=$1, product_name=$2, closing_stock=$3, source=$4, mrp_price=$5, purchase_price=$6
       WHERE id=$7`,
      [
        product_code, 
        product_name, 
        closing_stock || 0, 
        source, 
        mrp_price || 0.00, 
        purchase_price || 0.00, 
        req.params.id
      ]
    );
    res.redirect('/stock');
  } catch (err) {
    console.error('Error updating stock item:', err);
    res.status(500).send('Error updating stock item.');
  }
});

const PDFDocument = require('pdfkit');

// ==========================================
// --- MODULE 2: BILLING & PDF GENERATION ---
// ==========================================

// 1. Render Billing Form / Search Customers & Parts
app.get('/billing', requireAuth, async (req, res) => {
  try {
    // Safely capture query parameters, defaulting to empty strings if missing
    const custSearch = req.query.custSearch ? req.query.custSearch.trim() : '';
    const partSearch = req.query.partSearch ? req.query.partSearch.trim() : '';
    
    let customers = [];
    let parts = [];

    if (custSearch !== '') {
      const custRes = await db.query(
        'SELECT * FROM customers WHERE customer_name ILIKE $1 OR vehicle_number ILIKE $1 OR phone_no ILIKE $1 LIMIT 10',
        [`%${custSearch.trim()}%`]
      );
      customers = custRes.rows;
    }

    if (partSearch !== '') {
      const partRes = await db.query(
        'SELECT * FROM spare_parts_inventory WHERE product_code ILIKE $1 OR product_name ILIKE $1 LIMIT 10',
        [`%${partSearch.trim()}%`]
      );
      parts = partRes.rows;
    }

    // Recent Invoices List
    const invoicesRes = await db.query(`
      SELECT i.*, c.customer_name 
      FROM invoices i 
      LEFT JOIN customers c ON i.customer_id = c.customer_id 
      ORDER BY i.created_at DESC LIMIT 20
    `);

    console.log('Billing Route: Customers:', customers.length, 'Parts:', parts.length, 'Invoices:', invoicesRes.rows.length);

    res.render('billing', { 
      customers, 
      parts, 
      invoices: invoicesRes.rows, 
      custSearch, 
      partSearch,
      billGenerated: req.query.billGenerated === 'success'
    });
  } catch (err) {
    console.error('Billing Route Error:', err);
    res.status(500).send('Database Error');
  }
});

app.post('/billing/new', requireAuth, async (req, res) => {
  const { 
    customer_id, 
    bill_to, 
    bill_to_address, 
    vehicle_registration_id, 
    service_type, 
    total_bill, 
    part_ids 
  } = req.body;

  // Convert empty customer_id to null for non-system walk-in customers
  const validCustomerId = (customer_id && customer_id.trim() !== '') ? parseInt(customer_id) : null;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const invoiceRes = await client.query(
      `INSERT INTO invoices (bill_to, total_bill, service_type, customer_id, bill_to_address, vehicle_registration_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [bill_to, total_bill || 0.00, service_type, validCustomerId, bill_to_address, vehicle_registration_id]
    );

    const invoiceId = invoiceRes.rows[0].id;

    if (part_ids) {
      const partsArray = Array.isArray(part_ids) ? part_ids : [part_ids];
      for (const partId of partsArray) {
        if (partId) {
          await client.query(
            `INSERT INTO invoice_details (invoice_id, part_id) VALUES ($1, $2)`,
            [invoiceId, partId]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.redirect('/billing?success=true');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating invoice:', err);
    res.status(500).send('Error creating invoice.');
  } finally {
    client.release();
  }
});

// 3. Generate PDF for Invoice (Opens in a new tab inline)
app.get('/billing/invoice/:id/pdf', requireAuth, async (req, res) => {
  try {
    const invoiceId = req.params.id;

    const invRes = await db.query('SELECT * FROM invoices WHERE id = $1', [invoiceId]);
    if (invRes.rows.length === 0) return res.status(404).send('Invoice not found');
    const invoice = invRes.rows[0];

    const partsRes = await db.query(`
      SELECT p.* 
      FROM invoice_details id
      JOIN spare_parts_inventory p ON id.part_id = p.id
      WHERE id.invoice_id = $1
    `, [invoiceId]);

    const parts = partsRes.rows;

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    // 'inline' tells the browser to render it in a new tab rather than downloading instantly
    res.setHeader('Content-Disposition', `inline; filename=Invoice_${invoice.id}.pdf`);

    doc.pipe(res);

    // PDF Layout Content
    doc.fontSize(20).text('Empire Motors', { align: 'center' });
    doc.fontSize(10).text('Automotive Repair & Spare Parts Sales', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(14).text(`INVOICE #${invoice.id}`, { underline: true });
    doc.fontSize(10).text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`);
    doc.text(`Service Type: ${invoice.service_type}`);
    doc.moveDown();

    doc.fontSize(12).text('Billed To:', { underline: true });
    doc.fontSize(10).text(`Name: ${invoice.bill_to}`);
    doc.text(`Vehicle Reg No: ${invoice.vehicle_registration_id}`);
    doc.text(`Address: ${invoice.bill_to_address || 'N/A'}`);
    doc.moveDown(2);

    doc.fontSize(11).text('Parts & Services Summary:', { underline: true });
    doc.moveDown(0.5);

    let y = doc.y;
    doc.fontSize(10).text('Part Code', 50, y);
    doc.text('Product Name', 150, y);
    doc.text('MRP Price', 450, y, { align: 'right' });
    doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();
    y += 25;

    parts.forEach(part => {
      doc.text(part.product_code, 50, y);
      doc.text(part.product_name, 150, y);
      doc.text(`$${Number(part.mrp_price).toFixed(2)}`, 450, y, { align: 'right' });
      y += 20;
    });

    doc.moveTo(50, y + 5).lineTo(550, y + 5).stroke();
    y += 15;

    doc.fontSize(12).text(`Total Bill: $${Number(invoice.total_bill).toFixed(2)}`, 350, y, { align: 'right' });

    doc.end();
  } catch (err) {
    console.error('Error generating PDF:', err);
    res.status(500).send('Error generating PDF invoice.');
  }
});

// 4. Render Printable Invoice View
app.get('/billing/invoice/:id/print', requireAuth, async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const invRes = await db.query('SELECT * FROM invoices WHERE id = $1', [invoiceId]);
    if (invRes.rows.length === 0) return res.status(404).send('Invoice not found');
    const invoice = invRes.rows[0];

    const partsRes = await db.query(`
      SELECT p.* 
      FROM invoice_details id
      JOIN spare_parts_inventory p ON id.part_id = p.id
      WHERE id.invoice_id = $1
    `, [invoiceId]);

    res.render('print-invoice', { invoice, parts: partsRes.rows });
  } catch (err) {
    console.error('Print Route Error:', err);
    res.status(500).send('Error loading invoice for printing.');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
app.get('/test', requireAuth, (req, res) => {
  res.send('Server is working!');
  console.log('Test route accessed');
});
