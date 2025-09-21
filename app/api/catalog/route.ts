import { NextResponse } from 'next/server'
import { getCatalog } from '@/lib/catalog'

export async function GET() {
  const { products } = await getCatalog()
  return NextResponse.json({ products })
}

