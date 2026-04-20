import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { DocumentStatus } from '@prisma/client'

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.document.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async findById(id: string, organizationId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, organizationId },
      include: { records: { select: { id: true, name: true } } },
    })
    if (!doc) throw new NotFoundException('Documento no encontrado')
    return doc
  }

  async create(
    organizationId: string,
    createdById: string,
    data: { title: string; code?: string },
  ) {
    const existingTitle = await this.prisma.document.findFirst({
      where: { organizationId, title: data.title },
    })
    if (existingTitle) {
      throw new ConflictException('Ya existe un documento con ese título')
    }

    if (data.code) {
      const existingCode = await this.prisma.document.findFirst({
        where: { organizationId, code: data.code },
      })
      if (existingCode) {
        throw new ConflictException('Ya existe un documento con ese código')
      }
    }

    return this.prisma.document.create({
      data: {
        organizationId,
        createdById,
        title: data.title,
        code: data.code || null,
      },
    })
  }

  async update(
    id: string,
    organizationId: string,
    data: { title?: string; code?: string; status?: DocumentStatus },
  ) {
    const doc = await this.findById(id, organizationId)

    if (doc.status !== 'DRAFT') {
      throw new ConflictException(
        'Solo se puede editar un documento en estado DRAFT',
      )
    }

    if (data.title && data.title !== doc.title) {
      const existing = await this.prisma.document.findFirst({
        where: { organizationId, title: data.title, id: { not: id } },
      })
      if (existing) throw new ConflictException('Ya existe un documento con ese título')
    }

    if (data.code && data.code !== doc.code) {
      const existing = await this.prisma.document.findFirst({
        where: { organizationId, code: data.code, id: { not: id } },
      })
      if (existing) throw new ConflictException('Ya existe un documento con ese código')
    }

    return this.prisma.document.update({ where: { id }, data })
  }

  async setFileUrl(id: string, organizationId: string, fileUrl: string) {
    const doc = await this.findById(id, organizationId)

    // Si ya tiene archivo, no se puede subir otro — debe crear nueva versión
    if (doc.fileUrl) {
      throw new ConflictException(
        'Este documento ya tiene un archivo adjunto. Para actualizar el archivo, creá una nueva versión.',
      )
    }

    return this.prisma.document.update({
      where: { id },
      data: { fileUrl },
    })
  }

  async createNewVersion(
    id: string,
    organizationId: string,
    createdById: string,
    data: { fileUrl?: string; reason?: string },
  ) {
    const current = await this.findById(id, organizationId)

    // Marcar versión actual como SUPERSEDED
    await this.prisma.document.update({
      where: { id },
      data: { status: 'SUPERSEDED' },
    })

    const parts = current.version.split('.')
    const major = parseInt(parts[0]) + 1
    const newVersion = `${major}.0`

    return this.prisma.document.create({
      data: {
        organizationId,
        createdById,
        title: current.title,
        code: current.code,
        fileUrl: data.fileUrl || current.fileUrl,
        version: newVersion,
        status: 'DRAFT',
        // Usamos content para guardar el motivo del cambio
        content: data.reason || null,
      },
    })
  }
}
