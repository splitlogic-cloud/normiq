import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

// Auth is handled by middleware.ts — /deklarera requires login
// Add Stripe plan check here later when ready

const SYSTEM = `Du är en erfaren svensk skatteexpert och redovisningskonsult med djup kunskap om:
- Blankett NE, N3A, INK2 (taxeringsår 2025, inkomstår 2024)
- BAS-kontoplanen och NE-radernas mappning
- Periodiseringsfond (IL 30 kap), expansionsfond (IL 34 kap), räntefördelning (IL 33 kap)
- Egenavgifter, 25%-avdraget och §G-justeringen (SAL)
- Pension för enskild firma (IL 28:5)
- Aktuella satser och belopp för inkomstår 2024

Regler:
- Svara ALLTID på svenska
- Var konkret — nämn alltid exakta belopp, procentsatser och lagrum
- Håll svar under 280 ord om möjligt
- Nämn att AI-svar bör granskas av redovisningskonsult vid komplexa frågor
- Hänvisa till IL §§ vid regelbaserade påståenden`

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Ogiltiga meddelanden' }, { status: 400 })
    }

    // Keep last 10 messages to stay within context limits
    const trimmed = messages.slice(-10).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: String(m.content).slice(0, 2000), // truncate per message
    }))

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM,
        messages: trimmed,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic error:', err)
      return NextResponse.json({ error: 'AI-tjänsten svarade inte' }, { status: 502 })
    }

    const data = await response.json()
    const text = data.content
      ?.filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('') || ''

    return NextResponse.json({ response: text })

  } catch (err) {
    console.error('Chat route error:', err)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}
