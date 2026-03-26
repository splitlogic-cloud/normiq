'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

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

const DEMO: Answer[] = [
  { id: '1', question: 'Hur beräknas gränsbeloppet för 3:12 inkomstår 2026?', answer: 'Från 1 januari 2026 gäller nya 3:12-regler. Förenklingsregeln och huvudregeln är ersatta av en gemensam beräkningsmodell (IL 57 kap.).\n\nGränsbeloppet beräknas som summan av fyra delar:\n\n1. Grundbelopp = 4 IBB för föregående år. IBB 2025 = 80 600 kr, vilket ger grundbelopp 322 400 kr för ensam ägare.\n\n2. Lönebaserat utrymme = 50% av (andel av löneunderlag minus löneavdrag 8 IBB = 644 800 kr).\n\n3. Ränta på omkostnadsbelopp över 100 000 kr med statslåneräntan plus 9%.\n\n4. Sparat utdelningsutrymme utan ränteuppräkning.\n\nUtdelning inom gränsbeloppet beskattas med 20% (2/3 av 30%). Utdelning över gränsbeloppet beskattas som tjänst upp till 90 IBB.', sources: ['IL 57:10', 'IL 57:11', 'IL 57:19'], risk_level: 'HÖG', category: '3:12', lagrum: ['IL 57 kap. 10 §', 'IL 57 kap. 11 §', 'IL 57 kap. 19 §'], verified_by: 'Anna Lindström', notes: 'Observera att grundbeloppet fördelas proportionellt om ägaren har kvalificerade andelar i flera bolag. Kontrollera alltid om klienten äger flera fåmansbolag innan gränsbeloppet beräknas.', use_count: 14, active: true, created_at: '2026-03-10T10:00:00Z' },
  { id: '2', question: 'Vad gäller för momsavdrag vid representation med alkohol?', answer: 'Momsavdrag för representation medges på underlag om högst 300 kr exkl. moms per person.\n\nEnbart mat (12% moms): max 36 kr/person (12% av 300 kr).\n\nMat och alkohol — schablon: 46 kr/person om kostnaden överstiger 300 kr exkl. moms och debiterad moms är minst 46 kr.\n\nMat och alkohol — proportionering: beräkna mat och alkohol separat utifrån faktiska kostnader.\n\nOBS fr.o.m. 1 april 2026: om restaurangen tillämpar 6% livsmedelsmoms gäller ny schablon om 33 kr/person.', sources: ['ML 8:9', 'SKV A 2025:2'], risk_level: 'MEDEL', category: 'Representation', lagrum: ['ML 8 kap. 9 §'], verified_by: 'Jonas Eriksson', notes: null, use_count: 22, active: true, created_at: '2026-03-14T10:00:00Z' },
  { id: '3', question: 'Är kostförmån för fri lunch skattepliktig och hur värderas den 2026?', answer: 'Kostförmån för fri lunch är skattepliktig och värderas till schablonvärdet (IL 61 kap. 2 §).\n\nSchablonvärdet 2026: 124 kronor per dag.\n\nFörmånsvärdet är underlag för arbetsgivaravgifter och ska redovisas i arbetsgivardeklarationen månaden efter att förmånen erhållits.', sources: ['IL 61:2', 'SKV Personalförmåner'], risk_level: 'LÅG', category: 'Förmåner', lagrum: ['IL 61 kap. 2 §'], verified_by: 'Anna Lindström', notes: null, use_count: 8, active: true, created_at: '2026-02-28T10:00:00Z' },
  { id: '4', question: 'Vad är direktavdragsgränsen för inventarier 2026?', answer: 'Direktavdragsgränsen för inventarier 2026 är 29 600 kr, vilket motsvarar 0,5 gånger prisbasbeloppet 59 200 kr (IL 18 kap. 4 §).\n\nInventarier med ekonomisk livslängd om högst 3 år ELLER anskaffningsvärde under 29 600 kr exkl. moms får dras av omedelbart som kostnad (direktavdrag).\n\nInventarier över gränsen skrivs av med 20% per år enligt inventariemetoden eller 30% per år med räkenskapsenlig avskrivning.', sources: ['IL 18:4'], risk_level: 'LÅG', category: 'Avskrivningar', lagrum: ['IL 18 kap. 4 §'], verified_by: 'Anna Lindström', notes: null, use_count: 19, active: true, created_at: '2026-01-15T10:00:00Z' },
  { id: '5', question: 'Kan ett fåmansbolag hyra arbetsrum av delägaren?', answer: '', sources: [], risk_level: 'HÖG', category: '3:12', lagrum: [], verified_by: null, notes: null, use_count: 0, active: false, created_at: '2026-03-22T10:00:00Z' },
  { id: '6', question: 'Vilka krav gäller för skattefritt friskvårdsbidrag 2026?', answer: 'Friskvårdsbidrag är skattefritt upp till maxbeloppet per anställd och år (IL 11 kap. 12 §).\n\nBidraget måste avse enklare slag av motion och friskvård av enklare slag och inte vara av lyxbetonad karaktär.\n\nGodkänd friskvård inkluderar: gym, simning, yoga, dans, kampsport, tennis, golf (green fee, ej utrustning), bowling, ridning och friskvårdsmassage.\n\nKrav: förmånen ska erbjudas alla anställda på likartade villkor. Kontantbidrag är inte skattefritt — det måste vara en namngivit aktivitet.', sources: ['IL 11:12', 'SKV Friskvård'], risk_level: 'LÅG', category: 'Förmåner', lagrum: ['IL 11 kap. 12 §'], verified_by: 'Jonas Eriksson', notes: null, use_count: 7, active: true, created_at: '2026-02-10T10:00:00Z' },
]

export default function LibraryPage() {
  const router = useRouter()
  const supabase = createClient()
  const [answers, setAnswers] = useState<Answer[]>(DEMO)
  const [accessChecked, setAccessChecked] = useState(false)

  useEffect(() => {
    async function checkAccess() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (!profile || (profile.role !== 'admin' && profile.role !== 'reviewer')) {
        router.replace('/app')
        return
      }
      setAccessChecked(true)
    }
    checkAccess()
  }, [])

  if (!accessChecked) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F5F3EE', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#CCC', letterSpacing: '.06em' }}>
        Kontrollerar behörighet...
      </div>
    )
  }
  const [selected, setSelected] = useState<Answer | null>(DEMO[0])
  const [category, setCategory] = useState('Alla')
  const [filter, setFilter] = useState<'all' | 'verified' | 'pending'>('all')
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
    <div style={{ display: 'flex', height: '100vh', background: '#F5F3EE', fontFamily: 'Georgia, serif', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .cg { font-family: 'Cormorant Garamond', Georgia, serif; }
        .mono { font-family: 'DM Mono', monospace; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #D0CCC4; border-radius: 2px; }
        .q-item { padding: 14px 18px; border-bottom: 1px solid #F0EDE6; cursor: pointer; background: white; transition: background .1s; border-left: 3px solid transparent; }
        .q-item:hover { background: #FAFAF8; }
        .q-item.active { background: #FDF9F5; border-left-color: #C0321A; }
        .cat-btn { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; padding: 10px 12px; cursor: pointer; color: #AAA; background: none; border: none; border-bottom: 2px solid transparent; transition: all .15s; white-space: nowrap; }
        .cat-btn.active { color: #0A0A0C; border-bottom-color: #C0321A; }
        .filter-btn { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; padding: 6px 12px; border-radius: 4px; cursor: pointer; border: 1.5px solid; transition: all .15s; }
      `}</style>

      {/* ── LINKER KOLUMN: Frågelista ── */}
      <div style={{ width: 320, background: 'white', borderRight: '1px solid #E0DDD6', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #E0DDD6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 600, color: '#0A0A0C', letterSpacing: '-.01em' }}>
              Kunskapsbibliotek
            </div>
            {pending > 0 && (
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, background: '#FEF9EC', color: '#7A6010', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(122,96,16,.2)', whiteSpace: 'nowrap' }}>
                {pending} väntar
              </div>
            )}
          </div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#AAA', letterSpacing: '.04em' }}>
            {verified} verifierade · {totalUses} återanvändningar
          </div>
        </div>

        {/* Sök + filter */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #E0DDD6', background: '#FAFAF8' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Sök fråga..."
            style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #E0DDD6', borderRadius: 6, fontFamily: 'Georgia, serif', fontSize: 14, color: '#0A0A0C', background: 'white', outline: 'none', marginBottom: 8 }}
            onFocus={e => e.target.style.borderColor = '#0A0A0C'}
            onBlur={e => e.target.style.borderColor = '#E0DDD6'}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'verified', 'pending'] as const).map(f => (
              <button key={f} className="filter-btn" onClick={() => setFilter(f)}
                style={{ borderColor: filter === f ? '#0A0A0C' : '#E0DDD6', background: filter === f ? '#0A0A0C' : 'white', color: filter === f ? 'white' : '#888' }}>
                {f === 'all' ? 'Alla' : f === 'verified' ? 'Verifierade' : 'Väntar'}
              </button>
            ))}
          </div>
        </div>



        {/* Frågelista */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#CCC', letterSpacing: '.06em' }}>
              Inga svar hittades
            </div>
          )}
          {filtered.map(a => (
            <div key={a.id} className={`q-item${selected?.id === a.id ? ' active' : ''}`} onClick={() => selectAnswer(a)}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: '#0A0A0C', lineHeight: 1.45, marginBottom: 7 }}>
                {a.question}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#AAA' }}>{a.category}</span>
                <span style={{ color: '#E0DDD6' }}>·</span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 3, background: RISK_BG[a.risk_level] || '#F5F3EE', color: RISK_COLOR[a.risk_level] || '#888' }}>
                  {a.risk_level}
                </span>
                {a.verified_by
                  ? <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#2E6644' }}>✓ {a.verified_by}</span>
                  : <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#7A6010' }}>Väntar</span>
                }
                {a.use_count > 0 && (
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#CCC', marginLeft: 'auto' }}>{a.use_count}×</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── HÖGER: Svar + verifiering ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Topbar */}
        <div style={{ background: 'white', borderBottom: '1px solid #E0DDD6', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/app" style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#AAA', textDecoration: 'none', letterSpacing: '.06em', textTransform: 'uppercase' }}>
            ← Tillbaka
          </a>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#AAA', letterSpacing: '.08em' }}>
            {verified} verifierade · {totalUses} återanvändningar
          </div>
        </div>

        {!selected ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: '#CCC', marginBottom: 10 }}>Välj ett svar</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#CCC', lineHeight: 1.7 }}>Klicka på en fråga i listan till vänster</div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'grid', gridTemplateRows: '1fr auto', overflow: 'hidden' }}>

            <div style={{ overflowY: 'auto', padding: '32px 40px' }}>
              <div style={{ maxWidth: 780 }}>

                {/* Frågan */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 600, color: '#0A0A0C', lineHeight: 1.2, letterSpacing: '-.01em', marginBottom: 12 }}>
                    {selected.question}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 4, background: RISK_BG[selected.risk_level] || '#F5F3EE', color: RISK_COLOR[selected.risk_level] || '#888' }}>
                      {selected.risk_level} risk
                    </span>
                    {(selected.sources || []).map(src => (
                      <span key={src} style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0321A', background: '#FDF4F3', border: '1px solid rgba(192,50,26,.2)', padding: '3px 8px', borderRadius: 3 }}>{src}</span>
                    ))}
                    {selected.verified_by && (
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#2E6644', background: '#EEF6F1', border: '1px solid rgba(46,102,68,.2)', padding: '3px 10px', borderRadius: 3 }}>
                        ✓ Verifierad av {selected.verified_by}
                      </span>
                    )}
                  </div>
                </div>

                {/* Svarsrutan — stor och tydlig */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#AAA' }}>Normiq-svar</div>
                    <button
                      onClick={() => setEditMode(!editMode)}
                      style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: editMode ? '#C0321A' : '#AAA', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {editMode ? '✕ Avbryt redigering' : '✎ Redigera'}
                    </button>
                  </div>
                  {editMode ? (
                    <textarea
                      value={editAnswer}
                      onChange={e => setEditAnswer(e.target.value)}
                      style={{ width: '100%', minHeight: 320, padding: '20px 22px', border: '1.5px solid #0A0A0C', borderRadius: 8, fontFamily: 'Georgia, serif', fontSize: 15, color: '#0A0A0C', background: 'white', outline: 'none', resize: 'vertical', lineHeight: 1.85 }}
                    />
                  ) : (
                    <div style={{ background: 'white', border: '1px solid #E0DDD6', borderRadius: 8, padding: '20px 22px', fontFamily: 'Georgia, serif', fontSize: 15, color: '#333', lineHeight: 1.85, whiteSpace: 'pre-wrap', minHeight: 280 }}>
                      {selected.answer || <span style={{ color: '#CCC', fontStyle: 'italic' }}>Inget svar ännu — redigera och verifiera</span>}
                    </div>
                  )}
                </div>

                {/* Lagrum */}
                {selected.lagrum?.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 8 }}>Lagrum</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {selected.lagrum.map((l, i) => (
                        <span key={i} style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#C0321A', background: '#FDF4F3', border: '1px solid rgba(192,50,26,.2)', padding: '5px 12px', borderRadius: 4 }}>{l}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Divider */}
                <div style={{ height: 1, background: '#F0EDE6', marginBottom: 24 }} />

                {/* Verifieringsformulär */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 8 }}>Kategori</div>
                    <select value={editCategory} onChange={e => setEditCategory(e.target.value)}
                      style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E0DDD6', borderRadius: 6, fontFamily: 'Georgia, serif', fontSize: 14, color: '#0A0A0C', background: 'white', outline: 'none', cursor: 'pointer' }}>
                      {CATEGORIES.filter(c => c !== 'Alla').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 8 }}>Verifieras av</div>
                    <input value={verifierName} onChange={e => setVerifierName(e.target.value)} placeholder="Ditt namn"
                      style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E0DDD6', borderRadius: 6, fontFamily: 'Georgia, serif', fontSize: 14, color: '#0A0A0C', background: 'white', outline: 'none' }}
                      onFocus={e => e.target.style.borderColor = '#0A0A0C'}
                      onBlur={e => e.target.style.borderColor = '#E0DDD6'} />
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 8 }}>
                    Revisorns notering <span style={{ fontFamily: 'Georgia, serif', fontSize: 12, textTransform: 'none', letterSpacing: 0, color: '#CCC' }}>(valfritt)</span>
                  </div>
                  <textarea value={editNote} onChange={e => setEditNote(e.target.value)}
                    placeholder="Lägg till förtydliganden, undantag eller varningar som visas för användaren..."
                    style={{ width: '100%', minHeight: 80, padding: '12px 14px', border: '1.5px solid #E0DDD6', borderRadius: 6, fontFamily: 'Georgia, serif', fontSize: 14, color: '#0A0A0C', background: 'white', outline: 'none', resize: 'vertical', lineHeight: 1.65 }}
                    onFocus={e => e.target.style.borderColor = '#0A0A0C'}
                    onBlur={e => e.target.style.borderColor = '#E0DDD6'} />
                </div>

                {selected.use_count > 0 && (
                  <div style={{ padding: '10px 14px', background: '#EEF6F1', borderRadius: 6, fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#2E6644', letterSpacing: '.04em', marginBottom: 20 }}>
                    ✓ Svaret har återanvänts {selected.use_count} gånger
                  </div>
                )}

              </div>
            </div>

            {/* Knappar — sticky längst ner */}
            <div style={{ padding: '16px 40px', borderTop: '1px solid #E0DDD6', background: 'white', display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                onClick={verify}
                disabled={saving || !verifierName.trim()}
                style={{ padding: '13px 28px', background: saving || !verifierName.trim() ? '#CCC' : '#2E6644', color: 'white', border: 'none', borderRadius: 6, fontFamily: 'DM Mono, monospace', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', cursor: saving || !verifierName.trim() ? 'not-allowed' : 'pointer', transition: 'background .15s' }}
                onMouseEnter={e => { if (!saving && verifierName.trim()) e.currentTarget.style.background = '#1A6B3A' }}
                onMouseLeave={e => { if (!saving && verifierName.trim()) e.currentTarget.style.background = '#2E6644' }}>
                {saving ? 'Sparar...' : '✓ Verifiera och aktivera'}
              </button>
              <button
                onClick={() => deactivate(selected.id)}
                style={{ padding: '13px 20px', background: 'transparent', color: '#C0321A', border: '1.5px solid rgba(192,50,26,.3)', borderRadius: 6, fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer', transition: 'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#FDF4F3'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                Ta bort
              </button>
              {!verifierName.trim() && (
                <span style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#CCC', marginLeft: 4 }}>
                  Ange ditt namn för att verifiera
                </span>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
