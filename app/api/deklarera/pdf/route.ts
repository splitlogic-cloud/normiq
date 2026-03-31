import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

// ─────────────────────────────────────────────────────────────
//  PDF EXPORT — /api/deklarera/pdf
//  Generates a structured PDF summary of the NE declaration
//  Uses HTML → PDF via browser print (no extra deps needed)
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      companyName, orgNumber, fiscalYearStart, fiscalYearEnd,
      intakter, kostnader, bokfortOverskott, skattemassigt,
      justeringar, ega, sruContent, flags, filename
    } = body

    const fmt = (n: number) => Math.round(n).toLocaleString('sv-SE')
    const sgn = (n: number) => (n >= 0 ? '+' : '−') + ' ' + fmt(Math.abs(n))
    const today = new Date().toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })

    const html = `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="UTF-8">
<title>NE-deklaration ${fiscalYearStart?.substring(0,4)} — ${companyName}</title>
<style>
  @page { margin: 20mm 18mm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 9pt; color: #1A1A18; background: #fff; }
  
  .header { border-bottom: 2px solid #1A1A18; padding-bottom: 10px; margin-bottom: 16px; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .logo { font-size: 18pt; font-weight: 700; letter-spacing: -.02em; }
  .logo span { color: #C0392B; }
  .header-meta { text-align: right; font-size: 8pt; color: #6A6660; line-height: 1.6; }
  .company-name { font-size: 13pt; font-weight: 700; margin-top: 8px; }
  .company-sub { font-size: 8pt; color: #6A6660; margin-top: 2px; }

  .section { margin-bottom: 16px; }
  .section-title { font-size: 8pt; letter-spacing: .1em; text-transform: uppercase; color: #6A6660; padding: 4px 0; border-bottom: 1px solid #DDD8CF; margin-bottom: 8px; font-weight: 600; }
  
  .row { display: flex; justify-content: space-between; align-items: baseline; padding: 3px 0; border-bottom: 1px solid #F0EDE8; font-size: 9pt; }
  .row:last-child { border-bottom: none; }
  .row.total { font-weight: 700; border-top: 2px solid #1A1A18; border-bottom: none; padding-top: 5px; margin-top: 3px; font-size: 10pt; }
  .row.subtotal { font-weight: 600; border-top: 1px solid #C8C3BA; }
  .row-label { color: #3A3832; }
  .row-code { font-family: monospace; font-size: 8pt; color: #C0392B; margin-right: 6px; }
  .row-val { font-family: monospace; font-size: 9pt; text-align: right; min-width: 90px; }
  .row-val.pos { color: #2D6A4F; }
  .row-val.neg { color: #C0392B; }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  
  .summary-box { background: #F5F0E8; border-left: 3px solid #C0392B; padding: 10px 12px; margin-bottom: 14px; }
  .summary-box h2 { font-size: 11pt; margin-bottom: 8px; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .summary-item { }
  .summary-label { font-size: 7pt; text-transform: uppercase; letter-spacing: .08em; color: #6A6660; }
  .summary-val { font-size: 12pt; font-weight: 700; margin-top: 2px; }
  
  .flag { padding: 4px 8px; margin-bottom: 4px; font-size: 8pt; line-height: 1.5; border-left: 2px solid; }
  .flag.warn { border-color: #92620A; background: #FDF5E6; color: #6A3D00; }
  .flag.err  { border-color: #C0392B; background: #FDF0EE; color: #8B0000; }
  .flag.info { border-color: #2D6A4F; background: #EFF7F2; color: #1A4A30; }
  
  .sru-block { font-family: monospace; font-size: 7.5pt; background: #F8F8F6; border: 1px solid #DDD8CF; padding: 8px 10px; white-space: pre; line-height: 1.7; margin-top: 8px; }
  
  .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #DDD8CF; font-size: 7.5pt; color: #9A9690; display: flex; justify-content: space-between; }
  .disclaimer { background: #FDF5E6; border: 1px solid #E8D4A0; padding: 6px 8px; font-size: 7.5pt; color: #92620A; margin-top: 10px; line-height: 1.5; }

  @media print {
    .page-break { page-break-before: always; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-top">
    <div>
      <div class="logo">Normiq <span>Deklarera</span></div>
      <div class="company-name">${companyName || '—'}</div>
      <div class="company-sub">${orgNumber || ''} · Inkomstår ${fiscalYearStart?.substring(0,4) || '2024'} (${fiscalYearStart?.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')} – ${fiscalYearEnd?.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')})</div>
    </div>
    <div class="header-meta">
      Blankett NE-2026P4<br>
      Taxeringsår 2026<br>
      Framställd ${today}
    </div>
  </div>
</div>

<!-- SAMMANFATTNING -->
<div class="summary-box">
  <h2>Sammanfattning</h2>
  <div class="summary-grid">
    <div class="summary-item">
      <div class="summary-label">Bokfört överskott</div>
      <div class="summary-val">${fmt(bokfortOverskott)} kr</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Skattemässigt överskott</div>
      <div class="summary-val">${fmt(skattemassigt)} kr</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Slutligt överskott (R47)</div>
      <div class="summary-val" style="color:#C0392B">${fmt(ega?.slutlig || 0)} kr</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Egenavgifter</div>
      <div class="summary-val">${fmt(ega?.netto || 0)} kr</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Kommunalskatt (32%)</div>
      <div class="summary-val">${fmt(ega?.kom || 0)} kr</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Total skatt & avgifter</div>
      <div class="summary-val" style="color:#C0392B">${fmt(ega?.tot || 0)} kr</div>
    </div>
  </div>
</div>

<div class="two-col">

<!-- RESULTATRÄKNING -->
<div class="section">
  <div class="section-title">Resultaträkning — Avsnitt A & B</div>
  ${(intakter || []).map((r: {id:string;label:string;value:number}) => `
  <div class="row">
    <div class="row-label"><span class="row-code">${r.id}</span>${r.label}</div>
    <div class="row-val">${fmt(r.value)} kr</div>
  </div>`).join('')}
  <div class="row subtotal">
    <div class="row-label">Summa intäkter</div>
    <div class="row-val pos">${fmt(intakter?.reduce((s:number,r:{value:number}) => s+r.value, 0) || 0)} kr</div>
  </div>
  ${(kostnader || []).map((r: {id:string;label:string;value:number}) => `
  <div class="row">
    <div class="row-label"><span class="row-code">${r.id}</span>${r.label}</div>
    <div class="row-val neg">${fmt(r.value)} kr</div>
  </div>`).join('')}
  <div class="row subtotal">
    <div class="row-label">Summa kostnader</div>
    <div class="row-val neg">−${fmt(kostnader?.reduce((s:number,r:{value:number}) => s+r.value, 0) || 0)} kr</div>
  </div>
  <div class="row total">
    <div class="row-label">Bokfört överskott</div>
    <div class="row-val">${fmt(bokfortOverskott)} kr</div>
  </div>
</div>

<!-- JUSTERINGAR -->
<div class="section">
  <div class="section-title">Skattemässiga justeringar §A–§J</div>
  ${(justeringar || []).map((r: {label:string;value:number;code:string}) => `
  <div class="row">
    <div class="row-label"><span class="row-code">${r.code}</span>${r.label}</div>
    <div class="row-val ${r.value >= 0 ? '' : 'neg'}">${sgn(r.value)} kr</div>
  </div>`).join('')}
  <div class="row total">
    <div class="row-label">Skattemässigt överskott</div>
    <div class="row-val">${fmt(skattemassigt)} kr</div>
  </div>
</div>

</div>

<!-- EGENAVGIFTER -->
<div class="section">
  <div class="section-title">Egenavgifter & skatteuträkning — EGA §1–§4</div>
  <div class="two-col">
    <div>
      <div class="row"><div class="row-label">Underlag (skattemässigt överskott)</div><div class="row-val">${fmt(skattemassigt)} kr</div></div>
      <div class="row"><div class="row-label">Egenavgifter brutto (28,87%)</div><div class="row-val neg">−${fmt(ega?.sum || 0)} kr</div></div>
      <div class="row"><div class="row-label">Nedsättning (7,5%, max 15 000 kr)</div><div class="row-val pos">+${fmt(ega?.ned || 0)} kr</div></div>
      <div class="row subtotal"><div class="row-label">Netto-egenavgifter</div><div class="row-val neg">−${fmt(ega?.netto || 0)} kr</div></div>
      <div class="row"><div class="row-label">25%-avdraget (R43)</div><div class="row-val pos">+${fmt(ega?.avd25 || 0)} kr</div></div>
      <div class="row total"><div class="row-label">Slutligt överskott (R47)</div><div class="row-val">${fmt(ega?.slutlig || 0)} kr</div></div>
    </div>
    <div>
      <div class="row"><div class="row-label">Kommunal inkomstskatt (32%)</div><div class="row-val neg">−${fmt(ega?.kom || 0)} kr</div></div>
      <div class="row"><div class="row-label">Begravningsavgift (0,279%)</div><div class="row-val neg">−${fmt(ega?.beg || 0)} kr</div></div>
      <div class="row"><div class="row-label">Netto-egenavgifter</div><div class="row-val neg">−${fmt(ega?.netto || 0)} kr</div></div>
      <div class="row total"><div class="row-label" style="color:#C0392B">Total skatt & avgifter</div><div class="row-val neg">${fmt(ega?.tot || 0)} kr</div></div>
    </div>
  </div>
</div>

${(flags || []).length > 0 ? `
<div class="section">
  <div class="section-title">Flaggor & kontrollpunkter</div>
  ${(flags || []).map((f: {sev:string;msg:string;detail:string}) => `
  <div class="flag ${f.sev}"><strong>${f.msg}</strong> — ${f.detail}</div>`).join('')}
</div>` : ''}

<div class="page-break"></div>

<div class="section">
  <div class="section-title">SRU-fil — BLANKETTER.SRU (NE-2026P4)</div>
  <div class="sru-block">${(sruContent || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
</div>

<div class="disclaimer">
  ⚠ Detta underlag är framställt med SkattAI/Normiq som ett AI-assisterat hjälpmedel och ersätter inte professionell skatterådgivning. 
  Alla uppgifter bör granskas av behörig redovisningskonsult eller revisor innan inlämning till Skatteverket. 
  Kommunalskatt 32,0% är schablonsats — din faktiska kommunalskatt kan avvika.
</div>

<div class="footer">
  <span>Normiq Deklarera · normiq.se</span>
  <span>Framställd ${today} · Fil: ${filename || 'SIE-fil'}</span>
</div>

</body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="NE-deklaration-${fiscalYearStart?.substring(0,4) || '2024'}.html"`,
      }
    })

  } catch (err) {
    console.error('PDF route error:', err)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}
