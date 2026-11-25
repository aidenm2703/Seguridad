import { useEffect, useState } from 'react'
import { ArrowRight, Bell, CalendarDays, CheckCircle2, ChevronRight, Clock3, LogOut, Plus, ShieldCheck, Users } from 'lucide-react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...options.headers } })
  const payload = response.status === 204 ? null : await response.json()
  if (!response.ok) { const error = new Error(payload?.error || 'No se pudo completar la operación'); error.status = response.status; throw error }
  return payload
}

function Login({ onAuthenticated }) {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault(); setLoading(true); setNotice('')
    try { const { user } = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); onAuthenticated(user) }
    catch (error) { setNotice(error.message === 'Failed to fetch' || error.status >= 500 ? 'El servicio seguro no está disponible. Verifica PostgreSQL y el backend.' : 'Credenciales inválidas. Verifica tus datos e inténtalo de nuevo.') }
    finally { setLoading(false) }
  }

  return <main className="auth-shell"><div className="auth-grid" aria-hidden="true" /><section className="brand-panel" aria-label="SecureVault Corp"><div className="brand-lockup"><span className="brand-mark"><ShieldCheck size={20} strokeWidth={2.5} /></span><span>SecureVault <b>Corp</b></span></div><div className="brand-message"><p className="eyebrow">Sistema interno · acceso protegido</p><h1>Tu información,<br /><em>bajo control.</em></h1><p className="brand-copy">Un espacio privado para trabajar con claridad, confianza y la protección que tu equipo necesita.</p></div><div className="security-note"><ShieldCheck size={17} aria-hidden="true" /><span>Conexión cifrada y monitoreada</span></div></section><section className="login-panel" aria-labelledby="login-title"><div className="login-card"><div className="mobile-brand brand-lockup"><span className="brand-mark"><ShieldCheck size={20} strokeWidth={2.5} /></span><span>SecureVault <b>Corp</b></span></div><div className="login-heading"><p className="eyebrow">Bienvenido de vuelta</p><h2 id="login-title">Iniciar sesión</h2><p>Ingresa con las credenciales asignadas por tu administrador.</p></div><form onSubmit={handleSubmit} noValidate><label htmlFor="email">Correo corporativo</label><input id="email" name="email" type="email" autoComplete="username" placeholder="nombre@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} required /><div className="field-label-row"><label htmlFor="password">Contraseña</label><a href="#recuperar">¿La olvidaste?</a></div><div className="password-field"><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Ingresa tu contraseña" value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" className="icon-button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? 'Ocultar' : 'Ver'}</button></div><button className="submit-button" type="submit" disabled={loading}>{loading ? 'Validando…' : <>Entrar al sistema <ArrowRight size={18} aria-hidden="true" /></>}</button><p className="form-notice" role="status" aria-live="polite">{notice}</p></form><p className="admin-note">¿Necesitas acceso? Solicítalo a tu jefe o administrador.</p></div><footer className="login-footer"><span>© 2026 SecureVault Corp</span><span className="status-dot"><i /> Sistemas operativos</span></footer></section></main>
}

function Dashboard({ user, onLogout }) {
  const [summary, setSummary] = useState({ activities: [], announcements: [] })
  const [error, setError] = useState('')
  useEffect(() => { api('/api/workspace/summary').then(setSummary).catch(() => setError('No se pudo cargar la información del espacio de trabajo.')) }, [])
  const greeting = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 18 ? 'Buenas tardes' : 'Buenas noches'
  return <main className="dashboard-shell"><header className="topbar"><div className="brand-lockup"><span className="brand-mark"><ShieldCheck size={19} /></span><span>SecureVault <b>Corp</b></span></div><div className="topbar-actions"><button className="notification-button" aria-label="Notificaciones"><Bell size={18} /><i /></button><div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div><div className="user-summary"><strong>{user.name}</strong><span>{user.role === 'jefe' ? 'Jefe' : 'Empleado'}</span></div><button className="logout-button" onClick={onLogout} aria-label="Cerrar sesión"><LogOut size={17} /></button></div></header><div className="dashboard-content"><aside className="side-nav"><p className="nav-caption">Espacio de trabajo</p><a className="active" href="#resumen"><CalendarDays size={17} /> Mi día</a><a href="#anuncios"><Bell size={17} /> Anuncios</a>{user.role === 'jefe' && <><p className="nav-caption">Administración</p><a href="#equipo"><Users size={17} /> Equipo</a><a href="#seguridad"><ShieldCheck size={17} /> Seguridad</a></>}</aside><section className="workspace"><div className="welcome-row"><div><p className="eyebrow">{greeting}</p><h1>{user.name}</h1><p className="workspace-subtitle">Aquí tienes un resumen de lo que necesita tu atención.</p></div><button className="primary-action"><Plus size={17} /> Nueva actividad</button></div>{error && <p className="dashboard-error" role="alert">{error}</p>}<div className="stats-grid"><article className="stat-card"><span>Actividades de hoy</span><strong>{summary.activities.length}</strong><small><CheckCircle2 size={14} /> Organiza tu jornada</small></article><article className="stat-card"><span>Próximo pendiente</span><strong>{summary.activities[0]?.status || '—'}</strong><small><Clock3 size={14} /> En tu calendario</small></article><article className="stat-card"><span>Acceso</span><strong>Seguro</strong><small><ShieldCheck size={14} /> Sesión protegida</small></article></div><div className="dashboard-columns"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Tu agenda</p><h2>Actividades del día</h2></div><a href="#calendario">Ver calendario <ChevronRight size={15} /></a></div>{summary.activities.length ? <div className="activity-list">{summary.activities.map((activity) => <article className="activity-item" key={activity.id}><span className={`activity-status ${activity.status}`} /><div><strong>{activity.title}</strong><p>{activity.description || 'Sin descripción'}</p></div><time>{new Date(activity.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></article>)}</div> : <div className="empty-state"><CalendarDays size={22} /><p>Aún no tienes actividades para hoy.</p><button className="text-action">Crear la primera <ArrowRight size={14} /></button></div>}</section><section className="panel announcements-panel"><div className="panel-heading"><div><p className="eyebrow">Comunicaciones</p><h2>Anuncios recientes</h2></div><a href="#anuncios">Ver todos <ChevronRight size={15} /></a></div>{summary.announcements.length ? summary.announcements.map((announcement) => <article className="announcement" key={announcement.id}><span>{announcement.pinned ? 'Fijado' : 'General'}</span><h3>{announcement.title}</h3><p>{announcement.body}</p></article>) : <div className="empty-state"><Bell size={22} /><p>No hay anuncios nuevos.</p></div>}</section></div></section></div></main>
}

function App() {
  const [user, setUser] = useState(null)
  useEffect(() => { api('/api/auth/me').then(({ user: currentUser }) => setUser(currentUser)).catch(() => {}) }, [])
  async function logout() { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); setUser(null) }
  return user ? <Dashboard user={user} onLogout={logout} /> : <Login onAuthenticated={setUser} />
}

export default App
