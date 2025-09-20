import { NextResponse } from 'next/server'
import { handleSearch } from '@/lib/search-handler'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } }, { status: 400 })
  }
  const headers: Record<string, string | undefined> = {
    'x-test-mode': request.headers.get('x-test-mode') || undefined,
  }
  const { status, body: payload } = await handleSearch({ body, headers })
  return NextResponse.json(payload, { status })
}

