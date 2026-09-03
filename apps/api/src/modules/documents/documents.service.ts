import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { DocumentStatus } from '@prisma/client'
import { StorageService } from '../../common/storage/storage.service'

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async findAll(organizationId: string) {
    const documents = await this.prisma.document.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
    })
    return Promise.all(documents.map((d) => this.withFileUrl(d)))
  }

  async findById(id: string, organizationId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, organizationId },
      include: { records: { select: { id: true, name: true } } },
    })
    if (!doc) throw new NotFoundException('Documento no encontrado')
    return this.withFileUrl(doc)
  }

  /**
   * Reemplaza fileUrl por una URL firmada derivada de fileKey. Los documentos
   * anteriores a la abstracción de storage tienen fileKey backfilleado por la
   * migración; si quedó en null se devuelve null (documento sin archivo
   * accesible) en vez de la ruta vieja, que ya no existe como endpoint.
   */
  private async withFileUrl<T extends { fileKey: string | null; title: string }>(
    doc: T,
  ): Promise<T & { fileUrl: string | null }> {
    if (!doc.fileKey) {
      return { ...doc, fileUrl: null }
    }
    return {
      ...doc,
      fileUrl: await this.storage.signedUrl('documents', doc.fileKey, {
        downloadName: doc.title,
      }),
    }
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

  async setFileKey(id: string, organizationId: string, fileKey: string) {
    const doc = await this.findById(id, organizationId)

    // Si ya tiene archivo, no se puede subir otro — debe crear nueva versión
    if (doc.fileKey) {
      throw new ConflictException(
        'Este documento ya tiene un archivo adjunto. Para actualizar el archivo, creá una nueva versión.',
      )
    }

    const updated = await this.prisma.document.update({
      where: { id },
      // fileUrl se deja en null a propósito: la URL se firma al leer.
      data: { fileKey, fileUrl: null },
    })
    return this.withFileUrl(updated)
  }

  async createNewVersion(
    id: string,
    organizationId: string,
    createdById: string,
    data: { fileKey?: string; reason?: string },
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

    const created = await this.prisma.document.create({
      data: {
        organizationId,
        createdById,
        title: current.title,
        code: current.code,
        // Si la nueva versión no trae archivo, se reapunta al mismo objeto que
        // la anterior: dos filas comparten la clave y ninguna la borra.
        fileKey: data.fileKey || current.fileKey,
        version: newVersion,
        status: 'DRAFT',
        // Usamos content para guardar el motivo del cambio
        content: data.reason || null,
      },
    })
    return this.withFileUrl(created)
  }
}
