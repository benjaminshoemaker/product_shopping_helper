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

function mockFetch(resp: { status: number; body: any }) {
  return vi.fn().mockImplementation((url: string, init?: any) => {
    if (url.toString().includes('/api/catalog')) {
      return Promise.resolve(new Response(JSON.stringify(catalog), { status: 200 }))
    }
    return Promise.resolve(new Response(JSON.stringify(resp.body), { status: resp.status }))
  })
}

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

describe('Summary rendering', () => {
  test('renders Summary when explanation provided', async () => {
    const body = {
      constraints: { query: 'q' },
      weights: {},
      items: [
        { id: 'b', overall: 0.9, reason: 'Waterproof' },
        { id: 'a', overall: 0.8, reason: 'Under budget' },
      ],
      explanation: {
        whyTop: 'Top results balance price and rating.',
        whatCouldChange: ['If shipping mattered more, A improves.'],
        missingData: ['weight_oz'],
      },
    }
    global.fetch = mockFetch({ status: 200, body }) as any
    render(<Page />)
    const [textarea] = await screen.findAllByPlaceholderText(/trail running shoes/i)
    fireEvent.change(textarea, { target: { value: 'waterproof under $150' } })
    const buttons = screen.getAllByRole('button', { name: /find matches/i })
    const button = buttons.find((b) => !b.hasAttribute('disabled')) || buttons[0]
    fireEvent.click(button)

    await screen.findByText(/Summary/i)
    await screen.findByText(/Top results balance price and rating/i)
    await screen.findByText(/If shipping mattered more/i)
    await screen.findByText(/Data that could change results/i)
  })

  test('hides Summary when no explanation', async () => {
    const body = {
      constraints: { query: 'q' },
      weights: {},
      items: [
        { id: 'b', overall: 0.9, reason: 'Waterproof' },
        { id: 'a', overall: 0.8, reason: 'Under budget' },
      ],
    }
    global.fetch = mockFetch({ status: 200, body }) as any
    render(<Page />)
    const [textarea] = await screen.findAllByPlaceholderText(/trail running shoes/i)
    fireEvent.change(textarea, { target: { value: 'waterproof under $150' } })
    const buttons = screen.getAllByRole('button', { name: /find matches/i })
    const button = buttons.find((b) => !b.hasAttribute('disabled')) || buttons[0]
    fireEvent.click(button)

    await screen.findByText(/Bravo GTX/i)
    expect(screen.queryByText(/Summary/i)).toBeNull()
  })
})

