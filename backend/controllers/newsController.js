const axios = require("axios");
const Parser = require("rss-parser");
const cheerio = require("cheerio");

const parser = new Parser();

// Danh sách nguồn tin và logo
const sources = [
  {
    name: "VietNamPlus",
    url: "https://www.vietnamplus.vn/rss/kinhte/taichinh-343.rss",
    logo: "https://upload.wikimedia.org/wikipedia/vi/a/a8/Logo_Vietnam%2B.png",
  },
  {
    name: "VTC News",
    url: "https://vtcnews.vn/rss/kinh-te.rss",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/VTC_official_logo.svg/1024px-VTC_official_logo.svg.png",
  },
  {
    name: "VNExpress",
    url: "https://vnexpress.net/rss/kinh-doanh.rss",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/VnExpress.net_Logo.svg/2560px-VnExpress.net_Logo.svg.png",
  },
];

let cachedNews = [];
let lastUpdated = null;

// 🧩 Hàm tách ảnh từ nội dung
const extractImage = (item) => {
  let html = item.description || item.content || "";

  if (!/<img[^>]+src=/.test(html) && item["content:encoded"]) {
    html = item["content:encoded"];
  }

  try {
    const $ = cheerio.load(html);
    const imgSrc = $("img").attr("src");
    return imgSrc || null;
  } catch (err) {
    console.error("Error parsing image:", err.message);
    return null;
  }
};

// 🧠 Hàm lấy dữ liệu RSS và lưu cache
const fetchRSSData = async () => {
  try {
    const results = await Promise.all(
      sources.map(async (src) => {
        try {
          const { data } = await axios.get(src.url, {
            headers: { "User-Agent": "Mozilla/5.0 (Node.js Server)" },
            timeout: 10000,
          });
          const feed = await parser.parseString(data);

          return feed.items.slice(0, 10).map((item) => ({
            title: item.title,
            link: item.link,
            sortDate: item.pubDate,
            pubDate: new Date(item.pubDate).toLocaleString("vi-VN", {
              timeZone: "Asia/Ho_Chi_Minh",
            }),
            image: extractImage(item),
            source: src.name,
            logo: src.logo,
          }));
        } catch (err) {
          console.error(`❌ Lỗi khi tải RSS từ ${src.name}:`, err.message);
          return [];
        }
      })
    );

    const allNews = results.flat();
    allNews.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));

    cachedNews = allNews;
    lastUpdated = new Date();
  } catch (error) {
    console.error("RSS Fetch Error:", error.message);
  }
};

// Gọi fetch ngay khi khởi động và mỗi 10 phút
fetchRSSData();
setInterval(fetchRSSData, 10 * 60 * 1000);

// 📤 Controller chính
exports.getNews = (req, res) => {
  res.json({
    status: "success",
    lastUpdated,
    total: cachedNews.length,
    data: cachedNews,
  });
};
