'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleRegister() {
    if (password.length < 8) { setError('Lösenordet måste vara minst 8 tecken'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    })
    if (error) { setError(error.message); setLoading(false); return }
    setDone(true)
  }

  if (done) return (
    <div style={{ minHeight: '100vh', background: '#F5F3EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 420, padding: '56px 48px', background: 'white', border: '1px solid #E0DDD6', borderRadius: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 20 }}>✉️</div>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 600, color: '#0A0A0C', marginBottom: 12 }}>Kolla din inbox</div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, color: '#888', lineHeight: 1.8 }}>
          Vi har skickat en bekräftelselänk till<br />
          <span style={{ color: '#0A0A0C' }}>{email}</span>
        </div>
        <a href="/login" style={{ display: 'block', marginTop: 32, fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#C0321A', textDecoration: 'none' }}>
          Tillbaka till login →
        </a>
      </div>
    </div>
  )

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
          Skapa konto
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#999', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>Namn</div>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Förnamn Efternamn"
              style={{ width: '100%', padding: '14px 16px', border: '1.5px solid #E0DDD6', borderRadius: 8, fontFamily: 'DM Mono, monospace', fontSize: 15, color: '#1a1a1a', background: '#FAFAF8', transition: 'border-color .2s' }}
              onFocus={e => e.target.style.borderColor = '#0A0A0C'}
              onBlur={e => e.target.style.borderColor = '#E0DDD6'}
            />
          </div>

          <div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#999', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>E-post</div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="din@email.se"
              style={{ width: '100%', padding: '14px 16px', border: '1.5px solid #E0DDD6', borderRadius: 8, fontFamily: 'DM Mono, monospace', fontSize: 15, color: '#1a1a1a', background: '#FAFAF8', transition: 'border-color .2s' }}
              onFocus={e => e.target.style.borderColor = '#0A0A0C'}
              onBlur={e => e.target.style.borderColor = '#E0DDD6'}
            />
          </div>

          <div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#999', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>Lösenord</div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
              placeholder="Minst 8 tecken"
              style={{ width: '100%', padding: '14px 16px', border: '1.5px solid #E0DDD6', borderRadius: 8, fontFamily: 'DM Mono, monospace', fontSize: 15, color: '#1a1a1a', background: '#FAFAF8', transition: 'border-color .2s' }}
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
            onClick={handleRegister}
            disabled={loading || !email || !password || !name}
            style={{ width: '100%', padding: '16px', background: loading ? '#666' : '#0A0A0C', color: 'white', border: 'none', borderRadius: 8, fontFamily: 'DM Mono, monospace', fontSize: 14, letterSpacing: '.08em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background .2s', marginTop: 8 }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#C0321A' }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#0A0A0C' }}
          >
            {loading ? 'Skapar konto...' : 'Skapa konto'}
          </button>
        </div>

        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #F0EDE6', textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#AAA' }}>
          Har du redan konto?{' '}
          <a href="/login" style={{ color: '#C0321A', textDecoration: 'none' }}>Logga in</a>
        </div>
      </div>
    </div>
  )
}