'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

// ─── Types ───────────────────────────────────
interface SIEData {
  companyName: string
  orgNumber: string
  fiscalYearStart: string
  fiscalYearEnd: string
  accounts: Record<string, { number: string; name: string }>
  accountTotals: Record<string, number>
  openingBalances: Record<string, number>
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
  autoR31: number
  autoR32: number
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
    accounts: {}, accountTotals: {}, openingBalances: {},
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
      case '#IB':
        if (parseInt(tok[0] || '0') === 0 && tok[1])
          s.openingBalances[tok[1]] = (s.openingBalances[tok[1]] || 0) + pf(tok[2] || '0')
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
  // Auto-detect ej avdragsgilla kostnader
  const ejAvdragsgillRepresentation = Math.round(Math.abs(sie.accountTotals['6072'] || 0))
  const ejAvdragsgillaBoter = Math.round(Math.abs((sie.accountTotals['6993'] || 0) + (sie.accountTotals['6991'] || 0)))
  const ejAvdragsgillaBankavg = Math.round(Math.abs(sie.accountTotals['6570'] || 0))
  const autoR31 = ejAvdragsgillRepresentation   // representation ej avdragsgill → R31
  const autoR32 = ejAvdragsgillaBoter           // böter/skattetillägg → R32

  const flags: NEFlag[] = []
  if (ejAvdragsgillaBankavg > 100)
    flags.push({ sev: 'warn', msg: '6570 Bankavgifter', detail: 'Kontrollera om privata kortavgifter ingår.' })
  if (ejAvdragsgillaBoter > 0)
    flags.push({ sev: 'err', msg: `6993/6991 Böter/skattetillägg ${ejAvdragsgillaBoter.toLocaleString('sv-SE')} kr — EJ avdragsgilla`, detail: 'IL 9:10. Auto-justerat i §H R32.' })
  if (ejAvdragsgillRepresentation > 0)
    flags.push({ sev: 'warn', msg: `6072 Representation ej avdragsgill ${ejAvdragsgillRepresentation.toLocaleString('sv-SE')} kr`, detail: 'Auto-justerat i §H R31. Kontrollera beloppet.' })
  if ((fields.R14?.value || 0) === 0)
    flags.push({ sev: 'info', msg: 'Inga resekostnader registrerade', detail: 'Har du haft tjänsteresor? Traktamente kan tillkomma.' })
  const avskr = Math.round(Math.abs((sie.accountTotals['7810'] || 0) + (sie.accountTotals['7820'] || 0) + (sie.accountTotals['7830'] || 0)))
  // Kapitalunderlag för räntefördelning = ingående justerat EK (IB)
  // = summa 2000-2099 IB-poster, vänd tecknet (kredit = negativt → positivt EK)
  // Formel: -(2010_IB + 2018_IB + 2099_IB) + 2013_IB = netto EK IB
  const ibEntries = sie.openingBalances
  const ibEK2xxx = Object.entries(ibEntries)
    .filter(([a]) => a >= '2000' && a <= '2099')
    .reduce((s, [, v]) => s + v, 0)
  // Negativ summa = positivt EK (kreditkonton). Positiva inslag (uttag 2013) minskar EK.
  const kapitalunderlag = Math.round(-ibEK2xxx)
  const ekRaw = Object.entries(sie.accountTotals).filter(([a]) => a >= '2000' && a <= '2099').reduce((s, [, v]) => s + v, 0)
  return { fields, int: Math.round(int), kst: Math.round(kst), bokf: Math.round(bokf), flags, avskr, kapital: kapitalunderlag, autoR31, autoR32 }
}

function buildBS(sie: SIEData): BSData {
  // SIE teckenperspektiv (dubbelbokhallning):
  // Tillgangar 1xxx: positiv UB = debet = tillgang
  // EK/skulder 2xxx: negativ UB = kredit -> vand tecknet for ARL-presentation
  const al: BSData['al'] = [], ll: BSData['ll'] = []
  for (const [a, v] of Object.entries(sie.accountTotals)) {
    if (Math.abs(v) < 0.01) continue
    if (a >= '1000' && a <= '1999') {
      al.push({ acc: a, name: sie.accounts[a]?.name || a, amt: v })  // keep full precision
    }
    if (a >= '2000' && a <= '2999') {
      ll.push({ acc: a, name: sie.accounts[a]?.name || a, amt: -v })  // keep full precision
    }
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
  // §D Räntefördelning — only if user opted in
  const dD = g('useRF') ? g('r20') - g('r19') : 0
  const dE = -Math.min(g('r21'), Math.max(0, base))
  // R45 Allmänt avdrag — kvittning mot tjänst (konstnärlig/nystartad, max 70% × underskott, max 100 000 kr)
  // R46 Underskott i kapital — kvittning mot kapitalvinst
  // Dessa reducerar underskottet som förs till INK1 ruta 10.2 (rullas EJ vidare)
  const r45max = g('r45_konstnärlig') === 1   // checkbox: konstnärlig eller nystartad (max 5 år)
    ? Math.min(Math.round(Math.abs(base + dE) * 0.70), 100000) : 0
  const r45 = Math.min(g('r45_belopp') || 0, r45max)
  const r46 = g('r46_belopp') || 0
  const dF = g('r25') + g('r27') - g('r24') - g('r26')
  // SLP = särskild löneskatt på pensionssparavdrag 24,26% × R24 — KOSTNAD (minskar överskottet)
  const dSLP = g('r24') > 0 ? -Math.round(g('r24') * 0.2426) : 0
  // §G: medgivna (r28) - påförda (r29). Positiv = drog av för mycket = återföring (ökar överskott). Negativ = extra avdrag.
  const dG = g('r28') - g('r29')
  const dH = g('r31') + g('r32') + g('r33') + g('r34') - g('r35') - g('r14h')
  // Resor & traktamente → R22
  const trakt = g('resor_trakt_manuell') > 0 ? g('resor_trakt_manuell') : g('resor_trakt') * 290
  // Utlandstraktamente — summa från alla rader i utlandResor (injicerat som utland_totalt)
  const utlandAvdrag = g('utland_totalt')
  const resorAvdrag = g('resor_mil') * 25 + trakt + utlandAvdrag
  // Hemmakontor → R16 (kostnader som inte bokförts men ska dras av)
  const hkAvdrag = g('hemmakontor') + g('hemmakontor_internet')
  const dI = -resorAvdrag   // maps to NE R22
  const dJ = -hkAvdrag      // maps to NE R16
  return { dA, dB, dC, dD, dE, dF, dG, dH, dI, dJ, dSLP, r45, r46, tot: Math.max(0, base + dA + dB + dC + dD + dE + dF + dG + dH + dI + dJ + dSLP) }
}

function calcEga(base: number, passiv: boolean, extraNed: number = 0, kommunalskattPct: number = 32.0) {
  // Vid underskott: ingen EGA, inget 25%-avdrag
  // slutlig = base (negativt) = underskott av aktiv näring → INK1 ruta 10.2
  if (base <= 0) {
    return { sum: 0, ned: 0, netto: 0, avd25: 0, slutlig: base,
      kom: 0, beg: 0, statlig: 0, ef: 0, rf: 0, tot: 0, isUnderskott: true }
  }
  if (passiv) {
    const sls = Math.round(base * 0.2426)
    const avd25 = Math.round(base * 0.25)
    const slutlig = base - avd25
    const kom = Math.round(slutlig * (kommunalskattPct / 100))
    const beg = Math.round(slutlig * 0.00279)
    const statlig = slutlig > 598500 ? Math.round((slutlig - 598500) * 0.20) : 0
    return { sum: sls, ned: 0, netto: sls, avd25, slutlig, kom, beg, statlig, ef: 0, rf: 0, tot: kom + beg + sls + statlig, isUnderskott: false }
  }
  const r = { ap: 0.1021, sj: 0.0364, fp: 0.026, ep: 0.006, as: 0.002, am: 0, al: 0.1162 }
  const parts = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(base * v)]))
  const sum = Object.values(parts).reduce((a, b) => a + b, 0)
  const ned = Math.min(Math.round(base * 0.075), 15000)
  const netto = Math.max(0, sum - ned - extraNed)
  const avd25 = Math.round(base * 0.25)
  const slutlig = base - avd25
  const kom = Math.round(slutlig * (kommunalskattPct / 100))
  const beg = Math.round(slutlig * 0.00279)
  const statlig = slutlig > 598500 ? Math.round((slutlig - 598500) * 0.20) : 0
  return { ...parts, sum, ned, netto, avd25, slutlig, kom, beg, statlig, ef: 0, rf: 0, tot: kom + beg + netto + statlig, isUnderskott: false }
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

// ─── Utlandstraktamente — laddas från API (SKV 2025) ───────────
// Fallback finns i /api/traktamente/route.ts
const UTLAND_NORMALBELOPP_FALLBACK: { land: string; belopp: number }[] = [
  { land: 'Norge', belopp: 1095 }, { land: 'Danmark', belopp: 1268 },
  { land: 'Finland', belopp: 952 }, { land: 'Sverige', belopp: 290 },
  { land: 'Tyskland', belopp: 780 }, { land: 'Frankrike', belopp: 810 },
  { land: 'Spanien', belopp: 676 }, { land: 'Italien', belopp: 720 },
  { land: 'USA', belopp: 1049 }, { land: 'Schweiz', belopp: 1269 },
  { land: 'Österrike', belopp: 696 }, { land: 'Belgien', belopp: 856 },
  { land: 'Nederländerna', belopp: 711 }, { land: 'Polen', belopp: 569 },
  { land: 'Övriga länder', belopp: 469 },
]

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

  // Avstämning — obligatoriska ja/nej-svar innan man kan gå vidare
  const [avstamning, setAvstamning] = useState<Record<string, 'ja' | 'nej' | null>>({
    hemmakontor: null,
    traktamente: null,
    pension: null,
    slp: null,
    sjuklon: null,
    ega_fg: null,
    underskott: null,
    pfonder: null,
    ej_skattepliktig: null,  // bokförda intäkter som inte ska tas upp (R14)
  })
  const setAv = (k: string, v: 'ja' | 'nej') => setAvstamning(prev => ({ ...prev, [k]: v }))
  const avstamningKlar = Object.values(avstamning).every(v => v !== null)

  // Deklarationsuppgifter
  const [verksamhetensArt, setVerksamhetensArt] = useState<string>('')
  const [uppdragstagare, setUppdragstagare] = useState<boolean>(false)
  const [saknarTillgangar, setSaknarTillgangar] = useState<boolean>(false)

  // Utlandstraktamente — normalbelopp hämtas från SKV API
  const [utlandNormalbelopp, setUtlandNormalbelopp] = useState<{ land: string; belopp: number }[]>(UTLAND_NORMALBELOPP_FALLBACK)
  useEffect(() => {
    const inkomstar = sieData?.fiscalYearStart?.substring(0, 4) || '2025'
    fetch(`/api/traktamente?year=${inkomstar}`)
      .then(r => r.json())
      .then(d => { if (d.list?.length > 0) setUtlandNormalbelopp(d.list) })
      .catch(() => {}) // keep fallback on error
  }, [sieData?.fiscalYearStart])

  // Utlandstraktamente — flera länder/resor
  const [utlandResor, setUtlandResor] = useState<{ land: number; dagar: number; halvdagar: number }[]>([])
  const addUtland = () => setUtlandResor(prev => [...prev, { land: 0, dagar: 0, halvdagar: 0 }])
  const removeUtland = (i: number) => setUtlandResor(prev => prev.filter((_, idx) => idx !== i))
  const updateUtland = (i: number, key: string, val: number) =>
    setUtlandResor(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r))
  const utlandTotalt = utlandResor.reduce((sum, r) => {
    if (!r.land) return sum
    const nb = utlandNormalbelopp[r.land - 1]?.belopp || 0
    return sum + Math.round(nb * r.dagar + nb * 0.5 * r.halvdagar)
  }, 0)

  // Skattesatser
  const [kommunalskatt, setKommunalskatt] = useState<number>(32.0)  // schabloon, justerbar

  // Step 3 fields
  const [j, setJ] = useState<Record<string, number>>({})
  const setJv = (k: string, v: number) => setJ(prev => ({ ...prev, [k]: v }))

  // Supabase — useMemo så klienten inte återskapas vid varje render
  const supabase = React.useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), [])

  // Auth state
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  // Deklaration history
  const [deklarationId, setDeklarationId] = useState<string | null>(null)
  const [historik, setHistorik] = useState<{id:string;inkomstar:number;company_name:string;org_number:string;status:string;updated_at:string}[]>([])
  const [saving, setSaving] = useState(false)

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
  // Inject utlandTotalt into j for calcStep3
  const jWithUtland = { ...j, utland_totalt: utlandTotalt }
  const s3 = calcStep3(bokf, jWithUtland)
  const skattemassigt = j.useManual ? (j.manualOverskott || 0) : s3.tot
  const ega = calcEga(skattemassigt, passiv, extraNed, kommunalskatt)  // utlandTotalt added via j

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
          r31: m.autoR31 || 0,
          r32: m.autoR32 || 0,
        }))
        // Auto-set saknarTillgangar om inga 1xxx-konton i SIE
        const hasAssets = Object.keys(b.al).length > 0 || b.al.length > 0
        setSaknarTillgangar(!hasAssets)
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
    runParse(sie, 'demo_2025.se')
  }

  async function downloadPDF() {
    const f = mapping?.fields || {}
    const fv = (id: string) => ({ id, label: f[id]?.label || id, value: Math.round(f[id]?.value || 0) })
    const { blanketter } = generateSRU()
    const payload = {
      companyName: sieData?.companyName,
      orgNumber: sieData?.orgNumber,
      fiscalYearStart: sieData?.fiscalYearStart,
      fiscalYearEnd: sieData?.fiscalYearEnd,
      filename,
      bokfortOverskott: bokf,
      skattemassigt,
      intakter: ['R1','R2','R3'].map(fv).filter(r => r.value > 0),
      kostnader: ['R10','R11','R12','R13','R14','R15','R16','R17'].map(fv).filter(r => r.value > 0),
      justeringar: [
        { code: '§A', label: 'Avskrivningsdiff', value: s3.dA },
        { code: '§B', label: 'Periodiseringsfond', value: s3.dB },
        { code: '§C', label: 'Expansionsfond', value: s3.dC },
        { code: '§D', label: 'Räntefördelning', value: j.useRF ? s3.dD : 0 },
        { code: '§E', label: 'Underskott', value: s3.dE },
        { code: '§F', label: 'Pension & sjuklön', value: s3.dF },
        { code: '§G', label: 'EGA föregående år', value: s3.dG },
        { code: '§H', label: 'Övriga justeringar', value: s3.dH },
        { code: 'R22', label: 'Resor & traktamente', value: s3.dI || 0 },
        { code: 'R16', label: 'Hemmakontor', value: s3.dJ || 0 },
      ].filter(r => r.value !== 0),
      ega: { sum: ega.sum, ned: ega.ned, netto: ega.netto, avd25: ega.avd25, slutlig: ega.slutlig, kom: ega.kom, beg: ega.beg, tot: ega.tot },
      flags: mapping?.flags || [],
      sruContent: blanketter,
      bsData: bs,
      j: jWithUtland,
      utlandResor,
      verksamhetensArt,
      uppdragstagare,
      saknarTillgangar,
    }
    try {
      const res = await fetch('/api/deklarera/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const win = window.open(URL.createObjectURL(blob), '_blank')
      if (win) win.addEventListener('load', () => setTimeout(() => win.print(), 600))
    } catch { alert('PDF-export misslyckades.') }
  }

  // ── SRU-validering ─────────────────────────────────────────
  function validateSRU(): { ok: boolean; errors: string[]; warnings: string[] } {
    const { blanketter } = generateSRU()
    const errors: string[] = []
    const warnings: string[] = []

    // Parse the SRU content into a map of field→value
    const fields: Record<string, string> = {}
    for (const line of blanketter.split('\n')) {
      const m = line.match(/^#UPPGIFT\s+(\d+)\s+(.+)$/)
      if (m) fields[m[1]] = m[2].trim()
    }

    // ── OBLIGATORISKA FÄLT ───────────────────────────────────
    if (!fields['7011']) errors.push('Räkenskapsår start (7011) saknas')
    if (!fields['7012']) errors.push('Räkenskapsår slut (7012) saknas')
    if (!fields['7023']) errors.push('Aktiv/passiv näring (7023) saknas')
    if (!fields['7440']) errors.push('Bokfört resultat (7440) saknas — kritiskt fel')
    if (!verksamhetensArt.trim()) errors.push('Verksamhetens art saknas — SKV kräver detta')

    // ── DATUM-FORMAT ─────────────────────────────────────────
    if (fields['7011'] && !/^\d{8}$/.test(fields['7011']))
      errors.push(`Räkenskapsår start har fel format: "${fields['7011']}" (ska vara YYYYMMDD)`)
    if (fields['7012'] && !/^\d{8}$/.test(fields['7012']))
      errors.push(`Räkenskapsår slut har fel format: "${fields['7012']}" (ska vara YYYYMMDD)`)

    // ── PERSONNUMMER ─────────────────────────────────────────
    const identLine = blanketter.split('\n').find(l => l.startsWith('#IDENTITET'))
    if (identLine) {
      const pnr = identLine.split(' ')[1] || ''
      if (pnr.length !== 12) errors.push(`Personnummer har ${pnr.length} siffror — ska vara 12 (t.ex. 197503247814)`)
      if (pnr.includes('-')) errors.push('Personnummer ska inte innehålla bindestreck i SRU-filen')
    } else {
      errors.push('#IDENTITET-rad saknas')
    }

    // ── VERKSAMHETENS ART ─────────────────────────────────────
    if (verksamhetensArt.length > 40)
      warnings.push(`Verksamhetens art är ${verksamhetensArt.length} tecken — rekommenderat max 40`)

    // ── ÖVERSKOTT/UNDERSKOTT-LOGIK ────────────────────────────
    const r47 = ega.slutlig
    if (r47 > 0) {
      if (!fields['7630']) errors.push('Slutligt överskott (7630) saknas trots positivt resultat')
      if (!fields['8046']) warnings.push('Egenavgifts-markering (8046 X) saknas — SKV beräknar inte EGA')
      // Räntefördelning — R19 måste vara ifyllt om useRF
      if (fields['7708'] && parseInt(fields['7708']) === 0) errors.push('Positiv räntefördelning (R19/7708) är 0 — ange beloppet eller avaktivera räntefördelning')
      // 8009 = kapitalunderlag RF — skickas om kapitalunderlag finns
      if (!fields['7714']) warnings.push('25%-avdrag R43 (7714) saknas')
      if (fields['7730']) errors.push('Underskott (7730) ska inte finnas vid positivt resultat')
    } else if (r47 < 0) {
      if (!fields['7730']) errors.push('Underskott (7730) saknas trots negativt resultat')
      if (fields['7630']) errors.push('Överskott (7630) ska inte finnas vid negativt resultat')
      if (fields['8046']) warnings.push('EGA-markering (8046) bör inte skickas vid underskott')
    }

    // ── BELOPP-KONTROLL ───────────────────────────────────────
    const numericFields = ['7400','7440','7501','7280','7240','7250','7260','7630','7730','8009','8011','7714']
    for (const f of numericFields) {
      if (fields[f] && !/^-?\d+$/.test(fields[f]))
        errors.push(`Fält ${f} har ogiltigt värde "${fields[f]}" — ska vara heltal`)
    }

    // ── OGILTIGA FÄLTKODER (kända problem) ───────────────────
    const invalidForNE = ['7310','7321','7340','7351','7365','7368','7372','7215','7420','7410']
    for (const f of invalidForNE) {
      if (fields[f]) errors.push(`Fält ${f} är inte ett giltigt postnamn i NE-2025P4`)
    }

    // ── SUMMAKONTROLL ─────────────────────────────────────────
    const r1 = parseInt(fields['7400'] || '0')
    const kost = parseInt(fields['7501'] || '0')
    const bokf = parseInt(fields['7440'] || '0')
    if (r1 > 0 && kost > 0) {
      const expected = r1 - kost
      if (Math.abs(expected - bokf) > 2)
        warnings.push(`Bokfört resultat (${bokf}) stämmer inte med R1−kostnader (${r1}−${kost}=${expected}) — diff ${Math.abs(expected-bokf)} kr`)
    }

    return { ok: errors.length === 0, errors, warnings }
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
    
    // Personnr: ta bort bindestreck och lägg till sekelsiffra
    // SIE-format: "750324-7814" (10 tecken med bindestreck = 9 tecken utan = behöver 19/20)
    // SKV-format: "197503247814" (12 siffror)
    const rawOrg = sieData?.orgNumber || ''
    const orgClean = rawOrg.replace(/-/g, '').replace(/\+/g, '')  // ta bort - och +
    // Om 10 siffror → redan med sekelsiffra (organisationsnummer)
    // Om 9 siffror → personnr utan sekelsiffra → lägg till 19 eller 20
    // length 10 = personnr utan sekelsiffra (YYMMDDXXXX) → lägg till 19/20
    // length 12 = redan komplett (YYYYMMDDXXXX eller org.nr med sekelsiffra)
    const orgFull = orgClean.length === 10
      ? (parseInt(orgClean.substring(0,2)) <= 25 ? '20' : '19') + orgClean
      : orgClean
    
    // Framställningsdatum och tid (idag)
    const now = new Date()
    const dateFmt = now.getFullYear().toString() +
      String(now.getMonth()+1).padStart(2,'0') +
      String(now.getDate()).padStart(2,'0')
    const timeFmt = String(now.getHours()).padStart(2,'0') +
      String(now.getMinutes()).padStart(2,'0') +
      String(now.getSeconds()).padStart(2,'0')
    
    // Beräknade värden
    const sumKost = fv('R10')+fv('R11')+fv('R12')+fv('R13')+fv('R14')+fv('R15')+fv('R16')+fv('R17')
    const bokfOvsk = fv('R1')+fv('R2')+fv('R3') - sumKost
    
    // Justeringar
    const r16hk = Math.round((j.hemmakontor||0) + (j.hemmakontor_internet||0))  // R16 hemmakontor
    const trakt = (j.resor_trakt_manuell||0) > 0 ? (j.resor_trakt_manuell||0) : (j.resor_trakt||0)*290
    const r22res = Math.round((j.resor_mil||0)*25 + trakt)  // R22 resor
    const r40 = Math.round(j.r28||0)  // Medgivna EGA föregående år
    const r41 = Math.round(j.r29||0)  // Påförda EGA föregående år
    
    // R47 slutligt överskott
    const r47 = ega.slutlig
    
    const u = (kod: number, v: number | string) => `#UPPGIFT ${kod} ${v}`
    
    // BLANKETTER.SRU
    const blanketter = [
      '#BLANKETT NE-2025P4',
      `#IDENTITET ${orgFull} ${dateFmt} ${timeFmt}`,
      sieData?.companyName ? `#NAMN ${sieData.companyName}` : '',
      '',
      // Räkenskapsår
      u(7011, sieData?.fiscalYearStart || '20250101'),
      u(7012, sieData?.fiscalYearEnd   || '20251231'),
      u(7023, 'X'),  // Aktiv näring
      verksamhetensArt ? u(7020, verksamhetensArt) : '',  // Verksamhetens art
      // 7050 uppdragstagare — ej giltigt SRU-fält i NE-2026P4, hanteras ej i SRU

      // Intäkter (bevarar tecken — negativ intäkt är OK)
      u(7400, fv('R1')),
      fv('R2') > 0 ? u(7401, fv('R2')) : '',  // R2 Momsfria intäkter
      fv('R3') > 0 ? u(7403, fv('R3')) : '',  // R4 Ränteintäkter

      // Kostnader
      // R5 Varor (7500) + R6 Övriga externa (7501) splittat
      fv('R10') > 0 ? u(7500, fv('R10')) : '',  // Varor 40xx-49xx
      fv('R15') > 0 ? u(7501, fv('R15')) : '',  // Övriga externa 50xx-69xx
      fv('R7') > 0 ? u(7502, Math.abs(fv('R7'))) : '',   // R7 Personal (70xx-76xx)
      fv('R8') > 0 ? u(7503, Math.abs(fv('R8'))) : '',   // R8 Räntekostnader (774x,79xx)
      fv('R17') > 0 ? u(7505, Math.abs(fv('R17'))) : '',  // R10 Avskrivningar inventarier

      // Balansräkning tillgångar
      saknarTillgangar ? u(7100, 'X') : '',
      ...(() => {
        if (!bs || saknarTillgangar) return []
        const bsSum = (from: string, to: string) =>
          Math.round(Math.abs(bs.al.filter((l: {acc:string;amt:number}) => l.acc >= from && l.acc <= to).reduce((s: number, l: {amt:number}) => s + l.amt, 0)))
        const llSum = (from: string, to: string) =>
          Math.round(bs.ll.filter((l: {acc:string;amt:number}) => l.acc >= from && l.acc <= to).reduce((s: number, l: {amt:number}) => s + l.amt, 0))
        const rows: string[] = []
        // Balansräkning — BAS 2023 kopplingstabell (NE_EJ_K1-Intervall-231002.xlsx)
        const immat = bsSum('1000','1099'); if (immat > 0) rows.push(u(7200, immat))              // B1
        const bygg = bsSum('1100','1129') + bsSum('1150','1179') + bsSum('1190','1199')
        if (bygg > 0) rows.push(u(7210, bygg))                                                    // B2
        const mark = bsSum('1130','1149') + bsSum('1180','1189'); if (mark > 0) rows.push(u(7211, mark)) // B3
        const invBrut = bsSum('1200','1290') + bsSum('1292','1299'); const invAck = bsSum('1291','1291')
        if (invBrut > 0) rows.push(u(7212, Math.max(0, invBrut - invAck)))                       // B4
        const ovrAnl = bsSum('1300','1399'); if (ovrAnl > 0) rows.push(u(7213, ovrAnl))           // B5
        const lager = bsSum('1400','1499'); if (lager > 0) rows.push(u(7240, lager))              // B6
        const kundfordr = bsSum('1500','1599'); if (kundfordr > 0) rows.push(u(7250, kundfordr))  // B7
        const ovrigaFordr = bsSum('1600','1899'); if (ovrigaFordr > 0) rows.push(u(7260, ovrigaFordr)) // B8
        const kassa = bsSum('1900','1999'); if (kassa > 0) rows.push(u(7280, kassa))              // B9
        const ek = llSum('2010','2019') + llSum('2050','2059'); if (ek !== 0) rows.push(u(7300, ek)) // B10 EK
        const obeskatt = llSum('2100','2199'); if (obeskatt > 0) rows.push(u(7320, obeskatt))     // B11
        const avsattr = llSum('2200','2299'); if (avsattr > 0) rows.push(u(7330, avsattr))        // B12
        const lanesk = llSum('2300','2399') + llSum('2410','2419') + llSum('2480','2489')
        if (lanesk > 0) rows.push(u(7380, lanesk))                                               // B13
        // B14 skatteskulder = 7381 (inget kontonummer redovisas normalt)
        const levsk = llSum('2440','2449') + llSum('2460','2479')
        if (levsk > 0) rows.push(u(7382, levsk))                                                  // B15
        const ovrigSk = llSum('2420','2439') + llSum('2450','2459') + llSum('2490','2499') + llSum('2600','2999')
        if (ovrigSk > 0) rows.push(u(7383, ovrigSk))                                             // B16
        return rows
      })(),

      // Bokfört resultat
      u(7440, bokfOvsk),
      u(7600, bokfOvsk),
      // 7601 = ej avdragsgilla tillägg (§H)
      s3.dH > 0 ? u(7601, Math.round(s3.dH)) : '',

      // Skattemässiga justeringar
      // R14 Bokförda intäkter ej skattepliktiga — ingen verifierad SRU-kod ännu
      // Påverkar skattemässigt resultat via dH men skickas ej separat
      r16hk  ? u(7701, r16hk)  : '',
      r22res ? u(7704, r22res) : '',

      // Periodiseringsfond
      j.r10 ? u(7730, Math.round(j.r10||0)) : '',   // Avsättning
      j.r11 ? u(7608, Math.round(j.r11||0)) : '',   // Obligatorisk återföring
      j.r12 ? u(7608, Math.round(j.r12||0)) : '',   // Frivillig återföring (samma kod)

      // Räntefördelning
      // 7745 OGILTIGT i NE-2025P4 — sparat fördelningsbelopp skickas ej
      j.useRF && j.r19 ? u(7708, Math.round(j.r19||0)) : '',  // R30 Positiv räntefördelning
      j.useRF && j.r20 ? u(7755, Math.round(j.r20||0)) : '',

      // §G Egenavgifter föregående år
      // 7610 = medgivna (R40), 7713 = påförda (R41) — Visma-ordning
      r40 ? u(7610, r40) : '',
      r41 ? u(7713, r41) : '',

      // Pension & SLP
      j.r24 ? u(7711, Math.round(j.r24||0)) : '',   // R38 Pensionsavdrag
      (s3.dSLP||0) !== 0 ? u(7712, Math.abs(s3.dSLP||0)) : '',  // R39 SLP

      // Slutresultat
      ...(r47 > 0 ? [
        // Överskott
        u(8046, 'X'),
        u(8000, 'X'),
        // 8009 = kapitalunderlag för räntefördelning (Visma: j.r17)
        j.r17 ? u(8009, Math.round(j.r17||0)) : '',
        // 8011 nedsättning EGA — Visma skickar ej, utelämnas
        // 8012 = kapitalunderlag expansionsfond
        j.r17 ? u(8012, Math.round(j.r17||0)) : '',
        u(7714, Math.floor(r47 / 3)),  // R43 25%-avdrag = R47/3 (floor = SKV:s metod)
        u(7630, r47),
      ] : [
        // Underskott
        (() => {
          const r45val = j.r45_konstnärlig === 1 ? (j.r45_belopp || Math.min(Math.round(Math.abs(r47)*0.70), 100000)) : 0
          const r46val = j.r46_aktiv === 1 ? (j.r46_belopp || 0) : 0
          const kvar = Math.max(0, Math.abs(r47) - r45val - r46val)
          return [
            kvar > 0 ? u(7730, kvar) : '',          // R48 Kvarstående underskott → INK1 10.2
            r45val > 0 ? u(7880, r45val) : '',       // R45 Allmänt avdrag → INK1 14.1
            r46val > 0 ? u(7890, r46val) : '',       // R46 Kvittning kapital
          ].filter(Boolean).join('\n')
        })()
        // 7601 = kvarstående outnyttjat underskott (0 om allt utnyttjas)
      ]),

      '#SYSTEMINFO SkattAI/Normiq',
      '#BLANKETTSLUT',
    ].filter(r => r !== '').join('\n')
    
    // INFO.SRU
    const info = [
      '#DATABESKRIVNING_START',
      '#PRODUKT SRU',
      `#SKAPAD ${dateFmt} ${timeFmt}`,
      '#PROGRAM SkattAI/Normiq 1.0',
      '#FILNAMN BLANKETTER.SRU',
      '#DATABESKRIVNING_SLUT',
      '#MEDIELEV_START',
      `#ORGNR ${orgFull}`,
      sieData?.companyName ? `#NAMN ${sieData.companyName}` : '',
      '#MEDIELEV_SLUT',
    ].filter(r => r !== '').join('\n')
    
    return { blanketter: blanketter + '\n#FIL_SLUT', info }
  }

  function downloadSRU() {
    const { blanketter, info } = generateSRU()
    // Download BLANKETTER.SRU
    const a1 = document.createElement('a')
    a1.href = URL.createObjectURL(new Blob([blanketter], { type: 'text/plain;charset=windows-1252' }))
    a1.download = 'BLANKETTER.SRU'
    a1.click()
    // Download INFO.SRU after short delay
    setTimeout(() => {
      const a2 = document.createElement('a')
      a2.href = URL.createObjectURL(new Blob([info], { type: 'text/plain;charset=windows-1252' }))
      a2.download = 'INFO.SRU'
      a2.click()
    }, 500)
  }

  // ── Load historik ─────────────────────────────
  const loadHistorik = useCallback(async () => {
    const { data, error } = await supabase
      .from('deklarationer')
      .select('id, inkomstar, company_name, org_number, status, updated_at')
      .order('inkomstar', { ascending: false })
      .order('updated_at', { ascending: false })
    if (data) setHistorik(data)
    if (error) console.warn('loadHistorik error:', error.message, error.code)
  }, [supabase])

  useEffect(() => { loadHistorik() }, [loadHistorik])

  // Auto-save — debounced 3 sek efter att j/utlandResor/avstamning ändrats
  const autoSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!sieData || !user || typeof step !== 'number' || step < 4) return  // Bara steg 4+
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      saveDeklaration()
    }, 3000)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  }, [j, utlandResor, avstamning, passiv, kommunalskatt, verksamhetensArt])  // eslint-disable-line

  // ── Save deklaration ───────────────────────────
  const saveDeklaration = async () => {
    if (!sieData) return
    if (!user) {
      alert('Du måste vara inloggad för att spara. Logga in på normiq.se/login')
      return
    }
    setSaving(true)
    const inkomstar = parseInt(sieData.fiscalYearStart.substring(0, 4)) || 2025
    const state = {
      j, utlandResor, avstamning, passiv, extraNed, kommunalskatt,
      verksamhetensArt, uppdragstagare, saknarTillgangar,
      mappingData: mapping, bsData: bs,
      sieCompanyName: sieData.companyName,
      sieOrgNumber: sieData.orgNumber,
      sieFiscalYearStart: sieData.fiscalYearStart,
      sieFiscalYearEnd: sieData.fiscalYearEnd,
    }
    const { blanketter, info } = generateSRU()
    const payload = {
      user_id: user.id,   // krävs för RLS: auth.uid() = user_id
      inkomstar,
      company_name: sieData.companyName,
      org_number: sieData.orgNumber,
      sie_filename: filename,
      state,
      sru_blanketter: blanketter,
      sru_info: info,
    }
    try {
      if (deklarationId) {
        const { error } = await supabase.from('deklarationer').update({ ...payload, status: 'utkast' }).eq('id', deklarationId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('deklarationer').insert(payload).select('id').single()
        if (error) throw error
        if (data) setDeklarationId(data.id)
      }
      await loadHistorik()
    } catch (err: unknown) {
      console.error('Save error:', err)
      // Supabase returns error objects with .message, not Error instances
      const msg = err instanceof Error
        ? err.message
        : (err as {message?: string})?.message
          ?? JSON.stringify(err)
      // Common Supabase errors
      let userMsg = 'Kunde inte spara. Försök igen.'
      if (msg.includes('JWT')) userMsg = 'Din session har gått ut — logga in igen.'
      else if (msg.includes('violates row-level')) userMsg = 'Behörighetsfel — kontrollera att du är inloggad med rätt konto.'
      else if (msg.includes('deklarationer') && msg.includes('does not exist')) userMsg = 'Databasen är inte konfigurerad. Kör SQL-migrationen i Supabase.'
      else if (msg) userMsg = msg
      alert(userMsg)
    } finally {
      setSaving(false)
    }
  }

  // ── Load saved deklaration ─────────────────────
  const loadDeklaration = async (id: string) => {
    const { data } = await supabase.from('deklarationer').select('*').eq('id', id).single()
    if (!data) return
    const s = data.state as Record<string, unknown>
    if (s.j) setJ(s.j as Record<string, number>)
    if (s.utlandResor) setUtlandResor(s.utlandResor as {land:number;dagar:number;halvdagar:number}[])
    if (s.avstamning) setAvstamning(s.avstamning as Record<string, 'ja'|'nej'|null>)
    if (typeof s.passiv === 'boolean') setPassiv(s.passiv)
    if (typeof s.extraNed === 'number') setExtraNed(s.extraNed)
    if (typeof s.kommunalskatt === 'number') setKommunalskatt(s.kommunalskatt)
    if (typeof s.verksamhetensArt === 'string') setVerksamhetensArt(s.verksamhetensArt)
    if (typeof s.uppdragstagare === 'boolean') setUppdragstagare(s.uppdragstagare)
    if (typeof s.saknarTillgangar === 'boolean') setSaknarTillgangar(s.saknarTillgangar)
    // Restore SIE data
    if (s.mappingData) setMapping(s.mappingData as MappingData)
    if (s.bsData) setBS(s.bsData as BSData)
    if (data.sie_filename) setFilename(data.sie_filename)
    // Reconstruct minimal SIEData for display
    setSieData({
      companyName: data.company_name || '',
      orgNumber: data.org_number || '',
      fiscalYearStart: (s.sieFiscalYearStart as string) || '',
      fiscalYearEnd: (s.sieFiscalYearEnd as string) || '',
      accounts: {},
      accountTotals: {},
      openingBalances: {},
    })
    setDeklarationId(id)
    nav(2)
  }

  const nav = (n: number) => {
    if (n === 5) { setStep(5 as Step) }
    else setStep(n as Step)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Render ─────────────────────────────────
  const STEPS = [
    { n: 1, label: 'Din bokföring',        sub: 'Ladda upp SIE-fil från ditt program' },
    { n: 2, label: 'Intäkter & kostnader', sub: 'Vi kontrollerar siffrorna' },
    { n: 3, label: 'Tillgångar & skulder', sub: 'Balansräkning vid årets slut' },
    { n: 4, label: 'Avdrag & justeringar', sub: 'Hemmakontor, resor, pension...' },
    { n: 5, label: 'Din skatt',            sub: 'Egenavgifter och kommunalskatt' },
    { n: 6, label: 'Klar att skicka in',   sub: 'Ladda ner SRU-fil till Skatteverket' },
  ]

  if (authLoading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F5F0E8' }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: '#1A1A18' }}>
        Normiq <span style={{ color: '#C0392B' }}>Deklarera</span>
      </div>
    </div>
  )

  if (!user) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F5F0E8', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 380, width: '100%', padding: '0 24px' }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 700, marginBottom: 6 }}>Normiq <span style={{ color: '#C0392B' }}>Deklarera</span></div>
        <div style={{ fontSize: 14, color: '#6A6660', lineHeight: 1.6, marginBottom: 32 }}>Logga in på ditt Normiq-konto för att komma åt NE-deklarationsverktyget.</div>
        <a href="/login?redirect=/deklarera" style={{ display: 'block', padding: '14px 20px', background: '#1A1A18', color: '#fff', fontSize: 14, fontWeight: 500, borderRadius: 2, textAlign: 'center', textDecoration: 'none' }}>
          Logga in på Normiq →
        </a>
        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: '#9A9690' }}>
          Inget konto? <a href="/register" style={{ color: '#C0392B' }}>Skapa ett här</a>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", background: '#F5F0E8' }}>

      {/* ── SIDEBAR ── */}
      <aside style={{ width: 240, background: '#fff', borderRight: '1px solid #DDD8CF', padding: '24px 0', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '0 20px', marginBottom: 4, fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, fontWeight: 700 }}>Deklarera NE</div>
        <div style={{ padding: '0 20px', fontSize: 11, color: '#9A9690', marginBottom: 10 }}>Taxeringsår 2026 · Inkomstår 2025</div>
        {/* Progress bar */}
        {typeof step === 'number' && step > 0 && (
          <div style={{ margin: '0 20px 14px', height: 3, background: '#EDE8DF', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#C0392B', width: `${((step - 1) / 5) * 100}%`, transition: 'width .4s ease', borderRadius: 2 }} />
          </div>
        )}
        <div style={{ padding: '6px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #DDD8CF', marginBottom: 14 }}>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6A6660', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
            {user?.email}
          </div>
          <button
            onClick={() => supabase.auth.signOut().then(() => window.location.href = '/login')}
            style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9A9690', background: 'none', border: '1px solid #DDD8CF', borderRadius: 2, padding: '2px 7px', cursor: 'pointer', letterSpacing: '.04em', flexShrink: 0, marginLeft: 6 }}
          >
            Logga ut
          </button>
        </div>

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
                {isDone && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#2D6A4F', marginTop: 1 }}>✓ Klar</div>}
              </div>
            </div>
          )
        })}

        {/* Historik — tidigare sparade deklarationer */}
        {historik.length > 0 && (<>
          <div style={{ height: 1, background: '#DDD8CF', margin: '8px 20px' }} />
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#9A9690', padding: '8px 20px 4px' }}>Tidigare år</div>
          {historik.map(d => (
            <div key={d.id} onClick={() => loadDeklaration(d.id)}
              style={{ padding: '8px 20px', cursor: 'pointer', borderLeft: deklarationId === d.id ? '2px solid #C0392B' : '2px solid transparent', background: deklarationId === d.id ? '#F5F0E8' : 'transparent', transition: 'all .12s' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A18' }}>Inkomstår {d.inkomstar}</div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 1 }}>
                {d.company_name || d.org_number} ·{' '}
                <span style={{ color: d.status === 'inlamnad' ? '#2D6A4F' : d.status === 'klar' ? '#92620A' : '#9A9690' }}>
                  {d.status === 'inlamnad' ? 'Inlämnad ✓' : d.status === 'klar' ? 'Klar' : 'Utkast'}
                </span>
              </div>
            </div>
          ))}
        </>)}

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

      {/* ── STICKY TAX METER ── */}
      {sieData && typeof step === 'number' && step >= 4 && (
        <div style={{ position: 'fixed', bottom: 0, left: 240, right: 0, zIndex: 50, background: 'rgba(26,26,24,.96)', backdropFilter: 'blur(8px)', borderTop: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, height: 52 }}>
          {[
            { label: 'Bokfört', value: fmt(bokf) + ' kr', c: '#E8E4DC' },
            { label: 'Skattemässigt', value: (skattemassigt < 0 ? '−' : '') + fmt(Math.abs(skattemassigt)) + ' kr', c: skattemassigt >= 0 ? '#4CAF7A' : '#E85447' },
            { label: 'Egenavgifter', value: '−' + fmt(ega.netto) + ' kr', c: '#E85447' },
            { label: 'Överskott', value: fmt(Math.abs(ega.slutlig)) + ' kr', c: ega.slutlig >= 0 ? '#E8C547' : '#E85447' },
            { label: 'Total skatt', value: fmt(ega.tot) + ' kr', c: '#E85447' },
          ].map((item, i) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <div style={{ width: 1, height: 26, background: '#333', margin: '0 20px' }} />}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 8, letterSpacing: '.12em', color: '#888', textTransform: 'uppercase' as const, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: item.c }}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MAIN ── */}
      <main style={{ flex: 1, minWidth: 0, paddingBottom: typeof step === 'number' && step >= 4 ? 60 : 0 }}>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div style={{ maxWidth: 600, padding: '48px 36px 60px' }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#C0392B', marginBottom: 10 }}>Normiq Deklarera · Blankett NE</div>
            <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 38, fontWeight: 700, lineHeight: 1.12, marginBottom: 10 }}>Dags att deklarera</h1>
            <p style={{ fontSize: 14, color: '#6A6660', lineHeight: 1.65, marginBottom: 20, maxWidth: 460 }}>
              Vi hämtar grundsiffrorna från din bokföring och guidar dig steg för steg genom avdrag och justeringar.
            </p>

            {/* Hur det fungerar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 28 }}>
              {[
                { icon: '📂', title: 'Ladda upp SIE-fil', desc: 'Exportera från Fortnox, Bokio, Visma eller Björn Lundén' },
                { icon: '🤖', title: 'Vi räknar åt dig', desc: 'Avdrag, egenavgifter och skattemässiga justeringar' },
                { icon: '📤', title: 'Skicka till SKV', desc: 'Ladda ner SRU-filen och ladda upp på skatteverket.se' },
              ].map(s => (
                <div key={s.title} style={{ background: '#fff', border: '1px solid #DDD8CF', borderRadius: 4, padding: '14px 14px 12px' }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A18', marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: 11.5, color: '#6A6660', lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              ))}
            </div>

            {/* Var hittar man SIE-filen */}
            <details style={{ marginBottom: 20, background: '#F5F0E8', border: '1px solid #DDD8CF', borderRadius: 4, padding: '10px 14px' }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#1A1A18', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>❓</span> Var hittar jag SIE-filen?
              </summary>
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { app: 'Fortnox', path: 'Bokföring → Exportera → SIE' },
                  { app: 'Bokio', path: 'Inställningar → Exportera bokföring → SIE' },
                  { app: 'Visma eEkonomi', path: 'Arkiv → Exportera → SIE-fil' },
                  { app: 'Björn Lundén', path: 'Arkiv → SIE-export' },
                ].map(p => (
                  <div key={p.app} style={{ fontSize: 12, color: '#3A3832', lineHeight: 1.5 }}>
                    <strong>{p.app}:</strong> {p.path}
                  </div>
                ))}
              </div>
            </details>

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
              {['NE AVSNITT A–B', 'INKOMSTÅR 2025'].map(t => <span key={t} style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '3px 9px', border: '1px solid #C8C3BA', color: '#6A6660', letterSpacing: '.06em' }}>{t}</span>)}
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
              const totAr = Math.round(totA)
              const totLr = Math.round(totL)
              const diff = Math.abs(totAr - totLr)

              const BsGroup = ({ title, lines }: { title: string; lines: typeof bs.al }) => {
                if (!lines.length) return null
                const tot = Math.round(lines.reduce((s, l) => s + l.amt, 0))
                return (
                  <>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9A9690', padding: '8px 14px 3px', borderBottom: '1px solid #DDD8CF', background: '#F5F0E8' }}>{title}</div>
                    {lines.map(l => (
                      <div key={l.acc} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid #DDD8CF', fontSize: 12 }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginRight: 8, flexShrink: 0 }}>{l.acc}</span>
                        <span style={{ flex: 1, color: '#3A3832' }}>{l.name}</span>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500, marginLeft: 10, color: l.amt < 0 ? '#9A9690' : 'inherit' }}>{l.amt < 0 ? '−' + fmt(Math.round(Math.abs(l.amt))) : fmt(Math.round(l.amt))} kr</span>
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
                    {[{ l: 'Anläggningstillgångar', v: fmt(Math.round(atv)) + ' kr' }, { l: 'Omsättningstillgångar', v: fmt(Math.round(otv)) + ' kr' }, { l: 'Skulder', v: fmt(Math.round(skv)) + ' kr' }, { l: 'Eget kapital', v: fmt(Math.round(ekv)) + ' kr' }].map(s => (
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
                        ? <><strong>Balansen stämmer</strong> — Tillgångar {fmt(totAr)} kr = Skulder + EK {fmt(totLr)} kr</>
                        : <><strong>Differens {fmt(diff)} kr</strong> — avrundningsdiff, acceptabelt om &lt; 2 kr</>}
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
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 700, marginBottom: 8 }}>Avdrag och justeringar</h1>
            <div style={{ fontSize: 13, color: '#6A6660', marginBottom: 20, lineHeight: 1.6 }}>
              Här fyller du i avdrag som hemmakontor, resor och pension — saker som sänker din skatt.
              Det som är <span style={{ color: '#2D6A4F', fontWeight: 500 }}>grönt</span> är förifyllt från din bokföring.
            </div>

            {/* ── AVSTÄMNING ── */}
            <div style={{ background: '#fff', border: `2px solid ${avstamningKlar ? '#B7D9C8' : '#C0392B'}`, borderRadius: 4, marginBottom: 24, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: avstamningKlar ? '#EFF7F2' : '#FDF0EE', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${avstamningKlar ? '#B7D9C8' : '#E8C4BF'}` }}>
                <span style={{ fontSize: 16 }}>{avstamningKlar ? '✓' : '⚠'}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: avstamningKlar ? '#2D6A4F' : '#C0392B' }}>
                    {avstamningKlar ? 'Avstämning klar — du kan gå vidare' : 'Snabbkoll — svara Ja eller Nej, tar 1 minut'}
                  </div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2, letterSpacing: '.04em' }}>
                    Dessa poster är vanliga men missas ofta. Svara Ja eller Nej på varje — ange 0 om det inte är aktuellt.
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690' }}>
                  {Object.values(avstamning).filter(v => v !== null).length}/{Object.keys(avstamning).length} besvarade
                </div>
              </div>

              {[
                {
                  key: 'hemmakontor',
                  icon: '🏠',
                  title: 'Hemmakontor / arbetsrum i bostaden',
                  desc: 'Har du ett rum hemma som du bara använder för jobbet? Du kan dra av 4 000 kr/år om du hyr, 2 000 kr om du äger.',
                  jaAction: () => {},
                  nejAction: () => setJv('hemmakontor', 0),
                },
                {
                  key: 'traktamente',
                  icon: '🚗',
                  title: 'Resor & traktamente',
                  desc: 'Har du kört din privata bil i jobbet, eller rest bort och ätit på Skatteverkets bekostnad? Det går att dra av 25 kr/mil och 290 kr/dag.',
                  jaAction: () => {},
                  nejAction: () => { setJv('resor_mil', 0); setJv('resor_trakt', 0); setJv('resor_trakt_manuell', 0) },
                },
                {
                  key: 'pension',
                  icon: '🏦',
                  title: 'Pensionssparande / tjänstepension',
                  desc: 'Har du satt in pengar till ett pensionssparande — privat pension (IPS) eller tjänstepension? Du kan dra av upp till 35% av årets vinst.',
                  jaAction: () => {},
                  nejAction: () => setJv('r24', 0),
                },
                {
                  key: 'slp',
                  icon: '📋',
                  title: 'Särskild löneskatt på pensionssparavdrag',
                  desc: 'Om du svarade Ja på pension ovan: det tillkommer en extra avgift på 24,26% av pensionsavdraget. Vi räknar ut det automatiskt.',
                  jaAction: () => {},
                  nejAction: () => {},
                },
                {
                  key: 'sjuklon',
                  icon: '🏥',
                  title: 'Sjuklön & sjukpenning',
                  desc: 'Har du anställda och betalat sjuklön? Eller fått sjuk- eller föräldrapenning från Försäkringskassan under året?',
                  jaAction: () => {},
                  nejAction: () => { setJv('r25', 0); setJv('r26', 0); setJv('r27', 0) },
                },
                {
                  key: 'ega_fg',
                  icon: '⚖',
                  title: 'Egenavgifter föregående år — medgivna vs. påförda (§G)',
                  desc: 'Titta på förra årets deklaration och slutskattebesked — stämde det förra årets skatteberäkning? Ange 0 om det var ditt första år eller om du är osäker.',
                  jaAction: () => {},
                  nejAction: () => { setJv('r28', 0); setJv('r29', 0) },
                },
                {
                  key: 'underskott',
                  icon: '📉',
                  title: 'Outnyttjat underskott från föregående år (§E)',
                  desc: 'Gick det minus förra året? Det outnyttjade underskottet kan minska din skatt i år. Titta på förra årets NE-bilaga rad R23. Ange 0 om det inte är aktuellt.',
                  jaAction: () => {},
                  nejAction: () => setJv('r21', 0),
                },
                {
                  key: 'pfonder',
                  icon: '🏛',
                  title: 'Periodiseringsfonder — obligatorisk återföring eller årets avsättning (§B)',
                  desc: 'Vill du "spara" en del av årets vinst och skjuta upp skatten? Max 30% av vinsten. Har du gjort det tidigare år (avsättningar äldre än 6 år måste återföras nu)? Ange 0 om du vill skippa detta.',
                  jaAction: () => {},
                  nejAction: () => { setJv('r10', 0); setJv('r11', 0); setJv('r12', 0); setJv('r13', 0) },
                },
                {
                  key: 'ej_skattepliktig',
                  icon: '🔕',
                  title: 'Skattefria intäkter bokförda i resultaträkningen (R14)',
                  desc: 'Har du bokfört intäkter som inte ska beskattas — t.ex. skattefria bidrag (Tillväxtverket, Almi), försäkringsersättningar, erhållna gåvor eller andra skattefria intäkter? De ska dras av här så de inte räknas med i överskottet.',
                  jaAction: () => {},
                  nejAction: () => setJv('r14h', 0),
                },
              ].map((item, idx, arr) => (
                <div key={item.key} style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 12, padding: '13px 16px', borderBottom: idx < arr.length - 1 ? `1px solid ${avstamning[item.key] ? '#DDD8CF' : '#F0E8E8'}` : 'none', background: avstamning[item.key] === null ? '#FFFAFA' : '#fff', alignItems: 'start' }}>
                  <span style={{ fontSize: 20, marginTop: 1 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A18', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {item.title}
                      {avstamning[item.key] === null && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#C0392B', background: '#FDF0EE', border: '1px solid #E8C4BF', padding: '1px 6px', letterSpacing: '.06em' }}>OBLIGATORISK</span>}
                      {avstamning[item.key] === 'ja' && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#2D6A4F', background: '#EFF7F2', border: '1px solid #B7D9C8', padding: '1px 6px' }}>JA — fyll i nedan</span>}
                      {avstamning[item.key] === 'nej' && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9A9690', background: '#F5F0E8', border: '1px solid #DDD8CF', padding: '1px 6px' }}>NEJ — nollas</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#6A6660', lineHeight: 1.55 }}>{item.desc}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginTop: 2 }}>
                    <button
                      onClick={() => { setAv(item.key, 'ja'); item.jaAction() }}
                      style={{ padding: '5px 14px', fontFamily: 'DM Mono, monospace', fontSize: 11, cursor: 'pointer', border: '1px solid', borderRadius: 2, letterSpacing: '.04em', background: avstamning[item.key] === 'ja' ? '#2D6A4F' : '#fff', color: avstamning[item.key] === 'ja' ? '#fff' : '#3A3832', borderColor: avstamning[item.key] === 'ja' ? '#2D6A4F' : '#C8C3BA', fontWeight: avstamning[item.key] === 'ja' ? 600 : 400 }}
                    >Ja</button>
                    <button
                      onClick={() => { setAv(item.key, 'nej'); item.nejAction() }}
                      style={{ padding: '5px 14px', fontFamily: 'DM Mono, monospace', fontSize: 11, cursor: 'pointer', border: '1px solid', borderRadius: 2, letterSpacing: '.04em', background: avstamning[item.key] === 'nej' ? '#6A6660' : '#fff', color: avstamning[item.key] === 'nej' ? '#fff' : '#3A3832', borderColor: avstamning[item.key] === 'nej' ? '#6A6660' : '#C8C3BA', fontWeight: avstamning[item.key] === 'nej' ? 600 : 400 }}
                    >Nej</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1, background: '#DDD8CF', border: '1px solid #DDD8CF', marginBottom: 22 }}>
              {[{ l: 'Bokfört', v: fmt(bokf) + ' kr' }, { l: 'Avskr.', v: sgn(s3.dA) }, { l: 'Fond/fördelning', v: sgn(s3.dB + s3.dC + (j.useRF ? s3.dD : 0)) }, { l: 'Avdrag/tillägg', v: sgn(s3.dE + s3.dF + s3.dG + s3.dH + (s3.dI||0) + (s3.dJ||0)) }, { l: skattemassigt >= 0 ? 'Skattemässigt' : 'Underskott', v: fmt(Math.abs(skattemassigt)) + ' kr', c: skattemassigt < 0 ? '#C0392B' : undefined }].map(s => (
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
              // NE §D Räntefördelning — rendered separately with opt-in below
              { code: 'NE §E', name: 'Outnyttjat underskott', sum: sgn(s3.dE), info: { type: 'amber', text: 'Rullas vidare utan tidsgräns. Kan kvittas mot tjänst (70%) de första 5 åren.' }, fields: [{ id: 'r21', label: 'Outnyttjat underskott från föregående år', hint: '' }, { id: 'r22', label: 'Utnyttjat underskott i år', hint: 'Auto — max årets överskott', calc: true }, { id: 'r23', label: 'Kvarstående (rullas vidare)', hint: 'Auto', calc: true }] },
              { code: 'NE §F', name: 'Pension, sjuklön & sjukpenning', sum: sgn(s3.dF), info: { type: 'blue', text: `Tjänstepension max 35% av överskott = ${fmt(Math.floor(bokf*0.35))} kr (tak 573 000 kr) · IL 28:5. OBS: SLP 24,26% × R24 läggs automatiskt till som kostnad nedan.` }, fields: [{ id: 'r24', label: 'Avdrag för pensionssparande / tjänstepension', hint: `Max 35% × ${fmt(bokf)} kr = ${fmt(Math.floor(bokf * 0.35))} kr · IL 28:5` }, { id: 'r25', label: 'Sjukpenning / föräldrapenning (intäkt)', hint: '' }, { id: 'r26', label: 'Betald sjuklön till anställda', hint: '', sie: true }, { id: 'r27', label: 'Erhållen sjuklöneersättning från FK (intäkt)', hint: '' }] },
              { code: 'NE §G', name: '⚠ Egenavgifter föregående år — medgivna / påförda', sum: sgn(s3.dG), info: { type: 'amber', text: '⚠ Viktig rad som de flesta missar! Medgivna (R28) = vad du drog av på förra årets NE. Påförda (R29) = faktiska avgifter från slutskattebeskedet. Differensen justeras här.' }, fields: [{ id: 'r28', label: 'Avdrag medgivna egenavgifter föregående år', hint: 'Beloppet du drog av på förra NE · Från förra årets NE §4 E5', highlight: true }, { id: 'r29', label: 'Faktiskt påförda egenavgifter föregående år', hint: 'Från Skatteverkets slutskattebesked · Se R41 på NE-bilagan', highlight: true }, { id: 'r30', label: 'Justering (R28 − R29)', hint: 'Pos = drog av för mycket → återförs (ökar överskott) · Neg = extra avdrag · Auto', calc: true }] },
              { code: 'NE §H', name: 'Övriga justeringar', sum: sgn(s3.dH), info: null, fields: [{ id: 'r31', label: 'Representation — ej avdragsgill del (6072)', hint: 'Auto från SIE · Max 180 kr exkl. moms / person', sie: (mapping?.autoR31||0) > 0 },
              { id: 'r14h', label: 'Bokförda intäkter som inte ska tas upp till beskattning (R14)', hint: 'T.ex. skattefria bidrag, försäkringsersättningar' }, { id: 'r32', label: 'Böter och skattetillägg (IL 9:10)', hint: 'Auto från SIE · Aldrig avdragsgilla', sie: (mapping?.autoR32||0) > 0 }, { id: 'r33', label: 'Schablonintäkt (ISK / räntefond i rörelsen)', hint: '' }, { id: 'r34', label: 'Övriga skattemässiga tillägg', hint: '' }, { id: 'r35', label: 'Övriga skattemässiga avdrag', hint: '' }] },
            ].map(acc => (
              <Accordion key={acc.code} code={acc.code} name={acc.name} sum={acc.sum}>
                {acc.info && (
                  <div style={{ margin: '8px 14px', padding: '10px 13px', fontSize: 12, lineHeight: 1.65, borderRadius: 2, background: acc.info.type === 'blue' ? '#EBF3FA' : '#FDF5E6', borderLeft: `2px solid ${acc.info.type === 'blue' ? '#5A96C8' : '#92620A'}`, color: acc.info.type === 'blue' ? '#2A5070' : '#92620A' }}>{acc.info.text}</div>
                )}
                {(acc.fields as { id: string; label: string; hint: string; calc?: boolean; sie?: boolean; highlight?: boolean }[]).map(f => (
                  <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'start', padding: '9px 14px', borderBottom: '1px solid #DDD8CF' }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B', paddingTop: 2 }}>{f.id.toUpperCase()}</span>
                    <div>
                      <div style={{ fontSize: 13, color: '#3A3832', lineHeight: 1.4 }}>{f.label}</div>
                      {f.hint && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>{f.hint}</div>}
                    </div>
                    <input
                      type="number"
                      value={j[f.id] || 0}
                      readOnly={!!f.calc}
                      onChange={e => {
                        if (f.calc) return
                        const v = parseInt(e.target.value) || 0
                        setJv(f.id, v)
                      }}
                      style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500, padding: '6px 10px', background: f.calc ? '#EDE8DF' : f.sie ? '#EFF7F2' : f.highlight ? '#FDF5E6' : '#F5F0E8', border: `1px solid ${f.calc ? '#DDD8CF' : f.sie ? '#B7D9C8' : f.highlight ? '#E8D4A0' : '#C8C3BA'}`, color: f.calc ? '#9A9690' : '#1A1A18', width: '100%', textAlign: 'right', outline: 'none', borderRadius: 2 }}
                    />
                  </div>
                ))}
              </Accordion>
            ))}

            {/* ── RÄNTEFÖRDELNING (opt-in) ── */}
            <Accordion code="NE §D" name="Räntefördelning (frivillig)" sum={j.useRF ? sgn(s3.dD) : 'Ej vald'}>
              <div style={{ margin: '8px 14px', padding: '10px 13px', fontSize: 12, background: '#EBF3FA', borderLeft: '2px solid #5A96C8', color: '#2A5070', borderRadius: 2 }}>
                Omvandlar näringsinkomst till kapitalinkomst (30% skatt). Max = 7,96% × kapitalunderlag + sparat fördelningsbelopp fg år (R25). Välj aktivt om du vill använda.
              </div>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #DDD8CF', display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="useRF" checked={!!j.useRF} onChange={e => {
                  setJv('useRF', e.target.checked ? 1 : 0)
                  if (e.target.checked) {
                    // Auto-fill R19 med maxbeloppet — användaren kan minska det
                    const maxRF = Math.round((j.r17||0)*0.0796 + (j.r25_rf||0))
                    setJv('r19', maxRF)
                  } else {
                    setJv('r19', 0)
                  }
                }} style={{ cursor: 'pointer', width: 15, height: 15 }} />
                <label htmlFor="useRF" style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#2A5070', cursor: 'pointer', letterSpacing: '.04em' }}>
                  Ja, jag vill använda positiv räntefördelning
                </label>
              </div>
              {!!j.useRF && (<>
                <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'start', padding: '9px 14px', borderBottom: '1px solid #DDD8CF' }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B', paddingTop: 2 }}>R17</span>
                  <div><div style={{ fontSize: 13, color: '#3A3832' }}>Kapitalunderlag (ingående justerat EK)</div><div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>Auto från balansräkning</div></div>
                  <input type="number" value={j.r17 || 0} onChange={e => setJv('r17', parseInt(e.target.value)||0)} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500, padding: '6px 10px', background: '#EFF7F2', border: '1px solid #B7D9C8', color: '#1A1A18', width: '100%', textAlign: 'right', outline: 'none', borderRadius: 2 }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'start', padding: '9px 14px', borderBottom: '1px solid #DDD8CF' }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B', paddingTop: 2 }}>R25</span>
                  <div><div style={{ fontSize: 13, color: '#3A3832' }}>Sparat fördelningsbelopp från föregående år</div><div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>Outnyttjat belopp från fg år NE § Räntefördelning</div></div>
                  <input type="number" value={j.r25_rf || 0} onChange={e => setJv('r25_rf', parseInt(e.target.value)||0)} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500, padding: '6px 10px', background: '#F5F0E8', border: '1px solid #C8C3BA', color: '#1A1A18', width: '100%', textAlign: 'right', outline: 'none', borderRadius: 2 }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'start', padding: '9px 14px', borderBottom: '1px solid #DDD8CF' }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B', paddingTop: 2 }}>R18</span>
                  <div><div style={{ fontSize: 13, color: '#3A3832' }}>Max positiv räntefördelning (7,96% × R17 + R25)</div><div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>Auto — kapitalunderlag + sparat fg år</div></div>
                  <input readOnly value={Math.round((j.r17||0)*0.0796 + (j.r25_rf||0))} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, padding: '6px 10px', background: '#EDE8DF', border: '1px solid #DDD8CF', color: '#9A9690', width: '100%', textAlign: 'right', outline: 'none', borderRadius: 2 }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'start', padding: '9px 14px', borderBottom: '1px solid #DDD8CF' }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B', paddingTop: 2 }}>R19</span>
                  <div>
                    <div style={{ fontSize: 13, color: '#3A3832', fontWeight: 500 }}>
                      Positiv räntefördelning att utnyttja
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#C0392B', background: '#FDF0EE', border: '1px solid #E8C4BF', padding: '1px 6px', marginLeft: 8 }}>OBLIGATORISK</span>
                    </div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>
                      Max {fmt(Math.round((j.r17||0)*0.0796 + (j.r25_rf||0)))} kr · Beskattas som kapitalinkomst 30% · Kan sparas till nästa år
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <input type="number" value={j.r19 || 0}
                      onChange={e => setJv('r19', Math.min(parseInt(e.target.value)||0, Math.round((j.r17||0)*0.0796 + (j.r25_rf||0))))}
                      style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 600, padding: '6px 10px',
                        background: (j.r19||0) === 0 ? '#FDF0EE' : '#EFF7F2',
                        border: `2px solid ${(j.r19||0) === 0 ? '#C0392B' : '#2D6A4F'}`,
                        color: '#1A1A18', width: '100%', textAlign: 'right', outline: 'none', borderRadius: 2 }} />
                    {(j.r19||0) === 0 && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#C0392B', letterSpacing: '.06em' }}>⚠ OBLIGATORISK — ange belopp (max {fmt(Math.round((j.r17||0)*0.0796 + (j.r25_rf||0)))} kr)</div>}
                    {(j.r19||0) > 0 && (j.r19||0) < Math.round((j.r17||0)*0.0796 + (j.r25_rf||0)) && (
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#92620A' }}>
                        Sparat: {fmt(Math.round((j.r17||0)*0.0796 + (j.r25_rf||0)) - (j.r19||0))} kr rullas vidare
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'start', padding: '9px 14px' }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B', paddingTop: 2 }}>R20</span>
                  <div><div style={{ fontSize: 13, color: '#3A3832' }}>Negativ räntefördelning (obligatorisk vid negativt underlag)</div></div>
                  <input type="number" value={j.r20 || 0} onChange={e => setJv('r20', parseInt(e.target.value)||0)} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500, padding: '6px 10px', background: '#F5F0E8', border: '1px solid #C8C3BA', color: '#1A1A18', width: '100%', textAlign: 'right', outline: 'none', borderRadius: 2 }} />
                </div>
              </>)}
            </Accordion>

                        {/* ── RESOR & TRAKTAMENTE ── */}
            <Accordion code="NE R22" name="Resor & traktamente — ej bokförda kostnader (R22)" sum={sgn(s3.dI||0)}>
              <div style={{ margin: '8px 14px', padding: '10px 13px', fontSize: 12, background: '#EBF3FA', borderLeft: '2px solid #5A96C8', color: '#2A5070', borderRadius: 2 }}>
                Milersättning för tjänsteresor med privat bil: <strong>25 kr/mil</strong> (2025). Traktamente inrikes helpension: <strong>290 kr/dag</strong>. Dessa läggs som avdrag om de inte redan bokförts som kostnad.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'start', padding: '9px 14px', borderBottom: '1px solid #DDD8CF' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B', paddingTop: 2 }}>MIL</span>
                <div><div style={{ fontSize: 13, color: '#3A3832' }}>Antal tjänstemil med privat bil (ej bokförda)</div><div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>Avdrag = antal mil × 25 kr</div></div>
                <input type="number" value={j.resor_mil || 0} onChange={e => setJv('resor_mil', parseInt(e.target.value)||0)} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500, padding: '6px 10px', background: '#F5F0E8', border: '1px solid #C8C3BA', color: '#1A1A18', width: '100%', textAlign: 'right', outline: 'none', borderRadius: 2 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'start', padding: '9px 14px', borderBottom: '1px solid #DDD8CF' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B', paddingTop: 2 }}>AVD</span>
                <div><div style={{ fontSize: 13, color: '#3A3832' }}>Milersättningsavdrag (25 kr × mil)</div><div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>Auto</div></div>
                <input readOnly value={Math.round((j.resor_mil||0)*25)} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, padding: '6px 10px', background: '#EDE8DF', border: '1px solid #DDD8CF', color: '#9A9690', width: '100%', textAlign: 'right', outline: 'none', borderRadius: 2 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'start', padding: '9px 14px', borderBottom: '1px solid #DDD8CF' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B', paddingTop: 2 }}>TRAKT</span>
                <div><div style={{ fontSize: 13, color: '#3A3832' }}>Traktamente — antal dagar med helpension</div><div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>290 kr/dag inrikes · Ej bokfört sedan tidigare</div></div>
                <input type="number" value={j.resor_trakt || 0} onChange={e => { setJv('resor_trakt', parseInt(e.target.value)||0); setJv('resor_trakt_manuell', 0) }} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500, padding: '6px 10px', background: '#F5F0E8', border: '1px solid #C8C3BA', color: '#1A1A18', width: '100%', textAlign: 'right', outline: 'none', borderRadius: 2 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'start', padding: '9px 14px', borderBottom: '1px solid #DDD8CF' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B', paddingTop: 2 }}>AVD</span>
                <div><div style={{ fontSize: 13, color: '#3A3832' }}>Traktamentsavdrag (290 kr × dagar)</div><div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>Auto beräknat</div></div>
                <input readOnly value={Math.round((j.resor_trakt||0)*290)} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, padding: '6px 10px', background: '#EDE8DF', border: '1px solid #DDD8CF', color: '#9A9690', width: '100%', textAlign: 'right', outline: 'none', borderRadius: 2 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'start', padding: '9px 14px', borderBottom: '1px solid #DDD8CF' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B', paddingTop: 2 }}>MAN</span>
                <div><div style={{ fontSize: 13, color: '#3A3832' }}>Traktamente — manuellt totalbelopp (åsidosätter dagar × 290)</div><div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>Fyll i om du har exakt belopp från reseräkning</div></div>
                <input type="number" value={j.resor_trakt_manuell || 0} onChange={e => setJv('resor_trakt_manuell', parseInt(e.target.value)||0)} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500, padding: '6px 10px', background: (j.resor_trakt_manuell||0)>0 ? '#EFF7F2' : '#F5F0E8', border: `1px solid ${(j.resor_trakt_manuell||0)>0 ? '#B7D9C8' : '#C8C3BA'}`, color: '#1A1A18', width: '100%', textAlign: 'right', outline: 'none', borderRadius: 2 }} />
              </div>

              {/* Utlandstraktamente — flera länder */}
              <div style={{ margin: '8px 14px', padding: '10px 13px', fontSize: 12, background: '#EBF3FA', borderLeft: '2px solid #5A96C8', color: '#2A5070', borderRadius: 2 }}>
                Utlandstraktamente 2025 (SKV normalbelopp). Enskild firma: upp till 1 månads tjänsteresa per land.
                Lägg till en rad per land/resa. Halvdag = avresa efter kl 12 eller hemresa före kl 19.
              </div>

              {/* Header row */}
              {utlandResor.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 90px 28px', gap: 6, padding: '6px 14px', background: '#EDE8DF', borderBottom: '1px solid #DDD8CF' }}>
                  {['Land — normalbelopp/dag exkl. logi', 'Heldagar', 'Halvdagar *', 'Avdrag', ''].map(h => (
                    <div key={h} style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9A9690' }}>{h}</div>
                  ))}
                </div>
              )}

              {utlandResor.map((resa, i) => {
                const nb = resa.land > 0 ? utlandNormalbelopp[resa.land - 1] : null
                const avdrag = nb ? Math.round(nb.belopp * resa.dagar + nb.belopp * 0.5 * resa.halvdagar) : 0
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 90px 28px', gap: 6, padding: '8px 14px', borderBottom: '1px solid #DDD8CF', alignItems: 'center' }}>
                    <select
                      value={resa.land}
                      onChange={e => updateUtland(i, 'land', Number(e.target.value) || 0)}
                      style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, padding: '5px 6px', background: '#F5F0E8', border: '1px solid #C8C3BA', color: '#1A1A18', borderRadius: 2, outline: 'none', width: '100%' }}
                    >
                      <option value={0}>— Välj land —</option>
                      {utlandNormalbelopp.map((l, li) => (
                        <option key={li} value={li + 1}>{l.land} ({l.belopp} kr)</option>
                      ))}
                    </select>
                    <input type="number" min={0} value={resa.dagar}
                      onChange={e => updateUtland(i, 'dagar', Math.max(0, parseInt(e.target.value) || 0))}
                      style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, padding: '5px 8px', background: '#F5F0E8', border: '1px solid #C8C3BA', color: '#1A1A18', textAlign: 'right', outline: 'none', borderRadius: 2, width: '100%' }} />
                    <input type="number" min={0} value={resa.halvdagar}
                      onChange={e => updateUtland(i, 'halvdagar', Math.max(0, parseInt(e.target.value) || 0))}
                      style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, padding: '5px 8px', background: '#F5F0E8', border: '1px solid #C8C3BA', color: '#1A1A18', textAlign: 'right', outline: 'none', borderRadius: 2, width: '100%' }} />
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 600, color: avdrag > 0 ? '#2D6A4F' : '#9A9690', textAlign: 'right', padding: '0 4px' }}>
                      {avdrag > 0 ? fmt(avdrag) : '—'}
                    </div>
                    <button onClick={() => removeUtland(i)} style={{ background: 'none', border: '1px solid #DDD8CF', borderRadius: 2, color: '#C0392B', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '3px 6px' }}>×</button>
                  </div>
                )
              })}

              {/* Add row + total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
                <div>
                  <button onClick={addUtland} style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, padding: '6px 14px', background: '#F5F0E8', border: '1px solid #C8C3BA', color: '#3A3832', cursor: 'pointer', borderRadius: 2, letterSpacing: '.06em' }}>+ Lägg till land/resa</button>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9A9690', marginTop: 4 }}>* Halvdag: avresa efter kl 12:00 eller hemresa före kl 19:00 = halv normalbelopp</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  {utlandTotalt > 0 && (
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                      <span style={{ color: '#9A9690' }}>Totalt: </span>
                      <strong style={{ color: '#2D6A4F' }}>{fmt(utlandTotalt)} kr</strong>
                    </div>
                  )}
                  {utlandResor.reduce((s, r) => s + r.dagar + r.halvdagar, 0) > 90 && (
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#92620A', background: '#FDF5E6', border: '1px solid #E8D4A0', padding: '2px 7px', borderRadius: 2 }}>
                      ⚠ Över 90 dagar — SKV reducerar till 70% fr.o.m. dag 91
                    </div>
                  )}
                </div>
              </div>
            </Accordion>

            {/* ── HEMMAKONTOR ── */}
            <Accordion code="NE R16" name="Hemmakontor & arbetsrum — ej bokförda kostnader (R16)" sum={sgn(s3.dJ||0)}>
              <div style={{ margin: '8px 14px', padding: '10px 13px', fontSize: 12, background: '#EBF3FA', borderLeft: '2px solid #5A96C8', color: '#2A5070', borderRadius: 2 }}>
                Kostnader för arbetsrum som inte bokförts: <strong>hyresrätt 4 000 kr/år</strong>, <strong>bostadsrätt 2 000 kr/år</strong> schablonbelopp. Gäller om rummet används uteslutande för arbete. Mappas mot NE R16.
              </div>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #DDD8CF', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[{ label: 'Hyresrätt  4 000 kr', value: 4000 }, { label: 'Bostadsrätt  2 000 kr', value: 2000 }, { label: 'Inget avdrag', value: 0 }].map(opt => (
                  <button key={opt.value} onClick={() => setJv('hemmakontor', opt.value)} style={{ padding: '6px 14px', fontFamily: 'DM Mono, monospace', fontSize: 11, cursor: 'pointer', border: '1px solid', borderRadius: 2, background: (j.hemmakontor||0) === opt.value ? '#1A1A18' : '#F5F0E8', color: (j.hemmakontor||0) === opt.value ? '#fff' : '#3A3832', borderColor: (j.hemmakontor||0) === opt.value ? '#1A1A18' : '#C8C3BA', letterSpacing: '.04em' }}>{opt.label}</button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'start', padding: '9px 14px', borderBottom: '1px solid #DDD8CF' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B', paddingTop: 2 }}>HK</span>
                <div><div style={{ fontSize: 13, color: '#3A3832' }}>Avdrag hemmakontor (R16)</div><div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>Välj schablonbelopp ovan eller ange manuellt</div></div>
                <input type="number" value={j.hemmakontor || 0} onChange={e => setJv('hemmakontor', parseInt(e.target.value)||0)} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500, padding: '6px 10px', background: (j.hemmakontor||0) > 0 ? '#EFF7F2' : '#F5F0E8', border: `1px solid ${(j.hemmakontor||0) > 0 ? '#B7D9C8' : '#C8C3BA'}`, color: '#1A1A18', width: '100%', textAlign: 'right', outline: 'none', borderRadius: 2 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'start', padding: '9px 14px' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B', paddingTop: 2 }}>INT</span>
                <div><div style={{ fontSize: 13, color: '#3A3832' }}>Internetavdrag (arbetsandel av privat abonnemang)</div><div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>Skälig andel om ej bokförd · Vanligen 50–100%</div></div>
                <input type="number" value={j.hemmakontor_internet || 0} onChange={e => setJv('hemmakontor_internet', parseInt(e.target.value)||0)} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500, padding: '6px 10px', background: '#F5F0E8', border: '1px solid #C8C3BA', color: '#1A1A18', width: '100%', textAlign: 'right', outline: 'none', borderRadius: 2 }} />
              </div>
            </Accordion>

            {/* Calc summary */}
            <div style={{ background: '#fff', border: '1px solid #DDD8CF', borderRadius: 4, marginTop: 20, overflow: 'hidden' }}>
              {[{ l: 'Bokfört överskott', v: fmt(bokf) + ' kr' }, { l: '§A Avskrivningar', v: sgn(s3.dA) }, { l: '§B Periodiseringsfond', v: sgn(s3.dB) }, { l: '§C Expansionsfond', v: sgn(s3.dC) }, { l: '§D Räntefördelning', v: j.useRF ? sgn(s3.dD) : '—' }, { l: '§E Underskott', v: sgn(s3.dE) }, { l: '§F Pension & sjuklön', v: sgn(s3.dF) }, { l: '§G Egenavgifter föregående år', v: sgn(s3.dG) }, { l: '§H Övriga', v: sgn(s3.dH) }, { l: '§I Resor & traktamente', v: sgn(s3.dI||0) }, { l: '§J Hemmakontor', v: sgn(s3.dJ||0) }, { l: 'SLP Pens.avgift (24,26% × R24)', v: (s3.dSLP||0) !== 0 ? sgn(s3.dSLP||0) : '—' },
                      { l: 'R45 Kvittning tjänst', v: (s3.r45||0) > 0 ? '−' + fmt(s3.r45||0) + ' kr' : '—' },
                      { l: 'R46 Kvittning kapital', v: (s3.r46||0) > 0 ? '−' + fmt(s3.r46||0) + ' kr' : '—' }].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #DDD8CF', fontSize: 13 }}>
                  <span style={{ color: '#6A6660' }}>{row.l}</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500 }}>{row.v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: skattemassigt < 0 ? '#FDF0EE' : '#EDE8DF', borderTop: '2px solid #C8C3BA' }}>
                <div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: skattemassigt < 0 ? '#C0392B' : '#1A1A18' }}>
                    {skattemassigt >= 0 ? 'Skattemässigt överskott' : 'Skattemässigt underskott → INK1 ruta 10.2'}
                  </div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: skattemassigt < 0 ? '#C0392B' : '#9A9690', marginTop: 2 }}>
                    {skattemassigt < 0 ? 'Ingen EGA eller 25%-avdrag — underskottet rullas vidare' : 'Auto — summa av alla justeringar ovan'}
                  </div>
                </div>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: skattemassigt < 0 ? '#C0392B' : '#1A1A18' }}>{fmt(Math.abs(skattemassigt))} kr</span>
              </div>
              {/* Manual override */}
              <div style={{ padding: '12px 14px', background: '#FDF5E6', borderTop: '1px solid #E8D4A0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    id="useManual"
                    checked={!!j.useManual}
                    onChange={e => setJv('useManual', e.target.checked ? 1 : 0)}
                    style={{ cursor: 'pointer', width: 14, height: 14 }}
                  />
                  <label htmlFor="useManual" style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#92620A', cursor: 'pointer', letterSpacing: '.04em' }}>
                    Ange skattemässigt överskott manuellt (åsidosätter beräkningen)
                  </label>
                </div>
                {!!j.useManual && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 148px', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontSize: 13, color: '#92620A' }}>Manuellt skattemässigt överskott</div>
                    <input
                      type="number"
                      value={j.manualOverskott || 0}
                      onChange={e => setJv('manualOverskott', parseInt(e.target.value) || 0)}
                      style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 700, padding: '7px 10px', background: '#fff', border: '2px solid #E8D4A0', color: '#1A1A18', width: '100%', textAlign: 'right', outline: 'none', borderRadius: 2 }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 22, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={() => { if (!avstamningKlar) { alert('Svara på alla avstämningsfrågor innan du går vidare.'); return } nav(5) }}
                style={{ padding: '10px 20px', background: avstamningKlar ? '#1A1A18' : '#C8C3BA', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: avstamningKlar ? 'pointer' : 'not-allowed', borderRadius: 2, fontFamily: 'inherit' }}
              >{avstamningKlar ? 'Beräkna min skatt →' : '⚠ Svara på frågorna ovan först'}</button>
              <button onClick={() => openDrawer(`Analysera mina justeringar. Bokfört överskott: ${fmt(bokf)} kr. Optimera periodiseringsfond och räntefördelning.`)} style={{ padding: '10px 16px', background: '#fff', color: '#3A3832', border: '1px solid #C8C3BA', fontSize: 13, fontWeight: 500, cursor: 'pointer', borderRadius: 2, fontFamily: 'inherit' }}>Fråga Normiq</button>
              <button onClick={() => nav(3)} style={{ background: 'none', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#9A9690', cursor: 'pointer', letterSpacing: '.06em' }}>← Tillbaka</button>
            </div>
          </div>
        )}

        {/* ── STEP 5: EGENAVGIFTER ── */}
        {step === 5 && (
          <div style={{ maxWidth: 780, padding: '32px 36px 60px' }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginBottom: 20, letterSpacing: '.06em', cursor: 'pointer' }} onClick={() => nav(4)}>← TILLBAKA</div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 700, marginBottom: 8 }}>
              {skattemassigt < 0 ? 'Underskott — ingen skatt att betala' : 'Din skatt'}
            </h1>
            {skattemassigt < 0 ? (
              <div style={{ background: '#FDF0EE', border: '2px solid #C0392B', borderRadius: 4, padding: '16px 18px', marginBottom: 20 }}>
                <div style={{ fontWeight: 600, color: '#C0392B', marginBottom: 6, fontSize: 14 }}>
                  ⚠ Underskott av aktiv näring: {fmt(Math.abs(skattemassigt))} kr
                </div>
                <div style={{ fontSize: 13, color: '#6A3020', lineHeight: 1.65 }}>
                  Underskottet rullas normalt vidare till nästa år (INK1 ruta 10.2).
                  Men du kan välja att kvitta det mot tjänsteinkomst eller kapitalvinst — det kan sänka skatten redan i år.
                </div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#C0392B', marginTop: 10, padding: '8px 12px', background: 'rgba(192,57,43,.06)', borderLeft: '2px solid #C0392B' }}>
                  Underskott: {fmt(Math.abs(skattemassigt))} kr · SRU: #UPPGIFT 7730 {Math.abs(skattemassigt)}
                </div>

                {/* R45/R46 kvittning */}
                <div style={{ marginTop: 12, borderTop: '1px solid #E8C4BF', paddingTop: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#1A1A18', marginBottom: 10 }}>Vill du kvitta underskottet?</div>

                  {/* R45 — Allmänt avdrag mot tjänst */}
                  <div style={{ background: '#F5F0E8', border: '1px solid #DDD8CF', borderRadius: 4, padding: '12px 14px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                      <input type="checkbox" checked={j.r45_konstnärlig === 1}
                        onChange={e => setJv('r45_konstnärlig', e.target.checked ? 1 : 0)}
                        style={{ width: 15, height: 15, marginTop: 2, cursor: 'pointer', accentColor: '#1A1A18' }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A18' }}>R45 — Kvitta mot tjänsteinkomst (allmänt avdrag)</div>
                        <div style={{ fontSize: 12, color: '#6A6660', marginTop: 2, lineHeight: 1.5 }}>
                          Gäller om du driver <strong>konstnärlig verksamhet</strong> (utan tidsbegränsning) eller
                          om det är ditt <strong>1–5 verksamhetsår</strong> (nystartad).
                          Max 70% av underskottet, dock högst 100 000 kr. → INK1 ruta 14.1
                        </div>
                      </div>
                    </div>
                    {j.r45_konstnärlig === 1 && (() => {
                      const maxR45 = Math.min(Math.round(Math.abs(skattemassigt) * 0.70), 100000)
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, alignItems: 'center', marginTop: 4 }}>
                          <div style={{ fontSize: 12, color: '#6A6660' }}>
                            Max avdrag: <strong>{fmt(maxR45)} kr</strong> (70% × {fmt(Math.abs(skattemassigt))} kr, max 100 000 kr)
                          </div>
                          <input type="number" min={0} max={maxR45}
                            value={j.r45_belopp || maxR45}
                            onChange={e => setJv('r45_belopp', Math.min(parseInt(e.target.value)||0, maxR45))}
                            style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 600, padding: '6px 10px', background: '#fff', border: '1px solid #C8C3BA', textAlign: 'right', borderRadius: 2, outline: 'none', color: '#1A1A18' }} />
                        </div>
                      )
                    })()}
                  </div>

                  {/* R46 — Kvittning i kapital */}
                  <div style={{ background: '#F5F0E8', border: '1px solid #DDD8CF', borderRadius: 4, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                      <input type="checkbox" checked={j.r46_aktiv === 1}
                        onChange={e => setJv('r46_aktiv', e.target.checked ? 1 : 0)}
                        style={{ width: 15, height: 15, marginTop: 2, cursor: 'pointer', accentColor: '#1A1A18' }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A18' }}>R46 — Kvitta mot kapitalvinst</div>
                        <div style={{ fontSize: 12, color: '#6A6660', marginTop: 2, lineHeight: 1.5 }}>
                          Om du har <strong>sålt en näringsfastighet eller näringsbostadsrätt</strong> med vinst,
                          kan underskottet kvittas mot den vinsten. → INK1 kapital
                        </div>
                      </div>
                    </div>
                    {j.r46_aktiv === 1 && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, alignItems: 'center', marginTop: 4 }}>
                        <div style={{ fontSize: 12, color: '#6A6660' }}>Belopp att kvitta (max underskottet {fmt(Math.abs(skattemassigt))} kr)</div>
                        <input type="number" min={0} max={Math.abs(skattemassigt)}
                          value={j.r46_belopp || 0}
                          onChange={e => setJv('r46_belopp', Math.min(parseInt(e.target.value)||0, Math.abs(skattemassigt)))}
                          style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 600, padding: '6px 10px', background: '#fff', border: '1px solid #C8C3BA', textAlign: 'right', borderRadius: 2, outline: 'none', color: '#1A1A18' }} />
                      </div>
                    )}
                  </div>

                  {/* Sammanställning */}
                  {(j.r45_konstnärlig === 1 || j.r46_aktiv === 1) && (() => {
                    const r45val = j.r45_konstnärlig === 1 ? (j.r45_belopp || Math.min(Math.round(Math.abs(skattemassigt)*0.70), 100000)) : 0
                    const r46val = j.r46_aktiv === 1 ? (j.r46_belopp || 0) : 0
                    const kvar = Math.abs(skattemassigt) - r45val - r46val
                    return (
                      <div style={{ marginTop: 10, padding: '10px 12px', background: '#EFF7F2', border: '1px solid #B7D9C8', borderRadius: 2, fontFamily: 'DM Mono, monospace', fontSize: 11 }}>
                        <div style={{ color: '#2D6A4F', fontWeight: 600, marginBottom: 4 }}>Kvittningssammanställning</div>
                        {r45val > 0 && <div>R45 Allmänt avdrag → tjänst: −{fmt(r45val)} kr</div>}
                        {r46val > 0 && <div>R46 Kvittning kapital: −{fmt(r46val)} kr</div>}
                        <div style={{ borderTop: '1px solid #B7D9C8', marginTop: 6, paddingTop: 6, color: kvar > 0 ? '#6A6660' : '#2D6A4F' }}>
                          Kvarstående till INK1 10.2: {fmt(Math.max(0, kvar))} kr
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#6A6660', marginBottom: 20 }}>25%-avdraget justeras mot faktiska avgifter nästa år via NE §G — kom ihåg kopplingen.</div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1, background: '#DDD8CF', border: '1px solid #DDD8CF', marginBottom: 22 }}>
              {[{ l: skattemassigt >= 0 ? 'Skattemässigt överskott' : 'Skattemässigt underskott', v: fmt(Math.abs(skattemassigt)) + ' kr', c: skattemassigt < 0 ? '#C0392B' : undefined }, { l: 'Egenavgifter', v: fmt(ega.sum) + ' kr', c: '#C0392B' }, { l: 'Nedsättning', v: '−' + fmt(ega.ned) + ' kr', c: '#2D6A4F' }, { l: '25%-avdrag', v: '−' + fmt(ega.avd25) + ' kr', c: '#2D6A4F' }, { l: 'Total skatt', v: fmt(ega.tot) + ' kr', c: '#C0392B' }].map(s => (
                <div key={s.l} style={{ background: '#fff', padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9A9690', marginBottom: 5 }}>{s.l}</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: (s as {l:string;v:string;c?:string}).c || '#1A1A18' }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Aktiv/passiv */}
            <Accordion code="EGA §1" name="Aktiv / passiv verksamhet" sum="">
              <div style={{ margin: '8px 14px', padding: '10px 13px', fontSize: 12, background: '#EBF3FA', borderLeft: '2px solid #5A96C8', color: '#2A5070', borderRadius: 2 }}>Aktiv = du arbetar i verksamheten → egenavgifter 28,87%. Passiv → särskild löneskatt 24,26%.</div>
              {skattemassigt > 0 && (
                <div style={{ margin: '0 14px 8px', padding: '8px 12px', background: '#EFF7F2', border: '1px solid #B7D9C8', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked readOnly style={{ width: 14, height: 14, accentColor: '#2D6A4F', cursor: 'default' }} />
                  <span style={{ fontSize: 12, color: '#2D6A4F', fontWeight: 500 }}>Beräkna och utnyttja maximalt avdrag för egenavgifter och särskild löneskatt</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9A9690', marginLeft: 4 }}>Auto</span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid #DDD8CF' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B' }}>E0</span>
                <div style={{ fontSize: 13, color: '#3A3832' }}>Verksamhetstyp</div>
                <select value={passiv ? 'passiv' : 'aktiv'} onChange={e => setPassiv(e.target.value === 'passiv')} style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, padding: '6px 8px', background: '#F5F0E8', border: '1px solid #C8C3BA', color: '#1A1A18', borderRadius: 2, outline: 'none' }}>
                  <option value="aktiv">Aktiv — arbetar i verksamheten</option>
                  <option value="passiv">Passiv — arbetar ej</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid #DDD8CF' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B' }}>KOM</span>
                <div><div style={{ fontSize: 13, color: '#3A3832' }}>Kommunalskattesats</div><div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>Din kommun · Schabloon 32,0% · Ange din faktiska sats</div></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" value={kommunalskatt} onChange={e => setKommunalskatt(parseFloat(e.target.value)||32.0)} step="0.1" style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500, padding: '6px 8px', background: '#F5F0E8', border: '1px solid #C8C3BA', color: '#1A1A18', width: 80, textAlign: 'right', outline: 'none', borderRadius: 2 }} />
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#9A9690' }}>%</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'center', padding: '9px 14px' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B' }}>E1</span>
                <div><div style={{ fontSize: 13, color: '#3A3832' }}>Underlag egenavgifter</div><div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>Skattemässigt överskott · Auto</div></div>
                <input readOnly value={fmt(skattemassigt)} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, padding: '6px 10px', background: '#EFF7F2', border: '1px solid #B7D9C8', color: '#1A1A18', textAlign: 'right', borderRadius: 2, outline: 'none' }} />
              </div>
            </Accordion>

            {/* Spec */}
            <Accordion code="EGA §2" name="Specifikation egenavgifter 2025" sum={fmt(ega.sum) + ' kr'}>
              <table style={{ width: '100%', borderCollapse: 'collapse', margin: '4px 0' }}>
                <thead><tr>{['Avgift','Sats 2025','Belopp'].map(h => <th key={h} style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9A9690', padding: '7px 14px', borderBottom: '1px solid #DDD8CF', textAlign: h === 'Belopp' ? 'right' : 'left', fontWeight: 400, background: '#EDE8DF' }}>{h}</th>)}</tr></thead>
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
              {[{ id: 'E4', label: 'Underlag för 25%-avdraget', val: fmt(skattemassigt - ega.netto), hint: 'Skattemässigt − netto-EGA · Auto', sie: false, calc: true }, { id: 'E5', label: 'Avdrag beräknade egenavgifter (25% × E4)', val: fmt(ega.avd25), hint: '→ Justeras på nästa års NE §G', sie: true, calc: true }, { id: 'E6', label: skattemassigt >= 0 ? 'Slutligt överskott av aktiv näring → INK1 ruta 10.1' : 'Underskott av aktiv näring → INK1 ruta 10.2', val: fmt(Math.abs(ega.slutlig)), hint: '', sie: false, calc: false, result: true }].map(f => (
                <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '42px 1fr 148px', gap: 10, alignItems: 'start', padding: '9px 14px', borderBottom: '1px solid #DDD8CF' }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#C0392B', paddingTop: 2 }}>{f.id}</span>
                  <div><div style={{ fontSize: 13, color: '#3A3832' }}>{f.label}</div>{f.hint && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>{f.hint}</div>}</div>
                  <input readOnly value={f.val} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: f.result ? 700 : 500, padding: '6px 10px', background: f.result ? '#FDF5E6' : f.sie ? '#EFF7F2' : '#EDE8DF', border: `1px solid ${f.result ? '#E8D4A0' : f.sie ? '#B7D9C8' : '#DDD8CF'}`, color: f.result ? '#1A1A18' : '#9A9690', textAlign: 'right', borderRadius: 2, outline: 'none' }} />
                </div>
              ))}
            </Accordion>

            {/* Skatteuträkning */}
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#9A9690', margin: '22px 0 10px', display: 'flex', alignItems: 'center', gap: 9 }}>
              <span>Skatteuträkning 2025</span>
              <div style={{ flex: 1, height: 1, background: '#DDD8CF' }} />
            </div>
            <div style={{ background: '#fff', border: '1px solid #DDD8CF', borderRadius: 4, overflow: 'hidden', marginBottom: 18 }}>
              {[{ l: 'Slutligt överskott (E6)', sub: 'Underlag kommunalskatt', v: fmt(ega.slutlig) + ' kr', c: '#2D6A4F' }, { l: `Kommunal inkomstskatt (${kommunalskatt.toFixed(1).replace('.',',')}%)`, sub: 'Din kommunalskattesats', v: '−' + fmt(ega.kom) + ' kr', c: '#C0392B' }, { l: 'Begravningsavgift (0,279%)', sub: '', v: '−' + fmt(ega.beg) + ' kr', c: '#C0392B' }].map((row, i) => (
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
              {(ega.statlig||0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid #DDD8CF', background: '#FDF5E6' }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#92620A', fontWeight: 500 }}>Statlig inkomstskatt (20%)</div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 1 }}>På belopp över 598 500 kr · Överskjutande: {fmt(Math.max(0,(ega.slutlig||0)-598500))} kr</div>
                  </div>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 500, color: '#C0392B' }}>−{fmt(ega.statlig||0)} kr</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#EDE8DF', borderTop: '2px solid #C8C3BA' }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700 }}>Total skatt & avgifter 2025</span>
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
              <button onClick={() => nav(6)} style={{ padding: '10px 20px', background: '#1A1A18', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', borderRadius: 2, fontFamily: 'inherit' }}>Klar att skicka in →</button>
              <button onClick={() => openDrawer(`Ge råd om hur jag kan sänka skatten. Överskott: ${fmt(skattemassigt)} kr. Total skatt: ${fmt(ega.tot)} kr.`)} style={{ padding: '10px 16px', background: '#fff', color: '#3A3832', border: '1px solid #C8C3BA', fontSize: 13, fontWeight: 500, cursor: 'pointer', borderRadius: 2, fontFamily: 'inherit' }}>Fråga Normiq</button>
              <button onClick={() => nav(4)} style={{ background: 'none', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#9A9690', cursor: 'pointer', letterSpacing: '.06em' }}>← Tillbaka</button>
            </div>
          </div>
        )}

        {/* ── STEP 6: GRANSKA ── */}
        {step === 6 && (
          <div style={{ maxWidth: 780, padding: '32px 36px 60px' }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginBottom: 20, letterSpacing: '.06em', cursor: 'pointer' }} onClick={() => nav(5)}>← TILLBAKA</div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 700, marginBottom: 8 }}>Klar! Skicka in till Skatteverket</h1>
            <div style={{ background: '#EFF7F2', border: '1px solid #B7D9C8', borderRadius: 4, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#1A4A30', lineHeight: 1.65 }}>
              <strong>Så skickar du in:</strong> Ladda ner de två filerna nedan → gå till skatteverket.se → Inkomstdeklaration 1 → Ladda upp fil → välj båda filerna (BLANKETTER.SRU + INFO.SRU).
              <a href="https://skatteverket.se/privat/deklaration" target="_blank" rel="noopener" style={{ color: '#2D6A4F', marginLeft: 8, fontWeight: 500 }}>Öppna Skatteverket ↗</a>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: '#DDD8CF', border: '1px solid #DDD8CF', marginBottom: 22 }}>
              {[{ l: ega.slutlig >= 0 ? 'Överskott av näring' : 'Underskott av näring', v: fmt(Math.abs(ega.slutlig)) + ' kr', c: ega.slutlig < 0 ? '#C0392B' : undefined }, { l: 'Egenavgifter', v: fmt(ega.netto) + ' kr', c: '#C0392B' }, { l: 'Kommunalskatt', v: fmt(ega.kom) + ' kr', c: '#C0392B' }, { l: 'Total skatt & avg.', v: fmt(ega.tot) + ' kr', c: '#C0392B' }].map(s => (
                <div key={s.l} style={{ background: '#fff', padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9A9690', marginBottom: 5 }}>{s.l}</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: (s as {l:string;v:string;c?:string}).c || '#1A1A18' }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Deklarationsuppgifter */}
            <div style={{ background: '#fff', border: '1px solid #DDD8CF', borderRadius: 4, marginBottom: 18, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: '#EDE8DF', borderBottom: '1px solid #DDD8CF' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9A9690' }}>Uppgifter om verksamheten</span>
              </div>

              {/* Verksamhetens art */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 12, padding: '11px 14px', borderBottom: '1px solid #DDD8CF', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>Verksamhetens art (7020) <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#C0392B', background: '#FDF0EE', border: '1px solid #E8C4BF', padding: '1px 6px', marginLeft: 6 }}>OBLIGATORISK</span></div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>T.ex. "Artistisk verksamhet", "Konsulttjänster", "Handel"</div>
                </div>
                <input
                  type="text"
                  value={verksamhetensArt}
                  onChange={e => setVerksamhetensArt(e.target.value)}
                  placeholder="Ange verksamhetens art..."
                  style={{ fontFamily: 'inherit', fontSize: 13, padding: '7px 10px', background: verksamhetensArt ? '#EFF7F2' : '#FDF0EE', border: `1px solid ${verksamhetensArt ? '#B7D9C8' : '#E8C4BF'}`, color: '#1A1A18', outline: 'none', borderRadius: 2, width: '100%' }}
                />
              </div>

              {/* Uppdragstagare */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: '1px solid #DDD8CF', cursor: 'pointer' }} onClick={() => setUppdragstagare(v => !v)}>
                <input type="checkbox" checked={uppdragstagare} onChange={e => setUppdragstagare(e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
                <div>
                  <div style={{ fontSize: 13 }}>Uppdragstagare (t.ex. redovisningskonsult) har biträtt vid upprättandet</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>Uppgift för byrån — syns i deklarationsunderlaget</div>
                </div>
              </div>

              {/* Saknar tillgångar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', cursor: 'pointer', background: saknarTillgangar ? '#FDF5E6' : 'transparent' }} onClick={() => setSaknarTillgangar(v => !v)}>
                <input type="checkbox" checked={saknarTillgangar} onChange={e => setSaknarTillgangar(e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
                <div>
                  <div style={{ fontSize: 13 }}>Verksamheten saknar tillgångar och skulder (B1)</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 2 }}>
                    {saknarTillgangar ? '⚠ Kryssad in — SRU: #UPPGIFT 7100 X' : 'Auto-detekterat från balansräkning — ändra vid behov'}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#9A9690', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 9 }}>
              <span>SRU-förhandsvisning</span><div style={{ flex: 1, height: 1, background: '#DDD8CF' }} />
            </div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, background: '#fff', border: '1px solid #DDD8CF', borderRadius: 4, padding: '16px 18px', marginBottom: 18, whiteSpace: 'pre', overflowX: 'auto', lineHeight: 1.9, color: '#6A6660' }}>
              {generateSRU().blanketter.split('\n').filter(l => !l.startsWith(';')).join('\n')}
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
              {/* ── SRU-VALIDERING ── */}
              {(() => {
                const v = validateSRU()
                return (
                  <div style={{ marginBottom: 16, border: `2px solid ${v.ok && v.warnings.length === 0 ? '#B7D9C8' : v.errors.length > 0 ? '#C0392B' : '#E8D4A0'}`, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', background: v.ok && v.warnings.length === 0 ? '#EFF7F2' : v.errors.length > 0 ? '#FDF0EE' : '#FDF5E6', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 16 }}>{v.errors.length > 0 ? '⛔' : v.warnings.length > 0 ? '⚠' : '✅'}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: v.errors.length > 0 ? '#C0392B' : v.warnings.length > 0 ? '#92620A' : '#2D6A4F' }}>
                          {v.errors.length > 0
                            ? `${v.errors.length} fel — SRU-filen kan inte skickas in`
                            : v.warnings.length > 0
                              ? `${v.warnings.length} varning${v.warnings.length > 1 ? 'ar' : ''} — granska innan inlämning`
                              : 'SRU-filen är redo att skicka in'}
                        </div>
                        {(v.errors.length > 0 || v.warnings.length > 0) && (
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9A9690', marginTop: 1 }}>
                            {v.ok ? '' : 'Åtgärda felen nedan innan du laddar ner filen'}
                          </div>
                        )}
                      </div>
                    </div>
                    {v.errors.length > 0 && (
                      <div style={{ padding: '8px 14px', borderTop: '1px solid #E8C4BF' }}>
                        {v.errors.map((e, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 12, color: '#8B0000', borderBottom: i < v.errors.length - 1 ? '1px solid #F5DADA' : 'none' }}>
                            <span style={{ flexShrink: 0 }}>⛔</span>
                            <span>{e}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {v.warnings.length > 0 && (
                      <div style={{ padding: '8px 14px', borderTop: `1px solid ${v.errors.length > 0 ? '#F5DADA' : '#E8D4A0'}` }}>
                        {v.warnings.map((w, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 12, color: '#92620A', borderBottom: i < v.warnings.length - 1 ? '1px solid #F5E6C0' : 'none' }}>
                            <span style={{ flexShrink: 0 }}>⚠</span>
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              {sieData && (
                <button
                  onClick={saveDeklaration}
                  disabled={saving}
                  style={{ padding: '10px 16px', background: saving ? '#EDE8DF' : '#2D6A4F', color: saving ? '#9A9690' : '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: saving ? 'default' : 'pointer', borderRadius: 2, fontFamily: 'inherit' }}
                >
                  {saving ? 'Sparar...' : deklarationId ? '✓ Spara ändringar' : '↑ Spara deklaration'}
                </button>
              )}
              <button onClick={downloadSRU} style={{ padding: '10px 20px', background: '#1A1A18', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', borderRadius: 2, fontFamily: 'inherit' }}>↓ Ladda ner BLANKETTER.SRU + INFO.SRU</button>
              <button onClick={downloadPDF} style={{ padding: '10px 16px', background: '#fff', color: '#3A3832', border: '1px solid #C8C3BA', fontSize: 13, fontWeight: 500, cursor: 'pointer', borderRadius: 2, fontFamily: 'inherit' }}>↓ PDF-underlag (öppnas för utskrift)</button>
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
