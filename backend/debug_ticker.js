const pool = require('./config/pg');

async function debug() {
  try {
    // Check latest ticks
    console.log('1. Latest ticks:');
    const latest = await pool.query(`
      SELECT a.symbol, MAX(pt.ts) as latest_tick, NOW() - MAX(pt.ts) as age 
      FROM price_ticks pt 
      JOIN assets a ON pt.asset_id = a.id 
      GROUP BY a.symbol 
      ORDER BY MAX(pt.ts) DESC 
      LIMIT 5
    `);
    latest.rows.forEach(row => {
      console.log(`   ${row.symbol}: ${row.latest_tick}`);
    });
    
    // Test calculate24hStats for first symbol
    if (latest.rows[0]) {
      const testSymbol = latest.rows[0].symbol;
      console.log(`\n2. Testing 24h stats for ${testSymbol}:`);
      
      const query = `
        WITH latest AS (
          SELECT price, ts
          FROM price_ticks
          WHERE asset_id = (SELECT id FROM assets WHERE symbol = $1)
          ORDER BY ts DESC
          LIMIT 1
        ),
        day_ago AS (
          SELECT price
          FROM price_ticks
          WHERE asset_id = (SELECT id FROM assets WHERE symbol = $1)
          AND ts <= NOW() - INTERVAL '24 hours'
          ORDER BY ts DESC
          LIMIT 1
        ),
        day_stats AS (
          SELECT 
            MAX(price) as high_24h,
            MIN(price) as low_24h,
            SUM(volume) as volume_24h
          FROM price_ticks
          WHERE asset_id = (SELECT id FROM assets WHERE symbol = $1)
          AND ts >= NOW() - INTERVAL '24 hours'
        )
        SELECT 
          latest.price as current_price,
          day_ago.price as price_24h_ago,
          (latest.price - day_ago.price) as change_24h,
          CASE WHEN day_ago.price > 0 
            THEN ((latest.price - day_ago.price) / day_ago.price * 100)
            ELSE 0 
          END as change_percent_24h,
          day_stats.high_24h,
          day_stats.low_24h,
          day_stats.volume_24h,
          latest.ts
        FROM latest, day_ago, day_stats;
      `;
      
      const result = await pool.query(query, [testSymbol]);
      console.log('   Result rows count:', result.rows.length);
      console.log('   Result:', result.rows[0]);
      
      // Simple test
      console.log('\n3. Simple latest price test:');
      const simple = await pool.query(`
        SELECT price, ts 
        FROM price_ticks 
        WHERE asset_id = (SELECT id FROM assets WHERE symbol = $1)
        ORDER BY ts DESC 
        LIMIT 1
      `, [testSymbol]);
      console.log('   Latest price:', simple.rows[0]);
    }
    
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  } finally {
    await pool.end();
  }
}

debug();
