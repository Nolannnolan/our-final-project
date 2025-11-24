/**
 * Market Controller - Ticker, Stats, Movers
 * For financial dashboard
 */

const pool = require('../config/pg');
const redis = require('../config/redis');

/**
 * Calculate 24h stats for a symbol  
 * Smart fallback: price_ticks (crypto) → price_ohlcv (stocks/indexes)
 * WITH TIME RANGE FILTER to avoid "out of shared memory"
 */
async function calculate24hStats(symbol) {
  try {
    // Get asset info first
    const assetInfo = await pool.query(
      'SELECT id, asset_type FROM assets WHERE symbol = $1',
      [symbol]
    );
    
    if (assetInfo.rows.length === 0) return null;
    
    const assetId = assetInfo.rows[0].id;
    const assetType = assetInfo.rows[0].asset_type;
    
    // Try price_ticks first (for crypto with real-time data)
    // WITH TIME RANGE FILTER to avoid scanning entire history
    const ticksQuery = `
      WITH current AS (
        SELECT price, ts FROM price_ticks 
        WHERE asset_id = $1 
        ORDER BY ts DESC 
        LIMIT 1
      ),
      day_ago_ticks AS (
        SELECT price FROM price_ticks 
        WHERE asset_id = $1 
        AND ts <= NOW() - INTERVAL '24 hours'
        AND ts >= NOW() - INTERVAL '30 days'
        ORDER BY ts DESC 
        LIMIT 1
      ),
      day_ago_ohlcv AS (
        SELECT open as price FROM price_ohlcv
        WHERE asset_id = $1
        AND ts <= NOW() - INTERVAL '24 hours'
        ORDER BY ts DESC
        LIMIT 1
      ),
      stats_24h AS (
        SELECT 
          MAX(price) as high,
          MIN(price) as low,
          SUM(volume) as vol
        FROM price_ticks
        WHERE asset_id = $1
        AND ts >= NOW() - INTERVAL '24 hours'
      )
      SELECT 
        current.price as current_price,
        current.ts,
        COALESCE(day_ago_ticks.price, day_ago_ohlcv.price) as price_24h_ago,
        stats_24h.high as high_24h,
        stats_24h.low as low_24h,
        stats_24h.vol as volume_24h
      FROM current
      LEFT JOIN day_ago_ticks ON true
      LEFT JOIN day_ago_ohlcv ON true
      LEFT JOIN stats_24h ON true
    `;
    
    if (assetType === 'crypto') {
      const ticksResult = await pool.query(ticksQuery, [assetId]);
    
      if (ticksResult.rows[0]?.current_price) {
      const data = ticksResult.rows[0];
      const currentPrice = parseFloat(data.current_price);
      const basePrice = parseFloat(data.price_24h_ago || data.current_price);
      const change = currentPrice - basePrice;
      const changePercent = basePrice > 0 ? (change / basePrice) * 100 : 0;
      
      return {
        current_price: currentPrice,
        price_24h_ago: basePrice,
        change_24h: change,
        change_percent_24h: changePercent,
        high_24h: parseFloat(data.high_24h || currentPrice),
        low_24h: parseFloat(data.low_24h || currentPrice),
        volume_24h: parseFloat(data.volume_24h || 0),
        ts: data.ts
      };
      }
    }
    
    // Fallback to price_ohlcv (for stocks/indexes)
    // Get last 2 days to compare
    // WITH TIME RANGE FILTER to avoid "out of shared memory"
    const ohlcvQuery = `
      SELECT 
        close,
        open,
        high,
        low,
        volume,
        ts
      FROM price_ohlcv
      WHERE asset_id = $1
      AND ts >= NOW() - INTERVAL '30 days'
      ORDER BY ts DESC
      LIMIT 2
    `;
    
    const ohlcvResult = await pool.query(ohlcvQuery, [assetId]);
    
    if (ohlcvResult.rows.length === 0) return null;
    
    const latest = ohlcvResult.rows[0];
    const previous = ohlcvResult.rows[1] || latest;
    
    // For stocks: calculate change from previous close to latest close
    const currentPrice = parseFloat(latest.close);
    const previousClose = parseFloat(previous.close);
    const change = currentPrice - previousClose;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
    
    return {
      current_price: currentPrice,
      price_24h_ago: previousClose,
      change_24h: change,
      change_percent_24h: changePercent,
      high_24h: parseFloat(latest.high),
      low_24h: parseFloat(latest.low),
      volume_24h: parseFloat(latest.volume),
      open: parseFloat(latest.open),
      ts: latest.ts
    };
    
  } catch (err) {
    console.error(`calculate24hStats error for ${symbol}:`, err.message);
    return null;
  }
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
      open: parseFloat(stats.open || stats.current_price),
      change24h: parseFloat(stats.change_24h || 0),
      changePercent24h: parseFloat(stats.change_percent_24h || 0),
      high24h: parseFloat(stats.high_24h || 0),
      low24h: parseFloat(stats.low_24h || 0),
      volume24h: parseFloat(stats.volume_24h || 0),
      prevClose: parseFloat(stats.price_24h_ago || stats.current_price),
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

/**
 * GET /api/v1/market/vn-gainers?limit=10
 * Get top gainers for Vietnamese stocks (symbols ending with .VN)
 */
exports.getVNGainers = async (req, res) => {
  const limit = parseInt(req.query.limit || '10', 10);
  
  if (limit > 100) {
    return res.status(400).json({ error: 'max limit is 100' });
  }
  
  try {
    // Try cache first
    const cacheKey = `vn:gainers:${limit}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return res.json({
        ...JSON.parse(cached),
        source: 'cache'
      });
    }
    
    // Get Vietnamese stocks (ending with .VN)
    const assetsQuery = `
      SELECT a.id, a.symbol, a.name, a.exchange, a.asset_type
      FROM assets a
      WHERE a.status = 'OK'
      AND a.symbol LIKE '%.VN'
      ORDER BY a.id
      LIMIT 200
    `;
    
    const { rows: assets } = await pool.query(assetsQuery);
    
    if (assets.length === 0) {
      return res.json({ type: 'vn-gainers', data: [] });
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
        continue;
      }
    }
    
    // Sort by highest changePercent24h
    results.sort((a, b) => b.changePercent24h - a.changePercent24h);
    
    // Take top N
    const topResults = results.slice(0, limit);
    
    const response = {
      type: 'vn-gainers',
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
    console.error('getVNGainers error:', err);
    res.status(500).json({ error: 'failed', message: err.message });
  }
};

/**
 * GET /api/v1/market/vn-losers?limit=10
 * Get top losers for Vietnamese stocks (symbols ending with .VN)
 */
exports.getVNLosers = async (req, res) => {
  const limit = parseInt(req.query.limit || '10', 10);
  
  if (limit > 100) {
    return res.status(400).json({ error: 'max limit is 100' });
  }
  
  try {
    // Try cache first
    const cacheKey = `vn:losers:${limit}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return res.json({
        ...JSON.parse(cached),
        source: 'cache'
      });
    }
    
    // Get Vietnamese stocks (ending with .VN)
    const assetsQuery = `
      SELECT a.id, a.symbol, a.name, a.exchange, a.asset_type
      FROM assets a
      WHERE a.status = 'OK'
      AND a.symbol LIKE '%.VN'
      ORDER BY a.id
      LIMIT 200
    `;
    
    const { rows: assets } = await pool.query(assetsQuery);
    
    if (assets.length === 0) {
      return res.json({ type: 'vn-losers', data: [] });
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
        continue;
      }
    }
    
    // Sort by lowest changePercent24h
    results.sort((a, b) => a.changePercent24h - b.changePercent24h);
    
    // Take top N
    const topResults = results.slice(0, limit);
    
    const response = {
      type: 'vn-losers',
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
    console.error('getVNLosers error:', err);
    res.status(500).json({ error: 'failed', message: err.message });
  }
};

/**
 * GET /api/v1/market/ticker-detail?symbol=BTCUSDT
 * Get detailed ticker information with historical performance
 */
exports.getTickerDetail = async (req, res) => {
  const symbol = (req.query.symbol || '').toUpperCase();
  
  if (!symbol) {
    return res.status(400).json({ error: 'symbol required' });
  }
  
  try {
    // Try cache first
    const cacheKey = `ticker:detail:${symbol}`;
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
    const assetId = asset.id;
    
    // Get latest OHLCV data
    const latestQuery = `
      SELECT open, high, low, close, volume, ts
      FROM price_ohlcv
      WHERE asset_id = $1
      AND ts >= NOW() - INTERVAL '30 days'
      ORDER BY ts DESC
      LIMIT 1
    `;
    
    const { rows: latestRows } = await pool.query(latestQuery, [assetId]);
    
    if (latestRows.length === 0) {
      return res.status(404).json({ error: 'no price data' });
    }
    
    const latest = latestRows[0];
    
    // Get previous close
    const prevCloseQuery = `
      SELECT close
      FROM price_ohlcv
      WHERE asset_id = $1
      AND ts >= NOW() - INTERVAL '30 days'
      ORDER BY ts DESC
      LIMIT 1 OFFSET 1
    `;
    
    const { rows: prevRows } = await pool.query(prevCloseQuery, [assetId]);
    const prevClose = prevRows[0]?.close || latest.close;
    
    // Get 52-week high and low
    const fiftyTwoWeekQuery = `
      SELECT 
        MAX(high) as week_52_high,
        MIN(low) as week_52_low
      FROM price_ohlcv
      WHERE asset_id = $1
      AND ts >= NOW() - INTERVAL '365 days'
    `;
    
    const { rows: yearRows } = await pool.query(fiftyTwoWeekQuery, [assetId]);
    const yearData = yearRows[0] || {};
    
    // Calculate profit for different periods (1M, 3M, 6M, 1Y)
    const profitQuery = `
      SELECT 
        (SELECT close FROM price_ohlcv 
         WHERE asset_id = $1 AND ts >= NOW() - INTERVAL '30 days' 
         ORDER BY ts ASC LIMIT 1) as price_1m_ago,
        (SELECT close FROM price_ohlcv 
         WHERE asset_id = $1 AND ts >= NOW() - INTERVAL '90 days' 
         ORDER BY ts ASC LIMIT 1) as price_3m_ago,
        (SELECT close FROM price_ohlcv 
         WHERE asset_id = $1 AND ts >= NOW() - INTERVAL '180 days' 
         ORDER BY ts ASC LIMIT 1) as price_6m_ago,
        (SELECT close FROM price_ohlcv 
         WHERE asset_id = $1 AND ts >= NOW() - INTERVAL '365 days' 
         ORDER BY ts ASC LIMIT 1) as price_1y_ago
    `;
    
    const { rows: profitRows } = await pool.query(profitQuery, [assetId]);
    const profitData = profitRows[0] || {};
    
    const currentPrice = parseFloat(latest.close);
    
    const profit = {
      '1M': profitData.price_1m_ago 
        ? parseFloat((((currentPrice - profitData.price_1m_ago) / profitData.price_1m_ago) * 100).toFixed(2))
        : 0,
      '3M': profitData.price_3m_ago 
        ? parseFloat((((currentPrice - profitData.price_3m_ago) / profitData.price_3m_ago) * 100).toFixed(2))
        : 0,
      '6M': profitData.price_6m_ago 
        ? parseFloat((((currentPrice - profitData.price_6m_ago) / profitData.price_6m_ago) * 100).toFixed(2))
        : 0,
      '1Y': profitData.price_1y_ago 
        ? parseFloat((((currentPrice - profitData.price_1y_ago) / profitData.price_1y_ago) * 100).toFixed(2))
        : 0
    };
    
    const tickerDetail = {
      symbol: asset.symbol,
      name: asset.name,
      exchange: asset.exchange,
      asset_type: asset.asset_type,
      open: parseFloat(latest.open),
      high: parseFloat(latest.high),
      low: parseFloat(latest.low),
      close: currentPrice,
      prevClose: parseFloat(prevClose),
      volume: parseFloat(latest.volume),
      fiftyTwoWeekHigh: parseFloat(yearData.week_52_high || currentPrice),
      fiftyTwoWeekLow: parseFloat(yearData.week_52_low || currentPrice),
      profit,
      timestamp: latest.ts
    };
    
    // Cache for 1 minute
    await redis.setex(cacheKey, 60, JSON.stringify(tickerDetail));
    
    res.json({
      ...tickerDetail,
      source: 'db'
    });
    
  } catch (err) {
    console.error('getTickerDetail error:', err);
    res.status(500).json({ error: 'failed', message: err.message });
  }
};
