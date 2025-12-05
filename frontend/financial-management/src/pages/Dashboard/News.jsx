import React from 'react'
import DashBoardLayout from '../../components/layouts/DashboardLayout'
import Summary from '../../components/News/Summary'
import { useUserAuth } from '../../hooks/useUserAuth';
import Article from '../../components/News/Article';
import CustomLineChartStock from '../../components/Charts/CustomLineChartStock';
import { MessageCircle, X } from 'lucide-react';
import WatchlistSection from '../../components/News/WatchlistSection';
import { useState } from 'react';
import EnhancedChatPanel from '../../components/EnhancedChatPanel';

const News = () => {
    useUserAuth();
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [symbol, setSymbol] = useState("^VNINDEX.VN");

    const handleChangeSymbol = (newSymbol) => {
        setSymbol(newSymbol);
    }
  return (
    <DashBoardLayout activeMenu="News">
        <div className='my-5 mx-auto '>
            <div>
                <h2 className='text-2xl font-semibold mb-4'>Trang Tin Tức</h2>
            </div>
            

             <div className = "grid grid-cols-1 gap-6">
                <Summary onChange = {handleChangeSymbol}/>
                {/* Search bar */}
             </div>
             <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                <div className="order-1 md:order-2 col-span-2">
                    <CustomLineChartStock symbol = {symbol}/>
                </div>

                <div className="order-2 md:order-3 col-span-1">
                    <WatchlistSection />
                    {/* hello */}
                </div>

                <div className="order-3 md:order-1 col-span-1">
                    <Article />
                </div>
            </div>
            
        </div>
        {isChatOpen && (
        <div className="fixed bottom-20 sm:bottom-6 right-3 sm:right-6 z-40">
          <EnhancedChatPanel onClose={() => setIsChatOpen(false)} />
        </div>
      )}
      <button
        aria-label={isChatOpen ? 'Đóng chatbot' : 'Mở chatbot'}
        onClick={() => setIsChatOpen(prev => !prev)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#875cf5] text-white shadow-xl hover:bg-[#7049d0] transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#875cf5]"
      >
        {isChatOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </DashBoardLayout>
  )
}

export default News
