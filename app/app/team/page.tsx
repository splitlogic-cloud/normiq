'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

type Member = { id: string; full_name: string | null; email: string; role: string }
type Invite = { id: string; email: string; created_at: string; accepted_at: string | null }

export default function TeamPage() {
  const supabase = createClient()

  const [members, setMembers]       = useState<Member[]>([])
  const [invites, setInvites]       = useState<Invite[]>([])
  const [teamName, setTeamName]     = useState('')
  const [teamId, setTeamId]         = useState('')
  const [maxMembers, setMaxMembers] = useState(10)
  const [loading, setLoading]       = useState(true)
  const [emailInput, setEmailInput] = useState('')
  const [sending, setSending]       = useState(false)
  const [sendResult, setSendResult] = useState<{ email: string; status: string }[]>([])
  const [userId, setUserId]         = useState('')
  const [overLimit, setOverLimit]   = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => { loadTeam() }, [])

  async function loadTeam() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: team } = await supabase
      .from('teams')
      .select('id, name, max_members')
      .eq('owner_id', user.id)
      .single()

    if (!team) { setLoading(false); return }
    setTeamId(team.id)
    setTeamName(team.name)
    setMaxMembers(team.max_members)

    const res = await fetch('/api/team/members', { headers: { 'x-user-id': user.id } })
    if (res.ok) {
      const data = await res.json()
      setMembers(data.members || [])
      setInvites(data.invites || [])
      setOverLimit(data.members?.length >= team.max_members)
    }
    setLoading(false)
  }

  async function sendInvites() {
    const emails = emailInput.split(/[\n,;]+/).map(e => e.trim()).filter(e => e.includes('@'))
    if (emails.length === 0) return
    setSending(true)
    setSendResult([])
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify({ emails }),
    })
    const data = await res.json()
    setSendResult(data.results || [])
    setEmailInput('')
    setOverLimit(data.overLimit)
    await loadTeam()
    setSending(false)
  }

  async function cancelInvite(inviteId: string) {
    if (!confirm('Ta bort inbjudan?')) return
    setActionLoading(inviteId)
    await fetch(`/api/team/invite?id=${inviteId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': userId },
    })
    await loadTeam()
    setActionLoading(null)
  }

  async function resendInvite(email: string) {
    setActionLoading(email)
    await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify({ emails: [email] }),
    })
    setActionLoading(null)
    setSendResult([{ email, status: 'sent' }])
    setTimeout(() => setSendResult([]), 3000)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', border: '1.5px solid #E0DDD6', borderRadius: 6,
    fontFamily: 'Georgia, serif', fontSize: 14, color: '#0A0A0C', background: 'white', outline: 'none',
  }

  if (loading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F5F3EE', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#CCC', letterSpacing: '.06em' }}>
      Laddar team...
    </div>
  )

  const pendingInvites = invites.filter(inv => !inv.accepted_at)

  return (
    <div style={{ minHeight: '100vh', background: '#F5F3EE', fontFamily: 'Georgia, serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .inv-btn { border: none; cursor: pointer; font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; padding: 5px 11px; border-radius: 4px; transition: opacity .15s; }
        .inv-btn:hover:not(:disabled) { opacity: .7; }
        .inv-btn:disabled { opacity: .4; cursor: not-allowed; }
      `}</style>

      <div style={{ background: 'white', borderBottom: '1px solid #E0DDD6', padding: '14px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/app" style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#AAA', textDecoration: 'none', letterSpacing: '.06em', textTransform: 'uppercase' }}>← Tillbaka</a>
        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 600, color: '#0A0A0C' }}>{teamName}</span>
        <div />
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>

        {overLimit && (
          <div style={{ background: '#FEF9EC', border: '1px solid rgba(122,96,16,.25)', borderRadius: 8, padding: '16px 20px', marginBottom: 28, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ color: '#7A6010', fontSize: 16, flexShrink: 0 }}>⚠</span>
            <div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#7A6010', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>Team-gränsen nådd</div>
              <div style={{ fontSize: 14, color: '#7A6010', lineHeight: 1.7 }}>
                Du har {members.length} av {maxMembers} platser använda. Kontakta oss på <a href="mailto:hej@normiq.se" style={{ color: '#C0321A' }}>hej@normiq.se</a> för att utöka teamet.
              </div>
            </div>
          </div>
        )}

        {/* Bjud in */}
        <div style={{ background: 'white', border: '1px solid #E0DDD6', borderRadius: 10, padding: '32px', marginBottom: 24 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 600, color: '#0A0A0C', marginBottom: 6 }}>Bjud in medlemmar</div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#AAA', letterSpacing: '.06em', marginBottom: 20 }}>
            {members.length} / {maxMembers} platser använda
          </div>
          <textarea
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            placeholder={'anna@byrå.se\njonas@byrå.se\neller kommaseparerat'}
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7, fontFamily: 'DM Mono, monospace', fontSize: 13 }}
            onFocus={e => e.target.style.borderColor = '#0A0A0C'}
            onBlur={e => e.target.style.borderColor = '#E0DDD6'}
          />
          <button
            onClick={sendInvites}
            disabled={sending || !emailInput.trim()}
            style={{ marginTop: 12, width: '100%', padding: '13px', background: sending || !emailInput.trim() ? '#CCC' : '#0A0A0C', color: 'white', border: 'none', borderRadius: 6, fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', cursor: sending || !emailInput.trim() ? 'not-allowed' : 'pointer', transition: 'background .2s' }}
            onMouseEnter={e => { if (!sending && emailInput.trim()) e.currentTarget.style.background = '#C0321A' }}
            onMouseLeave={e => { if (!sending && emailInput.trim()) e.currentTarget.style.background = '#0A0A0C' }}>
            {sending ? 'Skickar...' : 'Skicka inbjudningar'}
          </button>

          {sendResult.length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sendResult.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 5, background: r.status === 'sent' ? '#EEF6F1' : '#FDF4F3' }}>
                  <span style={{ color: r.status === 'sent' ? '#2E6644' : '#C0321A', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                    {r.status === 'sent' ? '✓' : '✕'}
                  </span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: r.status === 'sent' ? '#2E6644' : '#C0321A' }}>{r.email}</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#AAA', marginLeft: 'auto' }}>
                    {r.status === 'sent' ? 'Inbjudan skickad' : 'Misslyckades'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Medlemmar */}
        <div style={{ background: 'white', border: '1px solid #E0DDD6', borderRadius: 10, padding: '32px', marginBottom: 24 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 600, color: '#0A0A0C', marginBottom: 20 }}>Medlemmar</div>
          {members.length === 0 ? (
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#CCC', padding: '16px 0' }}>Inga medlemmar ännu</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {members.map((m, i) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: i < members.length - 1 ? '1px solid #F0EDE6' : 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#F0EDE6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#888', flexShrink: 0 }}>
                    {(m.full_name || m.email)[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, color: '#0A0A0C', marginBottom: 2 }}>{m.full_name || '—'}</div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#AAA' }}>{m.email}</div>
                  </div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 3, background: m.role === 'admin' ? '#EEF6F1' : '#F5F3EE', color: m.role === 'admin' ? '#2E6644' : '#888' }}>
                    {m.role === 'admin' ? 'Ägare' : m.role}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Väntande inbjudningar */}
        {pendingInvites.length > 0 && (
          <div style={{ background: 'white', border: '1px solid #E0DDD6', borderRadius: 10, padding: '32px' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 600, color: '#0A0A0C', marginBottom: 20 }}>Väntande inbjudningar</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {pendingInvites.map((inv, i) => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: i < pendingInvites.length - 1 ? '1px solid #F0EDE6' : 'none' }}>
                  <div style={{ flex: 1, fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#555' }}>{inv.email}</div>

                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', color: '#7A6010', background: '#FEF9EC', border: '1px solid rgba(122,96,16,.2)', padding: '3px 10px', borderRadius: 10 }}>
                    Väntar
                  </div>

                  <button
                    className="inv-btn"
                    onClick={() => resendInvite(inv.email)}
                    disabled={actionLoading === inv.email}
                    style={{ background: '#EEF6F1', color: '#2E6644', border: '1px solid rgba(46,102,68,.25)' }}>
                    {actionLoading === inv.email ? '...' : '↻ Skicka om'}
                  </button>

                  <button
                    className="inv-btn"
                    onClick={() => cancelInvite(inv.id)}
                    disabled={actionLoading === inv.id}
                    style={{ background: '#FDF4F3', color: '#C0321A', border: '1px solid rgba(192,50,26,.25)' }}>
                    {actionLoading === inv.id ? '...' : '✕ Avbryt'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}