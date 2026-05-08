'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Warehouse,
  ChevronDown,
  Search,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { api } from '@/lib/api'

interface LotStock {
  lotNumber: string
  totalIn: number
  totalOut: number
  balance: number
}
interface ProductStock {
  product: string
  totalIn: number
  totalOut: number
  balance: number
  unit: string | null
  lots: LotStock[]
}

function balanceChipCls(balance: number): string {
  if (balance > 0) return 'syn-chip-ok'
  if (balance < 0) return 'syn-chip-fail'
  return 'syn-chip-draft'
}

export default function StockPage() {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: products = [], isLoading } = useQuery<ProductStock[]>({
    queryKey: ['stock-summary'],
    queryFn: () => api.stock.summary() as Promise<ProductStock[]>,
  })

  const filtered = products.filter(
    (p) =>
      p.product.toLowerCase().includes(search.toLowerCase()) ||
      p.lots.some((l) => l.lotNumber.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="syn-ph">
        <div>
          <div className="kicker mb-2">· Seguimiento · Stock</div>
          <h1>
            Saldos por <span className="italic">producto.</span>
          </h1>
          <p className="sub">
            Ingresos, egresos y balance por lote. Cada movimiento nace de una entrada en un registro tipo Stock.
          </p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-[420px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: 'var(--ink-3)' }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por producto o lote…"
            className="h-[38px] w-full rounded-[10px] border pl-10 pr-3 text-[13px] outline-none"
            style={{
              background: 'var(--bg-1)',
              borderColor: 'var(--line-2)',
              color: 'var(--ink-0)',
            }}
          />
        </div>
        <div
          className="ml-auto font-mono text-[11px] uppercase tracking-[0.14em]"
          style={{ color: 'var(--ink-3)' }}
        >
          {filtered.length} {filtered.length === 1 ? 'producto' : 'productos'}
        </div>
      </div>

      <div className="syn-card">
        {isLoading ? (
          <div className="p-8" style={{ color: 'var(--ink-3)' }}>
            Cargando…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasFilter={!!search} />
        ) : (
          <div>
            {filtered.map((p) => {
              const isOpen = expanded === p.product
              return (
                <div
                  key={p.product}
                  style={{
                    borderTop: '1px solid var(--line)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : p.product)}
                    className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--bg-3)]"
                  >
                    <ChevronDown
                      className="h-4 w-4 transition-transform"
                      style={{
                        color: 'var(--ink-3)',
                        transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="truncate text-[14px] font-medium"
                        style={{ color: 'var(--ink-0)' }}
                      >
                        {p.product}
                      </div>
                      <div
                        className="mt-0.5 text-[11px]"
                        style={{ color: 'var(--ink-3)' }}
                      >
                        {p.lots.length} lote{p.lots.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="hidden items-center gap-3 sm:flex">
                      <span
                        className="inline-flex items-center gap-1 font-mono text-[12px]"
                        style={{ color: 'var(--ok)' }}
                      >
                        <TrendingUp className="h-3 w-3" />
                        {p.totalIn}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 font-mono text-[12px]"
                        style={{ color: 'var(--danger)' }}
                      >
                        <TrendingDown className="h-3 w-3" />
                        {p.totalOut}
                      </span>
                    </div>
                    <span
                      className={`syn-chip ${balanceChipCls(p.balance)}`}
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {p.balance}
                      {p.unit ? ` ${p.unit}` : ''}
                    </span>
                  </button>

                  {isOpen && (
                    <div
                      style={{
                        borderTop: '1px solid var(--line)',
                        background: 'var(--bg-2)',
                        padding: '0',
                      }}
                    >
                      <table className="syn-table" style={{ background: 'transparent' }}>
                        <thead>
                          <tr>
                            <th>Lote</th>
                            <th style={{ textAlign: 'right' }}>Ingresos</th>
                            <th style={{ textAlign: 'right' }}>Egresos</th>
                            <th style={{ textAlign: 'right' }}>Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.lots.map((lot) => (
                            <tr key={lot.lotNumber}>
                              <td
                                data-label="Lote"
                                data-role="identifier"
                                className="col-mono"
                              >
                                {lot.lotNumber}
                              </td>
                              <td
                                data-label="Ingresos"
                                className="col-mono"
                                style={{
                                  textAlign: 'right',
                                  color: 'var(--ok)',
                                }}
                              >
                                +{lot.totalIn}
                              </td>
                              <td
                                data-label="Egresos"
                                className="col-mono"
                                style={{
                                  textAlign: 'right',
                                  color: 'var(--danger)',
                                }}
                              >
                                -{lot.totalOut}
                              </td>
                              <td
                                data-label="Saldo"
                                data-role="status"
                                className="col-mono"
                                style={{
                                  textAlign: 'right',
                                  fontWeight: 500,
                                  color:
                                    lot.balance > 0
                                      ? 'var(--ok)'
                                      : lot.balance < 0
                                        ? 'var(--danger)'
                                        : 'var(--ink-1)',
                                }}
                              >
                                {lot.balance} {p.unit || ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center"
      style={{ color: 'var(--ink-2)' }}
    >
      <Warehouse className="h-8 w-8" style={{ color: 'var(--ink-4)' }} />
      <div
        className="text-[24px]"
        style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink-0)' }}
      >
        {hasFilter ? (
          <>
            Sin <span className="italic">coincidencias.</span>
          </>
        ) : (
          <>
            Sin <span className="italic">movimientos.</span>
          </>
        )}
      </div>
      <p className="max-w-sm text-[13px]" style={{ color: 'var(--ink-2)' }}>
        {hasFilter
          ? 'Probá cambiar la búsqueda.'
          : 'Creá un registro tipo Stock y agregá entradas para empezar a mover inventario.'}
      </p>
    </div>
  )
}
