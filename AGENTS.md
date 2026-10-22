# Instrucciones para agentes — ci-backend

Monorepo NestJS de microservicios para el centro de idiomas. Incluye un API Gateway y los servicios `auth`, `academic`, `students`, `enrollment`, `attendance-grades`, `exams` y `payments`.

## Stack

- **Runtime y API**: Node.js 22, NestJS 12 y Fastify.
- **Persistencia**: PostgreSQL y Prisma; cada microservicio es dueño de sus datos y su esquema.
- **Caché y colas de trabajos**: Redis y BullMQ (correos, generación de documentos, notificaciones y reintentos).
- **Mensajería entre microservicios**: RabbitMQ mediante eventos y comandos asíncronos. No usar las colas BullMQ como sustituto de los contratos entre servicios.
- **Seguridad**: JWT, Passport y Argon2id; autorización basada en roles y permisos.
- **Configuración y validación**: `@nestjs/config`, variables de entorno, `class-validator` y `class-transformer`.
- **Documentación de API**: OpenAPI/Swagger.
- **Archivos**: almacenamiento compatible con S3 (por ejemplo, MinIO) para justificaciones, boletas y actas.
- **Observabilidad**: logs estructurados con Pino, trazas/métricas con OpenTelemetry y health checks.
- **Contenedores**: Docker y Docker Compose para desarrollo local e infraestructura dependiente.
- **Tests**: Vitest y Supertest (`*.spec.ts` en `apps/` y `libs/`).

## Estructura

- Aplicaciones desplegables: `apps/<service>/`.
- Código de cada aplicación: `apps/<service>/src/`.
- Código compartido: `libs/`.
- Pruebas unitarias: junto al código, en archivos `*.spec.ts`.
- Pruebas end-to-end: `test/`.

## Calidad y diseño de código

- Todo el código de producción, pruebas, scripts internos y contratos se escribe en TypeScript. Activa `strict`; evita `any`, `@ts-ignore` y conversiones inseguras. Prefiere tipos explícitos, `unknown` al recibir datos externos y type guards/validación antes de usarlos.
- Modela cada microservicio con DDD pragmático: dominio, aplicación, infraestructura e interfaces. El dominio no depende de NestJS, Prisma, HTTP, RabbitMQ ni proveedores externos.
- Aplica SOLID y DRY con criterio: elimina duplicación de conocimiento real, pero no extraigas abstracciones prematuras ni compartas reglas de negocio entre dominios distintos.
- Usa inyección de dependencias y patrones según el problema: Repository para persistencia, Adapter/Anti-Corruption Layer para sistemas externos, Strategy para variantes intercambiables, Factory para construcción compleja y Specification/Policy para reglas de negocio reutilizables.
- Mantén funciones y clases cohesionadas, con nombres ubicuos del dominio; evita servicios genéricos gigantes, lógica de negocio en controladores y dependencias circulares.

## Pagos

- El servicio `payments` es el único que conoce las credenciales, SDKs, webhooks y peculiaridades de las pasarelas. Los demás servicios se comunican por contratos/eventos, no llaman a la pasarela directamente.
- Define un puerto TypeScript, por ejemplo `PaymentGateway`, y una implementación Adapter por proveedor (`CulqiPaymentGateway`, `NiubizPaymentGateway`, etc.). Selecciona el proveedor mediante configuración/Factory o Strategy; no acoples los casos de uso al SDK del proveedor.
- El cliente SDK y su Adapter pueden ser providers singleton de NestJS (`Scope.DEFAULT`) siempre que no conserven estado mutable por solicitud ni datos de un pago. Singleton es una optimización de ciclo de vida, no el patrón principal de la integración.
- Toda creación, confirmación, reembolso y procesamiento de webhook debe ser idempotente en nuestra base de datos y frente al proveedor. Persiste una clave de idempotencia, verifica la firma y el timestamp del webhook, y conserva el identificador de solicitud del proveedor para auditoría.
- Trata el webhook como la fuente de confirmación del pago; valida importe, moneda, orden y transición de estado en el servidor. Emite eventos de pago mediante outbox transaccional y consumidores idempotentes.

## Interoperabilidad

- Integra Moodle, la intranet institucional, Nubefact y Niubiz mediante puertos y Adapters/Anti-Corruption Layers dentro del servicio propietario. El dominio usa contratos propios; nunca expone tipos, SDKs o terminología del tercero fuera de la infraestructura.
- Define contratos TypeScript versionados, mapeos explícitos, validación de entrada/salida y pruebas de contrato por integración. Conserva los identificadores externos y la trazabilidad de sincronización, sin convertirlos en la identidad de dominio.
- Establece una fuente de verdad por dato y un flujo de sincronización documentado. Evita sincronización bidireccional sin reglas claras de precedencia, resolución de conflictos y reconciliación.
- La integración con la **intranet** pertenece a `students`/`auth`: sincroniza únicamente los datos académicos y de identidad autorizados. Usa cuenta de servicio con mínimo privilegio, autenticación de servidor a servidor y auditoría.
- La integración con **Moodle** pertenece a `academic`/`enrollment`: provisiona cursos, grupos, docentes y matrículas tras confirmar los eventos locales. Usa un servicio Moodle dedicado con capacidades mínimas y valida el contexto/permisos requeridos por cada operación.
- La integración con **Niubiz** pertenece exclusivamente a `payments`, mediante el Adapter de pasarela. Procesa sus webhooks con verificación criptográfica, idempotencia y reconciliación; jamás recibas ni almacenes datos de tarjeta.
- La integración con **Nubefact** pertenece exclusivamente a `payments`: emite comprobantes solo a partir de un pago/venta confirmado, guarda el estado y CDR/identificador del comprobante, y permite reintentos idempotentes y conciliación manual.
- Ejecuta sincronizaciones no críticas en colas con outbox, reintentos exponenciales con límite, timeout, circuit breaker y DLQ. No bloquees una matrícula o pago confirmado porque Moodle, intranet o Nubefact esté temporalmente caído.
- Todo callback/webhook externo debe autenticarse (firma/HMAC, mTLS o credenciales del proveedor), verificarse contra replay con timestamp/nonce, limitarse por tasa y registrarse con un identificador de correlación. No aceptes URLs de callback suministradas por el usuario.
- Cifra credenciales y tokens de integración, sepáralos por proveedor y entorno, rótalos, no los envíes en eventos y minimiza los datos personales transferidos. Acuerda retención, borrado y tratamiento de errores con cada sistema integrado.

## Arquitectura e infraestructura

- El Gateway es el único punto de entrada público. Los microservicios y sus puertos de administración permanecen en redes privadas.
- Cada servicio delimita sus responsabilidades, contratos, configuración y datos; no comparte su base de datos con otro servicio.
- Este repositorio provee su `Dockerfile`; `ci-deploy` es el único repositorio que orquesta la plataforma completa mediante Docker Compose.

## Seguridad obligatoria

- Diseña, implementa y revisa la plataforma contra el [OWASP Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction/) y los endpoints contra el [OWASP API Security Top 10:2023](https://api-security.owasp.org/editions/2023/en/0x00-header/), con especial atención a autorización por objeto, función y propiedad.
- Obliga HTTPS en todos los entornos expuestos. TLS termina en el Gateway o proxy de confianza; habilita HSTS únicamente en producción después de confirmar el dominio y subdominios.
- Configura CORS con una lista explícita de orígenes confiables desde variables de entorno. Nunca uses `*` junto con credenciales, ni reflejes el encabezado `Origin` sin validarlo. Deshabilita CORS si no se necesita acceso desde navegador.
- Protege respuestas HTTP mediante Helmet/Fastify Helmet. Para una API JSON aplica al menos `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` y una `Permissions-Policy` restrictiva. Revisa la CSP si se sirven páginas HTML, Swagger o archivos desde el mismo origen.
- Expón Swagger/OpenAPI solo en desarrollo (`NODE_ENV=development`) y nunca en producción por defecto; deshabilita tanto la UI como el JSON/YAML de OpenAPI. La decisión debe estar protegida por configuración validada al iniciar, no por una ruta oculta.
- Si se requiere documentación en un entorno no local, publícala separada de la API, sin datos reales, mediante VPN o lista de IPs y autenticación fuerte. Protégela con rate limiting, los mismos controles CORS/cabeceras y registro de accesos; no confíes únicamente en `addBearerAuth` o en ocultar la URL.
- Genera el contrato Swagger exclusivamente desde DTOs y decoradores revisados. Excluye endpoints internos/administrativos, errores detallados, secretos, URLs privadas, encabezados sensibles y ejemplos con PII, credenciales, tokens o datos de pago. Deshabilita "Try it out" fuera de desarrollo.
- Autentica con tokens de vida corta y refresh tokens rotables, revocables y almacenados de forma segura. Usa Argon2id para contraseñas; no registres ni expongas contraseñas, tokens, claves ni datos personales sensibles.
- Aplica autorización en el servidor para cada recurso y acción, aun si la interfaz ya la oculta. Usa DTOs de entrada/salida con lista permitida de campos para prevenir mass assignment y exposición excesiva de datos.
- Valida y transforma toda entrada con DTOs; rechaza campos no permitidos, limita tamaño de cuerpo, paginación, filtros y cargas. Nunca construyas consultas SQL, URLs, rutas de archivos o comandos con datos sin validar.
- Para cada endpoint nuevo, separa explícitamente las defensas contra XSS y SQL Injection: XSS se mitiga con respuestas JSON, codificación/sanitización contextual de cualquier HTML que se admita y CSP en los orígenes que sirven UI; SQL Injection se mitiga con Prisma y parámetros enlazados. No uses `$queryRawUnsafe`, `$executeRawUnsafe`, interpolación de SQL ni concatenación de filtros/ordenamientos. Toda consulta raw debe ser excepcional, parametrizada, revisada y cubierta por pruebas.
- No persistas HTML arbitrario. Si un caso de negocio requiere texto enriquecido, define una lista permitida mínima, sanitízala en el servidor antes de guardar y antes de devolverla, conserva el valor original solo si existe una justificación auditada y nunca lo renderices mediante mecanismos de bypass de sanitización.
- Trata como no confiables body, query, path params, headers, cookies, archivos, mensajes de colas y payloads de webhooks. Define DTOs/contratos de entrada, límites de tamaño y allowlists para campos, filtros, columnas ordenables y relaciones incluibles; no delegues estas decisiones a valores enviados por el cliente.
- Implementa rate limiting distribuido con Redis en el Gateway y límites adicionales en inicio de sesión, recuperación de contraseña, pagos, matrícula, carga de archivos, búsquedas y exportaciones. Devuelve `429` al superar los límites.
- No coloques secretos en código, imágenes Docker, logs, URLs ni repositorio. Usa variables de entorno o un gestor de secretos, valida su presencia al iniciar y rota secretos comprometidos.
- Para archivos: permite solo extensiones y tipos reales necesarios, valida tipo y tamaño, renombra en servidor, almacena fuera del webroot/S3 privado, analiza malware y entrega acceso mediante autorización y URL firmada de corta vida. No confíes solo en `Content-Type`.
- Para pagos y webhooks: verifica firma, timestamp e idempotencia; no marques pagos como exitosos desde datos enviados por el cliente.
- Para RabbitMQ/BullMQ: usa credenciales separadas con mínimo privilegio, TLS en redes no confiables, contratos validados, reintentos acotados, DLQ e idempotencia de consumidores. No incluyas secretos ni PII innecesaria en mensajes.
- Registra eventos de seguridad y auditoría (inicio de sesión, cambios de rol, matrícula, pagos, notas y descargas), con identificador de correlación. Sanitiza logs, no devuelvas stack traces al cliente y restringe el acceso a logs.
- Configura cuentas de base de datos con mínimo privilegio, cifrado en tránsito, copias de seguridad cifradas y pruebas de restauración. Define retención y eliminación de datos personales conforme a las obligaciones aplicables.
- Fija versiones mediante `package-lock.json`, revisa dependencias vulnerables en CI y no despliegues secretos o archivos `.env` dentro de imágenes. Usa imágenes base mantenidas y ejecución Docker sin usuario root cuando sea posible.

## Verificación de seguridad

- Incluye pruebas automatizadas para autenticación, permisos por recurso/rol, CORS, rate limiting, validación, webhooks y cargas de archivos.
- Por cada endpoint que acceda a datos, incluye pruebas negativas de validación, mass assignment, autorización por objeto y parámetros de búsqueda/ordenamiento; cuando haya SQL raw o contenido HTML permitido, añade casos de prueba específicos contra inyección y XSS.
- Antes de desplegar, ejecuta lint, pruebas unitarias/e2e, auditoría de dependencias y revisión de configuración de producción. Registra y corrige hallazgos de severidad alta o crítica antes del despliegue.
- Revisa periódicamente permisos, dependencias, registros de auditoría, copias de seguridad y reglas de CORS/CSP. Mantén un inventario de endpoints, servicios y versiones expuestas.

## Comandos

- Desarrollo: `npm run start:dev`
- Compilar: `npm run build`
- Lint: `npm run lint`
- Formatear: `npm run format`
- Pruebas unitarias: `npm run test`
- Pruebas end-to-end: `npm run test:e2e`
- Cobertura: `npm run test:cov`

## Conventions

- Respeta la estructura por servicio en `apps/<service>/`; cada servicio mantiene su código en `apps/<service>/src/`.
- Mantén dentro de cada servicio su lógica de dominio, casos de uso, adaptadores y configuración. Un servicio no debe acceder directamente a la base de datos de otro.
- Coloca en `libs/` únicamente código transversal y sin reglas de negocio de un servicio: `@app/common`, `@app/database`, `@app/contracts`, `@app/config` y `@app/observability`.
- Define contratos versionados para la comunicación asíncrona en `libs/contracts/`; publica eventos de dominio y evita dependencias directas entre servicios.
- Mantén el esquema y las migraciones de Prisma junto al servicio propietario, en `apps/<service>/prisma/`. Ejecuta las migraciones mediante scripts específicos por servicio, tanto en desarrollo como en despliegue.
- Mantén el `Dockerfile` autocontenido, sin secretos y ejecutando como usuario no root. No agregues Docker Compose aquí: `ci-deploy` orquesta los repositorios independientes.
