# REQUERIMIENTOS — SecureVault

> Lista completa y verificable de lo que debe cumplir el sistema y los entregables.
> Contexto y justificación: ver `CONTEXTO_SecureVault.md`.
> Los requisitos marcados **[EQUIPO]** son decisiones propias que se suman al enunciado.

---

## 1. Requisitos funcionales

### 1.1 Requisitos del enunciado (RF-01 a RF-08)

| ID | Requisito | Detalle |
|---|---|---|
| RF-01 | Creación de usuario **(adaptado: solo admin)** | Correo, nombre y contraseña con política de complejidad. La contraseña se almacena **solo como hash**. La cuenta la crea únicamente el administrador (ver RF-09). |
| RF-02 | Inicio y cierre de sesión | Sesión segura (cookie `HttpOnly`/`Secure`/`SameSite`) o JWT con expiración corta. El cierre de sesión **invalida** la sesión. |
| RF-03 | Roles | Dos roles: **usuario** y **administrador**. El rol se verifica **siempre en el servidor**. |
| RF-04 | CRUD de notas privadas | Cada usuario crea, lee, edita y elimina **solo sus propias notas**. El contenido se guarda **cifrado** en la BD. |
| RF-05 | Dato sensible de perfil | Un campo sensible (teléfono o número de documento) almacenado **cifrado** y mostrado **enmascarado** (`***-***-1234`). |
| RF-06 | Recuperación de contraseña | Token aleatorio de **un solo uso**, con **expiración**; en la BD se guarda el **hash del token**, no el token. |
| RF-07 | Panel de administración | Lista de usuarios y **bitácora de eventos de seguridad** (logins fallidos, cambios de rol, accesos denegados). |
| RF-08 | Endpoint de salud | `GET /health` responde el estado **sin revelar versiones ni datos internos**. |

### 1.2 Requisitos adicionales de nuestro equipo [EQUIPO]

| ID | Requisito | Detalle |
|---|---|---|
| RF-09 | **Sin registro público** | No existe ruta, formulario ni endpoint público de registro. Solo el administrador autenticado puede crear cuentas (y asignar rol: usuario o administrador). El endpoint de creación exige rol admin verificado en el servidor, valida la entrada con esquema y registra el evento en la bitácora. |
| RF-10 | **Login como primera pantalla** | La ruta raíz (`/`) muestra el login. Toda otra ruta requiere sesión válida (denegar por defecto); sin sesión redirige al login. |
| RF-11 | **Primer administrador por arranque controlado** | El admin inicial se crea con un script de *seed* o desde variables en el gestor de secretos; nunca con credenciales en el repositorio ni en el README. Se recomienda forzar cambio de contraseña en el primer ingreso. |
| RF-12 | **Bienvenida personalizada** | Tras un login exitoso se muestra una pantalla de bienvenida personalizada (nombre del usuario, rol, saludo según la hora del día). El nombre se escapa en la salida (A05). |
| RF-13 | **Sonidos de bienvenida** | Al ingresar se reproduce un sonido (acceso concedido/saludo). Reglas: audio servido desde el mismo dominio (compatible con CSP `media-src 'self'`); se dispara tras el gesto del usuario (clic en login) por la política de autoplay del navegador; control para silenciar; un sonido distinto o diferenciado para error de login es opcional. |
| RF-14 | **Gestión de usuarios por el admin** | El admin puede crear, listar, cambiar rol y desactivar cuentas. Cada acción queda registrada (cambios de rol incluidos, según RF-07 y A09). |

---

## 2. Requisitos de seguridad: OWASP Top 10:2025

Cada categoría debe tener **al menos una medida implementada y una evidencia verificable** (código, captura, prueba o resultado de escaneo) en el informe final.

### A01 — Broken Access Control (incluye SSRF)
- Middleware de autorización por rol.
- Verificación de propiedad en cada consulta (`WHERE owner_id = usuario_actual`) para evitar IDOR.
- Denegar por defecto.
- Si hay peticiones salientes a URLs, usar lista blanca de destinos.
- **Evidencia:** prueba donde el usuario A intenta leer la nota del usuario B y recibe 403/404.

### A02 — Security Misconfiguration
- Helmet con CSP; desactivar `X-Powered-By`.
- CORS restringido a su dominio.
- `NODE_ENV=production`; sin stack traces al cliente; sin rutas de depuración.
- **Evidencia:** reporte de securityheaders.com con calificación **A o superior**.

### A03 — Software Supply Chain Failures
- `package-lock.json` versionado; instalar con `npm ci`.
- `npm audit` sin vulnerabilidades altas/críticas.
- Dependabot o Renovate activado; mínimo de dependencias.
- **Evidencia:** salida de `npm audit` y configuración de Dependabot.

### A04 — Cryptographic Failures
- Argon2id/bcrypt para contraseñas; AES-256-GCM para datos sensibles.
- Llaves fuera del repositorio; TLS obligatorio en producción; cookies `Secure`.
- **Evidencia:** captura de la BD mostrando datos cifrados y hashes; reporte de SSL Labs.

### A05 — Injection (incluye XSS)
- Consultas parametrizadas u ORM.
- Validación de entrada con esquemas (zod/joi).
- Escape de salida en plantillas.
- CSP que bloquee scripts inline.
- **Evidencia:** intentos de `' OR 1=1 --` y de `<script>` rechazados o neutralizados.

### A06 — Insecure Design
- Modelo de amenazas breve (STRIDE o diagrama de flujo de datos).
- Límites de negocio (máx. notas, tamaño de nota).
- Casos de abuso documentados.
- **Evidencia:** diagrama + tabla de amenazas y mitigaciones en el informe.
- [EQUIPO] Incluir en el modelo de amenazas: intento de crear cuentas sin ser admin, escalada de rol y abuso del flujo de bienvenida.

### A07 — Authentication Failures
- Rate limiting y bloqueo progresivo en login.
- Mensajes de error genéricos.
- Regenerar el ID de sesión al autenticar.
- Expiración de sesión.
- MFA (TOTP) como bonificación.
- **Evidencia:** prueba de fuerza bruta bloqueada (HTTP 429).

### A08 — Software or Data Integrity Failures
- No deserializar datos no confiables.
- Verificar firma de JWT con algoritmo fijo.
- SRI en scripts de CDN.
- Pipeline CI que ejecute pruebas antes del deploy.
- **Evidencia:** archivo del pipeline CI y uso del atributo `integrity`.

### A09 — Security Logging and Alerting Failures
- Registrar logins exitosos/fallidos, accesos denegados y cambios de rol.
- **No** registrar contraseñas, tokens ni datos cifrados.
- Alerta simple ante N fallos consecutivos.
- **Evidencia:** muestra de logs en JSON y vista del panel de bitácora.

### A10 — Mishandling of Exceptional Conditions
- Manejador global de errores; respuestas genéricas al cliente.
- Fallar de forma segura (*fail closed*).
- Manejo de `unhandledRejection`.
- Timeouts en BD y peticiones externas.
- **Evidencia:** prueba que fuerce un error y muestre respuesta genérica + log interno.

---

## 3. Requisitos de hash y cifrado

| Dato | Técnica | Algoritmo y parámetros |
|---|---|---|
| Contraseña | Hash lento con sal | **Argon2id** (memoria ≥ 19 MiB, iteraciones ≥ 2, paralelismo 1) o **bcrypt** (cost ≥ 12) |
| Contenido de notas | Cifrado autenticado | **AES-256-GCM**, IV aleatorio de 12 bytes por registro, tag de 16 bytes |
| Teléfono / documento | Cifrado autenticado | AES-256-GCM (misma utilidad) |
| Token de recuperación | Hash rápido | SHA-256 del token; el token se genera con `crypto.randomBytes(32)` |
| Firma / integridad | HMAC | HMAC-SHA256 con llave secreta |
| Datos en tránsito | TLS | HTTPS con TLS 1.2/1.3 (Let's Encrypt o certificado de la plataforma) |

### Gestión de llaves
- Generar la llave **una sola vez**: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
- En desarrollo: variable de entorno en `.env` (excluido de Git).
- En producción: **gestor de secretos de la plataforma**.
- Formato sugerido del dato cifrado en BD: `iv.tag.datos` en base64.

### Preguntas de análisis (obligatorias en el informe)
1. ¿Qué ocurre con los datos si se pierde la llave?
2. ¿Cómo se rotaría la llave sin perder la información existente?

### ❌ PROHIBIDO (resta puntos automáticamente)
- MD5 o SHA-1/SHA-256 simple para contraseñas.
- AES en modo ECB.
- `crypto.createCipher()` (obsoleto, sin IV).
- Reutilizar el mismo IV.
- Llaves escritas en el código o subidas al repositorio.
- `Math.random()` para tokens.
- Inventar algoritmos propios.
- Guardar contraseñas «cifradas» en lugar de hasheadas.

---

## 4. Requisitos del entorno de producción

- URL pública con **HTTPS obligatorio** (HTTP redirige a HTTPS), con dominio o subdominio público.
- Variables de entorno y llaves en el **panel de secretos de la plataforma**, no en archivos del repositorio.
- `NODE_ENV=production`.
- Si hay proxy inverso o balanceador: `app.set('trust proxy', 1)` correctamente configurado (para que funcionen cookies `Secure` y rate limiting).
- Base de datos **no expuesta públicamente** o protegida con credenciales robustas y **conexión cifrada**; BD en la nube.
- Reinicio automático ante fallos (gestor de procesos, contenedor o plataforma).
- Despliegue **reproducible**: pipeline CI/CD o, como mínimo, pasos documentados en el README.
- Credenciales de prueba (**un usuario y un administrador**) entregadas al docente por **canal privado**, no en el README. [EQUIPO] Como no hay registro público, el admin debe crear previamente la cuenta de usuario de prueba.

---

## 5. Requisitos de verificación (Fase 4)

Pruebas sobre la **URL de producción**:
- `npm audit`
- OWASP ZAP (baseline scan)
- securityheaders.com
- SSL Labs
- Pruebas manuales de IDOR, inyección y fuerza bruta
- [EQUIPO] Intento de acceder a una ruta de creación de cuentas sin ser admin (debe rechazarse) y verificación de que no existe registro público.

---

## 6. Requisito previo: Deep Research (Fase 0)

- Entrega **al inicio de la clase de mañana**, en PDF o documento compartido de **2 a 4 páginas**.
- **Mínimo 6 fuentes confiables** citadas. No se acepta contenido de IA sin verificar ni sin fuentes.
- Debe responder las **10 preguntas** del enunciado (PaaS vs contenedores vs VPS; comparar 3 plataformas; secretos y gestor de secretos; TLS/Let's Encrypt/HSTS; proxy inverso y `trust proxy`; gestor de procesos; CI/CD con GitHub Actions; BD gestionada y su aseguramiento; desarrollo vs producción; verificaciones post-despliegue).
- Estructura: resumen ejecutivo (½ página), respuestas con citas, tabla comparativa de tres plataformas, plan de despliegue para SecureVault (plataforma y justificación, arquitectura, secretos, BD, pipeline) y referencias.

---

## 7. Entregables finales

1. **Repositorio Git** (con acceso para el docente) con historial de commits de **todos los integrantes**.
2. **URL de producción** funcionando durante el periodo de evaluación.
3. **README**: descripción, instalación local, variables de entorno requeridas (**solo nombres, sin valores**), pasos de despliegue.
4. **Informe de seguridad**: tabla que mapee cada categoría OWASP Top 10:2025 con mitigación y evidencia; decisiones criptográficas justificadas; resultados de ZAP, `npm audit`, securityheaders.com y SSL Labs; **riesgos residuales**.
5. **Informe de Deep Research** (Fase 0).
6. **Demostración en vivo de 10 minutos (o video)** mostrando la app en producción y **al menos tres ataques bloqueados**.

---

## 8. Rúbrica

| Criterio | Excelente | Aceptable | Insuficiente | Pts |
|---|---|---|---|---|
| Deep Research | Responde todo, compara 3 plataformas, plan justificado, fuentes de calidad | Respuestas incompletas o fuentes débiles | No entregado a tiempo o sin fuentes | 10 |
| Funcionalidad (RF-01 a RF-08) | Todos funcionan en producción | Faltan 1 o 2 | Faltan 3 o más | 10 |
| OWASP Top 10:2025 | 10 categorías con mitigación y evidencia | 7 a 9 categorías | Menos de 7 o sin evidencias | 30 |
| Hash y cifrado | Argon2id/bcrypt, AES-256-GCM con IV único, llaves en secretos, análisis de rotación | Algoritmos correctos con errores menores de gestión de llaves | Algoritmos prohibidos o llaves en el repositorio | 20 |
| Despliegue a producción | HTTPS, secretos gestionados, BD protegida, CI/CD, reinicio automático | En línea con HTTPS pero configuración incompleta | No desplegado o sin HTTPS | 20 |
| Informe y demostración | Claro, con evidencias, riesgos residuales y demo convincente | Informe correcto pero superficial | Incompleto o sin demo | 10 |
| **Total** | | | | **100** |

### Bonificación (hasta +10)
- [ ] MFA con TOTP
- [ ] Rotación de llaves implementada (campo de versión de llave)
- [ ] Contenedor Docker con usuario no root
- [ ] Escaneo de secretos en CI (p. ej. gitleaks)
- [ ] Alertas enviadas a un canal externo

---

## 9. Checklist antes de entregar

**Del enunciado**
- [ ] El archivo `.env` no aparece en ningún commit del historial.
- [ ] `npm audit` no reporta vulnerabilidades altas ni críticas.
- [ ] Un usuario no puede ver, editar ni borrar notas de otro usuario.
- [ ] Las contraseñas en la BD comienzan con `$argon2id$` o `$2b$`.
- [ ] El contenido de las notas en la BD es ilegible (base64 con IV, tag y datos).
- [ ] La app responde solo por HTTPS y las cookies tienen `HttpOnly`, `Secure` y `SameSite`.
- [ ] Los errores muestran un mensaje genérico; el detalle solo queda en los logs.
- [ ] El login devuelve 429 después de varios intentos fallidos.
- [ ] Los logs no contienen contraseñas, tokens ni datos sensibles.
- [ ] El README explica cómo reproducir el despliegue.

**De nuestro equipo [EQUIPO]**
- [ ] La primera pantalla es el login y no existe ningún registro público.
- [ ] Solo el admin puede crear cuentas; un usuario normal recibe 403 al intentarlo.
- [ ] La bienvenida personalizada y los sonidos funcionan tras el login y se pueden silenciar.
- [ ] El nombre en la bienvenida está escapado (sin XSS) y los audios cumplen la CSP.
- [ ] No hay credenciales del admin inicial en el repositorio ni en el README.

---

## 10. Nota ética

Las pruebas de ataque se hacen **solo contra la aplicación propia del equipo**. Atacar o escanear sistemas de terceros, incluidas las apps de otros equipos sin autorización, está **prohibido**.