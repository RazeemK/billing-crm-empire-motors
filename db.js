const { Pool } = require('pg');
require('dotenv').config();

// Determine if we are running locally or against AWS RDS
// You can set DB_MODE=local or DB_MODE=aws in your .env file
const dbMode = process.env.DB_MODE || 'local';

let poolConfig = {};

if (dbMode === 'aws') {
  // --- AWS RDS Configuration ---
  poolConfig = {
    host: process.env.AWS_PGHOST,
    user: process.env.AWS_PGUSER,
    password: process.env.AWS_PGPASSWORD,
    database: process.env.AWS_PGDATABASE,
    port: process.env.AWS_PGPORT || 5432,
    ssl: { rejectUnauthorized: false } // Required for AWS RDS
  };
  console.log('🔗 Connected to: AWS RDS Database');
} else {
  // --- Local Database Configuration ---
  poolConfig = {
    host: process.env.LOCAL_PGHOST || 'localhost',
    user: process.env.LOCAL_PGUSER || 'postgres',
    password: process.env.LOCAL_PGPASSWORD || 'your_local_password',
    database: process.env.LOCAL_PGDATABASE || 'autoservice_db',
    port: process.env.LOCAL_PGPORT || 5432
  };
  console.log('💻 Connected to: Local PostgreSQL Database');
}

const pool = new Pool(poolConfig);

module.exports = pool;