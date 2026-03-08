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

export async function POST(req: Request) {
  const { messages, sessionId } = await req.json()
  const lastQuestion = messages[messages.length - 1].content

  let regelkontext = ''
  let sources: string[] = []
  let usedFallback = false

  try {
    const vectorResults = await searchDocuments(lastQuestion, 10)

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

  const fallbackWarning = usedFallback
    ? `\n\nOBS: Svaret baseras på det manuella regelindexet. Verifiera med aktuell lagtext. Sätt Risk: MEDEL om frågan är enkel, annars HÖG.`
    : ''

  const system = `Du är Normiq, en professionell AI-assistent för svensk skatt och redovisning.

Du har tillgång till följande regeltext från svenska lagar:

${regelkontext}${fallbackWarning}

INSTRUKTIONER:
1. Ge ett juridiskt precist svar baserat på regelkontexten ovan
2. Citera alltid med exakt referens i formatet [IL 57 kap. 10 §]
3. Om frågan berör 3:12-regler eller fåmansbolag — förklara gränsbelopp, schablonmetod vs huvudregel
4. Strukturera alltid svaret i tre delar med exakt dessa separatorer:

## [Rubrik]

[Juridiskt svar med källhänvisningar]

---FÖRENKLAT---
Enkelt uttryckt: [2-3 meningar i plain svenska]

---EXEMPEL---
Exempel: [Konkret räkneexempel med siffror]

Källor: [kommaseparerad lista med refs]
Risk: LÅG / MEDEL / HÖG — [kort motivering]

5. Om svaret inte finns i regelkontexten — säg det explicit och sätt Risk: HÖG
6. Svara alltid på svenska`

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1500,
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