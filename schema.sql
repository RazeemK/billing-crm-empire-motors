-- 1. Updated Customer Master Data
CREATE TABLE IF NOT EXISTS customers (
    customer_id SERIAL PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    vehicle_number VARCHAR(20),
    address1 TEXT,
    address2 TEXT,
    city VARCHAR(50),
    state VARCHAR(50),
    phone_no VARCHAR(30),
    branch_name VARCHAR(50),
    engine_no VARCHAR(50),
    chassis_no VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Customer Visit / Repair / Spare Parts History
CREATE TABLE IF NOT EXISTS customer_visits (
    visit_id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    odometer_reading INT,
    service_type VARCHAR(50) NOT NULL CHECK (service_type IN ('Repair Work', 'Spare Parts Purchase', 'Routine Service', 'Inspection')),
    work_description TEXT,
    parts_replaced TEXT,
    bill_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--3. Spare Parts Inventory
CREATE TABLE IF NOT EXISTS spare_parts_inventory (
    id SERIAL PRIMARY KEY,
    product_code VARCHAR(50) NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    closing_stock INT,
    source VARCHAR(20), 
    mrp_price decimal(10, 2),
    purchase_price decimal(10, 2)
);

CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    bill_to VARCHAR(20) NOT NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_bill decimal(10,2) NOT NULL,
	service_type VARCHAR(20) NOT NULL,
    customer_id INT REFERENCES customers(customer_id) ON DELETE CASCADE ,
	bill_to_address TEXT,
	vehicle_registration_id VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS invoice_details (
    id SERIAL PRIMARY KEY,
	invoice_id SERIAL REFERENCES invoices(id) ON DELETE CASCADE,
    part_id SERIAL REFERENCES spare_parts_inventory(id) ON DELETE CASCADE
);


-- Table to store user credentials
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'staff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


--id in sync
SELECT setval('customers_customer_id_seq', COALESCE((SELECT MAX(customer_id) FROM customers), 0) + 1, false);
SELECT setval('spare_parts_inventory_id_seq', COALESCE((SELECT MAX(id) FROM spare_parts_inventory), 0) + 1, false);