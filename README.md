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

Las fichas conservan solo el nivel territorial respaldado: Antonio Nariño y San Cristóbal, Bogotá, como comunidades vinculadas a Yumma; Bogotá como contexto de la herramienta digital KilomboApp; Antonio Nariño, Bogotá, para Museo y Cátedra; San Basilio de Palenque, primera versión de 2023, para Ruta Libertaria. La ficha del Museo incorpora su dirección pública verificada en fuentes distritales de 2026. Los hitos posteriores de Ruta Libertaria son fechas contractuales, no fechas de viajes. No hay coordenadas ni itinerarios deducidos.

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

La auditoría completa de `main` a la rama de revisión retiró del árbol final tres entradas ficticias heredadas y sus dos imágenes, la copia PNG del banner ya sustituida por WebP, estilos de componentes retirados y exportaciones globales del chat sin consumidores. La configuración local `.claude/settings.local.json` dejó de estar versionada y permanece ignorada. Las pruebas de publicación crean su carpeta multimedia en la copia temporal, sin depender de imágenes de prueba del repositorio. No cambian los relatos documentales, las dependencias ni la infraestructura.

El 04/10/2026, la instalación limpia, las 42 pruebas, el build y las pruebas de navegador pasaron: 13 páginas generadas, tres noticias, cinco experiencias, 53 enlaces internos válidos y ningún error de JavaScript. Los dos avisos bajos del proxy siguen sin corrección compatible y `npm audit --omit=optional` conserva código 1. Las 20 URLs de las fuentes recientes F1–F16 respondieron HTTP 200; el dominio histórico Somos Abya Yala continúa inaccesible por DNS. Se conservan sus referencias originales del boletín, sin inventar un enlace sustituto. La autenticación remota sigue pendiente.

## Pendientes para entrega / validación institucional

### Autenticación / infraestructura

- Validar inicio de sesión real de Netlify Identity.
- Validar lectura/escritura remota real mediante Git Gateway.
- Evaluar posteriormente la migración desde Git Gateway debido a su deprecación.

### Información que debe confirmar AFNEMO

Verificación pública realizada el **4 de octubre de 2026**, sobre la base `86d9d12`. Se contrastaron fuentes originales y se conservó su precisión temporal. **CONFIRMADO** permite incorporar el dato con su alcance; **PROBABLE** y **NO CONFIRMADO** permanecen pendientes; **CONTRADICTORIO** registra las versiones sin escoger una. Una consulta sin resultados o una fuente inaccesible no demuestran que una actividad no exista.

- **Equipo actual — PENDIENTE AFNEMO.** La Resolución SCRD 258 identifica representación para el trámite de mayo de 2025 [F4], pero no acredita todo el equipo de 2026. La página sin fecha de `afnemo.co` enumera cargos sin validación fechada; tampoco cabe equiparar dirección ejecutiva y representación legal. Equipo vigente **NO CONFIRMADO**. No se trasladaron nombres, cargos ni identificaciones personales al sitio de revisión.
- **Contactos actuales — PARCIAL.** Se confirmó la dirección pública del Museo [F1–F3], publicada en su ficha. `afnemo.co` responde y sirve la página institucional del proyecto, con contenido sin fecha y varios enlaces vacíos; no constituye nueva validación independiente del equipo o la oferta. `neftalimosquera.org` aparece como web enlazada desde el perfil de AFNEMO en X, pero no resolvió por DNS durante la consulta: su servicio actual sigue **NO CONFIRMADO**. `afnemo.org` responde con una tarjeta de contacto sin fecha; no se reutilizan sus datos. Se comprobaron las páginas públicas de Instagram, Facebook y X: identifican a AFNEMO/Museo. Instagram `afnemo_` también está enlazado por Gobierno [F1]. Las biografías de Instagram/Facebook muestran un correo de reservas, pero no una fecha de publicación ni condiciones vigentes verificadas; bajo el criterio solicitado de fuentes fechadas se mantiene pendiente. Se conservan los enlaces existentes, sin añadir teléfonos, correos, canales ni cambiar el dominio principal.
- **Servicios actualmente vigentes — PARCIAL.** **CONFIRMADA** la contratación de AFNEMO en 2025–2026 para apoyo cultural y procesos de memoria/transmisión de saberes [F9–F11]. Se documenta como trabajo contratado reciente en `/asociacion/`; no se equipara a ejecución certificada ni a disponibilidad comercial actual de las once líneas de 2024. Estas siguen históricas; su alcance y condiciones vigentes requieren AFNEMO.
- **Voluntariado vigente — PENDIENTE AFNEMO.** Achiote Comunicaciones publicó una convocatoria conjunta y puntual para la campaña del 11, 13, 15 y 16 de agosto de 2026 [F8]. **CONFIRMADA** esa convocatoria pasada; **NO CONFIRMADO** un programa permanente o una convocatoria abierta al 04/10/2026. No se activaron formularios ni inscripciones.
- **Alianzas actualmente vigentes — PARCIAL.** **CONFIRMADAS** acciones recientes con CENPAZ, SCRD, Alcaldía Local de Antonio Nariño y Secretaría Distrital de Gobierno [F4, F7, F9–F11]. Se añadió «Colaboraciones recientes documentadas», sin alterar las trece históricas ni anunciar convenios permanentes. La colaboración Universidad de los Andes–Kilombo Yumma [F6] se describe en la ficha de Yumma con sus propios participantes, sin atribuir automáticamente a AFNEMO la administración del proyecto.
- **Ubicaciones y atención — PARCIAL.** **RESUELTOS / CONFIRMADOS** actividad del Museo en 2026, barrio, localidad, dirección pública y recepción de visitantes [F1–F3]. Falta confirmar horarios permanentes y reservas: la apertura anunciada en mayo de 2025 se limitaba a cinco meses. Para Yumma, **CONFIRMADO** el vínculo territorial de las comunidades de Antonio Nariño y San Cristóbal [F5], no la cobertura de atención de 2026 ni su administración por AFNEMO. **CONTRADICTORIO** respecto de la sede: el ASIS San Cristóbal 2024 lo sitúa en la UPZ 20 de Julio, mientras Gobierno, en mayo de 2025, lo referencia en el Centro de Víctimas de Rafael Uribe Uribe [F2, F14]. No se elige dirección. El documento de Estrategia Kilombos localizado en Salud devolvió 403; sus extractos de buscador no se usaron para publicar una sede.
- **Fechas precisas faltantes — PARCIAL.** **CONFIRMADA** la apertura de la sede del Museo el 25/04/2025 [F2], diferenciada de la apertura transitoria de 2024 cuyo día sigue pendiente. Kilombo App está documentada en 2023 [F12]; se añadió ese año, sin convertir la presentación del webinar en lanzamiento. Se mantienen Yumma 2014 y Ruta Libertaria 2023 sin día/mes. Las búsquedas de Cátedra Benkos Biohó asociada a AFNEMO/Antonio Nariño no aportaron fuente primaria fechada para el inicio o cierre de una edición. Las fechas contractuales posteriores de Ruta no sustituyen fechas de recorridos.
- **Otros cuatro destinos y fases de Ruta Libertaria — PARCIAL.** **CONFIRMADOS** los contratos de AFNEMO para la segunda fase «Palenque Tadó» (firma 28/11/2025) y fase III «Palenque Barbacoas» (firma 25/09/2026) [F9–F10]; se añadieron hitos contractuales posteriores. La numeración proviene de los objetos registrados; falta el anexo que explique cada etapa y acredite itinerario/ejecución. **NO CONFIRMADOS** los otros cuatro destinos mencionados en el Word. El conjunto de procesos del mismo portal aún marca «No adjudicado», mientras el conjunto de contratos identifica a AFNEMO y estado «Aprobado» para fase III: se conserva esa discrepancia entre registros, sin afirmar viaje realizado. El expediente detallado de SECOP devolvió 403.
- **Estado/disponibilidad de YummaApp / KilomboApp — PENDIENTE AFNEMO.** **CONFIRMADO** desarrollo e implementación inicial documentados en 2023 [F12]; un estudio de 2024 utiliza la expresión «Yumma app» [F13]. Esto vincula ambas denominaciones al contexto de Yumma, pero no acredita equivalencia de versiones, una tienda, repositorio, URL funcional o mantenimiento actual. No se encontraron pruebas primarias de operación en 2025–2026. El catálogo histórico permanece; no se ofrece acceso a un servicio activo.
- **Fecha/contexto del video COP16 — PARCIAL.** **RESUELTOS / CONFIRMADOS** URL original, título, canal Somos Abya Yala, transmisión del 25/10/2024 y publicación técnica del 26/10/2024 [F15]. CENPAZ documenta a AFNEMO como organización aliada del lanzamiento del Boletín 26 en Cali [F16]. Se actualizaron contexto y fecha del evento en la noticia existente; no se atribuyeron intervenciones individuales. Sigue **NO CONFIRMADO** cuándo se añadió el enlace a la entrada del Word fechada 25/07/2024, que se conserva. La agenda de CENPAZ advertía un cambio del 30 al 25; el antiguo enlace de COP16 hoy muestra un dominio aparcado y no valida aquella agenda. La transmisión original sí documenta el día 25.

### Material gráfico

- **Dos fotografías restantes — PENDIENTE AFNEMO.** Se revisaron las copias ya extraídas, sin volver a auditar el ZIP ni identificar personas. Las búsquedas por nombres de archivo, AFNEMO, actividades y canales vinculados no establecieron una coincidencia pública verificable con evento, fecha y crédito. El acceso a Somos Abya Yala falló por DNS y las redes no ofrecieron evidencia verificable suficiente. El nombre «WhatsApp-Image-2024-08-12…» no prueba la fecha del encuentro; «Screenshot-2024-11-11…» no prueba la fecha de la actividad representada. Contexto y autoría **NO CONFIRMADOS**, permiso de republicación sin acreditar: ambas siguen fuera de `dist`.

### Fuentes de la verificación pública

Consultadas el 04/10/2026. Los años de análisis, edición, evento y consulta se distinguen expresamente. Las descargas y comprobaciones quedan fuera del repositorio en `../AFNEMO-evidence-2026-10-04/institutional-research/`. Las referencias del portal de contratación son consultas de lectura; no se añadió ninguna integración al sitio.

| Ref. | Fuente y entidad | Fecha y alcance |
| --- | --- | --- |
| F1 | [El museo que le cambió el sentido al “Viernes Negro”](https://www.gobiernobogota.gov.co/noticias/museo-viernes-negro-afro-bogota), Secretaría Distrital de Gobierno | 01/05/2026. Actividad, naturaleza del espacio, barrio, localidad y visitas. |
| F2 | [Museo del Viernes Negro: un homenaje a la diáspora africana en Bogotá](https://www.gobiernobogota.gov.co/noticias/museo-viernes-negro-homenaje-diaspora), Secretaría Distrital de Gobierno | 22/05/2025. Apertura de sede el 25/04/2025; condiciones temporales de visita, no horarios de 2026. |
| F3 | [Antonio Nariño abre 25 jornadas de diálogo para construir propuestas ciudadanas](https://www.gobiernobogota.gov.co/noticias/antonio-narino-abre-25-jornadas-dialogo), Alcaldía Local / Secretaría Distrital de Gobierno | 08/09/2026. Dirección del Museo en la programación del 30/09/2026. |
| F4 | [Invitación cultural para la Implementación de laboratorios étnicos de comunidades negras](https://invitaciones.scrd.gov.co/verInvitacion/843) y [Resolución 258 de 2025](https://invitaciones.scrd.gov.co/StoragePublico/Avisos/d41b878b-0235-42a3-bee3-065a8cdb1787.pdf), SCRD | Apertura 10/04/2025; selección 02/05/2025, artículo 1, página 3. Apoyo a AFNEMO para el laboratorio del Museo. |
| F5 | [Análisis de Condiciones, Calidad de Vida, Salud y Enfermedad: Antonio Nariño 2024](https://saludata.saludcapital.gov.co/osb/wp-content/uploads/2026/01/15.ASIS_AntonioNarino_2024.pdf), Secretaría Distrital de Salud | Edición 2025, página impresa 61 (62 del PDF); alojado en carpeta 2026/01. Territorio de las comunidades vinculadas a Yumma, no comprobación de atención actual. |
| F6 | [EntreVer Con](https://arqdis.uniandes.edu.co/podcasts/entrever-con/) y [episodio 4: Los Kilombos](https://arqdis.uniandes.edu.co/podcasts/entrever-con/entrever-con-episodio-4/), Facultad de Arquitectura y Diseño, Universidad de los Andes | Página del proyecto sin fecha; episodio publicado el 05/09/2025. Proyecto conjunto con Yumma; la fecha corresponde al episodio. |
| F7 | [Comunicado y Velatón Nacional por la Paz y Libertad de René Alfonso Garavito](https://www.cenpaz.com/2025/02/comunicado-y-velatonnacionalporlapaz-y.html), CENPAZ | 19/02/2025; convocatoria para el 20/02/2025. AFNEMO entre las organizaciones firmantes. |
| F8 | [Campaña de Solidaridad con el Chocó ante impacto del Terremoto](https://achiotecomunicaciones.wordpress.com/2026/08/11/campana-de-solidaridad-con-el-choco-ante-impacto-del-terremoto/), Achiote Comunicaciones, convocante junto a AFNEMO | 11/08/2026. Convocatoria puntual de agosto, sin prueba de continuidad. |
| F9 | [SECOP II, contrato 334-2025-CPS-(146383)](https://www.datos.gov.co/resource/jbjy-vk9h.json?id_contrato=CO1.PCCNTR.8647867&$select=nombre_entidad,referencia_del_contrato,proveedor_adjudicado,descripcion_del_proceso,estado_contrato,fecha_de_firma,fecha_de_inicio_del_contrato,fecha_de_fin_del_contrato), Colombia Compra Eficiente / Alcaldía Local de Antonio Nariño | Firma 28/11/2025. Segunda fase de Ruta Libertaria; proveedor AFNEMO. |
| F10 | [SECOP II, contrato 271-2026-CD (163342)](https://www.datos.gov.co/resource/jbjy-vk9h.json?id_contrato=CO1.PCCNTR.9982868&$select=nombre_entidad,referencia_del_contrato,proveedor_adjudicado,descripcion_del_proceso,estado_contrato,fecha_de_firma,fecha_de_inicio_del_contrato,fecha_de_fin_del_contrato) y [registro del proceso CO1.REQ.11085284](https://www.datos.gov.co/resource/p6dx-8zbt.json?id_del_proceso=CO1.REQ.11085284), Colombia Compra Eficiente / Alcaldía Local de Antonio Nariño | Proceso publicado 23/09/2026; contrato firmado 25/09/2026. Fase III; estado del contrato aprobado, sin inicio consignado. |
| F11 | [SECOP II, contrato 1517-2025](https://www.datos.gov.co/resource/jbjy-vk9h.json?id_contrato=CO1.PCCNTR.8730533&$select=nombre_entidad,referencia_del_contrato,proveedor_adjudicado,descripcion_del_proceso,estado_contrato,fecha_de_firma,fecha_de_inicio_del_contrato,fecha_de_fin_del_contrato), Colombia Compra Eficiente / Secretaría Distrital de Gobierno | Firma 24/12/2025; período registrado 26/12/2025–09/04/2026. AFNEMO como prestadora contratada. |
| F12 | [Webinar sobre medicina ancestral digital y liderazgo femenino afro](https://profamilia.org.co/biblioteca-virtual/news/webinar-medicina-ancestral-digital-y-liderazgo-femenino-afro-para-legitimar-modelos-de-salud-complementarios/), Share-Net Colombia / Profamilia; [Kilombo App](https://www.4tu.nl/du/projects/Kilombo-App/), 4TU.Design United | Reseña 07/06/2023 del webinar del 25/05/2023; muestra universitaria edición 2023. Desarrollo inicial, no disponibilidad actual. |
| F13 | [HCI Pluriversal Framework for Ancestral Medicine App in Bogota: Asset-Based Design Case Study](https://pure.tue.nl/ws/portalfiles/portal/330480221/JDSSI-NO_00016A-20240426.pdf), Niño, Yoo y Hummels, Eindhoven University of Technology / Journal of Design Service and Social Innovation | Artículo publicado el 26/04/2024 según la página 37; portada del repositorio indica 01/04/2024. Esa discrepancia editorial no se usa como fecha de lanzamiento. |
| F14 | [Análisis de Condiciones, Calidad de Vida, Salud y Enfermedad: San Cristóbal 2024](https://saludata.saludcapital.gov.co/osb/wp-content/uploads/2026/01/4.-ASIS_SanCristobal_2024.pdf), Secretaría Distrital de Salud | Edición 2025; páginas impresas 35 y 100. Referencia de ubicación de Yumma que difiere de F2. |
| F15 | [Cop16: Voces desde los Territorios en el Abya Yala](https://www.youtube.com/watch?v=ZtyJWXbl7Kc), Somos Abya Yala / YouTube | Emisión 25/10/2024, inicio 20:00:55 UTC; metadatos de publicación 26/10/2024. Página original accesible y estado de reproducción disponible durante la consulta. |
| F16 | [IV Encuentro Somos Abya Yala. 10 años volando juntos como el Águila, el Cóndor, el Quetzal y el Torogoz](https://www.cenpaz.com/2024/10/iv-encuentro-somos-abya-yala-10-anos.html), CENPAZ | 04/10/2024. Agenda del lanzamiento y papel de AFNEMO como organización aliada. |

Comprobaciones de contactos (biografías sin fecha, consultadas el 04/10/2026, no usadas como única fuente de datos vigentes): [AFNEMO, sitio publicado del proyecto](https://afnemo.co/), [tarjeta AFNEMO](https://www.afnemo.org/), [dominio Neftalí Mosquera](https://neftalimosquera.org/), [perfil Instagram enlazado por Gobierno](https://www.instagram.com/afnemo_/), [Facebook de AFNEMO](https://www.facebook.com/p/Asociaci%C3%B3n-Afrocultural-Neftal%C3%AD-Mosquera-Afnemo-61561154941588/) y [perfil de AFNEMO en X](https://x.com/AFNEMO_). Las pistas de agregadores de contratación se contrastaron con los datos oficiales de Colombia Compra Eficiente; no constituyen evidencia por sí solas.
