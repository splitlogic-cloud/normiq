import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 10
// Cache 24h — beloppen ändras inte under inkomståret
export const revalidate = 86400

// Fallback: SKV 2025 normalbelopp (verifierade från Skatteverkets publikation)
// Källa: SKV Allmänna råd om normalbelopp för beskattningsåret 2025
const FALLBACK_2025: Record<string, number> = {
  'Albanien': 323, 'Algeriet': 316, 'Angola': 506, 'Argentina': 368,
  'Armenien': 434, 'Australien': 711, 'Azerbajdzjan': 415, 'Bahamas': 1090,
  'Bahrain': 840, 'Bangladesh': 381, 'Barbados': 877, 'Belarus': 300,
  'Belgien': 856, 'Belize': 567, 'Bolivia': 389, 'Bosnien-Hercegovina': 337,
  'Botswana': 339, 'Brasilien': 356, 'Bulgarien': 436, 'Burkina Faso': 401,
  'Chile': 455, 'Colombia': 357, 'Costa Rica': 643, 'Cypern': 574,
  'Danmark': 1268, 'Djibouti': 589, 'Dominikanska republiken': 433,
  'Ecuador': 547, 'Egypten': 300, 'El Salvador': 439, 'Estland': 651,
  'Etiopien': 300, 'Fiji': 395, 'Filippinerna': 443, 'Finland': 952,
  'Frankrike': 810, 'Franska Polynesien': 883, 'Förenade Arabemiraten': 843,
  'Gabon': 620, 'Georgien': 311, 'Ghana': 552, 'Grekland': 718,
  'Guatemala': 533, 'Guinea': 628, 'Honduras': 401, 'Hong Kong': 853,
  'Indien': 300, 'Indonesien': 399, 'Irak': 563, 'Irland': 988,
  'Island': 1071, 'Israel': 912, 'Italien': 720, 'Jamaica': 402,
  'Japan': 368, 'Jordanien': 766, 'Kambodja': 505, 'Kamerun': 499,
  'Kanada': 853, 'Kazakstan': 334, 'Kenya': 447, 'Kina': 554,
  'Kroatien': 523, 'Kuba': 560, 'Kuwait': 809, 'Lettland': 727,
  'Liberia': 618, 'Liechtenstein': 1070, 'Litauen': 605, 'Luxemburg': 908,
  'Macao': 562, 'Malaysia': 303, 'Maldiverna': 478, 'Mali': 465,
  'Malta': 629, 'Marocko': 482, 'Mexiko': 535, 'Moldavien': 395,
  'Monaco': 1023, 'Mongoliet': 291, 'Montenegro': 371, 'Myanmar': 348,
  'Namibia': 300, 'Nederländerna': 711, 'Nepal': 300, 'Nicaragua': 448,
  'Niger': 374, 'Nordmakedonien': 295, 'Norge': 1095, 'Nya Zeeland': 499,
  'Oman': 784, 'Pakistan': 300, 'Panama': 641, 'Paraguay': 332,
  'Peru': 459, 'Polen': 569, 'Portugal': 587, 'Puerto Rico': 668,
  'Qatar': 797, 'Rumänien': 395, 'Ryssland': 630, 'Saudiarabien': 968,
  'Schweiz': 1269, 'Senegal': 596, 'Serbien': 508, 'Seychellerna': 806,
  'Singapore': 806, 'Slovakien': 703, 'Slovenien': 547, 'Spanien': 676,
  'Sri Lanka': 403, 'Storbritannien och Nordirland': 858, 'Sydafrika': 332,
  'Sydkorea': 493, 'Taiwan': 527, 'Tanzania': 315, 'Thailand': 495,
  'Tjeckien': 662, 'Trinidad och Tobago': 764, 'Tunisien': 300,
  'Turkiet': 345, 'Turkmenistan': 1385, 'Tyskland': 780, 'Uganda': 423,
  'Ukraina': 300, 'Ungern': 646, 'Uruguay': 569, 'USA': 1049,
  'Vietnam': 311, 'Zambia': 364, 'Österrike': 696, 'Övriga länder': 469,
}

export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get('year') || '2025'

  // Try SKV open data API first
  try {
    const apiUrl = `https://skatteverket.entryscape.net/rowstore/dataset/5e82e6d4-4e9c-4faa-a2ff-f1e3e8a38e07?ar=${year}&_limit=300`
    const res = await fetch(apiUrl, {
      next: { revalidate: 86400 },
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.results && data.results.length > 0) {
        const list = data.results.map((r: Record<string, string>) => ({
          land: r.land || r.Land || r.country,
          belopp: parseInt(r.belopp || r.Belopp || r.amount || '0'),
        })).filter((l: {land:string;belopp:number}) => l.land && l.belopp > 0)
        .sort((a: {land:string}, b: {land:string}) => a.land.localeCompare(b.land, 'sv'))

        return NextResponse.json({ source: 'skv-api', year, list })
      }
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: return hardcoded 2025 list
  const list = Object.entries(FALLBACK_2025)
    .map(([land, belopp]) => ({ land, belopp }))
    .sort((a, b) => a.land.localeCompare(b.land, 'sv'))

  return NextResponse.json({ source: 'fallback', year: '2025', list })
}