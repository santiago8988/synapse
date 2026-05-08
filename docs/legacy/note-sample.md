Cuando creamos un registro de tipo 'sample' le tenemos que seleccionar la matriz lo que nos encierra en un solo tipo de muestra q pueda recibir:

1) Muestras agua potable

2) Muestras suelo 

Serian registro de tipo 'sample' donde les configuras la matriz q usan en la definicion del registro
Una vez creada una entrada en cualquiera de esos registros crea un registro en la entidad sample donde se usa la matriz.

Ahora este enfoque me obliga a ponele si yo quiero configurar un registro NOT_PERIODIC llamadao 'ingreso de muestras' a crear un registro NOT_PERIODIC por tipo de analisis.
Siguiendo con el ejemplo dos registros NOT_PERIODIC:

1) Ingreso Muestras agua potable
		Cliente
		Codigo Muestra

2) Ingreso muestras suelo 
		Cliente
		Codigo Muestra
		
Y configurarle una accion a cada uno a sus respectivos registros de tipo 'sample':

 1) Ingreso Muestras agua potable ---> Muestras agua potable
 2) Ingreso muestras suelo        ---> Muestras suelo 
 


Es engorroso , requiere tantas configuraciones como matrices tengas.
Dado que matriz y metodos son entidades, se los puede agregar como campos. Y realizar una accion a un registro nuevo llamado 'Analisis Muestras' de tipo 'sample' donde si o si te pide
que transcribas a informacion a CODIGO luego en la validacion matriz o codigo tienen q tener informacion o ambos.

Si tengo matriz y no se cargan metodos ---> se usa la matriz definida
Si tengo matriz y algunos metoidos ---> se usan esos algunos metodos, la matriz es una formalidad, se podria usar nomas para filtrar los metodos y seleccionar algunos de esa matriz
Si no tengo matriz y algunos metodos ---> se usaran los metodos seleccionados.
No es posible no tener matriz y no metodos simultaneamente.

Eso hace una sola configracion.

Y por default cuando creas un registro sample, debe venir con el CODIGO de tipo texto ...y los campos de tipo matriz( solo un select)  y metodos (multi-select)

*********************
Otra cosa que estaba pensando los registros de tipo batch/sample cuando reciben una accion tmb deben disparar la creacion de sus entidades relacionadas