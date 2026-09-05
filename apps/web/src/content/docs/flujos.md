# Flujos

Un flujo automatiza lo que hoy alguien hace a mano: cuando pasa X en un
registro, que ocurra Y. Reemplaza la planilla que se copia de una hoja a otra y
el "avisale a Juan cuando esté listo".

Se configuran en la pestaña **Flujos** dentro de cada registro, y hay un mapa de
todos los de la organización en **Flujos** del menú lateral.

## Antes de los flujos: el campo de estado

Muchos flujos se apoyan en el estado de una entrada, así que conviene empezar
por ahí.

Cualquier registro puede tener un campo de tipo **Lista desplegable** marcado
como **campo de estado**. Cuando lo tiene, pasan tres cosas:

1. Aparece la pestaña **Kanban** en el registro, con una columna por opción y
   arrastre entre columnas.
2. Las transiciones dejan de ser libres: solo se puede pasar de un estado a otro
   si esa transición está declarada.
3. Cada cambio queda registrado con quién, cuándo y desde qué estado.

Al configurar el campo definís, para cada opción, su color, si es el estado
inicial, si es final, y desde qué estados se puede llegar a ella. Una transición
puede además **exigir un motivo escrito** o **restringirse a ciertos roles**.

```
ABIERTA --> EN PROCESO --> RESUELTA --> CERRADA
                              |
                              +--> (volver a EN PROCESO exige motivo)
```

El caso típico es una no conformidad: cerrarla sin explicar por qué no debería
ser posible, y el sistema lo impide en vez de confiar en la disciplina de quien
carga.

> **Solo en registros sin entidad compañera.** Los registros de tipo lote,
> muestra, instrumental o stock ya tienen su propio ciclo de vida —el del lote,
> el de la muestra— y mezclar dos ideas de "estado" sobre la misma entrada
> genera contradicciones. En esos casos el sistema no deja marcar un campo como
> estado.

## Cómo se arma un flujo

Cada flujo son cuatro decisiones:

| | Qué define | Ejemplo |
|---|---|---|
| **Disparador** | Qué evento lo activa | Cuando se completa una entrada |
| **Condición** | En qué casos, de todos esos, corre | Solo si el resultado es RECHAZADO |
| **Acción** | Qué hace | Crear una no conformidad |
| **Mapeo** | Qué datos viajan | El lote y la fecha pasan a la entrada nueva |

### Disparadores

- **Cuando se crea una entrada** — apenas se carga, todavía en borrador.
- **Cuando se completa una entrada** — al darla por terminada. Es el más usado:
  los datos ya están completos y validados.
- **Cuando cambia un campo de la entrada** — incluye el campo de estado, así que
  es el que engancha con el Kanban.
- **Cuando falla una comparación** — cuando un valor medido queda fuera del
  rango declarado. Es la puerta de entrada a las no conformidades automáticas.

### Condiciones

Una condición filtra sobre los datos de la entrada. Las comparaciones
disponibles son igual, distinto, está en la lista, no está en la lista, mayor,
menor, mayor o igual, menor o igual, y entre dos valores.

Se pueden combinar con **Y** y **O**, y anidar. Un flujo sin condición corre
siempre que se dé el disparador.

### Acciones

- **Crear entrada en otro registro** — el caso clásico: una producción terminada
  genera el movimiento de stock; un ensayo fuera de rango genera la no
  conformidad.
- **Actualizar campo de una entrada** — cambiar un valor en la misma entrada o
  en una relacionada. Sirve, por ejemplo, para mover el estado sin intervención
  manual.
- **Notificar dentro de la app** — un aviso en la campanita. Ver
  [Notificaciones](notificaciones).
- **Llamar a un webhook** — avisarle a un sistema externo (un ERP, un tablero).
  Solo direcciones públicas y por HTTPS.

El envío de emails está previsto pero todavía no funciona, y por eso aparece
deshabilitado: es preferible a ofrecer un aviso que nunca llega.

### Mapeo de campos

Define qué datos de la entrada de origen se copian a la de destino. Además de
los campos propios, se puede referenciar la entidad compañera —el número de
lote, la cantidad producida, el estado de la muestra— y la entrada de origen en
sí, para que la nueva quede apuntando de vuelta y la trazabilidad no se corte.

## Flujos encadenados

Un flujo puede disparar otro. Producción termina un lote, eso crea el movimiento
de stock, y ese movimiento avisa a compras que el insumo bajó del mínimo.

Para que eso no se vuelva un círculo infinito, un flujo **no se dispara cuando
el evento que lo activaría fue generado por otro flujo**, salvo que lo habilites
explícitamente con **Permitir encadenado**. Aun habilitándolo, la cadena tiene
un límite de profundidad: si se alcanza, el sistema corta y lo deja anotado.

La recomendación práctica: encendé el encadenado solo en el flujo que
efectivamente necesita continuar la cadena, no en todos por las dudas.

## El editor visual

La pestaña **Flujos** del registro muestra un mapa: el registro de origen a la
izquierda y una rama por flujo hacia la derecha. Cada rama dice a dónde va y
cuándo se dispara; al hacer clic se edita en el panel de la derecha.

**Las ramas en rojo con un signo de admiración no están corriendo.** Un flujo al
que le falta configuración —sin destino, sin campos mapeados— se guarda igual,
para que puedas dejarlo a medias y volver, pero el sistema no lo ejecuta. La
marca roja existe para que eso no sea una sorpresa: es la diferencia entre "lo
configuré" y "está funcionando".

## El mapa global

**Flujos** en el menú lateral muestra todos los flujos de la organización
juntos, con los registros que conectan. Sirve para ver de un vistazo qué depende
de qué antes de archivar un registro o cambiarle los campos.
