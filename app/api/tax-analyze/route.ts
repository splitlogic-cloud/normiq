import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { searchDocuments } from '@/lib/embed'
import { searchRules } from '@/lib/rules'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── TYPER ────────────────────────────────────────────────────────────────
export type TaxAnalyzeInput = {
  description: string
  amount: number
  vat_rate?: number
  vat_included?: boolean
  entity_type?: string
  country?: string
  category_hint?: string
}

export type TaxAnalyzeOutput = {
  account: string
  account_name: string
  vat_account: string
  vat_amount: number
  net_amount: number
  deductible: boolean
  deductible_percent: number
  depreciation_years: number | null
  risk: 'LÅG' | 'MEDEL' | 'HÖG'
  risk_reason: string
  lagrum: string[]
  confidence: number
  reasoning: string
  warning?: string
}

// ── RATE LIMIT ───────────────────────────────────────────────────────────
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 60) return false
  entry.count++
  return true
}

// ── BERÄKNA BELOPP ───────────────────────────────────────────────────────
function calculateAmounts(amount: number, vatRate: number, vatIncluded: boolean) {
  if (vatRate === 0) return { net: amount, vat: 0 }
  const multiplier = 1 + vatRate / 100
  if (vatIncluded) {
    const net = Math.round((amount / multiplier) * 100) / 100
    const vat = Math.round((amount - net) * 100) / 100
    return { net, vat }
  }
  const vat = Math.round(amount * (vatRate / 100) * 100) / 100
  return { net: amount, vat }
}

// ── SYSTEM PROMPT ────────────────────────────────────────────────────────
function buildSystemPrompt(sources: string, netAmount: number): string {
  const BELOPPSGRANSEN = 26250
  const overGrans = netAmount > BELOPPSGRANSEN

  return `Du är Tax Brain — en skattemässig analysmotor för svenska företag.

Din uppgift är att analysera en affärshändelse och returnera ett JSON-objekt.
Du får aldrig returnera något annat än JSON — inget preamble, inga förklaringar utanför JSON.

TILLGÄNGLIGA KÄLLOR:
${sources}

BELOPPSGRÄNS FÖRBRUKNINGSINVENTARIER 2025/2026:
Gränsen är 26 250 kr EXKLUSIVE MOMS (ett halvt prisbasbelopp).
Nettobeloppet för denna transaktion är ${netAmount} kr.
${overGrans
  ? `${netAmount} kr > 26 250 kr → AKTIVERA som inventarie → konto 1220, avskrivning 3-5 år.`
  : `${netAmount} kr ≤ 26 250 kr → KOSTNADSFÖR direkt → konto 5410, depreciation_years: null.`
}
Blanda INTE ihop inkl. moms-beloppet med exkl. moms-beloppet vid denna bedömning.

MOMSREGLER:
- Normalt avdragsgill ingående moms: konto 2641
- Ej avdragsgill moms (t.ex. representation): konto 2645
- Blandad användning: konto 2640

VANLIGA KONTON (BAS-kontoplan):
- Datorer/IT under gränsen: 5410 (förbrukningsinventarier)
- Datorer/IT över gränsen: 1220 (inventarier)
- Programvaror engångsköp: 5420
- SaaS/licenser löpande: 5420
- Telefon/abonnemang: 5250
- Kontorsmaterial: 6110
- Representation extern (avdrag 25% moms, ej inkomstskatt): 6072
- Representation intern: 7690
- Hyra lokal: 5010
- Resor inrikes: 5810
- Resor utrikes: 5830
- Lön: 7010
- Marknadsföring: 6410

RISKBEDÖMNING:
- LÅG: tydlig affärshändelse, ingen privat koppling, belopp under gränsen
- MEDEL: viss osäkerhet, t.ex. dator som kan användas privat, representation
- HÖG: tydlig privat koppling, fåmansbolag-frågor, bilförmån, oklart syfte

REGLER:
1. Sätt confidence lågt (0.5-0.7) om beskrivningen är vag
2. Om privatanvändning är möjlig men inte angiven — sätt MEDEL och nämn det i warning
3. Svara alltid på svenska i reasoning, risk_reason och warning
4. lagrum ska vara en array av strängar

RETURNERA EXAKT DETTA JSON-FORMAT (inga andra fält, ingen text utanför):
{
  "account": "5410",
  "account_name": "Förbrukningsinventarier",
  "vat_account": "2641",
  "vat_amount": 0,
  "net_amount": 0,
  "deductible": true,
  "deductible_percent": 100,
  "depreciation_years": null,
  "risk": "LÅG",
  "risk_reason": "...",
  "lagrum": ["IL 18 kap. 1 §"],
  "confidence": 0.92,
  "reasoning": "...",
  "warning": null
}`
}

// ── HUVUD-HANDLER ────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const apiKey = req.headers.get('x-api-key')
  const ip = req.headers.get('x-forwarded-for') || 'anonymous'

  if (!checkRateLimit(apiKey || ip)) {
    return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  let input: TaxAnalyzeInput
  try {
    input = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!input.description || typeof input.amount !== 'number') {
    return Response.json(
      { error: 'description (string) och amount (number) krävs' },
      { status: 400 }
    )
  }

  const vatRate     = input.vat_rate     ?? 25
  const vatIncluded = input.vat_included ?? true
  const entityType  = input.entity_type  ?? 'AB'
  const country     = input.country      ?? 'SE'

  const { net, vat } = calculateAmounts(input.amount, vatRate, vatIncluded)

  const searchQuery = `${input.description} ${input.category_hint || ''} bokföring kontering avdrag moms`.trim()

  let sourcesText = ''
  try {
    const vectorResults = await searchDocuments(searchQuery, 8)
    if (vectorResults?.length > 0 && vectorResults[0].similarity > 0.15) {
      sourcesText = vectorResults
        .map((r: { metadata: { ref: string; rubrik: string }; content: string }) =>
          `[${r.metadata?.ref}] ${r.metadata?.rubrik}\n${r.content}`
        )
        .join('\n\n---\n\n')
    } else {
      throw new Error('no vector results')
    }
  } catch {
    const manualResults = searchRules(searchQuery)
    sourcesText = manualResults
      .map(r => `[${r.ref}] ${r.rubrik}\n${r.text}`)
      .join('\n\n---\n\n')
  }

  const userPrompt = `Analysera denna affärshändelse:

Beskrivning: ${input.description}
Belopp (inkl. moms): ${input.amount} kr
Netto (exkl. moms): ${net} kr
Moms (${vatRate}%): ${vat} kr
Bolagsform: ${entityType}
Land: ${country}
${input.category_hint ? `Kategoriledtråd: ${input.category_hint}` : ''}

Kom ihåg: beloppsgränsen bedöms på NETTO ${net} kr, inte på ${input.amount} kr.
Returnera JSON-analys.`

  let rawJson = ''
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 800,
      system: buildSystemPrompt(sourcesText, net),
      messages: [{ role: 'user', content: userPrompt }],
    })

    rawJson = response.content
      .filter(b => b.type === 'text')
      .map(b => b.type === 'text' ? b.text : '')
      .join('')
      .replace(/```json|```/g, '')
      .trim()
  } catch (err) {
    return Response.json({ error: 'AI-anrop misslyckades', details: String(err) }, { status: 500 })
  }

  let result: TaxAnalyzeOutput
  try {
    result = JSON.parse(rawJson)
  } catch {
    return Response.json(
      { error: 'Kunde inte parsa AI-svar', raw: rawJson },
      { status: 500 }
    )
  }

  // Injicera beräknade belopp — lita inte på att AI räknar rätt
  result.net_amount = net
  result.vat_amount = vat

  // Spara i Supabase
  try {
    await supabase.from('tax_analyses').insert({
      description: input.description,
      amount: input.amount,
      entity_type: entityType,
      result,
      confidence: result.confidence,
      risk_level: result.risk,
      created_at: new Date().toISOString(),
    })
  } catch {
    // Låt inte DB-fel stoppa svaret
  }

  return Response.json(result, {
    headers: {
      'Content-Type': 'application/json',
      'X-Tax-Brain-Version': '1.1',
    }
  })
}