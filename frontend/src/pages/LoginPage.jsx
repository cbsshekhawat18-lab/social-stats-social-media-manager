import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { StatoxLogoHorizontal, StatoxMark } from '../components/ui/StatoxLogo';
import SocialPlatformIcon from '../components/ui/SocialPlatformIcon';

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
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState('');
  const [hoveredButton, setHoveredButton] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 980);
  const [accepted, setAccepted] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const urlError = searchParams.get('error');
  const nextPath  = searchParams.get('next');

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 980);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const validateForm = () => {
    const nextErrors = {};
    if (!email.trim()) nextErrors.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(email)) nextErrors.email = 'Enter a valid email address.';
    if (!password.trim()) nextErrors.password = 'Password is required.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleEmailChange = (value) => {
    setEmail(value);
    setErrors((prev) => {
      if (!prev.email) return prev;
      const next = { ...prev };
      delete next.email;
      return next;
    });
  };

  const handlePasswordChange = (value) => {
    setPass(value);
    setErrors((prev) => {
      if (!prev.password) return prev;
      const next = { ...prev };
      delete next.password;
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;
    setLoading(true);
    try {
      const user = await login(email, password, accepted);
      if (nextPath) {
        navigate(nextPath, { replace: true });
      } else if (user.role === 'superadmin' || user.role === 'staff') {
        navigate('/admin');
      } else if (user.role === 'client' && !user.client_id) {
        navigate('/pending');
      } else if (user.role === 'client' && !user.onboarding_complete) {
        navigate('/dashboard/onboarding');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail === 'email_not_verified') {
        setError('Please verify your email before signing in. Check your inbox for the verification link.');
      } else {
        setError('Invalid email or password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    window.location.href = `${API_BASE}/auth/social/google/start/`;
  };

  const handleFacebook = () => {
    window.location.href = `${API_BASE}/auth/social/facebook/start/`;
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
            StatoX.ai
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
        <div style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}>
          <div style={styles.cardGlow} />
          <div style={styles.cardHeader}>
            <div style={styles.cardLogoWrap}>
              <StatoxMark size={38} />
            </div>
            <h2 style={styles.cardTitle}>Welcome Back</h2>
            <p style={styles.cardSub}>Sign in to continue to StatoX</p>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Email <span style={{ color: '#ef4444', marginLeft: 2, fontWeight: 800 }}>*</span></label>
              <div style={styles.inputWrap(focused === 'email', !!errors.email)}>
                <Mail size={16} color={focused === 'email' ? CYAN : '#6B7D85'} strokeWidth={2} style={{ flexShrink: 0 }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused('')}
                  placeholder="you@company.com"
                  style={styles.input}
                />
              </div>
              {errors.email && <div style={styles.fieldError}>{errors.email}</div>}
            </div>

            <div style={styles.field}>
              <div style={styles.labelRow}>
                <label style={styles.label}>Password <span style={{ color: '#ef4444', marginLeft: 2, fontWeight: 800 }}>*</span></label>
                <a href="/forgot-password" style={{ ...styles.inlineLink, textDecoration: 'none' }}>
                  Forgot Password?
                </a>
              </div>
              <div style={styles.inputWrap(focused === 'password', !!errors.password)}>
                <Lock size={16} color={focused === 'password' ? CYAN : '#6B7D85'} strokeWidth={2} style={{ flexShrink: 0 }} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused('')}
                  placeholder="Enter your password"
                  style={styles.input}
                />
              </div>
              {errors.password && <div style={styles.fieldError}>{errors.password}</div>}
            </div>

            {(error || urlError) && (
              <div style={styles.errorBox}>
                <span style={styles.errorDot}>!</span>
                {error || decodeURIComponent(urlError)}
              </div>
            )}

            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={e => setAccepted(e.target.checked)}
                style={styles.checkbox}
              />
              <span style={styles.checkboxText}>
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noreferrer" style={styles.checkboxLink}>Terms of Service</a>
                {' '}and{' '}
                <a href="/privacy" target="_blank" rel="noreferrer" style={styles.checkboxLink}>Privacy Policy</a>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !accepted}
              style={styles.primaryButton(hoveredButton && accepted)}
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
              <SocialPlatformIcon platform="google" size={18} />
              Google
            </button>
            <button type="button" onClick={handleFacebook} style={styles.socialBtn}>
              <SocialPlatformIcon platform="facebook" size={18} />
              Facebook
            </button>
          </div>

          <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: '#64748b' }}>
            New user?{' '}
            <a href="/signup" style={{ color: CYAN, fontWeight: 600, textDecoration: 'none' }}>Create an account</a>
          </p>

        </div>
      </section>
    </div>
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
    alignItems: isMobile ? 'flex-end' : 'center',
    justifyContent: 'center',
    padding: isMobile ? '0' : '40px 56px 40px 24px',
    position: 'relative',
    zIndex: 1,
    ...(isMobile ? { flex: 1 } : {}),
  }),
  card: {
    width: '100%',
    maxWidth: 420,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    padding: '48px 40px',
    background: CARD_BG,
    border: '1px solid rgba(31, 182, 207, 0.22)',
    boxShadow: '0 24px 80px rgba(15, 23, 42, 0.14)',
    backdropFilter: 'blur(18px)',
    animation: 'fadeInScale 0.35s ease forwards',
  },
  cardMobile: {
    position: 'fixed',
    bottom: 0, left: 0, right: 0,
    maxWidth: '100%',
    borderRadius: '24px 24px 0 0',
    padding: '32px 24px',
    boxShadow: '0 -12px 40px rgba(15, 23, 42, 0.18)',
    animation: 'slideUp 0.3s ease forwards',
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
  inputWrap: (isFocused, hasError = false) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    height: 52,
    padding: '0 16px',
    borderRadius: 16,
    border: `1px solid ${hasError ? '#ef4444' : (isFocused ? CYAN : 'rgba(148,163,184,0.26)')}`,
    background: isFocused ? 'rgba(255, 255, 255, 0.98)' : 'rgba(248, 250, 252, 0.96)',
    boxShadow: hasError
      ? '0 0 0 3px rgba(239, 68, 68, 0.12)'
      : (isFocused ? `0 0 0 3px ${CYAN_SOFT}, 0 0 18px rgba(31, 182, 207, 0.12)` : 'none'),
    transition: 'all 0.18s ease',
  }),
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#0f172a',
    fontSize: 16,
    fontFamily: 'inherit',
  },
  fieldError: {
    marginTop: 6,
    fontSize: 12,
    color: '#dc2626',
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
    minHeight: 50,
    height: 54,
    border: 'none',
    borderRadius: 14,
    background: CYAN,
    color: '#021418',
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: '0.01em',
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    boxShadow: isHovered ? '0 0 28px rgba(31, 182, 207, 0.38)' : '0 10px 24px rgba(31, 182, 207, 0.18)',
    transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
    WebkitTapHighlightColor: 'transparent',
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
    minHeight: 50,
    height: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    border: '1px solid rgba(148,163,184,0.22)',
    background: 'rgba(255,255,255,0.92)',
    color: '#0f172a',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    WebkitTapHighlightColor: 'transparent',
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
  checkboxRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    cursor: 'pointer',
  },
  checkbox: {
    marginTop: 2,
    width: 16,
    height: 16,
    accentColor: CYAN,
    flexShrink: 0,
    cursor: 'pointer',
  },
  checkboxText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 1.5,
  },
  checkboxLink: {
    color: CYAN,
    textDecoration: 'none',
    fontWeight: 600,
  },
};
