# SecureVault Corp: seguridad, requisitos y salida a producción

Fecha de revisión: 26 de noviembre de 2026  
Rama revisada: `feature/securevault-login-shell`

## Veredicto

**Todavía no está listo para publicar en Internet.** La aplicación funciona en local y las pruebas de código pasan, pero existe un bloqueo crítico: `backend/.env` está presente en el historial de Git. Aunque el archivo ya está ignorado para futuros cambios, las llaves y credenciales que hayan estado allí deben considerarse expuestas.

Antes de publicar se debe:

1. Rotar `SESSION_SECRET`, `PRIVATE_KEY`, `CONFIDENTIAL_KEY`, `MESSAGE_KEY`, `BLIND_INDEX_KEY`, la contraseña de PostgreSQL, SMTP y la contraseña del administrador.
2. Retirar `backend/.env` del historial remoto con un procedimiento coordinado de limpieza de historial y force-push protegido.
3. Configurar los nuevos secretos en el gestor de secretos de la plataforma, nunca en Git.
4. Publicar únicamente detrás de HTTPS, con PostgreSQL privado, copias de seguridad y monitoreo.
5. Ejecutar ZAP, revisión de cabeceras y prueba TLS sobre la URL pública.

## Qué hace el proyecto

SecureVault Corp es un sistema interno empresarial con dos roles: `jefe` y `empleado`. El jefe crea usuarios, asigna actividades, publica eventos en calendarios seleccionados, administra anuncios, pagos y documentos, y recibe reportes de finalización. El empleado solo ve sus actividades y las que el jefe publica para su calendario, puede marcarlas como listas y enviar mensajes internos.

El backend es una API Express con PostgreSQL. El frontend es React/Vite. Las sesiones se guardan en PostgreSQL. Los mensajes, actividades, fechas, reportes diarios, pagos, documentos y campos privados usan cifrado autenticado AES-256-GCM; las contraseñas usan Argon2id; los correos se buscan mediante índice ciego HMAC-SHA-256.

La mensajería y las notificaciones por correo no son cifrado de extremo a extremo: el backend puede descifrar el contenido autorizado. Para E2E real harían falta claves por dispositivo, intercambio de claves, recuperación y rotación.

## Requisitos funcionales

| Requisito | Estado | Evidencia o pendiente |
|---|---|---|
| RF-01 Crear usuarios solo desde administración | Cumple | `POST /api/users` exige rol `jefe`; contraseña con Argon2id y política de complejidad. |
| RF-02 Iniciar y cerrar sesión | Cumple en local | Cookie HttpOnly, SameSite, Secure en producción, sesión PostgreSQL y regeneración al entrar. Falta comprobarlo en producción HTTPS. |
| RF-03 Roles | Cumple | Autorización server-side para `jefe` y `empleado`; la interfaz no es la barrera de seguridad. |
| RF-04 Notas privadas CRUD | Parcial | Hay reportes diarios cifrados para crear, leer y actualizar; falta una operación explícita de eliminación y una pantalla de notas privadas separada. |
| RF-05 Campo sensible enmascarado | Parcial | Teléfono/dirección tienen columnas cifradas, pero el perfil devuelve el valor descifrado al propietario y no lo enmascara. Debe corregirse antes de declarar cumplimiento total. |
| RF-06 Recuperación de contraseña | Parcial | Token aleatorio, hash SHA-256, uso único y expiración existen en API; el enlace “¿La olvidaste?” del frontend aún no completa el flujo de recuperación. |
| RF-07 Panel y bitácora | Cumple parcialmente | El jefe puede ver usuarios y eventos; deben agregarse pruebas de evidencia y alertas operativas. |
| RF-08 Salud | Cumple | `GET /health` solo devuelve `status` y responde 503 si PostgreSQL no está disponible. |
| RF-09 Sin registro público | Cumple | No hay endpoint público de registro; crear cuentas requiere `jefe`. |
| RF-10 Login inicial y denegación | Cumple | La raíz muestra login y la API exige sesión. |
| RF-11 Primer administrador controlado | Cumple con riesgo operativo | El seed usa variables de entorno; el secreto histórico expuesto debe rotarse y purgarse. |
| RF-12 Bienvenida personalizada | Cumple | Nombre, rol y saludo horario se muestran tras autenticación. |
| RF-13 Sonido de bienvenida | Pendiente | No se encontró audio servido desde el mismo dominio ni control de silencio. |
| RF-14 Gestión de usuarios | Cumple parcialmente | Crear, listar, activar/desactivar y cambiar rol están implementados y ahora registran cambios; falta impedir cualquier escenario de pérdida del último jefe en una regla transaccional. |
| Actividades asignadas por jefe | Cumple | Solo el jefe asigna; el responsable debe ser empleado activo. |
| Reporte al completar | Cumple | El empleado marca la actividad y se crea un reporte para el jefe; SMTP es opcional. |
| Calendarios cifrados y publicación selectiva | Cumple | Título, descripción y fechas cifrados; visibilidad privada, global o por lista se valida en servidor. |
| Mensajería cifrada | Cumple parcialmente | AES-256-GCM y llave separada; el correo externo solo avisa. No es E2E. |

## Controles de seguridad implementados

- Argon2id con memoria de 19 MiB, dos iteraciones y paralelismo uno.
- AES-256-GCM, IV aleatorio de 12 bytes, tag autenticado y AAD ligada al propietario o UUID del mensaje.
- Llaves separadas para datos privados, pagos/documentos, mensajes e índices ciegos.
- Consultas PostgreSQL parametrizadas y validación Zod.
- Sesiones persistentes en PostgreSQL, regeneración del ID al iniciar sesión y expiración de ocho horas.
- Rate limiting del login y del restablecimiento de contraseña; bloqueo progresivo tras intentos fallidos.
- Helmet, eliminación de `X-Powered-By`, CORS restringido y redirección HTTPS en producción.
- Protección CSRF por token de sesión para operaciones mutables autenticadas.
- Autorización server-side, filtros por propietario y respuestas genéricas para recursos no autorizados.
- Bitácora de login, accesos y cambios administrativos sin guardar contraseñas, tokens ni texto cifrado.
- Contenedor backend con usuario no root.
- Dependabot y pipeline CI con instalación reproducible, lint, build, pruebas y auditoría de dependencias.

## OWASP Top 10:2025

| Categoría | Estado | Evidencia o brecha |
|---|---|---|
| A01 Control de acceso | Implementado | RBAC, propiedad de recursos, actividades por empleado y endpoints protegidos. Falta ejecutar una prueba formal A contra B en producción. |
| A02 Configuración insegura | Parcialmente implementado | Helmet, CORS, errores genéricos y validación de producción. Falta demostrar HTTPS, HSTS y cabeceras con un escaneo público. |
| A03 Cadena de suministro | Parcial | Lockfiles, Dependabot y CI. Frontend: 0 vulnerabilidades auditadas; backend: 2 moderadas de `nodemon`/`minimatch` en dependencias de desarrollo. No hay escaneo de secretos en CI. |
| A04 Fallos criptográficos | Implementado en código, bloqueado operativamente | Algoritmos adecuados y secretos fuera del código fuente actual; el historial contiene `.env`, por lo que hay que rotar y purgar. No hay rotación automática de llaves. |
| A05 Inyección | Implementado | SQL parametrizado, Zod y React sin HTML crudo. Falta evidencia formal con payloads de SQLi/XSS. |
| A06 Diseño inseguro | Parcial | Separación de roles y límites de negocio presentes; falta un modelo STRIDE final con casos de abuso y límites de volumen. |
| A07 Fallos de autenticación | Parcialmente implementado | Argon2id, mensajes genéricos, rate limit, bloqueo y regeneración de sesión. MFA/TOTP y flujo visual de recuperación siguen pendientes. |
| A08 Integridad | Parcial | Lockfiles, CI y contenedor reproducible. Falta escaneo de secretos y revisión de integridad de artefactos; no se usan scripts CDN. |
| A09 Logging y alertas | Parcial | Hay bitácora estructurada y eventos administrativos; falta alerta externa ante repetición de fallos y retención definida. |
| A10 Excepciones | Parcialmente implementado | Error handler genérico, timeouts de PostgreSQL y cierre ordenado. Falta prueba automatizada de error forzado y política de observabilidad en producción. |

## Protocolo obligatorio antes de publicar

### Secretos e historial

- Revocar y regenerar todas las llaves y contraseñas que hayan estado en `backend/.env`.
- Eliminar el archivo del índice y limpiar el historial remoto con una ventana coordinada; no basta con borrar el archivo en el último commit.
- Confirmar que `.env`, logs, dumps y credenciales no aparecen en `git ls-files` ni en ningún commit nuevo.
- Usar un gestor de secretos y configurar permisos mínimos para la aplicación.

### Despliegue

- `NODE_ENV=production`.
- HTTPS obligatorio, HSTS y certificado válido.
- Frontend y API con dominios/orígenes explícitos; PostgreSQL sin exposición pública y con TLS.
- Usuario de base de datos con permisos mínimos, backups cifrados y prueba de restauración.
- Contenedor firmado o artefacto inmutable, ejecutado como usuario no root.
- Health checks, reinicio automático, logs centralizados y alertas.

### Verificación

```text
npm ci
npm audit --omit=dev --audit-level=high
npm test
npm run lint
npm run build
OWASP ZAP baseline sobre la URL pública
securityheaders.com sobre la URL pública
SSL Labs sobre el dominio HTTPS
Pruebas A contra B, CSRF, SQLi, XSS, fuerza bruta y recuperación de contraseña
```

No se debe realizar ningún escaneo contra sistemas que no pertenezcan al equipo.

## Resultados de esta revisión

- Backend: 3 pruebas pasadas.
- Frontend: lint pasado y build de producción pasado.
- Auditoría npm del frontend: 0 vulnerabilidades.
- Auditoría npm del backend: 0 altas/críticas; 2 moderadas en `nodemon`/`minimatch`, solo desarrollo.
- Health local comprobado anteriormente: frontend HTTP 200 y backend HTTP 200.
- Datos cifrados existentes normalizados sin descifrar ni exponer su contenido en logs.
- El archivo `.env` sí aparece en el historial: **bloqueo crítico**.

## Historial de commits

La rama local está sincronizada con su rama remota `origin/feature/securevault-login-shell`. Los últimos cambios funcionales y de seguridad están separados en commits, incluyendo:

- `a7f7d89` — restauración de texto español UTF-8.
- `dea2aef` — asignación por jefe y calendarios cifrados.
- `0f663d0` — mensajería interna cifrada.
- `53045ef` — carga funcional de mensajes.

La política de trabajo aplicada es hacer commit de cambios de código terminados en esta rama. Las reparaciones de datos cifrados de PostgreSQL son cambios de entorno, no archivos para commit. El siguiente commit debe incluir este informe y los endurecimientos de seguridad, pero **no** `backend/.env`.

## Estado final

**Estado: NO PUBLICAR TODAVÍA.** El producto está en una buena base de laboratorio y funciona localmente, pero el historial de secretos, la falta de despliegue HTTPS verificable, el flujo visual de recuperación, el enmascaramiento del perfil, el audio requerido y las evidencias ZAP/TLS/cabeceras impiden afirmar cumplimiento completo.
