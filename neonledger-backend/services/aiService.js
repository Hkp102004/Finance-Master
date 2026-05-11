const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2'

const askOllama = async (prompt, system = '') => {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.statusText}`)
  }

  const data = await response.json()
  return data.message?.content?.trim() || ''
}

export const categorizeTransaction = async (description) => {
  const categories = ['Food', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Housing', 'Other']
  const system = `You are a finance categorizer. Given a transaction description, respond with ONLY one word from this list: ${categories.join(', ')}. No explanation, no punctuation, just the category word.`
  const result = await askOllama(description, system)
  return categories.find((c) => result.includes(c)) || 'Other'
}

export const generateInsights = async (transactions) => {
  const system = `You are a sharp finance analyst. Analyze the user's spending data and give 3-4 concise, actionable insights. Be direct and specific. Use ₹ for currency amounts.`
  const prompt = `Here is my spending data: ${JSON.stringify(transactions)}. Give me insights about my spending patterns.`
  return askOllama(prompt, system)
}

export const generateSavingTips = async (summary) => {
  const system = `You are a personal finance advisor. Give 4-5 specific, practical money-saving tips based on the user's spending categories. Be concrete and direct.`
  const prompt = `My spending by category: ${JSON.stringify(summary)}. Give me saving tips.`
  return askOllama(prompt, system)
}

export const predictSpending = async (transactions) => {
  const system = `You are a finance prediction AI. Analyze spending patterns and respond ONLY with a valid JSON object like this — no markdown, no explanation:
{"next_month":{"total":12000,"breakdown":{"Food":4000,"Transport":2000},"note":"brief insight"},"month_after":{"total":13000,"breakdown":{"Food":4500,"Transport":2200},"note":"brief insight"}}`
  const prompt = `Predict my next 2 months of spending based on this history: ${JSON.stringify(transactions)}`
  const raw = await askOllama(prompt, system)
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    throw new Error('Could not parse prediction response from AI')
  }
}

export const generateBudgetInsights = async (transactions, categorySummary, monthlyBudget) => {
  const totalSpent = categorySummary.reduce((sum, c) => sum + c.total, 0)
  const diff = totalSpent - monthlyBudget
  const isOver = diff > 0

  const system = `You are a strict but helpful personal finance advisor. The user has set a monthly budget. Analyze their current month's spending against the budget and provide:

1. A clear status — are they over or under budget, and by how much (use ₹ for amounts).
2. A per-category breakdown showing which categories are consuming the most of the budget.
3. If over budget: which categories to cut and by how much to get back on track.
4. If under budget: praise them but warn about categories that are trending high.
5. Give 3-4 specific, actionable steps to control expenses or stay within budget.

Be direct, concise, use bullet points, and use ₹ for all currency amounts. Do NOT use markdown headers or code blocks.`

  const prompt = `My monthly budget is ₹${monthlyBudget.toLocaleString('en-IN')}.
Total spent this month so far: ₹${totalSpent.toLocaleString('en-IN')}.
I am ${isOver ? `OVER budget by ₹${diff.toLocaleString('en-IN')}` : `under budget with ₹${Math.abs(diff).toLocaleString('en-IN')} remaining`}.

Spending by category this month:
${categorySummary.map(c => `  ${c._id}: ₹${c.total.toLocaleString('en-IN')} (${c.count} transactions)`).join('\n')}

Recent transactions:
${transactions.slice(0, 20).map(t => `  ${t.date ? new Date(t.date).toLocaleDateString('en-IN') : ''} | ${t.category} | ${t.description} | ₹${t.amount}`).join('\n')}

Give me a budget analysis with specific steps to ${isOver ? 'get back within' : 'stay within'} my ₹${monthlyBudget.toLocaleString('en-IN')} budget.`

  return askOllama(prompt, system)
}
