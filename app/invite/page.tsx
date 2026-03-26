'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function InvitePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'accepted' | 'error'>('loading')
  const [invite, setInvite] = useState<{ email: string; team_id: string } | null>(null)
  const [teamName, setTeamName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) { setStatus('invalid'); return }
    async function loadInvite() {
      const { data } = await supabase
        .from('team_invites')
        .select('email, team_id, accepted_at, teams(name)')
        .eq('token', token)
        .single()

      if (!data) { setStatus('invalid'); return }
      if (data.accepted_at) { setStatus('accepted'); return }

      setInvite({ email: data.email, team_id: data.team_id })
      setEmail(data.email)
      setTeamName((data.teams as any)?.name || 'teamet')
      setStatus('valid')
    }
    loadInvite()
  }, [token])

  async function handleSubmit() {
    if (!invite || !password.trim()) return
    setSubmitting(true)
    setErrorMsg('')

    try {
      let userId: string

      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: invite.email,
          password,
          options: { data: { full_name: name } },
        })
        if (error || !data.user) { setErrorMsg(error?.message || 'Registrering misslyckades'); setSubmitting(false); return }
        userId = data.user.id
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: invite.email, password })
        if (error || !data.user) { setErrorMsg('Fel e-post eller lösenord'); setSubmitting(false); return }
        userId = data.user.id
      }

      // Acceptera inbjudan via API
      await fetch('/api/team/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, user_id: userId }),
      })

      router.replace('/app')
    } catch {
      setErrorMsg('Något gick fel. Försök igen.')
    }
    setSubmitting(false)
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#F5F3EE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Georgia, serif',
    padding: 24,
  }

  const cardStyle: React.CSSProperties = {
    background: 'white',
    border: '1px solid #E0DDD6',
    borderRadius: 10,
    padding: '48px 40px',
    maxWidth: 420,
    width: '100%',
  }

  if (status === 'loading') return (
    <div style={containerStyle}>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#CCC', letterSpacing: '.06em' }}>
        Kontrollerar inbjudan...
      </div>
    </div>
  )

  if (status === 'invalid') return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: '#0A0A0C', marginBottom: 12 }}>Ogiltig inbjudan</div>
        <p style={{ fontSize: 14, color: '#888', lineHeight: 1.8, marginBottom: 24 }}>Den här länken är inte giltig eller har gått ut. Kontakta personen som bjöd in dig.</p>
        <a href="/login" style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#C0321A', textDecoration: 'none', letterSpacing: '.06em', textTransform: 'uppercase' }}>← Till inloggning</a>
      </div>
    </div>
  )

  if (status === 'accepted') return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: '#0A0A0C', marginBottom: 12 }}>Redan accepterad</div>
        <p style={{ fontSize: 14, color: '#888', lineHeight: 1.8, marginBottom: 24 }}>Den här inbjudan har redan använts. Logga in för att komma åt ditt konto.</p>
        <a href="/login" style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#C0321A', textDecoration: 'none', letterSpacing: '.06em', textTransform: 'uppercase' }}>Logga in →</a>
      </div>
    </div>
  )

  return (
    <div style={containerStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .field { width: 100%; padding: 12px 14px; border: 1.5px solid #E0DDD6; border-radius: 6px; font-family: Georgia, serif; font-size: 15px; color: #0A0A0C; background: white; outline: none; transition: border-color .2s; }
        .field:focus { border-color: #0A0A0C; }
        .submit-btn { width: 100%; padding: 14px; background: #0A0A0C; color: white; border: none; border-radius: 6px; font-family: DM Mono, monospace; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; cursor: pointer; transition: background .2s; }
        .submit-btn:hover:not(:disabled) { background: #C0321A; }
        .submit-btn:disabled { background: #CCC; cursor: not-allowed; }
      `}</style>
      <div style={cardStyle}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 600, color: '#0A0A0C', marginBottom: 6 }}>
          normi<span style={{ color: '#C0321A' }}>q</span>
        </div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#AAA', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 28 }}>
          Inbjudan till {teamName}
        </div>

        <p style={{ fontSize: 14, color: '#555', lineHeight: 1.8, marginBottom: 28 }}>
          Du har bjudits in att gå med i <strong style={{ color: '#0A0A0C' }}>{teamName}</strong> på Normiq.
          {mode === 'register' ? ' Skapa ett konto för att komma igång.' : ' Logga in för att acceptera.'}
        </p>

        {/* Toggle register/login */}
        <div style={{ display: 'flex', gap: 4, background: '#F0EDE6', borderRadius: 7, padding: 3, marginBottom: 24 }}>
          {(['register', 'login'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 5, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', transition: 'all .2s', background: mode === m ? 'white' : 'transparent', color: mode === m ? '#0A0A0C' : '#AAA', boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,.08)' : 'none' }}>
              {m === 'register' ? 'Nytt konto' : 'Logga in'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {mode === 'register' && (
            <input className="field" placeholder="Ditt namn" value={name} onChange={e => setName(e.target.value)} />
          )}
          <input className="field" type="email" value={email} readOnly
            style={{ background: '#FAFAF8', color: '#888', cursor: 'not-allowed' }} />
          <input className="field" type="password" placeholder="Lösenord" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </div>

        {errorMsg && (
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#C0321A', background: '#FDF4F3', border: '1px solid rgba(192,50,26,.2)', borderRadius: 5, padding: '10px 14px', marginBottom: 16 }}>
            {errorMsg}
          </div>
        )}

        <button className="submit-btn" onClick={handleSubmit} disabled={submitting || !password.trim()}>
          {submitting ? 'Laddar...' : mode === 'register' ? 'Skapa konto och gå med' : 'Logga in och acceptera'}
        </button>

        <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#CCC', textAlign: 'center', marginTop: 20, lineHeight: 1.7 }}>
          Konsultera alltid en skatteexpert för slutliga beslut.
        </p>
      </div>
    </div>
  )
}
