import { SetMetadata } from '@nestjs/common'

export const AUDIT_IGNORE_KEY = 'audit_ignore'
export const AuditIgnore = () => SetMetadata(AUDIT_IGNORE_KEY, true)
