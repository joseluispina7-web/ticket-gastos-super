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
- Comparador con precios actuales de Mercadona, Lidl y DIA.
- Normalizacion por `EUR/kg`, `EUR/L` o `EUR/unidad`, con enlace y fecha de consulta.
- Plan de compra privado por usuario, con tienda, precio estimado y ahorro comparable.
- Estado vacio real: la aplicacion no muestra supermercados ni importes inventados.

## Archivos clave

- `AGENTS.md`: contrato del producto, arquitectura y relevo completo para otro ChatGPT/Codex.
- `web/index.html`: interfaz completa, estilos y logica del cliente.
- `server/index.js`: backend de Sites con usuarios, sesiones, tickets e items.
- `server/comparison.js`: adaptadores, normalizacion, similitud y comparacion de precios.
- `scripts/build.mjs`: genera el arbol desplegable `dist/`.
- `scripts/test_client.mjs`: valida el parser, las categorias y la reconstruccion de lineas de PDF.
- `scripts/test_comparison.mjs`: valida formatos, coincidencias y las tres fuentes con fixtures.
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

## Comparador de precios: estado actual

La fase 2 ya incluye tres vistas: resumen de tickets, comparador y plan de compra. El backend trata cada supermercado como una fuente independiente, conserva la fecha de consulta y tolera que una tienda falle sin ocultar los resultados validos de las demas.

Fuentes activas verificadas el 17 de agosto de 2026:

- Mercadona mediante su indice publico de busqueda.
- Lidl Espana mediante su buscador publico.
- DIA mediante su buscador de catalogo publico.

Los precios pueden depender de zona, disponibilidad y formato. La interfaz muestra el precio del paquete y, cuando la fuente aporta cantidad suficiente, su equivalente en `EUR/kg`, `EUR/L` o `EUR/unidad`. No se inventan resultados cuando una fuente no responde.

La comparacion final tambien tendra en cuenta:

- Codigo postal, tienda y disponibilidad regional.
- Formato, cantidad y unidades por paquete.
- Gastos de envio, pedido minimo y promociones.
- Similitud real del producto, evitando comparar variedades distintas solo porque comparten una palabra.
- Enlace a la ficha original y aviso cuando un precio no se pueda verificar.

Alcampo y Carrefour figuran como proximas fuentes. Actualmente bloquean consultas HTTP simples y requieren un adaptador de navegador mantenido. El Corte Ingles, Supercor, Hipercor y otros supermercados se incorporaran despues de estabilizar codigo postal, similitud y disponibilidad regional.

El trabajo de investigacion de adaptadores se apoyo en `jgalea/grocery-cli`; la atribucion y su licencia MIT estan en `THIRD_PARTY_NOTICES.md`.

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
- Comparador real de Mercadona, Lidl y DIA por kilo, litro o unidad.
- Plan de compra persistente por usuario.

Archivos clave:
- AGENTS.md
- web/index.html
- server/index.js
- server/comparison.js
- scripts/build.mjs
```

No guardar secretos en el repositorio. Las claves de servicios externos, si se anaden, deben ir como variables de entorno del hosting.
