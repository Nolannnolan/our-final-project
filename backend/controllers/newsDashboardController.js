const axios = require("axios");
const {shouldConvertToVND, getExchangeRateToVND } = require("../helper");
require("dotenv").config();

let cache = { data: null, timestamp: 0 };
const CACHE_DURATION = 60 * 1000; // cache 1 phút

exports.getTickerBar = async (req, res) => {
  try {
    // Dùng cache để tránh gọi API liên tục
    if (cache.data && Date.now() - cache.timestamp < CACHE_DURATION) {
      return res.json(cache.data);
    }

    // Yahoo Finance (dùng rapidapi hoặc free public proxy)
    const yahooSymbols = {
      // Chỉ số thị trường
      "^VNINDEX.VN": "VN-Index",
      "^DJI": "Dow Jones",
      "^GSPC": "S&P 500",
      "^IXIC": "NASDAQ",
      "^N225": "Nikkei 225",
      "^FTSE": "FTSE 100",
      "^GDAXI": "DAX 40",
      "^FCHI": "CAC 40",
      "^HSI": "Hang Seng",
      "000001.SS": "Shanghai",
      "^KS11": "KOSPI",
      

      // Tỷ giá ngoại tệ theo VND
      "USDVND=X": "USD/VND",
      "EURVND=X": "EUR/VND",
      "JPYVND=X": "JPY/VND",

      // Cặp tiền quốc tế
      "EURUSD=X": "EUR/USD",
      "USDJPY=X": "USD/JPY",
      "GBPUSD=X": "GBP/USD",

      // Tiền điện tử
      "BTC-USD": "BTC",
      "ETH-USD": "ETH",
      "BNB-USD": "BNB",
      "XRP-USD": "XRP",
      "USDC-USD": "USDC",
      "ADA-USD": "ADA",
      "DOGE-USD": "DOGE",
      "SOL-USD": "SOL",
      "DOT-USD": "DOT",
      "AVAX-USD": "AVAX",

      // Kim loại & Năng lượng
      "GC=F": "Gold",
      "CL=F": "WTI",
      "BZ=F": "Brent",
      
      // Vietnamese Stocks
      // Ngân hàng
      "VCB.VN": "VCB",
      "BID.VN": "BID",
      "CTG.VN": "CTG",
      "TCB.VN": "TCB",
      "MBB.VN": "MBB",

      // Bất động sản & đa ngành
      "VIC.VN": "VIC",
      "VHM.VN": "VHM",
      "NVL.VN": "NVL",

      // Tiêu dùng & công nghệ
      "VNM.VN": "VNM",
      "FPT.VN": "FPT",
      "MWG.VN": "MWG",

      // Thép & vật liệu xây dựng
      "HPG.VN": "HPG",
      "HSG.VN": "HSG",

      // Dầu khí & năng lượng
      "GAS.VN": "GAS",
      "POW.VN": "POW",

      // Bán lẻ & dịch vụ lớn
      "VRE.VN": "VRE",
      "MSN.VN": "MSN",

      // Chứng khoán & tài chính
      "SSI.VN": "SSI",
      "SHB.VN": "SHB",

      // Vận tải & hàng không
      "VJC.VN": "VJC"
    };


    const yahooData = await Promise.all(
      Object.entries(yahooSymbols).map(async ([symbol, name]) => {
        try {
          const resYahoo = await axios.get(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d`
          );
          
          const result = resYahoo.data.chart.result?.[0];
          let price = result?.meta?.regularMarketPrice;
          let prevClose = result?.meta?.chartPreviousClose;
          const changePercent = ((price - prevClose) / prevClose) * 100;
          
          const instrumentType = result?.meta.instrumentType;
          let currency = result?.meta.currency;

          if (shouldConvertToVND(instrumentType) && currency !== "VND") {
            const rate = await getExchangeRateToVND(currency);

            // Nhân các giá trị cần thiết
            price *= rate;
            prevClose *= rate;
          }

          return {
            symbol: symbol,
            name,
            price: parseFloat(price.toFixed(2)),
            changePercent: parseFloat(changePercent.toFixed(2)),
            positive: changePercent >= 0,
          };
        } catch (err) {
          console.error(`❌ Yahoo Finance fetch failed for ${symbol}:`, err.message);
          return null;
        }
      })
    );

    const validIndexes = yahooData.filter(Boolean);
    // 5️⃣ Gộp tất cả dữ liệu
    const mergedData = [...validIndexes];
    
    // 6️⃣ Lưu cache
    cache = { data: mergedData, timestamp: Date.now() };

    res.json(mergedData);
  } catch (error) {
    console.error("❌ Error fetching ticker data:", error.message);
    res.status(500).json({ message: "Error fetching real market data" });
  }
};
