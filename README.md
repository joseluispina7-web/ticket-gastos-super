# Ticket Gastos Super

Web multiusuario para subir tickets de supermercado, revisar líneas de compra y ver el gasto desglosado por categorías, productos, tiendas y periodos.

## Web Actual

https://ticket-gastos-super.erpozi.chatgpt.site

Esa URL sigue siendo de OpenAI Sites. El código vive en GitHub para que cualquier ChatGPT/Codex con acceso al repositorio pueda continuar el proyecto. Para publicar sin depender de una cuenta concreta de ChatGPT, se ha dejado preparado un despliegue manual a Cloudflare Workers + D1.

## Producto

- Login con usuario y contraseña.
- Máximo inicial de 3 usuarios.
- Cada usuario ve solo sus tickets.
- Subida de PDF, imagen o texto pegado.
- Lectura de PDF con reconstrucción de líneas y OCR para documentos escaneados o fotos hechas con móvil.
- Revisión manual antes de guardar.
- Categorías aprendidas por usuario, con nombres canónicos como `Lácteos`, `Bebé`, `Panadería` y `Charcutería`.
- Dashboard mensual con total, tickets, productos únicos, categoría top, donut de categorías, histórico, total anual y top productos.
- Comparador configurable desde Ajustes.
- Plan de compra privado por usuario, con tienda, precio estimado y ahorro comparable.
- Estado vacío real: la aplicación no muestra supermercados ni importes inventados.

## Fuentes Del Comparador

Activas:

- Mercadona mediante su índice público de búsqueda.
- DIA mediante su buscador de catálogo público.
- Carrefour mediante el índice estructurado del proveedor de su buscador.
- Alcampo mediante el estado de catálogo publicado en su página de resultados.
- Ahorramas mediante las fichas estructuradas de su buscador online.
- Aldi mediante su índice público de Algolia, con región de península.
- Hipercor como fuente seleccionable. Su web puede bloquear la consulta automática directa; si ocurre, aparece como no disponible sin contaminar el resto.

Quitada:

- Lidl. No se usa ya en el comparador porque no publica un catálogo completo de precios, solo parte de ofertas/productos.

Pendientes:

- Supercor: pendiente de adaptar el catálogo de El Corte Inglés/Supercor.
- Eroski: pendiente de fixture y adaptador regional.

El comparador normaliza por `EUR/kg`, `EUR/L` o `EUR/unidad`, con enlace y fecha de consulta cuando la fuente lo permite. Nunca se inventan resultados cuando una fuente no responde.

## Tickets Y OCR

El parser soporta formatos de ticket con línea única y líneas partidas. Para Hipercor en papel reconoce formatos como:

```text
VINAGRE VINO BLANCO 1 B 0,69
KINDER MAXI 10 UNIDA 2 B 7,98
Precio unitario 3,99
TOTAL COMPRA EUR 18,84
```

En ese caso guarda cantidad `2`, unitario `3,99` y total `7,98`, ignora `Precio unitario`, IVA, efectivo y cambio, y detecta fechas como `17/ago/26`.

También corrige palabras comunes sin acento al limpiar productos, por ejemplo `panales` -> `pañales`, `salmon` -> `salmón`, `atun` -> `atún`.

## Archivos Clave

- `AGENTS.md`: contrato del producto, arquitectura y relevo para otro ChatGPT/Codex.
- `web/index.html`: interfaz completa, estilos, OCR, parser y revisión.
- `server/index.js`: backend Worker/Sites con usuarios, sesiones, tickets, ajustes y D1.
- `server/comparison.js`: adaptadores, normalización, similitud y comparación de precios.
- `scripts/build.mjs`: genera `dist/`.
- `scripts/test_client.mjs`: valida parser, categorías y reconstrucción de líneas de PDF.
- `scripts/test_comparison.mjs`: valida formatos, sinónimos, fuentes activas con fixtures y tiendas pendientes.
- `scripts/dev_server.mjs`: servidor local con preview, comparador, ajustes y plan local.
- `.openai/hosting.json`: proyecto actual de Sites.
- `.github/workflows/deploy-cloudflare.yml`: despliegue manual a Cloudflare cuando estén configurados los secretos.
- `cloudflare/wrangler.template.jsonc`: plantilla de Wrangler para Cloudflare Workers + D1.

## Trabajar Desde Cualquier ChatGPT

No basta con pasar la URL pública de la web. Otro ChatGPT necesita el repositorio de GitHub:

```text
https://github.com/joseluispina7-web/ticket-gastos-super
```

Pega esto en el otro chat:

```text
Trabaja sobre el repositorio GitHub https://github.com/joseluispina7-web/ticket-gastos-super.
Lee README.md y AGENTS.md antes de tocar nada.
Haz los cambios en una rama codex/<tema>.
Ejecuta node scripts/check.mjs antes de terminar.
No guardes secretos en el repositorio.
Si hay que publicar en Cloudflare, usa el workflow Deploy Cloudflare y los secretos del repositorio.
```

Si ese ChatGPT no puede escribir en GitHub, hay que entrar en GitHub con tu cuenta y autorizarlo o añadirlo como colaborador. La edición queda asociada al repo, no a una cuenta concreta de ChatGPT.

## Desarrollo Local

Requisitos: Git y Node.js 20 o posterior. La aplicación no necesita instalar dependencias de terceros para compilarse.

```bash
git clone https://github.com/joseluispina7-web/ticket-gastos-super.git
cd ticket-gastos-super
node scripts/check.mjs
node scripts/dev_server.mjs
```

Vista local:

```text
http://127.0.0.1:8788/?preview=1
```

Los comandos equivalentes `npm run check` y `npm run dev` también están disponibles cuando el entorno incluye npm.

## GitHub + Cloudflare

Objetivo: que la publicación no dependa de OpenAI Sites ni de una cuenta concreta de ChatGPT.

Estado actual:

- El repo ya contiene un workflow manual: `.github/workflows/deploy-cloudflare.yml`.
- El workflow compila, prueba, genera `dist/` y despliega con Wrangler.
- Usa `cloudflare/wrangler.template.jsonc`.
- La app crea sus tablas D1 automáticamente al primer uso con `ensureSchema`.

Pendiente una sola vez en GitHub/Cloudflare:

1. Crear una base D1 en Cloudflare llamada `ticket-gastos-super`.
2. Guardar estos secretos en el repositorio de GitHub:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_D1_DATABASE_ID`
   - `INVITE_CODE`
3. Ejecutar manualmente el workflow `Deploy Cloudflare`.
4. Probar registro, login, dashboard, importación de foto/PDF y ajustes.

No metas el código de invitación ni tokens en archivos del repo. `INVITE_CODE` debe ser secreto; si no se configura, la app permitirá registrar hasta 3 usuarios sin código.

## Publicación En Sites

La URL actual de Sites pertenece al proyecto `appgprj_6a81a21462a081918377a50db825e757`. No se debe sustituir `.openai/hosting.json` ni crear otro Sites para este mismo proyecto salvo que se quiera una migración con URL y base de datos nuevas.

Desde una cuenta con acceso a ese Sites:

1. Ejecutar `node scripts/check.mjs`.
2. Generar una credencial temporal del repositorio fuente de Sites.
3. Exportar `SITES_REMOTE_URL` y `SITES_TOKEN`.
4. Ejecutar `python scripts/push_sites_source.py`.
5. Guardar una versión de Sites con el commit devuelto y desplegarla.

Si Sites responde `project_not_found`, se puede seguir programando por GitHub, pero la publicación en esa URL la debe hacer la cuenta propietaria/editora.
