import { UserRole, QualityRoleType, ApprovableEntity } from './enums'

// Auth
export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  organizationId: string
  organizationName: string
  role: UserRole
  areaId: string | null
}

export interface SwitchOrgDto {
  organizationId: string
}

// Organization
export interface UpdateOrganizationDto {
  name?: string
  logoUrl?: string
}

// Areas
export interface CreateAreaDto {
  name: string
  parentId?: string
}

export interface UpdateAreaDto {
  name?: string
  parentId?: string | null
}

// Whitelist
export interface AddWhitelistDto {
  email: string
  role?: UserRole
  areaId?: string
}

// Users
export interface UpdateOrgUserDto {
  role?: UserRole
  areaId?: string | null
  positionId?: string | null
  phone?: string | null
  signature?: string | null
  isActive?: boolean
}

// Positions
export interface CreatePositionDto {
  name: string
}

export interface CreateTrainingDto {
  name: string
  description?: string
  provider?: string
  completedAt: string
  expiresAt?: string
  certificateUrl?: string
}

// Approval
export interface AssignQualityRoleDto {
  organizationUserId: string
  role: QualityRoleType
}

export interface SubmitForApprovalDto {
  entityType: ApprovableEntity
  entityId: string
}

export interface ApprovalDecisionDto {
  decision: 'APPROVED' | 'REJECTED'
  comments?: string
}

// Recipe
export interface CreateRecipeDto {
  name: string
  code?: string
  ingredients: Array<{ name: string; quantity: number; unit: string; order: number }>
  steps: Array<{ order: number; name: string; description?: string; duration?: number; controls?: string }>
}

export interface UpdateRecipeDto {
  name?: string
  code?: string
  ingredients?: Array<{ name: string; quantity: number; unit: string; order: number }>
  steps?: Array<{ order: number; name: string; description?: string; duration?: number; controls?: string }>
}

// API Response wrapper
export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}
