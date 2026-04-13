import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Ingen fil uppladdad' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = file.type || 'image/jpeg'
    const isPdf = mimeType === 'application/pdf'
    const isImage = mimeType.startsWith('image/')

    if (!isImage && !isPdf) {
      return NextResponse.json(
        { error: 'Stöder bara bilder (JPG, PNG, WEBP) och PDF' },
        { status: 400 }
      )
    }

    const extractPrompt = `Analysera detta kvitto/faktura och extrahera följande information. Returnera ENDAST ett JSON-objekt, ingen annan text.

JSON-format:
{
  "description": "kort beskrivning på svenska av vad kvittot avser (t.ex. 'Restaurangbesök', 'Kontorsmaterial', 'Hotell')",
  "amount": totalt belopp som nummer (inkl. moms om moms finns),
  "vat_rate": momssats som nummer (0, 6, 12 eller 25),
  "vat_included": true,
  "date": "datum i format YYYY-MM-DD om det finns",
  "vendor": "leverantörens namn om det finns"
}

Regler:
- amount ska vara det totala beloppet kunden betalade
- Om momssatsen inte syns tydligt, anta 25%
- Om kvittot är från restaurang/café, anta 12% moms
- description ska vara på svenska`

    // Bygg content-array beroende på filtyp
    let messages: Anthropic.MessageParam[]

    if (isPdf) {
      messages = [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          },
          { type: 'text', text: extractPrompt },
        ],
      }]
    } else {
      const imageMediaType = mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
      messages = [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageMediaType,
              data: base64,
            },
          },
          { type: 'text', text: extractPrompt },
        ],
      }]
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 500,
      messages,
    })

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => (b.type === 'text' ? b.text : ''))
      .join('')
      .replace(/```json|```/g, '')
      .trim()

    let parsed
    try {
      parsed = JSON.parse(rawText)
    } catch {
      return NextResponse.json(
        { error: 'Kunde inte tolka kvittot', raw: rawText },
        { status: 422 }
      )
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Parse receipt error:', err)
    return NextResponse.json(
      { error: 'Fel vid kvittotolkning', details: String(err) },
      { status: 500 }
    )
  }
}