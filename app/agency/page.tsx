'use client'
import { useState, useEffect } from 'react'

type Client = {
  id: string
  name: string
  org_nr: string | null
  accounting_standard: string
  industry: string | null
  fortnox_connected_at: string | null
  bokio_connected_at: string | null
  contact_name: string | null
  contact_email: string | null
  notes: string | null
  status: string
  created_at: string
  transaction_stats?: {
    pending_count: number
    ready_count: number
    approved_count: number
    total_count: number
  }[]
}

type Activity = {
  id: string
  type: string
  description: string
  user_name: string | null
  created_at: string
}

const RISK_COLOR: Record<string, string> = { LÅG: '#2E6644', MEDEL: '#7A6010', HÖG: '#C0321A' }

// Demo-data för mockup
const DEMO_CLIENTS: Client[] = [
  {
    id: '1', name: 'Sthlm Records AB', org_nr: '556901-2345',
    accounting_standard: 'K2', industry: 'Musik & media',
    fortnox_connected_at: '2026-03-01T10:00:00Z', bokio_connected_at: null,
    contact_name: 'Erik Svensson', contact_email: 'erik@sthlmrecords.se',
    notes: null, status: 'active', created_at: '2026-01-15T10:00:00Z',
    transaction_stats: [{ pending_count: 7, ready_count: 18, approved_count: 45, total_count: 70 }],
  },
  {
    id: '2', name: 'AB Musikproduktion', org_nr: '559123-4567',
    accounting_standard: 'K2', industry: 'Musik',
    fortnox_connected_at: '2026-02-10T10:00:00Z', bokio_connected_at: null,
    contact_name: 'Anna Lindgren', contact_email: 'anna@musikprod.se',
    notes: null, status: 'active', created_at: '2026-02-10T10:00:00Z',
    transaction_stats: [{ pending_count: 3, ready_count: 12, approved_count: 28, total_count: 43 }],
  },
  {
    id: '3', name: 'JoJo Business Mgmt AB', org_nr: '556789-0123',
    accounting_standard: 'K3', industry: 'Konsult',
    fortnox_connected_at: '2026-01-05T10:00:00Z', bokio_connected_at: null,
    contact_name: 'Jonas Eriksson', contact_email: 'jonas@jojobiz.se',
    notes: 'Prioriterad klient', status: 'active', created_at: '2026-01-05T10:00:00Z',
    transaction_stats: [{ pending_count: 0, ready_count: 0, approved_count: 67, total_count: 67 }],
  },
  {
    id: '4', name: 'Pelikan Restaurang AB', org_nr: '556234-5678',
    accounting_standard: 'K2', industry: 'Restaurang',
    fortnox_connected_at: '2026-03-10T10:00:00Z', bokio_connected_at: null,
    contact_name: 'Maria Pelikan', contact_email: 'maria@pelikan.se',
    notes: null, status: 'active', created_at: '2026-03-10T10:00:00Z',
    transaction_stats: [{ pending_count: 2, ready_count: 5, approved_count: 12, total_count: 19 }],
  },
  {
    id: '5', name: 'Bergström & Thorén AB', org_nr: '556445-6789',
    accounting_standard: 'K2', industry: 'Bygg',
    fortnox_connected_at: null, bokio_connected_at: null,
    contact_name: 'Lars Bergström', contact_email: 'lars@bergstrom.se',
    notes: null, status: 'active', created_at: '2026-03-15T10:00:00Z',
    transaction_stats: [{ pending_count: 0, ready_count: 0, approved_count: 0, total_count: 0 }],
  },
]

const DEMO_ACTIVITY: Activity[] = [
  { id: '1', type: 'transaction_approved', description: '18 transaktioner godkända och skickade till Fortnox', user_name: 'Jonas E', created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: '2', type: 'question_asked', description: 'Fråga ställd: "Hur bokför vi royaltyintäkter från Spotify?"', user_name: null, created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: '3', type: 'connected', description: '7 nya transaktioner hämtade från Fortnox', user_name: null, created_at: new Date(Date.now() - 172800000).toISOString() },
  { id: '4', type: 'note', description: 'Klient anslöt Fortnox-integration', user_name: null, created_at: '2026-03-01T10:00:00Z' },
]

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `${mins} min sedan`
  if (hours < 24) return `${hours} tim sedan`
  if (days < 7) return `${days} dagar sedan`
  return new Date(iso).toLocaleDateString('sv-SE')
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

const AVATAR_COLORS = ['#8B2FC9', '#1A6B3A', '#0A0A0C', '#C0321A', '#5C4033', '#2C5F8A', '#7A6010', '#4A7C59']

export default function AgencyView() {
  const [clients, setClients] = useState<Client[]>(DEMO_CLIENTS)
  const [selected, setSelected] = useState<Client | null>(DEMO_CLIENTS[0])
  const [activity] = useState<Activity[]>(DEMO_ACTIVITY)
  const [showAddModal, setShowAddModal] = useState(false)
  const [search, setSearch] = useState('')
  const [newClient, setNewClient] = useState({ name: '', org_nr: '', accounting_standard: 'K2', industry: '', contact_name: '', contact_email: '' })
  const [saving, setSaving] = useState(false)

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.org_nr || '').includes(search)
  )

  const totalPending = clients.reduce((sum, c) => sum + (c.transaction_stats?.[0]?.pending_count || 0), 0)
  const totalApproved = clients.reduce((sum, c) => sum + (c.transaction_stats?.[0]?.approved_count || 0), 0)
  const connected = clients.filter(c => c.fortnox_connected_at).length

  async function addClient() {
    if (!newClient.name) return
    setSaving(true)
    // I produktion: POST till /api/agency
    const fake: Client = {
      id: String(Date.now()),
      ...newClient,
      fortnox_connected_at: null,
      bokio_connected_at: null,
      notes: null,
      status: 'active',
      created_at: new Date().toISOString(),
      transaction_stats: [{ pending_count: 0, ready_count: 0, approved_count: 0, total_count: 0 }],
    }
    setClients(c => [...c, fake])
    setSaving(false)
    setShowAddModal(false)
    setNewClient({ name: '', org_nr: '', accounting_standard: 'K2', industry: '', contact_name: '', contact_email: '' })
  }

  const stats = selected?.transaction_stats?.[0]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: '100vh', background: '#F5F3EE', fontFamily: 'Georgia, serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Mono:wght@300;400;500&display=swap');`}</style>

      {/* ── SIDEBAR ── */}
      <aside style={{ background: '#0A0A0C', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ padding: '28px 24px 20px' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 600, color: 'white', letterSpacing: '-.01em', marginBottom: 16 }}>
            Normi<span style={{ color: '#C0321A' }}>q</span>
          </div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)', marginBottom: 4 }}>Byrå</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: 'rgba(255,255,255,.6)' }}>Andersson Redovisning</div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', padding: '16px 0', flex: 1 }}>
          {[
            { label: 'Klienter', href: '/agency', active: true, badge: clients.length },
            { label: 'Tax Brain', href: '/analyze', active: false, badge: totalPending || null },
            { label: 'Advisor', href: '/app', active: false, badge: null },
            { label: 'Bibliotek', href: '/library', active: false, badge: null },
            { label: 'Inställningar', href: '#', active: false, badge: null },
          ].map(item => (
            <a key={item.label} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 24px', fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: item.active ? 'white' : 'rgba(255,255,255,.35)', textDecoration: 'none', borderLeft: `2px solid ${item.active ? '#C0321A' : 'transparent'}`, background: item.active ? 'rgba(255,255,255,.06)' : 'transparent', transition: 'all .15s' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', opacity: .6, flexShrink: 0 }} />
              {item.label}
              {item.badge != null && (
                <span style={{ marginLeft: 'auto', background: item.active ? 'rgba(255,255,255,.15)' : '#C0321A', color: 'white', fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '2px 6px', borderRadius: 10 }}>
                  {item.badge}
                </span>
              )}
            </a>
          ))}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,.5)' }}>JE</div>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 12, color: 'rgba(255,255,255,.6)' }}>Jonas Eriksson</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: 'rgba(255,255,255,.25)', letterSpacing: '.06em', marginTop: 1 }}>Admin</div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Topbar */}
        <div style={{ background: 'white', borderBottom: '1px solid #E0DDD6', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, fontWeight: 600, color: '#0A0A0C', letterSpacing: '-.01em' }}>Klienter</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', padding: '10px 18px', borderRadius: 6, cursor: 'pointer', border: '1.5px solid #E0DDD6', background: 'transparent', color: '#666' }}>
              Exportera
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', padding: '10px 18px', borderRadius: 6, cursor: 'pointer', border: 'none', background: '#0A0A0C', color: 'white', transition: 'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#C0321A'}
              onMouseLeave={e => e.currentTarget.style.background = '#0A0A0C'}
            >
              + Lägg till klient
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: '#E0DDD6', borderBottom: '1px solid #E0DDD6' }}>
          {[
            { label: 'Aktiva klienter', value: clients.length, sub: `${connected} med Fortnox` },
            { label: 'Väntar granskning', value: totalPending, sub: 'transaktioner', color: totalPending > 0 ? '#7A6010' : undefined },
            { label: 'Fortnox-kopplingar', value: connected, sub: `${clients.length - connected} ej anslutna`, color: '#2E6644' },
            { label: 'Godkända totalt', value: totalApproved, sub: 'denna månad' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'white', padding: '18px 24px' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#AAA', marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 30, fontWeight: 500, color: s.color || '#0A0A0C', letterSpacing: '-.02em', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#AAA', marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Content grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', flex: 1, overflow: 'hidden' }}>

          {/* Klientlista */}
          <div style={{ borderRight: '1px solid #E0DDD6', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 28px', borderBottom: '1px solid #E0DDD6', background: '#FAFAF8' }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Sök klient eller org.nr..."
                style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E0DDD6', borderRadius: 6, fontFamily: 'Georgia, serif', fontSize: 14, color: '#0A0A0C', background: 'white', outline: 'none' }}
              />
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filtered.map((client, idx) => {
                const s = client.transaction_stats?.[0]
                const pending = s?.pending_count || 0
                const color = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                const isSelected = selected?.id === client.id

                return (
                  <div
                    key={client.id}
                    onClick={() => setSelected(client)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr auto',
                      alignItems: 'center',
                      gap: 14,
                      padding: '18px 28px',
                      borderBottom: '1px solid #F0EDE6',
                      cursor: 'pointer',
                      background: isSelected ? '#FDF9F5' : 'white',
                      borderLeft: `3px solid ${isSelected ? '#C0321A' : 'transparent'}`,
                      transition: 'background .1s',
                    }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: 8, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'white', flexShrink: 0 }}>
                      {getInitials(client.name)}
                    </div>
                    <div>
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#0A0A0C', marginBottom: 4 }}>{client.name}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#AAA' }}>{client.org_nr || '—'}</span>
                        {client.fortnox_connected_at
                          ? <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#2E6644', background: '#EEF6F1', padding: '2px 6px', borderRadius: 3, letterSpacing: '.04em' }}>Fortnox</span>
                          : <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#7A6010', background: '#FEF9EC', padding: '2px 6px', borderRadius: 3, letterSpacing: '.04em' }}>Ej ansluten</span>
                        }
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {pending > 0 ? (
                        <>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#C0321A', fontWeight: 500 }}>{pending} nya</div>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#AAA', marginTop: 2 }}>att granska</div>
                        </>
                      ) : (
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#2E6644' }}>✓ Klart</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Klientdetalj */}
          <div style={{ background: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!selected ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: '#CCC', textAlign: 'center' }}>Välj en klient</div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid #E0DDD6' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: AVATAR_COLORS[clients.indexOf(selected) % AVATAR_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'white', flexShrink: 0 }}>
                      {getInitials(selected.name)}
                    </div>
                    <div>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 21, fontWeight: 600, color: '#0A0A0C', letterSpacing: '-.01em', marginBottom: 3 }}>{selected.name}</div>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#AAA', letterSpacing: '.06em' }}>
                        {selected.org_nr || 'Org.nr saknas'} · {selected.accounting_standard} · {selected.industry || 'Bransch ej angiven'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(stats?.pending_count || 0) > 0 && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, background: '#FDF4F3', color: '#C0321A', padding: '4px 10px', borderRadius: 4, letterSpacing: '.06em' }}>{stats!.pending_count} väntar</span>}
                    {selected.fortnox_connected_at && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, background: '#EEF6F1', color: '#2E6644', padding: '4px 10px', borderRadius: 4, letterSpacing: '.06em' }}>✓ Fortnox</span>}
                    {selected.industry && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, background: '#F5F3EE', color: '#888', padding: '4px 10px', borderRadius: 4, border: '1px solid #E0DDD6', letterSpacing: '.04em' }}>{selected.industry}</span>}
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

                  {/* Nyckeltal */}
                  <div style={{ marginBottom: 22 }}>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #F0EDE6' }}>
                      Nyckeltal mars 2026
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#E0DDD6', border: '1px solid #E0DDD6', borderRadius: 6, overflow: 'hidden' }}>
                      {[
                        { label: 'Transaktioner', value: stats?.total_count || 0 },
                        { label: 'Konterade', value: stats?.approved_count || 0, color: '#2E6644' },
                        { label: 'Väntar', value: stats?.pending_count || 0, color: (stats?.pending_count || 0) > 0 ? '#C0321A' : undefined },
                        { label: 'Redo', value: stats?.ready_count || 0 },
                      ].map((m, i) => (
                        <div key={i} style={{ background: '#FAFAF8', padding: '14px 16px' }}>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6 }}>{m.label}</div>
                          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, fontWeight: 500, color: m.color || '#0A0A0C', letterSpacing: '-.01em' }}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Integrationer */}
                  <div style={{ marginBottom: 22 }}>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #F0EDE6' }}>
                      Integrationer
                    </div>
                    {[
                      { name: 'Fortnox', color: '#0D6EFD', letter: 'F', connected: !!selected.fortnox_connected_at, since: selected.fortnox_connected_at },
                      { name: 'Bokio', color: '#6C3CE1', letter: 'B', connected: !!selected.bokio_connected_at, since: selected.bokio_connected_at },
                    ].map(int => (
                      <div key={int.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '1px solid #E0DDD6', borderRadius: 6, marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: int.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'white', fontWeight: 500 }}>{int.letter}</div>
                          <div>
                            <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: '#0A0A0C', marginBottom: 2 }}>{int.name}</div>
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: int.connected ? '#2E6644' : '#AAA' }}>
                              {int.connected ? `Ansluten ${timeAgo(int.since!)}` : 'Ej ansluten'}
                            </div>
                          </div>
                        </div>
                        <button style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', border: '1.5px solid', borderColor: int.connected ? 'transparent' : '#E0DDD6', background: int.connected ? '#EEF6F1' : 'transparent', color: int.connected ? '#2E6644' : '#666', transition: 'all .15s' }}>
                          {int.connected ? '✓ Ansluten' : 'Anslut'}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Aktivitet */}
                  <div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #F0EDE6' }}>
                      Senaste aktivitet
                    </div>
                    {activity.map(act => (
                      <div key={act.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #F0EDE6', alignItems: 'flex-start' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 5, background: act.type === 'transaction_approved' ? '#2E6644' : act.type === 'question_asked' ? '#7A6010' : '#AAA' }} />
                        <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#444', flex: 1, lineHeight: 1.5 }}>{act.description}</div>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#AAA', flexShrink: 0, marginTop: 3 }}>{timeAgo(act.created_at)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Kontaktinfo */}
                  {(selected.contact_name || selected.contact_email) && (
                    <div style={{ marginTop: 22 }}>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #F0EDE6' }}>Kontakt</div>
                      {selected.contact_name && <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: '#0A0A0C', marginBottom: 4 }}>{selected.contact_name}</div>}
                      {selected.contact_email && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#888' }}>{selected.contact_email}</div>}
                    </div>
                  )}
                </div>

                {/* Knappar */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid #E0DDD6', display: 'flex', gap: 8 }}>
                  <a
                    href={`/analyze?client_id=${selected.id}`}
                    style={{ flex: 1, padding: '12px', background: '#0A0A0C', color: 'white', border: 'none', borderRadius: 6, fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#C0321A'}
                    onMouseLeave={e => e.currentTarget.style.background = '#0A0A0C'}
                  >
                    Öppna Tax Brain →
                  </a>
                  <button style={{ padding: '12px 14px', background: 'transparent', color: '#666', border: '1.5px solid #E0DDD6', borderRadius: 6, fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Fråga
                  </button>
                  <button style={{ padding: '12px 14px', background: 'transparent', color: '#666', border: '1.5px solid #E0DDD6', borderRadius: 6, fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Redigera
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── ADD CLIENT MODAL ── */}
      {showAddModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,12,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false) }}
        >
          <div style={{ background: 'white', borderRadius: 12, width: 460, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,.2)' }}>
            <div style={{ padding: '22px 28px 18px', borderBottom: '1px solid #E0DDD6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 600, color: '#0A0A0C', letterSpacing: '-.01em' }}>Lägg till klient</div>
              <button onClick={() => setShowAddModal(false)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #E0DDD6', background: 'transparent', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 14, color: '#AAA' }}>×</button>
            </div>
            <div style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Företagsnamn *', key: 'name', placeholder: 'AB Exempelbolaget', type: 'text' },
                { label: 'Organisationsnummer', key: 'org_nr', placeholder: '556xxx-xxxx', type: 'text' },
                { label: 'Kontaktperson', key: 'contact_name', placeholder: 'Anna Andersson', type: 'text' },
                { label: 'E-post', key: 'contact_email', placeholder: 'anna@foretaget.se', type: 'email' },
                { label: 'Bransch', key: 'industry', placeholder: 'Konsult, Restaurang, Handel...', type: 'text' },
              ].map(field => (
                <div key={field.key}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 8 }}>{field.label}</div>
                  <input
                    type={field.type}
                    value={(newClient as Record<string, string>)[field.key]}
                    onChange={e => setNewClient(c => ({ ...c, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E0DDD6', borderRadius: 6, fontFamily: 'Georgia, serif', fontSize: 14, color: '#0A0A0C', background: '#FAFAF8', outline: 'none' }}
                    onFocus={e => e.target.style.borderColor = '#0A0A0C'}
                    onBlur={e => e.target.style.borderColor = '#E0DDD6'}
                  />
                </div>
              ))}
              <div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 8 }}>Redovisningsstandard</div>
                <select
                  value={newClient.accounting_standard}
                  onChange={e => setNewClient(c => ({ ...c, accounting_standard: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E0DDD6', borderRadius: 6, fontFamily: 'Georgia, serif', fontSize: 14, color: '#0A0A0C', background: '#FAFAF8', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="K2">K2 — Förenklingsregelverket</option>
                  <option value="K3">K3 — Allmänt regelverk</option>
                </select>
              </div>
            </div>
            <div style={{ padding: '16px 28px', borderTop: '1px solid #E0DDD6', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddModal(false)} style={{ padding: '11px 18px', background: 'transparent', color: '#666', border: '1.5px solid #E0DDD6', borderRadius: 6, fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Avbryt</button>
              <button
                onClick={addClient}
                disabled={saving || !newClient.name}
                style={{ padding: '11px 18px', background: !newClient.name ? '#CCC' : '#0A0A0C', color: 'white', border: 'none', borderRadius: 6, fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', cursor: !newClient.name ? 'not-allowed' : 'pointer' }}
              >
                {saving ? 'Skapar...' : 'Skapa klient'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
