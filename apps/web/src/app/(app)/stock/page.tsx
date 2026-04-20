'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Warehouse, ChevronRight, ChevronDown, Loader2, Search, Package, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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

export default function StockPage() {
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['stock-summary'],
    queryFn: () => api.stock.summary() as Promise<ProductStock[]>,
  })

  const filtered = products.filter(
    (p) =>
      p.product.toLowerCase().includes(search.toLowerCase()) ||
      p.lots.some((l) => l.lotNumber.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stock</h1>
        <p className="mt-1 text-muted-foreground">Saldos por producto y lote</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por producto o lote..."
          className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Warehouse className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {search ? 'No se encontraron productos' : 'No hay movimientos de stock. Crea un registro tipo Stock y agrega entradas.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((product) => {
            const isExpanded = expandedId === product.product
            return (
              <Card key={product.product}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : product.product)}
                  className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/50"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">{product.product}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.lots.length} lote{product.lots.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-green-600">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span className="font-mono">{product.totalIn}</span>
                    </div>
                    <div className="flex items-center gap-1 text-red-600">
                      <TrendingDown className="h-3.5 w-3.5" />
                      <span className="font-mono">{product.totalOut}</span>
                    </div>
                    <Badge variant={product.balance > 0 ? 'success' : product.balance === 0 ? 'secondary' : 'destructive'}>
                      {product.balance} {product.unit || ''}
                    </Badge>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t px-6 py-4">
                    <h4 className="mb-2 text-sm font-semibold">Detalle por lote</h4>
                    <div className="rounded-lg border divide-y">
                      <div className="grid grid-cols-[1fr_6rem_6rem_6rem] gap-2 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
                        <span>Lote</span>
                        <span className="text-right">Ingresos</span>
                        <span className="text-right">Egresos</span>
                        <span className="text-right">Saldo</span>
                      </div>
                      {product.lots.map((lot) => (
                        <div key={lot.lotNumber} className="grid grid-cols-[1fr_6rem_6rem_6rem] gap-2 px-4 py-2.5 text-sm items-center">
                          <span className="font-medium">{lot.lotNumber}</span>
                          <span className="text-right font-mono text-green-600">+{lot.totalIn}</span>
                          <span className="text-right font-mono text-red-600">-{lot.totalOut}</span>
                          <span className={`text-right font-mono font-medium ${lot.balance > 0 ? 'text-green-600' : lot.balance < 0 ? 'text-red-600' : ''}`}>
                            {lot.balance} {product.unit || ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
