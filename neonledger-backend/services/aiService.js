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

export const generateInsights = async (transactions, tone = 'genz', budget = 0, totalSpent = 0) => {
  const budgetContext = budget > 0
    ? `\n\nIMPORTANT BUDGET CONTEXT: The user has set a monthly budget of ₹${budget.toLocaleString('en-IN')}. They have spent ₹${totalSpent.toLocaleString('en-IN')} so far. They are ${totalSpent > budget ? `OVER budget by ₹${(totalSpent - budget).toLocaleString('en-IN')} — this is critical, emphasize this!` : `under budget with ₹${(budget - totalSpent).toLocaleString('en-IN')} remaining`}. Factor this budget into your analysis — compare spending against the budget, flag categories eating too much of the budget, and give budget-aware advice.`
    : ''

  const systemGenz = `You are a Gen Z finance bro who talks in full Gen Z slang. Analyze the user's spending data and give 3-4 concise, actionable insights.

RULES FOR YOUR TONE:
- Use Gen Z slang naturally: "ngl", "lowkey", "highkey", "no cap", "you're cooked", "slay", "it's giving", "main character energy", "rent free", "understood the assignment", "big yikes", "periodt", "bussin", "fr fr", "ong" (on god), "that ain't it", "W" (win), "L" (loss), "vibe check", "sus"
- Keep it real and direct like a friend roasting you about your spending
- Still be specific with numbers — use ₹ for currency amounts
- Be funny but actually helpful
- IMPORTANT: Use gender-neutral language. Use "bro", "dude", "fam" — NEVER use "girl", "girlie", "queen", "sis", "bestie", or any feminine-coded terms.
- Use emojis occasionally 💀🔥😭💸
${budget > 0 ? '- ALWAYS reference their budget and whether they are on track or not' : ''}

Example vibe: "Ngl bro your Food spending is absolutely unhinged 💀 you dropped ₹8,000 on eating out — that's lowkey your entire rent money gone on butter chicken. You need to lock in fr fr."` + budgetContext

  const systemPro = `You are a professional financial advisor. Analyze the user's spending data and provide 3-4 concise, actionable insights.

RULES FOR YOUR TONE:
- Use formal, professional language suitable for a financial consultation
- Be direct, clear, and data-driven
- Reference specific numbers and percentages — use ₹ for currency amounts
- Provide structured, well-reasoned analysis
- Suggest concrete action items with expected outcomes
- Maintain a respectful, advisory tone throughout
- Do NOT use slang, emojis, or casual language
- Use bullet points for clarity
${budget > 0 ? '- ALWAYS reference their budget and provide analysis relative to their budget target' : ''}

Example: "Your food expenditure of ₹8,000 represents approximately 40% of your total monthly spending. This is significantly above the recommended 25-30% allocation. Consider meal planning and home cooking to reduce this category by ₹2,000-3,000 per month."` + budgetContext

  const system = tone === 'professional' ? systemPro : systemGenz
  const prompt = tone === 'professional'
    ? `Here is my spending data: ${JSON.stringify(transactions)}.${budget > 0 ? ` My monthly budget is ₹${budget.toLocaleString('en-IN')}.` : ''} Please provide a professional analysis of my spending patterns with actionable recommendations.`
    : `Here is my spending data: ${JSON.stringify(transactions)}.${budget > 0 ? ` My monthly budget is ₹${budget.toLocaleString('en-IN')}.` : ''} Give me insights about my spending patterns. Talk like a Gen Z bro.`
  return askOllama(prompt, system)
}

export const generateSavingTips = async (summary, tone = 'genz', budget = 0, totalSpent = 0) => {
  const budgetContext = budget > 0
    ? `\n\nIMPORTANT BUDGET CONTEXT: The user's monthly budget is ₹${budget.toLocaleString('en-IN')}. They have spent ₹${totalSpent.toLocaleString('en-IN')} so far. They are ${totalSpent > budget ? `OVER budget by ₹${(totalSpent - budget).toLocaleString('en-IN')} — saving tips should be urgent and aggressive!` : `under budget with ₹${(budget - totalSpent).toLocaleString('en-IN')} remaining — tips should help them stay on track`}. Tailor your saving tips to help them stay within or get back within their ₹${budget.toLocaleString('en-IN')} budget.`
    : ''

  const systemGenz = `You are a Gen Z finance bro who gives money-saving advice in full Gen Z slang. Give 4-5 specific, practical money-saving tips based on the user's spending categories.

RULES FOR YOUR TONE:
- Talk like a Gen Z bro: "ngl", "lowkey", "no cap", "lock in", "you're cooked if you don't", "slay your savings", "that's an L", "W move", "fr fr", "ong", "it's giving broke", "main character energy", "understood the assignment", "periodt"
- Roast their bad spending habits like a friend would
- Still give genuinely useful tips with specific amounts in ₹
- Use emojis to keep it fun 💰🔥😤💀
- Be savage but caring
- IMPORTANT: Use gender-neutral language. Use "bro", "dude", "fam" — NEVER use "girl", "girlie", "queen", "sis", "bestie", or any feminine-coded terms.
${budget > 0 ? '- ALWAYS tie tips back to their budget goal and how much they need to save' : ''}

Example vibe: "Bro you need to LOCK IN 🔒 Stop ordering Zomato every day that's literally burning your wallet alive 💀 Cook at home and you'll save like ₹4,000/month no cap. That's a W right there."` + budgetContext

  const systemPro = `You are a certified financial planner providing money-saving strategies. Give 4-5 specific, practical money-saving recommendations based on the user's spending categories.

RULES FOR YOUR TONE:
- Use professional, advisory language
- Provide specific savings estimates in ₹ for each recommendation
- Include practical implementation steps
- Reference industry benchmarks or best practices where relevant
- Prioritize tips by potential impact (highest savings first)
- Be encouraging but realistic
- Do NOT use slang, emojis, or casual language
- Use numbered points for structure
${budget > 0 ? '- ALWAYS reference their budget and frame tips in terms of achieving their budget target' : ''}

Example: "1. Dining & Food Optimization: Your current food expenditure can be reduced by approximately ₹4,000 per month through home meal preparation. Consider batch cooking on weekends and carrying packed lunches — this alone could yield annual savings of ₹48,000."` + budgetContext

  const system = tone === 'professional' ? systemPro : systemGenz
  const prompt = tone === 'professional'
    ? `My spending by category: ${JSON.stringify(summary)}.${budget > 0 ? ` My monthly budget is ₹${budget.toLocaleString('en-IN')}.` : ''} Please provide professional money-saving recommendations based on my spending patterns.`
    : `My spending by category: ${JSON.stringify(summary)}.${budget > 0 ? ` My monthly budget is ₹${budget.toLocaleString('en-IN')}.` : ''} Give me saving tips. Talk like a Gen Z bro who actually cares about my money.`
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

export const generateBudgetInsights = async (transactions, categorySummary, monthlyBudget, tone = 'genz') => {
  const totalSpent = categorySummary.reduce((sum, c) => sum + c.total, 0)
  const diff = totalSpent - monthlyBudget
  const isOver = diff > 0

  const systemGenz = `You are a Gen Z budget analyst bro who keeps it 100% real using Gen Z slang. The user has set a monthly budget. Analyze their spending vs budget and provide:

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
- IMPORTANT: Use gender-neutral language. Use "bro", "dude", "fam" — NEVER use "girl", "girlie", "queen", "sis", "bestie", or any feminine-coded terms.
- Use bullet points for structure

Example vibes:
- Over budget: "Bro you're absolutely COOKED 💀 You blew past your budget by ₹3,000 — ngl that's lowkey embarrassing. Your Food spending is living rent free in your wallet and it needs to be EVICTED. Lock in rn or your bank account is catching another L."
- Under budget: "Okay you actually understood the assignment 👑 You've got ₹5,000 left and the month isn't over yet — that's a W fr fr. But lowkey your Shopping is kinda sus, it's creeping up. Don't let it finesse you."`

  const systemPro = `You are a professional budget analyst and financial advisor. The user has set a monthly budget. Analyze their spending vs budget and provide:

1. A clear budget status summary with exact figures and percentages.
2. A detailed per-category breakdown showing budget allocation and utilization.
3. If over budget: identify the primary overspending categories and provide corrective measures with specific savings targets.
4. If under budget: acknowledge disciplined spending but flag categories with concerning growth trends.
5. Provide 3-4 specific, actionable recommendations with measurable goals.

RULES FOR YOUR TONE:
- Use formal, professional financial advisory language
- Reference exact amounts in ₹ and percentages
- Provide data-driven analysis with specific benchmarks
- Suggest concrete, measurable action items
- Maintain a constructive, advisory tone
- Do NOT use slang, emojis, or casual language
- Use bullet points for structured presentation
- Include timeframes for recommendations where applicable

Example:
- Over budget: "Budget Status: Exceeded by ₹3,000 (115% utilization). Primary concern — Food category at ₹8,000 represents 40% of total budget, which is 10% above the recommended threshold. Recommendation: Implement a weekly grocery budget of ₹1,500 and limit dining out to twice per week to bring this category within target."
- Under budget: "Budget Status: ₹5,000 remaining (75% utilization). Your spending discipline is commendable. However, the Shopping category shows a 15% week-over-week increase — monitor this trend closely to maintain your current trajectory."`

  const system = tone === 'professional' ? systemPro : systemGenz

  const prompt = tone === 'professional'
    ? `My monthly budget is ₹${monthlyBudget.toLocaleString('en-IN')}.
Total spent this month so far: ₹${totalSpent.toLocaleString('en-IN')}.
I am ${isOver ? `over budget by ₹${diff.toLocaleString('en-IN')}` : `under budget with ₹${Math.abs(diff).toLocaleString('en-IN')} remaining`}.

Spending by category this month:
${categorySummary.map(c => `  ${c._id}: ₹${c.total.toLocaleString('en-IN')} (${c.count} transactions)`).join('\n')}

Recent transactions:
${transactions.slice(0, 20).map(t => `  ${t.date ? new Date(t.date).toLocaleDateString('en-IN') : ''} | ${t.category} | ${t.description} | ₹${t.amount}`).join('\n')}

Please provide a professional budget analysis with specific recommendations to ${isOver ? 'bring spending back within' : 'maintain spending within'} my ₹${monthlyBudget.toLocaleString('en-IN')} monthly budget.`
    : `My monthly budget is ₹${monthlyBudget.toLocaleString('en-IN')}.
Total spent this month so far: ₹${totalSpent.toLocaleString('en-IN')}.
I am ${isOver ? `OVER budget by ₹${diff.toLocaleString('en-IN')} (I'm cooked 💀)` : `under budget with ₹${Math.abs(diff).toLocaleString('en-IN')} remaining (slay)`}.

Spending by category this month:
${categorySummary.map(c => `  ${c._id}: ₹${c.total.toLocaleString('en-IN')} (${c.count} transactions)`).join('\n')}

Recent transactions:
${transactions.slice(0, 20).map(t => `  ${t.date ? new Date(t.date).toLocaleDateString('en-IN') : ''} | ${t.category} | ${t.description} | ₹${t.amount}`).join('\n')}

Give me a budget vibe check with specific steps to ${isOver ? 'stop being cooked and get back within' : 'keep slaying and stay within'} my ₹${monthlyBudget.toLocaleString('en-IN')} budget. Talk like my Gen Z bro who keeps it real.`

  return askOllama(prompt, system)
}
