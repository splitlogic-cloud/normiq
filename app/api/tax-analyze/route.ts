import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { searchDocuments } from '@/lib/embed'
import { searchRules } from '@/lib/rules'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const BELOPPSGRANSEN_2026 = 26250

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
  warning?: string | null
  reverse_charge?: boolean
}

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

// ── IDENTIFIERA OMVÄND MOMSSKYLDIGHET ────────────────────────────────────
// Utländska digitala tjänster utan svensk moms = omvänd skattskyldighet
const FOREIGN_DIGITAL_SERVICES = [
  'facebook', 'meta', 'google', 'claude', 'anthropic', 'openai', 'chatgpt',
  'linkedin', 'twitter', 'x.com', 'adobe', 'microsoft', 'aws', 'amazon',
  'apple', 'dropbox', 'slack', 'notion', 'figma', 'canva', 'hubspot',
  'salesforce', 'zapier', 'mailchimp', 'stripe', 'zoom', 'spotify',
  'netflix', 'github', 'vercel', 'supabase', 'digitalocean', 'cloudflare',
  'superhuman', 'notion', 'loom', 'grammarly', 'webflow', 'ahrefs',
  'semrush', 'intercom', 'zendesk', 'asana', 'monday', 'clickup',
  'miro', 'typeform', 'calendly', 'buffer', 'hootsuite', 'mailgun',
  'twilio', 'sendgrid', 'heroku', 'netlify', 'datadog', 'sentry',
]

// Utländska valutor — alltid omvänd skattskyldighet om moms = 0
const FOREIGN_CURRENCIES = ['eur', 'usd', 'gbp', 'nok', 'dkk', 'chf', 'jpy', '€', '$', '£']

function detectCurrency(description: string): boolean {
  const desc = description.toLowerCase()
  return FOREIGN_CURRENCIES.some(c => desc.includes(c))
}

function isReverseCharge(description: string, country: string, vatRate: number): boolean {
  const desc = description.toLowerCase()
  const isUtland = country !== 'SE'
  const isUtlandskTjanst = FOREIGN_DIGITAL_SERVICES.some(s => desc.includes(s))
  const hasForeignCurrency = detectCurrency(description)
  // Omvänd skattskyldighet om utländsk leverantör/valuta OCH moms 0%
  return (isUtland || isUtlandskTjanst || hasForeignCurrency) && vatRate === 0
}

// ── EU-LÄNDER ────────────────────────────────────────────────────────────
const EU_COUNTRIES = [
  'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR',
  'HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK',
  // Även vanliga namn
  'AUSTRIA','BELGIUM','BULGARIA','CYPRUS','CZECHIA','GERMANY','DENMARK',
  'ESTONIA','SPAIN','FINLAND','FRANCE','GREECE','CROATIA','HUNGARY',
  'IRELAND','ITALY','LITHUANIA','LUXEMBOURG','LATVIA','MALTA',
  'NETHERLANDS','POLAND','PORTUGAL','ROMANIA','SLOVENIA','SLOVAKIA',
]

// ── HARD OVERRIDE ────────────────────────────────────────────────────────
function applyHardRules(
  result: TaxAnalyzeOutput,
  net: number,
  vat: number,
  reverseCharge: boolean
): TaxAnalyzeOutput {

  // 1. Omvänd momsskyldighet — alltid deterministisk
  if (reverseCharge) {
    const vatAmount = Math.round(net * 0.25 * 100) / 100
    const isEU = EU_COUNTRIES.some(c => country.toUpperCase() === c)
    // 4535 = Inköp av tjänster från annat EU-land, 4531 = utanför EU
    const importAccount = isEU ? '4535' : '4531'
    const importAccountName = isEU
      ? 'Inköp av tjänster från annat EU-land'
      : 'Inköp av tjänster från land utanför EU'
    result.reverse_charge = true
    result.account = importAccount
    result.account_name = importAccountName
    result.vat_account = '2614'
    result.vat_amount = vatAmount
    result.deductible = true
    result.deductible_percent = 100
    result.warning = (result.warning ? result.warning + ' ' : '') +
      `Omvänd skattskyldighet: Bokför nettokostnad på konto ${importAccount} (${importAccountName}). Redovisa utgående moms ${vatAmount} kr (konto 2614) och ingående moms ${vatAmount} kr (konto 2645) i momsdeklarationen.`
  }

  // 2. Beloppsgräns förbrukningsinventarier
  const isInventarieKonto = ['1220', '1221', '5410', '5411'].includes(result.account)
  if (isInventarieKonto) {
    if (net <= BELOPPSGRANSEN_2026) {
      result.account = '5410'
      result.account_name = 'Förbrukningsinventarier'
      result.depreciation_years = null
    } else {
      result.account = '1220'
      result.account_name = 'Inventarier'
      if (!result.depreciation_years) result.depreciation_years = 3
    }
  }

  // 3. Representation
  const isRepresentation = ['6071', '6072', '7690'].includes(result.account)
  if (isRepresentation && !reverseCharge) {
    result.account = result.account === '7690' ? '7690' : '6072'
    result.account_name = result.account === '7690' ? 'Övriga personalkostnader' : 'Representation, ej avdragsgill'
    result.vat_account = '2641'
    result.deductible = false
    result.deductible_percent = 0
  }

  // 4. Belopp — deterministiskt
  result.net_amount = net
  if (!reverseCharge) result.vat_amount = vat

  return result
}

function buildSystemPrompt(sources: string): string {
  return `Du är Tax Brain — en skattemässig analysmotor för svenska företag.

Din uppgift är att analysera en affärshändelse och returnera ett JSON-objekt.
Du får ALDRIG returnera något annat än JSON.

TILLGÄNGLIGA KÄLLOR:
${sources}

MOMSREGLER:
- Normalt avdragsgill ingående moms: konto 2641
- Ej avdragsgill moms (representation): konto 2641 (momsen kan vara delvis avdragsgill beroende på antal personer)
- Blandad användning privat/tjänst: konto 2640
- Omvänd skattskyldighet utgående: konto 2614
- Omvänd skattskyldighet ingående: konto 2645

OMVÄND MOMSSKYLDIGHET (viktigt):
Om tjänsten köps från utländsk leverantör (Facebook Ads, Google Ads, Claude/Anthropic, Adobe, Microsoft 365 etc.)
och fakturan saknar svensk moms (0%) — är det omvänd skattskyldighet enligt ML 1 kap. 2 §.
Köparen redovisar då både utgående moms (2614) och ingående moms (2645) i momsdeklarationen.
Sätt vat_account till "2614" och ange reverse_charge: true i JSON.
Vanliga konton för dessa tjänster: 6540 (IT-tjänster), 5420 (programvaror/SaaS), 6410 (marknadsföring).

VANLIGA KONTON (BAS-kontoplan):
- Datorer/IT förbrukningsinv.: 5410
- Datorer/IT inventarier: 1220
- Programvaror/SaaS: 5420
- IT-tjänster (hosting, API etc.): 6540
- Inköp av tjänster från EU-land (omvänd skattskyldighet): 4535
- Inköp av tjänster utanför EU (omvänd skattskyldighet): 4531
- Telefon/abonnemang: 5250
- Kontorsmaterial: 6110
- Representation (ej avdragsgill): 6072
- Representation intern: 7690
- Hyra lokal: 5010
- Resor inrikes: 5810
- Resor utrikes: 5830
- Lön: 7010
- Marknadsföring: 6410

RISKBEDÖMNING:
- LÅG: tydlig affärshändelse, ren verksamhetskoppling
- MEDEL: möjlig privat användning, representation, beloppsnära gränser
- HÖG: tydlig privat koppling, bilförmån, fåmansbolag-frågor, oklart syfte

REGLER:
1. Sätt confidence 0.5–0.7 om beskrivningen är vag
2. Om privatanvändning är möjlig men ej angiven — MEDEL risk + warning
3. Svara alltid på svenska i reasoning, risk_reason och warning
4. lagrum ska vara en array av strängar, t.ex. ["ML 1 kap. 2 §", "IL 16 kap. 1 §"]

RETURNERA EXAKT DETTA JSON-FORMAT:
{
  "account": "5420",
  "account_name": "Programvaror",
  "vat_account": "2641",
  "vat_amount": 0,
  "net_amount": 0,
  "deductible": true,
  "deductible_percent": 100,
  "depreciation_years": null,
  "risk": "LÅG",
  "risk_reason": "...",
  "lagrum": ["IL 16 kap. 1 §"],
  "confidence": 0.92,
  "reasoning": "...",
  "warning": null,
  "reverse_charge": false
}`
}

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
    return Response.json({ error: 'description och amount krävs' }, { status: 400 })
  }

  const vatRate     = input.vat_rate     ?? 25
  const vatIncluded = input.vat_included ?? true
  const entityType  = input.entity_type  ?? 'AB'
  const country     = input.country      ?? 'SE'

  const { net, vat } = calculateAmounts(input.amount, vatRate, vatIncluded)

  // Identifiera omvänd skattskyldighet tidigt
  const reverseCharge = isReverseCharge(input.description, country, vatRate)

  const searchQuery = `${input.description} ${input.category_hint || ''} bokföring kontering avdrag moms omvänd skattskyldighet`.trim()

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
    sourcesText = manualResults.map(r => `[${r.ref}] ${r.rubrik}\n${r.text}`).join('\n\n---\n\n')
  }

  const userPrompt = `Analysera denna affärshändelse:

Beskrivning: ${input.description}
Belopp: ${input.amount} kr${vatRate === 0 ? ' (ingen moms på fakturan)' : ` inkl. ${vatRate}% moms`}
Netto: ${net} kr
Moms: ${vat} kr
Bolagsform: ${entityType}
Land: ${country}
${reverseCharge ? 'OBS: Trolig omvänd skattskyldighet — utländsk tjänst utan svensk moms.' : ''}
${input.category_hint ? `Kategoriledtråd: ${input.category_hint}` : ''}

Returnera JSON-analys.`

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

  let result: TaxAnalyzeOutput
  try {
    result = JSON.parse(rawJson)
  } catch {
    return Response.json({ error: 'Kunde inte parsa AI-svar', raw: rawJson }, { status: 500 })
  }

  result = applyHardRules(result, net, vat, reverseCharge)

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
  } catch { /* tyst */ }

  return Response.json(result, {
    headers: { 'Content-Type': 'application/json', 'X-Tax-Brain-Version': '1.4' }
  })
}