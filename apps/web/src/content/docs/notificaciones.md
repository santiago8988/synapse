# Notificaciones

La campanita de la barra superior junta los avisos dirigidos a vos. El punto
rojo indica que hay sin leer.

## De dónde salen

Los avisos los genera la acción **Notificar dentro de la app** de un
[flujo](flujos). No hay avisos "del sistema" sueltos: si llega uno, es porque
alguien configuró un flujo que lo manda.

Eso es deliberado. Un sistema que decide por su cuenta a quién molestar termina
ignorado; uno donde cada aviso tiene un responsable identificable se puede
ajustar cuando molesta de más.

## A quién le llega

Al configurar la acción se elige el destinatario:

| Destinatario | Quién recibe |
|--------------|--------------|
| **Jefe del área** | El jefe asignado al área del registro que disparó el flujo. Si el área no tiene jefe, no le llega a nadie. |
| **Por rol** | Todos los usuarios activos con ese rol en la organización. |
| **Usuario puntual** | Una persona, siempre que siga activa. |

"Jefe del área" suele ser mejor que nombrar a una persona: sobrevive a los
cambios de puesto. Si nombrás a alguien y esa persona se va, el flujo queda
avisándole a un usuario inactivo y nadie se entera de que el aviso dejó de
llegar.

Los avisos **nunca cruzan organizaciones**. Aunque un flujo quedara configurado
con el identificador de un usuario de otra organización, no se envía.

## El mensaje

El texto lo escribís vos y puede incluir datos de la entrada que disparó el
flujo, de modo que el aviso diga algo concreto en vez de "revisá el sistema".

```
Lote {NUMERO DE LOTE} rechazado. Motivo: {OBSERVACIONES}
```

## Webhooks

La acción **Llamar a un webhook** avisa a un sistema externo en vez de a una
persona: un ERP, un tablero, una integración propia.

Dos restricciones que conviene conocer antes de configurarlo:

- **Solo direcciones públicas y por HTTPS.** No se puede apuntar a una dirección
  interna de la red. Es una protección: sin ella, un flujo mal configurado
  —o configurado con mala intención— podría usarse para alcanzar servicios
  internos que no deberían estar expuestos.
- **Hay un tiempo límite de respuesta.** Si el destino no contesta, el intento
  se descarta y queda anotado. No hay reintentos todavía, así que un webhook no
  es el canal adecuado para algo que no puede perderse.

## Emails

Está previsto y todavía **no funciona**, por eso aparece deshabilitado al
configurar un flujo.

La razón de no habilitarlo a medias: sin un dominio propio verificado, los
avisos caen en correo no deseado. Un sistema de calidad que avisa a la carpeta
de spam es peor que uno que no avisa, porque todos creen que sí avisó.
