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
  description: string       // "Apple Store köp"
  amount: number            // 24990 (inkl. moms om vat_included: true)
  vat_rate?: number         // 25 | 12 | 6 | 0 — default 25
  vat_included?: boolean    // true = beloppet inkluderar moms
  entity_type?: string      // "AB" | "EF" | "HB" — default "AB"
  country?: string          // "SE" — default "SE"
  category_hint?: string    // frivillig ledtråd: "dator", "representation", "hyra"
}

export type TaxAnalyzeOutput = {
  account: string           // BAS-konto t.ex. "5410"
  account_name: string      // "Förbrukningsinventarier"
  vat_account: string       // "2641"
  vat_amount: number        // beräknat momsbelopp i kr
  net_amount: number        // belopp exkl. moms
  deductible: boolean       // avdragsrätt ja/nej
  deductible_percent: number // 0-100
  depreciation_years: number | null  // null = ingen avskrivning
  risk: 'LÅG' | 'MEDEL' | 'HÖG'
  risk_reason: string
  lagrum: string[]          // ["IL 18 kap. 1 §", "ML 8 kap. 3 §"]
  confidence: number        // 0.0 - 1.0
  reasoning: string         // kort motivering på svenska
  warning?: string          // valfri varning om kantfall
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
function buildSystemPrompt(sources: string): string {
  return `Du är Tax Brain — en skattemässig analysmotor för svenska företag.

Din uppgift är att analysera en affärshändelse och returnera ett JSON-objekt.
Du får aldrig returnera något annat än JSON — inget preamble, inga förklaringar utanför JSON.

TILLGÄNGLIGA KÄLLOR:
${sources}

REGLER:
1. Använd alltid BAS-kontoplan (5-siffriga konton)
2. Momskontor: 2640 (ingående moms 25%), 2641 (avdragsgill), 2645 (ej avdragsgill)
3. Vanliga konton:
   - Datorer/IT: 5410 (förbrukningsinv. <23 450 kr) eller 1220 (inventarier)
   - Representation intern: 7690, extern: 6072 (avdrag 25% av moms, ej inkomstskatt)
   - Telefon/abonnemang: 5250
   - Kontorsmaterial: 6110
   - Hyra lokal: 5010
   - Lön: 7010
   - Resor: 5810 (inrikes), 5830 (utrikes)
   - Programvaror/SaaS: 5420 eller 1230 (licenser >1 år)
4. Avskrivning: inventarier >23 450 kr skrivs av över 3-5 år (IL 18 kap)
   Förbrukningsinventarier under beloppsgränsen kostnadsförs direkt
5. Confidence: sätt lågt (0.5-0.7) om beskrivningen är vag eller kantfall finns
6. Risk HÖG om: representation, bilförmån, blandad privat/tjänst, fåmansbolag-koppling
7. Svara alltid på svenska i reasoning och risk_reason

RETURNERA EXAKT DETTA JSON-FORMAT:
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
  // Auth-header (API-nyckel för externa integrationer)
  const apiKey = req.headers.get('x-api-key')
  const ip = req.headers.get('x-forwarded-for') || 'anonymous'

  if (!checkRateLimit(apiKey || ip)) {
    return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  // Parsa input
  let input: TaxAnalyzeInput
  try {
    input = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validera obligatoriska fält
  if (!input.description || typeof input.amount !== 'number') {
    return Response.json(
      { error: 'description (string) och amount (number) krävs' },
      { status: 400 }
    )
  }

  // Defaults
  const vatRate     = input.vat_rate     ?? 25
  const vatIncluded = input.vat_included ?? true
  const entityType  = input.entity_type  ?? 'AB'
  const country     = input.country      ?? 'SE'

  // Beräkna belopp
  const { net, vat } = calculateAmounts(input.amount, vatRate, vatIncluded)

  // Bygg söksträng för RAG
  const searchQuery = `${input.description} ${input.category_hint || ''} bokföring kontering avdrag moms`.trim()

  // Hämta relevanta källor
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

  // Bygg user prompt
  const userPrompt = `Analysera denna affärshändelse:

Beskrivning: ${input.description}
Belopp (inkl. moms): ${input.amount} kr
Netto: ${net} kr
Moms (${vatRate}%): ${vat} kr
Bolagsform: ${entityType}
Land: ${country}
${input.category_hint ? `Kategoriledtråd: ${input.category_hint}` : ''}

Returnera JSON-analys.`

  // Anropa Claude
  let rawJson = ''
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 800,
      system: buildSystemPrompt(sourcesText),
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

  // Parsa JSON
  let result: TaxAnalyzeOutput
  try {
    result = JSON.parse(rawJson)
  } catch {
    return Response.json(
      { error: 'Kunde inte parsa AI-svar', raw: rawJson },
      { status: 500 }
    )
  }

  // Injicera beräknade belopp (lita inte på att AI räknar rätt)
  result.net_amount = net
  result.vat_amount = vat

  // Spara i Supabase för analys
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
    // Logga men låt inte DB-fel stoppa svaret
  }

  return Response.json(result, {
    headers: {
      'Content-Type': 'application/json',
      'X-Tax-Brain-Version': '1.0',
    }
  })
}