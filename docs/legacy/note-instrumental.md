Seria asi lo que imagino:

Formulario de creacion de registro:

 TIPO: INSTRUMENTAL
 
 PIDE: periodicity y notify
 
 agregas los campos que cada organizacion quiera tal cual veiamos. Por default debe estar CODIGO y se identifier y no poder eliminarse.
 
 
 vos podes tener registros de tipo INSTRUMENTAL:
	-BALANZA
	-Termometros
	-PIPETAS
	-etc
	
 Al ser instrumentales cuando vos en cada uno instancias una entrada ( das de alta un instrumental)
 
 Se genera una entrada en instrumental que esta 1:1 con la entryid e indirectamente con el recordid
 
 Lo que sirve la entidad instrumental es no tener q crear registros periodicos de calibracion para cada uno de estos, que hastra ahora se manejan como NOT_PERIODIC:
 
	-BALANZA
	-Termometros
	-PIPETAS
	-etc