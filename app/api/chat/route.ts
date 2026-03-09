import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { searchDocuments } from '@/lib/embed'
import { rules, searchRules } from '@/lib/rules'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function extractRisk(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes('risk: hög') || lower.includes('risk:hög')) return 'HÖG'
  if (lower.includes('risk: medel') || lower.includes('risk:medel')) return 'MEDEL'
  return 'LÅG'
}

function detectQuestionType(q: string): 'bokforing' | 'skatt' | 'generell' {
  const q2 = q.toLowerCase()
  const bokforing = ['bokför', 'konter', 'debet', 'kredit', 'konto', 'bokslut', 'k2', 'k3', 'bas-konto', 'periodisera', 'avskrivning', 'balansräkning', 'resultaträkning', 'årsredovisning', 'lager', 'inventarie', 'periodisering', 'upplupna', 'förutbetalda', 'kundförlust', 'inkurans']
  const skatt = ['skatt', 'moms', 'avdrag', 'f-skatt', 'fåmansbolag', '3:12', 'utdelning', 'förmån', 'representation', 'rot', 'rut', 'kapitalvinst', 'inkomstskatt', 'arbetsgivaravgift', 'egenavgift', 'gränsbelopp']
  if (bokforing.some(w => q2.includes(w))) return 'bokforing'
  if (skatt.some(w => q2.includes(w))) return 'skatt'
  return 'generell'
}

export async function POST(req: Request) {
  const { messages, sessionId } = await req.json()
  const lastQuestion = messages[messages.length - 1].content
  const questionType = detectQuestionType(lastQuestion)

  let regelkontext = ''
  let sources: string[] = []
  let usedFallback = false

  try {
    const vectorResults = await searchDocuments(lastQuestion, 12)
    if (vectorResults && vectorResults.length > 0 && vectorResults[0].similarity > 0.15) {
      regelkontext = vectorResults
        .map((r: { content: string; metadata: { ref: string; rubrik: string } }) =>
          `[${r.metadata?.ref || 'REF'}] — ${r.metadata?.rubrik || ''}\n${r.content}`
        )
        .join('\n\n')
      sources = vectorResults.map((r: { metadata: { ref: string } }) => r.metadata?.ref || '')
    } else {
      throw new Error('no vector results')
    }
  } catch {
    usedFallback = true
    const relevant = searchRules(lastQuestion)
    const fallback = relevant.length === 0 ? rules.slice(0, 5) : relevant
    regelkontext = fallback.map(r => `[${r.ref}] — ${r.rubrik}\n${r.text}`).join('\n\n')
    sources = fallback.map(r => r.ref)
  }

  // Komplettera alltid med manuella regler vid bokföringsfrågor
  if (questionType === 'bokforing') {
    const manuellaRegler = searchRules(lastQuestion)
    if (manuellaRegler.length > 0) {
      const extra = manuellaRegler
        .filter(r => !sources.includes(r.ref))
        .map(r => `[${r.ref}] — ${r.rubrik}\n${r.text}`)
        .join('\n\n')
      if (extra) regelkontext += '\n\n--- Kompletterande bokföringsregler ---\n\n' + extra
    }
  }

  const bokforingExtra = questionType === 'bokforing' ? `

EXTRA INSTRUKTIONER FÖR BOKFÖRINGSFRÅGOR:
- Ange alltid BAS-kontonummer med kontonamn (t.ex. Debet 7010 Löner, Kredit 2710 Personalskatt)
- Visa konteringsrader i formatet: Debet XXXX Kontonamn / Kredit XXXX Kontonamn
- Förklara om K2 och K3 ger olika svar
- Ange om det finns skattemässig skillnad mot redovisningsmässig behandling
- Var alltid konkret med siffror i exemplet` : ''

  const fallbackWarning = usedFallback
    ? `\n\nOBS: Svaret baseras på det manuella regelindexet. Verifiera med aktuell lagtext.`
    : ''

  const system = `Du är Normiq, en professionell AI-assistent för svensk skatt, bokföring och redovisning. Du hjälper redovisningskonsulter, revisorer och företagare med korrekta svar baserade på svenska lagar och regler.

Du har tillgång till följande regeltext:

${regelkontext}${fallbackWarning}${bokforingExtra}

SVARSSTRUKTUR — använd alltid exakt dessa separatorer:

## [Tydlig rubrik]

[Korrekt svar med källhänvisningar i formatet [IL 16 kap. 2 §]]

---FÖRENKLAT---
Enkelt uttryckt: [2-3 meningar på enkel svenska]

---EXEMPEL---
Exempel: [Konkret exempel med siffror. Vid bokföringsfrågor: visa konteringsrader]

Källor: [kommaseparerad lista]
Risk: LÅG — [motivering]

VIKTIGA REGLER:
1. Risk-raden ska ALLTID vara absolut sista raden i svaret
2. Risk börjar alltid med exakt "Risk: " följt av LÅG, MEDEL eller HÖG och ett tankstreck
3. Använd ALDRIG bullet points (•) eller bindestreck (-) som prefix på Risk-raden
4. Inga rader efter Risk-raden
5. Citera alltid med exakt lagrum [IL 57 kap. 10 §]
6. Vid bokföringsfrågor: inkludera alltid BAS-kontonummer
7. Om svaret saknas i regelkontexten: säg det explicit och sätt Risk: HÖG
8. Svara alltid på svenska
9. Var konkret — undvik vaga svar`

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2000,
    system,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  })

  const answer = response.content[0].type === 'text' ? response.content[0].text : ''
  const risk_level = extractRisk(answer)

  try {
    await supabase.from('queries').insert({
      question: lastQuestion,
      answer,
      sources,
      risk_level,
      session_id: sessionId || 'anonymous',
    })
  } catch (_) {}

  return Response.json({ content: answer, sources, risk_level })
}