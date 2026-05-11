import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'


export default function Auth() {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(form.email, form.password)
      } else {
        await register(form.name, form.email, form.password)
      }
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-grid" />
        <div className="auth-glow" />
      </div>

      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-hex">◆</span>
          <span className="auth-logo-text">NEONLEDGER</span>
        </div>
        <p className="auth-sub">// ai-powered finance tracker</p>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError('') }}>LOGIN</button>
          <button className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setError('') }}>REGISTER</button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' && (
            <div className="auth-field" style={{ animation: 'fadeUp 0.3s ease' }}>
              <label>NAME</label>
              <input name="name" type="text" placeholder="Harsh" value={form.name} onChange={handle} required />
            </div>
          )}
          <div className="auth-field">
            <label>EMAIL</label>
            <input name="email" type="email" placeholder="harsh@example.com" value={form.email} onChange={handle} required />
          </div>
          <div className="auth-field">
            <label>PASSWORD</label>
            <input name="password" type="password" placeholder="••••••••" value={form.password} onChange={handle} required />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? <span className="auth-spinner" /> : mode === 'login' ? 'ENTER →' : 'CREATE ACCOUNT →'}
          </button>
        </form>
      </div>
    </div>
  )
}
