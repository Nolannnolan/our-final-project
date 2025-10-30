import React, { useEffect, useState } from 'react'
import DashBoardLayout from '../../components/layouts/DashboardLayout'
import { useUserAuth } from '../../hooks/useUserAuth';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';
import { useNavigate } from 'react-router-dom'; 
import InfoCard from '../../components/Cards/InfoCard';
import { addThousandsSeperator } from '../../utils/helper';
import RecentTransactions from '../../components/Dashboard/RecentTransactions';
import FinanceOverview from '../../components/Dashboard/FinanceOverview';
import ExpenseTransactions from '../../components/Dashboard/ExpenseTransactions';
import Last30DaysExpenses from '../../components/Dashboard/Last30DaysExpenses';
import RecentIncomeWithChart from '../../components/Dashboard/RecentIncomeWithChart';
import RecentIncome from '../../components/Dashboard/RecentIncome';
import IncomeExpenseCorrelation from '../../components/Dashboard/IncomeExpenseCorrelation';

const Home = () => {
  useUserAuth();

  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchDashboardData = async () => {
    if(loading) {
      return;
    }
    setLoading(true);

    try{
      const response = await axiosInstance.get(`${API_PATHS.DASHBOARD.GET_DATA}`)
      if (response.data){
        setDashboardData(response.data);
        console.log("Dashboard data", response.data);
      }  
    } catch (error) {
      console.log("Someting went wrong. Please try again later.", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboardData();
    return () => {}
  }, []);
  return (
    <DashBoardLayout activeMenu="Dashboard">
      <div className='my-5 mx-auto'>
        <div className = "grid gird-cols-1 md:grid-cols-3 gap-6">
          <InfoCard
            icon = "fa-regular fa-window-maximize"
            label = "Total Balance"
            value = {addThousandsSeperator(dashboardData?.totalBalance || 0)}
            color = "bg-primary">
          </InfoCard> 

          <InfoCard
            icon = "fa-solid fa-wallet"
            label = "Total Income"
            value = {addThousandsSeperator(dashboardData?.totalIncome|| 0)}
            color = "bg-orange-500">
          </InfoCard> 

          <InfoCard
            icon = "fa-solid fa-hand-holding-dollar"
            label = "Total Expense"
            value = {addThousandsSeperator(dashboardData?.totalExpenses || 0)}
            color = "bg-red-500">
          </InfoCard> 
        </div>

        <IncomeExpenseCorrelation
          dataIncome = {dashboardData?.last30DaysIncome?.transactions||[]}
          dataExpense = {dashboardData?.last30DaysExpenses?.transactions || []}
        />

        <div className = "grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <RecentTransactions
            transactions={dashboardData?.recentTransactions}
            onSeeMore={() => navigate('/expense')}
          />

          <FinanceOverview
            totalBalance = {dashboardData?.totalBalance || 0}
            totalIncome = {dashboardData?.totalIncome || 0}
            totalExpense = {dashboardData?.totalExpenses || 0}
          />

          <ExpenseTransactions
            transactions={dashboardData?.last30DaysExpenses?.transactions||[]}
            onSeeMore={()=>{navigate("/expense")}}
          />

          <Last30DaysExpenses
            data = {dashboardData?.last30DaysExpenses?.transactions || []}
          />

          <RecentIncomeWithChart
            data={dashboardData?.last30DaysIncome?.transactions||[]}
            totalIncome = {dashboardData?.last30DaysIncome?.total || 0}
          />

          <RecentIncome
            transactions={dashboardData?.last30DaysIncome?.transactions||[]}
            onSeeMore={()=>{navigate("/income")}} 
          />
        </div>

      </div>
    </DashBoardLayout>
  )
}

export default Home
