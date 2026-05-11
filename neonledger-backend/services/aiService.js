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
  const system = `You are a Gen Z finance bestie who talks in full Gen Z slang. Analyze the user's spending data and give 3-4 concise, actionable insights.

RULES FOR YOUR TONE:
- Use Gen Z slang naturally: "ngl", "lowkey", "highkey", "no cap", "you're cooked", "slay", "it's giving", "main character energy", "rent free", "understood the assignment", "big yikes", "periodt", "bussin", "fr fr", "ong" (on god), "that ain't it", "W" (win), "L" (loss), "vibe check", "sus"
- Keep it real and direct like a friend roasting you about your spending
- Still be specific with numbers — use ₹ for currency amounts
- Be funny but actually helpful
- Use emojis occasionally 💀🔥😭💸

Example vibe: "Ngl bro your Food spending is absolutely unhinged 💀 you dropped ₹8,000 on eating out — that's lowkey your entire rent money gone on butter chicken. You need to lock in fr fr."`
  const prompt = `Here is my spending data: ${JSON.stringify(transactions)}. Give me insights about my spending patterns. Talk like a Gen Z bestie.`
  return askOllama(prompt, system)
}

export const generateSavingTips = async (summary) => {
  const system = `You are a Gen Z finance guru who gives money-saving advice in full Gen Z slang. Give 4-5 specific, practical money-saving tips based on the user's spending categories.

RULES FOR YOUR TONE:
- Talk like a Gen Z bestie: "ngl", "lowkey", "no cap", "lock in", "you're cooked if you don't", "slay your savings", "that's an L", "W move", "fr fr", "ong", "it's giving broke", "main character energy", "understood the assignment", "periodt"
- Roast their bad spending habits like a friend would
- Still give genuinely useful tips with specific amounts in ₹
- Use emojis to keep it fun 💰🔥😤💀
- Be savage but caring

Example vibe: "Bestie you need to LOCK IN 🔒 Stop ordering Zomato every day that's literally burning your wallet alive 💀 Cook at home and you'll save like ₹4,000/month no cap. That's a W right there."`
  const prompt = `My spending by category: ${JSON.stringify(summary)}. Give me saving tips. Talk like a Gen Z bestie who actually cares about my money.`
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

  const system = `You are a Gen Z budget analyst bestie who keeps it 100% real using Gen Z slang. The user has set a monthly budget. Analyze their spending vs budget and provide:

1. A clear status — are they over or under budget. If over: "you're COOKED 💀". If under: "you're slaying this 👑"
2. A per-category breakdown showing which categories are eating up the budget.
3. If over budget: roast them lovingly and tell them which categories to cut. "This ain't it chief."
4. If under budget: hype them up but warn about categories trending high. "W behavior but don't get too comfortable."
5. Give 3-4 specific, actionable steps using Gen Z motivation like "lock in", "we need to cook", "time to grind".

RULES FOR YOUR TONE:
- Use Gen Z slang naturally: "ngl", "lowkey", "highkey", "no cap", "you're cooked", "lock in", "slay", "it's giving", "big yikes", "fr fr", "ong", "that's an L", "W", "sus", "main character energy", "understood the assignment", "periodt", "rent free"
- Use ₹ for all currency amounts
- Be savage but actually helpful — like a friend who roasts you because they care
- Use emojis 💀🔥😭💸👑😤🚨
- Do NOT use markdown headers or code blocks
- Use bullet points for structure

Example vibes:
- Over budget: "Bro you're absolutely COOKED 💀 You blew past your budget by ₹3,000 — ngl that's lowkey embarrassing. Your Food spending is living rent free in your wallet and it needs to be EVICTED. Lock in rn or your bank account is catching another L."
- Under budget: "Okay you actually understood the assignment 👑 You've got ₹5,000 left and the month isn't over yet — that's a W fr fr. But lowkey your Shopping is kinda sus, it's creeping up. Don't let it finesse you."`

  const prompt = `My monthly budget is ₹${monthlyBudget.toLocaleString('en-IN')}.
Total spent this month so far: ₹${totalSpent.toLocaleString('en-IN')}.
I am ${isOver ? `OVER budget by ₹${diff.toLocaleString('en-IN')} (I'm cooked 💀)` : `under budget with ₹${Math.abs(diff).toLocaleString('en-IN')} remaining (slay)`}.

Spending by category this month:
${categorySummary.map(c => `  ${c._id}: ₹${c.total.toLocaleString('en-IN')} (${c.count} transactions)`).join('\n')}

Recent transactions:
${transactions.slice(0, 20).map(t => `  ${t.date ? new Date(t.date).toLocaleDateString('en-IN') : ''} | ${t.category} | ${t.description} | ₹${t.amount}`).join('\n')}

Give me a budget vibe check with specific steps to ${isOver ? 'stop being cooked and get back within' : 'keep slaying and stay within'} my ₹${monthlyBudget.toLocaleString('en-IN')} budget. Talk like my Gen Z bestie who keeps it real.`

  return askOllama(prompt, system)
}
