import { checkRule } from '@/lib/rules'

export async function POST(req: Request) {
  const { regeltyp, params } = await req.json()
  const result = checkRule(regeltyp, params)
  if (!result) return Response.json({ error: 'Ingen regel hittad för: ' + regeltyp }, { status: 404 })
  return Response.json(result)
}