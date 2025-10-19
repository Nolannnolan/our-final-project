import React, { useEffect, useState } from 'react'
import DashBoardLayout from '../../components/layouts/DashboardLayout'
import IncomeOverview from '../../components/Income/IncomeOverview'
import { API_PATHS } from '../../utils/apiPaths'
import axiosInstance from '../../utils/axiosInstance'
import Modal from '../../components/Modal'
import AddIncomeForm from '../../components/Income/AddIncomeForm'

const Income = () => {

  const [incomeData, setIncomeData] = useState([])
  const [openAddIncomeModal, setOpenAddIncomeModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [openDeleteAlert, setOpenDeleteAlert] = useState({
    show: false,
    data: null
  })

  // Get All Income Details
  const fetchIncomeData = async () =>{
    if(loading) {
      return;
    }
    setLoading(true);

    try{
      const response = await axiosInstance.get(`${API_PATHS.INCOME.GET_ALL_INCOME}`)
      if (response.data){
        setIncomeData(response.data);
        console.log("Income data", response.data);
      }  
    } catch (error) {
      console.log("Someting went wrong. Please try again later.", error);
    } finally {
      setLoading(false);
    }

  }

  //Handle Add Income
  const handleAddIncome = async(income)=>{

  }

  // Delete Income
  const deleteIncome = async(id) => {

  }

  // Handle Download Income Details
  const handleDownloadIncomeDetails = async() =>{

  }

  useEffect(()=>{
    fetchIncomeData()
    return()=>{}
  }, [])

  return (
    <DashBoardLayout activeMenu="Income">
      <div className='my-5 mx-auto'>
        <div className = "grid grid-cols-1 gap-6">
          <div className=''>
            <IncomeOverview
              transactions={incomeData}
              onAddIncome={() => setOpenAddIncomeModal(true)}
            />
          </div>
        </div>

        <Modal
          isOpen = {openAddIncomeModal}
          onClose = {() => setOpenAddIncomeModal(false)}
          title="Add Income"
        >
          <AddIncomeForm onAddIncome={handleAddIncome}/>
        </Modal>
      </div>
    </DashBoardLayout>
  )
}

export default Income
