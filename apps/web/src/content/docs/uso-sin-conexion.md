# Instalación y uso sin conexión

Synapse funciona en el navegador, pero se puede instalar en el celular o la
tablet como una aplicación más: con su ícono, sin barra de direcciones y a
pantalla completa.

## Instalarla

- **Android (Chrome)** — menú de tres puntos → *Agregar a pantalla de inicio*.
- **iPhone / iPad (Safari)** — botón de compartir → *Agregar a pantalla de inicio*.
- **Escritorio (Chrome / Edge)** — ícono de instalación en la barra de
  direcciones.

No hay que bajar nada de ninguna tienda ni pedirle permisos a nadie.

## Qué pasa cuando se cae la conexión

En planta la señal se pierde: subsuelos, cámaras de frío, paredes gruesas. La
app está preparada para eso, con un alcance concreto que conviene conocer.

**Se puede leer.** Las pantallas que ya visitaste siguen abriendo, con los datos
que tenían la última vez que hubo conexión. Podés consultar un procedimiento,
mirar el estado de un lote o revisar los resultados de un ensayo anterior.

**No se puede cargar ni modificar.** Guardar una entrada, completar un ensayo,
mover una tarjeta en el Kanban: todo eso falla en el momento, con un error
visible.

Mientras estés sin conexión, una franja ámbar arriba de la pantalla te lo
recuerda. Sin ese aviso, una pantalla sin conexión se ve exactamente igual que
una conectada, solo que con datos de hace un rato — y alguien podría estar
mirando un lote "EN PROCESO" que ya se aprobó.

Si abrís una pantalla que nunca habías visitado, aparece una pantalla de *Sin
conexión*: no hay copia local de algo que nunca se descargó.

## Por qué no se puede cargar sin conexión

Es una decisión, no una limitación técnica.

Guardar las cargas en el dispositivo y sincronizarlas al recuperar la señal
suena bien hasta que aparece la pregunta de la fecha. Si el operario completa un
ensayo a las 10:15 y el dispositivo se sincroniza a las 14:00, ¿qué hora lleva
ese registro?

Anotar la de carga miente sobre cuándo se hizo el ensayo. Anotar la de
sincronización miente sobre cuándo se registró. Y en un sistema de calidad la
fecha de un resultado no es un detalle: es parte de lo que el registro afirma.

La salida honesta es guardar las dos fechas y que la auditoría muestre ambas.
Eso es un cambio de fondo, y hasta que esté resuelto es preferible que la app
falle de frente antes que aceptar un dato cuya fecha no puede sostener.

## Dispositivos compartidos

Los datos que la app guarda para poder leerlos sin conexión están separados por
usuario: lo que descargó una persona no lo puede leer la siguiente.

Aun así, **cerrá sesión al terminar el turno**. Es lo que borra esa copia del
dispositivo. Si te vas sin cerrar sesión, tu sesión sigue abierta para quien
agarre la tablet después.
