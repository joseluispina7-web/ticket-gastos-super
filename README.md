# Ticket Gastos Super

Web multiusuario para subir tickets de supermercado, revisar lineas de compra y ver el gasto desglosado por categorias, productos, tiendas y periodos.

## Web

https://ticket-gastos-super.erpozi.chatgpt.site

## Idea del producto

- Login con usuario y contrasena.
- Maximo pensado para 3 usuarios.
- Cada usuario ve solo sus tickets.
- Subida de PDF, imagen o texto pegado.
- Lectura de PDF con reconstruccion de lineas y OCR para documentos escaneados.
- Revision manual antes de guardar.
- Categorias aprendidas por usuario.
- Dashboard mensual con total, tickets, productos unicos, categoria top, donut de categorias, historico, total anual y top productos.
- Estado vacio real: la aplicacion no muestra supermercados ni importes inventados.

## Archivos clave

- `web/index.html`: interfaz completa, estilos y logica del cliente.
- `server/index.js`: backend de Sites con usuarios, sesiones, tickets e items.
- `scripts/build.py`: genera `dist/server/html.js` y `dist/server/index.js`.
- `scripts/test_client.mjs`: valida el parser, las categorias y la reconstruccion de lineas de PDF.
- `.openai/hosting.json`: configuracion de Sites y D1.

## Comparador de precios: siguiente fase

El comparador debe tratar cada supermercado como una fuente independiente y guardar la fecha de actualizacion de cada precio. Antes de comparar, todos los formatos se normalizaran a `EUR/kg`, `EUR/L` o `EUR/unidad`.

La comparacion final tambien tendra en cuenta:

- Codigo postal, tienda y disponibilidad regional.
- Formato, cantidad y unidades por paquete.
- Gastos de envio, pedido minimo y promociones.
- Similitud real del producto, evitando comparar variedades distintas solo porque comparten una palabra.
- Enlace a la ficha original y aviso cuando un precio no se pueda verificar.

Mercadona, Dia, Alcampo y Lidl ofrecen fuentes que se pueden consultar con adaptadores separados. Carrefour y El Corte Ingles requieren una estrategia de navegador mantenida, porque sus protecciones bloquean clientes HTTP simples. Por eso el comparador se desarrollara como una capa desacoplada del lector de tickets.

## Variables de entorno

- `INVITE_CODE`: codigo necesario para crear usuarios. No debe guardarse en GitHub.

## Para modificar con otro ChatGPT/Codex

Pega esto en el otro chat:

```text
Trabaja sobre este repositorio GitHub de Ticket Gastos Super. Lee el README antes de tocar nada.

Mantener:
- Login multiusuario con datos separados.
- Maximo inicial de 3 usuarios.
- Dashboard visual tipo tarjetas + donut por categorias.
- Subida de PDF/imagen/texto.
- Pantalla de revision antes de guardar.
- Categorias aprendidas por usuario.
- Historico por mes y ano.
- Preparar integracion futura para comparar precios por supermercado.

Archivos clave:
- web/index.html
- server/index.js
- scripts/build.py
```

No guardar secretos en el repositorio. Las claves de servicios externos, si se anaden, deben ir como variables de entorno del hosting.
