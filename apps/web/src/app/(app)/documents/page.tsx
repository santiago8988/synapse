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

const statusChipCls: Record<Document['status'], string> = {
  DRAFT: 'syn-chip-draft',
  IN_REVIEW: 'syn-chip-warn',
  ACTIVE: 'syn-chip-ok',
  SUPERSEDED: 'syn-chip-active',
}
const statusLabel: Record<Document['status'], string> = {
  DRAFT: 'Borrador',
  IN_REVIEW: 'En revisión',
  ACTIVE: 'Vigente',
  SUPERSEDED: 'Reemplazado',
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
    mutationFn: (docId: string) =>
      api.approval.submit({ entityType: 'DOCUMENT', entityId: docId }),
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
    <div className="mx-auto max-w-[1280px]">
      <div className="syn-ph">
        <div>
          <div className="kicker mb-2">· Definición · Documentos</div>
          <h1>
            Marco <span className="italic">teórico.</span>
          </h1>
          <p className="sub">
            Documentos ISO, procedimientos (SOP) y manuales con control de versiones. Los registros pueden referenciarlos como documento base.
          </p>
        </div>
        <div className="syn-ph-actions">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="syn-btn syn-btn-primary"
          >
            <Plus className="h-3 w-3" /> Nuevo documento
          </button>
        </div>
      </div>

      {/* Inline create */}
      {showCreate && (
        <div className="syn-card mb-5">
          <div className="syn-card-head">
            <div>
              <div className="eyebrow">· Nuevo documento</div>
              <h3 style={{ marginTop: 6 }}>
                Creá el <span className="italic">registro.</span>
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg p-2 transition-colors hover:bg-[var(--bg-3)]"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" style={{ color: 'var(--ink-2)' }} />
            </button>
          </div>
          <div style={{ padding: '16px 20px 18px' }} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="syn-field">
                <span className="syn-field-label">
                  Título <span className="req">*</span>
                </span>
                <input
                  type="text"
                  value={newDoc.title}
                  onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                  placeholder="Ej: Procedimiento de calibración"
                  className="syn-input"
                />
              </div>
              <div className="syn-field">
                <span className="syn-field-label">Código</span>
                <input
                  type="text"
                  value={newDoc.code}
                  onChange={(e) => setNewDoc({ ...newDoc, code: e.target.value })}
                  placeholder="Ej: SOP-LAB-001"
                  className="syn-input"
                />
              </div>
            </div>
            <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
              Después de crearlo podés adjuntar el PDF o Word con el botón de upload.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  createMutation.mutate({
                    title: newDoc.title,
                    code: newDoc.code || undefined,
                  })
                }
                disabled={!newDoc.title || createMutation.isPending}
                className="syn-btn syn-btn-primary"
              >
                {createMutation.isPending ? 'Creando…' : 'Crear documento'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="syn-btn syn-btn-ghost"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
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
            placeholder="Buscar por título o código…"
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
          {filtered.length} {filtered.length === 1 ? 'documento' : 'documentos'}
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-[14px]"
              style={{ background: 'var(--bg-3)' }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="syn-card">
          <div
            className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center"
            style={{ color: 'var(--ink-2)' }}
          >
            <FileText className="h-8 w-8" style={{ color: 'var(--ink-4)' }} />
            <div
              className="text-[24px]"
              style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink-0)' }}
            >
              {search ? (
                <>
                  Sin <span className="italic">coincidencias.</span>
                </>
              ) : (
                <>
                  Sin <span className="italic">documentos.</span>
                </>
              )}
            </div>
            <p className="max-w-sm text-[13px]" style={{ color: 'var(--ink-2)' }}>
              {search
                ? 'Probá cambiar la búsqueda.'
                : 'Creá tu primer documento para referenciar desde los registros.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="syn-card">
          {filtered.map((doc, idx) => {
            const chipCls = statusChipCls[doc.status]
            const hasFile = !!doc.fileUrl
            const isSuperseded = doc.status === 'SUPERSEDED'
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-[var(--bg-3)]"
                style={{
                  borderTop: idx === 0 ? 'none' : '1px solid var(--line)',
                  opacity: isSuperseded ? 0.65 : 1,
                }}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
                  style={{ background: 'var(--info-soft)' }}
                >
                  <FileText className="h-5 w-5" style={{ color: 'var(--info)' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="truncate text-[14px] font-medium"
                      style={{ color: 'var(--ink-0)' }}
                    >
                      {doc.title}
                    </span>
                    {doc.code && (
                      <span
                        className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]"
                        style={{
                          background: 'var(--bg-3)',
                          color: 'var(--ink-3)',
                        }}
                      >
                        {doc.code}
                      </span>
                    )}
                  </div>
                  <div
                    className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[11px]"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    <span>v{doc.version}</span>
                    <span style={{ color: 'var(--ink-4)' }}>·</span>
                    <span>{new Date(doc.updatedAt).toLocaleDateString('es-AR')}</span>
                    {hasFile ? (
                      <>
                        <span style={{ color: 'var(--ink-4)' }}>·</span>
                        <span
                          className="inline-flex items-center gap-1"
                          style={{ color: 'var(--ok)' }}
                        >
                          <File className="h-3 w-3" /> Adjunto
                        </span>
                      </>
                    ) : (
                      <>
                        <span style={{ color: 'var(--ink-4)' }}>·</span>
                        <span style={{ color: 'var(--warn)' }}>Sin archivo</span>
                      </>
                    )}
                  </div>
                </div>
                <span className={`syn-chip ${chipCls}`}>
                  {statusLabel[doc.status]}
                </span>
                <div className="flex gap-1">
                  {doc.status === 'DRAFT' && (
                    <button
                      type="button"
                      onClick={() => submitForApprovalMutation.mutate(doc.id)}
                      disabled={submitForApprovalMutation.isPending}
                      className="syn-btn syn-btn-subtle"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                      title="Enviar a revisión"
                    >
                      <Send className="h-3 w-3" /> Revisar
                    </button>
                  )}
                  {hasFile && (
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="syn-btn syn-btn-subtle"
                      style={{ padding: '6px 8px' }}
                      title="Ver documento"
                      aria-label="Ver"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {!hasFile && !isSuperseded && (
                    <button
                      type="button"
                      onClick={() => handleUploadFirst(doc.id)}
                      className="syn-btn syn-btn-subtle"
                      style={{ padding: '6px 8px' }}
                      title="Adjuntar archivo"
                      aria-label="Subir"
                    >
                      <Upload className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {hasFile && !isSuperseded && (
                    <button
                      type="button"
                      onClick={() => setVersionModal(doc)}
                      className="syn-btn syn-btn-subtle"
                      style={{ padding: '6px 8px' }}
                      title="Nueva versión"
                      aria-label="Versionar"
                    >
                      <History className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Preview modal */}
      {previewDoc && previewDoc.fileUrl && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4"
          style={{ background: 'rgba(4,7,15,0.55)', backdropFilter: 'blur(3px)' }}
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="flex w-full flex-col bg-[var(--bg-1)] shadow-[var(--shadow-lg)] sm:max-w-4xl sm:rounded-[14px]"
            style={{
              maxHeight: '100dvh',
              height: '100dvh',
              border: '1px solid var(--line)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between border-b px-5 py-4 sm:px-6"
              style={{ borderColor: 'var(--line)' }}
            >
              <div>
                <div className="kicker">· Vista previa</div>
                <div
                  className="truncate"
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 20,
                    color: 'var(--ink-0)',
                    marginTop: 2,
                  }}
                >
                  {previewDoc.title}
                </div>
                <div
                  className="mt-1 font-mono text-[11px]"
                  style={{ color: 'var(--ink-3)' }}
                >
                  {previewDoc.code && `${previewDoc.code} · `}v{previewDoc.version}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="rounded-lg p-2 transition-colors hover:bg-[var(--bg-3)]"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" style={{ color: 'var(--ink-2)' }} />
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
                <div className="flex h-full flex-col items-center justify-center gap-3">
                  <File className="h-16 w-16" style={{ color: 'var(--ink-4)' }} />
                  <p
                    className="text-[13px]"
                    style={{ color: 'var(--ink-2)' }}
                  >
                    Vista previa no disponible para este tipo de archivo
                  </p>
                  <a
                    href={`${API_URL.replace('/api', '')}${previewDoc.fileUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="syn-btn syn-btn-ghost"
                  >
                    Descargar archivo
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Nueva versión modal */}
      {versionModal && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4"
          style={{ background: 'rgba(4,7,15,0.55)', backdropFilter: 'blur(3px)' }}
        >
          <div
            className="flex w-full flex-col bg-[var(--bg-1)] shadow-[var(--shadow-lg)] sm:max-w-lg sm:rounded-[14px]"
            style={{ border: '1px solid var(--line)', maxHeight: '100dvh' }}
          >
            <div
              className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: 'var(--line)' }}
            >
              <div>
                <div className="kicker">· Nueva versión</div>
                <div
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 20,
                    color: 'var(--ink-0)',
                    marginTop: 2,
                  }}
                >
                  {versionModal.title}
                </div>
                <div
                  className="mt-1 font-mono text-[11px]"
                  style={{ color: 'var(--ink-3)' }}
                >
                  v{versionModal.version} → v
                  {parseInt(versionModal.version.split('.')[0]) + 1}.0
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVersionModal(null)
                  setVersionReason('')
                  setVersionFile(null)
                }}
                className="rounded-lg p-2 transition-colors hover:bg-[var(--bg-3)]"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" style={{ color: 'var(--ink-2)' }} />
              </button>
            </div>
            <div className="space-y-4 p-5 overflow-y-auto">
              <div className="syn-field">
                <span className="syn-field-label">
                  Motivo de la actualización <span className="req">*</span>
                </span>
                <textarea
                  value={versionReason}
                  onChange={(e) => setVersionReason(e.target.value)}
                  placeholder="Ej: Actualización por cambio en norma ISO 9001:2025…"
                  rows={3}
                  className="syn-textarea"
                />
              </div>

              <div className="syn-field">
                <span className="syn-field-label">
                  Nuevo archivo <span className="hint">Opcional</span>
                </span>
                <div
                  className="relative flex items-center gap-3 rounded-[10px] border-2 border-dashed p-4 transition-colors"
                  style={{
                    borderColor: versionFile ? 'var(--primary-hex)' : 'var(--line-2)',
                    background: versionFile ? 'var(--primary-soft)' : 'transparent',
                  }}
                >
                  {versionFile ? (
                    <>
                      <File
                        className="h-5 w-5"
                        style={{ color: 'var(--primary-hex)' }}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-[13px] font-medium"
                          style={{ color: 'var(--ink-0)' }}
                        >
                          {versionFile.name}
                        </p>
                        <p
                          className="font-mono text-[11px]"
                          style={{ color: 'var(--ink-3)' }}
                        >
                          {(versionFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setVersionFile(null)}
                        className="rounded p-1"
                        style={{ color: 'var(--ink-3)' }}
                        aria-label="Quitar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <Upload
                        className="h-5 w-5"
                        style={{ color: 'var(--ink-3)' }}
                      />
                      <div className="flex-1">
                        <p
                          className="text-[13px]"
                          style={{ color: 'var(--ink-2)' }}
                        >
                          Click o arrastrá un PDF / Word
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
                <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  Si no adjuntás nada se mantiene el archivo actual.
                </p>
              </div>
            </div>
            <div
              className="flex gap-2 border-t px-5 py-4"
              style={{ borderColor: 'var(--line)' }}
            >
              <button
                type="button"
                onClick={handleCreateVersion}
                disabled={!versionReason.trim() || versionLoading}
                className="syn-btn syn-btn-primary flex-1 justify-center"
              >
                {versionLoading ? 'Creando…' : 'Crear nueva versión'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setVersionModal(null)
                  setVersionReason('')
                  setVersionFile(null)
                }}
                className="syn-btn syn-btn-ghost"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
