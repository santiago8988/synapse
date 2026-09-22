import { z } from 'zod'

export const assignQualityRoleSchema = z.object({
  organizationUserId: z.string().cuid(),
  role: z.enum(['REVIEWER', 'APPROVER']),
}).strict()

export const submitForApprovalSchema = z.object({
  entityType: z.enum(['DOCUMENT', 'RECORD', 'RECIPE', 'MATRIX', 'CALIBRATION_TEMPLATE']),
  entityId: z.string().cuid(),
}).strict()

/**
 * La decision de aprobacion es el acto con valor legal del circuito ISO: queda
 * en `ApprovalDecision` y es lo que sostiene que una plantilla paso a ACTIVE.
 * Solo dos valores, y el comentario con techo.
 */
export const approvalDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  comments: z.string().max(2000).optional(),
}).strict()

export type AssignQualityRoleInput = z.infer<typeof assignQualityRoleSchema>
export type SubmitForApprovalInput = z.infer<typeof submitForApprovalSchema>
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>
