import React from 'react'
import DashBoardLayout from '../../components/layouts/DashboardLayout'
import Summary from '../../components/News/Summary'
import { useUserAuth } from '../../hooks/useUserAuth';
import Article from '../../components/News/Article';

const News = () => {
    useUserAuth();

  return (
    <DashBoardLayout activeMenu="News">
        <div className='my-5 mx-auto '>
            <h2 className='text-2xl font-semibold mb-4'>News Page</h2>
             <div className = "grid grid-cols-1 gap-6">
                <Summary />
                {/* Search bar */}
             </div>
             <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6">
                <div class="order-1 md:order-2 col-span-3 bg-green-200 p-4 rounded-lg">
                    Phần 2 (3 phần)
                </div>

                <div class="order-2 md:order-1 col-span-2">
                    <Article />
                </div>
            </div>
            
        </div>
        
    </DashBoardLayout>
  )
}

export default News
