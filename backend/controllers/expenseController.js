const xlsx = require('xlsx');

const Expense = require("../models/Expense");


exports.addExpense = async (req, res) => {
    userId = req.user.id

    try{
        const {icon, category, amount, date} = req.body;

        if (!category || ! amount || !date ){
            res.status(400).json({message: "All fields are required"})
        }

        const newExpense = new Expense({
            userId,
            icon,
            category,
            amount,
            date: new Date(date)
        });

        await newExpense.save()
        res.status(200).json(newExpense);
    } catch (error){
        res.status(500).json("Server Error")
    }
}

exports.getAllExpense = async (req, res) => {
    const userId = req.user.id;
    try{
        const expense = await Expense.find( {userId} ).sort( {date: -1} );
        res.status(200).json(expense);
    } catch (error){
        res.status(500).json({message: "Server Error"});
    }
}

exports.deleteExpense = async (req, res) => {
    try{
        const expenseId = req.params.id;
        await Expense.findByIdAndDelete(expenseId);
        res.status(200).json({message: "Expense deleted"});
    } catch (error) {
        res.status(500).json("Server Error");
    }
}

exports.downloadExpenseExcel = async (req, res) => {
    const userId = req.user.id;

    try{
        const expense = await Expense.find( {userId} ).sort( {date:-1} );
        const data = expense.map((item) => ({
            Category: item.category,
            Amount: item.amount,
            Date: item.date,
        }))

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, "Expense");
        xlsx.writeFile(wb, "Expense_details.xlsx");
        res.download("Expense_details.xlsx");
    }  catch (error) {
        res.status(500).json({message: "Server Error"});
    }
}