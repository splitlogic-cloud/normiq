'use client'
import { useState, useEffect } from 'react'

type Answer = {
  id: string
  question: string
  answer: string
  sources: string[]
  risk_level: string
  category: string
  lagrum: string[]
  verified_by: string | null
  notes: string | null
  use_count: number
  active: boolean
  created_at: string
}

const CATEGORIES = ['Alla', '3:12', 'Moms', 'Representation', 'Förmåner', 'Bokföring', 'Avskrivningar', 'Traktamente', 'Övrigt']
const RISK_COLOR: Record<string, string> = { LÅG: '#2E6644', MEDEL: '#7A6010', HÖG: '#C0321A' }
const RISK_BG: Record<string, string> = { LÅG: '#EEF6F1', MEDEL: '#FEF9EC', HÖG: '#FDF4F3' }

// Demo-data
const DEMO: Answer[] = [
  { id: '1', question: 'Hur beräknas gränsbeloppet för 3:12 inkomstår 2026?', answer: 'Från 1 januari 2026 gäller nya 3:12-regler. Förenklingsregeln och huvudregeln är ersatta av en gemensam beräkningsmodell (IL 57 kap.).\n\nGränsbeloppet beräknas som summan av fyra delar: (1) Grundbelopp = 4 × IBB för föregående år. IBB 2025 = 80 600 kr → grundbelopp 322 400 kr. (2) Lönebaserat utrymme = 50% × (andel av löneunderlag − 8 IBB = 644 800 kr). (3) Ränta på omkostnadsbelopp över 100 000 kr. (4) Sparat utdelningsutrymme.\n\nUtdelning inom gränsbeloppet beskattas med 20% (2/3 × 30%).', sources: ['IL 57:10', 'IL 57:11', 'IL 57:19'], risk_level: 'HÖG', category: '3:12', lagrum: ['IL 57 kap. 10 §', 'IL 57 kap. 11 §'], verified_by: 'Anna Lindström', notes: 'Observera att grundbeloppet fördelas proportionellt om ägaren har kvalificerade andelar i flera bolag.', use_count: 14, active: true, created_at: '2026-03-10T10:00:00Z' },
  { id: '2', question: 'Vad gäller för momsavdrag vid representation med alkohol?', answer: 'Momsavdrag för representation medges på underlag om högst 300 kr exkl. moms per person.\n\nEnbart mat (12% moms): max 36 kr/person. Mat + alkohol — schablon: 46 kr/person om kostnad >300 kr exkl. moms och debiterad moms ≥46 kr. Mat + alkohol — proportionering: beräkna mat och alkohol separat.', sources: ['ML 8:9', 'SKV Representation'], risk_level: 'MEDEL', category: 'Representation', lagrum: ['ML 8 kap. 9 §'], verified_by: 'Jonas Eriksson', notes: null, use_count: 22, active: true, created_at: '2026-03-14T10:00:00Z' },
  { id: '3', question: 'Är kostförmån för fri lunch skattepliktig och hur värderas den 2026?', answer: 'Kostförmån för fri lunch är skattepliktig och värderas till schablonvärdet (IL 61 kap. 2 §). Schablonvärdet 2026: 124 kronor per dag.\n\nFörmånsvärdet är underlag för arbetsgivaravgifter och ska redovisas i arbetsgivardeklarationen.', sources: ['IL 61:2', 'SKV Personalförmåner'], risk_level: 'LÅG', category: 'Förmåner', lagrum: ['IL 61 kap. 2 §'], verified_by: 'Anna Lindström', notes: null, use_count: 8, active: true, created_at: '2026-02-28T10:00:00Z' },
  { id: '4', question: 'Vad är direktavdragsgränsen för inventarier 2026?', answer: 'Direktavdragsgränsen för inventarier 2026 är 29 600 kr, vilket motsvarar 0,5 × prisbasbeloppet 59 200 kr (IL 18 kap. 4 §).\n\nInventarier med ekonomisk livslängd om högst 3 år ELLER anskaffningsvärde under 29 600 kr exkl. moms får dras av omedelbart som kostnad.', sources: ['IL 18:4'], risk_level: 'LÅG', category: 'Avskrivningar', lagrum: ['IL 18 kap. 4 §'], verified_by: 'Anna Lindström', notes: null, use_count: 19, active: true, created_at: '2026-01-15T10:00:00Z' },
  { id: '5', question: 'Kan ett fåmansbolag hyra arbetsrum av delägaren?', answer: '', sources: [], risk_level: 'HÖG', category: '3:12', lagrum: [], verified_by: null, notes: null, use_count: 0, active: false, created_at: '2026-03-22T10:00:00Z' },
  { id: '6', question: 'Vilka krav gäller för skattefritt friskvårdsbidrag 2026?', answer: 'Friskvårdsbidrag är skattefritt upp till maxbeloppet per anställd och år (IL 11 kap. 12 §). Bidraget måste avse enklare slag av motion och friskvård.\n\nGodkänd friskvård: gym, simning, yoga, dans, kampsport, tennis, golf (green fee, ej utrustning), bowling, ridning, friskvårdsmassage.\n\nKrav: förmånen ska erbjudas alla anställda på likartade villkor.', sources: ['IL 11:12', 'SKV Friskvård'], risk_level: 'LÅG', category: 'Förmåner', lagrum: ['IL 11 kap. 12 §'], verified_by: 'Jonas Eriksson', notes: null, use_count: 7, active: true, created_at: '2026-02-10T10:00:00Z' },
]

export default function LibraryPage() {
  const [answers, setAnswers] = useState<Answer[]>(DEMO)
  const [selected, setSelected] = useState<Answer | null>(DEMO[0])
  const [category, setCategory] = useState('Alla')
  const [filter, setFilter] = useState<'verified' | 'pending' | 'all'>('all')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [verifierName, setVerifierName] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [editMode, setEditMode] = useState(false)

  function selectAnswer(a: Answer) {
    setSelected(a)
    setEditNote(a.notes || '')
    setEditCategory(a.category || 'Övrigt')
    setEditAnswer(a.answer)
    setEditMode(false)
  }

  const filtered = answers.filter(a => {
    if (filter === 'verified' && !a.verified_by) return false
    if (filter === 'pending' && a.verified_by) return false
    if (category !== 'Alla' && a.category !== category) return false
    if (search && !a.question.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const pending = answers.filter(a => !a.verified_by).length
  const verified = answers.filter(a => a.verified_by).length
  const totalUses = answers.reduce((sum, a) => sum + a.use_count, 0)

  async function verify() {
    if (!selected || !verifierName.trim()) return
    setSaving(true)
    await fetch('/api/library', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, verified_by: verifierName, notes: editNote, category: editCategory, answer: editMode ? editAnswer : undefined, active: true }),
    })
    setAnswers(prev => prev.map(a => a.id === selected.id ? { ...a, verified_by: verifierName, notes: editNote, category: editCategory, answer: editMode ? editAnswer : a.answer, active: true } : a))
    setSaving(false)
  }

  async function deactivate(id: string) {
    if (!confirm('Ta bort detta svar från biblioteket?')) return
    await fetch(`/api/library?id=${id}`, { method: 'DELETE' })
    setAnswers(prev => prev.filter(a => a.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: '100vh', background: '#F5F3EE', fontFamily: 'Georgia, serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Mono:wght@300;400;500&display=swap');`}</style>

      {/* ── SIDEBAR ── */}
      <aside style={{ background: '#0A0A0C', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ padding: '28px 24px 20px' }}>
          <a href="/app" style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 600, color: 'white', textDecoration: 'none', letterSpacing: '-.01em', display: 'block', marginBottom: 8 }}>
            Normi<span style={{ color: '#C0321A' }}>q</span>
          </a>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', padding: '16px 0', flex: 1 }}>
          {[
            { label: 'Advisor', href: '/app', active: false },
            { label: 'Tax Brain', href: '/analyze', active: false },
            { label: 'Klienter', href: '/agency', active: false },
            { label: 'Bibliotek', href: '/library', active: true, badge: pending || null },
            { label: 'Inställningar', href: '#', active: false },
          ].map(item => (
            <a key={item.label} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 24px', fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: item.active ? 'white' : 'rgba(255,255,255,.35)', textDecoration: 'none', borderLeft: `2px solid ${item.active ? '#C0321A' : 'transparent'}`, background: item.active ? 'rgba(255,255,255,.06)' : 'transparent', transition: 'all .15s' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', opacity: .6, flexShrink: 0 }} />
              {item.label}
              {item.badge != null && <span style={{ marginLeft: 'auto', background: '#C0321A', color: 'white', fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '2px 6px', borderRadius: 10 }}>{item.badge}</span>}
            </a>
          ))}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.2)', marginBottom: 10 }}>Statistik</div>
          {[
            { label: 'Verifierade', value: verified },
            { label: 'Återanvändningar', value: totalUses },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,.25)' }}>{s.label}</span>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,.5)' }}>{s.value}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Topbar */}
        <div style={{ background: 'white', borderBottom: '1px solid #E0DDD6', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, fontWeight: 600, color: '#0A0A0C', letterSpacing: '-.01em' }}>Kunskapsbibliotek</div>
            {pending > 0 && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, background: '#FEF9EC', color: '#7A6010', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(122,96,16,.2)' }}>{pending} väntar granskning</div>}
          </div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#888', letterSpacing: '.04em' }}>
            {verified} verifierade · {totalUses} återanvändningar
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: '#E0DDD6', borderBottom: '1px solid #E0DDD6' }}>
          {[
            { label: 'Verifierade svar', value: verified, color: '#2E6644', sub: 'av revisor godkända' },
            { label: 'Väntar granskning', value: pending, color: pending > 0 ? '#7A6010' : undefined, sub: 'nya frågor' },
            { label: 'Återanvändningar', value: totalUses, sub: 'denna månad' },
            { label: 'Täckningsgrad', value: `${Math.round((verified / answers.length) * 100)}%`, sub: 'av frågor besvarade' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'white', padding: '16px 24px' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 500, color: s.color || '#0A0A0C', letterSpacing: '-.02em', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#AAA', marginTop: 3 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 440px', flex: 1, overflow: 'hidden' }}>

          {/* LISTA */}
          <div style={{ borderRight: '1px solid #E0DDD6', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Toolbar */}
            <div style={{ padding: '12px 24px', borderBottom: '1px solid #E0DDD6', background: '#FAFAF8', display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Sök fråga eller nyckelord..."
                style={{ flex: 1, padding: '8px 14px', border: '1.5px solid #E0DDD6', borderRadius: 6, fontFamily: 'Georgia, serif', fontSize: 14, color: '#0A0A0C', background: 'white', outline: 'none' }}
              />
              {(['all', 'verified', 'pending'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', padding: '7px 12px', borderRadius: 4, cursor: 'pointer', border: '1.5px solid', borderColor: filter === f ? '#0A0A0C' : '#E0DDD6', background: filter === f ? '#0A0A0C' : 'white', color: filter === f ? 'white' : '#888', transition: 'all .15s', whiteSpace: 'nowrap' }}>
                  {f === 'all' ? 'Alla' : f === 'verified' ? 'Verifierade' : 'Väntar'}
                </button>
              ))}
            </div>

            {/* Kategoriflikar */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E0DDD6', background: 'white', overflowX: 'auto' }}>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)} style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', padding: '12px 14px', cursor: 'pointer', color: category === c ? '#0A0A0C' : '#AAA', background: 'none', border: 'none', borderBottomStyle: 'solid', borderBottomWidth: 2, borderBottomColor: category === c ? '#C0321A' : 'transparent', transition: 'all .15s', whiteSpace: 'nowrap' }}>
                  {c}
                </button>
              ))}
            </div>

            {/* Svarslista */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filtered.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#CCC', letterSpacing: '.06em' }}>Inga svar hittades</div>
              )}
              {filtered.map(a => (
                <div key={a.id} onClick={() => selectAnswer(a)}
                  style={{ padding: '16px 24px', borderBottom: '1px solid #F0EDE6', cursor: 'pointer', background: selected?.id === a.id ? '#FDF9F5' : 'white', borderLeft: `3px solid ${selected?.id === a.id ? '#C0321A' : 'transparent'}`, transition: 'background .1s' }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#0A0A0C', lineHeight: 1.4, marginBottom: 8 }}>{a.question}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888' }}>{a.category}</span>
                    <span style={{ color: '#E0DDD6' }}>·</span>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 3, background: RISK_BG[a.risk_level] || '#F5F3EE', color: RISK_COLOR[a.risk_level] || '#888' }}>{a.risk_level}</span>
                    {a.verified_by
                      ? <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#2E6644' }}>✓ {a.verified_by}</span>
                      : <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#7A6010' }}>Väntar granskning</span>
                    }
                    {a.use_count > 0 && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#AAA' }}>Använt {a.use_count}×</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DETALJ */}
          <div style={{ background: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!selected ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: '#CCC', marginBottom: 8 }}>Välj ett svar</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: '#CCC', textAlign: 'center', lineHeight: 1.6 }}>Klicka på ett svar i listan för att granska och verifiera</div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E0DDD6' }}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 600, color: '#0A0A0C', lineHeight: 1.3, marginBottom: 10 }}>{selected.question}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 4, background: RISK_BG[selected.risk_level] || '#F5F3EE', color: RISK_COLOR[selected.risk_level] || '#888' }}>{selected.risk_level} risk</span>
                    {(selected.sources || []).slice(0, 3).map(src => (
                      <span key={src} style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0321A', background: '#FDF4F3', border: '1px solid rgba(192,50,26,.2)', padding: '4px 8px', borderRadius: 3 }}>{src}</span>
                    ))}
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>

                  {/* Svar */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#AAA' }}>Normiq-svar</div>
                      <button onClick={() => setEditMode(!editMode)} style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: editMode ? '#C0321A' : '#888', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                        {editMode ? '✕ Avbryt' : '✎ Redigera'}
                      </button>
                    </div>
                    {editMode ? (
                      <textarea value={editAnswer} onChange={e => setEditAnswer(e.target.value)}
                        style={{ width: '100%', minHeight: 200, padding: '12px 14px', border: '1.5px solid #0A0A0C', borderRadius: 6, fontFamily: 'Georgia, serif', fontSize: 14, color: '#0A0A0C', background: 'white', outline: 'none', resize: 'vertical', lineHeight: 1.7 }} />
                    ) : (
                      <div style={{ background: '#FAFAF8', border: '1px solid #E0DDD6', borderRadius: 6, padding: '14px 16px', fontFamily: 'Georgia, serif', fontSize: 14, color: '#333', lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: 240, overflowY: 'auto' }}>
                        {selected.answer || <span style={{ color: '#CCC', fontStyle: 'italic' }}>Inget svar ännu — redigera och verifiera</span>}
                      </div>
                    )}
                  </div>

                  {/* Kategori */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 8 }}>Kategori</div>
                    <select value={editCategory} onChange={e => setEditCategory(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E0DDD6', borderRadius: 6, fontFamily: 'Georgia, serif', fontSize: 14, color: '#0A0A0C', background: '#FAFAF8', outline: 'none', cursor: 'pointer' }}>
                      {CATEGORIES.filter(c => c !== 'Alla').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Notering */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 8 }}>
                      Revisorns notering <span style={{ textTransform: 'none', letterSpacing: 0, fontFamily: 'Georgia, serif', fontSize: 12, color: '#CCC' }}>(valfritt)</span>
                    </div>
                    <textarea value={editNote} onChange={e => setEditNote(e.target.value)}
                      placeholder="Lägg till förtydliganden, undantag eller varningar..."
                      style={{ width: '100%', minHeight: 80, padding: '10px 14px', border: '1.5px solid #E0DDD6', borderRadius: 6, fontFamily: 'Georgia, serif', fontSize: 14, color: '#0A0A0C', background: '#FAFAF8', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
                  </div>

                  {/* Verifieras av */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 8 }}>Verifieras av</div>
                    <input value={verifierName} onChange={e => setVerifierName(e.target.value)} placeholder="Ditt namn"
                      style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E0DDD6', borderRadius: 6, fontFamily: 'Georgia, serif', fontSize: 14, color: '#0A0A0C', background: '#FAFAF8', outline: 'none' }}
                      onFocus={e => e.target.style.borderColor = '#0A0A0C'}
                      onBlur={e => e.target.style.borderColor = '#E0DDD6'} />
                    {!verifierName.trim() && <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#CCC', marginTop: 6 }}>Ange ditt namn för att kunna verifiera</div>}
                  </div>

                  {/* Visas hur ofta svaret använts */}
                  {selected.use_count > 0 && (
                    <div style={{ marginTop: 16, padding: '10px 14px', background: '#EEF6F1', borderRadius: 6, fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#2E6644', letterSpacing: '.04em' }}>
                      ✓ Svaret har återanvänts {selected.use_count} gånger
                    </div>
                  )}
                </div>

                {/* Knappar */}
                <div style={{ padding: '14px 24px', borderTop: '1px solid #E0DDD6', display: 'flex', gap: 8 }}>
                  <button onClick={verify} disabled={saving || !verifierName.trim()}
                    style={{ flex: 1, padding: '12px', background: saving || !verifierName.trim() ? '#CCC' : '#2E6644', color: 'white', border: 'none', borderRadius: 6, fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', cursor: saving || !verifierName.trim() ? 'not-allowed' : 'pointer', transition: 'background .15s' }}
                    onMouseEnter={e => { if (!saving && verifierName.trim()) e.currentTarget.style.background = '#1A6B3A' }}
                    onMouseLeave={e => { if (!saving && verifierName.trim()) e.currentTarget.style.background = '#2E6644' }}>
                    {saving ? 'Sparar...' : '✓ Verifiera och aktivera'}
                  </button>
                  <button onClick={() => deactivate(selected.id)}
                    style={{ padding: '12px 16px', background: 'transparent', color: '#C0321A', border: '1.5px solid rgba(192,50,26,.3)', borderRadius: 6, fontFamily: 'DM Mono, monospace', fontSize: 11, cursor: 'pointer', transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#FDF4F3'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    Ta bort
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
