/**
 * SignupPage — /signup?invite=TOKEN
 * Email/password signup for clients only.
 * Also supports Google social signup.
 * After submit → shows "Check your email" success state.
 */
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authAPI, invitationAPI } from '../services/api';
import {
  Mail, Lock, User as UserIcon, ArrowRight, Loader2,
  Eye, EyeOff, CheckCircle, Building2, RefreshCw,
} from 'lucide-react';
import { StatoxLogoHorizontal, StatoxMark } from '../components/ui/StatoxLogo';
import SocialPlatformIcon from '../components/ui/SocialPlatformIcon';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
const CYAN      = '#00d7ff';
const CYAN_SOFT = 'rgba(31, 182, 207, 0.16)';
const CYAN_LINE = 'rgba(31, 182, 207, 0.18)';
const CARD_BG   = 'rgba(255, 255, 255, 0.88)';

export default function SignupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const params   = new URLSearchParams(window.location.search);
  const inviteToken = params.get('invite');

  // Invitation preview
  const [inv, setInv]               = useState(null);

  // Form state
  const [fullName, setFullName]     = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [accepted, setAccepted]     = useState(false);
  const [showPwd, setShowPwd]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused, setFocused]       = useState('');
  const [errors, setErrors]         = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading]       = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState(false);

  // Success state
  const [done, setDone]           = useState(false);
  const [resending, setResending] = useState(false);
  const [resentMsg, setResentMsg] = useState('');

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 980);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 980);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Redirect already-logged-in users
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  // Fetch invitation preview
  useEffect(() => {
    if (!inviteToken) return;
    invitationAPI.getByToken(inviteToken)
      .then(res => setInv(res.data))
      .catch(() => {});
    localStorage.setItem('pending_invite_token', inviteToken);
  }, [inviteToken]);

  const clearFieldError = (field) => {
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev }; delete next[field]; return next;
    });
  };

  const validate = () => {
    const e = {};
    if (!fullName.trim()) e.fullName = 'Full name is required.';
    if (!email.trim()) e.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email address.';
    if (!password) e.password = 'Password is required.';
    else if (password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (!confirmPwd) e.confirmPwd = 'Please confirm your password.';
    else if (password !== confirmPwd) e.confirmPwd = 'Passwords do not match.';
    if (!accepted) e.terms = 'You must accept the Terms of Service.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;
    setLoading(true);
    try {
      await authAPI.signup({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        terms_accepted: true,
      });
      setDone(true);
    } catch (err) {
      const data = err?.response?.data;
      if (data?.errors) {
        const mapped = {};
        if (data.errors.full_name) mapped.fullName = data.errors.full_name;
        if (data.errors.email)     mapped.email    = data.errors.email;
        if (data.errors.password)  mapped.password = data.errors.password;
        setErrors(mapped);
      } else {
        setServerError(data?.detail || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResentMsg('');
    try {
      await authAPI.resendVerification(email);
      setResentMsg('A new verification email has been sent.');
    } catch {
      setResentMsg('Could not resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleGoogle = () => {
    if (inviteToken) localStorage.setItem('pending_invite_token', inviteToken);
    window.location.href = `${API_BASE}/auth/social/google/start/`;
  };

  const handleFacebook = () => {
    if (inviteToken) localStorage.setItem('pending_invite_token', inviteToken);
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

      {/* Left branding panel */}
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
            {particles.map((p, i) => (
              <span key={i} style={styles.particle(p)} />
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
            ].map(item => (
              <div key={item.label} style={styles.metricCard}>
                <div style={styles.metricValue}>{item.value}</div>
                <div style={styles.metricLabel}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Right panel — card */}
      <section style={styles.rightPanel(isMobile)}>
        <div style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}>
          <div style={styles.cardGlow} />

          {done ? (
            /* ── Success state ── */
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={styles.successIcon}>
                <CheckCircle size={36} color={CYAN} />
              </div>
              <h2 style={{ ...styles.cardTitle, marginBottom: 10 }}>Check your inbox</h2>
              <p style={{ color: '#64748b', fontSize: 15, lineHeight: 1.6, margin: '0 0 24px' }}>
                We sent a verification link to <strong style={{ color: '#0f172a' }}>{email}</strong>.
                Click it to activate your account.
              </p>
              <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 20px' }}>
                Didn't receive it? Check your spam folder or request a new link.
              </p>
              <button
                onClick={handleResend}
                disabled={resending}
                style={styles.resendBtn}
              >
                {resending
                  ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  : <RefreshCw size={14} />
                }
                {resending ? 'Sending...' : 'Resend verification email'}
              </button>
              {resentMsg && (
                <p style={{ marginTop: 12, fontSize: 13, color: resentMsg.includes('sent') ? '#16a34a' : '#dc2626' }}>
                  {resentMsg}
                </p>
              )}
              <p style={{ marginTop: 24, fontSize: 13, color: '#94a3b8' }}>
                <Link to="/login" style={{ color: CYAN, fontWeight: 600, textDecoration: 'none' }}>
                  Back to Sign In
                </Link>
              </p>
            </div>
          ) : (
            /* ── Signup form ── */
            <>
              <div style={styles.cardHeader}>
                <div style={styles.cardLogoWrap}>
                  <StatoxMark size={38} />
                </div>
                <h2 style={styles.cardTitle}>Create your account</h2>
                <p style={styles.cardSub}>Sign up to get started with StatoX</p>
              </div>

              {/* Invitation banner */}
              {inv && !inv.is_expired && inv.status === 'pending' && (
                <div style={styles.invBanner}>
                  <Building2 size={18} color="#7c3aed" />
                  <div>
                    <span style={styles.invLabel}>Invited by</span>
                    <span style={styles.invAgency}>{inv.agency_name}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} style={styles.form}>
                {/* Full Name */}
                <div style={styles.field}>
                  <label style={styles.label}>
                    Full Name <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>
                  </label>
                  <div style={styles.inputWrap(focused === 'name', !!errors.fullName)}>
                    <UserIcon size={16} color={focused === 'name' ? CYAN : '#6B7D85'} strokeWidth={2} style={{ flexShrink: 0 }} />
                    <input
                      type="text"
                      value={fullName}
                      onChange={e => { setFullName(e.target.value); clearFieldError('fullName'); }}
                      onFocus={() => setFocused('name')}
                      onBlur={() => setFocused('')}
                      placeholder="Jane Smith"
                      style={styles.input}
                    />
                  </div>
                  {errors.fullName && <div style={styles.fieldError}>{errors.fullName}</div>}
                </div>

                {/* Email */}
                <div style={styles.field}>
                  <label style={styles.label}>
                    Email <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>
                  </label>
                  <div style={styles.inputWrap(focused === 'email', !!errors.email)}>
                    <Mail size={16} color={focused === 'email' ? CYAN : '#6B7D85'} strokeWidth={2} style={{ flexShrink: 0 }} />
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); clearFieldError('email'); }}
                      onFocus={() => setFocused('email')}
                      onBlur={() => setFocused('')}
                      placeholder="you@company.com"
                      style={styles.input}
                    />
                  </div>
                  {errors.email && <div style={styles.fieldError}>{errors.email}</div>}
                </div>

                {/* Password */}
                <div style={styles.field}>
                  <label style={styles.label}>
                    Password <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>
                  </label>
                  <div style={styles.inputWrap(focused === 'pwd', !!errors.password)}>
                    <Lock size={16} color={focused === 'pwd' ? CYAN : '#6B7D85'} strokeWidth={2} style={{ flexShrink: 0 }} />
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={e => { setPassword(e.target.value); clearFieldError('password'); }}
                      onFocus={() => setFocused('pwd')}
                      onBlur={() => setFocused('')}
                      placeholder="At least 8 characters"
                      style={styles.input}
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)} style={styles.eyeBtn}>
                      {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {errors.password && <div style={styles.fieldError}>{errors.password}</div>}
                </div>

                {/* Confirm Password */}
                <div style={styles.field}>
                  <label style={styles.label}>
                    Confirm Password <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>
                  </label>
                  <div style={styles.inputWrap(focused === 'confirm', !!errors.confirmPwd)}>
                    <Lock size={16} color={focused === 'confirm' ? CYAN : '#6B7D85'} strokeWidth={2} style={{ flexShrink: 0 }} />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPwd}
                      onChange={e => { setConfirmPwd(e.target.value); clearFieldError('confirmPwd'); }}
                      onFocus={() => setFocused('confirm')}
                      onBlur={() => setFocused('')}
                      placeholder="Re-enter your password"
                      style={styles.input}
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {errors.confirmPwd && <div style={styles.fieldError}>{errors.confirmPwd}</div>}
                </div>

                {serverError && (
                  <div style={styles.errorBox}>
                    <span style={styles.errorDot}>!</span>
                    {serverError}
                  </div>
                )}

                {/* Terms */}
                <label style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={e => { setAccepted(e.target.checked); clearFieldError('terms'); }}
                    style={styles.checkbox}
                  />
                  <span style={styles.checkboxText}>
                    I agree to the{' '}
                    <a href="/terms" target="_blank" rel="noreferrer" style={styles.checkboxLink}>Terms of Service</a>
                    {' '}and{' '}
                    <a href="/privacy" target="_blank" rel="noreferrer" style={styles.checkboxLink}>Privacy Policy</a>
                  </span>
                </label>
                {errors.terms && <div style={styles.fieldError}>{errors.terms}</div>}

                <button
                  type="submit"
                  disabled={loading || !accepted}
                  style={styles.primaryButton(hoveredBtn && accepted)}
                  onMouseEnter={() => setHoveredBtn(true)}
                  onMouseLeave={() => setHoveredBtn(false)}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      Creating account...
                    </>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              <div style={styles.dividerRow}>
                <span style={styles.dividerLine} />
                <span style={styles.dividerText}>or sign up with</span>
                <span style={styles.dividerLine} />
              </div>

              <div style={styles.socialRow}>
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
                Already have an account?{' '}
                <Link to="/login" style={{ color: CYAN, fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
              </p>
            </>
          )}
        </div>
      </section>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.85; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.97) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
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
    position: 'absolute', inset: 18,
    border: '1px solid rgba(31, 182, 207, 0.14)', pointerEvents: 'none',
  },
  cornerShapeTop: {
    position: 'absolute', top: -90, right: -120, width: 420, height: 220,
    background: CYAN, clipPath: 'polygon(18% 0, 100% 0, 84% 100%, 0 100%)',
    opacity: 0.14, filter: 'drop-shadow(0 0 30px rgba(31, 182, 207, 0.25))', pointerEvents: 'none',
  },
  cornerShapeBottom: {
    position: 'absolute', bottom: -80, left: -100, width: 340, height: 180,
    background: CYAN, clipPath: 'polygon(20% 0, 100% 0, 80% 100%, 0 100%)',
    opacity: 0.1, pointerEvents: 'none',
  },
  leftPanel: (isMobile) => ({
    flex: isMobile ? '0 0 auto' : '1 1 58%',
    padding: isMobile ? '32px 24px 12px' : '40px 56px 40px 64px',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    position: 'relative', minHeight: isMobile ? 'auto' : '100vh',
  }),
  gridOverlay: {
    position: 'absolute', inset: 0,
    backgroundImage: `
      linear-gradient(rgba(31, 182, 207, 0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(31, 182, 207, 0.06) 1px, transparent 1px)
    `,
    backgroundSize: '64px 64px',
    maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.04))',
    pointerEvents: 'none',
  },
  brandRail: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 20, position: 'relative', zIndex: 1,
  },
  brandBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', borderRadius: 999,
    border: '1px solid rgba(31, 182, 207, 0.18)', color: '#0f6f80',
    fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase',
    background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(8px)',
  },
  brandBadgeDot: {
    width: 7, height: 7, borderRadius: '50%', background: CYAN,
    boxShadow: '0 0 12px rgba(31, 182, 207, 0.9)',
  },
  logoPlate: (isMobile) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: isMobile ? '10px 14px' : '12px 16px', borderRadius: 18,
    background: 'rgba(255, 255, 255, 0.96)', border: '1px solid rgba(31, 182, 207, 0.22)',
    boxShadow: '0 14px 28px rgba(31, 182, 207, 0.12)',
  }),
  visualStage: {
    position: 'relative', flex: 1, display: 'flex', alignItems: 'center', minHeight: 200, zIndex: 1,
  },
  shapeCluster: { position: 'relative', width: 'min(100%, 640px)', height: 280 },
  angledShapeLarge: {
    position: 'absolute', top: 20, left: 10, width: 330, height: 110,
    background: CYAN, clipPath: 'polygon(12% 0, 100% 0, 88% 100%, 0 100%)',
    opacity: 0.9, boxShadow: '0 12px 28px rgba(31, 182, 207, 0.16)',
  },
  angledShapeMedium: {
    position: 'absolute', top: 118, left: 48, width: 250, height: 84,
    border: '2px solid rgba(31, 182, 207, 0.65)',
    clipPath: 'polygon(12% 0, 100% 0, 88% 100%, 0 100%)', background: 'transparent',
  },
  angledShapeSmall: {
    position: 'absolute', top: 200, left: 190, width: 190, height: 64,
    background: 'rgba(31, 182, 207, 0.08)', border: '1px solid rgba(31, 182, 207, 0.4)',
    clipPath: 'polygon(12% 0, 100% 0, 88% 100%, 0 100%)',
  },
  signalLineA: {
    position: 'absolute', top: 95, left: 320, width: 220, height: 1,
    background: CYAN_LINE, boxShadow: '0 0 12px rgba(31, 182, 207, 0.3)',
  },
  signalLineB: {
    position: 'absolute', top: 145, left: 280, width: 270, height: 1,
    background: CYAN_LINE, boxShadow: '0 0 12px rgba(31, 182, 207, 0.3)',
  },
  particle: ({ top, left, size, delay }) => ({
    position: 'absolute', top, left, width: size, height: size, borderRadius: '50%',
    background: CYAN, opacity: 0.85, boxShadow: '0 0 16px rgba(31, 182, 207, 0.6)',
    animation: `pulse-dot 3s ease-in-out ${delay} infinite`,
  }),
  copyBlock: { position: 'relative', zIndex: 1, maxWidth: 620 },
  eyebrow: {
    margin: '0 0 14px', color: '#12839a', fontSize: 12, fontWeight: 600,
    letterSpacing: '0.18em', textTransform: 'uppercase',
  },
  heroTitle: (isMobile) => ({
    margin: '0 0 18px', fontSize: isMobile ? 38 : 64, lineHeight: 0.95,
    color: '#0f172a', fontWeight: 800, letterSpacing: '-0.05em', maxWidth: 520,
  }),
  heroSub: { margin: '0 0 28px', fontSize: 16, lineHeight: 1.8, color: '#5f7280', maxWidth: 560 },
  metricRow: (isMobile) => ({
    display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
    gap: 14, maxWidth: 640,
  }),
  metricCard: {
    padding: '18px 18px 16px', borderRadius: 22,
    border: '1px solid rgba(31, 182, 207, 0.14)',
    background: 'rgba(255,255,255,0.7)', boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
    backdropFilter: 'blur(10px)',
  },
  metricValue: { color: '#0f172a', fontSize: 24, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.03em' },
  metricLabel: { color: '#68808a', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em' },
  rightPanel: (isMobile) => ({
    flex: isMobile ? '1' : '0 0 42%',
    display: 'flex',
    alignItems: isMobile ? 'flex-end' : 'center',
    justifyContent: 'center',
    padding: isMobile ? '0' : '40px 56px 40px 24px',
    position: 'relative', zIndex: 1,
  }),
  card: {
    width: '100%', maxWidth: 420, position: 'relative', overflow: 'hidden',
    borderRadius: 24, padding: '48px 40px', background: CARD_BG,
    border: '1px solid rgba(31, 182, 207, 0.22)',
    boxShadow: '0 24px 80px rgba(15, 23, 42, 0.14)',
    backdropFilter: 'blur(18px)', animation: 'fadeInScale 0.35s ease forwards',
  },
  cardMobile: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    maxWidth: '100%', borderRadius: '24px 24px 0 0',
    padding: '32px 24px',
    boxShadow: '0 -12px 40px rgba(15, 23, 42, 0.18)',
    animation: 'slideUp 0.3s ease forwards',
  },
  cardGlow: {
    position: 'absolute', inset: 0, borderRadius: 30,
    boxShadow: 'inset 0 0 0 1px rgba(31, 182, 207, 0.08), 0 0 30px rgba(31, 182, 207, 0.08)',
    pointerEvents: 'none',
  },
  cardHeader: { marginBottom: 20 },
  cardLogoWrap: {
    width: 62, height: 62, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 20, marginBottom: 18, background: 'rgba(245, 254, 255, 0.96)',
    border: '1px solid rgba(31, 182, 207, 0.28)', boxShadow: '0 0 24px rgba(31, 182, 207, 0.12)',
  },
  cardTitle: { margin: '0 0 8px', fontSize: 28, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.04em' },
  cardSub:   { margin: 0, fontSize: 15, color: '#64748b' },
  invBanner: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10,
    padding: '10px 14px', marginBottom: 16,
  },
  invLabel:  { display: 'block', fontSize: 11, color: '#7c3aed', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' },
  invAgency: { display: 'block', fontSize: 14, fontWeight: 700, color: '#0f172a' },
  form:      { display: 'flex', flexDirection: 'column', gap: 14 },
  field:     { display: 'flex', flexDirection: 'column', gap: 7 },
  label:     { fontSize: 13, fontWeight: 600, color: '#334155', letterSpacing: '0.03em' },
  inputWrap: (isFocused, hasError = false) => ({
    display: 'flex', alignItems: 'center', gap: 10, height: 48, padding: '0 14px',
    borderRadius: 14,
    border: `1px solid ${hasError ? '#ef4444' : (isFocused ? CYAN : 'rgba(148,163,184,0.26)')}`,
    background: isFocused ? 'rgba(255,255,255,0.98)' : 'rgba(248,250,252,0.96)',
    boxShadow: hasError
      ? '0 0 0 3px rgba(239, 68, 68, 0.12)'
      : (isFocused ? `0 0 0 3px ${CYAN_SOFT}, 0 0 18px rgba(31,182,207,0.12)` : 'none'),
    transition: 'all 0.18s ease',
  }),
  input: {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    color: '#0f172a', fontSize: 16, fontFamily: 'inherit',
  },
  eyeBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2,
    display: 'flex', alignItems: 'center',
  },
  fieldError: { marginTop: 4, fontSize: 12, color: '#dc2626' },
  errorBox: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
    borderRadius: 14, background: '#fef2f2', border: '1px solid #fecaca',
    color: '#b91c1c', fontSize: 13,
  },
  errorDot: {
    width: 18, height: 18, borderRadius: '50%', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', background: '#EF4444',
    color: '#fff', fontSize: 11, fontWeight: 800, flexShrink: 0,
  },
  checkboxRow:  { display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' },
  checkbox:     { marginTop: 2, width: 16, height: 16, accentColor: CYAN, flexShrink: 0, cursor: 'pointer' },
  checkboxText: { fontSize: 13, color: '#64748b', lineHeight: 1.5 },
  checkboxLink: { color: CYAN, textDecoration: 'none', fontWeight: 600 },
  primaryButton: (isHovered) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 4, width: '100%', minHeight: 50, height: 52, border: 'none', borderRadius: 14,
    background: CYAN, color: '#021418', fontSize: 16, fontWeight: 800,
    letterSpacing: '0.01em', cursor: 'pointer', transition: 'all 0.18s ease',
    boxShadow: isHovered ? '0 0 28px rgba(31, 182, 207, 0.38)' : '0 10px 24px rgba(31, 182, 207, 0.18)',
    transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
    WebkitTapHighlightColor: 'transparent',
  }),
  dividerRow: { display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0 14px' },
  dividerLine: { flex: 1, height: 1, background: 'rgba(148,163,184,0.25)' },
  dividerText: { color: '#64748b', fontSize: 12, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.14em' },
  socialRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  socialBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 50, height: 48, background: 'rgba(255,255,255,0.92)',
    border: '1px solid rgba(148,163,184,0.22)', borderRadius: 14,
    fontSize: 16, fontWeight: 600, color: '#0f172a', cursor: 'pointer',
    transition: 'all 0.18s ease',
    WebkitTapHighlightColor: 'transparent',
  },
  successIcon: {
    width: 72, height: 72, borderRadius: '50%', background: 'rgba(0, 215, 255, 0.08)',
    border: '2px solid rgba(0, 215, 255, 0.3)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', margin: '0 auto 24px',
  },
  resendBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '10px 20px', borderRadius: 12, border: `1.5px solid ${CYAN}`,
    background: 'rgba(0,215,255,0.06)', color: '#0a7a8f', fontSize: 13,
    fontWeight: 600, cursor: 'pointer',
  },
};
