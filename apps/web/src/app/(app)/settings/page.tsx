'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  GitBranch,
  Users,
  Mail,
  Plus,
  ChevronRight,
  Shield,
  Pencil,
  Trash2,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { api } from '@/lib/api'

type Tab = 'general' | 'areas' | 'positions' | 'whitelist' | 'users' | 'quality'

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: Building2 },
  { id: 'areas', label: 'Áreas', icon: GitBranch },
  { id: 'positions', label: 'Puestos', icon: Shield },
  { id: 'whitelist', label: 'Whitelist', icon: Mail },
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'quality', label: 'Calidad', icon: CheckCircle2 },
]

const roleLabels: Record<string, { label: string; variant: 'default' | 'info' | 'success' | 'secondary' }> = {
  ADMIN: { label: 'Admin', variant: 'default' },
  QUALITY_MANAGER: { label: 'Resp. Calidad', variant: 'info' },
  TECHNICIAN: { label: 'Técnico', variant: 'success' },
  AUDITOR: { label: 'Auditor', variant: 'secondary' },
}

const qualityRoleLabels: Record<string, string> = {
  REVIEWER: 'Revisor',
  APPROVER: 'Aprobador',
}

// ─── Tipos ──────────────────────────────────

interface AreaNode {
  id: string
  name: string
  leaderId: string | null
  leader: { user: { name: string } } | null
  children: AreaNode[]
}

interface WhitelistItem {
  id: string
  email: string
  role: string
  areaId: string | null
  invitedAt: string
  usedAt: string | null
}

interface OrgUser {
  id: string
  userId: string
  role: string
  areaId: string | null
  positionId: string | null
  phone: string | null
  signature: string | null
  isActive: boolean
  user: { id: string; name: string; email: string; avatarUrl: string | null }
  area: { id: string; name: string } | null
  position: { id: string; name: string } | null
}

interface PositionItem {
  id: string
  name: string
}

interface TrainingItem {
  id: string
  name: string
  description: string | null
  provider: string | null
  completedAt: string
  expiresAt: string | null
  certificateUrl: string | null
}

interface QualityRoleItem {
  id: string
  organizationUserId: string
  role: string
  organizationUser: {
    id: string
    user: { id: string; name: string; email: string }
  }
}

// ─── Componente de Area Tree ────────────────

function AreaTreeItem({
  area,
  depth = 0,
  orgId,
  users,
  onRefresh,
}: {
  area: AreaNode
  depth?: number
  orgId: string
  users: OrgUser[]
  onRefresh: () => void
}) {
  const [open, setOpen] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(area.name)
  const [editingLeader, setEditingLeader] = useState(false)
  const [selectedLeader, setSelectedLeader] = useState(area.leaderId || '')
  const [addingChild, setAddingChild] = useState(false)
  const [childName, setChildName] = useState('')
  const [loading, setLoading] = useState(false)
  const hasChildren = area.children.length > 0

  const handleRename = async () => {
    if (!editName.trim() || editName === area.name) {
      setEditing(false)
      return
    }
    setLoading(true)
    try {
      await api.areas.update(orgId, area.id, { name: editName.trim() })
      onRefresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
      setEditing(false)
    }
  }

  const handleAddChild = async () => {
    if (!childName.trim()) return
    setLoading(true)
    try {
      await api.areas.create(orgId, { name: childName.trim(), parentId: area.id })
      setChildName('')
      setAddingChild(false)
      onRefresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar el área "${area.name}"?`)) return
    try {
      await api.areas.delete(orgId, area.id)
      onRefresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    }
  }

  const handleSetLeader = async () => {
    setLoading(true)
    try {
      await api.organizations.setAreaLeader(orgId, area.id, selectedLeader || null)
      setEditingLeader(false)
      onRefresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div
        className="group flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
        style={{ paddingLeft: `${12 + depth * 24}px` }}
      >
        {hasChildren ? (
          <button onClick={() => setOpen(!open)} className="p-0.5">
            <ChevronRight
              className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
            />
          </button>
        ) : (
          <div className="w-4.5" />
        )}
        <GitBranch className="h-4 w-4 text-muted-foreground" />
        {editing ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename()
              if (e.key === 'Escape') setEditing(false)
            }}
            onBlur={handleRename}
            className="flex-1 rounded border bg-background px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            disabled={loading}
          />
        ) : (
          <span className="flex-1 text-sm font-medium">
            {area.name}
            {area.leader && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                — Jefe: {area.leader.user.name}
              </span>
            )}
          </span>
        )}
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAddingChild(true)} title="Agregar sub-área">
            <Plus className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingLeader(true); setSelectedLeader(area.leaderId || '') }} title="Asignar jefe">
            <Users className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(true); setEditName(area.name) }} title="Renombrar">
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={handleDelete} title="Eliminar">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {editingLeader && (
        <div className="flex items-center gap-2 py-1" style={{ paddingLeft: `${36 + depth * 24}px` }}>
          <span className="text-xs text-muted-foreground">Jefe:</span>
          <select
            value={selectedLeader}
            onChange={(e) => setSelectedLeader(e.target.value)}
            className="flex-1 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Sin jefe asignado</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.user.name} ({u.user.email})</option>
            ))}
          </select>
          <Button size="sm" onClick={handleSetLeader} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Guardar'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditingLeader(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {addingChild && (
        <div className="flex items-center gap-2 py-1" style={{ paddingLeft: `${36 + depth * 24}px` }}>
          <input
            autoFocus
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddChild()
              if (e.key === 'Escape') setAddingChild(false)
            }}
            placeholder="Nombre del sub-área"
            className="flex-1 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            disabled={loading}
          />
          <Button size="sm" variant="ghost" onClick={handleAddChild} disabled={loading || !childName.trim()}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAddingChild(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {open && area.children.map((child) => (
        <AreaTreeItem key={child.id} area={child} depth={depth + 1} orgId={orgId} users={users} onRefresh={onRefresh} />
      ))}
    </div>
  )
}

// ─── Tab: General ───────────────────────────

function GeneralTab({ orgId }: { orgId: string }) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.organizations.get<{ name: string; slug: string }>(orgId).then((org) => {
      setName(org.name)
      setSlug(org.slug)
      setLoading(false)
    })
  }, [orgId])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.organizations.update(orgId, { name })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingCard />

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos de la organización</CardTitle>
        <CardDescription>Información general de tu organización</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Slug</label>
            <input
              type="text"
              value={slug}
              disabled
              className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
            />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Guardar cambios
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Tab: Áreas ─────────────────────────────

function AreasTab({ orgId }: { orgId: string }) {
  const [areas, setAreas] = useState<AreaNode[]>([])
  const [users, setUsers] = useState<OrgUser[]>([])
  const [loading, setLoading] = useState(true)
  const [addingRoot, setAddingRoot] = useState(false)
  const [rootName, setRootName] = useState('')
  const [addingLoading, setAddingLoading] = useState(false)

  const fetchAreas = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.organizations.get(orgId) as Promise<{ areas: AreaNode[] }>,
      api.organizations.getUsers(orgId) as Promise<OrgUser[]>,
    ]).then(([org, orgUsers]) => {
      setAreas(org.areas || [])
      setUsers(orgUsers)
      setLoading(false)
    })
  }, [orgId])

  useEffect(() => { fetchAreas() }, [fetchAreas])

  const handleAddRoot = async () => {
    if (!rootName.trim()) return
    setAddingLoading(true)
    try {
      await api.areas.create(orgId, { name: rootName.trim() })
      setRootName('')
      setAddingRoot(false)
      fetchAreas()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    } finally {
      setAddingLoading(false)
    }
  }

  if (loading) return <LoadingCard />

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Áreas</CardTitle>
          <CardDescription>Estructura jerárquica de áreas de la organización</CardDescription>
        </div>
        <Button size="sm" onClick={() => setAddingRoot(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Área raíz
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          {addingRoot && (
            <div className="flex items-center gap-2 border-b px-4 py-2">
              <input
                autoFocus
                value={rootName}
                onChange={(e) => setRootName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddRoot()
                  if (e.key === 'Escape') setAddingRoot(false)
                }}
                placeholder="Nombre del área"
                className="flex-1 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                disabled={addingLoading}
              />
              <Button size="sm" onClick={handleAddRoot} disabled={addingLoading || !rootName.trim()}>
                {addingLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Crear'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAddingRoot(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          {areas.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No hay áreas creadas. Agregá una área raíz para comenzar.
            </p>
          ) : (
            areas.map((area) => (
              <AreaTreeItem key={area.id} area={area} orgId={orgId} users={users} onRefresh={fetchAreas} />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Tab: Whitelist ─────────────────────────

function WhitelistTab({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<WhitelistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('TECHNICIAN')
  const [addingLoading, setAddingLoading] = useState(false)

  const fetchWhitelist = useCallback(() => {
    setLoading(true)
    api.organizations.getWhitelist<WhitelistItem[]>(orgId).then((data) => {
      setItems(data)
      setLoading(false)
    })
  }, [orgId])

  useEffect(() => { fetchWhitelist() }, [fetchWhitelist])

  const handleAdd = async () => {
    if (!newEmail.trim()) return
    setAddingLoading(true)
    try {
      await api.organizations.addWhitelist(orgId, { email: newEmail.trim(), role: newRole })
      setNewEmail('')
      setNewRole('TECHNICIAN')
      setAdding(false)
      fetchWhitelist()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    } finally {
      setAddingLoading(false)
    }
  }

  const handleRemove = async (whitelistId: string, email: string) => {
    if (!confirm(`¿Eliminar ${email} de la whitelist?`)) return
    try {
      await api.organizations.removeWhitelist(orgId, whitelistId)
      fetchWhitelist()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    }
  }

  if (loading) return <LoadingCard />

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Whitelist de emails</CardTitle>
          <CardDescription>Emails autorizados para ingresar a la organización</CardDescription>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar email
        </Button>
      </CardHeader>
      <CardContent>
        <div className="divide-y rounded-lg border">
          {adding && (
            <div className="flex items-center gap-3 px-4 py-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd()
                  if (e.key === 'Escape') setAdding(false)
                }}
                placeholder="email@ejemplo.com"
                className="flex-1 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                disabled={addingLoading}
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="ADMIN">Admin</option>
                <option value="QUALITY_MANAGER">Resp. Calidad</option>
                <option value="TECHNICIAN">Técnico</option>
                <option value="AUDITOR">Auditor</option>
              </select>
              <Button size="sm" onClick={handleAdd} disabled={addingLoading || !newEmail.trim()}>
                {addingLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Agregar'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          {items.length === 0 && !adding ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No hay emails en la whitelist.
            </p>
          ) : (
            items.map((item) => {
              const role = roleLabels[item.role] || { label: item.role, variant: 'secondary' as const }
              return (
                <div key={item.id} className="flex items-center gap-4 px-4 py-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.email}</p>
                    {item.usedAt && (
                      <p className="text-xs text-muted-foreground">
                        Ingresó el {new Date(item.usedAt).toLocaleDateString('es-AR')}
                      </p>
                    )}
                  </div>
                  <Badge variant={role.variant}>{role.label}</Badge>
                  {!item.usedAt && (
                    <Badge variant="outline" className="text-amber-600">
                      Pendiente
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleRemove(item.id, item.email)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Tab: Usuarios ──────────────────────────

function UsersTab({ orgId }: { orgId: string }) {
  const [users, setUsers] = useState<OrgUser[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchUsers = useCallback(() => {
    setLoading(true)
    api.organizations.getUsers<OrgUser[]>(orgId).then((data) => {
      setUsers(data)
      setLoading(false)
    })
  }, [orgId])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  if (loading) return <LoadingCard />

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios</CardTitle>
        <CardDescription>Miembros de la organización, perfiles y capacitaciones</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y rounded-lg border">
          {users.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No hay usuarios registrados.
            </p>
          ) : (
            users.map((u) => {
              const role = roleLabels[u.role] || { label: u.role, variant: 'secondary' as const }
              const isExpanded = expandedId === u.id
              return (
                <div key={u.id}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : u.id)}
                    className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                        {u.user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{u.user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.user.email}
                        {u.position && <> · {u.position.name}</>}
                      </p>
                    </div>
                    {u.area && (
                      <span className="text-xs text-muted-foreground">{u.area.name}</span>
                    )}
                    <Badge variant={role.variant}>
                      <Shield className="mr-1 h-3 w-3" />
                      {role.label}
                    </Badge>
                  </button>
                  {isExpanded && (
                    <UserProfile user={u} orgId={orgId} onUpdate={fetchUsers} />
                  )}
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Perfil expandido de usuario ────────────

function UserProfile({ user, orgId, onUpdate }: { user: OrgUser; orgId: string; onUpdate: () => void }) {
  const [role, setRole] = useState(user.role)
  const [positionId, setPositionId] = useState(user.positionId || '')
  const [areaId, setAreaId] = useState(user.areaId || '')
  const [phone, setPhone] = useState(user.phone || '')
  const [saving, setSaving] = useState(false)
  const [positions, setPositions] = useState<PositionItem[]>([])
  const [areas, setAreas] = useState<AreaNode[]>([])
  const [trainings, setTrainings] = useState<TrainingItem[]>([])
  const [loadingTrainings, setLoadingTrainings] = useState(true)
  const [addingTraining, setAddingTraining] = useState(false)
  const [newTraining, setNewTraining] = useState({ name: '', provider: '', completedAt: '', expiresAt: '' })
  const [addingLoading, setAddingLoading] = useState(false)

  const fetchTrainings = useCallback(() => {
    setLoadingTrainings(true)
    api.organizations.getTrainings<TrainingItem[]>(orgId, user.id).then((data) => {
      setTrainings(data)
      setLoadingTrainings(false)
    })
  }, [orgId, user.id])

  useEffect(() => {
    fetchTrainings()
    api.organizations.getPositions<PositionItem[]>(orgId).then((data) => setPositions(data))
    api.organizations.get<{ areas: AreaNode[] }>(orgId).then((org) => {
      // Flatten area tree for dropdown
      const flat: { id: string; name: string; depth: number }[] = []
      const walk = (nodes: AreaNode[], depth: number) => {
        for (const n of nodes) {
          flat.push({ id: n.id, name: n.name, depth })
          if (n.children) walk(n.children, depth + 1)
        }
      }
      walk(org.areas || [], 0)
      setAreas(org.areas || [])
      setFlatAreas(flat)
    })
  }, [fetchTrainings, orgId])

  const [flatAreas, setFlatAreas] = useState<{ id: string; name: string; depth: number }[]>([])

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await api.organizations.updateUser(orgId, user.id, {
        role,
        positionId: positionId || null,
        areaId: areaId || null,
        phone: phone || null,
      })
      onUpdate()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const handleAddTraining = async () => {
    if (!newTraining.name || !newTraining.completedAt) return
    setAddingLoading(true)
    try {
      await api.organizations.addTraining(orgId, user.id, {
        name: newTraining.name,
        provider: newTraining.provider || undefined,
        completedAt: newTraining.completedAt,
        expiresAt: newTraining.expiresAt || undefined,
      })
      setNewTraining({ name: '', provider: '', completedAt: '', expiresAt: '' })
      setAddingTraining(false)
      fetchTrainings()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    } finally {
      setAddingLoading(false)
    }
  }

  const handleRemoveTraining = async (trainingId: string) => {
    if (!confirm('¿Eliminar esta capacitación?')) return
    try {
      await api.organizations.removeTraining(orgId, user.id, trainingId)
      fetchTrainings()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    }
  }

  const now = new Date()

  return (
    <div className="border-t bg-muted/20 px-6 py-4 space-y-5">
      {/* Datos del perfil */}
      <div>
        <h4 className="mb-3 text-sm font-semibold">Perfil</h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="ADMIN">Admin</option>
              <option value="QUALITY_MANAGER">Resp. Calidad</option>
              <option value="TECHNICIAN">Técnico</option>
              <option value="AUDITOR">Auditor</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Puesto / Cargo</label>
            <select
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Sin asignar</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Área</label>
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Sin asignar</option>
              {flatAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  {'—'.repeat(a.depth)} {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Teléfono</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej: +54 9 11 1234-5678"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
        <div className="mt-3">
          <Button size="sm" onClick={handleSaveProfile} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
            Guardar perfil
          </Button>
        </div>
      </div>

      {/* Capacitaciones */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold">Capacitaciones</h4>
          <Button size="sm" variant="outline" onClick={() => setAddingTraining(true)}>
            <Plus className="mr-1 h-3 w-3" />
            Agregar
          </Button>
        </div>

        {addingTraining && (
          <div className="mb-3 space-y-2 rounded-lg border bg-background p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                autoFocus
                value={newTraining.name}
                onChange={(e) => setNewTraining({ ...newTraining, name: e.target.value })}
                placeholder="Nombre de la capacitación *"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                value={newTraining.provider}
                onChange={(e) => setNewTraining({ ...newTraining, provider: e.target.value })}
                placeholder="Entidad capacitadora"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Fecha de realización *</label>
                <input
                  type="date"
                  value={newTraining.completedAt}
                  onChange={(e) => setNewTraining({ ...newTraining, completedAt: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Vencimiento (opcional)</label>
                <input
                  type="date"
                  value={newTraining.expiresAt}
                  onChange={(e) => setNewTraining({ ...newTraining, expiresAt: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddTraining} disabled={addingLoading || !newTraining.name || !newTraining.completedAt}>
                {addingLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                Guardar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAddingTraining(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {loadingTrainings ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : trainings.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-4 text-center text-sm text-muted-foreground">
            No hay capacitaciones registradas
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {trainings.map((t) => {
              const isExpired = t.expiresAt && new Date(t.expiresAt) < now
              const isExpiringSoon = t.expiresAt && !isExpired && new Date(t.expiresAt) < new Date(now.getTime() + 30 * 86400000)
              return (
                <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.provider && <>{t.provider} · </>}
                      {new Date(t.completedAt).toLocaleDateString('es-AR')}
                      {t.expiresAt && (
                        <> · Vence: {new Date(t.expiresAt).toLocaleDateString('es-AR')}</>
                      )}
                    </p>
                  </div>
                  {isExpired && <Badge variant="destructive">Vencida</Badge>}
                  {isExpiringSoon && <Badge variant="warning">Por vencer</Badge>}
                  {!t.expiresAt && <Badge variant="secondary">Sin vencimiento</Badge>}
                  {t.expiresAt && !isExpired && !isExpiringSoon && <Badge variant="success">Vigente</Badge>}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveTraining(t.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Puestos ───────────────────────────

function PositionsTab({ orgId }: { orgId: string }) {
  const [positions, setPositions] = useState<PositionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [addingLoading, setAddingLoading] = useState(false)

  const fetchPositions = useCallback(() => {
    setLoading(true)
    api.organizations.getPositions<PositionItem[]>(orgId).then((data) => {
      setPositions(data)
      setLoading(false)
    })
  }, [orgId])

  useEffect(() => { fetchPositions() }, [fetchPositions])

  const handleAdd = async () => {
    if (!newName.trim()) return
    setAddingLoading(true)
    try {
      await api.organizations.createPosition(orgId, newName.trim())
      setNewName('')
      setAdding(false)
      fetchPositions()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    } finally {
      setAddingLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar el puesto "${name}"? Los usuarios con este puesto quedarán sin asignar.`)) return
    try {
      await api.organizations.deletePosition(orgId, id)
      fetchPositions()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    }
  }

  if (loading) return <LoadingCard />

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Puestos / Cargos</CardTitle>
          <CardDescription>
            Definí los puestos disponibles en la organización para asignar a los usuarios
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar puesto
        </Button>
      </CardHeader>
      <CardContent>
        <div className="divide-y rounded-lg border">
          {adding && (
            <div className="flex items-center gap-3 px-4 py-3">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd()
                  if (e.key === 'Escape') setAdding(false)
                }}
                placeholder="Nombre del puesto (ej: Analista Químico)"
                className="flex-1 rounded border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                disabled={addingLoading}
              />
              <Button size="sm" onClick={handleAdd} disabled={addingLoading || !newName.trim()}>
                {addingLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Crear'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          {positions.length === 0 && !adding ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No hay puestos definidos. Agregá puestos para asignarlos a los usuarios.
            </p>
          ) : (
            positions.map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-4 py-3">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium">{p.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(p.id, p.name)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Tab: Calidad (QualityRoles) ────────────

function QualityTab({ orgId }: { orgId: string }) {
  const [qualityRoles, setQualityRoles] = useState<QualityRoleItem[]>([])
  const [users, setUsers] = useState<OrgUser[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState('REVIEWER')
  const [addingLoading, setAddingLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [roles, orgUsers] = await Promise.all([
      api.approval.getQualityRoles() as Promise<QualityRoleItem[]>,
      api.organizations.getUsers(orgId) as Promise<OrgUser[]>,
    ])
    setQualityRoles(roles)
    setUsers(orgUsers)
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAssign = async () => {
    if (!selectedUserId) return
    setAddingLoading(true)
    try {
      await api.approval.assignQualityRole({
        organizationUserId: selectedUserId,
        role: selectedRole,
      })
      setSelectedUserId('')
      setAdding(false)
      fetchData()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    } finally {
      setAddingLoading(false)
    }
  }

  const handleRemove = async (qrId: string) => {
    if (!confirm('¿Quitar esta asignación de calidad?')) return
    try {
      await api.approval.removeQualityRole(qrId)
      fetchData()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    }
  }

  if (loading) return <LoadingCard />

  const reviewers = qualityRoles.filter((qr) => qr.role === 'REVIEWER')
  const approvers = qualityRoles.filter((qr) => qr.role === 'APPROVER')

  // Filtrar usuarios que ya tienen el rol seleccionado
  const assignedIds = qualityRoles
    .filter((qr) => qr.role === selectedRole)
    .map((qr) => qr.organizationUserId)
  const availableUsers = users.filter((u) => !assignedIds.includes(u.id))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Circuito de Aprobación ISO</CardTitle>
            <CardDescription>
              Asigná revisores y aprobadores para el circuito de aprobación de documentos y registros.
              El flujo es: Elaborador → Revisor → Aprobador.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Asignar rol
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {adding && (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="rounded border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="REVIEWER">Revisor</option>
                <option value="APPROVER">Aprobador</option>
              </select>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="flex-1 rounded border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Seleccionar usuario...</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.user.name} ({u.user.email})
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={handleAssign} disabled={addingLoading || !selectedUserId}>
                {addingLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Asignar'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Revisores */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Badge variant="info">Paso 1</Badge>
              Revisores
            </h3>
            <div className="divide-y rounded-lg border">
              {reviewers.length === 0 ? (
                <p className="px-4 py-4 text-center text-sm text-muted-foreground">
                  No hay revisores asignados
                </p>
              ) : (
                reviewers.map((qr) => (
                  <QualityRoleRow key={qr.id} item={qr} onRemove={handleRemove} />
                ))
              )}
            </div>
          </div>

          {/* Aprobadores */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Badge variant="success">Paso 2</Badge>
              Aprobadores
            </h3>
            <div className="divide-y rounded-lg border">
              {approvers.length === 0 ? (
                <p className="px-4 py-4 text-center text-sm text-muted-foreground">
                  No hay aprobadores asignados
                </p>
              ) : (
                approvers.map((qr) => (
                  <QualityRoleRow key={qr.id} item={qr} onRemove={handleRemove} />
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function QualityRoleRow({ item, onRemove }: { item: QualityRoleItem; onRemove: (id: string) => void }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
          {item.organizationUser.user.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <p className="text-sm font-medium">{item.organizationUser.user.name}</p>
        <p className="text-xs text-muted-foreground">{item.organizationUser.user.email}</p>
      </div>
      <Badge variant={item.role === 'REVIEWER' ? 'info' : 'success'}>
        {qualityRoleLabels[item.role]}
      </Badge>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive"
        onClick={() => onRemove(item.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

// ─── Loading placeholder ────────────────────

function LoadingCard() {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  )
}

// ─── Página principal ───────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('general')

  const { data: me, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me() as Promise<{ organizationId: string; role: string }>,
  })

  if (isLoading || !me) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const orgId = me.organizationId

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="mt-1 text-muted-foreground">
          Administrá tu organización, áreas, usuarios y permisos
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar de tabs */}
        <div className="w-56 shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Contenido */}
        <div className="flex-1 animate-fade-in">
          {activeTab === 'general' && <GeneralTab orgId={orgId} />}
          {activeTab === 'areas' && <AreasTab orgId={orgId} />}
          {activeTab === 'positions' && <PositionsTab orgId={orgId} />}
          {activeTab === 'whitelist' && <WhitelistTab orgId={orgId} />}
          {activeTab === 'users' && <UsersTab orgId={orgId} />}
          {activeTab === 'quality' && <QualityTab orgId={orgId} />}
        </div>
      </div>
    </div>
  )
}
