import express from 'express'
import Budget from '../models/Budget.js'
import Transaction from '../models/Transaction.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()
router.use(protect)

// GET /api/budgets
router.get('/', async (req, res, next) => {
  try {
    const budgets = await Budget.find({ userId: req.user._id })

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const spending = await Transaction.aggregate([
      { $match: { userId: req.user._id, date: { $gte: startOfMonth } } },
      { $group: { _id: '$category', spent: { $sum: '$amount' } } },
    ])

    const spendingMap = Object.fromEntries(spending.map((s) => [s._id, s.spent]))

    const result = budgets.map((b) => ({
      ...b.toObject(),
      spent: spendingMap[b.category] || 0,
      remaining: b.limitAmount - (spendingMap[b.category] || 0),
      exceeded: (spendingMap[b.category] || 0) > b.limitAmount,
    }))

    res.json({ budgets: result })
  } catch (err) {
    next(err)
  }
})

// POST /api/budgets
router.post('/', async (req, res, next) => {
  try {
    const { category, limitAmount, period } = req.body
    const budget = await Budget.findOneAndUpdate(
      { userId: req.user._id, category },
      { limitAmount, period },
      { new: true, upsert: true, runValidators: true }
    )
    res.status(201).json({ budget })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/budgets/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const budget = await Budget.findOneAndDelete({ _id: req.params.id, userId: req.user._id })
    if (!budget) return res.status(404).json({ message: 'Budget not found' })
    res.json({ message: 'Budget deleted' })
  } catch (err) {
    next(err)
  }
})

export default router
