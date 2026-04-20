import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { Response } from 'express'

@Catch(PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    let status: number
    let message: string

    switch (exception.code) {
      case 'P2002':
        status = HttpStatus.CONFLICT
        message = 'Ya existe un registro con esos datos'
        break
      case 'P2025':
        status = HttpStatus.NOT_FOUND
        message = 'Registro no encontrado'
        break
      default:
        status = HttpStatus.INTERNAL_SERVER_ERROR
        message = 'Error interno del servidor'
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: exception.code,
    })
  }
}
