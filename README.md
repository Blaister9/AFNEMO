# AFNEMO

Sitio estático en HTML, CSS y JavaScript, con contenido Markdown/YAML y Decap CMS. Rama de revisión: `codex/mejoras-contenido-recorridos`; base funcional de esta revisión: `85a5d38`. No se ha hecho merge a `main` ni despliegue de producción.

[PR de revisión en borrador](https://github.com/Blaister9/AFNEMO/pull/1) · [Deploy Preview](https://deploy-preview-1--spectacular-daifuku-0575d9.netlify.app/)

## Contenido y rutas

| Contenido contrastado con el documento institucional | Ruta pública |
| --- | --- |
| Origen, Neftalí Mosquera, misión, visión y siete objetivos | `/asociacion/` y resumen en `/` |
| Voluntariado y once líneas de servicios, identificados como históricos | `/asociacion/` |
| Trece colaboraciones/proyectos históricos, sin duplicar la sección del Word | `/asociacion/` |
| Kilombo Yumma, KilomboApp, Museo del Viernes Negro, Cátedra Benkos Biohó y Ruta Libertaria | `/experiencias/` y cinco fichas con URL propia |
| COP16, apertura del Museo y saberes ancestrales/biodiversidad | `/noticias/` y tres memorias con URL propia |
| Cartografía externa y archivo territorial AFNEMO | `/#mapa-institucional` |
| Ayuda editorial | `/admin/guia.html` |

El mapa «Emprendimientos Afrocolombianos en Bogotá» conserva el iframe del item `a9e507d5218647efb0d83119272b7338`. Sus puntos no son sedes, proyectos ni experiencias AFNEMO. El listado y los filtros funcionan independientemente del visor. No se copian contactos ni coordenadas de ArcGIS ni se modifica el recurso remoto.

Las fichas conservan solo el nivel territorial respaldado: Bogotá para Yumma; Bogotá como contexto de la herramienta digital KilomboApp; Antonio Nariño, Bogotá, para Museo y Cátedra; San Basilio de Palenque, primera versión de 2023, para Ruta Libertaria. No hay coordenadas ni itinerarios deducidos.

Las noticias distinguen fecha original, fuente y revisión. La noticia de apertura del Museo usa `/noticias/2024-06-18-memoria-museo/`: el 18/06/2024 es la fecha de publicación institucional y de la crónica de El AfroBogotano, documentada en los párrafos 51–52 del Word. El párrafo 58 solo menciona «el pasado viernes y sábado», sin fijar una fecha exacta de apertura; `event_date` queda sin asignar. `updated_at: 2026-10-02` identifica la revisión de la síntesis para el sitio, no una actualización de la noticia original, que el insumo no documenta. Los enlaces internos, feed, canonical y sitemap usan la URL histórica; `_redirects` conserva una redirección 301 desde `/noticias/2026-10-02-memoria-museo/` en Netlify. Su relato histórico y la ficha permanente tienen propósitos y textos diferenciados. COP16 conserva el 25/07/2024 consignado en el archivo, con explicación de la discrepancia cronológica. Saberes ancestrales conserva el 26/11/2024 y atribuye autores y boletín.

## Desarrollo y verificación

Requiere Node.js 22 o posterior:

```powershell
npm ci
npm test
npm run build
npm run preview
```

Abrir `http://127.0.0.1:4173`. El servidor publica solamente `dist/`. En otra terminal:

```powershell
npm run test:browser
npm audit --omit=optional
git diff --check
```

Si Chromium no está instalado, ejecutar `npx playwright install chromium`. `AFNEMO_BASE_URL` permite usar otra preview local. `AFNEMO_EVIDENCE` y `AFNEMO_EVIDENCE_DIR` guardan las capturas fuera del repositorio; por defecto, los directorios de pruebas están ignorados por Git.

El build genera 13 páginas, 3 noticias, 5 experiencias y 2 imágenes fotográficas/institucionales, además de favicon, guía, administrador, feeds, `robots.txt` y sitemap. Las rutas directas y las recargas funcionan sin autenticación; una URL inexistente devuelve la página 404 del sitio.

Las 42 pruebas comprueban parsing, saneamiento, imágenes, configuración editorial, fechas parciales, territorios, generación de rutas y ciclo local de creación/edición/eliminación. La prueba de navegador cubre las 13 rutas públicas/guía a 1440 × 900, 768 × 1024, 390 × 844 y 320 × 568; incluye navegación, imágenes, recargas, filtros, teclado, CSP y fallos de ArcGIS/chat simulados. Solo se abre la pantalla de acceso de Decap; no se inicia sesión.

La revisión final del 4 de octubre de 2026 añade comprobación visual de todas las páginas y la 404 en los tres tamaños solicitados, auditoría de accesibilidad y recorrido por teclado. Se corrigieron canonical/favicons ausentes, contraste de etiquetas/enlace de noticias, encabezados del pie y chat, regiones complementarias anidadas y foco del salto al contenido en la guía. No cambian los textos documentales ni la distribución del sitio. Evidencias y capturas: `../AFNEMO-evidence-2026-10-04/`, fuera de la publicación.

**Dependencias:** `npm audit --omit=optional` informa dos avisos de severidad baja y termina con código 1: `@hapi/joi@17.1.1`, afectado por [GHSA-6w3j-5fw6-r9vr](https://github.com/advisories/GHSA-6w3j-5fw6-r9vr), y su consumidor `decap-server@3.11.3`. Este último figura únicamente en `devDependencies`; ambos paquetes tienen `dev: true` en el lockfile y el único consumidor de `@hapi/joi` es el proxy. Solo `tests/cms-browser.cjs` inicia `decap-server`; ni el generador ni los scripts públicos lo importan. La lista explícita de publicación no copia `node_modules`, el proxy ni sus dependencias a `dist`. El navegador carga Decap CMS 3.16.3, un paquete distinto del servidor local de pruebas.

Netlify puede instalar estas dependencias durante la preparación del build, pero no las necesita en runtime: publica los archivos estáticos de `dist`, sin funciones ni servidor Node desplegado. Los dos avisos pertenecen exclusivamente al entorno de desarrollo/pruebas, no al código servido al navegador. También se revisaron las 2.313 fuentes del mapa de código publicado de `decap-cms@3.16.3/dist/decap-cms.js.map`: no incluyen `decap-server` ni `@hapi/joi`. El registro npm consultado el 04/10/2026 mantiene `decap-server` 3.11.3 y `@hapi/joi` 17.1.1 como versiones estables más recientes; el proxy requiere `@hapi/joi: ^17.0.2`. La auditoría indica que no hay corrección disponible y no existe una versión corregida compatible en ese rango. Se mantienen `package.json` y el lockfile sin cambios.

## Publicación y CMS

`netlify.toml` configura `npm run build` y `dist`. Los visitantes leen páginas y feeds de la misma compilación, sin consultar GitHub. La lista pública explícita excluye documentos originales, Markdown, README, pruebas, evidencias y borradores. CSS/JS usan nombres con hash; HTML, feeds e imágenes se revalidan.

Decap 3.16.3 conserva `git-gateway`, `backend.branch: main` y `publish_mode: simple`. En contextos Netlify de revisión, solo `dist/admin/config.yml` toma la rama segura de `HEAD` y `DEPLOY_PRIME_URL`; falla si falta la rama o es `main`. El administrador muestra el destino del guardado. Esta revisión no modifica backend, Identity ni Git Gateway.

Las tres colecciones son Noticias y memoria, Experiencias AFNEMO y Asociación y trayectoria. Conservan imágenes, alt/crédito, fuentes, hitos, galería, videos y campos territoriales opcionales. No piden coordenadas. `published` y `status/reviewed` controlan la salida web, no la privacidad del repositorio ni de su historial. El build rechaza contenido público inválido y enlaces editoriales rotos antes de sustituir la salida anterior. HTML editorial se sanea; el chat trata entrada y respuesta como texto.

`npm run test:cms` reproduce el editor real con el proxy oficial en una copia temporal sin `.git`, credenciales ni acceso de escritura a GitHub. `local_backend` existe solo en esa prueba; nunca se publica. El ciclo local fue validado en la entrega `85a5d38`. La guía explica acceso invitado, guardado, revisión, fuentes, fechas y medios.

## Material público y excluido

La única fotografía nueva publicada del paquete es `assets/images/experiencias/museo-viernes-negro.webp`: 1440 × 960, 276.618 bytes. Hay una sola copia web, con dimensiones, carga diferida, alt factual y crédito «Imagen suministrada por AFNEMO». No se atribuye una autorización jurídica específica. El banner institucional existente se conserva optimizado y sin duplicarlo. El favicon usa la letra A y los colores del identificador del sitio.

ZIP, DOCX, falsos JPEG/HTML, imágenes incrustadas sin procedencia, duplicado `a-1.jpg`/contacto y fotografía de contacto con dominio desactualizado quedan fuera de `dist`. Tampoco se publican las fotografías Screenshot y WhatsApp, ni imágenes de noticias de prueba. Los originales, extracciones, capturas y resultados de auditoría permanecen fuera del repositorio. `.gitignore` excluye `dist`, dependencias, pruebas generadas, documentos originales y archivos de entorno.

## Pendientes para entrega / validación institucional

### Autenticación / infraestructura

- Validar inicio de sesión real de Netlify Identity.
- Validar lectura/escritura remota real mediante Git Gateway.
- Evaluar posteriormente la migración desde Git Gateway debido a su deprecación.

### Información que debe confirmar AFNEMO

- Equipo actual.
- Contactos actuales.
- Servicios actualmente vigentes.
- Voluntariado vigente.
- Alianzas actualmente vigentes.
- Ubicaciones actuales de atención.
- Fechas precisas faltantes de algunas experiencias.
- Otros cuatro destinos de Ruta Libertaria.
- Estado/disponibilidad actual de YummaApp.
- Fecha/contexto definitivo del video COP16.

### Material gráfico

- Contexto, autoría y permiso de las fotografías restantes no publicadas.
