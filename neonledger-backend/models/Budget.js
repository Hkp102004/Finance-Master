import mongoose from 'mongoose'

const budgetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['Food', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Housing', 'Other'],
      required: [true, 'Category is required'],
    },
    limitAmount: {
      type: Number,
      required: [true, 'Budget limit is required'],
      min: [1, 'Budget limit must be at least 1'],
    },
    period: {
      type: String,
      enum: ['monthly', 'weekly'],
      default: 'monthly',
    },
  },
  { timestamps: true }
)

budgetSchema.index({ userId: 1, category: 1 }, { unique: true })

export default mongoose.model('Budget', budgetSchema)
