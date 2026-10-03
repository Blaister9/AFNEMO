# AFNEMO

Sitio existente en HTML, CSS y JavaScript, con Decap CMS (Git Gateway / Netlify Identity) y visor ArcGIS externo. Se conserva la identidad visual y los proveedores actuales.

## Primera entrega · 2 de octubre de 2026

**Base:** `main` / `ab4bd20`, remoto `https://github.com/Blaister9/AFNEMO.git`, sin cambios locales previos. Rama de revisión: `codex/mejoras-contenido-recorridos`. No hay AGENTS.md ni pruebas iniciales; README previo de dos líneas. No se ha publicado ni modificado el portal ArcGIS.

**Diagnóstico y prioridades:**

- P0: chat concatena entrada y respuesta en HTML (`animations.js`), reproducido con etiqueta inocua. Publicación original de toda la raíz (`netlify.toml`) expone contenidos aunque no se muestren.
- P1: 28 enlaces vacíos, noticias de prueba sin detalle y peticiones a GitHub siempre en main (`index.html`, `news.js`). CMS usa git-gateway; no se ha validado inicio de sesión real.
- P1: menú sin aria-expanded, Escape no cierra; falta main; contraste bajo y hero móvil recortable (`nav.js`, CSS).
- P1: footer de Fundación Raíces Afro / NIT de ejemplo; equipo y aliados sin respaldo actual. Formularios sin integración. Fotografías entregadas sin autorizaciones acreditadas.
- P2: iframe ArcGIS real y script de componente inexistente, OG image inexistente y caché immutable sin cambio de URL.

**Insumos contrastados:** `Contenidos_AFNEMO.zip` y `AFNEMO_insumos_organizados.zip`, localizados en Downloads. Original: `pagina a 19 de febrero.docx`, 218 párrafos no vacíos, metadatos de compilación 19/02/2025. El texto derivado coincide con el original. Nada de esos archivos originales se incorpora al repositorio. 35 imágenes válidas, 33 únicas; siete entradas .jpeg son HTML y hay una entrada vacía. En esta primera entrega las fotos nuevas quedaron fuera por falta de permiso; el siguiente slice incorpora únicamente la fotografía del Museo expresamente autorizada por el cliente.

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
| Museo del Viernes Negro | Ficha permanente, foto autorizada y noticia de apertura con fecha original 18/06/2024 |
| COP16 | Memoria audiovisual con fecha del archivo 25/07/2024; diferencia explícita frente al calendario de la conferencia |
| Saberes ancestrales y biodiversidad | Síntesis atribuida, publicación institucional 26/11/2024 y enlaces al boletín del 27/10/2024 |
| Experiencias audiovisuales | Solo los tres videos identificados: uno de Somos Abya Yala y dos de El AfroBogotano; sin catálogo inventado |

Las tres noticias distinguen publicación original, fuente y actualización del 02/10/2026. La URL anterior de la memoria del Museo se conserva para no romper enlaces; la fecha se corrige en sus metadatos visibles. Ruta Libertaria conserva únicamente San Basilio de Palenque, primera versión documentada en 2023.

**Imágenes:** se incorpora una sola versión de `AFNEMO MUSEO DEL VIERNES NEGRO.jpg`, autorizada expresamente por el cliente: WebP de 1440 × 960, 276.618 bytes, desde el original de 2560 × 1707 y 804.091 bytes. Aparece en la ficha y tarjeta del Museo con dimensiones, carga diferida, descripción factual y crédito «Imagen suministrada por AFNEMO». No se copia el duplicado incrustado en el Word. El banner separado reproduce la composición del hero existente; se mantiene el WebP anterior sin agregar otro recurso.

**Material excluido:** contacto/a-1 son duplicados y contienen un dominio distinto del sitio actual; no se usan. Screenshot y WhatsApp quedan fuera por falta de contexto comprobado. La galería de terceros del Word requiere procedencia/permisos; no se publica. Los siete falsos JPEG/HTML, entrada vacía y referencias rotas se descartan. No se incorporan ZIP, DOCX ni directorios de trabajo al repositorio o a dist.

**Carga amigable:** `/admin/guia.html` ofrece tres accesos, pasos de escritura/guardado, explicación de fechas y fotografías y una revisión final. Se enlaza desde el pie del sitio y la barra del editor. Las etiquetas del CMS están en español; el preview muestra cambios sin guardar y la imagen autorizada, avisa sobre fechas/campos pendientes y diferencia borrador de publicación. La página institucional también es editable. El acceso sigue conectado a main: esta entrega no autentica, guarda contenido en Git Gateway ni altera producción.

**Confirmaciones pendientes:** equipo/cargos, contactos/dirección y condiciones de visita al Museo actuales; vigencia de servicios, voluntariado y alianzas; contexto y permisos de imágenes no usadas; disponibilidad de YummaApp (el dominio original no resolvió); momento de incorporación del video COP16 a la entrada fechada en julio. Autenticación y guardado real del editor requieren una sesión autorizada. A 320 px el formulario interno del proveedor Decap conserva un ancho mínimo; la guía y el sitio sí se verifican a ese tamaño.

El usuario autoriza subir los cuatro commits acumulados a `codex/mejoras-contenido-recorridos`. No se autoriza merge a main ni despliegue de producción. Capturas y auditorías nuevas permanecen fuera del repositorio en `../AFNEMO-evidence-2026-10-02/slice-contenidos/`.

**Validación del cierre:** `npm test` 8/8, incluyendo colección institucional, índice de secciones y exclusión de su borrador; `npm run build` 13 páginas, 3 noticias, 5 experiencias y 2 imágenes; `npm run test:browser` aprobado: 13 rutas × 3 tamaños, 52 enlaces internos, fechas históricas, decodificación de todas las imágenes, guía, contenido institucional, filtros, recarga, consola y regresiones de chat/navegación. Cero errores propios de página. Las dos imágenes públicas tienen hashes distintos; no hay duplicados binarios en assets/images. Revisión visual de escritorio/móvil y diff sin errores de espacios. Servicios externos aislados en las pruebas automáticas; el editor no fue autenticado.
