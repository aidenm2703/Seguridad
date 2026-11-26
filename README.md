# SecureVault Corp

Sistema interno para gestionar información corporativa con separación de roles, sesiones seguras y cifrado de datos privados.

## Requisitos

- Node.js 22 LTS
- PostgreSQL 16+
- Una base de datos creada para SecureVault

## Configuración local

1. Copia `backend/.env.example` a `backend/.env` y genera valores únicos para las llaves. No subas ese archivo.
2. Instala dependencias en `backend/` y `frontend/` con `npm ci`.
3. Ejecuta `npm run migrate` dentro de `backend/`.
4. Define `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NAME` solo en el entorno local o gestor de secretos y ejecuta `npm run seed`.
5. Inicia el backend con `npm run dev` y el frontend con `npm run dev`.

## Variables

Los nombres requeridos están documentados en [backend/.env.example](./backend/.env.example) y [frontend/.env.example](./frontend/.env.example). Los valores nunca se almacenan en el repositorio.

## Seguridad implementada

- Argon2id para contraseñas.
- AES-256-GCM con IV aleatorio, AAD y versiones de llave.
- Llave privada separada para pagos y documentos confidenciales.
- Cookies de sesión HttpOnly, SameSite y Secure en producción.
- Validación con Zod, consultas parametrizadas, CSP/Helmet, CORS restringido y rate limiting.
- Autorización server-side y filtros por `owner_id` para prevenir IDOR.
- Bitácora de accesos, cambios de rol y acciones sensibles sin guardar secretos.
- Mensajería interna con AES-256-GCM y llave separada (`MESSAGE_KEY`), aislamiento por remitente/destinatario y versión de llave.
- Notificaciones SMTP con TLS 1.2+ que solo incluyen un aviso y un enlace; el contenido sensible permanece dentro del panel autenticado.

La mensajería implementa cifrado en reposo y control de acceso server-side, no cifrado de extremo a extremo. El backend puede descifrar mensajes autorizados para entregarlos y auditarlos; E2E requeriría gestión de claves por dispositivo y recuperación segura.

Las actividades se asignan exclusivamente desde el rol `jefe`. El empleado solo puede ver sus actividades autorizadas y marcarlas como hechas; cada finalización genera un reporte para el jefe y una notificación SMTP opcional. Las agendas cifran título, descripción y fechas con AES-256-GCM, y el jefe puede publicar una actividad para todos los calendarios o para una selección explícita.

Las pruebas de seguridad deben ejecutarse únicamente contra la aplicación propia del equipo.
