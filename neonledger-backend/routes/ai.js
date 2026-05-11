import express from 'express'
import rateLimit from 'express-rate-limit'
import Transaction from '../models/Transaction.js'
import { protect } from '../middleware/authMiddleware.js'
import {
  categorizeTransaction,
  generateInsights,
  generateSavingTips,
  predictSpending,
  generateBudgetInsights,
} from '../services/aiService.js'

const router = express.Router()

const aiLimiter = rateLimit({ windowMs: 60_000, max: 15, message: { message: 'Too many AI requests, slow down!' } })

router.use(protect)
router.use(aiLimiter)

// POST /api/ai/categorize
router.post('/categorize', async (req, res, next) => {
  try {
    const { description } = req.body
    if (!description) return res.status(400).json({ message: 'Description is required' })
    const category = await categorizeTransaction(description)
    res.json({ category })
  } catch (err) {
    next(err)
  }
})

// GET /api/ai/insights
router.get('/insights', async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ userId: req.user._id })
      .sort({ date: -1 })
      .limit(50)
      .lean()

    if (!transactions.length) {
      return res.status(400).json({ message: 'No transactions to analyze' })
    }

    const insights = await generateInsights(transactions)
    res.json({ insights })
  } catch (err) {
    next(err)
  }
})

// GET /api/ai/tips
router.get('/tips', async (req, res, next) => {
  try {
    const summary = await Transaction.aggregate([
      { $match: { userId: req.user._id } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
    ])

    if (!summary.length) {
      return res.status(400).json({ message: 'No data to generate tips from' })
    }

    const tips = await generateSavingTips(summary)
    res.json({ tips })
  } catch (err) {
    next(err)
  }
})

// GET /api/ai/predict
router.get('/predict', async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ userId: req.user._id })
      .sort({ date: -1 })
      .limit(100)
      .lean()

    if (transactions.length < 3) {
      return res.status(400).json({ message: 'Need at least 3 transactions to predict' })
    }

    const prediction = await predictSpending(transactions)
    res.json({ prediction })
  } catch (err) {
    next(err)
  }
})

// POST /api/ai/budget-insights
router.post('/budget-insights', async (req, res, next) => {
  try {
    const { monthlyBudget } = req.body
    if (!monthlyBudget || monthlyBudget <= 0) {
      return res.status(400).json({ message: 'A valid monthly budget is required' })
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const transactions = await Transaction.find({
      userId: req.user._id,
      date: { $gte: startOfMonth },
    })
      .sort({ date: -1 })
      .lean()

    if (!transactions.length) {
      return res.status(400).json({ message: 'No transactions this month to analyze' })
    }

    const categorySummary = await Transaction.aggregate([
      { $match: { userId: req.user._id, date: { $gte: startOfMonth } } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ])

    const insights = await generateBudgetInsights(transactions, categorySummary, parseFloat(monthlyBudget))
    const totalSpent = categorySummary.reduce((sum, c) => sum + c.total, 0)

    res.json({
      insights,
      totalSpent,
      budget: parseFloat(monthlyBudget),
      remaining: parseFloat(monthlyBudget) - totalSpent,
      exceeded: totalSpent > parseFloat(monthlyBudget),
      categorySummary,
    })
  } catch (err) {
    next(err)
  }
})


export default router
