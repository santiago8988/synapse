import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { PrismaModule } from './prisma/prisma.module'
import { EventsModule } from './common/events/events.module'
import { StorageModule } from './common/storage/storage.module'
import { AuthModule } from './modules/auth/auth.module'
import { OrganizationsModule } from './modules/organizations/organizations.module'
import { UsersModule } from './modules/users/users.module'
import { AreasModule } from './modules/areas/areas.module'
import { DocumentsModule } from './modules/documents/documents.module'
import { RecordsModule } from './modules/records/records.module'
import { EntriesModule } from './modules/entries/entries.module'
import { InstrumentsModule } from './modules/instruments/instruments.module'
import { NonConformitiesModule } from './modules/non-conformities/non-conformities.module'
import { AuditModule } from './modules/audit/audit.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { DashboardModule } from './modules/dashboard/dashboard.module'
import { ApprovalModule } from './modules/approval/approval.module'
import { RecipesModule } from './modules/recipes/recipes.module'
import { BatchesModule } from './modules/batches/batches.module'
import { SamplesModule } from './modules/samples/samples.module'
import { MatricesModule } from './modules/matrices/matrices.module'
import { MethodsModule } from './modules/methods/methods.module'
import { StockModule } from './modules/stock/stock.module'
import { CalibrationTemplatesModule } from './modules/calibration-templates/calibration-templates.module'
import { CalibrationsModule } from './modules/calibrations/calibrations.module'
import { AuditInterceptor } from './common/interceptors/audit.interceptor'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { TenantGuard } from './common/guards/tenant.guard'
import { RolesGuard } from './common/guards/roles.guard'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventsModule,
    PrismaModule,
    StorageModule,
    AuthModule,
    OrganizationsModule,
    UsersModule,
    AreasModule,
    DocumentsModule,
    RecordsModule,
    EntriesModule,
    InstrumentsModule,
    NonConformitiesModule,
    AuditModule,
    NotificationsModule,
    DashboardModule,
    ApprovalModule,
    RecipesModule,
    BatchesModule,
    SamplesModule,
    MatricesModule,
    MethodsModule,
    StockModule,
    CalibrationTemplatesModule,
    CalibrationsModule,
  ],
  providers: [
    // Deny-by-default. Los guards eran opt-in por controller con `@UseGuards`, y
    // ahi el default es abierto: un controller nuevo al que se le olvida el
    // decorador queda sin autenticacion. Registrados globalmente, la regla se
    // invierte y abrir una ruta exige `@Public()` explicito.
    //
    // El orden importa: JwtAuthGuard deja el usuario en la request, TenantGuard
    // lee su organizationId y RolesGuard su rol.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
