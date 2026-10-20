const express = require('express');
const path = require('path');
const db = require('./db');
require('dotenv').config();

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

// --- HOME / DASHBOARD ---
app.get('/', (req, res) => {
  res.render('index');
});

// --- MODULE 1: CUSTOMER DATA ---
// Only loads customers when a search query is submitted, avoiding data dump on load
app.get('/customers', async (req, res) => {
  try {
    const search = req.query.search || '';
    let customers = [];
    
    if (search.trim() !== '') {
      const query = `
        SELECT * FROM customers 
        WHERE customer_name ILIKE $1 OR vehicle_number ILIKE $1 OR phone_no ILIKE $1
        ORDER BY created_at DESC
      `;
      const result = await db.query(query, [`%${search}%`]);
      customers = result.rows;
    }

    res.render('customers', { customers, search });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database Error');
  }
});

// Add New Customer
app.post('/customers/new', async (req, res) => {
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
app.get('/customers/:id', async (req, res) => {
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
app.get('/customers/:id/edit', async (req, res) => {
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
app.post('/customers/:id/edit', async (req, res) => {
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
app.post('/customers/:id/visits/new', async (req, res) => {
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

// --- MODULE 2: BILLING (Stub) ---
app.get('/billing', (req, res) => {
  res.render('billing');
});

// --- MODULE 3: STOCK MANAGEMENT (Stub) ---
app.get('/stock', (req, res) => {
  res.render('stock');
});

// --- MODULE 3: STOCK MANAGEMENT (Stub) ---
app.get('/user', (req, res) => {
  res.render('user');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
app.get('/test', (req, res) => {
  res.send('Server is working!');
  console.log('Test route accessed');
});
