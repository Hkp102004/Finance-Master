import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const GOOGLE_CLIENT_ID = '1041458051427-h0t04e6rigcrivr5vspb9t710c5snca3.apps.googleusercontent.com'

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [gLoading, setGLoading] = useState(false)
  const { login, register, googleLogin } = useAuth()
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

  const handleGoogle = useCallback(() => {
    if (gLoading) return
    setError('')
    setGLoading(true)

    // Wait for GIS library to be ready
    const tryInit = () => {
      if (!window.google?.accounts?.id) {
        setTimeout(tryInit, 100)
        return
      }

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            await googleLogin(response.credential)
            navigate('/')
          } catch (err) {
            setError(err.response?.data?.message || 'Google sign-in failed')
          } finally {
            setGLoading(false)
          }
        },
      })

      window.google.accounts.id.prompt((notification) => {
        // If One Tap is dismissed or not displayed, fall back to popup
        if (notification.isNotDisplayed() || notification.isSkippedMoment() || notification.isDismissedMoment()) {
          // Use the popup sign-in flow
          window.google.accounts.id.renderButton(
            document.createElement('div'),
            { type: 'standard' }
          )
          // Trigger the popup manually via OAuth2
          const client = window.google.accounts.oauth2?.initCodeClient
          // Fallback: use the renderButton in a hidden div and click it
          const hiddenDiv = document.getElementById('g-hidden-btn')
          if (hiddenDiv) {
            hiddenDiv.innerHTML = ''
            window.google.accounts.id.renderButton(hiddenDiv, {
              type: 'standard',
              size: 'large',
            })
            const btn = hiddenDiv.querySelector('[role="button"]') || hiddenDiv.querySelector('div[tabindex]')
            if (btn) btn.click()
            else setGLoading(false)
          } else {
            setGLoading(false)
          }
        }
      })
    }

    tryInit()
  }, [gLoading, googleLogin, navigate])

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-grid" />
        <div className="auth-glow" />
      </div>

      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-hex">◆</span>
          <span className="auth-logo-text">FINANCE MASTER</span>
        </div>
        <p className="auth-sub">// ai-powered finance tracker</p>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError('') }}>LOGIN</button>
          <button className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setError('') }}>REGISTER</button>
        </div>

        {/* Google Sign-In Button */}
        <button
          id="google-signin-btn"
          className="google-btn"
          onClick={handleGoogle}
          disabled={gLoading}
          type="button"
        >
          {gLoading ? (
            <span className="auth-spinner" />
          ) : (
            <>
              <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>{mode === 'login' ? 'SIGN IN WITH GOOGLE' : 'SIGN UP WITH GOOGLE'}</span>
            </>
          )}
        </button>

        {/* Hidden container for GIS rendered button fallback */}
        <div id="g-hidden-btn" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0, overflow: 'hidden' }} />

        {/* Divider */}
        <div className="auth-divider">
          <span className="auth-divider-line" />
          <span className="auth-divider-text">OR</span>
          <span className="auth-divider-line" />
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' && (
            <div className="auth-field" style={{ animation: 'fadeUp 0.3s ease' }}>
              <label>NAME</label>
              <input name="name" type="text" placeholder="Name" value={form.name} onChange={handle} required />
            </div>
          )}
          <div className="auth-field">
            <label>EMAIL</label>
            <input name="email" type="email" placeholder="abc@example.com" value={form.email} onChange={handle} required />
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
