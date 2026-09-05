-- Notificaciones dentro de la app.
--
-- Las genera la accion NOTIFY del motor de flujos, que hasta ahora era un stub:
-- el editor dejaba configurarla y no ocurria nada.
--
-- NO es append-only: el usuario marca como leida y puede archivar. El paper
-- trail de lo que efectivamente paso vive en AuditLog y en los *StatusLog; esto
-- es solo el aviso.

CREATE TABLE "Notification" (
    "id"             TEXT         NOT NULL,
    "organizationId" TEXT         NOT NULL,
    -- Destinatario. Se resuelve al crear la notificacion y no al leerla: si
    -- despues cambia el rol o el area del usuario, el aviso que ya recibio
    -- sigue siendo suyo.
    "userId"         TEXT         NOT NULL,
    "title"          TEXT         NOT NULL,
    "body"           TEXT,
    -- Adonde lleva el aviso al hacer click. Ruta relativa del frontend.
    "link"           TEXT,
    -- Que lo origino, para poder rastrearlo. Nullable porque mas adelante
    -- pueden existir notificaciones que no vengan de un flujo.
    "recordActionId" TEXT,
    "entryId"        TEXT,
    "readAt"         TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- El listado siempre filtra por destinatario dentro de una organizacion, y
-- ordena por fecha. El indice parcial sirve al contador de no leidas, que se
-- consulta en cada carga de pagina.
CREATE INDEX "Notification_userId_organizationId_createdAt_idx"
    ON "Notification"("userId", "organizationId", "createdAt" DESC);
CREATE INDEX "Notification_unread_idx"
    ON "Notification"("userId", "organizationId")
    WHERE "readAt" IS NULL;

ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
