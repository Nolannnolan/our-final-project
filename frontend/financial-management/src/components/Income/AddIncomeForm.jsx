import React, { useState } from 'react'
import Input from '../Inputs/Input'
import EmojiPickerPopup from '../EmojiPickerPopup'

const AddIncomeForm = ({onAddIncome}) => {
    const [income, setIncome] = useState({
        source: "",
        amount: "",
        date: "",
        icon: "",
    })

    const handleChange = (key, value) => setIncome({...income, [key]: value})
  return (
    <div>
        <EmojiPickerPopup
            icon = {income.icon}
            onSelect={(selectedIcon) => handleChange("icon", selectedIcon)}
        />
      <Input
        value={income.source}
        onchange={({target}) => handleChange("source", target.value)}
        label="Income Source"
        placeholder="Freelance, Salary, ect"
        type="text"
      />

      <Input 
        value={income.amount}
        onchange={({target}) => handleChange("amount", target.value)}
        label="Amount"
        placeholder=""
        type="number"
      />

      <Input
        value={income.date}
        onchange={({target}) => handleChange("date", target.value)}
        label="Date"
        placeholder=""
        type="date"
      />

      <div className='flex justify-end mt-6'>
        <button
            type="button"
            className = "add-btn add-btn-fill"
            onClick={()=>onAddIncome(income)}
        >
            Add Income
        </button>
      </div>
    </div>
  )
}

export default AddIncomeForm
