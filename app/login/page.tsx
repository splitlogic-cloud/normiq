'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [resetSent, setResetSent] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/app')
  }

  async function handleReset() {
    if (!email) { setError('Ange din e-postadress'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setResetSent(true)
  }

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    border: '1.5px solid #E0DDD6',
    borderRadius: 8,
    fontFamily: 'DM Mono, monospace',
    fontSize: 15,
    color: '#1a1a1a',
    background: '#FAFAF8',
    transition: 'border-color .2s',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Mono:wght@300;400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus { outline: none; }
      `}</style>

      <div style={{ width: 420, padding: '56px 48px', background: 'white', border: '1px solid #E0DDD6', borderRadius: 16 }}>
        <a href="/landing" style={{ textDecoration: 'none' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 600, color: '#0A0A0C', marginBottom: 8 }}>
            Normi<span style={{ color: '#C0321A' }}>q</span>
          </div>
        </a>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#BBB', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 40 }}>
          {mode === 'login' ? 'Logga in' : 'Återställ lösenord'}
        </div>

        {mode === 'login' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#999', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>E-post</div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="din@email.se"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#0A0A0C'}
                onBlur={e => e.target.style.borderColor = '#E0DDD6'}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#999', letterSpacing: '.1em', textTransform: 'uppercase' }}>Lösenord</div>
                <button
                  onClick={() => { setMode('reset'); setError('') }}
                  style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#C0321A', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '.04em' }}
                >
                  Glömt lösenord?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#0A0A0C'}
                onBlur={e => e.target.style.borderColor = '#E0DDD6'}
              />
            </div>

            {error && (
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#C0321A', background: '#FDF4F3', padding: '12px 16px', borderRadius: 8, borderLeft: '3px solid #C0321A' }}>
                {error === 'Invalid login credentials' ? 'Fel e-post eller lösenord' : error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading || !email || !password}
              style={{ width: '100%', padding: '16px', background: loading ? '#666' : '#0A0A0C', color: 'white', border: 'none', borderRadius: 8, fontFamily: 'DM Mono, monospace', fontSize: 14, letterSpacing: '.08em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background .2s', marginTop: 8 }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#C0321A' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#0A0A0C' }}
            >
              {loading ? 'Loggar in...' : 'Logga in'}
            </button>

            <div style={{ marginTop: 16, paddingTop: 24, borderTop: '1px solid #F0EDE6', textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#AAA' }}>
              Inget konto?{' '}
              <a href="/register" style={{ color: '#C0321A', textDecoration: 'none' }}>Skapa konto</a>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {resetSent ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>✉️</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#333', lineHeight: 1.7, marginBottom: 24 }}>
                  Vi har skickat en länk till <strong>{email}</strong>. Kolla din inkorg och följ instruktionerna.
                </div>
                <button
                  onClick={() => { setMode('login'); setResetSent(false) }}
                  style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#666', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '.06em', textTransform: 'uppercase' }}
                >
                  ← Tillbaka till inloggning
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: '#888', lineHeight: 1.7, marginBottom: 8 }}>
                  Ange din e-postadress så skickar vi en länk för att återställa ditt lösenord.
                </div>
                <div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#999', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>E-post</div>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleReset()}
                    placeholder="din@email.se"
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#0A0A0C'}
                    onBlur={e => e.target.style.borderColor = '#E0DDD6'}
                  />
                </div>

                {error && (
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#C0321A', background: '#FDF4F3', padding: '12px 16px', borderRadius: 8, borderLeft: '3px solid #C0321A' }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={handleReset}
                  disabled={loading || !email}
                  style={{ width: '100%', padding: '16px', background: loading ? '#666' : '#0A0A0C', color: 'white', border: 'none', borderRadius: 8, fontFamily: 'DM Mono, monospace', fontSize: 14, letterSpacing: '.08em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background .2s', marginTop: 8 }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#C0321A' }}
                  onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#0A0A0C' }}
                >
                  {loading ? 'Skickar...' : 'Skicka återställningslänk'}
                </button>

                <button
                  onClick={() => { setMode('login'); setError('') }}
                  style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#999', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 4 }}
                >
                  ← Tillbaka till inloggning
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
