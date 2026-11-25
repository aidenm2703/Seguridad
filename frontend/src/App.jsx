import { useState } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react'
import './App.css'

function App() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    setNotice('La validación de acceso estará disponible al conectar el servicio seguro.')
  }

  return (
    <main className="auth-shell">
      <div className="auth-grid" aria-hidden="true" />
      <section className="brand-panel" aria-label="SecureVault Corp">
        <div className="brand-lockup"><span className="brand-mark"><ShieldCheck size={20} strokeWidth={2.5} /></span><span>SecureVault <b>Corp</b></span></div>
        <div className="brand-message"><p className="eyebrow">Sistema interno · acceso protegido</p><h1>Tu información,<br /><em>bajo control.</em></h1><p className="brand-copy">Un espacio privado para trabajar con claridad, confianza y la protección que tu equipo necesita.</p></div>
        <div className="security-note"><LockKeyhole size={17} aria-hidden="true" /><span>Conexión cifrada y monitoreada</span></div>
      </section>
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-card">
          <div className="mobile-brand brand-lockup"><span className="brand-mark"><ShieldCheck size={20} strokeWidth={2.5} /></span><span>SecureVault <b>Corp</b></span></div>
          <div className="login-heading"><p className="eyebrow">Bienvenido de vuelta</p><h2 id="login-title">Iniciar sesión</h2><p>Ingresa con las credenciales asignadas por tu administrador.</p></div>
          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="email">Correo corporativo</label>
            <input id="email" name="email" type="email" autoComplete="username" placeholder="nombre@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <div className="field-label-row"><label htmlFor="password">Contraseña</label><a href="#recuperar">¿La olvidaste?</a></div>
            <div className="password-field"><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Ingresa tu contraseña" value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" className="icon-button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            <button className="submit-button" type="submit">Entrar al sistema <ArrowRight size={18} aria-hidden="true" /></button>
            <p className="form-notice" role="status" aria-live="polite">{notice}</p>
          </form>
          <p className="admin-note">¿Necesitas acceso? Solicítalo a tu jefe o administrador.</p>
        </div>
        <footer className="login-footer"><span>© 2026 SecureVault Corp</span><span className="status-dot"><i /> Sistemas operativos</span></footer>
      </section>
    </main>
  )
}

export default App
