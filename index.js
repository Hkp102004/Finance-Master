import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'

import { connectDB } from './config/db.js'
import authRoutes from './routes/auth.js'
import transactionRoutes from './routes/transactions.js'
import aiRoutes from './routes/ai.js'
import budgetRoutes from './routes/budgets.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = express()
const PORT = process.env.PORT || 5000

await connectDB()

// Security
app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }))

// Parsing
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', model: process.env.OLLAMA_MODEL }))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/budgets', budgetRoutes)

// Global error handler — must be last
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`🚀 NeonLedger server running on http://localhost:${PORT}`)
  console.log(`🤖 AI model: ${process.env.OLLAMA_MODEL} via ${process.env.OLLAMA_BASE_URL}`)
  console.log(`🗄️  Database: ${process.env.MONGO_URI}`)
})
