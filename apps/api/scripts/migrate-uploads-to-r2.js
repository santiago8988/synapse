/**
 * Migración de una sola vez: sube a R2 los archivos que quedaron en el disco
 * local antes de que se configurara el storage remoto.
 *
 * Por qué hace falta: hasta que existió StorageModule, los PDFs se guardaban en
 * apps/api/uploads/<scope>/<key>. La clave (`key`) es lo único que se persiste
 * en la base, y R2StorageService la resuelve como el objeto `<scope>/<key>` del
 * bucket. O sea que la migración es una copia directa preservando la ruta
 * relativa: no hay que tocar ninguna fila de la base.
 *
 * Es idempotente: si el objeto ya existe en el bucket, lo saltea. Y no borra
 * nada del disco — si algo sale mal, los originales siguen ahí.
 *
 * Uso (desde apps/api):
 *   node scripts/migrate-uploads-to-r2.js          # sube
 *   node scripts/migrate-uploads-to-r2.js --dry    # solo lista lo que haría
 */

const fs = require('fs')
const path = require('path')
const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3')

// Los scopes validos, en el mismo orden que STORAGE_SCOPES del backend.
const SCOPES = [
  'documents',
  'entries',
  'recipes',
  'instrument-certificates',
  'calibration-templates',
]

const CONTENT_TYPES = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) {
    throw new Error('No se encontró .env — corré el script desde apps/api')
  }
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '')
  }
}

/** Acepta el id pelado o pegado dentro del endpoint del dashboard. */
function normalizeAccountId(raw) {
  return String(raw || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\.r2\.cloudflarestorage\.com.*$/, '')
    .replace(/\/+$/, '')
}

/** Lista recursiva de archivos, devolviendo la ruta relativa a `root`. */
function walk(root, prefix = '') {
  const dir = path.join(root, prefix)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix ? path.posix.join(prefix, entry.name) : entry.name
    return entry.isDirectory() ? walk(root, rel) : [rel]
  })
}

async function main() {
  const dryRun = process.argv.includes('--dry')
  loadEnv()

  const accountId = normalizeAccountId(process.env.R2_ACCOUNT_ID)
  const bucket = process.env.R2_BUCKET_NAME
  const missing = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
  ].filter((k) => !process.env[k])
  if (missing.length > 0) {
    throw new Error(`Faltan variables de R2: ${missing.join(', ')}`)
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  })

  const uploadsRoot = path.join(process.cwd(), 'uploads')
  console.log(`Bucket: ${bucket}${dryRun ? '  (DRY RUN, no sube nada)' : ''}\n`)

  let subidos = 0
  let salteados = 0
  let fallidos = 0

  for (const scope of SCOPES) {
    const scopeDir = path.join(uploadsRoot, scope)
    const files = walk(scopeDir)
    if (files.length === 0) continue

    console.log(`${scope} (${files.length})`)
    for (const rel of files) {
      const key = `${scope}/${rel}`
      const filepath = path.join(scopeDir, rel)

      try {
        // Idempotencia: si ya está en el bucket no lo volvemos a subir.
        try {
          await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
          console.log(`  = ${rel}  (ya existía)`)
          salteados++
          continue
        } catch (err) {
          if (err.name !== 'NotFound' && err.$metadata?.httpStatusCode !== 404) {
            throw err
          }
        }

        if (dryRun) {
          console.log(`  + ${rel}`)
          subidos++
          continue
        }

        const ext = path.extname(rel).toLowerCase()
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: fs.readFileSync(filepath),
            ContentType: CONTENT_TYPES[ext] || 'application/octet-stream',
          }),
        )
        console.log(`  + ${rel}`)
        subidos++
      } catch (err) {
        console.error(`  ! ${rel}  → ${err.name}: ${err.message}`)
        fallidos++
      }
    }
  }

  console.log(
    `\nSubidos: ${subidos}  ·  Ya existían: ${salteados}  ·  Fallidos: ${fallidos}`,
  )
  if (fallidos > 0) process.exit(1)
  if (!dryRun && subidos > 0) {
    console.log(
      'Los archivos siguen en uploads/ — borralos recién cuando confirmes que se ven bien desde la app.',
    )
  }
}

main().catch((err) => {
  console.error('FALLO:', err.message)
  process.exit(1)
})
