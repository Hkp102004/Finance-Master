import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { transactionsAPI, aiAPI } from '../services/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// Available memes and their trigger conditions (Gen Z only)
const MEME_MAP = [
  { id: 'broke', src: '/memes/broke.webp', keywords: ['broke', 'cooked', 'no money', 'empty wallet', 'rip', 'L ', 'down bad', 'embarrassing'], conditions: ['overBudget'] },
  { id: 'food_addiction', src: '/memes/food_addiction.png', keywords: ['food', 'eating', 'zomato', 'swiggy', 'restaurant', 'dining', 'butter chicken', 'biryani', 'snack', 'order'], conditions: ['topFood'] },
  { id: 'good_job', src: '/memes/good_job.png', keywords: ['slay', 'W ', 'understood the assignment', 'amazing', 'great', 'killing it', 'nice', 'proud', 'well done', 'goat', 'king', 'queen'], conditions: ['underBudget', 'lowSpending'] },
  { id: 'overspending', src: '/memes/overspending.webp', keywords: ['overspend', 'too much', 'yikes', 'big yikes', 'unhinged', 'out of control', 'wild', 'insane', 'burning', 'hemorrhaging'], conditions: ['overBudget', 'highSpending'] },
  { id: 'shopping_addict', src: '/memes/shopping_addict.png', keywords: ['shopping', 'amazon', 'flipkart', 'haul', 'impulse', 'retail therapy', 'cart', 'buy'], conditions: ['topShopping'] },
]

const pickMemes = (aiText, { summary = [], budgetExceeded = null, topCategory = '' } = {}) => {
  if (!aiText) return []
  const lower = aiText.toLowerCase()
  const scores = MEME_MAP.map(meme => {
    let score = 0
    meme.keywords.forEach(kw => {
      if (lower.includes(kw.toLowerCase())) score += 2
    })
    meme.conditions.forEach(cond => {
      if (cond === 'overBudget' && budgetExceeded === true) score += 3
      if (cond === 'underBudget' && budgetExceeded === false) score += 3
      if (cond === 'topFood' && topCategory === 'Food') score += 3
      if (cond === 'topShopping' && topCategory === 'Shopping') score += 3
      if (cond === 'highSpending' && budgetExceeded === true) score += 2
      if (cond === 'lowSpending' && budgetExceeded === false) score += 2
    })
    return { ...meme, score }
  })
  return scores.filter(m => m.score > 0).sort((a, b) => b.score - a.score).slice(0, 2)
}

const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Housing', 'Other']
const CAT_COLORS = {
  Food: '#00ffc8', Transport: '#7b4dff', Shopping: '#f9c74f',
  Health: '#ff3a5c', Entertainment: '#3a9fff', Housing: '#ff8c42', Other: '#666'
}

const BUDGET_PRESETS = [5000, 10000, 15000, 20000, 25000, 30000, 40000, 50000, 75000, 100000]

const TABS = ['ADD', 'TRANSACTIONS', 'INSIGHTS', 'BUDGET', 'TRACKER']

export default function Dashboard() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState('ADD')
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState([])
  const [form, setForm] = useState({ description: '', amount: '', date: new Date().toISOString().split('T')[0], category: '' })
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [catLoading, setCatLoading] = useState(false)
  const [txLoading, setTxLoading] = useState(false)
  const [csvStatus, setCsvStatus] = useState('')
  const [error, setError] = useState('')

  // Tone state
  const [insightsTone, setInsightsTone] = useState(() => localStorage.getItem('nl_insights_tone') || 'genz')
  const [budgetTone, setBudgetTone] = useState(() => localStorage.getItem('nl_budget_tone') || 'genz')

  const updateInsightsTone = (tone) => { setInsightsTone(tone); localStorage.setItem('nl_insights_tone', tone); setAiText('') }
  const updateBudgetTone = (tone) => { setBudgetTone(tone); localStorage.setItem('nl_budget_tone', tone); setBudgetAiText('') }

  // Budget state
  const [monthlyBudget, setMonthlyBudget] = useState(() => {
    const saved = localStorage.getItem('nl_budget')
    return saved ? parseInt(saved) : 0
  })
  const [customBudget, setCustomBudget] = useState('')
  const [budgetResult, setBudgetResult] = useState(null)
  const [budgetAiText, setBudgetAiText] = useState('')
  const [budgetLoading, setBudgetLoading] = useState(false)

  // Reset state
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  // Monthly tracker state
  const [monthlyData, setMonthlyData] = useState([])
  const [trackerYear, setTrackerYear] = useState(new Date().getFullYear())
  const [yearTotal, setYearTotal] = useState(0)
  const [monthlyLoading, setMonthlyLoading] = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const [txRes, sumRes] = await Promise.all([
        transactionsAPI.getAll({ limit: 100 }),
        transactionsAPI.summary(),
      ])
      setTransactions(txRes.data.transactions)
      setSummary(sumRes.data.summary)
    } catch {}
  }, [])

  const fetchMonthly = useCallback(async (year) => {
    setMonthlyLoading(true)
    try {
      const res = await transactionsAPI.monthly(year)
      setMonthlyData(res.data.monthly)
      setYearTotal(res.data.yearTotal)
    } catch {} finally { setMonthlyLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { fetchMonthly(trackerYear) }, [trackerYear, fetchMonthly])

  const total = transactions.reduce((s, t) => s + t.amount, 0)
  const topCat = summary[0]?._id || '—'
  const avg = transactions.length ? Math.round(total / transactions.length) : 0

  const handleForm = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const aiCategorize = async () => {
    if (!form.description) return
    setCatLoading(true)
    try {
      const res = await aiAPI.categorize(form.description)
      setForm(f => ({ ...f, category: res.data.category }))
    } catch { } finally { setCatLoading(false) }
  }

  const addTx = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.description || !form.amount || !form.date) { setError('Fill all fields'); return }
    setTxLoading(true)
    try {
      await transactionsAPI.create({ ...form, amount: parseFloat(form.amount), category: form.category || 'Other' })
      setForm({ description: '', amount: '', date: new Date().toISOString().split('T')[0], category: '' })
      await fetchAll()
      fetchMonthly(trackerYear)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add transaction')
    } finally { setTxLoading(false) }
  }

  const deleteTx = async (id) => {
    await transactionsAPI.remove(id)
    await fetchAll()
    fetchMonthly(trackerYear)
  }

  const resetAllTransactions = async () => {
    setResetLoading(true)
    try {
      await transactionsAPI.resetAll()
      setTransactions([])
      setSummary([])
      setResetConfirm(false)
      setBudgetResult(null)
      setBudgetAiText('')
      setMonthlyData([])
      setYearTotal(0)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset transactions')
    } finally { setResetLoading(false) }
  }

  const handleCSV = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setCsvStatus('Importing...')
    try {
      const res = await transactionsAPI.importCSV(file)
      setCsvStatus(res.data.message)
      await fetchAll()
    } catch (err) {
      setCsvStatus(err.response?.data?.message || 'Import failed')
    }
    e.target.value = ''
  }

  const runInsights = async () => {
    setAiLoading(true)
    setAiText('')
    try {
      const res = await aiAPI.insights(insightsTone, monthlyBudget)
      setAiText(res.data.insights)
    } catch (err) {
      setAiText('Error: ' + (err.response?.data?.message || 'AI unavailable'))
    } finally { setAiLoading(false) }
  }

  const runTips = async () => {
    setAiLoading(true)
    setAiText('')
    try {
      const res = await aiAPI.tips(insightsTone, monthlyBudget)
      setAiText(res.data.tips)
    } catch (err) {
      setAiText('Error: ' + (err.response?.data?.message || 'AI unavailable'))
    } finally { setAiLoading(false) }
  }

  const selectBudget = (amount) => {
    setMonthlyBudget(amount)
    localStorage.setItem('nl_budget', amount.toString())
    setBudgetResult(null)
    setBudgetAiText('')
  }

  const applyCustomBudget = () => {
    const val = parseInt(customBudget)
    if (val && val > 0) {
      selectBudget(val)
      setCustomBudget('')
    }
  }

  const runBudgetAnalysis = async () => {
    if (!monthlyBudget) return
    setBudgetLoading(true)
    setBudgetAiText('')
    setBudgetResult(null)
    try {
      const res = await aiAPI.budgetInsights(monthlyBudget, budgetTone)
      setBudgetResult({
        totalSpent: res.data.totalSpent,
        budget: res.data.budget,
        remaining: res.data.remaining,
        exceeded: res.data.exceeded,
        categorySummary: res.data.categorySummary,
      })
      setBudgetAiText(res.data.insights)
    } catch (err) {
      setBudgetAiText('Error: ' + (err.response?.data?.message || 'AI unavailable'))
    } finally { setBudgetLoading(false) }
  }

  // Tone Toggle component
  const ToneToggle = ({ tone, setTone }) => (
    <div className="tone-toggle">
      <span className="tone-label">AI TONE</span>
      <div className="tone-switch">
        <button
          className={`tone-btn ${tone === 'genz' ? 'active genz' : ''}`}
          onClick={() => setTone('genz')}
        >
          🔥 GEN Z
        </button>
        <button
          className={`tone-btn ${tone === 'professional' ? 'active pro' : ''}`}
          onClick={() => setTone('professional')}
        >
          💼 PRO
        </button>
      </div>
    </div>
  )

  const chartData = summary.map(s => ({ name: s._id, value: s.total, color: CAT_COLORS[s._id] || '#666' }))

  // Budget bar calculation
  const budgetPercent = monthlyBudget > 0 ? Math.min((total / monthlyBudget) * 100, 100) : 0
  const budgetExceeded = monthlyBudget > 0 && total > monthlyBudget

  return (
    <div className="dash">
      <div className="dash-bg"><div className="dash-grid" /></div>

      <header className="dash-header">
        <div className="dash-logo">
          <span className="dash-logo-gem">◆</span>
          <span className="dash-logo-name">FINANCE MASTER</span>
        </div>
        <nav className="dash-nav">
          {TABS.map(t => (
            <button key={t} className={`dash-navbtn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>
        <div className="dash-user">
          <span className="dash-username">{user?.name}</span>
          <button className="dash-logout" onClick={logout}>LOGOUT</button>
        </div>
      </header>

      <main className="dash-main">
        {/* STATS */}
        <div className="stats-row">
          {[
            { label: 'TOTAL SPENT', value: `₹${total.toLocaleString('en-IN')}`, accent: 'white' },
            { label: 'TOP CATEGORY', value: topCat, accent: 'red' },
            { label: 'TRANSACTIONS', value: transactions.length, accent: 'accent' },
            { label: monthlyBudget ? 'BUDGET LEFT' : 'AVG PER TX', value: monthlyBudget ? `₹${(monthlyBudget - total).toLocaleString('en-IN')}` : `₹${avg.toLocaleString('en-IN')}`, accent: monthlyBudget && total > monthlyBudget ? 'red' : 'purple' },
          ].map(s => (
            <div key={s.label} className={`stat-card stat-${s.accent}`}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
            </div>
          ))}
        </div>

        {/* ADD TAB */}
        {tab === 'ADD' && (
          <div className="tab-content" style={{ animation: 'fadeUp 0.3s ease' }}>
            <div className="panel">
              <div className="panel-title">MANUAL ENTRY</div>
              <form className="tx-form" onSubmit={addTx}>
                <input className="tx-input flex-2" name="description" placeholder="Description" value={form.description} onChange={handleForm} />
                <input className="tx-input" name="amount" type="number" placeholder="Amount (₹)" value={form.amount} onChange={handleForm} min="0" style={{ width: 140 }} />
                <input className="tx-input" name="date" type="date" value={form.date} onChange={handleForm} style={{ width: 160 }} />
                <div className="tx-form-row2">
                  <select className="tx-input" name="category" value={form.category} onChange={handleForm} style={{ flex: 1 }}>
                    <option value="">— Category —</option>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <button type="button" className="btn btn-ai" onClick={aiCategorize} disabled={catLoading}>
                    {catLoading ? '...' : 'AI CATEGORIZE'}
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={txLoading}>
                    {txLoading ? '...' : 'ADD →'}
                  </button>
                </div>
                {error && <div className="form-error">{error}</div>}
              </form>
            </div>

            <div className="panel">
              <div className="panel-title">CSV IMPORT</div>
              <label className="csv-drop">
                <input type="file" accept=".csv" onChange={handleCSV} style={{ display: 'none' }} />
                <span className="csv-icon">↑</span>
                <span>Click to upload CSV</span>
                <span className="csv-hint">Format: date, description, amount, category</span>
              </label>
              {csvStatus && <div className="csv-status">{csvStatus}</div>}
            </div>
          </div>
        )}

        {/* TRANSACTIONS TAB */}
        {tab === 'TRANSACTIONS' && (
          <div className="tab-content" style={{ animation: 'fadeUp 0.3s ease' }}>
            <div className="panel">
              <div className="panel-header-row">
                <div className="panel-title">TRANSACTION LOG</div>
                {transactions.length > 0 && (
                  <div className="reset-area">
                    {!resetConfirm ? (
                      <button className="btn btn-danger" onClick={() => setResetConfirm(true)}>
                        RESET ALL
                      </button>
                    ) : (
                      <div className="reset-confirm">
                        <span className="reset-warn">Delete all {transactions.length} transactions?</span>
                        <button className="btn btn-danger-solid" onClick={resetAllTransactions} disabled={resetLoading}>
                          {resetLoading ? '...' : 'YES, DELETE ALL'}
                        </button>
                        <button className="btn btn-outline" onClick={() => setResetConfirm(false)}>
                          CANCEL
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {transactions.length === 0
                ? <div className="empty">// no transactions yet</div>
                : <div className="tx-list">
                    {transactions.map(t => (
                      <div key={t._id} className="tx-item">
                        <span className="tx-badge" style={{ background: `${CAT_COLORS[t.category]}18`, color: CAT_COLORS[t.category], border: `1px solid ${CAT_COLORS[t.category]}44` }}>{t.category}</span>
                        <span className="tx-desc">{t.description}</span>
                        <span className="tx-date">{new Date(t.date).toLocaleDateString('en-IN')}</span>
                        <span className="tx-amt">₹{t.amount.toLocaleString('en-IN')}</span>
                        <button className="tx-del" onClick={() => deleteTx(t._id)}>✕</button>
                      </div>
                    ))}
                  </div>
              }
            </div>

            {chartData.length > 0 && (
              <div className="panel">
                <div className="panel-title">SPENDING BY CATEGORY</div>
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fill: '#666', fontSize: 11, fontFamily: 'Share Tech Mono' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#666', fontSize: 11, fontFamily: 'Share Tech Mono' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: 8, fontFamily: 'Share Tech Mono', fontSize: 12 }}
                        labelStyle={{ color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, 'Spent']}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* INSIGHTS TAB */}
        {tab === 'INSIGHTS' && (
          <div className="tab-content" style={{ animation: 'fadeUp 0.3s ease' }}>
            <div className="panel">
              <div className="panel-header-row">
                <div className="panel-title">AI SPENDING ANALYSIS</div>
                <ToneToggle tone={insightsTone} setTone={updateInsightsTone} />
              </div>
              <div className="ai-actions">
                <button className="btn btn-ai" onClick={runInsights} disabled={aiLoading}>GENERATE INSIGHTS ↗</button>
                <button className="btn btn-outline" onClick={runTips} disabled={aiLoading}>SAVING TIPS ↗</button>
              </div>
              <div className="ai-box">
                {aiLoading
                  ? <span className="ai-loading">// analyzing spending patterns...</span>
                  : aiText || '// press a button above to analyze your spending with AI'
                }
              </div>
              {/* Gen Z Meme Display for Insights */}
              {insightsTone === 'genz' && aiText && !aiLoading && (() => {
                const memes = pickMemes(aiText, {
                  summary,
                  budgetExceeded: monthlyBudget > 0 ? total > monthlyBudget : null,
                  topCategory: summary[0]?._id || '',
                })
                return memes.length > 0 ? (
                  <div className="meme-container">
                    {memes.map(m => (
                      <div key={m.id} className="meme-card">
                        <img src={m.src} alt={m.id} className="meme-img" />
                      </div>
                    ))}
                  </div>
                ) : null
              })()}
            </div>
          </div>
        )}

        {/* TRACKER TAB */}
        {tab === 'TRACKER' && (
          <div className="tab-content" style={{ animation: 'fadeUp 0.3s ease' }}>
            <div className="panel">
              <div className="panel-header-row">
                <div className="panel-title">MONTHLY EXPENSE TRACKER</div>
                <div className="tracker-year-nav">
                  <button className="tracker-year-btn" onClick={() => setTrackerYear(y => y - 1)}>◀</button>
                  <span className="tracker-year-label">{trackerYear}</span>
                  <button className="tracker-year-btn" onClick={() => setTrackerYear(y => y + 1)} disabled={trackerYear >= new Date().getFullYear()}>▶</button>
                </div>
              </div>

              {monthlyLoading ? (
                <div className="empty"><span className="ai-loading">// loading monthly data...</span></div>
              ) : yearTotal === 0 ? (
                <div className="empty">// no expenses recorded for {trackerYear}</div>
              ) : (
                <>
                  <div className="tracker-stats-row">
                    <div className="tracker-stat">
                      <span className="tracker-stat-label">YEAR TOTAL</span>
                      <span className="tracker-stat-value accent">₹{yearTotal.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="tracker-stat">
                      <span className="tracker-stat-label">MONTHLY AVG</span>
                      <span className="tracker-stat-value">₹{Math.round(yearTotal / Math.max(monthlyData.filter(m => m.total > 0).length, 1)).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="tracker-stat">
                      <span className="tracker-stat-label">PEAK MONTH</span>
                      <span className="tracker-stat-value red">{monthlyData.reduce((max, m) => m.total > max.total ? m : max, monthlyData[0])?.month || '—'}</span>
                    </div>
                  </div>
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <XAxis dataKey="month" tick={{ fill: '#999', fontSize: 11, fontFamily: 'Share Tech Mono' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#666', fontSize: 11, fontFamily: 'Share Tech Mono' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: 8, fontFamily: 'Share Tech Mono', fontSize: 12 }}
                          labelStyle={{ color: '#fff' }}
                          itemStyle={{ color: '#fff' }}
                          formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, 'Spent']}
                        />
                        <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                          {monthlyData.map((entry, i) => {
                            const maxTotal = Math.max(...monthlyData.map(m => m.total), 1)
                            const intensity = entry.total / maxTotal
                            const r = Math.round(40 + intensity * 54)
                            const g = Math.round(130 + intensity * 57)
                            const b = Math.round(200 + intensity * 55)
                            return <Cell key={i} fill={entry.total === 0 ? '#1a1a1a' : `rgb(${r}, ${g}, ${b})`} />
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Monthly breakdown list */}
                  <div className="tracker-list">
                    {monthlyData.map(m => (
                      <div key={m.month} className={`tracker-month-row ${m.total === 0 ? 'empty-month' : ''}`}>
                        <span className="tracker-month-name">{m.month}</span>
                        <div className="tracker-month-bar-bg">
                          <div
                            className="tracker-month-bar-fill"
                            style={{ width: `${yearTotal > 0 ? (m.total / Math.max(...monthlyData.map(x => x.total), 1)) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="tracker-month-amt">₹{m.total.toLocaleString('en-IN')}</span>
                        <span className="tracker-month-count">{m.count} tx</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* BUDGET TAB */}
        {tab === 'BUDGET' && (
          <div className="tab-content" style={{ animation: 'fadeUp 0.3s ease' }}>
            {/* Budget Selector */}
            <div className="panel">
              <div className="panel-title">SET MONTHLY BUDGET</div>
              <div className="budget-presets">
                {BUDGET_PRESETS.map(amt => (
                  <button
                    key={amt}
                    className={`budget-chip ${monthlyBudget === amt ? 'active' : ''}`}
                    onClick={() => selectBudget(amt)}
                  >
                    ₹{amt.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>
              <div className="budget-custom-row">
                <input
                  className="tx-input"
                  type="number"
                  placeholder="Custom amount (₹)"
                  value={customBudget}
                  onChange={e => setCustomBudget(e.target.value)}
                  min="1"
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={applyCustomBudget} disabled={!customBudget}>
                  SET
                </button>
              </div>
              {monthlyBudget > 0 && (
                <div className="budget-selected">
                  <span className="budget-selected-label">CURRENT BUDGET</span>
                  <span className="budget-selected-value">₹{monthlyBudget.toLocaleString('en-IN')}/month</span>
                </div>
              )}
            </div>

            {/* Budget Progress */}
            {monthlyBudget > 0 && (
              <div className="panel">
                <div className="panel-title">BUDGET PROGRESS — THIS MONTH</div>
                <div className="budget-progress-container">
                  <div className="budget-progress-bar">
                    <div
                      className={`budget-progress-fill ${budgetExceeded ? 'exceeded' : ''}`}
                      style={{ width: `${budgetPercent}%` }}
                    />
                  </div>
                  <div className="budget-progress-labels">
                    <span className="budget-progress-spent">
                      ₹{total.toLocaleString('en-IN')} spent
                    </span>
                    <span className={`budget-progress-status ${budgetExceeded ? 'over' : 'under'}`}>
                      {budgetExceeded
                        ? `⚠ ₹${(total - monthlyBudget).toLocaleString('en-IN')} OVER`
                        : `₹${(monthlyBudget - total).toLocaleString('en-IN')} remaining`
                      }
                    </span>
                  </div>
                </div>

                {/* Per-category breakdown vs budget */}
                {summary.length > 0 && (
                  <div className="budget-category-bars">
                    {summary.map(s => {
                      const catPercent = monthlyBudget > 0 ? (s.total / monthlyBudget) * 100 : 0
                      return (
                        <div key={s._id} className="budget-cat-row">
                          <span className="budget-cat-name" style={{ color: CAT_COLORS[s._id] || '#666' }}>{s._id}</span>
                          <div className="budget-cat-bar-bg">
                            <div
                              className="budget-cat-bar-fill"
                              style={{ width: `${Math.min(catPercent, 100)}%`, background: CAT_COLORS[s._id] || '#666' }}
                            />
                          </div>
                          <span className="budget-cat-amt">₹{s.total.toLocaleString('en-IN')}</span>
                          <span className="budget-cat-pct">{catPercent.toFixed(0)}%</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* AI Budget Insights */}
            {monthlyBudget > 0 && (
              <div className="panel">
                <div className="panel-header-row">
                  <div className="panel-title">AI BUDGET ANALYSIS</div>
                  <ToneToggle tone={budgetTone} setTone={updateBudgetTone} />
                </div>
                <div className="ai-actions">
                  <button className="btn btn-ai" onClick={runBudgetAnalysis} disabled={budgetLoading}>
                    {budgetLoading ? '...' : 'ANALYZE MY BUDGET ↗'}
                  </button>
                </div>

                {budgetResult && (
                  <div className="budget-summary-cards">
                    <div className={`budget-summary-card ${budgetResult.exceeded ? 'danger' : 'success'}`}>
                      <div className="budget-summary-icon">{budgetResult.exceeded ? '⚠' : '✓'}</div>
                      <div className="budget-summary-text">
                        <span className="budget-summary-title">
                          {budgetResult.exceeded ? 'OVER BUDGET' : 'WITHIN BUDGET'}
                        </span>
                        <span className="budget-summary-amt">
                          {budgetResult.exceeded
                            ? `Exceeding by ₹${Math.abs(budgetResult.remaining).toLocaleString('en-IN')}`
                            : `₹${budgetResult.remaining.toLocaleString('en-IN')} remaining`
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="ai-box">
                  {budgetLoading
                    ? <span className="ai-loading">// analyzing spending vs budget...</span>
                    : budgetAiText || '// set a budget above, then click analyze for AI-powered budget insights'
                  }
                </div>
                {/* Gen Z Meme Display for Budget Analysis */}
                {budgetTone === 'genz' && budgetAiText && !budgetLoading && (() => {
                  const memes = pickMemes(budgetAiText, {
                    summary: budgetResult?.categorySummary || summary,
                    budgetExceeded: budgetResult?.exceeded ?? null,
                    topCategory: (budgetResult?.categorySummary || summary)[0]?._id || '',
                  })
                  return memes.length > 0 ? (
                    <div className="meme-container">
                      {memes.map(m => (
                        <div key={m.id} className="meme-card">
                          <img src={m.src} alt={m.id} className="meme-img" />
                        </div>
                      ))}
                    </div>
                  ) : null
                })()}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
