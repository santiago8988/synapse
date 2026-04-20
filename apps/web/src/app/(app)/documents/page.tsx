'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText,
  Plus,
  Search,
  Eye,
  Upload,
  File,
  X,
  History,
  Send,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Document {
  id: string
  title: string
  code: string | null
  version: string
  status: 'DRAFT' | 'IN_REVIEW' | 'ACTIVE' | 'SUPERSEDED'
  fileUrl: string | null
  content: string | null
  createdAt: string
  updatedAt: string
}

const statusConfig = {
  DRAFT: { label: 'Borrador', variant: 'secondary' as const },
  IN_REVIEW: { label: 'En revisión', variant: 'warning' as const },
  ACTIVE: { label: 'Vigente', variant: 'success' as const },
  SUPERSEDED: { label: 'Reemplazado', variant: 'info' as const },
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('synapse_token') : null
}

export default function DocumentsPage() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [newDoc, setNewDoc] = useState({ title: '', code: '' })
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const [versionModal, setVersionModal] = useState<Document | null>(null)
  const [versionReason, setVersionReason] = useState('')
  const [versionFile, setVersionFile] = useState<File | null>(null)
  const [versionLoading, setVersionLoading] = useState(false)

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ['documents'],
    queryFn: () => api.documents.list() as Promise<Document[]>,
  })

  const createMutation = useMutation({
    mutationFn: (data: { title: string; code?: string }) => api.documents.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      setShowCreate(false)
      setNewDoc({ title: '', code: '' })
      toast.success('Documento creado')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const submitForApprovalMutation = useMutation({
    mutationFn: (docId: string) => api.approval.submit({ entityType: 'DOCUMENT', entityId: docId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      toast.success('Documento enviado a revisión')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleUploadFirst = async (docId: string) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.doc,.docx'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return

      const formData = new FormData()
      formData.append('file', file)
      const token = getToken()

      try {
        const res = await fetch(`${API_URL}/documents/${docId}/upload`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'Error al subir archivo' }))
          throw new Error(err.message)
        }

        queryClient.invalidateQueries({ queryKey: ['documents'] })
        toast.success(`Archivo "${file.name}" subido correctamente`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al subir archivo')
      }
    }
    input.click()
  }

  const handleCreateVersion = async () => {
    if (!versionModal) return
    setVersionLoading(true)

    try {
      const formData = new FormData()
      if (versionFile) formData.append('file', versionFile)
      if (versionReason) formData.append('reason', versionReason)
      const token = getToken()

      const res = await fetch(`${API_URL}/documents/${versionModal.id}/version`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Error al crear versión' }))
        throw new Error(err.message)
      }

      queryClient.invalidateQueries({ queryKey: ['documents'] })
      setVersionModal(null)
      setVersionReason('')
      setVersionFile(null)
      toast.success('Nueva versión creada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear versión')
    } finally {
      setVersionLoading(false)
    }
  }

  const filtered = documents.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.code?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documentos</h1>
          <p className="mt-1 text-muted-foreground">
            Documentos ISO, procedimientos y marco normativo
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo documento
        </Button>
      </div>

      {/* Modal de creación */}
      {showCreate && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">Nuevo documento</CardTitle>
            <CardDescription>
              Creá el documento y después adjuntá el archivo PDF o Word
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Título *</label>
                <input
                  type="text"
                  value={newDoc.title}
                  onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                  placeholder="Ej: Procedimiento de calibración"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Código</label>
                <input
                  type="text"
                  value={newDoc.code}
                  onChange={(e) => setNewDoc({ ...newDoc, code: e.target.value })}
                  placeholder="Ej: SOP-LAB-001"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  createMutation.mutate({
                    title: newDoc.title,
                    code: newDoc.code || undefined,
                  })
                }
                disabled={!newDoc.title || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creando...' : 'Crear documento'}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título o código..."
          className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Preview modal */}
      {previewDoc && previewDoc.fileUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative flex h-[85vh] w-full max-w-4xl flex-col rounded-xl bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="font-semibold">{previewDoc.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {previewDoc.code && `${previewDoc.code} · `}v{previewDoc.version}
                </p>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="rounded-lg p-2 hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {previewDoc.fileUrl.includes('.pdf') ? (
                <iframe
                  src={`${API_URL.replace('/api', '')}${previewDoc.fileUrl}`}
                  className="h-full w-full"
                  title={previewDoc.title}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4">
                  <File className="h-16 w-16 text-muted-foreground/30" />
                  <p className="text-muted-foreground">
                    Vista previa no disponible para este tipo de archivo
                  </p>
                  <a
                    href={`${API_URL.replace('/api', '')}${previewDoc.fileUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Descargar archivo
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal nueva versión */}
      {versionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="font-semibold">Nueva versión</h2>
                <p className="text-sm text-muted-foreground">
                  {versionModal.title} — v{versionModal.version} → v
                  {parseInt(versionModal.version.split('.')[0]) + 1}.0
                </p>
              </div>
              <button
                onClick={() => {
                  setVersionModal(null)
                  setVersionReason('')
                  setVersionFile(null)
                }}
                className="rounded-lg p-2 hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Motivo de la actualización *</label>
                <textarea
                  value={versionReason}
                  onChange={(e) => setVersionReason(e.target.value)}
                  placeholder="Ej: Actualización por cambio en norma ISO 9001:2025..."
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Nuevo archivo <span className="text-muted-foreground font-normal">(opcional, si no se adjunta se mantiene el actual)</span>
                </label>
                <div
                  className={`relative flex items-center gap-3 rounded-lg border-2 border-dashed p-4 transition-colors ${
                    versionFile ? 'border-primary/30 bg-primary/5' : 'border-border hover:border-primary/20'
                  }`}
                >
                  {versionFile ? (
                    <>
                      <File className="h-5 w-5 text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{versionFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(versionFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => setVersionFile(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">
                          Arrastrá o hacé click para seleccionar un PDF o Word
                        </p>
                      </div>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setVersionFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleCreateVersion}
                  disabled={!versionReason.trim() || versionLoading}
                  className="flex-1"
                >
                  {versionLoading ? 'Creando...' : 'Crear nueva versión'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setVersionModal(null)
                    setVersionReason('')
                    setVersionFile(null)
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 font-medium">No hay documentos</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Creá tu primer documento para empezar
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => {
            const status = statusConfig[doc.status]
            const hasFile = !!doc.fileUrl
            const isSuperseded = doc.status === 'SUPERSEDED'
            return (
              <Card
                key={doc.id}
                className={`transition-shadow hover:shadow-md ${isSuperseded ? 'opacity-60' : ''}`}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{doc.title}</p>
                      {doc.code && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {doc.code}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>v{doc.version}</span>
                      <span>&middot;</span>
                      <span>{new Date(doc.updatedAt).toLocaleDateString('es-AR')}</span>
                      {hasFile ? (
                        <>
                          <span>&middot;</span>
                          <span className="flex items-center gap-1 text-emerald-600">
                            <File className="h-3 w-3" />
                            Archivo adjunto
                          </span>
                        </>
                      ) : (
                        <>
                          <span>&middot;</span>
                          <span className="text-amber-600">Sin archivo</span>
                        </>
                      )}
                      {doc.content && (
                        <>
                          <span>&middot;</span>
                          <span className="italic" title={doc.content}>
                            {doc.content.length > 40
                              ? doc.content.slice(0, 40) + '...'
                              : doc.content}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <div className="flex gap-1">
                    {doc.status === 'DRAFT' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => submitForApprovalMutation.mutate(doc.id)}
                        disabled={submitForApprovalMutation.isPending}
                        title="Enviar a revisión"
                      >
                        <Send className="mr-1 h-3 w-3" />
                        Revisar
                      </Button>
                    )}
                    {hasFile && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPreviewDoc(doc)}
                        title="Ver documento"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    {!hasFile && !isSuperseded && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleUploadFirst(doc.id)}
                        title="Adjuntar archivo"
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    )}
                    {hasFile && !isSuperseded && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setVersionModal(doc)}
                        title="Nueva versión"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
