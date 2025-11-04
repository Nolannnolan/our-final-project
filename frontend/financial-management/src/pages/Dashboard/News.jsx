import React, { useState } from 'react';
import DashBoardLayout from '../../components/layouts/DashboardLayout';
import { useUserAuth } from '../../hooks/useUserAuth';
import NewsCard from '../../components/NewsCard';
import StockCard from '../../components/StockCard';
import MarketChart from '../../components/MarketChart';
import EnhancedChatPanel from '../../components/EnhancedChatPanel';

const News = () => {
  useUserAuth();
  const [activeTab, setActiveTab] = useState('trending');
  
  const marketIndices = [
    {
      name: 'VNI',
      value: '1,234.56',
      change: 2.5,
      positive: true
    },
    {
      name: 'BTC',
      value: '$45,678',
      change: -1.2,
      positive: false
    },
    {
      name: 'ETH',
      value: '$3,456',
      change: 3.8,
      positive: true
    },
    {
      name: 'GOLD',
      value: '$1,890',
      change: 0.5,
      positive: true
    }
  ];
  
  const newsItems = [
    {
      title: 'Thị trường chứng khoán Việt Nam tăng điểm mạnh trong phiên sáng',
      source: 'VnExpress',
      time: '2 giờ trước',
      image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400'
    },
    {
      title: 'Bitcoin vượt mốc 45,000 USD sau tin tức tích cực từ SEC',
      source: 'CoinDesk',
      time: '3 giờ trước',
      image: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=400'
    },
    {
      title: 'Dòng tiền ngoại tiếp tục đổ vào thị trường Việt Nam',
      source: 'Cafef',
      time: '5 giờ trước',
      image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400'
    },
    {
      title: 'Ethereum 2.0 hoàn tất nâng cấp quan trọng',
      source: 'CryptoNews',
      time: '6 giờ trước',
      image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400'
    }
  ];
  
  const stocks = [
    {
      symbol: 'VCB',
      name: 'Vietcombank',
      price: '92,500',
      change: 2.3,
      chartData: [5, 7, 6, 8, 7, 9, 8]
    },
    {
      symbol: 'VHM',
      name: 'Vinhomes',
      price: '78,200',
      change: -1.5,
      chartData: [8, 7, 6, 7, 5, 6, 5]
    },
    {
      symbol: 'HPG',
      name: 'Hòa Phát',
      price: '24,500',
      change: 3.2,
      chartData: [4, 5, 6, 7, 8, 9, 9]
    },
    {
      symbol: 'VIC',
      name: 'Vingroup',
      price: '45,800',
      change: 1.8,
      chartData: [6, 6, 7, 7, 8, 8, 9]
    }
  ];

  return (
    <DashBoardLayout activeMenu="News">
      <div className="flex w-full relative">
        <div className="flex-1 pr-[450px]">
          <div className="bg-white border-b border-gray-200 px-4 py-4 mb-4">
            <div className="flex items-center gap-6 overflow-x-auto">
              {marketIndices.map(index => (
                <div key={index.name} className="flex items-center gap-3 whitespace-nowrap">
                  <span className="font-semibold text-gray-700">
                    {index.name}
                  </span>
                  <span className="font-bold text-gray-900">{index.value}</span>
                  <span className={`text-sm font-semibold ${index.positive ? 'text-green-500' : 'text-red-500'}`}>
                    {index.positive ? '+' : ''}
                    {index.change}%
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="px-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                  Tin tức mới nhất
                </h2>
                <div className="space-y-4">
                  {newsItems.map((news, index) => (
                    <NewsCard key={index} {...news} />
                  ))}
                </div>
              </div>
              <div className="space-y-6">
                <MarketChart />
                <div className="bg-white rounded-2xl p-6 shadow-md">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Cổ phiếu</h3>
                    <div className="flex gap-2">
                      {['trending', 'active', 'gainers', 'losers'].map(tab => (
                        <button 
                          key={tab} 
                          onClick={() => setActiveTab(tab)}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-all capitalize ${
                            activeTab === tab 
                              ? 'bg-[#875cf5] text-white' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {tab === 'trending' && 'Xu hướng'}
                          {tab === 'active' && 'Hoạt động'}
                          {tab === 'gainers' && 'Tăng'}
                          {tab === 'losers' && 'Giảm'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {stocks.map(stock => (
                      <StockCard key={stock.symbol} {...stock} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="fixed right-0 top-0 bottom-0 w-100 z-30 bg-white border-l border-gray-200">
          <div className="h-full flex flex-col">
            <EnhancedChatPanel />
          </div>
        </div>
      </div>
    </DashBoardLayout>
  );
};

export default News;
