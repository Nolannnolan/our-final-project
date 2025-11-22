/**
 * Market Controller - Ticker, Stats, Movers
 * For financial dashboard
 */

const pool = require('../config/pg');
const redis = require('../config/redis');

/**
 * Calculate 24h stats for a symbol  
 * Falls back gracefully if 24h data not available
 */
async function calculate24hStats(symbol) {
  // Simplified query that always returns results
  const query = `
    SELECT 
      (SELECT price FROM price_ticks 
       WHERE asset_id = (SELECT id FROM assets WHERE symbol = $1)
       ORDER BY ts DESC LIMIT 1) as current_price,
       
      (SELECT price FROM price_ticks 
       WHERE asset_id = (SELECT id FROM assets WHERE symbol = $1)
       AND ts <= NOW() - INTERVAL '24 hours'
       ORDER BY ts DESC LIMIT 1) as price_24h_ago,
       
      (SELECT price FROM price_ticks 
       WHERE asset_id = (SELECT id FROM assets WHERE symbol = $1)
       ORDER BY ts ASC LIMIT 1) as first_price,
       
      (SELECT MAX(price) FROM price_ticks 
       WHERE asset_id = (SELECT id FROM assets WHERE symbol = $1)
       AND ts >= NOW() - INTERVAL '24 hours') as high_24h,
       
      (SELECT MIN(price) FROM price_ticks 
       WHERE asset_id = (SELECT id FROM assets WHERE symbol = $1)
       AND ts >= NOW() - INTERVAL '24 hours') as low_24h,
       
      (SELECT SUM(volume) FROM price_ticks 
       WHERE asset_id = (SELECT id FROM assets WHERE symbol = $1)
       AND ts >= NOW() - INTERVAL '24 hours') as volume_24h,
       
      (SELECT ts FROM price_ticks 
       WHERE asset_id = (SELECT id FROM assets WHERE symbol = $1)
       ORDER BY ts DESC LIMIT 1) as ts
  `;
  
  const { rows } = await pool.query(query, [symbol]);
  
  if (!rows[0] || !rows[0].current_price) {
    return null;
  }
  
  const data = rows[0];
  
  // Use 24h ago price, or fallback to first available, or current
  const basePrice = data.price_24h_ago || data.first_price || data.current_price;
  const change = data.current_price - basePrice;
  const changePercent = basePrice > 0 ? (change / basePrice) * 100 : 0;
  
  return {
    current_price: data.current_price,
    price_24h_ago: basePrice,
    change_24h: change,
    change_percent_24h: changePercent,
    high_24h: data.high_24h || data.current_price,
    low_24h: data.low_24h || data.current_price,
    volume_24h: data.volume_24h || 0,
    ts: data.ts
  };
}

/**
 * GET /api/v1/market/ticker?symbol=BTCUSDT
 * Get full ticker with 24h stats
 */
exports.getTicker = async (req, res) => {
  const symbol = (req.query.symbol || '').toUpperCase();
  
  if (!symbol) {
    return res.status(400).json({ error: 'symbol required' });
  }
  
  try {
    // Try cache first
    const cacheKey = `ticker:${symbol}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return res.json({
        ...JSON.parse(cached),
        source: 'cache'
      });
    }
    
    // Get asset info
    const assetQuery = await pool.query(
      'SELECT id, symbol, name, exchange, asset_type FROM assets WHERE symbol = $1',
      [symbol]
    );
    
    if (assetQuery.rows.length === 0) {
      return res.status(404).json({ error: 'symbol not found' });
    }
    
    const asset = assetQuery.rows[0];
    
    // Calculate 24h stats
    const stats = await calculate24hStats(symbol);
    
    if (!stats) {
      return res.status(404).json({ error: 'no price data' });
    }
    
    const ticker = {
      symbol: asset.symbol,
      name: asset.name,
      exchange: asset.exchange,
      asset_type: asset.asset_type,
      price: parseFloat(stats.current_price),
      change24h: parseFloat(stats.change_24h || 0),
      changePercent24h: parseFloat(stats.change_percent_24h || 0),
      high24h: parseFloat(stats.high_24h || 0),
      low24h: parseFloat(stats.low_24h || 0),
      volume24h: parseFloat(stats.volume_24h || 0),
      timestamp: stats.ts
    };
    
    // Cache for 30 seconds
    await redis.setex(cacheKey, 30, JSON.stringify(ticker));
    
    res.json({
      ...ticker,
      source: 'db'
    });
    
  } catch (err) {
    console.error('getTicker error:', err);
    res.status(500).json({ error: 'failed', message: err.message });
  }
};

/**
 * GET /api/v1/market/tickers?symbols=BTCUSDT,ETHUSDT,BNBUSDT
 * Get multiple tickers at once (bulk)
 */
exports.getTickersBulk = async (req, res) => {
  const symbolsParam = req.query.symbols || '';
  const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
  
  if (symbols.length === 0) {
    return res.status(400).json({ error: 'symbols required (comma-separated)' });
  }
  
  if (symbols.length > 50) {
    return res.status(400).json({ error: 'max 50 symbols at once' });
  }
  
  try {
    const tickers = [];
    
    for (const symbol of symbols) {
      try {
        // Try cache first
        const cacheKey = `ticker:${symbol}`;
        const cached = await redis.get(cacheKey);
        
        if (cached) {
          tickers.push(JSON.parse(cached));
          continue;
        }
        
        // Get from DB
        const assetQuery = await pool.query(
          'SELECT id, symbol, name, exchange, asset_type FROM assets WHERE symbol = $1',
          [symbol]
        );
        
        if (assetQuery.rows.length === 0) continue;
        
        const asset = assetQuery.rows[0];
        const stats = await calculate24hStats(symbol);
        
        if (!stats) continue;
        
        const ticker = {
          symbol: asset.symbol,
          name: asset.name,
          exchange: asset.exchange,
          asset_type: asset.asset_type,
          price: parseFloat(stats.current_price),
          change24h: parseFloat(stats.change_24h || 0),
          changePercent24h: parseFloat(stats.change_percent_24h || 0),
          high24h: parseFloat(stats.high_24h || 0),
          low24h: parseFloat(stats.low_24h || 0),
          volume24h: parseFloat(stats.volume_24h || 0),
          timestamp: stats.ts
        };
        
        // Cache for 30 seconds
        await redis.setex(cacheKey, 30, JSON.stringify(ticker));
        
        tickers.push(ticker);
        
      } catch (err) {
        console.error(`Error fetching ticker for ${symbol}:`, err.message);
        // Skip this symbol and continue
      }
    }
    
    res.json({
      count: tickers.length,
      tickers
    });
    
  } catch (err) {
    console.error('getTickersBulk error:', err);
    res.status(500).json({ error: 'failed', message: err.message });
  }
};

/**
 * GET /api/v1/market/movers?type=gainers&limit=10&asset_type=crypto
 * Get market movers (top gainers, losers, active)
 */
exports.getMarketMovers = async (req, res) => {
  const type = (req.query.type || 'gainers').toLowerCase(); // gainers, losers, active
  const limit = parseInt(req.query.limit || '10', 10);
  const assetType = req.query.asset_type; // optional filter
  
  if (!['gainers', 'losers', 'active'].includes(type)) {
    return res.status(400).json({ 
      error: 'invalid type', 
      valid: ['gainers', 'losers', 'active'] 
    });
  }
  
  if (limit > 100) {
    return res.status(400).json({ error: 'max limit is 100' });
  }
  
  try {
    // Try cache first
    const cacheKey = `movers:${type}:${assetType || 'all'}:${limit}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return res.json({
        ...JSON.parse(cached),
        source: 'cache'
      });
    }
    
    // Get all active assets
    let assetFilter = 'a.status = $1';
    let params = ['OK'];
    
    if (assetType) {
      assetFilter += ' AND a.asset_type = $2';
      params.push(assetType);
    }
    
    const assetsQuery = `
      SELECT a.id, a.symbol, a.name, a.exchange, a.asset_type
      FROM assets a
      WHERE ${assetFilter}
      ORDER BY a.id
      LIMIT 200
    `;
    
    const { rows: assets } = await pool.query(assetsQuery, params);
    
    if (assets.length === 0) {
      return res.json({ type, data: [] });
    }
    
    // Calculate stats for each
    const results = [];
    
    for (const asset of assets) {
      try {
        const stats = await calculate24hStats(asset.symbol);
        
        if (!stats || !stats.current_price) continue;
        
        results.push({
          symbol: asset.symbol,
          name: asset.name,
          exchange: asset.exchange,
          asset_type: asset.asset_type,
          price: parseFloat(stats.current_price),
          change24h: parseFloat(stats.change_24h || 0),
          changePercent24h: parseFloat(stats.change_percent_24h || 0),
          high24h: parseFloat(stats.high_24h || 0),
          low24h: parseFloat(stats.low_24h || 0),
          volume24h: parseFloat(stats.volume_24h || 0),
          timestamp: stats.ts
        });
      } catch (err) {
        // Skip this symbol
        continue;
      }
    }
    
    // Sort based on type
    if (type === 'gainers') {
      results.sort((a, b) => b.changePercent24h - a.changePercent24h);
    } else if (type === 'losers') {
      results.sort((a, b) => a.changePercent24h - b.changePercent24h);
    } else if (type === 'active') {
      results.sort((a, b) => b.volume24h - a.volume24h);
    }
    
    // Take top N
    const topResults = results.slice(0, limit);
    
    const response = {
      type,
      asset_type: assetType || 'all',
      count: topResults.length,
      data: topResults
    };
    
    // Cache for 1 minute
    await redis.setex(cacheKey, 60, JSON.stringify(response));
    
    res.json({
      ...response,
      source: 'db'
    });
    
  } catch (err) {
    console.error('getMarketMovers error:', err);
    res.status(500).json({ error: 'failed', message: err.message });
  }
};

/**
 * GET /api/v1/market/stats
 * Get overall market statistics
 */
exports.getMarketStats = async (req, res) => {
  try {
    const cacheKey = 'market:stats';
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return res.json({
        ...JSON.parse(cached),
        source: 'cache'
      });
    }
    
    // Count assets by type
    const countQuery = `
      SELECT 
        asset_type,
        COUNT(*) as count
      FROM assets
      WHERE status = 'OK'
      GROUP BY asset_type
    `;
    
    const { rows: counts } = await pool.query(countQuery);
    
    // Get total market cap (crypto only, from metadata)
    const marketCapQuery = `
      SELECT 
        SUM((metadata->>'market_cap')::BIGINT) as total_market_cap
      FROM assets
      WHERE asset_type = 'crypto' 
      AND status = 'OK'
      AND metadata->>'market_cap' IS NOT NULL
    `;
    
    const { rows: mcRows } = await pool.query(marketCapQuery);
    
    const stats = {
      assets_by_type: counts,
      total_assets: counts.reduce((sum, c) => sum + parseInt(c.count), 0),
      total_market_cap: mcRows[0]?.total_market_cap || 0,
      timestamp: new Date().toISOString()
    };
    
    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(stats));
    
    res.json({
      ...stats,
      source: 'db'
    });
    
  } catch (err) {
    console.error('getMarketStats error:', err);
    res.status(500).json({ error: 'failed', message: err.message });
  }
};
