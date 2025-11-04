# finance_agent/tools/historical_price.py
"""
Tool to fetch historical stock price data as structured data (not chart).
Returns price data points with dates for analysis.
"""
from __future__ import annotations
import datetime
import logging
import os
import certifi
import ssl
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

os.environ["SSL_CERT_FILE"] = certifi.where()
ssl._create_default_https_context = ssl._create_unverified_context

USE_YFINANCE = False
try:
    import os
    if os.path.exists(r"C:\Temp\cacert.pem"):
        os.environ['CURL_CA_BUNDLE'] = r"C:\Temp\cacert.pem"
        os.environ['SSL_CERT_FILE'] = r"C:\Temp\cacert.pem"
        logger.info("Using certificate from C:\\Temp\\cacert.pem")
    
    import yfinance as yf
    from yfinance import download
    USE_YFINANCE = True
    logger.info("yfinance loaded successfully for historical_price tool")
except Exception as e:
    logger.warning(f"yfinance not available: {e}")


def _normalize_symbol(symbol: str) -> str:
    """Normalize ticker symbol."""
    return symbol.strip().upper()


def _detect_currency(symbol: str) -> str:
    """Detect currency from ticker suffix."""
    if symbol.endswith((".VN", ".HM", ".HN")):
        return "VND"
    return "USD"


def get_historical_stock_price(
    ticker: str,
    period: str = "1mo",
    interval: str = "1d",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Fetch historical stock price data for analysis.
    
    Args:
        ticker: Stock symbol (e.g., "FPT", "FPT.VN", "AAPL")
        period: Time period - "1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"
                Used if start_date/end_date not provided
        interval: Data interval - "1m", "2m", "5m", "15m", "30m", "1h", "1d", "5d", "1wk", "1mo", "3mo"
        start_date: Start date in format "YYYY-MM-DD" (optional, overrides period)
        end_date: End date in format "YYYY-MM-DD" (optional)
    
    Returns:
        Dict containing:
        - ticker: Stock symbol used
        - period: Time period
        - interval: Data interval
        - currency: Currency of prices
        - data_points: Number of data points
        - prices: List of dicts with date, open, high, low, close, volume
        - summary: Summary statistics (first, last, high, low, change_percent)
        - error: Error message if any
    """
    
    if not ticker:
        return {
            "ticker": None,
            "error": "Ticker symbol is required",
            "prices": [],
            "summary": None
        }
    
    norm_symbol = _normalize_symbol(ticker)
    
    if not USE_YFINANCE:
        logger.warning("yfinance not available, returning mock data")
        return {
            "ticker": norm_symbol,
            "period": period,
            "interval": interval,
            "currency": "USD",
            "data_points": 0,
            "prices": [],
            "summary": None,
            "error": "yfinance not available - mock fallback"
        }
    
    # Try multiple ticker formats
    candidates = [norm_symbol]
    if "." not in norm_symbol:
        candidates.append(norm_symbol + ".VN")
    
    for try_sym in candidates:
        try:
            logger.info(f"Fetching historical data for {try_sym} (period={period}, interval={interval})")
            
            # Create ticker object
            stock = yf.Ticker(try_sym)
            
            # Fetch historical data
            if start_date and end_date:
                # Use date range if provided
                hist = stock.history(start=start_date, end=end_date, interval=interval, auto_adjust=True)
            else:
                # Use period
                hist = stock.history(period=period, interval=interval, auto_adjust=True)
            
            if hist is None or hist.empty:
                logger.warning(f"{try_sym}: No data returned")
                continue
            
            logger.info(f"{try_sym}: Successfully fetched {len(hist)} data points")
            
            # Convert to structured format
            prices = []
            for date, row in hist.iterrows():
                prices.append({
                    "date": date.strftime('%Y-%m-%d %H:%M:%S') if hasattr(date, 'strftime') else str(date),
                    "open": float(row['Open']),
                    "high": float(row['High']),
                    "low": float(row['Low']),
                    "close": float(row['Close']),
                    "volume": int(row['Volume']) if 'Volume' in row else 0
                })
            
            # Calculate summary statistics
            first_price = float(hist['Close'].iloc[0])
            last_price = float(hist['Close'].iloc[-1])
            high_price = float(hist['High'].max())
            low_price = float(hist['Low'].min())
            change_pct = ((last_price - first_price) / first_price * 100) if first_price != 0 else 0
            
            avg_volume = int(hist['Volume'].mean()) if 'Volume' in hist else 0
            
            currency = _detect_currency(try_sym)
            
            return {
                "ticker": try_sym,
                "period": period if not start_date else f"{start_date} to {end_date}",
                "interval": interval,
                "currency": currency,
                "data_points": len(prices),
                "prices": prices,
                "summary": {
                    "first_price": round(first_price, 2),
                    "last_price": round(last_price, 2),
                    "high_price": round(high_price, 2),
                    "low_price": round(low_price, 2),
                    "change_amount": round(last_price - first_price, 2),
                    "change_percent": round(change_pct, 2),
                    "avg_volume": avg_volume,
                    "volatility": round(float(hist['Close'].std()), 2) if len(hist) > 1 else 0
                },
                "error": None
            }
            
        except Exception as e:
            logger.error(f"Failed to fetch data for {try_sym}: {str(e)}")
            continue
    
    # All attempts failed
    return {
        "ticker": norm_symbol,
        "period": period,
        "interval": interval,
        "currency": None,
        "data_points": 0,
        "prices": [],
        "summary": None,
        "error": f"Could not fetch data for any of: {', '.join(candidates)}"
    }


# Alias function for compatibility
def get_stock_price_history(ticker: str, period: str = "1mo", interval: str = "1d") -> Dict[str, Any]:
    """Alias for get_historical_stock_price for backward compatibility."""
    return get_historical_stock_price(ticker=ticker, period=period, interval=interval)
