import { BadRequestException } from '@nestjs/common'
import { UploadedFileLike } from './storage.service'

/** 10 MB, el limite que ya usaban entries, instruments, recipes y templates. */
export const PDF_MAX_BYTES = 10 * 1024 * 1024

/**
 * Opciones para `FileInterceptor`. El limite va en multer y no solo en la
 * validacion posterior: `FileInterceptor` usa memoryStorage, asi que sin
 * `limits` el archivo entero se bufferea en RAM y recien despues se mide. Con
 * esto multer corta el stream al pasarse y Nest lo traduce a un 413.
 *
 * `files: 1` descarta un multipart con muchas partes de archivo, que tambien se
 * bufferearian antes de que el handler mire nada.
 */
export const PDF_UPLOAD_OPTIONS = {
  limits: { fileSize: PDF_MAX_BYTES, files: 1 },
}

/**
 * Valida que lo subido sea un PDF de verdad y no supere el tamano.
 *
 * `file.mimetype` lo declara el cliente en el multipart: comparar contra
 * 'application/pdf' solo comprueba lo que el cliente dijo de si mismo, no lo que
 * mando. Aca se mira el contenido: cabecera `%PDF-` y marca de cierre `%%EOF`.
 *
 * No es un saneador de PDF —no inspecciona /OpenAction, /JavaScript ni adjuntos
 * incrustados— pero cierra el caso de subir cualquier cosa con el mime correcto,
 * que despues StorageController devuelve declarada como application/pdf.
 *
 * Centralizado porque estaba copiado y pegado en cuatro controllers, y en
 * documents (upload y version) faltaba por completo: ahi entraba cualquier
 * archivo, de cualquier tamano.
 */
export function assertUploadedPdf(
  file: UploadedFileLike | undefined,
  maxBytes: number = PDF_MAX_BYTES,
): UploadedFileLike {
  if (!file) {
    throw new BadRequestException('No se adjuntó ningún archivo')
  }

  if (file.size > maxBytes) {
    throw new BadRequestException(
      `El archivo supera el tamaño máximo permitido (${Math.floor(maxBytes / (1024 * 1024))} MB)`,
    )
  }

  if (file.mimetype !== 'application/pdf') {
    throw new BadRequestException('Solo se permiten archivos PDF (application/pdf)')
  }

  const buffer = file.buffer
  if (!buffer || buffer.length === 0) {
    throw new BadRequestException('El archivo está vacío')
  }
  // `size` lo reporta multer; el buffer es lo que realmente se va a guardar.
  if (buffer.length > maxBytes) {
    throw new BadRequestException(
      `El archivo supera el tamaño máximo permitido (${Math.floor(maxBytes / (1024 * 1024))} MB)`,
    )
  }

  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new BadRequestException('El archivo no es un PDF válido')
  }

  // %%EOF puede venir seguido de saltos de linea o basura corta al final.
  if (!buffer.subarray(-2048).toString('latin1').includes('%%EOF')) {
    throw new BadRequestException('El PDF está incompleto o truncado')
  }

  return file
}
