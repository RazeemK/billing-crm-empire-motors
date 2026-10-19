-- 1. Updated Customer Master Data
CREATE TABLE IF NOT EXISTS customers (
    customer_id SERIAL PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    vehicle_number VARCHAR(20) NOT NULL UNIQUE,
    address1 TEXT,
    address2 TEXT,
    city VARCHAR(50),
    state VARCHAR(50),
    phone_no VARCHAR(20) NOT NULL UNIQUE,
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