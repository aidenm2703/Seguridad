# API & Service Communication Contracts

SecureVault Corp exposes one authenticated REST API on port 3000 and one React/Vite web client on port 5173. Requests are synchronous over HTTP; SMTP is an optional outbound notification channel that never receives encrypted message content.

## Service Catalog

| Service | Port | Category | Purpose |
|---|---:|---|---|
| SecureVault frontend | 5173 | Web client | Login and authenticated workspace UI |
| SecureVault backend | 3000 | API layer | Sessions, authorization, encryption and business workflows |
| PostgreSQL | 5432 | Infrastructure | Encrypted-at-rest application data and sessions |
| SMTP provider | external | Notification | Optional notification for password reset and new messages |

## API Endpoints Inventory

| Service | Method | Path | Request | Response |
|---|---|---|---|---|
| Auth | POST | `/api/auth/login` | email/password | 200 session or generic 401 |
| Auth | POST | `/api/auth/logout` | session cookie | 204 |
| Auth | GET | `/api/auth/me` | session cookie | current user |
| Auth | POST | `/api/auth/password-reset/request` | email | generic 200 |
| Auth | POST | `/api/auth/password-reset/complete` | token/password | 200 or 400 |
| Users | GET/POST | `/api/users` | jefe; user DTO on POST | users or created user |
| Users | PATCH | `/api/users/:id/status` | jefe/isActive | updated status |
| Users | PATCH | `/api/users/:id/role` | jefe/role | updated role |
| Users | GET | `/api/users/events` | jefe | security events |
| Workspace | GET/POST/DELETE | `/api/workspace/summary`, `/api/workspace/activities` | owner-scoped activity DTO | owner-scoped data |
| Private | GET/POST | `/api/private/reports` | owner-scoped report DTO | encrypted report data after authorization |
| Private | GET/POST | `/api/private/payments` | jefe creates; employee reads own | confidential payments |
| Company | GET/POST | `/api/company/announcements` | authenticated; jefe creates | company announcements |
| Messages | GET | `/api/messages/recipients` | authenticated | minimum directory: id/name/position/role |
| Messages | GET | `/api/messages?folder=inbox|sent` | authenticated | decrypted only for current mailbox |
| Messages | POST | `/api/messages` | recipientId/subject/body | message id and timestamp |
| Messages | PATCH | `/api/messages/:id/read` | recipient only | read timestamp or generic 404 |
| Health | GET | `/health` | none | `{ status: ok }` without versions |

## Security Contract

- All functional routes require a PostgreSQL-backed session cookie. The server enforces role checks and ownership checks; frontend menu visibility is not a security boundary.
- Message subject and body are encrypted with AES-256-GCM using a separate `MESSAGE_KEY`, a fresh 12-byte IV per field, and the message UUID as authenticated additional data. The database stores `iv.tag.data` and never stores message plaintext.
- A recipient can read and mark only their own messages. A non-recipient receives a generic 404, avoiding resource existence disclosure.
- SMTP notification text contains only the sender name and a link to the authenticated panel. It does not contain message subject or body.
- This is server-mediated encryption at rest, not end-to-end encryption: the backend can decrypt authorized messages. True E2E would require client key generation, key exchange, device recovery and key rotation.

## Communication Patterns

The browser calls the backend using `fetch` with credentials included. The backend uses parameterized PostgreSQL queries and Zod input validation. The message POST transaction persists ciphertext before attempting the optional SMTP notification; an SMTP failure is logged without exposing message content or failing message persistence. The application has no message broker or retry queue yet, so production SMTP delivery should be moved to a managed queue if reliable notification delivery becomes a requirement.

## Service Technology Matrix

| Service | Web | Data access | Auth | Encryption | Notifications |
|---|---|---|---|---|---|
| Frontend | React/Vite | fetch | session cookie | server-side API contract | none |
| Backend | Express | `pg` | express-session + RBAC | Node AES-256-GCM / Argon2id | Nodemailer SMTP |
| PostgreSQL | database | SQL | database role | ciphertext columns | none |

## Service Communication Sequence

<!-- mermaid-checked: every participant uses `participant Id as "Label"`, no \n in aliases/messages/notes, every alt/opt/loop closed by end, no `:` inside any alias -->
~~~mermaid
sequenceDiagram
    participant Client as "SecureVault Client"
    participant Api as "SecureVault API"
    participant Session as "Session Store"
    participant Database as "PostgreSQL"
    participant Mail as "SMTP Provider"

    Client->>Api: POST /api/messages
    Api->>Session: Validate authenticated session
    Session-->>Api: User identity and role
    Api->>Database: Validate active recipient
    Database-->>Api: Recipient record
    Api->>Api: Encrypt subject and body with MESSAGE_KEY
    Api->>Database: Insert ciphertext message
    Database-->>Api: Message id and timestamp
    opt SMTP configured
        Api-)Mail: Send notification without message content
        Mail-->>Api: Accepted or unavailable
    end
    Api-->>Client: 201 MessageCreated
    Client->>Api: GET /api/messages?folder=inbox
    Api->>Database: Query recipient mailbox
    Database-->>Api: Ciphertext rows
    Api->>Api: Verify GCM tag and decrypt authorized rows
    Api-->>Client: 200 Message list
~~~
