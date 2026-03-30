'use client'

import React, { useEffect, useRef, useState } from 'react'

// ─── Types ───────────────────────────────────
interface SIEData {
  companyName: string
  orgNumber: string
  fiscalYearStart: string
  fiscalYearEnd: string
  accounts: Record<string, { number: string; name: string }>
  accountTotals: Record<string, number>
}

interface NEField {
  id: string
  label: string
  hint: string
  value: number
  accs: string[]
  confidence: 'high' | 'medium'
}

interface NEFlag {
  sev: 'err' | 'warn' | 'info'
  msg: string
  detail: string
}

interface MappingData {
  fields: Record<string, NEField>
  int: number
  kst: number
  bokf: number
  flags: NEFlag[]
  avskr: number
  kapital: number
}

interface BSData {
  al: { acc: string; name: string; amt: number }[]
  ll: { acc: string; name: string; amt: number }[]
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 'parse'

// ─── SIE Parser ──────────────────────────────
function parseSIE(txt: string): SIEData {
  const lines = txt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const s: SIEData = {
    companyName: '', orgNumber: '', fiscalYearStart: '', fiscalYearEnd: '',
    accounts: {}, accountTotals: {},
  }
  const closingBalances: { acc: string; amt: number }[] = []
  const vouchers: { tx: { acc: string; amt: number }[] }[] = []
  let cv: { tx: { acc: string; amt: number }[] } | null = null

  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('//')) continue
    const { lbl, tok } = parseLine(line)
    switch (lbl) {
      case '#FNAMN': s.companyName = unq(tok[0] || ''); break
      case '#ORGNR': s.orgNumber = tok[0] || ''; break
      case '#RAR':
        if (parseInt(tok[0] || '0') === 0) {
          s.fiscalYearStart = tok[1] || ''; s.fiscalYearEnd = tok[2] || ''
        }
        break
      case '#KONTO':
        if (tok[0]) s.accounts[tok[0]] = { number: tok[0], name: unq(tok[1] || '') }
        break
      case '#UB': case '#RES':
        if (parseInt(tok[0] || '0') === 0 && tok[1])
          closingBalances.push({ acc: tok[1], amt: pf(tok[2] || '0') })
        break
      case '#VER': if (cv) vouchers.push(cv); cv = { tx: [] }; break
      case '#TRANS':
        if (cv && tok[0]) {
          let i = 1
          if (tok[i] === '{') { while (i < tok.length && tok[i] !== '}') i++; i++ }
          cv.tx.push({ acc: tok[0], amt: pf(tok[i] || '0') })
        }
        break
    }
  }
  if (cv) vouchers.push(cv)
  for (const b of closingBalances)
    s.accountTotals[b.acc] = (s.accountTotals[b.acc] || 0) + b.amt
  if (!Object.keys(s.accountTotals).length)
    for (const v of vouchers)
      for (const t of v.tx)
        s.accountTotals[t.acc] = (s.accountTotals[t.acc] || 0) + t.amt
  return s
}

function parseLine(line: string) {
  const tok: string[] = []; let i = 0
  while (i < line.length && line[i] !== ' ' && line[i] !== '\t') i++
  const lbl = line.substring(0, i).toUpperCase()
  while (i < line.length) {
    while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i++
    if (i >= line.length) break
    if (line[i] === '"') {
      i++; let s = ''
      while (i < line.length && line[i] !== '"') {
        if (line[i] === '\\') { i++; s += line[i] } else s += line[i]; i++
      }
      i++; tok.push(s)
    } else if (line[i] === '{') {
      let d = 0, s = ''
      while (i < line.length) {
        if (line[i] === '{') d++
        else if (line[i] === '}') { d--; s += line[i]; i++; if (!d) break }
        s += line[i]; i++
      }
      tok.push(s)
    } else {
      let s = ''
      while (i < line.length && line[i] !== ' ' && line[i] !== '\t') { s += line[i]; i++ }
      tok.push(s)
    }
  }
  return { lbl, tok }
}

function unq(s: string) { return s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s }
function pf(s: string) { return parseFloat(s.replace(/\s/g, '').replace(',', '.')) || 0 }
function decodeSIE(buf: ArrayBuffer) {
  for (const enc of ['windows-1252', 'iso-8859-1', 'utf-8'] as const) {
    try { return new TextDecoder(enc, { fatal: true }).decode(buf) } catch { }
  }
  return new TextDecoder('windows-1252', { fatal: false }).decode(buf)
}

// ─── NE Mapper ───────────────────────────────
const NM: Record<string, { r: [string, string][]; inv: boolean; label: string; hint: string }> = {
  R1:  { r: [['3000','3799']], inv: true,  label: 'Nettoomsättning',              hint: '3000–3799' },
  R2:  { r: [['3800','3989']], inv: true,  label: 'Övriga rörelseintäkter',        hint: '3800–3989' },
  R3:  { r: [['8300','8499']], inv: true,  label: 'Ränteintäkter',                 hint: '8300–8499' },
  R10: { r: [['4000','4999']], inv: false, label: 'Varor, material, tjänster',     hint: '4000–4999' },
  R11: { r: [['7000','7399'],['7600','7699']], inv: false, label: 'Löner till anställda', hint: '7000–7699' },
  R12: { r: [['7400','7599']], inv: false, label: 'Arbetsgivaravgifter',            hint: '7400–7599' },
  R13: { r: [['5000','5999']], inv: false, label: 'Lokalkostnader',                hint: '5000–5999' },
  R14: { r: [['6110','6299']], inv: false, label: 'Resekostnader',                 hint: '6110–6299' },
  R15: { r: [['6000','6109'],['6300','6999']], inv: false, label: 'Övriga externa kostnader', hint: '6000–6999' },
  R16: { r: [['7800','7899']], inv: false, label: 'Avskrivningar',                 hint: '7800–7899' },
  R17: { r: [['8400','8499']], inv: false, label: 'Räntekostnader',                hint: '8400–8499' },
}

function getRng(sie: SIEData, from: string, to: string) {
  let tot = 0; const a: string[] = []
  for (const [k, v] of Object.entries(sie.accountTotals))
    if (k >= from && k <= to && Math.abs(v) > 0) { tot += v; a.push(k) }
  return { tot, a }
}

function mapSIE(sie: SIEData): MappingData {
  const fields: Record<string, NEField> = {}
  for (const [id, cfg] of Object.entries(NM)) {
    let tot = 0; const a: string[] = []
    for (const [f, t] of cfg.r) { const r = getRng(sie, f, t); tot += r.tot; a.push(...r.a) }
    const value = Math.round(cfg.inv ? -tot : tot)
    fields[id] = {
      id, label: cfg.label, hint: cfg.hint, value, accs: a,
      confidence: a.length === 0 ? 'high' : ['R1','R10','R11','R16'].includes(id) ? 'high' : id === 'R14' && value === 0 ? 'medium' : 'high',
    }
  }
  const int = (fields.R1?.value || 0) + (fields.R2?.value || 0) + (fields.R3?.value || 0)
  const kst = ['R10','R11','R12','R13','R14','R15','R16','R17'].reduce((s, id) => s + (fields[id]?.value || 0), 0)
  const bokf = int - kst
  const flags: NEFlag[] = []
  if ((sie.accountTotals['6570'] || 0) > 100)
    flags.push({ sev: 'warn', msg: '6570 Bankavgifter', detail: 'Kontrollera om privata kortavgifter ingår.' })
  if ((sie.accountTotals['6993'] || 0) > 0)
    flags.push({ sev: 'err', msg: '6993 Böter/skattetillägg — EJ avdragsgilla', detail: 'IL 9:10. Återför i §H R32.' })
  if ((fields.R14?.value || 0) === 0)
    flags.push({ sev: 'info', msg: 'Inga resekostnader registrerade', detail: 'Har du haft tjänsteresor? Traktamente kan tillkomma.' })
  const avskr = Math.round(Math.abs((sie.accountTotals['7810'] || 0) + (sie.accountTotals['7820'] || 0) + (sie.accountTotals['7830'] || 0)))
  const ekRaw = Object.entries(sie.accountTotals).filter(([a]) => a >= '2000' && a <= '2099').reduce((s, [, v]) => s + v, 0)
  return { fields, int: Math.round(int), kst: Math.round(kst), bokf: Math.round(bokf), flags, avskr, kapital: Math.round(Math.abs(ekRaw)) }
}

function buildBS(sie: SIEData): BSData {
  const al: BSData['al'] = [], ll: BSData['ll'] = []
  for (const [a, v] of Object.entries(sie.accountTotals)) {
    if (Math.abs(v) < 0.01) continue
    const row = { acc: a, name: sie.accounts[a]?.name || a, amt: Math.round(Math.abs(v)) }
    if (a >= '1000' && a <= '1999') al.push(row)
    if (a >= '2000' && a <= '2999') ll.push(row)
  }
  return {
    al: al.sort((a, b) => a.acc.localeCompare(b.acc)),
    ll: ll.sort((a, b) => a.acc.localeCompare(b.acc)),
  }
}

// ─── Tax Calculator ──────────────────────────
function calcStep3(base: number, vals: Record<string, number>) {
  const g = (k: string) => vals[k] || 0
  const dA = (g('r6') - g('r5')) - g('r8') + g('r9')
  const dB = g('r11') + g('r12') + g('r13') - g('r10')
  const dC = g('r15') - g('r14')
  const dD = g('r20') - g('r19')
  const dE = -Math.min(g('r21'), Math.max(0, base))
  const dF = g('r25') + g('r27') - g('r24') - g('r26')
  const dG = -(g('r28') - g('r29'))
  const dH = g('r31') + g('r32') + g('r33') + g('r34') - g('r35')
  return { dA, dB, dC, dD, dE, dF, dG, dH, tot: Math.max(0, base + dA + dB + dC + dD + dE + dF + dG + dH) }
}

function calcEga(base: number, passiv: boolean, extraNed: number = 0) {
  if (passiv) {
    const sls = Math.round(base * 0.2426)
    const avd25 = Math.round((base - sls) * 0.25)
    const slutlig = base - avd25
    const kom = Math.round(slutlig * 0.32)
    return { sum: sls, ned: 0, netto: sls, avd25, slutlig, kom, beg: Math.round(slutlig * 0.00279), ef: 0, rf: 0, tot: kom + Math.round(slutlig * 0.00279) + sls }
  }
  const r = { ap: 0.1021, sj: 0.0364, fp: 0.026, ep: 0.006, as: 0.002, am: 0, al: 0.1162 }
  const parts = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(base * v)]))
  const sum = Object.values(parts).reduce((a, b) => a + b, 0)
  const ned = Math.min(Math.round(base * 0.075), 15000)
  const netto = Math.max(0, sum - ned - extraNed)
  const avd25 = Math.round((base - netto) * 0.25)
  const slutlig = base - avd25
  const kom = Math.round(slutlig * 0.32)
  const beg = Math.round(slutlig * 0.00279)
  return { ...parts, sum, ned, netto, avd25, slutlig, kom, beg, ef: 0, rf: 0, tot: kom + beg + netto }
}

// ─── Formatting ──────────────────────────────
const fmt = (n: number) => Math.round(n).toLocaleString('sv-SE')
const sgn = (n: number) => (n >= 0 ? '+ ' : '− ') + fmt(Math.abs(n)) + ' kr'

// ─── Demo SIE ────────────────────────────────
const DEMO_SIE = `#FLAGGA 0
#SIETYP 4
#FNAMN "Demo Musik AB"
#ORGNR 198801011234
#RAR 0 20240101 20241231
#KONTO 3010 "Försäljning tjänster"
#KONTO 4010 "Inköp material"
#KONTO 4400 "Underentreprenörer"
#KONTO 5010 "Lokalhyra"
#KONTO 6570 "Bankavgifter"
#KONTO 6910 "Licensavgifter"
#KONTO 7810 "Avskrivningar inventarier"
#KONTO 8310 "Ränteintäkter"
#KONTO 1200 "Inventarier"
#KONTO 1500 "Kundfordringar"
#KONTO 1900 "Kassa och bank"
#KONTO 2010 "Eget kapital"
#KONTO 2440 "Leverantörsskulder"
#KONTO 2500 "Skatteskulder"
#UB 0 3010 -420000
#UB 0 4010 -85000
#UB 0 4400 -27400
#UB 0 5010 -36000
#UB 0 6570 -1240
#UB 0 6910 -27460
#UB 0 7810 -14500
#UB 0 8310 -240
#UB 0 1200 48333
#UB 0 1500 82000
#UB 0 1900 156000
#UB 0 2010 45000
#UB 0 2440 -28000
#UB 0 2500 -15000`

// ─── Accordion Component ─────────────────────
function Accordion({ code, name, sum, children }: { code: string; name: string; sum: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ border: '1px solid #DDD8CF', borderRadius: 4, marginBottom: 8, overflow: 'hidden', background: '#fff' }}>
      <div onClick={() => setOpen(!open)} style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: '#EDE8DF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.06em', color: '#C0392B', background: '#FDF0EE', border: '1px solid #E8C4BF', padding: '2px 8px' }}>{code}</span>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {sum && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#9A9690' }}>{sum}</span>}
          <span style={{ fontSize: 10, color: '#9A9690', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .2s' }}>▾</span>
        </div>
      </div>
      {open && <div>{children}</div>}
    </div>
  )
}

// ─── Main Component ───────────────────────────
export default function DeklaraPage() {
  const [step, setStep] = useState<Step>(1)
  const [sieData, setSieData] = useState<SIEData | null>(null)
  const [mapping, setMapping] = useState<MappingData | null>(null)
  const [bs, setBS] = useState<BSData | null>(null)
  const [filename, setFilename] = useState('')
  const [parseProgress, setParseProgress] = useState(0)
  const [parseSteps, setParseSteps] = useState<('idle' | 'run' | 'done')[]>(Array(5).fill('idle'))

  // Step 3 fields
  const [j, setJ] = useState<Record<string, number>>({})
  const setJv = (k: string, v: number) => setJ(prev => ({ ...prev, [k]: v }))

  // Step 5
  const [passiv, setPassiv] = useState(false)
  const [extraNed, setExtraNed] = useState(0)

  // AI drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMessages, setDrawerMessages] = useState<{ role: string; content: string }[]>([])
  const [drawerInput, setDrawerInput] = useState('')
  const [drawerLoading, setDrawerLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auth is handled by middleware.ts — no client-side check needed

  // Scroll drawer
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [drawerMessages])

  // Derived values
  const bokf = mapping?.bokf || 0
  const s3 = calcStep3(bokf, j)
  const skattemassigt = s3.tot
  const ega = calcEga(skattemassigt, passiv, extraNed)

  // Parse flow
  async function runParse(sie: SIEData, fname: string) {
    setStep('parse')
    setFilename(fname)
    const steps: ('idle' | 'run' | 'done')[] = Array(5).fill('idle')
    const delays = [360, 400, 50, 460, 400]

    for (let i = 0; i < 5; i++) {
      steps[i] = 'run'
      setParseSteps([...steps])
      setParseProgress((i / 5) * 100)
      await new Promise(r => setTimeout(r, delays[i]))
      if (i === 2) {
        const m = mapSIE(sie)
        const b = buildBS(sie)
        setMapping(m)
        setBS(b)
        setJ(prev => ({
          ...prev,
          r5: m.avskr, r6: m.avskr, r17: m.kapital,
        }))
      }
      steps[i] = 'done'
      setParseSteps([...steps])
    }
    setParseProgress(100)
    await new Promise(r => setTimeout(r, 200))
    setStep(2)
  }

  async function handleFile(file: File) {
    const buf = await file.arrayBuffer()
    const txt = decodeSIE(buf)
    const sie = parseSIE(txt)
    setSieData(sie)
    await runParse(sie, file.name)
  }

  function loadDemo() {
    const sie = parseSIE(DEMO_SIE)
    setSieData(sie)
    runParse(sie, 'demo_2024.se')
  }

  // AI chat
  async function sendMessage(content: string) {
    if (!content.trim()) return
    const newMessages = [...drawerMessages, { role: 'user', content }]
    setDrawerMessages(newMessages)
    setDrawerInput('')
    setDrawerLoading(true)
    try {
      const res = await fetch('/api/deklarera/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      setDrawerMessages([...newMessages, { role: 'assistant', content: data.response }])
    } catch {
      setDrawerMessages([...newMessages, { role: 'assistant', content: 'Anslutning misslyckades.' }])
    }
    setDrawerLoading(false)
  }

  function openDrawer(initialMsg?: string) {
    setDrawerMessages([])
    setDrawerOpen(true)
    if (initialMsg) sendMessage(initialMsg)
  }

  // SRU generation
  function generateSRU() {
    const f = mapping?.fields || {}
    const fv = (id: string) => Math.round(f[id]?.value || 0)
    const row = (n: number, v: number, c: string) =>
      v ? `#UPPGIFT ${n} ${v}       ; ${c}` : `;#UPPGIFT ${n} 0       ; ${c}`
    return [
      '#BLANKETT NE',
      `#IDENTITET ${sieData?.orgNumber || '—'} ${sieData?.fiscalYearStart || ''} ${sieData?.fiscalYearEnd || ''} 1`,
      '', row(1,fv('R1'),'R1'), row(2,fv('R2'),'R2'), row(3,fv('R3'),'R3'),
      '', row(10,fv('R10'),'R10'), row(11,fv('R11'),'R11'), row(12,fv('R12'),'R12'),
      row(13,fv('R13'),'R13'), row(14,fv('R14'),'R14'), row(15,fv('R15'),'R15'), row(16,fv('R16'),'R16'),
      '', row(20,j.r5||0,'R5'), row(21,j.r6||0,'R6'), row(30,j.r10||0,'PF'),
      row(40,j.r14||0,'EF'), row(50,j.r19||0,'RF'), row(55,j.r24||0,'Pension'),
      '', row(60,ega.netto,'EGA'), row(61,ega.avd25,'25%-avdrag'),
      '', row(99,ega.slutlig,'Slutligt överskott'),
      '', '#BLANKETTSLUT', '#FIL',
    ].join('\n')
  }

  function downloadSRU() {
    const blob = new Blob([generateSRU()], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'NE_2024.sru'
    a.click()
  }

  const nav = (n: number) => {
    if (n === 5) { setStep(5 as Step) }
    else setStep(n as Step)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Render ─────────────────────────────────
  const STEPS = [
    { n: 1, label: 'SIE-import',         sub: 'Ladda upp SIE-fil' },
    { n: 2, label: 'Resultaträkning',     sub: 'NE avsnitt A–B' },
    { n: 3, label: 'Balansräkning',       sub: 'Tillgångar & skulder' },
    { n: 4, label: 'Justeringar',         sub: 'NE §A–§H' },
    { n: 5, label: 'Egenavgifter',        sub: 'EGA §1–§4 + skatt' },
    { n: 6, label: 'Granska & exportera', sub: 'SRU-fil + PDF' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", background: '#F5F0E8' }}>

      {/* ── SIDEBAR ── */}
      <aside style={{ width: 240, background: '#fff', borderRight: '1px solid #DDD8CF', padding: '24px 0', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '0 20px', marginBottom: 4, fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, fontWeight: 700 }}>Deklarera NE</div>
        <div style={{ padding: '0 20px', fontSize: 11, color: '#9A9690', marginBottom: 20 }}>Taxeringsår 2025 · Inkomstår 2024</div>

        {filename && (
          <div style={{ margin: '0 16px 16px', padding: '10px 14px', background: '#F5F0E8', border: '1px solid #DDD8CF', borderRadius: 4 }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9A9690', marginBottom: 5 }}>Laddad fil</div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{filename}</div>
            {sieData?.companyName && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>{sieData.companyName}</div>}
          </div>
        )}

        {STEPS.map(s => {
          const curNum = typeof step === 'number' ? step : 0
          const isDone = curNum > s.n
          const isActive = curNum === s.n
          return (
            <div
              key={s.n}
              onClick={() => curNum >= s.n && nav(s.n)}
              style={{
                display: 'flex', gap: 10, padding: '9px 20px', cursor: curNum >= s.n ? 'pointer' : 'default',
                borderLeft: isActive ? '2px solid #C0392B' : '2px solid transparent',
                background: isActive ? '#F5F0E8' : 'transparent',
                opacity: curNum < s.n ? 0.4 : 1, transition: 'all .15s',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'DM Mono, monospace', fontSize: 9,
                background: isDone ? '#EFF7F2' : isActive ? '#1A1A18' : '#EDE8DF',
                border: `1px solid ${isDone ? '#B7D9C8' : isActive ? '#1A1A18' : '#C8C3BA'}`,
                color: isDone ? '#2D6A4F' : isActive ? '#fff' : '#6A6660',
              }}>
                {isDone ? '✓' : s.n}
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#3A3832' }}>{s.label}</div>
                <div style={{ fontSize: 11, color: '#9A9690' }}>{s.sub}</div>
              </div>
            </div>
          )
        })}

        <div style={{ height: 1, background: '#DDD8CF', margin: '16px 20px' }} />
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontSize: 12, color: '#6A6660', lineHeight: 1.6, marginBottom: 10 }}>
            Har du en skattefråga?
          </div>
          <button
            onClick={() => openDrawer()}
            style={{ width: '100%', padding: '8px 12px', background: '#F5F0E8', border: '1px solid #DDD8CF', fontSize: 12, fontWeight: 500, color: '#3A3832', cursor: 'pointer', borderRadius: 2, fontFamily: 'inherit' }}
          >
            Fråga Normiq ↗
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={{ flex: 1, minWidth: 0 }}>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div style={{ maxWidth: 600, padding: '48px 36px 60px' }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#C0392B', marginBottom: 10 }}>Normiq Deklarera · Blankett NE</div>
            <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 38, fontWeight: 700, lineHeight: 1.12, marginBottom: 10 }}>Ladda upp din SIE-fil</h1>
            <p style={{ fontSize: 14, color: '#6A6660', lineHeight: 1.65, marginBottom: 32, maxWidth: 460 }}>
              Filen läses lokalt i din webbläsare. AI mappar konton mot NE-rader och vägleder dig steg för steg.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              style={{ border: '1px solid #C8C3BA', background: '#fff', padding: '40px 32px', textAlign: 'center', cursor: 'pointer', borderRadius: 4, marginBottom: 12 }}
            >
              <input ref={fileInputRef} type="file" accept=".se,.sie,.si" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              <div style={{ fontSize: 24, marginBottom: 10, opacity: .45 }}>📁</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, marginBottom: 5 }}>Dra hit din SIE-fil</div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', letterSpacing: '.06em' }}>SIE 4 · SIE 4E · Fortnox · Visma · Björn Lundén · Bokio</div>
            </div>

            <div style={{ textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', margin: '14px 0', letterSpacing: '.08em' }}>— eller —</div>

            <button
              onClick={loadDemo}
              style={{ width: '100%', padding: '13px 18px', background: '#EDE8DF', border: '1px solid #C8C3BA', fontSize: 13, fontWeight: 500, color: '#3A3832', cursor: 'pointer', borderRadius: 2, fontFamily: 'inherit' }}
            >
              Kör med exempeldata — Enskild firma, musik/tjänst, 485 000 kr
            </button>
          </div>
        )}

        {/* Parse animation */}
        {step === 'parse' && (
          <div style={{ padding: '60px 36px', maxWidth: 480 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Analyserar bokföringen</h2>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#C0392B', marginBottom: 28, letterSpacing: '.04em' }}>{filename}</div>
            <div style={{ height: 2, background: '#DDD8CF', marginBottom: 24, borderRadius: 1, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#C0392B', width: `${parseProgress}%`, transition: 'width .5s ease' }} />
            </div>
            {['Läser SIE-struktur och kontoplan', 'Summerar UB/RES-saldon per konto', 'Mappar konton → NE-rader', 'Identifierar avvikelser och flaggar', 'Bygger balansräkning'].map((label, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 10px', fontFamily: 'DM Mono, monospace', fontSize: 11, color: parseSteps[i] === 'done' ? '#2D6A4F' : parseSteps[i] === 'run' ? '#1A1A18' : '#9A9690', background: parseSteps[i] === 'run' ? '#EDE8DF' : 'transparent', borderRadius: 2, marginBottom: 4 }}>
                <span style={{ width: 14, textAlign: 'center' }}>
                  {parseSteps[i] === 'done' ? '✓' : parseSteps[i] === 'run' ? '◌' : '○'}
                </span>
                {label}
              </div>
            ))}
          </div>
        )}

        {/* Step 2: Resultaträkning */}
        {step === 2 && mapping && (
          <div style={{ maxWidth: 780, padding: '32px 36px 60px' }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginBottom: 20, letterSpacing: '.06em', cursor: 'pointer' }} onClick={() => nav(1)}>← TILLBAKA</div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 700, marginBottom: 8 }}>Resultaträkning</h1>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {['NE AVSNITT A–B', 'INKOMSTÅR 2024'].map(t => <span key={t} style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '3px 9px', border: '1px solid #C8C3BA', color: '#6A6660', letterSpacing: '.06em' }}>{t}</span>)}
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '3px 9px', border: '1px solid #B7D9C8', color: '#2D6A4F', background: '#EFF7F2', letterSpacing: '.04em' }}>✓ Mappat från {filename}</span>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: '#DDD8CF', border: '1px solid #DDD8CF', marginBottom: 22 }}>
              {[{ label: 'Intäkter', val: fmt(mapping.int) + ' kr', color: '#2D6A4F' }, { label: 'Kostnader', val: fmt(mapping.kst) + ' kr', color: '#C0392B' }, { label: 'Bokfört överskott', val: fmt(mapping.bokf) + ' kr', color: '#1A1A18' }, { label: 'Konton', val: Object.keys(sieData?.accounts || {}).length + ' st', color: '#6A6660' }].map(s => (
                <div key={s.label} style={{ background: '#fff', padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9A9690', marginBottom: 5 }}>{s.label}</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* Tables */}
            {[{ title: 'Avsnitt A — Rörelsens intäkter', ids: ['R1','R2','R3'], total: mapping.int }, { title: 'Avsnitt B — Rörelsens kostnader', ids: ['R10','R11','R12','R13','R14','R15','R16','R17'], total: mapping.kst }].map(section => (
              <div key={section.title} style={{ background: '#fff', border: '1px solid #DDD8CF', borderRadius: 4, marginBottom: 18, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: '#EDE8DF', borderBottom: '1px solid #DDD8CF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9A9690' }}>{section.title}</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500 }}>{fmt(section.total)} kr</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Rad','Benämning','Konton','Belopp','Säkerhet'].map(h => <th key={h} style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9A9690', padding: '7px 14px', borderBottom: '1px solid #DDD8CF', textAlign: h === 'Belopp' ? 'right' : 'left', fontWeight: 400, background: '#EDE8DF' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {section.ids.map(id => {
                      const f = mapping.fields[id]
                      if (!f) return null
                      return (
                        <tr key={id} style={{ borderBottom: '1px solid #DDD8CF' }}>
                          <td style={{ padding: '9px 14px', fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B' }}>{id}</td>
                          <td style={{ padding: '9px 14px', fontSize: 13 }}>
                            {f.label}
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>{f.accs.join(', ') || '—'}</div>
                          </td>
                          <td style={{ padding: '9px 14px', fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690' }}>{f.hint}</td>
                          <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500 }}>{f.value ? fmt(f.value) + ' kr' : <span style={{ color: '#9A9690' }}>0 kr</span>}</td>
                          <td style={{ padding: '9px 14px' }}>
                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '2px 7px', border: '1px solid', borderRadius: 2, color: f.confidence === 'high' ? '#2D6A4F' : '#92620A', borderColor: f.confidence === 'high' ? '#B7D9C8' : '#E8D4A0', background: f.confidence === 'high' ? '#EFF7F2' : '#FDF5E6' }}>
                              {f.confidence === 'high' ? 'Hög' : 'Kontroll'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Flags */}
            {mapping.flags.length > 0 && (
              <div style={{ border: '1px solid #DDD8CF', borderRadius: 4, overflow: 'hidden', marginBottom: 18 }}>
                {mapping.flags.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '11px 14px', borderBottom: i < mapping.flags.length - 1 ? '1px solid #DDD8CF' : 'none', borderLeft: `3px solid ${f.sev === 'err' ? '#C0392B' : f.sev === 'warn' ? '#92620A' : '#2D6A4F'}`, background: '#fff' }}>
                    <div style={{ fontSize: 13 }}>{f.sev === 'err' ? '🚨' : f.sev === 'warn' ? '⚠️' : '✓'}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{f.msg}</div>
                      <div style={{ fontSize: 12, color: '#6A6660', lineHeight: 1.55 }}>{f.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 22, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => nav(3)} style={{ padding: '10px 20px', background: '#1A1A18', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', borderRadius: 2, fontFamily: 'inherit' }}>Balansräkning →</button>
              <button onClick={() => openDrawer('Berätta om mappningen och vad jag bör kontrollera.')} style={{ padding: '10px 16px', background: '#fff', color: '#3A3832', border: '1px solid #C8C3BA', fontSize: 13, fontWeight: 500, cursor: 'pointer', borderRadius: 2, fontFamily: 'inherit' }}>Fråga Normiq</button>
            </div>
          </div>
        )}

        {/* Step 3: Balance Sheet */}
        {step === 3 && bs && sieData && (
          <div style={{ maxWidth: 780, padding: '32px 36px 60px' }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginBottom: 20, letterSpacing: '.06em', cursor: 'pointer' }} onClick={() => nav(2)}>← TILLBAKA</div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 700, marginBottom: 16 }}>Balansräkning</h1>

            {(() => {
              const totA = bs.al.reduce((s, l) => s + l.amt, 0)
              const totL = bs.ll.reduce((s, l) => s + l.amt, 0)
              const atv = bs.al.filter(l => l.acc <= '1399').reduce((s, l) => s + l.amt, 0)
              const otv = bs.al.filter(l => l.acc >= '1400').reduce((s, l) => s + l.amt, 0)
              const ekv = bs.ll.filter(l => l.acc <= '2199').reduce((s, l) => s + l.amt, 0)
              const skv = bs.ll.filter(l => l.acc >= '2200').reduce((s, l) => s + l.amt, 0)
              const diff = Math.abs(totA - totL)

              const BsGroup = ({ title, lines }: { title: string; lines: typeof bs.al }) => {
                if (!lines.length) return null
                const tot = lines.reduce((s, l) => s + l.amt, 0)
                return (
                  <>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9A9690', padding: '8px 14px 3px', borderBottom: '1px solid #DDD8CF', background: '#F5F0E8' }}>{title}</div>
                    {lines.map(l => (
                      <div key={l.acc} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid #DDD8CF', fontSize: 12 }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginRight: 8, flexShrink: 0 }}>{l.acc}</span>
                        <span style={{ flex: 1, color: '#3A3832' }}>{l.name}</span>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500, marginLeft: 10 }}>{fmt(l.amt)} kr</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid #DDD8CF', fontSize: 12, fontWeight: 600, background: '#EDE8DF' }}>
                      <span>Summa</span><span style={{ fontFamily: 'DM Mono, monospace' }}>{fmt(tot)} kr</span>
                    </div>
                  </>
                )
              }

              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: '#DDD8CF', border: '1px solid #DDD8CF', marginBottom: 16 }}>
                    {[{ l: 'Anläggningstillgångar', v: fmt(atv) + ' kr' }, { l: 'Omsättningstillgångar', v: fmt(otv) + ' kr' }, { l: 'Skulder', v: fmt(skv) + ' kr' }, { l: 'Eget kapital', v: fmt(ekv) + ' kr' }].map(s => (
                      <div key={s.l} style={{ background: '#fff', padding: '14px 16px' }}>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9A9690', marginBottom: 5 }}>{s.l}</div>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700 }}>{s.v}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: '#fff', border: `1px solid #DDD8CF`, borderLeft: `3px solid ${diff < 1000 ? '#2D6A4F' : '#92620A'}`, borderRadius: 4, marginBottom: 16, fontSize: 12, alignItems: 'center' }}>
                    <span>{diff < 1000 ? '✓' : '⚠'}</span>
                    <span>
                      {diff < 1000
                        ? <><strong>Balansen stämmer</strong> — Tillgångar {fmt(totA)} kr = Skulder + EK {fmt(totL)} kr</>
                        : <><strong>Differens {fmt(diff)} kr</strong> — kontrollera SIE-filen</>}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                    {[
                      { title: 'Tillgångar', total: totA, groups: [{ t: 'Anläggningstillgångar', l: bs.al.filter(l => l.acc <= '1399') }, { t: 'Omsättningstillgångar', l: bs.al.filter(l => l.acc >= '1400') }] },
                      { title: 'Eget kapital & skulder', total: totL, groups: [{ t: 'Eget kapital', l: bs.ll.filter(l => l.acc <= '2199') }, { t: 'Långfristiga skulder', l: bs.ll.filter(l => l.acc >= '2200' && l.acc <= '2499') }, { t: 'Kortfristiga skulder', l: bs.ll.filter(l => l.acc >= '2500') }] },
                    ].map(col => (
                      <div key={col.title} style={{ background: '#fff', border: '1px solid #DDD8CF', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', background: '#EDE8DF', borderBottom: '1px solid #DDD8CF', display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9A9690' }}>{col.title}</span>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500 }}>{fmt(col.total)} kr</span>
                        </div>
                        {col.groups.map(g => <BsGroup key={g.t} title={g.t} lines={g.l} />)}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 700, background: '#EDE8DF', borderTop: '2px solid #C8C3BA' }}>
                          <span>Summa</span><span>{fmt(col.total)} kr</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )
            })()}

            <div style={{ display: 'flex', gap: 8, marginTop: 22, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => nav(4)} style={{ padding: '10px 20px', background: '#1A1A18', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', borderRadius: 2, fontFamily: 'inherit' }}>Skattemässiga justeringar →</button>
              <button onClick={() => openDrawer('Kommentera balansräkningen — likviditet, soliditet och vad som är relevant för deklarationen.')} style={{ padding: '10px 16px', background: '#fff', color: '#3A3832', border: '1px solid #C8C3BA', fontSize: 13, fontWeight: 500, cursor: 'pointer', borderRadius: 2, fontFamily: 'inherit' }}>Fråga Normiq</button>
              <button onClick={() => nav(2)} style={{ background: 'none', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#9A9690', cursor: 'pointer', letterSpacing: '.06em' }}>← Tillbaka</button>
            </div>
          </div>
        )}

        {/* ── STEP 4: JUSTERINGAR ── */}
        {step === 4 && (
          <div style={{ maxWidth: 780, padding: '32px 36px 60px' }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginBottom: 20, letterSpacing: '.06em', cursor: 'pointer' }} onClick={() => nav(3)}>← TILLBAKA</div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 700, marginBottom: 8 }}>Skattemässiga justeringar</h1>
            <div style={{ fontSize: 13, color: '#6A6660', marginBottom: 20 }}>Bokfört resultat justeras till skattemässigt överskott. <span style={{ color: '#2D6A4F' }}>Grön kant</span> = SIE-förifyllt. Allt räknas om live.</div>

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1, background: '#DDD8CF', border: '1px solid #DDD8CF', marginBottom: 22 }}>
              {[{ l: 'Bokfört', v: fmt(bokf) + ' kr' }, { l: 'Avskr.', v: sgn(s3.dA) }, { l: 'Fond/fördelning', v: sgn(s3.dB + s3.dC + s3.dD) }, { l: 'Avdrag/tillägg', v: sgn(s3.dE + s3.dF + s3.dG + s3.dH) }, { l: 'Skattemässigt', v: fmt(skattemassigt) + ' kr' }].map(s => (
                <div key={s.l} style={{ background: '#fff', padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9A9690', marginBottom: 5 }}>{s.l}</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700 }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Accordions */}
            {[
              { code: 'NE §A', name: 'Avskrivningar & nedskrivningar', sum: sgn(s3.dA), info: { type: 'blue', text: 'Räkenskapsenlig avskrivning max 30% av ingående UB. Differens mot bokförd = skattemässigt tillägg (+) eller avdrag (−).' }, fields: [{ id: 'r5', label: 'Bokförda avskrivningar på inventarier', hint: 'Konto 7810–7839 i SIE', sie: true }, { id: 'r6', label: 'Skattemässigt tillåtna avskrivningar', hint: 'Max 30% × ingående UB inventarier', sie: true }, { id: 'r7', label: 'Skillnad (R6 − R5)', hint: 'Auto', calc: true }, { id: 'r8', label: 'Nedskrivning lager (återföring)', hint: '' }, { id: 'r9', label: 'Övriga skattemässiga tillägg', hint: 'Omedelbart avdrag inventarier < 28 650 kr' }] },
              { code: 'NE §B', name: 'Periodiseringsfond', sum: sgn(s3.dB), info: { type: 'amber', text: `⚡ Max avsättning: 30% × ${fmt(bokf)} kr = ${fmt(Math.floor(bokf * 0.30))} kr. Skattebesparning ca ${fmt(Math.round(Math.floor(bokf * 0.30) * 0.30))} kr.` }, fields: [{ id: 'r10', label: 'Årets avsättning till periodiseringsfond', hint: 'Max 30% av skattemässigt överskott · Frivillig' }, { id: 'r11', label: 'Obligatorisk återföring (tax.år 2019)', hint: 'Senaste möjliga återföring' }, { id: 'r12', label: 'Frivillig återföring (tax.år 2020–2024)', hint: '' }, { id: 'r13', label: 'Ränta på kvarvarande fond (1,50%)', hint: '1,50% × ingående fondbalans · Intäkt' }] },
              { code: 'NE §C', name: 'Expansionsfond', sum: sgn(s3.dC), info: { type: 'blue', text: '20,6% fondskatt vid avsättning. Max = justerat eget kapital.' }, fields: [{ id: 'r14', label: 'Avsättning till expansionsfond', hint: '20,6% fondskatt · Frivillig' }, { id: 'r15', label: 'Minskning av expansionsfond', hint: '' }, { id: 'r16', label: 'Expansionsfondsskatt (20,6% × R14)', hint: 'Auto', calc: true }] },
              { code: 'NE §D', name: 'Räntefördelning', sum: sgn(s3.dD), info: { type: 'blue', text: 'Omvandlar näringsinkomst till kapital (30%). Ränta 6,49% × kapitalunderlag.' }, fields: [{ id: 'r17', label: 'Kapitalunderlag (ingående justerat EK)', hint: 'Auto från balansräkning', sie: true }, { id: 'r18', label: 'Max positiv räntefördelning (6,49% × R17)', hint: 'Auto', calc: true }, { id: 'r19', label: 'Positiv räntefördelning (frivillig)', hint: 'Max R18 · Kapitalinkomst 30%' }, { id: 'r20', label: 'Negativ räntefördelning (obligatorisk)', hint: '' }] },
              { code: 'NE §E', name: 'Outnyttjat underskott', sum: sgn(s3.dE), info: { type: 'amber', text: 'Rullas vidare utan tidsgräns. Kan kvittas mot tjänst (70%) de första 5 åren.' }, fields: [{ id: 'r21', label: 'Outnyttjat underskott från föregående år', hint: '' }, { id: 'r22', label: 'Utnyttjat underskott i år', hint: 'Auto — max årets överskott', calc: true }, { id: 'r23', label: 'Kvarstående (rullas vidare)', hint: 'Auto', calc: true }] },
              { code: 'NE §F', name: 'Pension, sjuklön & sjukpenning', sum: sgn(s3.dF), info: { type: 'blue', text: 'Tjänstepension max 35% av överskott (tak 573 000 kr) · IL 28:5.' }, fields: [{ id: 'r24', label: 'Avdrag för pensionssparande / tjänstepension', hint: 'Max 35% · IL 28:5' }, { id: 'r25', label: 'Sjukpenning / föräldrapenning (intäkt)', hint: '' }, { id: 'r26', label: 'Betald sjuklön till anställda', hint: '', sie: true }, { id: 'r27', label: 'Erhållen sjuklöneersättning från FK (intäkt)', hint: '' }] },
              { code: 'NE §G', name: 'Egenavgifter föregående år — medgivna / påförda', sum: sgn(s3.dG), info: { type: 'blue', text: 'Föregående års 25%-avdrag (medgivna) vs. faktiska avgifter (påförda). Raden de flesta missar.' }, fields: [{ id: 'r28', label: 'Avdrag medgivna egenavgifter föregående år', hint: 'Beloppet du drog av på förra NE' }, { id: 'r29', label: 'Faktiskt påförda egenavgifter föregående år', hint: 'Från slutskattebesked' }, { id: 'r30', label: 'Justering (R28 − R29)', hint: 'Pos = återföring · Neg = extra avdrag · Auto', calc: true }] },
              { code: 'NE §H', name: 'Övriga justeringar', sum: sgn(s3.dH), info: null, fields: [{ id: 'r31', label: 'Representation — ej avdragsgill del', hint: 'Max 180 kr exkl. moms / person' }, { id: 'r32', label: 'Böter och skattetillägg (IL 9:10)', hint: 'Aldrig avdragsgilla' }, { id: 'r33', label: 'Schablonintäkt (ISK / räntefond i rörelsen)', hint: '' }, { id: 'r34', label: 'Övriga skattemässiga tillägg', hint: '' }, { id: 'r35', label: 'Övriga skattemässiga avdrag', hint: '' }] },
            ].map(acc => (
              <Accordion key={acc.code} code={acc.code} name={acc.name} sum={acc.sum}>
                {acc.info && (
                  <div style={{ margin: '8px 14px', padding: '10px 13px', fontSize: 12, lineHeight: 1.65, borderRadius: 2, background: acc.info.type === 'blue' ? '#EBF3FA' : '#FDF5E6', borderLeft: `2px solid ${acc.info.type === 'blue' ? '#5A96C8' : '#92620A'}`, color: acc.info.type === 'blue' ? '#2A5070' : '#92620A' }}>{acc.info.text}</div>
                )}
                {acc.fields.map(f => (
                  <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'start', padding: '9px 14px', borderBottom: '1px solid #DDD8CF' }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B', paddingTop: 2 }}>{f.id.toUpperCase()}</span>
                    <div>
                      <div style={{ fontSize: 13, color: '#3A3832', lineHeight: 1.4 }}>{f.label}</div>
                      {f.hint && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>{f.hint}</div>}
                    </div>
                    <input
                      type="text"
                      value={fmt(j[f.id] || 0)}
                      readOnly={f.calc}
                      onChange={e => {
                        const v = parseInt(e.target.value.replace(/\D/g, '')) || 0
                        setJv(f.id, v)
                      }}
                      style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500, padding: '6px 10px', background: f.calc ? '#EDE8DF' : f.sie ? '#EFF7F2' : '#F5F0E8', border: `1px solid ${f.calc ? '#DDD8CF' : f.sie ? '#B7D9C8' : '#C8C3BA'}`, color: f.calc ? '#9A9690' : '#1A1A18', width: '100%', textAlign: 'right', outline: 'none', borderRadius: 2 }}
                    />
                  </div>
                ))}
              </Accordion>
            ))}

            {/* Calc summary */}
            <div style={{ background: '#fff', border: '1px solid #DDD8CF', borderRadius: 4, marginTop: 20, overflow: 'hidden' }}>
              {[{ l: 'Bokfört överskott', v: fmt(bokf) + ' kr' }, { l: '§A Avskrivningar', v: sgn(s3.dA) }, { l: '§B Periodiseringsfond', v: sgn(s3.dB) }, { l: '§C Expansionsfond', v: sgn(s3.dC) }, { l: '§D Räntefördelning', v: sgn(s3.dD) }, { l: '§E Underskott', v: sgn(s3.dE) }, { l: '§F Pension & sjuklön', v: sgn(s3.dF) }, { l: '§G Egenavgifter föregående år', v: sgn(s3.dG) }, { l: '§H Övriga', v: sgn(s3.dH) }].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #DDD8CF', fontSize: 13 }}>
                  <span style={{ color: '#6A6660' }}>{row.l}</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500 }}>{row.v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#EDE8DF', borderTop: '2px solid #C8C3BA' }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700 }}>Skattemässigt överskott</span>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700 }}>{fmt(skattemassigt)} kr</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 22, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => nav(5)} style={{ padding: '10px 20px', background: '#1A1A18', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', borderRadius: 2, fontFamily: 'inherit' }}>Beräkna egenavgifter →</button>
              <button onClick={() => openDrawer(`Analysera mina justeringar. Bokfört överskott: ${fmt(bokf)} kr. Optimera periodiseringsfond och räntefördelning.`)} style={{ padding: '10px 16px', background: '#fff', color: '#3A3832', border: '1px solid #C8C3BA', fontSize: 13, fontWeight: 500, cursor: 'pointer', borderRadius: 2, fontFamily: 'inherit' }}>Fråga Normiq</button>
              <button onClick={() => nav(3)} style={{ background: 'none', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#9A9690', cursor: 'pointer', letterSpacing: '.06em' }}>← Tillbaka</button>
            </div>
          </div>
        )}

        {/* ── STEP 5: EGENAVGIFTER ── */}
        {step === 5 && (
          <div style={{ maxWidth: 780, padding: '32px 36px 60px' }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginBottom: 20, letterSpacing: '.06em', cursor: 'pointer' }} onClick={() => nav(4)}>← TILLBAKA</div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 700, marginBottom: 8 }}>Egenavgifter & skatteuträkning</h1>
            <div style={{ fontSize: 13, color: '#6A6660', marginBottom: 20 }}>25%-avdraget justeras mot faktiska avgifter nästa år via NE §G — kom ihåg kopplingen.</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1, background: '#DDD8CF', border: '1px solid #DDD8CF', marginBottom: 22 }}>
              {[{ l: 'Skattemässigt', v: fmt(skattemassigt) + ' kr' }, { l: 'Egenavgifter', v: fmt(ega.sum) + ' kr', c: '#C0392B' }, { l: 'Nedsättning', v: '−' + fmt(ega.ned) + ' kr', c: '#2D6A4F' }, { l: '25%-avdrag', v: '−' + fmt(ega.avd25) + ' kr', c: '#2D6A4F' }, { l: 'Total skatt', v: fmt(ega.tot) + ' kr', c: '#C0392B' }].map(s => (
                <div key={s.l} style={{ background: '#fff', padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9A9690', marginBottom: 5 }}>{s.l}</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: (s as {l:string;v:string;c?:string}).c || '#1A1A18' }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Aktiv/passiv */}
            <Accordion code="EGA §1" name="Aktiv / passiv verksamhet" sum="">
              <div style={{ margin: '8px 14px', padding: '10px 13px', fontSize: 12, background: '#EBF3FA', borderLeft: '2px solid #5A96C8', color: '#2A5070', borderRadius: 2 }}>Aktiv = du arbetar i verksamheten → egenavgifter 28,87%. Passiv → särskild löneskatt 24,26%.</div>
              <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid #DDD8CF' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B' }}>E0</span>
                <div style={{ fontSize: 13, color: '#3A3832' }}>Verksamhetstyp</div>
                <select value={passiv ? 'passiv' : 'aktiv'} onChange={e => setPassiv(e.target.value === 'passiv')} style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, padding: '6px 8px', background: '#F5F0E8', border: '1px solid #C8C3BA', color: '#1A1A18', borderRadius: 2, outline: 'none' }}>
                  <option value="aktiv">Aktiv — arbetar i verksamheten</option>
                  <option value="passiv">Passiv — arbetar ej</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'center', padding: '9px 14px' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B' }}>E1</span>
                <div><div style={{ fontSize: 13, color: '#3A3832' }}>Underlag egenavgifter</div><div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>Skattemässigt överskott · Auto</div></div>
                <input readOnly value={fmt(skattemassigt)} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, padding: '6px 10px', background: '#EFF7F2', border: '1px solid #B7D9C8', color: '#1A1A18', textAlign: 'right', borderRadius: 2, outline: 'none' }} />
              </div>
            </Accordion>

            {/* Spec */}
            <Accordion code="EGA §2" name="Specifikation egenavgifter 2024" sum={fmt(ega.sum) + ' kr'}>
              <table style={{ width: '100%', borderCollapse: 'collapse', margin: '4px 0' }}>
                <thead><tr>{['Avgift','Sats 2024','Belopp'].map(h => <th key={h} style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9A9690', padding: '7px 14px', borderBottom: '1px solid #DDD8CF', textAlign: h === 'Belopp' ? 'right' : 'left', fontWeight: 400, background: '#EDE8DF' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {[['Ålderspensionsavgift','10,21%', fmt(Math.round(skattemassigt*0.1021))+' kr'], ['Sjukförsäkringsavgift','3,64%', fmt(Math.round(skattemassigt*0.0364))+' kr'], ['Föräldraförsäkringsavgift','2,60%', fmt(Math.round(skattemassigt*0.026))+' kr'], ['Efterlevandepensionsavgift','0,60%', fmt(Math.round(skattemassigt*0.006))+' kr'], ['Arbetsskadeavgift','0,20%', fmt(Math.round(skattemassigt*0.002))+' kr'], ['Arbetsmarknadsavgift','0,00%','0 kr'], ['Allmän löneavgift','11,62%', fmt(Math.round(skattemassigt*0.1162))+' kr']].map(([name, rate, amt]) => (
                    <tr key={name} style={{ borderBottom: '1px solid #DDD8CF' }}>
                      <td style={{ padding: '8px 14px', fontSize: 13 }}>{name}</td>
                      <td style={{ padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690' }}>{rate}</td>
                      <td style={{ padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500, textAlign: 'right' }}>{passiv && name !== 'Allmän löneavgift' ? '0 kr' : amt}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#EDE8DF' }}>
                    <td colSpan={2} style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600 }}>Summa egenavgifter</td>
                    <td style={{ padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 600, textAlign: 'right' }}>{fmt(ega.sum)} kr</td>
                  </tr>
                </tbody>
              </table>
            </Accordion>

            {/* Nedsättning */}
            <Accordion code="EGA §3" name="Nedsättning av egenavgifter" sum={'−' + fmt(ega.ned) + ' kr'}>
              <div style={{ margin: '8px 14px', padding: '10px 13px', fontSize: 12, background: '#EFF7F2', borderLeft: '2px solid #2D6A4F', color: '#2D6A4F', borderRadius: 2 }}>Nedsättning 7,5% av underlaget, max 15 000 kr/år.</div>
              <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid #DDD8CF' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B' }}>E2</span>
                <div><div style={{ fontSize: 13, color: '#3A3832' }}>Nedsättning 7,5% (max 15 000 kr)</div><div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>Auto</div></div>
                <input readOnly value={fmt(ega.ned)} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, padding: '6px 10px', background: '#EFF7F2', border: '1px solid #B7D9C8', textAlign: 'right', borderRadius: 2, outline: 'none' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid #DDD8CF' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B' }}>E3</span>
                <div style={{ fontSize: 13, color: '#3A3832' }}>Ytterligare nedsättning (regionalt stöd)</div>
                <input type="text" value={fmt(extraNed)} onChange={e => setExtraNed(parseInt(e.target.value.replace(/\D/g,''))||0)} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, padding: '6px 10px', background: '#F5F0E8', border: '1px solid #C8C3BA', textAlign: 'right', borderRadius: 2, outline: 'none' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'center', padding: '9px 14px' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B' }}>E2b</span>
                <div style={{ fontSize: 13, color: '#3A3832' }}>Netto-egenavgifter efter nedsättning</div>
                <input readOnly value={fmt(ega.netto)} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, padding: '6px 10px', background: '#EDE8DF', border: '1px solid #DDD8CF', textAlign: 'right', borderRadius: 2, outline: 'none', color: '#9A9690' }} />
              </div>
            </Accordion>

            {/* 25%-avdraget */}
            <Accordion code="EGA §4" name="25%-avdraget — beräknade egenavgifter" sum={'−' + fmt(ega.avd25) + ' kr'}>
              <div style={{ margin: '8px 14px', padding: '10px 13px', fontSize: 12, background: '#EBF3FA', borderLeft: '2px solid #5A96C8', color: '#2A5070', borderRadius: 2 }}>25% × (överskott − netto-EGA). Justeras mot faktiska avgifter nästa år via NE §G (R28–R30).</div>
              {[{ id: 'E4', label: 'Underlag för 25%-avdraget', val: fmt(skattemassigt - ega.netto), hint: 'Skattemässigt − netto-EGA · Auto', sie: false, calc: true }, { id: 'E5', label: 'Avdrag beräknade egenavgifter (25% × E4)', val: fmt(ega.avd25), hint: '→ Justeras på nästa års NE §G', sie: true, calc: true }, { id: 'E6', label: 'Slutligt skattemässigt överskott av aktiv näring', val: fmt(ega.slutlig), hint: '', sie: false, calc: false, result: true }].map(f => (
                <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'start', padding: '9px 14px', borderBottom: '1px solid #DDD8CF' }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B', paddingTop: 2 }}>{f.id}</span>
                  <div><div style={{ fontSize: 13, color: '#3A3832' }}>{f.label}</div>{f.hint && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>{f.hint}</div>}</div>
                  <input readOnly value={f.val} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: f.result ? 700 : 500, padding: '6px 10px', background: f.result ? '#FDF5E6' : f.sie ? '#EFF7F2' : '#EDE8DF', border: `1px solid ${f.result ? '#E8D4A0' : f.sie ? '#B7D9C8' : '#DDD8CF'}`, color: f.result ? '#1A1A18' : '#9A9690', textAlign: 'right', borderRadius: 2, outline: 'none' }} />
                </div>
              ))}
            </Accordion>

            {/* Skatteuträkning */}
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#9A9690', margin: '22px 0 10px', display: 'flex', alignItems: 'center', gap: 9 }}>
              <span>Skatteuträkning 2024</span>
              <div style={{ flex: 1, height: 1, background: '#DDD8CF' }} />
            </div>
            <div style={{ background: '#fff', border: '1px solid #DDD8CF', borderRadius: 4, overflow: 'hidden', marginBottom: 18 }}>
              {[{ l: 'Slutligt överskott (E6)', sub: 'Underlag kommunalskatt', v: fmt(ega.slutlig) + ' kr', c: '#2D6A4F' }, { l: 'Kommunal inkomstskatt (32,0%)', sub: 'Schablonsats', v: '−' + fmt(ega.kom) + ' kr', c: '#C0392B' }, { l: 'Begravningsavgift (0,279%)', sub: '', v: '−' + fmt(ega.beg) + ' kr', c: '#C0392B' }].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid #DDD8CF' }}>
                  <div><div style={{ fontSize: 13, color: '#3A3832' }}>{row.l}</div>{row.sub && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 1 }}>{row.sub}</div>}</div>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500, color: row.c }}>{row.v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid #DDD8CF', background: '#F5F0E8' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9A9690' }}>Socialavgifter</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid #DDD8CF' }}>
                <div><div style={{ fontSize: 13, color: '#3A3832' }}>Netto-egenavgifter</div><div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 1 }}>Via slutskattsedeln</div></div>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500, color: '#C0392B' }}>−{fmt(ega.netto)} kr</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#EDE8DF', borderTop: '2px solid #C8C3BA' }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700 }}>Total skatt & avgifter 2024</span>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: '#C0392B' }}>{fmt(ega.tot)} kr</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
              {[{ l: 'Effektiv skattesats', v: ((ega.tot / Math.max(bokf, 1)) * 100).toFixed(1) + '%', s: 'På bokfört överskott' }, { l: 'Kvar efter skatt', v: fmt(bokf - ega.tot) + ' kr', s: 'Netto av bokfört överskott', c: '#2D6A4F' }, { l: 'Spara vid max periodiseringsfond', v: '−~' + fmt(Math.round(Math.floor(bokf * 0.30) * 0.32 + Math.floor(bokf * 0.30) * 0.2887 * 0.25)) + ' kr', s: 'Om 30% av överskott avsätts', red: true }].map(card => (
                <div key={card.l} style={{ background: card.red ? '#FDF0EE' : '#fff', border: `1px solid ${card.red ? '#E8C4BF' : '#DDD8CF'}`, borderRadius: 4, padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9A9690', marginBottom: 7 }}>{card.l}</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: card.red ? '#C0392B' : (card.c || '#1A1A18') }}>{card.v}</div>
                  <div style={{ fontSize: 11, color: '#9A9690', marginTop: 4 }}>{card.s}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => nav(6)} style={{ padding: '10px 20px', background: '#1A1A18', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', borderRadius: 2, fontFamily: 'inherit' }}>Granska & exportera →</button>
              <button onClick={() => openDrawer(`Ge råd om hur jag kan sänka skatten. Överskott: ${fmt(skattemassigt)} kr. Total skatt: ${fmt(ega.tot)} kr.`)} style={{ padding: '10px 16px', background: '#fff', color: '#3A3832', border: '1px solid #C8C3BA', fontSize: 13, fontWeight: 500, cursor: 'pointer', borderRadius: 2, fontFamily: 'inherit' }}>Fråga Normiq</button>
              <button onClick={() => nav(4)} style={{ background: 'none', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#9A9690', cursor: 'pointer', letterSpacing: '.06em' }}>← Tillbaka</button>
            </div>
          </div>
        )}

        {/* ── STEP 6: GRANSKA ── */}
        {step === 6 && (
          <div style={{ maxWidth: 780, padding: '32px 36px 60px' }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginBottom: 20, letterSpacing: '.06em', cursor: 'pointer' }} onClick={() => nav(5)}>← TILLBAKA</div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 700, marginBottom: 16 }}>Granska & exportera</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: '#DDD8CF', border: '1px solid #DDD8CF', marginBottom: 22 }}>
              {[{ l: 'Överskott av näring', v: fmt(ega.slutlig) + ' kr' }, { l: 'Egenavgifter', v: fmt(ega.netto) + ' kr', c: '#C0392B' }, { l: 'Kommunalskatt', v: fmt(ega.kom) + ' kr', c: '#C0392B' }, { l: 'Total skatt & avg.', v: fmt(ega.tot) + ' kr', c: '#C0392B' }].map(s => (
                <div key={s.l} style={{ background: '#fff', padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9A9690', marginBottom: 5 }}>{s.l}</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: (s as {l:string;v:string;c?:string}).c || '#1A1A18' }}>{s.v}</div>
                </div>
              ))}
            </div>

            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#9A9690', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 9 }}>
              <span>SRU-förhandsvisning</span><div style={{ flex: 1, height: 1, background: '#DDD8CF' }} />
            </div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, background: '#fff', border: '1px solid #DDD8CF', borderRadius: 4, padding: '16px 18px', marginBottom: 18, whiteSpace: 'pre', overflowX: 'auto', lineHeight: 1.9, color: '#6A6660' }}>
              {generateSRU()}
            </div>

            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#9A9690', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 9 }}>
              <span>Checklista</span><div style={{ flex: 1, height: 1, background: '#DDD8CF' }} />
            </div>
            <div style={{ border: '1px solid #DDD8CF', borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
              {[
                { ok: true, text: 'Alla intäktskonton (3xxx) mappade till NE-rader' },
                { ok: true, text: 'Bokfört resultat stämmer med SIE-data' },
                { ok: true, text: 'Egenavgifter beräknade med nedsättning och 25%-avdrag' },
                { ok: (mapping?.fields?.R14?.value || 0) > 0, warn: (mapping?.fields?.R14?.value || 0) === 0, text: (mapping?.fields?.R14?.value || 0) === 0 ? 'R14 Resekostnader 0 kr — bekräfta att inga tjänsteresor gjorts' : 'Resekostnader kontrollerade' },
                { ok: (j.r10 || 0) > 0, warn: !(j.r10), text: (j.r10 || 0) === 0 ? `Ingen periodiseringsfond — max ${fmt(Math.floor(bokf * 0.30))} kr möjligt` : `Periodiseringsfond: ${fmt(j.r10)} kr` },
                { ok: false, warn: true, text: 'NE §G (medgivna/påförda egenavgifter föregående år) — fyll i om du hade avdrag förra året' },
              ].map((item, i, arr) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 14px', background: '#fff', borderBottom: i < arr.length - 1 ? '1px solid #DDD8CF' : 'none', borderLeft: `3px solid ${item.ok && !item.warn ? '#2D6A4F' : item.warn ? '#92620A' : '#C0392B'}`, fontSize: 12, color: '#3A3832' }}>
                  <span>{item.ok && !item.warn ? '✓' : item.warn ? '⚠' : '✕'}</span>
                  {item.text}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={downloadSRU} style={{ padding: '10px 20px', background: '#1A1A18', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', borderRadius: 2, fontFamily: 'inherit' }}>↓ Ladda ner SRU-fil</button>
              <button onClick={() => openDrawer('Finns det något sista jag bör kontrollera innan jag lämnar in deklarationen?')} style={{ padding: '10px 16px', background: '#fff', color: '#3A3832', border: '1px solid #C8C3BA', fontSize: 13, fontWeight: 500, cursor: 'pointer', borderRadius: 2, fontFamily: 'inherit' }}>Sista granskning med Normiq</button>
            </div>
            <div style={{ marginTop: 24, padding: '10px 14px', background: '#FDF5E6', border: '1px solid #E8D4A0', borderRadius: 2, fontSize: 12, color: '#92620A', lineHeight: 1.65 }}>
              ⚠ Normiq Deklarera är ett AI-assisterat hjälpmedel. Alla beräkningar bör granskas av behörig redovisningskonsult innan inlämning till Skatteverket.
            </div>
          </div>
        )}
      </main>

      {/* ── AI DRAWER ── */}
      {drawerOpen && (
        <>
          <div onClick={() => setDrawerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.15)', zIndex: 790 }} />
          <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 380, background: '#fff', borderLeft: '1px solid #DDD8CF', zIndex: 800, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,.08)' }}>
            <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid #DDD8CF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700 }}>Fråga Normiq</div>
              <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', fontSize: 16, color: '#9A9690', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {drawerMessages.map((m, i) => (
                <div key={i} style={{ padding: '11px 13px', fontSize: 13, lineHeight: 1.7, borderRadius: 2, background: m.role === 'assistant' ? '#F5F0E8' : '#fff', borderLeft: m.role === 'assistant' ? '2px solid #C0392B' : 'none', border: m.role === 'user' ? '1px solid #DDD8CF' : undefined, color: '#3A3832' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: m.role === 'assistant' ? '#C0392B' : '#9A9690', marginBottom: 6 }}>{m.role === 'assistant' ? 'Normiq' : 'Du'}</div>
                  {m.content}
                </div>
              ))}
              {drawerLoading && (
                <div style={{ padding: '11px 13px', background: '#F5F0E8', borderLeft: '2px solid #C0392B', borderRadius: 2, fontSize: 13, color: '#9A9690' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#C0392B', marginBottom: 6 }}>NORMIQ</div>
                  Bearbetar...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div style={{ padding: '10px 14px', borderTop: '1px solid #DDD8CF', display: 'flex', gap: 7 }}>
              <textarea
                value={drawerInput}
                onChange={e => setDrawerInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(drawerInput) } }}
                placeholder="Skriv din skattefråga..."
                style={{ flex: 1, background: '#F5F0E8', border: '1px solid #C8C3BA', color: '#1A1A18', fontFamily: 'inherit', fontSize: 13, padding: '8px 10px', resize: 'none', height: 38, outline: 'none', borderRadius: 2 }}
              />
              <button onClick={() => sendMessage(drawerInput)} style={{ background: '#1A1A18', border: 'none', color: '#fff', cursor: 'pointer', padding: '0 13px', fontSize: 14, borderRadius: 2 }}>↑</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
