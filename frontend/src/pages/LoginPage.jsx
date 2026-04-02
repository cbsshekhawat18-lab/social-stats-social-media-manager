import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { StatoxLogoHorizontal, StatoxMark } from '../components/ui/StatoxLogo';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
const CYAN = '#00d7ff';
const CYAN_SOFT = 'rgba(31, 182, 207, 0.16)';
const CYAN_LINE = 'rgba(31, 182, 207, 0.18)';
const CARD_BG = 'rgba(255, 255, 255, 0.88)';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState('');
  const [hoveredButton, setHoveredButton] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 980);

  const urlError = new URLSearchParams(window.location.search).get('error');

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 980);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'superadmin' || user.role === 'staff' ? '/admin' : '/dashboard');
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    window.location.href = `${API_BASE}/auth/social/google/start/`;
  };

  const handleMicrosoft = () => {
    window.location.href = `${API_BASE}/auth/social/microsoft/start/`;
  };

  const particles = [
    { top: '12%', left: '18%', size: 6, delay: '0s' },
    { top: '26%', left: '62%', size: 5, delay: '0.8s' },
    { top: '41%', left: '33%', size: 4, delay: '1.5s' },
    { top: '57%', left: '74%', size: 6, delay: '2.2s' },
    { top: '72%', left: '22%', size: 5, delay: '1.1s' },
    { top: '81%', left: '54%', size: 4, delay: '2.8s' },
  ];

  return (
    <div style={styles.page(isMobile)}>
      <div style={styles.backgroundFrame} />
      <div style={styles.cornerShapeTop} />
      <div style={styles.cornerShapeBottom} />

      <section style={styles.leftPanel(isMobile)}>
        <div style={styles.gridOverlay} />
        <div style={styles.brandRail}>
          <div style={styles.brandBadge}>
            <span style={styles.brandBadgeDot} />
            Statox.ai
          </div>
          <div style={styles.logoPlate(isMobile)}>
            <StatoxLogoHorizontal height={isMobile ? 28 : 34} />
          </div>
        </div>

        <div style={styles.visualStage}>
          <div style={styles.shapeCluster}>
            <div style={styles.angledShapeLarge} />
            <div style={styles.angledShapeMedium} />
            <div style={styles.angledShapeSmall} />
            <div style={styles.signalLineA} />
            <div style={styles.signalLineB} />
            {particles.map((particle, index) => (
              <span
                key={index}
                style={styles.particle(particle)}
              />
            ))}
          </div>
        </div>

        <div style={styles.copyBlock}>
          <p style={styles.eyebrow}>Automation Intelligence Platform</p>
          <h1 style={styles.heroTitle(isMobile)}>Automate. Analyze. Scale.</h1>
          <p style={styles.heroSub}>
            Run your client growth engine from one command center with reporting,
            publishing, insights, and automation designed for modern SaaS teams.
          </p>
          <div style={styles.metricRow(isMobile)}>
            {[
              { value: '24/7', label: 'Always-on ops' },
              { value: '99.9%', label: 'Signal clarity' },
              { value: '1 Hub', label: 'Unified workflow' },
            ].map((item) => (
              <div key={item.label} style={styles.metricCard}>
                <div style={styles.metricValue}>{item.value}</div>
                <div style={styles.metricLabel}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={styles.rightPanel(isMobile)}>
        <div style={styles.card}>
          <div style={styles.cardGlow} />
          <div style={styles.cardHeader}>
            <div style={styles.cardLogoWrap}>
              <StatoxMark size={38} />
            </div>
            <h2 style={styles.cardTitle}>Welcome Back</h2>
            <p style={styles.cardSub}>Sign in to continue to Statox</p>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <div style={styles.inputWrap(focused === 'email')}>
                <Mail size={16} color={focused === 'email' ? CYAN : '#6B7D85'} strokeWidth={2} style={{ flexShrink: 0 }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused('')}
                  placeholder="you@company.com"
                  required
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.field}>
              <div style={styles.labelRow}>
                <label style={styles.label}>Password</label>
                <button type="button" style={styles.inlineLink}>
                  Forgot Password?
                </button>
              </div>
              <div style={styles.inputWrap(focused === 'password')}>
                <Lock size={16} color={focused === 'password' ? CYAN : '#6B7D85'} strokeWidth={2} style={{ flexShrink: 0 }} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPass(e.target.value)}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused('')}
                  placeholder="Enter your password"
                  required
                  style={styles.input}
                />
              </div>
            </div>

            {(error || urlError) && (
              <div style={styles.errorBox}>
                <span style={styles.errorDot}>!</span>
                {error || decodeURIComponent(urlError)}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={styles.primaryButton(hoveredButton)}
              onMouseEnter={() => setHoveredButton(true)}
              onMouseLeave={() => setHoveredButton(false)}
            >
              {loading ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Signing in...
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div style={styles.dividerRow}>
            <span style={styles.dividerLine} />
            <span style={styles.dividerText}>or continue with</span>
            <span style={styles.dividerLine} />
          </div>

          <div style={styles.socialButtons(isMobile)}>
            <button type="button" onClick={handleGoogle} style={styles.socialBtn}>
              <GoogleIcon />
              Google
            </button>
            <button type="button" onClick={handleMicrosoft} style={styles.socialBtn}>
              <MicrosoftIcon />
              Microsoft
            </button>
          </div>

          <div style={styles.footerRow}>
            <span style={styles.footerText}>Need access to the platform?</span>
            <button type="button" style={styles.inlineLink}>
              Create Account
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

const styles = {
  page: (isMobile) => ({
    minHeight: '100vh',
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    background: '#f0f4f9',
    position: 'relative',
    overflow: 'hidden',
  }),
  backgroundFrame: {
    position: 'absolute',
    inset: 18,
    border: '1px solid rgba(31, 182, 207, 0.14)',
    pointerEvents: 'none',
  },
  cornerShapeTop: {
    position: 'absolute',
    top: -90,
    right: -120,
    width: 420,
    height: 220,
    background: CYAN,
    clipPath: 'polygon(18% 0, 100% 0, 84% 100%, 0 100%)',
    opacity: 0.14,
    filter: 'drop-shadow(0 0 30px rgba(31, 182, 207, 0.25))',
    pointerEvents: 'none',
  },
  cornerShapeBottom: {
    position: 'absolute',
    bottom: -80,
    left: -100,
    width: 340,
    height: 180,
    background: CYAN,
    clipPath: 'polygon(20% 0, 100% 0, 80% 100%, 0 100%)',
    opacity: 0.1,
    pointerEvents: 'none',
  },
  leftPanel: (isMobile) => ({
    flex: isMobile ? '0 0 auto' : '1 1 58%',
    padding: isMobile ? '32px 24px 12px' : '40px 56px 40px 64px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    position: 'relative',
    minHeight: isMobile ? 'auto' : '100vh',
  }),
  gridOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(31, 182, 207, 0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(31, 182, 207, 0.06) 1px, transparent 1px)
    `,
    backgroundSize: '64px 64px',
    maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.04))',
    pointerEvents: 'none',
  },
  brandRail: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    position: 'relative',
    zIndex: 1,
  },
  brandBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    borderRadius: 999,
    border: '1px solid rgba(31, 182, 207, 0.18)',
    color: '#0f6f80',
    fontSize: 12,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    background: 'rgba(255,255,255,0.72)',
    backdropFilter: 'blur(8px)',
  },
  brandBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: CYAN,
    boxShadow: '0 0 12px rgba(31, 182, 207, 0.9)',
  },
  logoPlate: (isMobile) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: isMobile ? '10px 14px' : '12px 16px',
    borderRadius: 18,
    background: 'rgba(255, 255, 255, 0.96)',
    border: '1px solid rgba(31, 182, 207, 0.22)',
    boxShadow: '0 14px 28px rgba(31, 182, 207, 0.12)',
  }),
  visualStage: {
    position: 'relative',
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    minHeight: 280,
    zIndex: 1,
  },
  shapeCluster: {
    position: 'relative',
    width: 'min(100%, 640px)',
    height: 360,
  },
  angledShapeLarge: {
    position: 'absolute',
    top: 20,
    left: 10,
    width: 330,
    height: 110,
    background: CYAN,
    clipPath: 'polygon(12% 0, 100% 0, 88% 100%, 0 100%)',
    opacity: 0.9,
    boxShadow: '0 12px 28px rgba(31, 182, 207, 0.16)',
  },
  angledShapeMedium: {
    position: 'absolute',
    top: 118,
    left: 48,
    width: 250,
    height: 84,
    border: '2px solid rgba(31, 182, 207, 0.65)',
    clipPath: 'polygon(12% 0, 100% 0, 88% 100%, 0 100%)',
    background: 'transparent',
  },
  angledShapeSmall: {
    position: 'absolute',
    top: 210,
    left: 190,
    width: 190,
    height: 64,
    background: 'rgba(31, 182, 207, 0.08)',
    border: '1px solid rgba(31, 182, 207, 0.4)',
    clipPath: 'polygon(12% 0, 100% 0, 88% 100%, 0 100%)',
  },
  signalLineA: {
    position: 'absolute',
    top: 95,
    left: 320,
    width: 220,
    height: 1,
    background: CYAN_LINE,
    boxShadow: '0 0 12px rgba(31, 182, 207, 0.3)',
  },
  signalLineB: {
    position: 'absolute',
    top: 145,
    left: 280,
    width: 270,
    height: 1,
    background: CYAN_LINE,
    boxShadow: '0 0 12px rgba(31, 182, 207, 0.3)',
  },
  particle: ({ top, left, size, delay }) => ({
    position: 'absolute',
    top,
    left,
    width: size,
    height: size,
    borderRadius: '50%',
    background: CYAN,
    opacity: 0.85,
    boxShadow: '0 0 16px rgba(31, 182, 207, 0.6)',
    animation: `pulse-dot 3s ease-in-out ${delay} infinite`,
  }),
  copyBlock: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 620,
  },
  eyebrow: {
    margin: '0 0 14px',
    color: '#12839a',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
  },
  heroTitle: (isMobile) => ({
    margin: '0 0 18px',
    fontSize: isMobile ? 38 : 64,
    lineHeight: 0.95,
    color: '#0f172a',
    fontWeight: 800,
    letterSpacing: '-0.05em',
    maxWidth: 520,
  }),
  heroSub: {
    margin: '0 0 28px',
    fontSize: 16,
    lineHeight: 1.8,
    color: '#5f7280',
    maxWidth: 560,
  },
  metricRow: (isMobile) => ({
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
    gap: 14,
    maxWidth: 640,
  }),
  metricCard: {
    padding: '18px 18px 16px',
    borderRadius: 22,
    border: '1px solid rgba(31, 182, 207, 0.14)',
    background: 'rgba(255,255,255,0.7)',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
    backdropFilter: 'blur(10px)',
  },
  metricValue: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 6,
    letterSpacing: '-0.03em',
  },
  metricLabel: {
    color: '#68808a',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  rightPanel: (isMobile) => ({
    flex: isMobile ? '0 0 auto' : '0 0 42%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: isMobile ? '12px 24px 32px' : '40px 56px 40px 24px',
    position: 'relative',
    zIndex: 1,
  }),
  card: {
    width: '100%',
    maxWidth: 460,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 30,
    padding: '34px 32px 28px',
    background: CARD_BG,
    border: '1px solid rgba(31, 182, 207, 0.22)',
    boxShadow: '0 24px 80px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(31, 182, 207, 0.05)',
    backdropFilter: 'blur(18px)',
    animation: 'fadeInScale 0.35s ease forwards',
  },
  cardGlow: {
    position: 'absolute',
    inset: 0,
    borderRadius: 30,
    boxShadow: 'inset 0 0 0 1px rgba(31, 182, 207, 0.08), 0 0 30px rgba(31, 182, 207, 0.08)',
    pointerEvents: 'none',
  },
  cardHeader: {
    marginBottom: 28,
  },
  cardLogoWrap: {
    width: 62,
    height: 62,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    marginBottom: 18,
    background: 'rgba(245, 254, 255, 0.96)',
    border: '1px solid rgba(31, 182, 207, 0.28)',
    boxShadow: '0 0 24px rgba(31, 182, 207, 0.12)',
  },
  cardTitle: {
    margin: '0 0 8px',
    fontSize: 32,
    fontWeight: 700,
    color: '#0f172a',
    letterSpacing: '-0.04em',
  },
  cardSub: {
    margin: 0,
    fontSize: 15,
    color: '#64748b',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 9,
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#334155',
    letterSpacing: '0.03em',
  },
  inputWrap: (isFocused) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    height: 52,
    padding: '0 16px',
    borderRadius: 16,
    border: `1px solid ${isFocused ? CYAN : 'rgba(148,163,184,0.26)'}`,
    background: isFocused ? 'rgba(255, 255, 255, 0.98)' : 'rgba(248, 250, 252, 0.96)',
    boxShadow: isFocused ? `0 0 0 3px ${CYAN_SOFT}, 0 0 18px rgba(31, 182, 207, 0.12)` : 'none',
    transition: 'all 0.18s ease',
  }),
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#0f172a',
    fontSize: 15,
    fontFamily: 'inherit',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 14px',
    borderRadius: 14,
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    fontSize: 13,
  },
  errorDot: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#EF4444',
    color: '#fff',
    fontSize: 11,
    fontWeight: 800,
    flexShrink: 0,
  },
  primaryButton: (isHovered) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
    width: '100%',
    height: 54,
    border: 'none',
    borderRadius: 16,
    background: CYAN,
    color: '#021418',
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: '0.01em',
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    boxShadow: isHovered ? '0 0 28px rgba(31, 182, 207, 0.38)' : '0 10px 24px rgba(31, 182, 207, 0.18)',
    transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
  }),
  dividerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    margin: '22px 0 18px',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: 'rgba(148,163,184,0.25)',
  },
  dividerText: {
    color: '#64748b',
    fontSize: 12,
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
  },
  socialButtons: (isMobile) => ({
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
    gap: 10,
  }),
  socialBtn: {
    height: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    border: '1px solid rgba(148,163,184,0.22)',
    background: 'rgba(255,255,255,0.92)',
    color: '#0f172a',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.18s ease',
  },
  footerRow: {
    marginTop: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  footerText: {
    color: '#64748b',
    fontSize: 13,
  },
  inlineLink: {
    border: 'none',
    background: 'transparent',
    color: CYAN,
    padding: 0,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
