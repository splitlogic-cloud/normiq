import { NextResponse } from 'next/server'

export async function GET() {
  const urls = [
    'https://rkrattsbaser.gov.se/sfst?bet=2023:200',
    'https://www.skatteverket.se/foretagochorganisationer/moms/momssatser.4.html',
    'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/2023-200/',
  ]

  const results = await Promise.all(urls.map(async url => {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Normiq/2.0 (normiq.se)' },
        signal: AbortSignal.timeout(10000),
      })
      const text = await res.text()
      return { url, status: res.status, length: text.length, ok: res.ok }
    } catch (err) {
      return { url, status: 0, length: 0, ok: false, error: String(err) }
    }
  }))

  return NextResponse.json(results)
}