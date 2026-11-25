# CONTEXTO — Laboratorio SecureVault Corp

> Documento de contexto. Describe el *qué* y el *por qué* del laboratorio y del sistema.
> El detalle técnico exigible está en `REQUERIMIENTOS_SecureVault.md`.

---

## 1. Datos generales del laboratorio

| Campo | Valor |
|---|---|
| Nombre | Laboratorio Práctico — Sistema seguro en Node.js: OWASP Top 10:2025, cifrado, hash y despliegue a producción |
| Sistema a construir | **SecureVault** (nuestra versión: **SecureVault Corp**) |
| Asignatura / Docente / Fecha de entrega | A completar (en el PDF aparecen en blanco) |
| Modalidad | Equipos de 2 a 3 estudiantes |
| Duración | 2 semanas (sugerido) |
| Valor | 100 puntos (+10 de bonificación) |

**Tarea obligatoria para mañana (antes de la clase):** cada equipo debe entregar un *Deep Research* sobre despliegue de aplicaciones Node.js en producción (ver sección 9). La clase partirá de esa investigación. Sin ella no se puede completar la Fase 3.

---

## 2. Propósito

En la industria una aplicación no está terminada cuando «funciona en mi computadora», sino cuando está **en producción, accesible públicamente y resiste ataques reales**. El laboratorio consiste en construir un sistema pequeño en Node.js que:

1. Aplique de forma demostrable las **10 categorías del OWASP Top 10:2025**.
2. Use correctamente **hash y cifrado**.
3. Se **despliegue en producción con HTTPS**.

### Objetivos de aprendizaje

- Identificar y mitigar los riesgos del OWASP Top 10:2025 en una aplicación Node.js real.
- Distinguir cuándo usar hash (irreversible) y cuándo cifrado (reversible), con algoritmos y parámetros actuales.
- Gestionar secretos y llaves criptográficas sin exponerlos en el código fuente.
- Investigar de forma autónoma y crítica (deep research) las opciones de despliegue y elegir una justificadamente.
- Publicar la aplicación con HTTPS, configuración segura y verificación posterior al despliegue.

---

## 3. Qué es SecureVault (enunciado original)

Aplicación web pequeña para **guardar notas privadas y datos personales sensibles**. Puede ser una API REST con frontend sencillo (HTML/EJS o framework a elección) o una aplicación renderizada en servidor. El alcance es deliberadamente reducido: el esfuerzo debe concentrarse en la **seguridad**, no en la cantidad de funciones.

---

## 4. Nuestra versión: SecureVault Corp (sistema interno de una empresa)

Convertimos el ejemplo genérico en **el sistema interno de una empresa con un jefe y empleados**. El objetivo es que el control de acceso y los privilegios sean el centro del proyecto: cada persona ve **solo lo que le corresponde** y todo lo privado está **cifrado**.

### 4.1 El login es la puerta de entrada
- La **primera pantalla** del sistema es siempre el **inicio de sesión**.
- Ninguna otra ruta funcional es accesible sin autenticarse (denegar por defecto).

### 4.2 No existe registro público
- **No hay pantalla ni endpoint de «crear cuenta» para el público.**
- **Solo el jefe (administrador)** crea las cuentas de los empleados y asigna el rol.
- Esto reinterpreta el RF-01 del enunciado («Registro de usuario»): la creación de usuario sigue existiendo, con correo, nombre y contraseña con política de complejidad y hash, pero **la ejecuta el jefe desde el panel**, no el visitante.
- El primer administrador se crea por un **mecanismo de arranque controlado** (script de *seed* o variables en el gestor de secretos), nunca por un formulario público ni con credenciales escritas en el repositorio.

### 4.3 Bienvenida personalizada con sonidos
- Al iniciar sesión correctamente, el usuario ve una **pantalla de bienvenida personalizada** (nombre, rol, saludo según la hora y, para el empleado, un resumen de sus actividades del día) acompañada de **sonidos**.
- Los sonidos son un añadido de experiencia de usuario y **no deben debilitar la seguridad**: archivos de audio servidos desde el propio dominio (compatible con CSP `media-src 'self'`), sin CDN no verificado y sin inyectar el nombre del usuario sin escapar (A05/XSS).
- Los navegadores bloquean el audio automático sin interacción previa; el clic en «Iniciar sesión» cuenta como interacción, por lo que el sonido se dispara tras ese gesto. Debe haber un control para silenciar.

### 4.4 Roles: jefe y empleados

El enunciado exige dos roles (RF-03); los mapeamos así:

| Rol del laboratorio | Rol en la empresa |
|---|---|
| administrador | **Jefe** |
| usuario | **Empleado** |

El rol se verifica **siempre en el servidor**. Ocultar menús en el frontend es solo cosmética; la seguridad real está en los middlewares del backend.

### 4.5 Regla central de privacidad entre empleados

> **Un empleado solo puede ver la información general de la empresa y la suya propia. Nunca la de otro empleado.**

Lo que **NO** puede ver un empleado de otro empleado (ni siquiera conociendo el ID del registro):

- **Pagos**: salario, planilla, bonos, deducciones, historial de pagos.
- **Lo que hace y maneja cada usuario**: sus responsabilidades, la información y los documentos que administra, sus reportes diarios.
- **Las tareas y actividades del día** (y su calendario personal).
- **Dónde vive** (dirección) y demás datos personales: teléfono, cédula, correo personal, contactos de emergencia.
- Cualquier otro dato privado del perfil.

Lo que **SÍ** ve todo empleado:

- **Información general de la empresa**: misión, políticas internas, anuncios, avisos, datos de contacto institucionales.
- **Su propio calendario y sus propias actividades del día** (CRUD sobre lo suyo).
- **Su propio perfil** (datos enmascarados por defecto) y **sus propios pagos**.
- Un **directorio mínimo** de compañeros (solo nombre y puesto), sin dirección, teléfono, correo personal ni nada privado. *(Decisión a confirmar: puede eliminarse si se quiere aislamiento total.)*

El **jefe** puede leer la información de todos los empleados y administrar las cuentas, y cada acceso sensible queda en la bitácora.

### 4.6 Matriz de visibilidad

| Recurso | Empleado | Jefe |
|---|---|---|
| Anuncios e información general de la empresa | ✅ lee | ✅ crea y edita |
| Su propio calendario y actividades del día | ✅ CRUD | ✅ lee el de todos |
| Calendario y actividades de otro empleado | ❌ 403/404 | ✅ lee |
| Su propio reporte diario / lo que maneja | ✅ CRUD | ✅ lee el de todos |
| Reporte diario / lo que maneja otro empleado | ❌ 403/404 | ✅ lee |
| Su propio perfil (teléfono, cédula, dirección; enmascarados) | ✅ lee/edita | ✅ lee |
| Perfil y dirección de otros empleados | ❌ 403/404 | ✅ lee |
| Sus propios pagos | ✅ lee | ✅ |
| Pagos y salarios de otros | ❌ 403/404 | ✅ lee y gestiona |
| Documentos confidenciales de la empresa | ❌ | ✅ |
| Crear, desactivar o cambiar rol de cuentas | ❌ | ✅ |
| Bitácora y panel de seguridad | ❌ | ✅ |

> **Detalle importante para la demo:** al acceder al recurso de otro empleado, la API responde **404** (o 403) sin confirmar que el registro existe. Así no se filtra información ni siquiera sobre qué IDs son válidos.

### 4.7 Módulos del sistema

1. **Login y bienvenida personalizada** con sonido.
2. **Tablero de la empresa**: anuncios, misión, políticas y contactos institucionales (lo ven todos).
3. **Mi día**: actividades del día con hora, estado (pendiente, en curso, hecha) y prioridad, más calendario mensual. Cada empleado ve solo lo suyo.
4. **Reporte diario**: el empleado registra qué hizo y qué maneja; cifrado; lo leen solo él y el jefe.
5. **Mi perfil y mis pagos**: datos propios enmascarados; el empleado ve únicamente sus pagos.
6. **Calendario del equipo (jefe)**: vista de todos los empleados con filtros.
7. **Empleados (jefe)**: alta de cuentas, roles, activar/desactivar, datos personales.
8. **Pagos y planilla (jefe)**: salarios y pagos de todos, cifrados.
9. **Documentos confidenciales (jefe)**: contratos y notas internas, cifrados.
10. **Panel de seguridad (jefe)**: logins fallidos, bloqueos, accesos denegados y alertas.

---

## 5. Qué se cifra y cómo (niveles de datos)

Separamos los datos en tres niveles para justificar cada decisión criptográfica en el informe.

| Nivel | Datos | Protección |
|---|---|---|
| **Público interno** | Anuncios, información general de la empresa, directorio mínimo | Sin cifrado de campo; solo requiere sesión. Cifrar todo no aporta valor y se explica en el informe. |
| **Privado** | Actividades y tareas del día, reporte diario, lo que maneja cada usuario, teléfono, cédula, **dirección**, correo personal | **AES-256-GCM** |
| **Confidencial** | **Pagos, salarios, planilla**, documentos del jefe | **AES-256-GCM con una llave distinta** (`CONFIDENTIAL_KEY`): si una llave se filtra, no se expone todo |

Técnicas adicionales:
- **Contraseñas:** Argon2id (o bcrypt cost ≥ 12). Nunca cifradas.
- **Tokens de recuperación:** `crypto.randomBytes(32)` y se guarda el **SHA-256** del token.
- **Blind index del correo:** `HMAC-SHA256(email_normalizado, llave_aparte)` para poder buscar por correo sin guardarlo en claro; el correo real va cifrado en otra columna.
- **AAD en AES-GCM:** se pasa el `owner_id` como dato autenticado adicional. Si alguien copia un registro cifrado de un empleado a la fila de otro, el descifrado **falla**. Refuerza el aislamiento entre empleados incluso ante manipulación directa de la BD.
- **Versión de llave (`key_version`)** en cada registro cifrado, para rotación de llaves (bonificación).
- **Fechas y horas de actividades sin cifrar** (`start_at`, `end_at`) para ordenar el calendario en SQL; el título y la descripción sí van cifrados. Decisión justificada en el informe.

### Riesgo residual a documentar
El jefe puede leer lo de los empleados porque **el servidor descifra** con las llaves. Es **cifrado en reposo**, no de extremo a extremo. Debe declararse como riesgo residual en el informe de seguridad.

### Preguntas de análisis obligatorias en el informe
- ¿Qué ocurre con los datos si se **pierde la llave**?
- ¿Cómo se **rotaría la llave** sin perder la información existente? *(Orientación: `key_version` por registro y re-cifrado gradual.)*

---

## 6. Modelo de datos (borrador)

```
users              id, email_hash, email_enc, name, password_hash, role (jefe|empleado),
                   phone_enc, address_enc, position, department, is_active,
                   must_change_password, failed_attempts, locked_until,
                   created_by, key_version, created_at

announcements      id, title, body, created_by, pinned, created_at
company_info       id, section, content, updated_by

activities         id, owner_id → users, title_enc, description_enc,
                   start_at, end_at, status, priority, key_version

daily_reports      id, owner_id → users, report_date, content_enc, key_version

payments           id, employee_id → users, amount_enc, concept_enc, period,
                   key_version                       (llave CONFIDENCIAL)

documents          id, title_enc, content_enc, uploaded_by, key_version   (solo jefe)

password_resets    id, user_id, token_hash, expires_at, used_at
security_events    id, user_id, event_type, ip, user_agent, metadata, created_at
sessions           (si se usa express-session + connect-pg-simple)
```

---

## 7. Cómo se refleja cada categoría OWASP en SecureVault Corp

| Categoría | Qué se hace en este sistema |
|---|---|
| A01 Broken Access Control | Todas las consultas filtran por `owner_id = usuario actual`; el empleado que pide la actividad, el pago o el perfil de otro recibe 403/404; solo el jefe accede a pagos y documentos |
| A02 Security Misconfiguration | Helmet + CSP, sin `X-Powered-By`, CORS restringido, sin stack traces |
| A03 Supply Chain | `npm ci`, `npm audit`, Dependabot |
| A04 Cryptographic Failures | Tres niveles de datos, dos llaves, AAD con `owner_id`, Argon2id, TLS |
| A05 Injection | Consultas parametrizadas, validación con zod, `<script>` neutralizado en tareas y reportes |
| A06 Insecure Design | Modelo de amenazas: empleado curioso, jefe comprometido, fuga de BD, creación de cuentas sin permiso |
| A07 Authentication Failures | Rate limiting, 429, bloqueo progresivo, sesión regenerada |
| A08 Integrity Failures | CI con pruebas antes del deploy, JWT con algoritmo fijo, SRI |
| A09 Logging | Cada lectura de pagos, cambio de rol y acceso denegado queda en la bitácora (sin datos sensibles) |
| A10 Exceptional Conditions | Manejador global, respuestas genéricas, fail closed |

---

## 8. Tecnología sugerida (se puede justificar una alternativa)

- **Runtime:** Node.js en versión LTS activa; framework Express o Fastify.
- **Base de datos:** PostgreSQL (con Prisma/Knex/pg) o MongoDB (con Mongoose).
- **Seguridad:** `helmet`, `express-rate-limit`, `zod` o `joi`, `argon2` (o `bcrypt`), módulo nativo `node:crypto`.
- **Logs:** `pino` o `winston` en formato JSON estructurado.
- **Control de versiones:** repositorio Git (GitHub/GitLab) con `.gitignore` que excluya `.env` y `node_modules`.
- **Frontend (nuestra elección):** React + Vite, dark mode, animaciones (`framer-motion`), iconos (`lucide-react`), calendario (`react-big-calendar`), gráficos (`recharts`).

---

## 9. Fases del laboratorio

| Fase | Actividad | Producto |
|---|---|---|
| 0. Deep Research (antes de mañana) | Investigación guiada sobre despliegue de Node.js en producción | Informe de 2 a 4 páginas con fuentes |
| 1. Diseño | Modelo de datos, flujo de autenticación, modelo de amenazas (A06), elección de plataforma basada en la investigación | Diagrama y tabla de amenazas |
| 2. Desarrollo seguro | Implementar RF-01 a RF-08 aplicando OWASP y criptografía; commits frecuentes y descriptivos | Repositorio con código y README |
| 3. Despliegue a producción | Publicar con dominio/subdominio público, HTTPS, BD en la nube y secretos gestionados por la plataforma | URL pública funcionando |
| 4. Verificación | Pruebas sobre la URL de producción: `npm audit`, OWASP ZAP (baseline), securityheaders.com, SSL Labs, pruebas manuales de IDOR, inyección y fuerza bruta | Informe de seguridad con evidencias |

### Deep Research previo (Fase 0)

- **Entrega:** al inicio de la clase de mañana, PDF o documento compartido de **2 a 4 páginas**.
- **Mínimo 6 fuentes confiables** citadas (documentación oficial, OWASP, blogs técnicos de proveedores).
- **No se aceptan respuestas copiadas de una IA sin verificación ni fuentes:** si se usa IA, hay que contrastar y citar las fuentes originales.

**Preguntas que deben responderse:**
1. Diferencias entre PaaS (Render, Railway, Fly.io, Heroku), contenedores (Docker) y VPS/IaaS (AWS EC2, DigitalOcean, Azure VM): ventajas, desventajas, costos y nivel de control.
2. Comparar **al menos tres plataformas** con plan gratuito o educativo vigente: límites, si duermen por inactividad, soporte de bases de datos, HTTPS automático, regiones.
3. Cómo se gestionan variables de entorno y secretos en producción; qué es un gestor de secretos y por qué no basta un `.env`.
4. Qué es un certificado TLS, cómo funciona Let's Encrypt y qué hace HSTS.
5. Qué es un proxy inverso (Nginx, Caddy), por qué va delante de Node.js y qué implica `trust proxy` en Express.
6. Qué es un gestor de procesos (PM2, systemd) y cuándo deja de ser necesario (contenedores, PaaS).
7. Qué es CI/CD; describir un pipeline mínimo con GitHub Actions: `npm ci`, pruebas, auditoría de dependencias y despliegue.
8. Opciones de base de datos gestionada (Neon, Supabase, MongoDB Atlas) y cómo asegurar la conexión (TLS, listas de IP, usuarios con mínimo privilegio).
9. Qué cambia entre desarrollo y producción (`NODE_ENV`, logs, manejo de errores, CORS, cookies).
10. Qué verificaciones de seguridad conviene hacer tras el despliegue y con qué herramientas.

**Estructura sugerida del informe de investigación:** resumen ejecutivo (½ página); respuestas con citas; tabla comparativa de tres plataformas; plan de despliegue para SecureVault (plataforma y justificación, arquitectura, secretos, BD, pipeline); lista de referencias.

---

## 10. Conceptos clave: hash vs. cifrado

**Regla práctica:** si nunca necesitas recuperar el valor original, usa **hash**; si necesitas leerlo de nuevo, usa **cifrado**.

| Dato | Técnica | Motivo |
|---|---|---|
| Contraseña | Hash lento con sal (Argon2id / bcrypt) | Nunca se descifra, solo se compara |
| Tareas, reportes, dirección, teléfono, cédula | AES-256-GCM | Se deben poder leer de nuevo; GCM detecta manipulación |
| Pagos y salarios | AES-256-GCM con llave confidencial separada | Máxima sensibilidad; aislamiento de llaves |
| Token de recuperación | SHA-256 | Alta entropía: no necesita hash lento |
| Firma / integridad | HMAC-SHA256 | Verifica que nadie alteró el dato |
| Datos en tránsito | TLS 1.2/1.3 | Protege credenciales y cookies en la red |

**Prohibido (resta puntos):** MD5 o SHA-1/SHA-256 simple para contraseñas; AES en modo ECB; `crypto.createCipher()`; reutilizar el mismo IV; llaves en el código o en el repositorio; `Math.random()` para tokens; algoritmos inventados; contraseñas «cifradas» en lugar de hasheadas.

---

## 11. Correos del sistema

Se necesita un servicio SMTP (Resend, Brevo o Gmail con contraseña de aplicación). Las credenciales van en el gestor de secretos.

1. **Cuenta creada por el jefe:** el empleado recibe un correo con contraseña temporal o enlace de activación de un solo uso (reemplaza al registro público).
2. **Recuperación de contraseña:** enlace con token que expira en minutos; en la BD solo el hash. Mensaje genérico: «si el correo existe, te enviaremos un enlace».
3. **Alerta de seguridad:** aviso por cambio de contraseña, nuevo inicio de sesión o cuenta bloqueada.
4. **Aviso al jefe:** tras N fallos consecutivos de login (alerta de A09).

---

## 12. Evaluación (resumen)

| Criterio | Puntos |
|---|---|
| Deep Research de despliegue | 10 |
| Funcionalidad (RF-01 a RF-08) | 10 |
| OWASP Top 10:2025 (10 categorías con mitigación y evidencia) | 30 |
| Hash y cifrado | 20 |
| Despliegue a producción | 20 |
| Informe y demostración | 10 |
| **Total** | **100** |

**Bonificación (hasta +10):** MFA con TOTP, rotación de llaves implementada (campo de versión de llave), contenedor Docker con usuario no root, escaneo de secretos en CI (p. ej. gitleaks), o alertas enviadas a un canal externo.

---

## 13. Guion de la demostración (10 minutos)

1. Login como empleado y bienvenida personalizada con sonido.
2. El empleado intenta ver la actividad, el perfil o los pagos de otro empleado: **403/404**.
3. El empleado intenta entrar a la planilla o a los documentos del jefe: **403**.
4. Fuerza bruta en el login: **429** y alerta.
5. `<script>` en una tarea o reporte: neutralizado.
6. Captura de la BD con pagos, direcciones y tareas ilegibles (cifrado).
7. Login como jefe: panel de seguridad con los eventos de los ataques anteriores.

---

## 14. Recursos recomendados

- OWASP Top 10:2025 — owasp.org/Top10/2025
- OWASP Cheat Sheet Series: Password Storage, Cryptographic Storage, Authentication, Session Management, Node.js Security, Nodejs Docker — cheatsheetseries.owasp.org
- Módulo `crypto` de Node.js — nodejs.org/api/crypto.html
- Guía de seguridad de Node.js — nodejs.org/en/learn/getting-started/security-best-practices
- Express: seguridad y rendimiento en producción — expressjs.com
- OWASP ZAP — zaproxy.org · Mozilla Observatory / securityheaders.com · Qualys SSL Labs — ssllabs.com/ssltest

---

## 15. Nota ética

Las pruebas de ataque se realizan **únicamente contra la aplicación propia del equipo**. Escanear o atacar sistemas de terceros, incluidas las aplicaciones de otros equipos sin autorización, está **prohibido**.