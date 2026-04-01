import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      companyName, orgNumber, fiscalYearStart, fiscalYearEnd,
      bokfortOverskott, skattemassigt, ega, s3, j, jWithUtland,
      mapping, bs, verksamhetensArt, uppdragstagare, saknarTillgangar,
      passiv, kommunalskatt, sruContent, flags,
    } = body

    const today = new Date().toLocaleDateString('sv-SE')
    const inkomstar = fiscalYearStart?.substring(0, 4) || '2025'
    const fmtDate = (s: string) => s ? s.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : ''
    const fmt = (n: number | undefined | null) => {
      if (n == null || n === 0) return ''
      return Math.round(Math.abs(n)).toLocaleString('sv-SE').replace(/,/g, ' ')
    }
    const fmtSgn = (n: number) => n < 0 ? '−' + fmt(Math.abs(n)) : fmt(n)

    // Computed values matching NE blankett
    const bokf = Math.round(bokfortOverskott || 0)
    const r13 = Math.round((j?.r31 || 0) + (j?.r32 || 0) + (j?.r33 || 0) + (j?.r34 || 0) - (j?.r35 || 0))
    const r14h = Math.round(j?.r14h || 0)
    const r16hk = Math.round((j?.hemmakontor || 0) + (j?.hemmakontor_internet || 0))
    const resorAvd = Math.round((j?.resor_mil || 0) * 25 + (j?.resor_trakt_manuell || 0 || (j?.resor_trakt || 0) * 290) + (jWithUtland?.utland_totalt || 0))
    const r17 = bokf + (s3?.dA || 0) + (s3?.dH || 0) - r16hk - resorAvd - r14h
    const r29 = r17 + (s3?.dD || 0) + (s3?.dE || 0)
    const r30 = j?.useRF ? Math.round(j?.r19 || 0) : 0
    const r31neg = j?.useRF ? Math.round(j?.r20 || 0) : 0
    const r32pf = Math.round((j?.r11 || 0) + (j?.r12 || 0))
    const r33 = r29 - r30 + r31neg + r32pf
    const r34pf = Math.round(j?.r10 || 0)
    const r35 = r33 - r34pf
    const r36exp = Math.round(j?.r14 || 0)
    const r37exp = Math.round(j?.r15 || 0)
    const r38pen = Math.round(j?.r24 || 0)
    const r39slp = r38pen > 0 ? Math.round(r38pen * 0.2426) : 0
    const r40medg = Math.round(j?.r28 || 0)
    const r41paf = Math.round(j?.r29 || 0)
    const r42 = r35 - r36exp + r37exp - r38pen - r39slp + r40medg - r41paf
    const r43avd = r42 > 0 ? Math.floor(ega?.slutlig / 3) : 0
    const r44sjuk = Math.round(j?.r25 || 0)
    const r47 = ega?.slutlig || 0
    const isOverskott = r47 >= 0

    // BS values
    const bsGet = (from: string, to: string, arr: {acc:string;amt:number}[]) =>
      Math.round(Math.abs((arr||[]).filter(l => l.acc >= from && l.acc <= to).reduce((s:number,l:{amt:number}) => s+l.amt, 0)))
    const al = bs?.al || []
    const ll = bs?.ll || []

    const B9kassa = bsGet('1900','1999', al)
    const B10ek = Math.round((ll||[]).filter((l:{acc:string}) => l.acc >= '2000' && l.acc <= '2099').reduce((s:number,l:{amt:number}) => s+l.amt, 0))

    // NE Row component
    const NERow = (code: string, label: string, value: number | null, sign: string = '', indent = false) => {
      const hasValue = value != null && value !== 0
      return `
        <tr>
          <td class="code">${code}</td>
          <td class="label${indent ? ' indent' : ''}">${label}</td>
          <td class="sign">${sign}</td>
          <td class="amount">${hasValue ? fmt(value!) : ''}</td>
        </tr>`
    }

    const TotalRow = (code: string, label: string, value: number, pos = true) => `
        <tr class="total-row">
          <td class="code">${code}</td>
          <td class="label" colspan="2">${label}</td>
          <td class="amount ${pos && value > 0 ? 'pos' : value < 0 ? 'neg' : ''}">${value !== 0 ? (value > 0 ? '+' : '−') + fmt(Math.abs(value)) : '0'}</td>
        </tr>`

    const html = `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="UTF-8">
<title>NE ${inkomstar} — ${companyName}</title>
<style>
  @page { margin: 14mm 12mm 12mm; size: A4; }
  @page :first { margin-top: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #000; }
  
  .page-break { page-break-before: always; padding-top: 10mm; }
  
  /* ── HEADER ── */
  .skv-header { margin-bottom: 6px; }
  .skv-name { font-size: 11pt; font-weight: 900; font-style: italic; }
  .blankett-title { font-size: 10pt; font-weight: 700; margin: 2px 0 1px; }
  .blankett-sub { font-size: 7.5pt; color: #333; }
  .header-row { display: flex; justify-content: space-between; border-bottom: 1.5px solid #000; padding-bottom: 4px; margin-bottom: 5px; }
  .header-right { text-align: right; font-size: 7pt; color: #555; }
  
  /* ── META ── */
  .meta-grid { display: grid; grid-template-columns: 90px 90px 1fr 110px; gap: 0; border: 1px solid #000; margin-bottom: 4px; }
  .meta-cell { border-right: 1px solid #000; padding: 2px 4px; min-height: 20px; }
  .meta-cell:last-child { border-right: none; }
  .meta-label { font-size: 6pt; color: #555; display: block; }
  .meta-value { font-size: 8pt; font-weight: 600; }
  .meta-wide { grid-column: 1/4; border-right: 1px solid #000; padding: 2px 4px; }
  .meta-full { grid-column: 1/5; border-right: none; padding: 2px 4px; }

  /* ── CHECKBOXES ── */
  .check-row { border: 1px solid #000; border-top: none; padding: 2px 4px; display: flex; gap: 14px; font-size: 7pt; align-items: center; margin-bottom: 4px; }
  .box { display: inline-block; width: 9px; height: 9px; border: 1px solid #000; text-align: center; line-height: 9px; font-size: 7pt; vertical-align: middle; margin-right: 3px; }

  /* ── TWO COLUMN ── */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .section-title { font-size: 7pt; font-weight: 700; background: #D0D0D0; padding: 2px 4px; margin-bottom: 0; border: 1px solid #999; border-bottom: none; text-transform: uppercase; letter-spacing: .03em; }
  .subsection { font-size: 6.5pt; font-style: italic; color: #444; background: #E8E8E8; padding: 1px 4px; border: 1px solid #BBB; border-top: none; border-bottom: none; }

  /* ── NE TABLE ── */
  table.ne { width: 100%; border-collapse: collapse; }
  table.ne td { border: 1px solid #BBBBBB; border-top: none; padding: 2px 3px; }
  table.ne tr:first-child td { border-top: 1px solid #BBBBBB; }
  table.ne td.code { width: 22px; font-size: 6.5pt; font-weight: 700; color: #CC0000; text-align: center; background: #F5F5F5; border-right: 1px solid #BBBBBB; }
  table.ne td.label { font-size: 7.5pt; padding-left: 4px; }
  table.ne td.label.indent { padding-left: 10px; font-size: 7pt; color: #222; }
  table.ne td.sign { width: 12px; text-align: center; font-size: 9pt; font-weight: 700; color: #555; border-left: none; border-right: none; }
  table.ne td.amount { width: 75px; text-align: right; font-family: 'Courier New', monospace; font-size: 8pt; font-weight: 600; padding-right: 4px; background: #FAFAFA; }
  tr.total-row td { background: #E0E0E0 !important; font-weight: 700; }
  tr.total-row td.amount { font-size: 9pt; }
  td.amount.pos { color: #005500; }
  td.amount.neg { color: #CC0000; }

  /* ── SIDE 2 ROWS ── */
  .s2-row { display: flex; align-items: stretch; border: 1px solid #BBB; border-top: none; min-height: 16px; }
  .s2-row:first-child { border-top: 1px solid #BBB; }
  .s2-code { font-size: 6.5pt; font-weight: 700; color: #CC0000; width: 22px; min-width: 22px; text-align: center; border-right: 1px solid #BBB; background: #F5F5F5; display: flex; align-items: center; justify-content: center; }
  .s2-label { font-size: 7.5pt; flex: 1; padding: 2px 4px; display: flex; align-items: center; line-height: 1.3; }
  .s2-sign { font-size: 9pt; font-weight: 700; color: #555; width: 13px; display: flex; align-items: center; justify-content: center; border-left: none; border-right: none; }
  .s2-amount { font-family: 'Courier New', monospace; font-size: 8pt; font-weight: 600; width: 80px; text-align: right; padding: 2px 4px; border-left: 1px solid #BBB; display: flex; align-items: center; justify-content: flex-end; background: #FAFAFA; }
  .s2-total { background: #E0E0E0 !important; }
  .s2-total .s2-label { font-weight: 700; }
  .s2-total .s2-amount { font-size: 9.5pt; font-weight: 700; }
  .s2-highlight { background: #F0F7FF !important; border: 2px solid #0055AA !important; }
  .s2-highlight .s2-amount { font-size: 11pt !important; font-weight: 900 !important; }

  /* ── BILAGA TABLES ── */
  .bilaga-header { display: flex; justify-content: space-between; border-bottom: 1.5px solid #000; padding-bottom: 3px; margin-bottom: 5px; margin-top: 4px; }
  .bilaga-title { font-size: 9pt; font-weight: 700; }
  table.bilaga { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
  table.bilaga td, table.bilaga th { border: 1px solid #BBB; padding: 2px 5px; }
  table.bilaga th { background: #E0E0E0; font-size: 7pt; text-align: left; font-weight: 700; }
  table.bilaga td.num { text-align: right; font-family: 'Courier New', monospace; font-weight: 600; }
  table.bilaga td.fk { color: #CC0000; font-size: 6.5pt; font-weight: 700; width: 28px; text-align: center; background: #F5F5F5; }

  /* ── ÖVRIGA UPPGIFTER ── */
  .ovriga { margin-top: 6px; }
  .ovriga-row { display: flex; border: 1px solid #BBB; border-top: none; font-size: 7.5pt; }
  .ovriga-row:first-child { border-top: 1px solid #BBB; }
  .ovriga-num { width: 18px; color: #CC0000; font-weight: 700; text-align: center; padding: 2px; border-right: 1px solid #BBB; font-size: 7pt; display: flex; align-items: center; justify-content: center; background: #F5F5F5; }
  .ovriga-label { flex: 1; padding: 2px 4px; }
  .ovriga-val { width: 80px; font-family: 'Courier New', monospace; font-weight: 600; text-align: right; padding: 2px 5px; border-left: 1px solid #BBB; background: #FAFAFA; }
  
  .disclaimer { font-size: 6pt; color: #777; margin-top: 6px; border-top: 1px solid #CCC; padding-top: 3px; }
  .normiq-stamp { text-align: right; font-size: 6pt; color: #AAA; }
</style>
</head>
<body>

<!-- ═══════ SIDA 1 ═══════ -->
<div class="normiq-stamp">Framställd av Normiq Deklarera · normiq.se · ${today}</div>

<div class="header-row">
  <div>
    <div class="skv-name">Skatteverket</div>
    <div class="blankett-title">Inkomst av näringsverksamhet · Enskilda näringsidkare NE</div>
    <div class="blankett-sub">Blanketten ska lämnas av fysisk person och dödsbo som bedriver enskild näringsverksamhet. Ange belopp i hela kronor.</div>
  </div>
  <div class="header-right">NEM-1-13-2025P4</div>
</div>

<div style="display:grid;grid-template-columns:85px 85px 1fr 120px;border:1px solid #000;margin-bottom:2px">
  <div style="border-right:1px solid #000;padding:2px 4px">
    <span class="meta-label">Räkenskapsår fr.o.m.</span>
    <div class="meta-value">${fmtDate(fiscalYearStart)}</div>
  </div>
  <div style="border-right:1px solid #000;padding:2px 4px">
    <span class="meta-label">T.o.m.</span>
    <div class="meta-value">${fmtDate(fiscalYearEnd)}</div>
  </div>
  <div style="border-right:1px solid #000;padding:2px 4px">
    <span class="meta-label">Namn</span>
    <div class="meta-value">${companyName || ''}</div>
  </div>
  <div style="padding:2px 4px">
    <span class="meta-label">Personnummer</span>
    <div class="meta-value">${orgNumber || ''}</div>
  </div>
</div>
<div style="border:1px solid #000;border-top:none;padding:2px 4px;margin-bottom:2px">
  <span class="meta-label">Verksamhetens art</span>
  <div class="meta-value">${verksamhetensArt || ''}</div>
</div>
<div style="border:1px solid #000;border-top:none;padding:2px 4px;margin-bottom:2px">
  <span class="meta-label">Datum då blanketten fylls i</span>
  <div class="meta-value">${today}</div>
</div>
<div class="check-row">
  <span><span class="box">${passiv ? 'X' : ''}</span>Jag har bedrivit passiv näringsverksamhet</span>
  <span><span class="box"></span>Jag har inte tillämpat reglerna om förenklat årsbokslut</span>
  <span><span class="box"></span>Självständig näringsverksamhet bedrivs utanför EES</span>
</div>
<div style="border:1px solid #000;border-top:none;padding:2px 4px;margin-bottom:4px;font-size:7.5pt">
  Uppdragstagare (t.ex. redovisningskonsult) har biträtt vid upprättandet av årsbokslutet &nbsp;
  <strong>Ja</strong> <span class="box">${uppdragstagare ? 'X' : ''}</span> &nbsp;
  <strong>Nej</strong> <span class="box">${!uppdragstagare ? 'X' : ''}</span>
</div>

<div class="two-col">

<!-- BALANSRÄKNING -->
<div>
  <div class="section-title">Balansräkning / räkenskapsschema</div>
  ${saknarTillgangar ? `<div style="padding:4px;font-size:7.5pt;border:1px solid #999;border-top:none;font-weight:600">Verksamheten saknar tillgångar och skulder</div>` : `
  <div class="subsection">Anläggningstillgångar</div>
  <table class="ne">
    ${NERow('B1','Immateriella anläggningstillgångar', bsGet('1000','1099',al) || null, '+')}
    ${NERow('B2','Byggnader och markanläggningar', bsGet('1100','1179',al) || null, '+')}
    ${NERow('B3','Mark och andra tillgångar som inte får skrivas av', bsGet('1180','1199',al) || null, '+')}
    ${NERow('B4','Maskiner och inventarier', (Math.max(0, bsGet('1200','1259',al) - bsGet('1260','1299',al))) || null, '+')}
    ${NERow('B5','Övriga anläggningstillgångar', bsGet('1300','1399',al) || null, '+')}
  </table>
  <div class="subsection">Omsättningstillgångar</div>
  <table class="ne">
    ${NERow('B6','Varulager', bsGet('1400','1499',al) || null, '+')}
    ${NERow('B7','Kundfordringar', bsGet('1500','1599',al) || null, '+')}
    ${NERow('B8','Övriga fordringar', bsGet('1600','1899',al) || null, '+')}
    ${NERow('B9','Kassa och bank', B9kassa || null, '+')}
  </table>
  <div class="subsection">Eget kapital</div>
  <table class="ne">
    ${NERow('B10','Eget kapital (tillgångar - skulder)', B10ek || null, '')}
  </table>
  <div class="subsection">Obeskattade reserver</div>
  <table class="ne">
    ${NERow('B11','Obeskattade reserver', bsGet('2100','2199',ll) || null, '')}
  </table>
  <div class="subsection">Avsättningar</div>
  <table class="ne">
    ${NERow('B12','Avsättningar', bsGet('2200','2299',ll) || null, '')}
  </table>
  <div class="subsection">Skulder</div>
  <table class="ne">
    ${NERow('B13','Låneskulder', bsGet('2300','2399',ll) || null, '')}
    ${NERow('B14','Skatteskulder', bsGet('2500','2599',ll) || null, '')}
    ${NERow('B15','Leverantörsskulder', bsGet('2400','2449',ll) || null, '')}
    ${NERow('B16','Övriga skulder', bsGet('2600','2999',ll) || null, '')}
  </table>
  `}
</div>

<!-- RESULTATRÄKNING -->
<div>
  <div class="section-title">Resultaträkning / räkenskapsschema</div>
  <div class="subsection">Intäkter</div>
  <table class="ne">
    ${NERow('R1', 'Försäljning och utfört arbete samt övriga momspliktiga intäkter', mapping?.fields?.R1?.value || null, '+')}
    ${NERow('R2', 'Momsfria intäkter', mapping?.fields?.R2?.value || null, '+')}
    ${NERow('R3', 'Bil- och bostadsförmån m.m.', null, '+')}
    ${NERow('R4', 'Ränteintäkter m.m.', mapping?.fields?.R3?.value || null, '+')}
  </table>
  <div class="subsection">Kostnader</div>
  <table class="ne">
    ${NERow('R5', 'Varor, material och tjänster', mapping?.fields?.R10?.value || null, '−')}
    ${NERow('R6', 'Övriga externa kostnader', mapping?.fields?.R15?.value || null, '−')}
    ${NERow('R7', 'Anställd personal', (mapping?.fields?.R11?.value||0)+(mapping?.fields?.R12?.value||0) || null, '−')}
    ${NERow('R8', 'Räntekostnader m.m.', mapping?.fields?.R17?.value || null, '−')}
  </table>
  <div class="subsection">Avskrivningar</div>
  <table class="ne">
    ${NERow('R9', 'Avskrivningar och nedskrivningar byggnader och markanläggningar', null, '−')}
    ${NERow('R10', 'Avskrivningar och nedskrivningar maskiner och inventarier och immateriella tillgångar', mapping?.fields?.R16?.value || null, '−')}
  </table>
  <table class="ne" style="margin-top:2px">
    <tr class="total-row">
      <td class="code">R11</td>
      <td class="label" colspan="2">= &nbsp; Bokfört resultat (förs över till sidan 2 R12) (+/−)</td>
      <td class="amount ${bokf >= 0 ? 'pos' : 'neg'}">${bokf >= 0 ? '+' : '−'}${fmt(Math.abs(bokf))}</td>
    </tr>
  </table>
  <div style="font-size:6pt;color:#666;margin-top:3px">Ska inte fyllas i av den som upprättar förenklat årsbokslut.</div>
</div>
</div>

<!-- ═══════ SIDA 2 ═══════ -->
<div class="page-break">
<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #000;padding-bottom:3px;margin-bottom:4px">
  <div style="font-size:9pt;font-weight:700">Skattemässiga justeringar av bokfört resultat</div>
  <div style="font-size:7pt;color:#555">NEM-2-13-2025P4 &nbsp; Personnummer: ${orgNumber}</div>
</div>

<div class="s2-row s2-total">
  <div class="s2-code">R12</div>
  <div class="s2-label">= Bokfört resultat (förs över från R11 sidan 1) (+/−)</div>
  <div class="s2-sign">=</div>
  <div class="s2-amount ${bokf >= 0 ? 'pos' : 'neg'}">${bokf >= 0 ? '+' : '−'}${fmt(Math.abs(bokf))}</div>
</div>

${r13 !== 0 ? `<div class="s2-row"><div class="s2-code">R13</div><div class="s2-label">Bokförda kostnader som inte ska dras av</div><div class="s2-sign">+</div><div class="s2-amount">${fmt(r13)}</div></div>` : '<div class="s2-row"><div class="s2-code">R13</div><div class="s2-label">Bokförda kostnader som inte ska dras av</div><div class="s2-sign">+</div><div class="s2-amount"></div></div>'}
${r14h > 0 ? `<div class="s2-row"><div class="s2-code">R14</div><div class="s2-label">Bokförda intäkter som inte ska tas upp</div><div class="s2-sign">−</div><div class="s2-amount">${fmt(r14h)}</div></div>` : '<div class="s2-row"><div class="s2-code">R14</div><div class="s2-label">Bokförda intäkter som inte ska tas upp</div><div class="s2-sign">−</div><div class="s2-amount"></div></div>'}
<div class="s2-row"><div class="s2-code">R15</div><div class="s2-label">Intäkter som inte bokförts men som ska tas upp</div><div class="s2-sign">+</div><div class="s2-amount"></div></div>
${r16hk > 0 ? `<div class="s2-row"><div class="s2-code">R16</div><div class="s2-label">Kostnader som inte bokförts men som ska dras av</div><div class="s2-sign">−</div><div class="s2-amount">${fmt(r16hk)}</div></div>` : '<div class="s2-row"><div class="s2-code">R16</div><div class="s2-label">Kostnader som inte bokförts men som ska dras av</div><div class="s2-sign">−</div><div class="s2-amount"></div></div>'}

<div class="s2-row s2-total"><div class="s2-code">R17</div><div class="s2-label">= Sammanlagt resultat av verksamheten</div><div class="s2-sign">=</div><div class="s2-amount">${r17 >= 0 ? '+' : '−'}${fmt(Math.abs(r17))}</div></div>

<div class="s2-row"><div class="s2-code">R22</div><div class="s2-label">Övriga skattemässiga justeringar, kostnader min andel (t.ex. utgifter för resor till och från arbetet)</div><div class="s2-sign">−</div><div class="s2-amount">${resorAvd > 0 ? fmt(resorAvd) : ''}</div></div>
<div class="s2-row"><div class="s2-code">R23</div><div class="s2-label">Övriga skattemässiga justeringar, intäkter min andel</div><div class="s2-sign">+</div><div class="s2-amount"></div></div>
<div class="s2-row"><div class="s2-code">R21</div><div class="s2-label">Min andel av resultatet från verksamheten/erna</div><div class="s2-sign">=</div><div class="s2-amount">${r17 >= 0 ? '+' : '−'}${fmt(Math.abs(r17))}</div></div>
${(j?.r21||0) > 0 ? `<div class="s2-row"><div class="s2-code">R24</div><div class="s2-label">Outnyttjat underskott från föregående beskattningsår</div><div class="s2-sign">−</div><div class="s2-amount">${fmt(j.r21)}</div></div>` : ''}
<div class="s2-row"><div class="s2-code">R25</div><div class="s2-label">Skogsavdrag/substansminskningsavdrag enligt blankett N8</div><div class="s2-sign">−</div><div class="s2-amount"></div></div>

<div class="s2-row s2-total"><div class="s2-code">R29</div><div class="s2-label">= Överskott (+)/Underskott (−) före räntefördelning</div><div class="s2-sign">=</div><div class="s2-amount ${r29 >= 0 ? 'pos' : 'neg'}">${r29 >= 0 ? '+' : '−'}${fmt(Math.abs(r29))}</div></div>

${r30 > 0 ? `<div class="s2-row"><div class="s2-code">R30</div><div class="s2-label">Positiv räntefördelning, dock högst överskott vid R29 (beloppet förs även till p. 11.1 på INK1)</div><div class="s2-sign">−</div><div class="s2-amount">${fmt(r30)}</div></div>` : '<div class="s2-row"><div class="s2-code">R30</div><div class="s2-label">Positiv räntefördelning (beloppet förs även till p. 11.1 på INK1)</div><div class="s2-sign">−</div><div class="s2-amount"></div></div>'}
${r31neg > 0 ? `<div class="s2-row"><div class="s2-code">R31</div><div class="s2-label">Negativ räntefördelning (beloppet förs även till p. 11.2 på INK1)</div><div class="s2-sign">+</div><div class="s2-amount">${fmt(r31neg)}</div></div>` : ''}
${r32pf > 0 ? `<div class="s2-row"><div class="s2-code">R32</div><div class="s2-label">Återföring av periodiseringsfond</div><div class="s2-sign">+</div><div class="s2-amount">${fmt(r32pf)}</div></div>` : ''}

<div class="s2-row s2-total"><div class="s2-code">R33</div><div class="s2-label">= Överskott (+)/Underskott (−) före avsättning till periodiseringsfond</div><div class="s2-sign">=</div><div class="s2-amount ${r33 >= 0 ? 'pos' : 'neg'}">${r33 >= 0 ? '+' : '−'}${fmt(Math.abs(r33))}</div></div>

${r34pf > 0 ? `<div class="s2-row"><div class="s2-code">R34</div><div class="s2-label">Avsättning till periodiseringsfond, dock högst 30% av överskott vid R33</div><div class="s2-sign">−</div><div class="s2-amount">${fmt(r34pf)}</div></div>` : ''}
<div class="s2-row s2-total"><div class="s2-code">R35</div><div class="s2-label">= Överskott (+)/Underskott (−) före ökning av expansionsfond</div><div class="s2-sign">=</div><div class="s2-amount ${r35 >= 0 ? 'pos' : 'neg'}">${r35 >= 0 ? '+' : '−'}${fmt(Math.abs(r35))}</div></div>

${r36exp > 0 ? `<div class="s2-row"><div class="s2-code">R36</div><div class="s2-label">Ökning av expansionsfond (beloppet förs även till p. 12.1 på INK1)</div><div class="s2-sign">−</div><div class="s2-amount">${fmt(r36exp)}</div></div>` : ''}
${r37exp > 0 ? `<div class="s2-row"><div class="s2-code">R37</div><div class="s2-label">Minskning av expansionsfond (beloppet förs även till p. 12.2 på INK1)</div><div class="s2-sign">+</div><div class="s2-amount">${fmt(r37exp)}</div></div>` : ''}
${r38pen > 0 ? `<div class="s2-row"><div class="s2-code">R38</div><div class="s2-label">Egna pensionspremier eller inbetalning på pensionssparkonto i näringsverksamheten (→ INK1 p. 10.6)</div><div class="s2-sign">−</div><div class="s2-amount">${fmt(r38pen)}</div></div>` : ''}
${r39slp > 0 ? `<div class="s2-row"><div class="s2-code">R39</div><div class="s2-label">Särskild löneskatt på pensionssparavdrag i R38</div><div class="s2-sign">−</div><div class="s2-amount">${fmt(r39slp)}</div></div>` : ''}
${r40medg > 0 ? `<div class="s2-row"><div class="s2-code">R40</div><div class="s2-label">Medgivna avdrag för egenavgifter och särskild löneskatt föregående beskattningsår (R43 i föregående års blankett)</div><div class="s2-sign">+</div><div class="s2-amount">${fmt(r40medg)}</div></div>` : ''}
${r41paf > 0 ? `<div class="s2-row"><div class="s2-code">R41</div><div class="s2-label">Påförda egenavgifter och särskild löneskatt föregående beskattningsår</div><div class="s2-sign">−</div><div class="s2-amount">${fmt(r41paf)}</div></div>` : ''}

<div class="s2-row s2-total"><div class="s2-code">R42</div><div class="s2-label">= Överskott (+)/Underskott (−) före årets avdrag för egenavgifter och SLP</div><div class="s2-sign">=</div><div class="s2-amount ${r42 >= 0 ? 'pos' : 'neg'}">${r42 >= 0 ? '+' : '−'}${fmt(Math.abs(r42))}</div></div>

${r43avd > 0 ? `<div class="s2-row"><div class="s2-code">R43</div><div class="s2-label">Årets beräknade avdrag för egenavgifter och särskild löneskatt</div><div class="s2-sign">−</div><div class="s2-amount">${fmt(r43avd)}</div></div>` : ''}
${r44sjuk > 0 ? `<div class="s2-row"><div class="s2-code">R44</div><div class="s2-label">Sjukpenning som hör till denna näringsverksamhet</div><div class="s2-sign">+</div><div class="s2-amount">${fmt(r44sjuk)}</div></div>` : ''}

${isOverskott ? `
<div class="s2-row s2-highlight" style="border:2px solid #005500;background:#E8F5E9">
  <div class="s2-code" style="background:#E8F5E9;color:#005500">R47</div>
  <div class="s2-label" style="font-weight:700">Överskott (+). Överförs till INK1 sidan 2, p. 10.1 eller 10.3</div>
  <div class="s2-sign" style="font-weight:900">=</div>
  <div class="s2-amount pos" style="font-size:11pt;font-weight:900;background:#E8F5E9">${fmt(r47)}</div>
</div>
<div class="s2-row"><div class="s2-code">R48</div><div class="s2-label">Underskott (−). Överförs till INK1 sidan 2, p. 10.2 eller 10.4. Nästa år förs beloppet till R24.</div><div class="s2-sign">=</div><div class="s2-amount"></div></div>
` : `
<div class="s2-row"><div class="s2-code">R47</div><div class="s2-label">Överskott (+). Överförs till INK1 sidan 2, p. 10.1 eller 10.3</div><div class="s2-sign">=</div><div class="s2-amount"></div></div>
<div class="s2-row s2-highlight" style="border:2px solid #CC0000;background:#FFF0EE">
  <div class="s2-code" style="background:#FFF0EE;color:#CC0000">R48</div>
  <div class="s2-label" style="font-weight:700">Underskott (−). Överförs till INK1 sidan 2, p. 10.2 eller 10.4. Nästa år förs beloppet till R24.</div>
  <div class="s2-sign" style="font-weight:900">=</div>
  <div class="s2-amount neg" style="font-size:11pt;font-weight:900;background:#FFF0EE">${fmt(Math.abs(r47))}</div>
</div>
`}

<!-- Övriga uppgifter -->
<div style="font-size:7.5pt;font-weight:700;margin-top:6px;margin-bottom:2px">Övriga uppgifter</div>
<div class="ovriga">
  <div class="ovriga-row">
    <div class="ovriga-num">1</div>
    <div class="ovriga-label">Har du dragit av kostnader för personbil eller lätt lastbil som är leasad (hyrd) i näringsverksamheten eller som är bokförd som tillgång?</div>
    <div class="ovriga-val"><span class="box"></span> Ja</div>
  </div>
  <div class="ovriga-row">
    <div class="ovriga-num">2</div>
    <div class="ovriga-label">Har du dragit av bilkostnader för egen bil enligt schablon (25 kr/mil), ange beloppet</div>
    <div class="ovriga-val">${resorAvd > 0 && (j?.resor_mil||0) > 0 ? fmt(Math.round((j.resor_mil||0)*25)) : ''}</div>
  </div>
  <div class="ovriga-row">
    <div class="ovriga-num">8</div>
    <div class="ovriga-label">Kapitalunderlag för räntefördelning (positivt)</div>
    <div class="ovriga-val">${fmt(j?.r17 || 0)}</div>
  </div>
  <div class="ovriga-row">
    <div class="ovriga-num">9</div>
    <div class="ovriga-label">Kapitalunderlag för räntefördelning (negativt)</div>
    <div class="ovriga-val"></div>
  </div>
  <div class="ovriga-row">
    <div class="ovriga-num">10</div>
    <div class="ovriga-label">Positivt fördelningsbelopp som sparas till nästa beskattningsår</div>
    <div class="ovriga-val">${j?.r25_rf ? fmt(j.r25_rf) : ''}</div>
  </div>
</div>

${flags && flags.length > 0 ? `
<div style="margin-top:8px;font-size:7.5pt;font-weight:700;margin-bottom:2px">Flaggor</div>
${flags.map((f: {sev:string;msg:string;detail:string}) => `
<div style="padding:3px 6px;margin-bottom:2px;font-size:7pt;border-left:3px solid ${f.sev==='err'?'#CC0000':f.sev==='warn'?'#996600':'#005500'};background:${f.sev==='err'?'#FFF0EE':f.sev==='warn'?'#FFFBE6':'#F0F7F0'}">
  <strong>${f.msg}</strong> — ${f.detail}
</div>`).join('')}` : ''}

</div><!-- end page 2 -->

${j?.useRF && j?.r17 ? `
<!-- ═══════ BILAGA RÄNTEFÖRDELNING ═══════ -->
<div class="page-break">
<div class="bilaga-header">
  <div>
    <div class="bilaga-title">Räntefördelning och expansionsfond (f d N6) — Beräkningsbilaga</div>
    <div style="font-size:7.5pt">${companyName} &nbsp; ${orgNumber} &nbsp; Beskattningsår ${inkomstar} &nbsp; Bilaga nr 1 &nbsp; Kopplad till: NE, Ink. av näringsverksamhet</div>
  </div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
<div>
  <div style="font-size:7.5pt;font-weight:700;margin-bottom:3px">A. Beräkning av kapitalunderlag för räntefördelning och fördelningsbelopp</div>
  <div style="font-size:7pt;font-style:italic;margin-bottom:4px;color:#555">Din del av tillgångar och skulder vid beskattningsårets ingång</div>
  <table class="bilaga">
    <tr><td class="fk">924</td><td>Övriga tillgångar</td><td class="num">${fmt(bsGet('1000','1999',al))}</td></tr>
    <tr><td class="fk">925</td><td>Skulder</td><td class="num">−${fmt(bsGet('2000','2999',ll))}</td></tr>
    <tr style="background:#E0E0E0;font-weight:700"><td class="fk">852</td><td>Kapitalunderlag (överskott/positivt)</td><td class="num">${fmt(j?.r17||0)}</td></tr>
    <tr><td class="fk">843</td><td>Positivt kapitalunderlag × 7,96% (= positivt fördelningsbelopp)</td><td class="num">${fmt(Math.round((j?.r17||0)*0.0796))}</td></tr>
    <tr><td class="fk">934</td><td>Sparat fördelningsbelopp från beskattningsår ${parseInt(inkomstar)-1}</td><td class="num">${fmt(j?.r25_rf||0)}</td></tr>
    <tr style="background:#E0E0E0;font-weight:700"><td class="fk">861</td><td>Summa fördelningsbelopp</td><td class="num">${fmt(Math.round((j?.r17||0)*0.0796) + (j?.r25_rf||0))}</td></tr>
    <tr><td class="fk">877</td><td>Utnyttjat positivt fördelningsbelopp (R30 på blankett NE)</td><td class="num">−${fmt(j?.r19||0)}</td></tr>
    <tr style="background:#E0E0E0;font-weight:700"><td class="fk">867</td><td>Ev. kvarvarande positivt fördelningsbelopp som sparas till nästa år</td><td class="num">${fmt(Math.max(0, Math.round((j?.r17||0)*0.0796) + (j?.r25_rf||0) - (j?.r19||0)))}</td></tr>
  </table>
</div>
<div>
  <div style="font-size:7.5pt;font-weight:700;margin-bottom:3px">Positivt fördelningsbelopp</div>
  <div style="font-size:7pt;color:#555;margin-bottom:4px">Kapitalunderlag för räntefördelning:</div>
  <table class="bilaga">
    <tr><td colspan="2">Kapitalunderlag (R17)</td><td class="num">${fmt(j?.r17||0)}</td></tr>
    <tr><td colspan="2">× 7,96%</td><td class="num">= ${fmt(Math.round((j?.r17||0)*0.0796))}</td></tr>
    <tr><td colspan="2">+ Sparat fg år</td><td class="num">+ ${fmt(j?.r25_rf||0)}</td></tr>
    <tr style="background:#E0E0E0;font-weight:700"><td colspan="2">= Max positivt fördelningsbelopp</td><td class="num">${fmt(Math.round((j?.r17||0)*0.0796) + (j?.r25_rf||0))}</td></tr>
    <tr><td colspan="2">Utnyttjat (R30)</td><td class="num">−${fmt(j?.r19||0)}</td></tr>
    <tr style="background:#E0E0E0;font-weight:700"><td colspan="2">Sparas till nästa år</td><td class="num">${fmt(Math.max(0, Math.round((j?.r17||0)*0.0796) + (j?.r25_rf||0) - (j?.r19||0)))}</td></tr>
  </table>
</div>
</div>
</div>` : ''}

${j?.r10 > 0 ? `
<!-- ═══════ BILAGA PERIODISERINGSFOND ═══════ -->
<div class="page-break">
<div class="bilaga-header">
  <div>
    <div class="bilaga-title">Periodiseringsfond — Beräkningsbilaga</div>
    <div style="font-size:7.5pt">${companyName} &nbsp; ${orgNumber} &nbsp; Beskattningsår ${inkomstar} &nbsp; Bilaga nr 2 &nbsp; Kopplad till: NE, Ink. av näringsverksamhet</div>
  </div>
</div>
<table class="bilaga">
  <thead><tr><th>Beskattningsår</th><th>2019</th><th>2020</th><th>2021</th><th>2022</th><th>2023</th><th>2024</th><th>2025</th></tr></thead>
  <tbody>
    <tr><td>Avsättning</td><td class="num">0</td><td class="num">0</td><td class="num">0</td><td class="num">0</td><td class="num">0</td><td class="num">0</td><td class="num">${fmt(j?.r10||0)}</td></tr>
  </tbody>
</table>
<div style="margin-top:8px;font-size:7.5pt">
  <div>Högsta möjliga avsättning till periodiseringsfond: <strong>${fmt(Math.floor(bokf*0.30))} kr</strong> (30% × ${fmt(bokf)} kr)</div>
  <div>Årets avsättning: <strong>${fmt(j?.r10||0)} kr</strong></div>
  <div>Total avsättning till periodiseringsfonder: <strong>${fmt(j?.r10||0)} kr</strong></div>
  <div style="margin-top:3px;font-size:7pt;color:#666">Måste senast återföras: ${parseInt(inkomstar)+6}</div>
</div>
</div>` : ''}

<div class="disclaimer">
  ⚠ Framställt med Normiq Deklarera (normiq.se) som beräkningshjälpmedel. Ersätter inte professionell skatterådgivning.
  Alla uppgifter bör granskas av behörig redovisningskonsult eller revisor innan inlämning till Skatteverket.
</div>

</body></html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="NE-${inkomstar}-${companyName?.replace(/\s/g,'-')}.html"`,
      }
    })

  } catch (err) {
    console.error('PDF error:', err)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}