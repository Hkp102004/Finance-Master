import mongoose from 'mongoose'

const CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Health',
  'Entertainment',
  'Housing',
  'Other',
]

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount must be positive'],
    },
    category: {
      type: String,
      enum: CATEGORIES,
      default: 'Other',
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
    },
    source: {
      type: String,
      enum: ['manual', 'csv'],
      default: 'manual',
    },
  },
  { timestamps: true }
)

transactionSchema.index({ userId: 1, date: -1 })
transactionSchema.index({ userId: 1, category: 1 })

export default mongoose.model('Transaction', transactionSchema)
