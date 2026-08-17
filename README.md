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

- `AGENTS.md`: contrato del producto, arquitectura y relevo completo para otro ChatGPT/Codex.
- `web/index.html`: interfaz completa, estilos y logica del cliente.
- `server/index.js`: backend de Sites con usuarios, sesiones, tickets e items.
- `scripts/build.mjs`: genera el arbol desplegable `dist/`.
- `scripts/test_client.mjs`: valida el parser, las categorias y la reconstruccion de lineas de PDF.
- `.openai/hosting.json`: configuracion de Sites y D1.

## Trabajar desde cualquier ordenador

Requisitos: Git y Node.js 20 o posterior. La aplicacion no necesita instalar dependencias de terceros para compilarse.

```bash
git clone https://github.com/joseluispina7-web/ticket-gastos-super.git
cd ticket-gastos-super
node scripts/check.mjs
node scripts/dev_server.mjs
```

La vista local queda disponible en `http://127.0.0.1:8788/?preview=1`. Los comandos equivalentes `npm run check` y `npm run dev` tambien estan disponibles cuando el entorno incluye npm. Antes de cambiar codigo hay que leer `AGENTS.md`; ahi se conservan las decisiones del producto, las comprobaciones y el procedimiento de Sites.

Cada cambio debe hacerse en una rama `codex/<tema>` y terminar en una pull request. GitHub ejecuta automaticamente las pruebas y la compilacion mediante `.github/workflows/ci.yml`.

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
- `SITES_REMOTE_URL` y `SITES_TOKEN`: credenciales temporales para subir una version a Sites. Se generan desde la cuenta propietaria o editora y nunca se guardan en el repositorio.

## Publicacion en la web existente

El identificador de `.openai/hosting.json` debe conservarse sin cambios. Tener el codigo en GitHub permite editar desde cualquier cuenta, pero publicar en la URL existente requiere acceso de propietario o editor al proyecto de Sites.

Desde una cuenta con acceso:

1. Ejecutar `node scripts/check.mjs`.
2. Generar una credencial temporal del repositorio de codigo fuente de Sites.
3. Pasar su URL y token como `SITES_REMOTE_URL` y `SITES_TOKEN` al proceso.
4. Ejecutar `python scripts/push_sites_source.py`.
5. Guardar una version de Sites con el commit devuelto y desplegar esa version.

Si Sites responde `project_not_found`, no se debe crear otro proyecto ni sustituir el identificador. Se puede seguir programando y revisando mediante GitHub; la publicacion se hace despues desde la cuenta propietaria. Crear un Sites nuevo implica una URL y una base de datos D1 nuevas.

## Para modificar con otro ChatGPT/Codex

Pega esto en el otro chat:

```text
Trabaja sobre este repositorio GitHub de Ticket Gastos Super. Lee el README antes de tocar nada.
Lee tambien AGENTS.md: contiene el contrato del producto, los comandos de validacion y el procedimiento exacto de publicacion.

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
- AGENTS.md
- web/index.html
- server/index.js
- scripts/build.mjs
```

No guardar secretos en el repositorio. Las claves de servicios externos, si se anaden, deben ir como variables de entorno del hosting.
