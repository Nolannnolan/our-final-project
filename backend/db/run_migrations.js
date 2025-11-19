/**
 * Run Database Migrations
 * Applies all SQL migration files in order
 */

const fs = require('fs');
const path = require('path');
const pool = require('../config/pg');

async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');

  const migrationsDir = path.join(__dirname, 'migrations');
  
  // Check if migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    console.log('⚠️ No migrations directory found');
    return;
  }

  // Get all SQL files sorted
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('⚠️ No migration files found');
    return;
  }

  console.log(`📁 Found ${files.length} migration(s):\n`);
  files.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));
  console.log('');

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`📄 Running: ${file}...`);

    try {
      await pool.query(sql);
      console.log(`✅ ${file} completed\n`);
    } catch (err) {
      console.error(`❌ ${file} failed:`);
      console.error(err.message);
      
      // Check if error is about existing objects
      if (err.message.includes('already exists') || 
          err.message.includes('does not exist')) {
        console.log('⚠️ Skipping (object already exists)\n');
        continue;
      }
      
      throw err;
    }
  }

  console.log('✅ All migrations completed successfully!\n');
}

async function verifyTimescaleDB() {
  console.log('🔍 Verifying TimescaleDB extension...\n');
  
  try {
    const { rows } = await pool.query(`
      SELECT extname, extversion 
      FROM pg_extension 
      WHERE extname = 'timescaledb'
    `);

    if (rows.length === 0) {
      console.log('❌ TimescaleDB extension not found!');
      console.log('   Run: CREATE EXTENSION IF NOT EXISTS timescaledb;\n');
      return false;
    }

    console.log(`✅ TimescaleDB ${rows[0].extversion} installed\n`);
    return true;
  } catch (err) {
    console.error('❌ Failed to verify TimescaleDB:', err.message);
    return false;
  }
}

async function verifyMigrations() {
  console.log('🔍 Verifying migrations...\n');

  const checks = [
    {
      name: 'price_ticks hypertable',
      query: `SELECT * FROM timescaledb_information.hypertables WHERE hypertable_name = 'price_ticks'`
    },
    {
      name: 'price_ohlcv_1m continuous aggregate',
      query: `SELECT * FROM timescaledb_information.continuous_aggregates WHERE view_name = 'price_ohlcv_1m'`
    },
    {
      name: 'price_ohlcv_5m continuous aggregate',
      query: `SELECT * FROM timescaledb_information.continuous_aggregates WHERE view_name = 'price_ohlcv_5m'`
    },
    {
      name: 'price_ohlcv_1h continuous aggregate',
      query: `SELECT * FROM timescaledb_information.continuous_aggregates WHERE view_name = 'price_ohlcv_1h'`
    }
  ];

  for (const check of checks) {
    try {
      const { rows } = await pool.query(check.query);
      if (rows.length > 0) {
        console.log(`✅ ${check.name}`);
      } else {
        console.log(`❌ ${check.name} - NOT FOUND`);
      }
    } catch (err) {
      console.log(`❌ ${check.name} - ERROR: ${err.message}`);
    }
  }

  console.log('');
}

async function main() {
  try {
    const hasTimescaleDB = await verifyTimescaleDB();
    
    if (!hasTimescaleDB) {
      console.log('❌ Cannot proceed without TimescaleDB');
      process.exit(1);
    }

    await runMigrations();
    await verifyMigrations();

    console.log('🎉 Migration process complete!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runMigrations, verifyTimescaleDB, verifyMigrations };
