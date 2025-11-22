/**
 * Test New Financial Dashboard APIs
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8000/api/v1';

async function testAPIs() {
  console.log('🧪 Testing Financial Dashboard APIs\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Test assets search
    console.log('\n1️⃣ Testing Assets Search...');
    const search = await axios.get(`${BASE_URL}/assets?q=BTC&limit=5`);
    console.log(`   Found ${search.data.count} results`);
    if (search.data.results[0]) {
      console.log(`   First: ${search.data.results[0].symbol} - ${search.data.results[0].name}`);
      
      // Use first symbol for other tests
      const testSymbol = search.data.results[0].symbol;
      
      // 2. Test ticker
      console.log(`\n2️⃣ Testing Ticker for ${testSymbol}...`);
      try {
        const ticker = await axios.get(`${BASE_URL}/market/ticker?symbol=${testSymbol}`);
        console.log(`   Price: ${ticker.data.price}`);
        console.log(`   24h Change: ${ticker.data.changePercent24h}%`);
      } catch (err) {
        console.log(`   ⚠️  No price data (${err.response?.data?.error || err.message})`);
      }
      
      // 3. Test asset detail
      console.log(`\n3️⃣ Testing Asset Detail for ${testSymbol}...`);
      const detail = await axios.get(`${BASE_URL}/assets/${testSymbol}`);
      console.log(`   Name: ${detail.data.name}`);
      console.log(`   Exchange: ${detail.data.exchange}`);
      console.log(`   Type: ${detail.data.asset_type}`);
      
      // 4. Test candles
      console.log(`\n4️⃣ Testing Candles for ${testSymbol}...`);
      try {
        const candles = await axios.get(`${BASE_URL}/price/candles?symbol=${testSymbol}&timeframe=1d&limit=10`);
        console.log(`   Candles: ${candles.data.count}`);
        if (candles.data.candles[0]) {
          console.log(`   Latest: ${candles.data.candles[candles.data.candles.length - 1].close}`);
        }
      } catch (err) {
        console.log(`   ⚠️  No candle data`);
      }
    }
    
    // 5. Test market movers
    console.log('\n5️⃣ Testing Market Movers...');
    try {
      const gainers = await axios.get(`${BASE_URL}/market/movers?type=gainers&limit=5`);
      console.log(`   Top gainers: ${gainers.data.count} found`);
      if (gainers.data.data[0]) {
        console.log(`   #1: ${gainers.data.data[0].symbol} (+${gainers.data.data[0].changePercent24h}%)`);
      }
    } catch (err) {
      console.log(`   ⚠️  Error: ${err.response?.data?.error || err.message}`);
    }
    
    // 6. Test market stats
    console.log('\n6️⃣ Testing Market Stats...');
    const stats = await axios.get(`${BASE_URL}/market/stats`);
    console.log(`   Total assets: ${stats.data.total_assets}`);
    stats.data.assets_by_type.forEach(t => {
      console.log(`   - ${t.asset_type}: ${t.count}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ API Tests Complete!\n');
    
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    if (err.response) {
      console.error('   Response:', err.response.data);
    }
  }
}

testAPIs();
