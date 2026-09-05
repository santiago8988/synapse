# Organización y accesos

Todo lo que define quién entra al sistema y qué puede ver. Se administra desde
**Organización** en el menú lateral.

## La organización es un compartimento estanco

Cada organización es un espacio aislado. Los registros, documentos, muestras y
usuarios de una nunca son visibles desde otra, incluso cuando la misma persona
pertenece a las dos. No es una preferencia de la interfaz: el aislamiento está
en cada consulta a la base de datos.

Si tu email está habilitado en más de una organización, el selector arriba del
menú lateral te permite cambiar. Al cambiar, la app se recarga entera: tu rol y
tu área pueden ser distintos en cada una, así que ninguna pantalla abierta
sigue siendo válida.

## Autorizar no es lo mismo que dar de alta

Esta distinción confunde y conviene tenerla clara.

En **Whitelist** agregás un email con un rol. Eso **autoriza**, no crea al
usuario. La persona todavía no existe en el sistema: no tiene nombre, ni área,
ni puesto, y no aparece en **Usuarios**.

Recién cuando esa persona inicia sesión por primera vez con su cuenta de Google,
el sistema la da de alta como miembro con el rol que dejaste anotado. Ahí pasa a
figurar en Usuarios y podés completarle área, puesto y teléfono.

Por eso la whitelist marca **Sin ingresar** a quien todavía no entró. No es un
error ni algo que esté trabado esperando aprobación: es simplemente alguien que
tiene la puerta abierta y no la cruzó.

```
Agregás el email a la whitelist
  --> queda "Sin ingresar", no figura en Usuarios
      --> la persona entra con Google por primera vez
          --> se crea el miembro, con el rol de la whitelist
              --> ya figura en Usuarios; completás área y puesto
```

Quitar un email de la whitelist no borra al miembro que ya se creó. Para sacarle
el acceso a alguien que ya entró hay que desactivarlo desde Usuarios.

## No hay registro público

Nadie puede crearse una cuenta. El único camino de entrada es que un
administrador ponga el email en la whitelist. Es un requisito de control de
accesos de las normas ISO y también la razón por la que no existe pantalla de
"crear cuenta" ni recuperación de contraseña: no hay contraseñas, la identidad
la aporta Google.

## Roles

| Rol | Qué puede hacer |
|-----|-----------------|
| **ADMIN** | Todo. Administra usuarios, áreas, puestos y configuración. No tiene restricción de área. |
| **QUALITY_MANAGER** | Crea registros, documentos, fórmulas y matrices. Gestiona no conformidades. Ve su área y las que dependen de ella. |
| **TECHNICIAN** | Carga datos en las entradas, opera lotes, registra muestras y movimientos de stock. Ve su área. |
| **AUDITOR** | Solo lectura, sobre toda la organización. Pensado para auditorías internas y externas. |

El rol se asigna en la whitelist y se puede cambiar después desde Usuarios.

## Áreas: la visibilidad es jerárquica

Las áreas forman un árbol. Un usuario ve **su área y todas las que cuelgan de
ella**, no solo la propia.

```
Laboratorio Central          <- quien está acá ve todo lo de abajo
+-- Fisicoquímica            <- quien está acá ve Cromatografía
|   +-- Cromatografía
+-- Microbiología
```

Es la razón por la que conviene pensar el árbol antes de cargar usuarios: mover
a alguien de rama le cambia lo que ve.

Cada área puede tener un **jefe** asignado. Además de la línea de reporte, sirve
para los flujos: la acción de avisar puede dirigirse a "el jefe del área", sin
tener que nombrar a una persona que quizás mañana no esté en el puesto.

## Puestos

Los puestos son libres y los define cada organización: Analista Químico, Jefe de
Planta, Director Técnico. Son descriptivos —aparecen en el perfil y en los
circuitos de aprobación— y **no otorgan permisos**. Los permisos salen del rol.

La separación es deliberada: podés tener tres analistas con el mismo rol
TECHNICIAN y puestos distintos, sin que eso cambie lo que cada uno puede tocar.

## Capacitaciones

Cada usuario puede tener capacitaciones registradas con fecha de realización,
vencimiento y certificado adjunto. El estado se calcula solo —**Vigente**, **Por
vencer**, **Vencida**— y el dashboard avisa de las que están por caer.

Para ISO 17025 esto es evidencia de competencia del personal: sirve para
demostrar que quien ejecutó un ensayo estaba habilitado para hacerlo en esa
fecha.

## Cerrar sesión

Está en el bloque con tu nombre, al pie del menú lateral.

En un dispositivo compartido —la tablet de planta, la PC del laboratorio— cerrar
sesión importa más de lo que parece: además de borrar tu sesión, elimina los
datos que la app haya guardado para poder leerlos sin conexión. Si te vas sin
cerrar sesión, quedan disponibles para el turno siguiente.
