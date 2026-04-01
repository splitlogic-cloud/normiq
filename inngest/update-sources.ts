/**
 * Normiq — Nattlig källuppdatering via Inngest
 * =============================================
 * Paragraf-aware chunkning + chunk-begränsning för att undvika Vercel timeout.
 * Körs varje natt kl 02:00 UTC.
 */

import { inngest } from '@/lib/inngest'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { Resend } from 'resend'

// ── INSTÄLLNINGAR ─────────────────────────────────────────────────────────

const BATCH_SIZE  = 10
const DELAY_MS    = 200
const MAX_CHUNKS  = 100   // Max chunks per källa (undviker 60s Vercel timeout)
const MAX_TEXT    = 150_000 // Max tecken att processa per källa

// ── TYPER ─────────────────────────────────────────────────────────────────

interface Chunk {
  ref: string
  rubrik: string
  lag: string
  text: string
}

type IndexResult = {
  ref: string
  status: 'updated' | 'unchanged' | 'failed'
  chunks: number
  error: string
}

// ── HJÄLPFUNKTIONER ───────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Paragraf-aware chunkning — delar vid §-tecken
function chunkByParagraph(text: string, kortnamn: string, lagnamn: string): Chunk[] {
  const limited = text.slice(0, MAX_TEXT)
  const chunks: Chunk[] = []
  const lines = limited.split(/\s{2,}|\n/).map(l => l.trim()).filter(l => l.length > 10)

  let currentKapitel = ''
  let currentRubrik  = ''
  let buffer         = ''
  let currentPar     = ''

  const saveChunk = () => {
    if (buffer.trim().length > 80 && currentPar) {
      const ref = `${kortnamn} ${currentKapitel} ${currentPar}`.trim().replace(/\s+/g, ' ')
      chunks.push({
        ref,
        rubrik: currentRubrik || lagnamn,
        lag: lagnamn,
        text: `[${ref}] ${currentRubrik}\n\n${buffer.trim()}`,
      })
    }
  }

  for (const line of lines) {
    if (chunks.length >= MAX_CHUNKS) break

    const kapMatch = line.match(/^(\d+)\s+kap\.?\s*(.*)/i)
    if (kapMatch) {
      saveChunk(); buffer = ''; currentPar = ''
      currentKapitel = `${kapMatch[1]} kap.`
      currentRubrik  = kapMatch[2]?.replace(/[*_]+/g, '').trim() || ''
      continue
    }

    const parMatch = line.match(/^(\d+)\s*§/) || line.match(/^§\s*(\d+)/)
    if (parMatch) {
      saveChunk(); buffer = line
      currentPar = `${parMatch[1]} §`
      continue
    }

    if (currentPar) buffer += ' ' + line
  }
  saveChunk()

  // Fallback om paragraf-parsing gav för lite
  if (chunks.length < 3) {
    return chunkByWords(limited, kortnamn, lagnamn, lagnamn)
  }

  return chunks.slice(0, MAX_CHUNKS)
}

function chunkByWords(text: string, ref: string, rubrik: string, lag: string): Chunk[] {
  const CHUNK_SIZE = 500
  const OVERLAP    = 80
  const words = text.slice(0, MAX_TEXT).split(/\s+/).filter(Boolean)
  const chunks: Chunk[] = []
  for (let i = 0; i < words.length && chunks.length < MAX_CHUNKS; i += CHUNK_SIZE - OVERLAP) {
    const chunk = words.slice(i, i + CHUNK_SIZE).join(' ').trim()
    if (chunk.length > 80) chunks.push({ ref, rubrik, lag, text: chunk })
  }
  return chunks
}

async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Normiq/2.0 (normiq.se)',
        'Accept': 'text/html',
        'Accept-Language': 'sv-SE,sv;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return ''
    return stripHtml(await res.text())
  } catch { return '' }
}

async function indexSource(params: {
  ref: string
  lagnamn: string
  text: string
  url: string
  rubrik?: string
  useParagraphChunking?: boolean
}): Promise<IndexResult> {
  const { ref, lagnamn, text, url, rubrik, useParagraphChunking = false } = params

  if (!text || text.length < 300) {
    return { ref, status: 'failed', chunks: 0, error: `För lite text: ${text.length} tecken` }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

  const hash = createHash('sha256').update(text.slice(0, 20000)).digest('hex').slice(0, 16)

  const { data: existing } = await supabase
    .from('source_versions')
    .select('content_hash')
    .eq('ref', ref)
    .single()

  if (existing?.content_hash === hash) {
    return { ref, status: 'unchanged', chunks: 0, error: '' }
  }

  // Radera gamla chunks
  await supabase.from('documents').delete().eq('metadata->>ref', ref)

  // Chunka
  const chunks = useParagraphChunking
    ? chunkByParagraph(text, ref, lagnamn)
    : chunkByWords(text, ref, rubrik || ref, lagnamn)

  if (chunks.length === 0) {
    return { ref, status: 'failed', chunks: 0, error: 'Inga chunks genererades' }
  }

  // Embedda och spara
  let saved = 0
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    try {
      const embRes = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch.map(c => c.text),
      })
      const rows = batch.map((chunk, j) => ({
        content: chunk.text,
        metadata: { ref: chunk.ref, rubrik: chunk.rubrik, lag: chunk.lag },
        embedding: embRes.data[j].embedding,
      }))
      const { error } = await supabase.from('documents').insert(rows)
      if (!error) saved += batch.length
    } catch (e) {
      console.error(`Embed error: ${e}`)
    }
    await sleep(DELAY_MS)
  }

  // Spara hash
  await supabase.from('source_versions').upsert({
    ref, content_hash: hash, url,
    updated_at: new Date().toISOString(),
  })

  return {
    ref,
    status: saved > 0 ? 'updated' : 'failed',
    chunks: saved,
    error: saved === 0 ? 'Embedding misslyckades' : '',
  }
}

// ── INNGEST-FUNKTION ──────────────────────────────────────────────────────

export const updateSources = inngest.createFunction(
  {
    id: 'update-sources',
    name: 'Nattlig källuppdatering',
    concurrency: { limit: 1 },
    triggers: [{ cron: '0 1 * * *' }],
  },
  async ({ step }) => {

    // ── Lagar med paragraf-aware chunkning ──
    const ilResult = await step.run('index-IL', () =>
      fetchText('https://rkrattsbaser.gov.se/sfst?bet=1999:1229').then(t =>
        indexSource({ ref: 'IL', lagnamn: 'Inkomstskattelagen', text: t, url: 'https://rkrattsbaser.gov.se/sfst?bet=1999:1229', useParagraphChunking: true })
      )
    )
    const mlResult = await step.run('index-ML', () =>
      fetchText('https://rkrattsbaser.gov.se/sfst?bet=2023:200').then(t =>
        indexSource({ ref: 'ML', lagnamn: 'Mervärdesskattelagen', text: t, url: 'https://rkrattsbaser.gov.se/sfst?bet=2023:200', useParagraphChunking: true })
      )
    )
    const sflResult = await step.run('index-SFL', () =>
      fetchText('https://rkrattsbaser.gov.se/sfst?bet=2011:1244').then(t =>
        indexSource({ ref: 'SFL', lagnamn: 'Skatteförfarandelagen', text: t, url: 'https://rkrattsbaser.gov.se/sfst?bet=2011:1244', useParagraphChunking: true })
      )
    )
    const bflResult = await step.run('index-BFL', () =>
      fetchText('https://rkrattsbaser.gov.se/sfst?bet=1999:1078').then(t =>
        indexSource({ ref: 'BFL', lagnamn: 'Bokföringslagen', text: t, url: 'https://rkrattsbaser.gov.se/sfst?bet=1999:1078', useParagraphChunking: true })
      )
    )
    const ablResult = await step.run('index-ABL', () =>
      fetchText('https://rkrattsbaser.gov.se/sfst?bet=2005:551').then(t =>
        indexSource({ ref: 'ABL', lagnamn: 'Aktiebolagslagen', text: t, url: 'https://rkrattsbaser.gov.se/sfst?bet=2005:551', useParagraphChunking: true })
      )
    )

    // ── SKV rättslig vägledning ──
    const skvRep = await step.run('index-SKV-representation', () =>
      fetchText('https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/1508.html').then(t =>
        indexSource({ ref: 'SKV-representation', lagnamn: 'Skatteverkets vägledning', rubrik: 'Representation', text: t, url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/1508.html' })
      )
    )
    const skvTrak = await step.run('index-SKV-traktamente', () =>
      fetchText('https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/1600.html').then(t =>
        indexSource({ ref: 'SKV-traktamente', lagnamn: 'Skatteverkets vägledning', rubrik: 'Traktamente', text: t, url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/1600.html' })
      )
    )
    const skvForm = await step.run('index-SKV-personalformaner', () =>
      fetchText('https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/1400.html').then(t =>
        indexSource({ ref: 'SKV-personalformaner', lagnamn: 'Skatteverkets vägledning', rubrik: 'Personalförmåner', text: t, url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/1400.html' })
      )
    )
    const skv312 = await step.run('index-SKV-3-12', () =>
      fetchText('https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/3300.html').then(t =>
        indexSource({ ref: 'SKV-utdelning-3-12', lagnamn: 'Skatteverkets vägledning', rubrik: 'Utdelning fåmansföretag 3:12', text: t, url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/3300.html' })
      )
    )
    const skvMoms = await step.run('index-SKV-moms', () =>
      fetchText('https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/2940.html').then(t =>
        indexSource({ ref: 'SKV-moms-allmant', lagnamn: 'Skatteverkets vägledning', rubrik: 'Moms — allmänt', text: t, url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/2940.html' })
      )
    )
    const skvAvdrag = await step.run('index-SKV-avdrag', () =>
      fetchText('https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/1100.html').then(t =>
        indexSource({ ref: 'SKV-avdrag', lagnamn: 'Skatteverkets vägledning', rubrik: 'Avdrag i näringsverksamhet', text: t, url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/1100.html' })
      )
    )

    // ── Rapport ──
    await step.run('send-report', async () => {
      const all = [ilResult, mlResult, sflResult, bflResult, ablResult, skvRep, skvTrak, skvForm, skv312, skvMoms, skvAvdrag]
      const updated   = all.filter(r => r.status === 'updated')
      const failed    = all.filter(r => r.status === 'failed')
      const unchanged = all.filter(r => r.status === 'unchanged')
      const total     = updated.reduce((s, r) => s + r.chunks, 0)

      if (updated.length === 0 && failed.length === 0) {
        return { message: 'Inga ändringar', unchanged: unchanged.length }
      }

      const resend = new Resend(process.env.RESEND_API_KEY!)
      await resend.emails.send({
        from: 'Normiq <hej@normiq.se>',
        to: 'hej@normiq.se',
        subject: updated.length > 0
          ? `✓ Normiq: ${updated.length} källfiler uppdaterade (${total} chunks)`
          : `⚠ Normiq: ${failed.length} misslyckades`,
        html: `
          <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 32px;background:#F5F3EE">
            <div style="font-family:monospace;font-size:24px;font-weight:600;color:#0A0A0C;margin-bottom:24px">
              normi<span style="color:#C0321A">q</span>
            </div>
            <h2 style="font-size:20px;color:#0A0A0C;margin-bottom:20px">Källuppdatering — ${new Date().toLocaleDateString('sv-SE')}</h2>
            ${updated.length > 0 ? `
            <div style="background:#EEF6F1;border:1px solid #BFD9CC;border-radius:6px;padding:16px 20px;margin-bottom:16px">
              <div style="font-family:monospace;font-size:11px;color:#2E6644;text-transform:uppercase;margin-bottom:8px">Uppdaterat — ${total} chunks</div>
              ${updated.map(r => `<div style="font-size:13px;color:#2E6644;margin:4px 0">✓ ${r.ref} — ${r.chunks} chunks</div>`).join('')}
            </div>` : ''}
            ${failed.length > 0 ? `
            <div style="background:#FDF4F3;border:1px solid rgba(192,50,26,.2);border-radius:6px;padding:16px 20px;margin-bottom:16px">
              <div style="font-family:monospace;font-size:11px;color:#C0321A;text-transform:uppercase;margin-bottom:8px">Misslyckades (${failed.length})</div>
              ${failed.map(r => `<div style="font-size:13px;color:#C0321A;margin:4px 0">✕ ${r.ref}${r.error ? ` — ${r.error}` : ''}</div>`).join('')}
            </div>` : ''}
            <div style="font-family:monospace;font-size:11px;color:#CCC;margin-top:24px">
              Oförändrade: ${unchanged.length} · ${new Date().toISOString()}
            </div>
          </div>`,
      })
      return { updated: updated.length, failed: failed.length, unchanged: unchanged.length, total }
    })

    return { IL: ilResult, ML: mlResult, SFL: sflResult, BFL: bflResult, ABL: ablResult }
  }
)

export const triggerSourceUpdate = inngest.createFunction(
  {
    id: 'trigger-source-update',
    name: 'Manuell källuppdatering',
    triggers: [{ event: 'normiq/sources.update' }],
  },
  async ({ step }) => {
    await step.invoke('run-update', { function: updateSources, data: {} })
  }
)