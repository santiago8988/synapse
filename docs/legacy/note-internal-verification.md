Pasa lo siguiente con el instrumental, vos tenes:
	
	1) Calibracion externa, que lo estariamos manejando con la entidad instrument
	 Pero tenes luego:
	2) Verificaciones internas q tendran su periodicidad y se comparan contra un patron o como lo haga cada laboratorio.
		Ahi si podriamos manejarlo mediante acciones a un registro periodico de calibracion interna para cada instrumental
		que personalizara cada organizacion.


Creo q asi seria la forma mas correcta y nos da trazabilidad completa. 
Lo unico que no se como manejar lo siguiente. Te paso un full ejemplo:

Registro: 
{"idx":3,"id":"cmnez30h8000aw84gru9qtlf7","organizationId":"cmndkt4qf0000w8pojfer4y69","areaId":null,"documentId":null,"name":"BALANZA","type":"INSTRUMENTAL","periodicity":60,"notifyDaysBefore":5,"isActive":true,"createdAt":"2026-03-31 18:50:56.294","updatedAt":"2026-03-31 18:50:56.294","createdById":"cmndt1ggz0000w8e881f4ccf4","changeLog":null,"version":1}

Entry:
{"idx":2,"id":"cmnez6fxb000jw84gmmtkj6hk","recordId":"cmnez30h8000aw84gru9qtlf7","status":"COMPLETED","dueDate":null,"completedAt":"2026-03-31 19:11:04.848","createdAt":"2026-03-31 18:53:37.44","updatedAt":"2026-03-31 19:11:04.85","createdById":"cmndt1ggz0000w8e881f4ccf4","data":"{\"cmnez30h8000bw84gba1s0h1s\": \"BAL-0001\", \"cmnez30h8000cw84gohzlvscz\": \"KILITO\", \"cmnez30h8000dw84go0zkbbfh\": \"KG\", \"cmnez30h8000ew84gane3vtk6\": 200, \"cmnez30h8000fw84gpwk6zkic\": 0.1}","comparisonResults":"null","formulaResults":"null","triggeredById":null,"recordVersion":1}

Instrument:
{"idx":0,"id":"cmnez6gnv000nw84g1ubueoku","organizationId":"cmndkt4qf0000w8pojfer4y69","status":"ACTIVE","createdAt":"2026-03-31 18:53:38.395","updatedAt":"2026-03-31 20:39:05.939","entryId":"cmnez6fxb000jw84gmmtkj6hk","nextCalibrationAt":"2026-05-30 20:39:05.936","recordId":"cmnez30h8000aw84gru9qtlf7"}


Al ser tipo instrumental cuando creo una entrada se crea en instrument la row

Segun lo que propongo arriba se deberia crear un record de tipo PERIODIC:
'Verificacion Interna Balanza' que reciba una accion del registro 'BALANZA' ira con su configuracion en OWN etc etc segun su marco teorico dado por los documents

AHora cuando el instrument (q el identifier sera CODIGO) esta en status CALIBRATION o se da de baja. Como reflejo eso en el registro periodico 'Verificacion Interna Balanza'
o al reves desde 'Verificacion Interna Balanza' doy de baja el registro porq se rompio...se deberia verificar del otro lado y asi.