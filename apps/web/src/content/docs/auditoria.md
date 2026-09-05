# Auditoría

El registro de auditoría es la respuesta a la pregunta que hace todo auditor:
*¿quién cambió esto, cuándo, y qué decía antes?*

## Qué se registra

Toda operación que modifica datos: crear, editar, eliminar, cambiar de estado,
aprobar, rechazar. De cada una se guarda quién la hizo, cuándo, sobre qué
entidad, y **los valores anterior y nuevo**.

Guardar el valor anterior es lo que convierte al registro en evidencia. Sin él,
la línea dice que alguien editó una entrada pero no qué había antes, y eso no
demuestra nada.

## Es inalterable

Las líneas del registro de auditoría **no se pueden editar ni borrar**, por
nadie, incluido un administrador. No es una restricción de permisos que se pueda
levantar: no existe la operación.

Lo mismo vale para los historiales de estado —de entradas, instrumentos y
lotes— y para los certificados de calibración. Son todos de solo agregado.

## Dónde se consulta

**Auditoría** en el menú lateral muestra el registro completo de la
organización, filtrable. Está limitado a los roles **ADMIN** y **AUDITOR**,
porque incluye direcciones IP y datos técnicos de cada operación.

Además, cada registro tiene su propia pestaña **Auditoría** con la historia de
ese registro y de todas sus entradas: qué campos cambiaron, con su valor
anterior y el nuevo, en orden cronológico. Esa vista es reducida —sin IP ni
datos crudos— y por eso también la ve **QUALITY_MANAGER**, que es quien
normalmente necesita revisar el historial de un registro sin tener acceso al
registro completo de la organización.

## Qué no se registra

Contraseñas, tokens y datos sensibles se recortan antes de guardar. Un registro
de auditoría que filtrara credenciales sería un problema de seguridad disfrazado
de control.

Las consultas de solo lectura tampoco se registran: si cada pantalla abierta
generara una línea, el registro se llenaría de ruido y encontrar el cambio que
importa sería imposible.

## Historiales de estado

Aparte del registro general, cada cambio de estado deja su propia línea con el
estado anterior, el nuevo, quién lo hizo y —cuando la transición lo exige— el
motivo escrito.

Aplica a las entradas con campo de estado, a los instrumentos y a los lotes. Es
lo que permite reconstruir el recorrido completo de un lote o de una no
conformidad sin tener que interpretar el registro general.

## Para una auditoría

Lo que habitualmente se pide y dónde está:

| Pregunta | Dónde mirar |
|----------|-------------|
| ¿Quién cargó este resultado y cuándo? | Pestaña Auditoría del registro |
| ¿Se modificó después de completarse? | Pestaña Auditoría del registro |
| ¿Con qué instrumento se hizo? | Detalle de la entrada |
| ¿Ese instrumento estaba calibrado ese día? | Historial del instrumento y sus certificados |
| ¿Quién aprobó este documento? | Circuito de aprobación del documento |
| ¿Por qué se cerró esta no conformidad? | Historial de estados, con el motivo |
