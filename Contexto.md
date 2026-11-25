# CONTEXTO — Laboratorio SecureVault

> Documento de contexto. Describe el *qué* y el *por qué* del laboratorio.
> El detalle técnico exigible está en `REQUERIMIENTOS_SecureVault.md`.

---

## 1. Datos generales del laboratorio

| Campo | Valor |
|---|---|
| Nombre | Laboratorio Práctico — Sistema seguro en Node.js: OWASP Top 10:2025, cifrado, hash y despliegue a producción |
| Sistema a construir | **SecureVault** |
| Asignatura / Docente / Fecha de entrega | A completar (en el PDF aparecen en blanco) |
| Modalidad | Equipos de 2 a 3 estudiantes |
| Duración | 2 semanas (sugerido) |
| Valor | 100 puntos (+10 de bonificación) |

**Tarea obligatoria para mañana (antes de la clase):** cada equipo debe entregar un *Deep Research* sobre despliegue de aplicaciones Node.js en producción (ver sección 7 de este documento). La clase partirá de esa investigación. Sin ella no se puede completar la Fase 3.

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

## 3. Qué es SecureVault

Aplicación web pequeña para **guardar notas privadas y datos personales sensibles**. Puede ser una API REST con frontend sencillo (HTML/EJS o framework a elección) o una aplicación renderizada en servidor. El alcance es deliberadamente reducido: el esfuerzo debe concentrarse en la **seguridad**, no en la cantidad de funciones.

---

## 4. Decisiones de diseño de nuestro equipo (adaptaciones al enunciado)

Estas decisiones se **suman** al enunciado original y no reemplazan ningún requisito del PDF.

### 4.1 El login es la puerta de entrada
- La **primera pantalla** del sistema es siempre el **inicio de sesión**.
- Ninguna otra ruta funcional es accesible sin autenticarse (denegar por defecto).

### 4.2 No existe registro público
- **No hay pantalla ni endpoint de «crear cuenta» para el público.**
- **Solo el administrador** puede crear cuentas de usuario (y asignar su rol).
- Esto reinterpreta el RF-01 del enunciado («Registro de usuario»): la creación de usuario sigue existiendo, con correo, nombre y contraseña con política de complejidad y hash, pero **la ejecuta el admin desde el panel**, no el visitante.
- El primer administrador se crea por un **mecanismo de arranque controlado** (script de *seed* o variables de entorno en el gestor de secretos), nunca por un formulario público ni con credenciales escritas en el repositorio.

### 4.3 Bienvenida personalizada con sonidos
- Al iniciar sesión correctamente, el usuario ve una **pantalla de bienvenida personalizada** (por ejemplo con su nombre, su rol y la hora del día) acompañada de **sonidos** (p. ej. sonido de acceso concedido / saludo).
- Los sonidos son un añadido de experiencia de usuario y **no deben debilitar la seguridad**: archivos de audio servidos desde el propio dominio (compatible con CSP `media-src 'self'`), sin CDN no verificado y sin inyectar el nombre del usuario sin escapar (A05/XSS).
- Nota técnica: los navegadores bloquean la reproducción automática de audio sin interacción previa; el clic en «Iniciar sesión» cuenta como interacción, por lo que el sonido debe dispararse tras ese gesto. Debe haber un control para silenciar.

---

## 5. Tecnología sugerida (se puede justificar una alternativa)

- **Runtime:** Node.js en versión LTS activa; framework Express o Fastify.
- **Base de datos:** PostgreSQL (con Prisma/Knex/pg) o MongoDB (con Mongoose).
- **Seguridad:** `helmet`, `express-rate-limit`, `zod` o `joi`, `argon2` (o `bcrypt`), módulo nativo `node:crypto`.
- **Logs:** `pino` o `winston` en formato JSON estructurado.
- **Control de versiones:** repositorio Git (GitHub/GitLab) con `.gitignore` que excluya `.env` y `node_modules`.

---

## 6. Fases del laboratorio

| Fase | Actividad | Producto |
|---|---|---|
| 0. Deep Research (antes de mañana) | Investigación guiada sobre despliegue de Node.js en producción | Informe de 2 a 4 páginas con fuentes |
| 1. Diseño | Modelo de datos, flujo de autenticación, modelo de amenazas (A06), elección de plataforma basada en la investigación | Diagrama y tabla de amenazas |
| 2. Desarrollo seguro | Implementar RF-01 a RF-08 aplicando OWASP y criptografía; commits frecuentes y descriptivos | Repositorio con código y README |
| 3. Despliegue a producción | Publicar con dominio/subdominio público, HTTPS, BD en la nube y secretos gestionados por la plataforma | URL pública funcionando |
| 4. Verificación | Pruebas sobre la URL de producción: `npm audit`, OWASP ZAP (baseline), securityheaders.com, SSL Labs, pruebas manuales de IDOR, inyección y fuerza bruta | Informe de seguridad con evidencias |

---

## 7. Deep Research previo (Fase 0)

- **Entrega:** al inicio de la clase de mañana.
- **Formato:** PDF o documento compartido de **2 a 4 páginas**.
- **Mínimo 6 fuentes confiables citadas** (documentación oficial, OWASP, blogs técnicos de proveedores).
- **No se aceptan respuestas copiadas de una IA sin verificación ni fuentes:** si se usa IA, hay que contrastar y citar las fuentes originales.

### Preguntas que deben responderse
1. Diferencias entre PaaS (Render, Railway, Fly.io, Heroku), contenedores (Docker) y VPS/IaaS (AWS EC2, DigitalOcean, Azure VM): ventajas, desventajas, costos y nivel de control.
2. Comparar **al menos tres plataformas** concretas con plan gratuito o educativo vigente: límites, si duermen por inactividad, soporte de bases de datos, HTTPS automático, regiones.
3. Cómo se gestionan variables de entorno y secretos en producción; qué es un gestor de secretos y por qué no basta un `.env`.
4. Qué es un certificado TLS, cómo funciona Let's Encrypt y qué hace HSTS.
5. Qué es un proxy inverso (Nginx, Caddy), por qué va delante de Node.js y qué implica `trust proxy` en Express.
6. Qué es un gestor de procesos (PM2, systemd) y cuándo deja de ser necesario (contenedores, PaaS).
7. Qué es CI/CD; describir un pipeline mínimo con GitHub Actions: `npm ci`, pruebas, auditoría de dependencias y despliegue.
8. Opciones de base de datos gestionada (Neon, Supabase, MongoDB Atlas) y cómo asegurar la conexión (TLS, listas de IP, usuarios con mínimo privilegio).
9. Qué cambia entre desarrollo y producción (`NODE_ENV`, logs, manejo de errores, CORS, cookies).
10. Qué verificaciones de seguridad conviene hacer tras el despliegue y con qué herramientas.

### Estructura sugerida del informe de investigación
- Resumen ejecutivo (media página).
- Respuestas a las preguntas, con citas.
- Tabla comparativa de tres plataformas.
- Plan de despliegue propuesto para SecureVault: plataforma elegida y justificación, arquitectura (diagrama simple), manejo de secretos, base de datos, pipeline.
- Lista de referencias.

---

## 8. Conceptos clave: hash vs. cifrado

**Regla práctica:** si nunca necesitas recuperar el valor original, usa **hash**; si necesitas leerlo de nuevo, usa **cifrado**.

| Dato | Técnica | Motivo |
|---|---|---|
| Contraseña | Hash lento con sal (Argon2id / bcrypt) | Nunca se descifra, solo se compara; lento a propósito contra fuerza bruta |
| Contenido de notas | Cifrado autenticado (AES-256-GCM) | El usuario debe poder leerlo; GCM detecta manipulación |
| Teléfono / documento | Cifrado autenticado (AES-256-GCM) | Se muestra enmascarado o completo al dueño |
| Token de recuperación | Hash rápido SHA-256 | Alta entropía: no necesita hash lento; si roban la BD los tokens no sirven |
| Firma / integridad | HMAC-SHA256 | Verifica que nadie alteró el dato |
| Datos en tránsito | TLS 1.2/1.3 | Protege credenciales y cookies en la red |

### Preguntas de análisis obligatorias en el informe
- ¿Qué ocurre con los datos si se **pierde la llave**?
- ¿Cómo se **rotaría la llave** sin perder la información existente?

*(Orientación: un campo de versión de llave por registro permite re-cifrar de forma gradual; esto además da bonificación.)*

---

## 9. Evaluación (resumen)

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

## 10. Recursos recomendados

- OWASP Top 10:2025 — owasp.org/Top10/2025
- OWASP Cheat Sheet Series: Password Storage, Cryptographic Storage, Authentication, Session Management, Node.js Security, Nodejs Docker — cheatsheetseries.owasp.org
- Módulo `crypto` de Node.js — nodejs.org/api/crypto.html
- Guía de seguridad de Node.js — nodejs.org/en/learn/getting-started/security-best-practices
- Express: seguridad y rendimiento en producción — expressjs.com
- OWASP ZAP — zaproxy.org · Mozilla Observatory / securityheaders.com · Qualys SSL Labs — ssllabs.com/ssltest

---

## 11. Nota ética

Las pruebas de ataque se realizan **únicamente contra la aplicación propia del equipo**. Escanear o atacar sistemas de terceros, incluidas las aplicaciones de otros equipos sin autorización, está **prohibido**.