import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function embedAndStore(
  text: string,
  metadata: { ref: string; rubrik: string; lag: string }
) {
  // Dela upp i chunks om texten är lång
  const chunks = splitIntoChunks(text, 500)

  for (const chunk of chunks) {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunk,
    })

    const embedding = response.data[0].embedding

    await supabase.from('documents').insert({
      content: chunk,
      metadata,
      embedding,
    })
  }
}

export async function searchDocuments(query: string, count = 5) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  })

  const embedding = response.data[0].embedding

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_count: count,
  })

  if (error) throw error
  return data
}

function splitIntoChunks(text: string, maxWords: number): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    const words = (current + ' ' + sentence).trim().split(' ')
    if (words.length > maxWords && current) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current = (current + ' ' + sentence).trim()
    }
  }

  if (current) chunks.push(current.trim())
  return chunks
}