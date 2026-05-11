import express from 'express'
import multer from 'multer'
import csv from 'csv-parser'
import { Readable } from 'stream'
import Transaction from '../models/Transaction.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

router.use(protect)

// GET /api/transactions
router.get('/', async (req, res, next) => {
  try {
    const { category, startDate, endDate, limit = 50, page = 1 } = req.query
    const filter = { userId: req.user._id }

    if (category) filter.category = category
    if (startDate || endDate) {
      filter.date = {}
      if (startDate) filter.date.$gte = new Date(startDate)
      if (endDate) filter.date.$lte = new Date(endDate)
    }

    const skip = (page - 1) * limit
    const [transactions, total] = await Promise.all([
      Transaction.find(filter).sort({ date: -1 }).skip(skip).limit(Number(limit)),
      Transaction.countDocuments(filter),
    ])

    res.json({ transactions, total, page: Number(page), pages: Math.ceil(total / limit) })
  } catch (err) {
    next(err)
  }
})

// POST /api/transactions
router.post('/', async (req, res, next) => {
  try {
    const { description, amount, category, date } = req.body
    const transaction = await Transaction.create({
      userId: req.user._id,
      description,
      amount,
      category,
      date: date || Date.now(),
      source: 'manual',
    })
    res.status(201).json({ transaction })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/transactions/reset-all  (must be before /:id routes)
router.delete('/reset-all', async (req, res, next) => {
  try {
    const result = await Transaction.deleteMany({ userId: req.user._id })
    res.json({ message: `Deleted ${result.deletedCount} transactions`, deletedCount: result.deletedCount })
  } catch (err) {
    next(err)
  }
})

// PUT /api/transactions/:id
router.put('/:id', async (req, res, next) => {
  try {
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    )
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' })
    res.json({ transaction })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    })
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' })
    res.json({ message: 'Deleted successfully' })
  } catch (err) {
    next(err)
  }
})

// GET /api/transactions/summary
router.get('/summary', async (req, res, next) => {
  try {
    const summary = await Transaction.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ])
    const grandTotal = summary.reduce((s, c) => s + c.total, 0)
    res.json({ summary, grandTotal })
  } catch (err) {
    next(err)
  }
})

// GET /api/transactions/monthly — monthly spending for the current year
router.get('/monthly', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear()
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year + 1, 0, 1)

    const monthlyData = await Transaction.aggregate([
      {
        $match: {
          userId: req.user._id,
          date: { $gte: startOfYear, $lt: endOfYear },
        },
      },
      {
        $group: {
          _id: { $month: '$date' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const result = MONTH_NAMES.map((name, i) => {
      const found = monthlyData.find((m) => m._id === i + 1)
      return { month: name, total: found ? found.total : 0, count: found ? found.count : 0 }
    })

    const yearTotal = result.reduce((s, m) => s + m.total, 0)
    res.json({ monthly: result, year, yearTotal })
  } catch (err) {
    next(err)
  }
})

// POST /api/transactions/import-csv
router.post('/import-csv', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' })

    const results = []
    const stream = Readable.from(req.file.buffer.toString())

    stream
      .pipe(csv())
      .on('data', (row) => {
        const amount = parseFloat(row.amount || row.Amount)
        const description = row.description || row.Description || ''
        const date = row.date || row.Date
        const VALID_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Housing', 'Other']
        const rawCat = (row.category || row.Category || '').trim().toLowerCase()
        const category = VALID_CATEGORIES.find(c => c.toLowerCase() === rawCat) || 'Other'

        if (description && !isNaN(amount) && date) {
          results.push({
            userId: req.user._id,
            description,
            amount,
            category,
            date: new Date(date),
            source: 'csv',
          })
        }
      })
      .on('end', async () => {
        if (!results.length) {
          return res.status(400).json({ message: 'No valid rows found in CSV' })
        }
        const inserted = await Transaction.insertMany(results)
        res.status(201).json({ message: `Imported ${inserted.length} transactions` })
      })
      .on('error', (err) => next(err))
  } catch (err) {
    next(err)
  }
})

export default router