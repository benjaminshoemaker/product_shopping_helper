import React from 'react'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import Page from '../app/page'

const catalog = {
  products: [
    { id: 'a', title: 'Alpha Shoe', brand: 'Nike', price: 120, rating: 4.5, shipDays: 3, features: { waterproof: false }, image: '/placeholder.svg', url: '#' },
    { id: 'b', title: 'Bravo GTX', brand: 'Hoka', price: 150, rating: 4.7, shipDays: 5, features: { waterproof: true }, image: '/placeholder.svg', url: '#' },
  ],
}

function mockFetchSequence(responses: Array<{ status: number; body: any }>) {
  let i = 0
  return vi.fn().mockImplementation((url: string, init?: any) => {
    if (url.toString().includes('/api/catalog')) {
      return Promise.resolve(new Response(JSON.stringify(catalog), { status: 200 }))
    }
    const r = responses[Math.min(i, responses.length - 1)]
    i += 1
    return Promise.resolve(new Response(JSON.stringify(r.body), { status: r.status }))
  })
}

describe('Search UI integrates with /api/search', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    ;(global as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('renders top item and reason from API', async () => {
    const items = [
      { id: 'b', overall: 0.9, reason: 'Waterproof' },
      { id: 'a', overall: 0.8, reason: 'Under budget' },
    ]
    // First fetch is /api/catalog; then POST /api/search
    global.fetch = mockFetchSequence([{ status: 200, body: { constraints: { query: 'q' }, weights: {}, items, meta: {} } }]) as any

    render(<Page />)

    // Type query and submit
    const textarea = await screen.findByPlaceholderText(/trail running shoes/i)
    fireEvent.change(textarea, { target: { value: 'waterproof under $150' } })
    const button = screen.getByRole('button', { name: /find matches/i })
    fireEvent.click(button)

    // Top item title and reason should render
    await screen.findByText(/Bravo GTX/i)
    // Overall percent visible
    expect(screen.getByText(/90%/i)).toBeTruthy()
  })

  test('shows fallback banner on 422 fallback', async () => {
    const fallback = { fallback: true, items: [{ id: 'a' }, { id: 'b' }] }
    global.fetch = mockFetchSequence([{ status: 422, body: fallback }]) as any

    render(<Page />)

    const [textarea] = await screen.findAllByPlaceholderText(/trail running shoes/i)
    fireEvent.change(textarea, { target: { value: 'waterproof' } })
    const buttons = screen.getAllByRole('button', { name: /find matches/i })
    const button = buttons.find((b) => !b.hasAttribute('disabled')) || buttons[0]
    fireEvent.click(button)

    await screen.findByText(/Showing unranked fallback/i)
  })
})
