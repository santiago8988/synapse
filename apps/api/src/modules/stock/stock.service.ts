import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface StockByProduct {
  product: string
  totalIn: number
  totalOut: number
  balance: number
  unit: string | null
  lots: Array<{
    lotNumber: string
    totalIn: number
    totalOut: number
    balance: number
  }>
}

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) {}

  async getSummary(organizationId: string) {
    const movements = await this.prisma.stockMovement.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    })

    const byProduct = new Map<string, StockByProduct>()

    for (const mov of movements) {
      if (!byProduct.has(mov.product)) {
        byProduct.set(mov.product, {
          product: mov.product,
          totalIn: 0,
          totalOut: 0,
          balance: 0,
          unit: mov.unit,
          lots: [],
        })
      }

      const p = byProduct.get(mov.product)!
      const isIngreso = mov.movementType === 'INGRESO'

      if (isIngreso) {
        p.totalIn += mov.quantity
      } else {
        p.totalOut += mov.quantity
      }
      p.balance = p.totalIn - p.totalOut

      let lot = p.lots.find((l) => l.lotNumber === mov.lotNumber)
      if (!lot) {
        lot = { lotNumber: mov.lotNumber, totalIn: 0, totalOut: 0, balance: 0 }
        p.lots.push(lot)
      }
      if (isIngreso) {
        lot.totalIn += mov.quantity
      } else {
        lot.totalOut += mov.quantity
      }
      lot.balance = lot.totalIn - lot.totalOut
    }

    return Array.from(byProduct.values())
  }

  async getAvailableLots(organizationId: string, product: string) {
    const movements = await this.prisma.stockMovement.findMany({
      where: { organizationId, product },
    })

    const lotMap = new Map<string, { lotNumber: string; balance: number; unit: string | null }>()
    for (const mov of movements) {
      if (!lotMap.has(mov.lotNumber)) {
        lotMap.set(mov.lotNumber, { lotNumber: mov.lotNumber, balance: 0, unit: mov.unit })
      }
      const lot = lotMap.get(mov.lotNumber)!
      if (mov.movementType === 'INGRESO') {
        lot.balance += mov.quantity
      } else {
        lot.balance -= mov.quantity
      }
    }

    return Array.from(lotMap.values()).filter((l) => l.balance > 0)
  }

  async getMovements(organizationId: string, filters?: { product?: string; lotNumber?: string }) {
    return this.prisma.stockMovement.findMany({
      where: {
        organizationId,
        ...(filters?.product ? { product: filters.product } : {}),
        ...(filters?.lotNumber ? { lotNumber: filters.lotNumber } : {}),
      },
      include: {
        entry: { select: { id: true, data: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }
}
