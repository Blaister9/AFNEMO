# AFNEMO

## Validación del administrador · 3 de octubre de 2026

Esta sección actualiza el estado del CMS de las entregas históricas descritas más abajo. Base limpia `a8e9ac3`, en `codex/mejoras-contenido-recorridos`, con los cinco commits anteriores intactos. El diseño y los contenidos territoriales aprobados se conservan.

**Flujo comprobado en archivos y panel del proveedor:** editor → `/admin/` → Netlify Identity → Git Gateway → `Blaister9/AFNEMO` → archivos de `content/` e imágenes de `assets/images/noticias/` → `npm run build` → `dist/` → Netlify. Las páginas, listados, filtros, sitemap y feeds se generan con el contenido de la misma revisión. Los visitantes no consultan GitHub para leerlo.

Decap 3.16.3 está fijado por versión. `publish_mode: simple` guarda directamente; no existe una cola `editorial_workflow`. La fuente definitiva conserva `backend.name: git-gateway` y `backend.branch: main`. Los campos `published` y `status/reviewed` controlan la salida pública, no la privacidad de archivos e historial. Las imágenes se suben en una operación independiente del guardado de la entrada.

**Infraestructura real, inspeccionada con la sesión existente:** proyecto Netlify `spectacular-daifuku-0575d9`, repositorio correcto, Identity habilitado, registro por invitación y confirmación de correo, Git Gateway habilitado y sin filtro de roles. No se revelaron ni modificaron credenciales. El CMS pidió un inicio de sesión de Identity; la sesión del panel Netlify no autentica al editor. **Autenticación editorial remota: no validada.** Ver el formulario de acceso y comprobar el aprovisionamiento no demuestra lectura/escritura autorizada.

**Preview:** [PR de revisión en borrador](https://github.com/Blaister9/AFNEMO/pull/1) y [Deploy Preview del mismo proyecto](https://deploy-preview-1--spectacular-daifuku-0575d9.netlify.app/). El panel confirmó producción en `main`, branch deploys desactivados y Deploy Previews activadas para PR. Se utiliza ese mecanismo existente; no se cambian DNS, dominio ni configuración de producción. Cada push actualiza la preview cuando termina su compilación. La configuración del panel aún refleja la entrega productiva anterior (sin comando, publicación de la raíz); el `netlify.toml` de esta rama define `npm run build` y `dist` y tiene prioridad para su preview.

En contextos Netlify `deploy-preview`/`branch-deploy`, únicamente el archivo **generado** `dist/admin/config.yml` utiliza `HEAD` como rama de revisión y `DEPLOY_PRIME_URL` como enlace del sitio. La compilación falla si falta una rama segura o apunta a `main`. La configuración fuente y el build de producción permanecen en `main`. Identity/Gateway conservan los endpoints del mismo origen y la CSP no cambia. El administrador incluye un aviso visible del destino de los guardados.

### Colecciones y reglas editoriales

| Colección | Destino y publicación | Campos comprobados |
| --- | --- | --- |
| Noticias y memoria | `content/noticias/`, enlace por fecha/título, `published: true` | Título, resumen, relato, fecha de publicación; evento, fuente y actualización separados; categoría/fuente opcionales; imagen opcional con permiso, alt y crédito |
| Experiencias AFNEMO | `content/experiencias/`, enlace estable por `id`, `status: published` y `reviewed: true` | Iniciativa, fuente y revisión; territorio, municipio, departamento, país y nivel de ubicación opcionales; contexto, periodo, fecha parcial, hitos, fuentes, materiales, video, galería e iniciativa relacionada editables |
| Asociación y trayectoria | `content/institucional/asociacion.md`, `published: true` | Título, resumen, fuente, fecha de revisión y relato |

No existe una colección territorial adicional: los campos territoriales pertenecen a las experiencias. El mapa ArcGIS continúa siendo un recurso externo independiente. No se solicitan coordenadas. Los grupos adicionales están colapsados y la compatibilidad territorial anterior permanece oculta.

`admin/validation.js` registra `preSave`: comprueba campos vacíos, fechas que existen, opciones controladas, enlaces permitidos y permiso/alt/crédito de cada imagen seleccionada. El límite de 20 MB se configura por campo de imagen; el build decodifica los archivos y aplica también el máximo de 40 megapíxeles. JPG, PNG, WebP y AVIF usan rutas locales seguras; no se admiten SVG ni rutas del equipo. El build publica solamente medios autorizados referenciados, con dimensiones, texto alternativo, carga diferida y estilos adaptables. Los originales y fotografías de pruebas históricas no publicadas quedan fuera de `dist`.

El relato tiene HTML desactivado/saneado y las imágenes se incorporan mediante sus campos. El build ahora rechaza enlaces editoriales a páginas o anclas inexistentes antes de sustituir la última salida válida. La [guía para AFNEMO](admin/guia.html) explica acceso invitado, creación/corrección, subida/selección de fotos, fuentes/créditos, territorio y guardado, con las etiquetas reales del editor. Advierte que retirar una entrada requiere corregir sus enlaces entrantes.

### Reproducir la validación

```powershell
npm ci
npm test
npm run build
npm run preview
# En otra terminal, con dist servido:
npm run test:browser
npm run test:cms
npm audit --omit=optional
```

`test:cms` usa Decap real y su proxy oficial `decap-server` sobre una copia temporal permitida de esta rama; no copia `.git`, no usa credenciales y no puede escribir en GitHub. `local_backend` existe solamente en la respuesta del servidor de prueba, nunca en la configuración publicada. Los servidores escuchan en loopback, se cierran al terminar y la copia se elimina incluso ante fallos. Las pruebas de parsing/build realizan también creación, segunda edición y eliminación en copias temporales; comprueban que la salida final coincide con la inicial. Esto comprueba el recorrido local del editor y el generador, **no** sustituye la autenticación ni el guardado por Git Gateway.

Las evidencias se guardan fuera del sitio mediante `AFNEMO_EVIDENCE`/`AFNEMO_EVIDENCE_DIR`. Se cubren 13 rutas públicas/guía a 1440, 390 y 320 píxeles, `/admin/` en escritorio/móvil, las cinco experiencias, 52 destinos internos, imágenes decodificadas, recarga directa, filtros, teclado, ausencia de consultas de contenido a GitHub y CSP. ArcGIS y el chat se aíslan en las pruebas automáticas; sus fallos simulados no son fallos propios del sitio.

**Resultado del slice:** `npm test` 42/42; `npm run build` 13 páginas, 3 noticias, 5 experiencias y 2 imágenes; `npm run test:browser` aprobado. Se corrigió una carrera del propio test territorial al cerrar peticiones de imágenes en vuelo; el sitio territorial no cambió. El harness CMS completó 14 operaciones reales: abrió una noticia histórica, rechazó entradas incompletas, creó una noticia y subió/seleccionó una imagen con nombre normalizado, bloqueó su guardado sin alt/crédito, guardó/reabrió/editó, verificó página/listado/imagen tras build y recarga, y eliminó la noticia. Creó una experiencia sin foto ni territorio, añadió Bogotá y su nivel de ubicación, verificó ficha/listado/filtro y la eliminó. Editó la página institucional, comprobó su build y restauró el texto desde el CMS. Eliminó la fotografía desde la biblioteca; la reconstrucción final devolvió 404 para las dos entradas y el medio temporales y recuperó las 3 noticias/5 experiencias iniciales. Todo ocurrió en la copia local desechable.

Consola del recorrido válido: sin errores inesperados. Al enviar deliberadamente campos inválidos, Decap 3.16.3 emite rechazos de promesas (`undefined`/`#<Object>`) además de su mensaje de validación; se registran por separado y se comprueba que no se creó el archivo. No se declaran como una autenticación ni publicación remota exitosa. Las configuraciones inválidas de biblioteca y la fila vacía automática de galería se detectaron con la UI real y quedaron corregidas antes de la entrega.

**Auditoría de dependencias:** el proxy oficial más reciente disponible, `decap-server@3.11.3`, arrastra `@hapi/joi@17.1.1`: dos avisos bajos (uno directo y otro transitivo), [GHSA-6w3j-5fw6-r9vr](https://github.com/advisories/GHSA-6w3j-5fw6-r9vr), sin corrección disponible según `npm audit`. Solo se usa en el harness local y no se copia a `dist`; la auditoría no se declara limpia ni se oculta el resultado. Se conserva este límite explícito para mantener una prueba reproducible del proxy oficial.

### Cierre pendiente de autenticación remota

Un editor invitado debe abrir el [administrador de revisión](https://deploy-preview-1--spectacular-daifuku-0575d9.netlify.app/admin/), comprobar el aviso de revisión e iniciar sesión personalmente en Netlify Identity. No debe enviar contraseñas, tokens ni capturas con datos de sesión. Si no tiene acceso, el responsable debe invitarlo desde Identity del proyecto y el editor confirmar su correo. No hay un cambio adicional de proveedor identificado como necesario.

Tras autenticarse falta demostrar lectura, creación, guardado, imagen, segunda edición y eliminación **por Git Gateway en la rama de revisión**, verificar el nuevo despliegue y retirar todas las pruebas. La existencia/configuración del servicio está comprobada; la vigencia de su autorización GitHub y los permisos efectivos de escritura siguen sin demostrarse mientras no haya sesión editorial. Producción, `main` y los commits anteriores no se modifican en este slice.

Sitio existente en HTML, CSS y JavaScript, con Decap CMS (Git Gateway / Netlify Identity) y visor ArcGIS externo. Se conserva la identidad visual y los proveedores actuales.

## Primera entrega · 2 de octubre de 2026

**Base:** `main` / `ab4bd20`, remoto `https://github.com/Blaister9/AFNEMO.git`, sin cambios locales previos. Rama de revisión: `codex/mejoras-contenido-recorridos`. No hay AGENTS.md ni pruebas iniciales; README previo de dos líneas. No se ha publicado ni modificado el portal ArcGIS.

**Diagnóstico y prioridades:**

- P0: chat concatena entrada y respuesta en HTML (`animations.js`), reproducido con etiqueta inocua. Publicación original de toda la raíz (`netlify.toml`) expone contenidos aunque no se muestren.
- P1: 28 enlaces vacíos, noticias de prueba sin detalle y peticiones a GitHub siempre en main (`index.html`, `news.js`). CMS usa git-gateway; no se ha validado inicio de sesión real.
- P1: menú sin aria-expanded, Escape no cierra; falta main; contraste bajo y hero móvil recortable (`nav.js`, CSS).
- P1: footer de Fundación Raíces Afro / NIT de ejemplo; equipo y aliados sin respaldo actual. Formularios sin integración. Fotografías entregadas sin autorizaciones acreditadas.
- P2: iframe ArcGIS real y script de componente inexistente, OG image inexistente y caché immutable sin cambio de URL.

**Insumos contrastados:** `Contenidos_AFNEMO.zip` y `AFNEMO_insumos_organizados.zip`, localizados en Downloads. Original: `pagina a 19 de febrero.docx`, 218 párrafos no vacíos, metadatos de compilación 19/02/2025. El texto derivado coincide con el original. Nada de esos archivos originales se incorpora al repositorio. 35 imágenes válidas, 33 únicas; siete entradas .jpeg son HTML y hay una entrada vacía. En esta primera entrega las fotos nuevas quedaron fuera por falta de permiso; el siguiente slice incorpora únicamente la fotografía del Museo suministrada por AFNEMO como insumo para la nueva página.

**Mapa verificado:** item `a9e507d5218647efb0d83119272b7338`, título «Emprendimientos Afrocolombianos en Bogotá», acceso público, propietario portaladmin; capa CSV `75b11678745b4c4a91475c7c54bdacd4`, categorías/localidades y campos de contacto/coordenadas. No son sedes AFNEMO. Lectura de metadatos y comprobación del visor, sin copiar ni republicar campos de contacto. El iframe no ofrece aquí un contrato de sincronización con fichas; se conserva independiente. Las fichas territoriales no afirman corresponder a sus puntos. Referencia editorial [Por la Tierra](https://porlatierra.org/casos): relatos/listado por territorio; su página devolvió errores PHP durante la consulta, no se copió diseño ni contenido.

**Decisiones de contenido:** preservar origen, misión y visión documentados; integrar cinco iniciativas como memoria, con fuentes y revisión separadas de fechas históricas. Conservar las otras seis líneas existentes en un bloque con alcance pendiente; no calificarlas como ficticias. Retirar del escaparate datos de equipo, alianzas y servicios no confirmados. Preservar perfiles sociales ya enlazados sin afirmar verificación de disponibilidad actual. Donación, boletín y voluntariado sin integración muestran un estado explícito, sin capturar datos ni simular operaciones. Banner institucional existente optimizado de JPEG (extensión png, 85.937 B) a WebP (49.744 B), mismas proporciones y dimensiones declaradas; no atribución fotográfica inventada.

## Desarrollo y revisión local

Requiere Node.js 22 o posterior. Conserva el sitio sin framework ni base de datos nueva:

```powershell
npm ci
npm run build
npm run preview
```

Abrir `http://127.0.0.1:4173`. Revisar `/`, `/asociacion/`, `/noticias/` y sus tres memorias, `/experiencias/` y sus cinco fichas, y `/admin/guia.html`. El servidor sirve **solo dist/**; abrir index.html directamente o servir la raíz no equivale a probar la publicación.

En otra terminal:

```powershell
npm test
npx playwright install chromium
npm run test:browser
```

`AFNEMO_BASE_URL` permite apuntar las pruebas a otra vista previa local. `AFNEMO_EVIDENCE` (smoke) y `AFNEMO_EVIDENCE_DIR` (interacciones) permiten guardar capturas fuera del repositorio. Las pruebas de interacción simulan el Worker; no envían consultas reales.

El build usa YAML real y Markdown saneado; genera listados, detalles, sitemap y feeds de la misma rama. Nunca consulta main desde el navegador. Filtra noticias `published: true`; experiencias `status: published` y `reviewed: true` con fuente y fecha de revisión. Hitos conservan precisión de año/mes/día. Las fechas de publicación, evento, fuente y actualización son campos diferentes. El build falla ante datos públicos inválidos, en vez de ocultarlos.

Solo se copian archivos de una lista explícita y las imágenes autorizadas referenciadas. No salen Markdown originales, documentos/ZIP, README, .claude, tests ni fotos de noticias de prueba. Los CSS/JS usan nombres con hash para invalidar la antigua caché; HTML, feeds e imágenes deben revalidarse. `netlify.toml` prepara `npm run build` y `publish = "dist"` en esta rama para corregir la exposición de la raíz. La CSP y los proveedores se conservan. **No se ha aplicado a producción.**

Decap conserva Git Gateway y la rama editorial main. Sus colecciones son Noticias y memoria, Iniciativas documentadas y Asociación y trayectoria; la vista previa lee la entrada abierta del editor. Los archivos ya existentes siguen siendo compatibles; sus tres entradas de prueba quedan como no publicadas, con fechas intactas. Una imagen nueva requiere permiso comprobado, alt y crédito; no se aceptan imágenes incrustadas en el cuerpo. Nunca subir al CMS información privada o fotos pendientes: `published: false` evita su salida web, pero **no las oculta en un repositorio público ni en su historial**. Los documentos recibidos permanecen fuera del repositorio.

Se cargó `/admin/`: aparece «Iniciar sesión con Netlify Identity», con CMS/h/createClass disponibles y sin page errors. La prueba de vista previa ejecutó entradas distintas y cambios sin guardar. No se validó autenticación CMS, creación de usuarios ni guardado contra Git Gateway: esa comprobación corresponde a un editor autorizado después de aprobar la rama. No cambiar `backend.branch` para probar contenido público; compilar esta rama ya prueba su propia versión.

## Validación de la primera entrega y pendientes

Línea base guardada fuera del repositorio en `../AFNEMO-evidence-2026-10-02/`: capturas desktop 1440×1000 y móvil 390×844; `baseline.json`. Reproducidos 28 links vacíos, interpretación de HTML de usuario, falta de main y Escape ineficaz en menú. Validación final sobre dist: nueve rutas × tres viewports (1440×1000, 390×844 y 320×568), 28 destinos internos, imágenes, filtros y estado vacío, detalle/retorno/recarga, exclusión por URL directa, error/reintento de noticias, CSP de producción aplicada y navegación sin JS; cero page errors propios. Chat: texto HTML seguro en entrada/respuesta, HTTP500/red/respuesta inválida/timeout, no duplicación por Enter, foco/Escape y menú accesible. Pruebas repetidas sobre la versión final del generador y aprobadas.

Pendientes institucionales: permisos/autoría de fotos; responsables/cargos actuales; vigencia y alcance de programas/servicios; sedes/contactos/alianzas actuales; medios de aporte; condiciones de voluntariado; enlaces operativos de KilomboApp; permiso y precisión de ubicaciones si se desean publicar. No se deducen de documentos históricos. Decap requiere validación autenticada por editor autorizado. Publicación de producción requiere revisión y autorización.


**Disponibilidad externa comprobada:** el visor real cargó tras esperar sus recursos y mostró la capa/categorías de emprendimientos. La prueba aislada de caída confirma que las fichas siguen disponibles. El REST público confirmó metadatos y tipo de capa; no se modificó el recurso externo. En una captura repetida el navegador registró `ERR_NO_BUFFER_SPACE` al cargar un módulo de Calcite del portal externo; el visor llegó a mostrar mapa/categorías. Este error pertenece al recurso externo; se conserva evidencia en `final-external.json`. El chat se validó con respuestas controladas, no su disponibilidad ni calidad del backend. La ejecución temporal sobre la raíz devolvió 404 al nuevo feed (esperable: requiere build); la prueba válida usa dist.

**Archivos principales:** `index.html`, estilos existentes y `assets/js/{nav,animations,news}.js`; `scripts/{build,content,pages,serve}.mjs`; `admin/{config.yml,preview.js}`; `content/experiencias/*.md`; noticia de memoria en `content/noticias/2026-10-02-memoria-museo.md`. Se retiró `assets/js/arcgis.js` y el módulo remoto de componente: el DOM utiliza exclusivamente iframe, confirmado por inspección y navegador.

**Revisión Git:** `git diff main...HEAD`, `git log --oneline main..HEAD`. No merge ni despliegue automático. Cuando se autorice compartir la rama: `git push -u origin codex/mejoras-contenido-recorridos`. Después revisar la vista previa construida desde esa rama, completar las validaciones institucionales y autorizar aparte cualquier paso a producción.


| Comprobación ejecutada | Resultado final |
| --- | --- |
| `npm test` | 8/8: YAML, saneamiento, publicación, fechas, imágenes reales, exclusión/hash, config y preview del editor |
| `npm run build` | 10 páginas, 1 noticia documental, 5 experiencias, 1 imagen institucional |
| `npm run test:browser` | 9 rutas × 3 tamaños, 28 destinos, filtros/recarga/404/teclado/CSP; interacciones del chat y menú aprobadas |
| `npm audit --omit=optional` | 0 vulnerabilidades informadas |
| `git diff --check` | Sin errores de espacios; avisos de normalización CRLF de Git |

Capturas finales, revisadas visualmente, en `../AFNEMO-evidence-2026-10-02/`: `final-desktop-inicio.png`, `final-desktop-iniciativas.png`, `final-desktop-fichas.png`, `final-desktop-noticia.png`, `final-desktop-mapa.png`, `final-mobile-experiencias.png`, `final-mobile-museo.png`, `mobile-menu-390.png` y `chat-text-safe-320.png`. Los archivos `baseline.json`, `browser-results.json` y `final-external.json` distinguen la línea base, las pruebas aisladas y los servicios reales. No se incorporan las capturas ni los insumos al repositorio público.

Checkpoints de la primera entrega: `8b58b22` (chat/navegación accesibles), `eec2968` (contenido documental, recorridos y compilación pública) y `23f0655` (pruebas de navegador y seguimiento). En ese momento la rama quedó local, sin push, merge ni despliegue. La vista previa 4173 sirve dist.

## Cierre del paquete AFNEMO y guía editorial · 2 de octubre de 2026

Se contrastaron nuevamente los 218 párrafos del Word completo y los seis archivos gráficos separados del ZIP original. Se mantiene la arquitectura anterior y la integración ArcGIS sin cambios.

| Material del documento | Representación pública |
| --- | --- |
| Origen y Neftalí Mosquera | Resumen del inicio y `/asociacion/`, con reseña atribuida al Museo IEFEMP |
| Misión, visión y objetivos | Página institucional con sus fechas, horizonte 2030 y los siete objetivos |
| Voluntariado y servicios | Invitación de junio de 2024 y once líneas descritas en agosto de 2024; disponibilidad actual por confirmar |
| Colaboraciones | Una sola tabla con trece vínculos/proyectos históricos; la sección repetida del Word se consolida |
| Cinco iniciativas | Fichas revisadas contra el original, enlaces de prensa de KilomboApp y conexiones entre contenidos |
| Museo del Viernes Negro | Ficha permanente, fotografía suministrada por AFNEMO y noticia de apertura con fecha original 18/06/2024 |
| COP16 | Memoria audiovisual con fecha del archivo 25/07/2024; diferencia explícita frente al calendario de la conferencia |
| Saberes ancestrales y biodiversidad | Síntesis atribuida, publicación institucional 26/11/2024 y enlaces al boletín del 27/10/2024 |
| Experiencias audiovisuales | Solo los tres videos identificados: uno de Somos Abya Yala y dos de El AfroBogotano; sin catálogo inventado |

Las tres noticias distinguen publicación original, fuente y actualización del 02/10/2026. La URL anterior de la memoria del Museo se conserva para no romper enlaces; la fecha se corrige en sus metadatos visibles. Ruta Libertaria conserva únicamente San Basilio de Palenque, primera versión documentada en 2023.

**Imágenes:** se incorpora una sola versión de `AFNEMO MUSEO DEL VIERNES NEGRO.jpg`, fotografía suministrada por AFNEMO como insumo para la nueva página: WebP de 1440 × 960, 276.618 bytes, desde el original de 2560 × 1707 y 804.091 bytes. Aparece en la ficha y tarjeta del Museo con dimensiones, carga diferida, descripción factual y crédito «Imagen suministrada por AFNEMO». No se copia el duplicado incrustado en el Word. El banner separado reproduce la composición del hero existente; se mantiene el WebP anterior sin agregar otro recurso.

**Material excluido:** contacto/a-1 son duplicados y contienen un dominio distinto del sitio actual; no se usan. Screenshot y WhatsApp quedan fuera por falta de contexto comprobado. La galería de terceros del Word requiere procedencia/permisos; no se publica. Los siete falsos JPEG/HTML, entrada vacía y referencias rotas se descartan. No se incorporan ZIP, DOCX ni directorios de trabajo al repositorio o a dist.

**Carga amigable:** `/admin/guia.html` ofrece tres accesos, pasos de escritura/guardado, explicación de fechas y fotografías y una revisión final. Se enlaza desde el pie del sitio y la barra del editor. Las etiquetas del CMS están en español; el preview muestra cambios sin guardar y la imagen autorizada, avisa sobre fechas/campos pendientes y diferencia borrador de publicación. La página institucional también es editable. El acceso sigue conectado a main: esta entrega no autentica, guarda contenido en Git Gateway ni altera producción.

**Confirmaciones pendientes:** equipo/cargos, contactos/dirección y condiciones de visita al Museo actuales; vigencia de servicios, voluntariado y alianzas; contexto y permisos de imágenes no usadas; disponibilidad de YummaApp (el dominio original no resolvió); momento de incorporación del video COP16 a la entrada fechada en julio. Autenticación y guardado real del editor requieren una sesión autorizada. A 320 px el formulario interno del proveedor Decap conserva un ancho mínimo; la guía y el sitio sí se verifican a ese tamaño.

El usuario autoriza subir los cuatro commits acumulados a `codex/mejoras-contenido-recorridos`. No se autoriza merge a main ni despliegue de producción. Capturas y auditorías nuevas permanecen fuera del repositorio en `../AFNEMO-evidence-2026-10-02/slice-contenidos/`.

**Validación del cierre:** `npm test` 8/8, incluyendo colección institucional, índice de secciones y exclusión de su borrador; `npm run build` 13 páginas, 3 noticias, 5 experiencias y 2 imágenes; `npm run test:browser` aprobado: 13 rutas × 3 tamaños, 52 enlaces internos, fechas históricas, decodificación de todas las imágenes, guía, contenido institucional, filtros, recarga, consola y regresiones de chat/navegación. Cero errores propios de página. Las dos imágenes públicas tienen hashes distintos; no hay duplicados binarios en assets/images. Revisión visual de escritorio/móvil y diff sin errores de espacios. Servicios externos aislados en las pruebas automáticas; el editor no fue autenticado.

## Territorios y experiencias · 2 de octubre de 2026

**Base revisada:** rama limpia `codex/mejoras-contenido-recorridos`, sincronizada con origin; cuatro commits existentes `8b58b22`, `eec2968`, `23f0655` y `074fad7`, y README leídos antes de editar. Este slice integra la corrección factual sobre la fotografía suministrada por AFNEMO como insumo para la nueva página. Conserva el crédito público «Imagen suministrada por AFNEMO» y no atribuye autoría adicional ni una autorización expresa del cliente.

**Dos recorridos independientes:** el inicio presenta «Territorios y experiencias», con accesos a la cartografía y al archivo de AFNEMO. El mapa conserva exactamente el iframe del item `a9e507d5218647efb0d83119272b7338`; su título oficial «Emprendimientos Afrocolombianos en Bogotá» se volvió a comprobar mediante los [metadatos públicos del portal](https://mapas.gobiernobogota.gov.co/waportal/sharing/rest/content/items/a9e507d5218647efb0d83119272b7338?f=json). El texto y la fuente identifican los emprendimientos como recurso territorial de consulta, sin convertir sus puntos en sedes, proyectos o experiencias de AFNEMO. No se consultaron ni copiaron registros de la capa, datos de contacto ni coordenadas; no hubo cambios remotos.

Las cinco experiencias se generan estáticamente desde el mismo contenido tanto en el inicio como en `/experiencias/`. Las tarjetas muestran el territorio y el resumen; los filtros de búsqueda, territorio e iniciativa funcionan por teclado, conservan la consulta en la URL, permiten limpiar y presentan un estado vacío. Las dimensiones con menos de dos opciones no generan selectores. Sin JavaScript quedan las cinco fichas y sus enlaces disponibles; la consulta del mapa conserva su enlace externo.

**Referencia editorial:** `/casos` de Por la Tierra volvió a devolver un error PHP, pero sí fue posible consultar las fichas de [Caspigasí del Carmen](https://porlatierra.org/casos/46/naturaleza) y [Tierra Hermosa](https://porlatierra.org/casos/81/caracteristicas). Se adaptó exclusivamente la organización de territorio, contexto, relato, hitos y materiales. No se incorporaron textos, CSS, fotografías, iconos, categorías, mapas ni taxonomías de esa referencia.

**Fichas y contenido mantenible:** conservan sus URLs y una sola presentación del resumen, con contexto territorial, relato, materiales, fuentes y revisión. Yumma y KilomboApp quedan relacionados sin confundir iniciativa territorial y herramienta digital. El Museo enlaza los dos videos ya identificados en la noticia existente y mantiene su fotografía. No se añadieron imágenes nuevas ni galerías ficticias. Las fuentes y fechas de revisión repetidas en el cuerpo se consolidaron en metadatos. Un único dato fechado aparece como fecha, sin línea de tiempo; el soporte para dos o más hitos documentados permanece disponible.

| Experiencia | Territorio público respaldado | Fecha y alcance documentados |
| --- | --- | --- |
| Kilombo Yumma | Bogotá | Origen en 2014; no acredita una sede o atención actual |
| KilomboApp | Bogotá, como contexto de Kilombo Yumma | Herramienta digital; no se fija lanzamiento ni ubicación física |
| Museo del Viernes Negro | Antonio Nariño, Bogotá | Crónica publicada el 18/06/2024, sin presentarla como fecha exacta de inauguración |
| Cátedra Benkos Biohó | Antonio Nariño, Bogotá | Descripción publicada el 21/08/2024; sin inferir inicio o cierre de una edición |
| Ruta Libertaria | San Basilio de Palenque | Primera versión documentada en 2023, sin mes/día ni otros destinos |

**Decap y guía:** nuevos campos opcionales `municipality`, `department`, `country`, `location_type`, `context`, `period`, `event_label`, `related_initiative`, `gallery`, `videos`, `sources` y descripción de cada hito. `territory` pasa a ser opcional bajo la etiqueta «Territorio público»; se mantienen resumen, relato, iniciativa, fuente principal, fechas, materiales y revisión. `public_precision` queda oculto como compatibilidad de archivos anteriores. Los tipos de ubicación son exacta, aproximada, únicamente territorial y no publicada; no se solicitan direcciones ni coordenadas. «No publicada» retira los cuatro metadatos territoriales del HTML y del feed, pero no borra información escrita en el relato ni del repositorio público: la guía pide revisar también el texto. Todos los registros actuales usan únicamente el nivel territorial. La galería aplica la validación, dimensiones y créditos de la imagen principal y excluye duplicados. Las etiquetas, ayuda y vista previa se actualizaron junto a `/admin/guia.html#territorios`. No se cambió el backend ni se autenticó o guardó en el CMS remoto.

**Disponibilidad y móvil:** el visor se carga a petición, con área de 600 px en escritorio y altura acotada en móvil. Se puede reintentar o cerrar para recuperar el foco fuera del recurso externo; no se bloquea el desplazamiento de la página. Tras 12 segundos sin evento de carga se informa de la demora. Un iframe de otro origen no permite confirmar la salud del mapa: Chromium emite `load` también con HTTP 503 o error de red. Por ello el mensaje nunca anuncia éxito, y siempre ofrece enlace al portal y al listado independiente. La comprobación real mostró mapa, puntos y leyenda; no registró errores de página ni peticiones fallidas. La leyenda del proveedor ocupa buena parte del ancho móvil, por lo que se conserva el acceso al portal en otra pestaña sin alterar su configuración.

**Limpieza comprobada:** se retiraron estilos sin consumidores del antiguo mapa, modal, formularios y popups Leaflet, además de la regla para `arcgis-embedded-map`, ausente del DOM y del JavaScript. El iframe sigue siendo la única integración cartográfica. No se añadió SDK ni otro proveedor.

**Validación:** `npm test` pasa 25/25 pruebas y cubre el modelo, publicación/omisión territorial, imágenes y galería, fichas opcionales, fechas/hitos y vista previa CMS. `npm run build` genera 13 páginas, 3 noticias, 5 experiencias y 2 imágenes. `npm run test:browser` comprueba 13 rutas × 3 tamaños (1440, 390 y 320 px), 52 enlaces internos, navegación, consola, filtros/vacío, retorno/recarga y contenido sin JavaScript; añade 12 escenarios aislados de ArcGIS (HTML 200, HTTP 503, red fallida y demora × 3 tamaños), responsive y cierre/reintento. Cero errores propios de página en las pruebas. Se revisaron el diff y las capturas de escritorio/móvil. Evidencia fuera del repositorio: `../AFNEMO-evidence-2026-10-02/slice-territorios/`, con `browser-results.json`, `territorial-browser-results.json`, `real-arcgis.json`, las capturas `territorial-*-overview-idle.png` y `real-*-territorios.png`, además de listados y fichas.

**Información que falta:** otros cuatro destinos de Ruta Libertaria y evidencia de realización; fechas precisas de inauguración del Museo y edición de la Cátedra; lanzamiento/disponibilidad de KilomboApp; ubicaciones de atención y condiciones actuales; más hitos y materiales con procedencia comprobada. No se completaron departamentos, municipios o países por inferencia geográfica. Entrega en un solo commit y push a la misma rama; sin merge a main, despliegue a producción ni modificación del ArcGIS remoto.
