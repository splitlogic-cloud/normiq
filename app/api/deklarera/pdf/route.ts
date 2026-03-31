import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      companyName, orgNumber, fiscalYearStart, fiscalYearEnd,
      intakter, kostnader, bokfortOverskott, skattemassigt,
      justeringar, ega, sruContent, flags,
      bsData, j, verksamhetensArt, uppdragstagare, saknarTillgangar
    } = body

    const fmt = (n: number) => n == null ? '' : Math.round(n).toLocaleString('sv-SE')
    const fmtDate = (s: string) => s ? s.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : ''
    const today = new Date().toLocaleDateString('sv-SE')
    const inkomstar = fiscalYearStart?.substring(0, 4) || '2025'

    // Helper to get value from intakter/kostnader arrays
    const allRows = [...(intakter||[]), ...(kostnader||[])]
    const rv = (id: string) => {
      const found = allRows.find((r: {id:string}) => r.id === id)
      return found ? Math.round(Math.abs((found as {value:number}).value)) : 0
    }

    // BS helpers
    const bs = bsData || { al: [], ll: [] }
    const bsGet = (from: string, to: string, arr: {acc:string;amt:number}[]) =>
      Math.round(Math.abs((arr||[]).filter(l => l.acc >= from && l.acc <= to).reduce((s, l) => s + l.amt, 0)))
    const llGet = (from: string, to: string) =>
      Math.round((bs.ll||[]).filter((l:{acc:string}) => l.acc >= from && l.acc <= to).reduce((s:number, l:{amt:number}) => s + l.amt, 0))

    const css = `
    @page { margin: 12mm 12mm; size: A4; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #000; }
    .page-break { page-break-before: always; }
    .pg-hdr { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1.5px solid #000; padding-bottom:5px; margin-bottom:7px; }
    .skv { font-size:13pt; font-weight:900; letter-spacing:-.02em; }
    .bl-title { font-size:10pt; font-weight:700; }
    .bl-sub { font-size:7pt; color:#555; margin-top:2px; }
    .bl-code { font-size:7pt; color:#666; text-align:right; }
    .meta { display:grid; grid-template-columns:repeat(3,1fr); gap:4px; margin-bottom:7px; }
    .mf { border:1px solid #000; padding:2px 4px; min-height:20px; }
    .ml { font-size:6pt; color:#666; display:block; }
    .mv { font-size:8pt; font-weight:600; }
    .two { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .sh { font-size:7pt; font-weight:700; background:#E5E5E5; padding:2px 4px; border:1px solid #C0C0C0; border-bottom:none; text-transform:uppercase; letter-spacing:.04em; }
    .row { display:flex; align-items:stretch; border:1px solid #C8C8C8; border-top:none; min-height:17px; }
    .rc { font-size:6.5pt; font-weight:700; color:#C0392B; padding:2px 3px; width:24px; min-width:24px; border-right:1px solid #DDD; display:flex; align-items:center; background:#FAFAFA; }
    .rl { font-size:7.5pt; padding:2px 4px; flex:1; display:flex; align-items:center; line-height:1.25; }
    .rs { font-size:9pt; font-weight:700; padding:0 2px; display:flex; align-items:center; color:#666; }
    .rv { font-family:'Courier New',monospace; font-size:8pt; font-weight:600; padding:2px 4px; min-width:70px; text-align:right; border-left:1px solid #C8C8C8; display:flex; align-items:center; justify-content:flex-end; }
    .res { background:#EAEAEA; }
    .pos { color:#1A6B3A; }
    .neg { color:#C0392B; }
    .em { color:#CCC; }
    .ck { display:flex; align-items:center; gap:5px; border:1px solid #C8C8C8; border-top:none; padding:2px 4px; font-size:7.5pt; }
    .box { width:10px; height:10px; border:1px solid #000; display:inline-block; text-align:center; line-height:10px; font-size:8pt; }
    .sru { font-family:'Courier New',monospace; font-size:7pt; background:#F8F8F8; border:1px solid #DDD; padding:5px 7px; white-space:pre; line-height:1.55; margin-top:6px; }
    .disc { background:#FDF5E6; border:1px solid #E8D4A0; padding:4px 6px; font-size:6.5pt; color:#92620A; margin-top:6px; }
    .flag { padding:2px 5px; margin-bottom:2px; font-size:7pt; border-left:2px solid; }
    .flag.warn { border-color:#92620A; background:#FDF5E6; }
    .flag.err { border-color:#C0392B; background:#FDF0EE; }
    .flag.info { border-color:#2D6A4F; background:#EFF7F2; }
    .nh { font-size:6.5pt; color:#9A9690; text-align:right; margin-bottom:3px; }
    `

    const R = (code: string, label: string, sign: string, val: number | null, cls = '') =>
      `<div class="row ${cls}"><span class="rc">${code}</span><span class="rl">${label}</span><span class="rs">${sign}</span><span class="rv ${val != null && val !== 0 ? (sign === '+' ? 'pos' : sign === '−' ? 'neg' : '') : 'em'}">${val != null && val !== 0 ? fmt(Math.abs(val)) : '—'}</span></div>`
    const Res = (code: string, label: string, val: number) =>
      `<div class="row res"><span class="rc">${code}</span><span class="rl" style="font-weight:700">= ${label}</span><span class="rs">=</span><span class="rv" style="font-weight:700">${val < 0 ? '−' : '+'}${fmt(Math.abs(val))}</span></div>`
    const Sec = (title: string) => `<div class="sh">${title}</div>`
    const Sub = (label: string) => `<div style="padding:2px 4px;font-size:6.5pt;color:#666;border:1px solid #C8C8C8;border-top:none;border-bottom:none">${label}</div>`

    const SLP = Math.round((j?.r24||0) * 0.2426)
    const bokf = bokfortOverskott || 0
    const skatt = skattemassigt || 0

    const html = `<!DOCTYPE html>
<html lang="sv"><head><meta charset="UTF-8"><title>NE ${inkomstar} — ${companyName}</title><style>${css}</style></head>
<body>

<!-- SIDA 1 -->
<div class="nh">Normiq Deklarera · normiq.se · Framställd ${today}</div>

<div class="pg-hdr">
  <div>
    <div class="skv">Skatteverket</div>
    <div class="bl-title">Inkomst av näringsverksamhet — Enskilda näringsidkare NE</div>
    <div class="bl-sub">Taxeringsår 2026 · Inkomstår ${inkomstar} · Blankett NE-2026P4</div>
  </div>
  <div class="bl-code">NEM-1-13-2025P4<br>SKV 2161 13</div>
</div>

<div class="meta">
  <div class="mf"><span class="ml">Räkenskapsår fr.o.m.</span><span class="mv">${fmtDate(fiscalYearStart)}</span></div>
  <div class="mf"><span class="ml">Räkenskapsår t.o.m.</span><span class="mv">${fmtDate(fiscalYearEnd)}</span></div>
  <div class="mf"><span class="ml">Datum när blanketten fylls i</span><span class="mv">${today}</span></div>
  <div class="mf" style="grid-column:1/3"><span class="ml">Namn</span><span class="mv">${companyName||''}</span></div>
  <div class="mf"><span class="ml">Personnummer</span><span class="mv">${orgNumber||''}</span></div>
  <div class="mf" style="grid-column:1/4"><span class="ml">Verksamhetens art</span><span class="mv">${verksamhetensArt||''}</span></div>
</div>

<div class="ck">
  <span class="box">${uppdragstagare ? '✓' : ''}</span>
  <span>Uppdragstagare (t.ex. redovisningskonsult) har biträtt vid upprättandet av årsbokslutet</span>
  <span style="margin-left:16px">Ja <span class="box">${!uppdragstagare ? '✓' : ''}</span> Nej</span>
</div>

<div class="two" style="margin-top:7px">
<div>
${Sec('Balansräkning / räkenskapsschema')}
${saknarTillgangar
  ? `<div class="ck" style="background:#FDF5E6;font-weight:600"><span class="box">✓</span> Verksamheten saknar tillgångar och skulder (B1)</div>`
  : `
${R('B1','Immateriella anläggningstillgångar', '+', bsGet('1000','1099', bs.al)||null)}
${R('B2','Byggnader och markanläggningar', '+', bsGet('1100','1179', bs.al)||null)}
${R('B3','Mark och andra tillgångar som inte får skrivas av', '+', bsGet('1180','1199', bs.al)||null)}
${R('B4','Maskiner och inventarier', '+', Math.max(0, bsGet('1200','1259', bs.al) - bsGet('1260','1299', bs.al))||null)}
${R('B5','Övriga anläggningstillgångar', '+', bsGet('1300','1399', bs.al)||null)}
${Sub('Omsättningstillgångar')}
${R('B6','Varulager', '+', bsGet('1400','1499', bs.al)||null)}
${R('B7','Kundfordringar', '+', bsGet('1500','1599', bs.al)||null)}
${R('B8','Övriga fordringar', '+', bsGet('1600','1899', bs.al)||null)}
${R('B9','Kassa och bank', '+', bsGet('1900','1999', bs.al)||null)}
${Sub('Eget kapital och skulder')}
${R('B10','Eget kapital (tillgångar − skulder)', '', llGet('2000','2099')||null)}
${R('B11','Obeskattade reserver', '', bsGet('2100','2199', bs.ll)||null)}
${R('B12','Avsättningar', '', bsGet('2200','2299', bs.ll)||null)}
${R('B13','Låneskulder', '', bsGet('2300','2399', bs.ll)||null)}
${R('B14','Skatteskulder', '', bsGet('2500','2599', bs.ll)||null)}
${R('B15','Leverantörsskulder', '', bsGet('2400','2449', bs.ll)||null)}
${R('B16','Övriga skulder', '', bsGet('2600','2999', bs.ll)||null)}
`}
</div>
<div>
${Sec('Resultaträkning / räkenskapsschema')}
${Sub('Intäkter')}
${R('R1','Försäljning och utfört arbete samt övriga momspliktiga intäkter', '+', rv('R1')||null)}
${R('R2','Bil- och bostadsförmån m.m.', '+', null)}
${R('R3','Momsfria intäkter', '+', rv('R2')||null)}
${R('R4','Ränteintäkter m.m.', '+', rv('R3')||null)}
${Sub('Kostnader')}
${R('R5','Varor, material och tjänster', '−', rv('R10')||null)}
${R('R6','Övriga externa kostnader', '−', rv('R15')||null)}
${R('R7','Anställd personal', '−', (rv('R11')+rv('R12'))||null)}
${R('R8','Räntekostnader m.m.', '−', rv('R18')||null)}
${R('R9','Avskrivningar byggnader och markanläggningar', '−', null)}
${R('R10','Avskrivningar maskiner, inventarier och immateriella tillgångar', '−', rv('R17')||null)}
<div class="row res" style="border:1.5px solid #888;border-top:none"><span class="rc">R11</span><span class="rl" style="font-weight:700">=&nbsp;Bokfört resultat (förs till sidan 2 R12)</span><span class="rs">=</span><span class="rv ${bokf >= 0 ? 'pos' : 'neg'}" style="font-size:9pt;font-weight:700">${bokf >= 0 ? '+' : '−'}${fmt(Math.abs(bokf))}</span></div>
</div>
</div>

<!-- SIDA 2 -->
<div class="page-break"></div>
<div class="nh">${companyName||''} · ${orgNumber||''} · Inkomstår ${inkomstar} · Normiq Deklarera</div>
<div style="font-size:9pt;font-weight:700;border-bottom:1.5px solid #000;padding-bottom:3px;margin-bottom:7px">
  Skattemässiga justeringar av bokfört resultat <span style="font-size:7pt;font-weight:400;color:#666">— NEM-2-13-2025P4</span>
</div>

<div class="two">
<div>
<div class="row res" style="border:1.5px solid #888"><span class="rc">R12</span><span class="rl" style="font-weight:700">=&nbsp;Bokfört resultat (förs hit från R11)</span><span class="rs">=</span><span class="rv ${bokf >= 0 ? 'pos' : 'neg'}" style="font-weight:700">${bokf >= 0 ? '+' : '−'}${fmt(Math.abs(bokf))}</span></div>

${(justeringar||[]).filter((jj:{value:number}) => jj.value !== 0).map((jj:{code:string;label:string;value:number}) =>
  R(jj.code, jj.label, jj.value >= 0 ? '+' : '−', jj.value)
).join('')}

${Res('R29', 'Överskott/Underskott före räntefördelning', skatt)}
${R('R30','Positiv räntefördelning, dock högst överskott vid R29 (→ INK1 p. 11.1)', '−', j?.r19||null)}
${R('R31','Negativ räntefördelning (→ INK1 p. 11.2)', '+', j?.r20||null)}
${R('R32','Återföring av periodiseringsfond', '+', (j?.r11||0)+(j?.r12||0)||null)}
${Res('R33', 'Överskott/Underskott före avsättning till periodiseringsfond', skatt)}
${R('R34','Avsättning till periodiseringsfond, dock högst 30% av överskott vid R33', '−', j?.r10||null)}
</div>
<div>
${Res('R35', 'Överskott/Underskott före ökning av expansionsfond', skatt)}
${R('R36','Ökning av expansionsfond, dock högst överskott vid R35 (→ INK1 p. 12.1)', '−', j?.r14||null)}
${R('R37','Minskning av expansionsfond (→ INK1 p. 12.2)', '+', j?.r15||null)}
${R('R38','Egna pensionspremier eller inbetalning på pensionssparkonto (→ INK1 p. 10.6)', '−', j?.r24||null)}
${R('R39','Särskild löneskatt på pensionssparavdrag i R38', '−', SLP||null)}
${R('R40','Medgivna avdrag EGA och SLP föregående beskattningsår (R43 i fg blankett)', '+', j?.r28||null)}
${R('R41','Påförda egenavgifter och särskild löneskatt föregående beskattningsår', '−', j?.r29||null)}
${Res('R42', 'Överskott/Underskott före årets avdrag för egenavgifter och SLP', skatt)}
${R('R43','Årets beräknade avdrag för egenavgifter och SLP', '−', ega?.avd25||null)}
${R('R44','Sjukpenning som hör till denna näringsverksamhet', '+', j?.r25||null)}

${(ega?.slutlig||0) >= 0
  ? `<div class="row" style="border:2px solid #1A6B3A;border-top:none;background:#EFF7F2"><span class="rc" style="background:#EFF7F2">R47</span><span class="rl" style="font-weight:700">Överskott (+). Förs till INK1 sidan 2, p. 10.1</span><span class="rs">=</span><span class="rv pos" style="font-size:10pt;background:#EFF7F2;font-weight:700">${fmt(ega?.slutlig||0)}</span></div>
     <div class="row"><span class="rc">R48</span><span class="rl">Underskott (−). Förs till INK1 sidan 2, p. 10.2. Nästa år förs beloppet till R24.</span><span class="rs">=</span><span class="rv em">—</span></div>`
  : `<div class="row"><span class="rc">R47</span><span class="rl">Överskott (+). Förs till INK1 sidan 2, p. 10.1</span><span class="rs">=</span><span class="rv em">—</span></div>
     <div class="row" style="border:2px solid #C0392B;border-top:none;background:#FDF0EE"><span class="rc" style="background:#FDF0EE">R48</span><span class="rl" style="font-weight:700">Underskott (−). Förs till INK1 sidan 2, p. 10.2. Nästa år förs beloppet till R24.</span><span class="rs">=</span><span class="rv neg" style="font-size:10pt;background:#FDF0EE;font-weight:700">${fmt(Math.abs(ega?.slutlig||0))}</span></div>`}

</div>
</div>

<div style="margin-top:6px">
${Sec('Övriga uppgifter')}
${R('Ö2','Bilkostnader för egen bil enligt schablon (25 kr/mil) — ange beloppet', '', j?.resor_mil ? Math.round((j.resor_mil||0)*25) : null)}
${R('Ö8','Kapitalunderlag för räntefördelning (positivt)', '', j?.r17||null)}
${R('Ö10','Positivt fördelningsbelopp som sparas till nästa beskattningsår', '', j?.r25_rf||null)}
</div>

${(flags||[]).length > 0 ? `<div style="margin-top:6px">${Sec('Flaggor och kontrollpunkter')}${(flags||[]).map((f:{sev:string;msg:string;detail:string}) => `<div class="flag ${f.sev}"><strong>${f.msg}</strong> — ${f.detail}</div>`).join('')}</div>` : ''}

<div style="margin-top:6px">${Sec('SRU-fil — BLANKETTER.SRU (NE-2026P4)')}<div class="sru">${(sruContent||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div></div>

<div class="disc">⚠ Framställt med SkattAI/Normiq som beräkningshjälpmedel. Ersätter inte professionell skatterådgivning. Alla uppgifter bör granskas av behörig redovisningskonsult eller revisor innan inlämning till Skatteverket.</div>

</body></html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="NE-deklaration-${inkomstar}.html"`,
      }
    })

  } catch (err) {
    console.error('PDF route error:', err)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}
