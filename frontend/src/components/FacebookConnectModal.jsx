/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/* =============================================================================
 * FacebookConnectModal
 * -----------------------------------------------------------------------------
 * Permissions consent modal shown BEFORE the Facebook OAuth redirect.
 *
 * Why this exists:
 *   Meta App Review (Developer Policy 1.6) requires an explicit, in-app
 *   "informed consent" step where the user can see and approve each scope
 *   the app will request. This modal makes that step visible in the
 *   submission screencast: required-vs-optional split, plain-English
 *   descriptions, technical scope names in tooltips, and a Continue button
 *   that stays disabled until the user has reviewed all required items.
 *
 * Two integration modes:
 *
 *   1. Controlled (used by ConnectedAccounts in this app):
 *        <FacebookConnectModal
 *          open={open}
 *          onClose={() => setOpen(false)}
 *          onContinue={(scope) => { window.location.href = oauthStartUrl; }}
 *        />
 *      Parent controls visibility. On Continue, the modal calls
 *      onContinue(scope, checkedMap) — parent handles the redirect.
 *
 *   2. Self-contained (uses Facebook JS SDK directly):
 *        <FacebookConnectModal
 *          appName="Social Stats"
 *          onConnect={(token, user) => { ... }}
 *        />
 *      Renders its own trigger, calls window.FB.login() on Continue.
 * ===========================================================================*/

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { BrandMark } from './ui/BrandLogo';

const FB_APP_ID = 'YOUR_FACEBOOK_APP_ID';
const FB_API_VERSION = 'v21.0';

const REQUIRED_PERMISSIONS = [
  {
    scope: 'pages_show_list',
    label: 'Access your Facebook Pages list',
    description:
      "We'll show the Pages you manage so you can choose which one to connect.",
    technical:
      'Meta scope pages_show_list: returns the list of Pages the user is an admin of via /me/accounts.',
  },
  {
    scope: 'pages_read_engagement',
    label: 'Read Page engagement data',
    description:
      "We'll display your followers, likes, and post performance metrics in your dashboard.",
    technical:
      'Meta scope pages_read_engagement: read fan_count, followers_count, post insights, and reactions on a Page.',
  },
  {
    scope: 'instagram_manage_insights',
    label: 'Read Instagram insights',
    description:
      "We'll connect your linked Instagram Business account and pull engagement, reach, and impressions metrics for your dashboard.",
    technical:
      'Meta scope instagram_manage_insights: read insights (engagement, reach, impressions, profile visits, follower demographics) for a linked IG Business account.',
  },
];

// Optional permissions hidden for now — backend doesn't request these scopes,
// so showing them in the consent UI would mislead users about what we ask for.
// To re-enable: add entries here and the divider + optional list will render.
const OPTIONAL_PERMISSIONS = [];

const ALL_PERMISSIONS = [...REQUIRED_PERMISSIONS, ...OPTIONAL_PERMISSIONS];

// All checkboxes default to checked. Required ones must stay checked to
// proceed; optional ones the user can opt out of.
const buildInitialChecked = () =>
  ALL_PERMISSIONS.reduce((acc, p) => {
    acc[p.scope] = true;
    return acc;
  }, {});

let _fbSdkPromise = null;
function loadFacebookSdk(appId, version) {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.FB) return Promise.resolve(window.FB);
  if (_fbSdkPromise) return _fbSdkPromise;

  _fbSdkPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = function () {
      window.FB.init({ appId, cookie: true, xfbml: false, version });
      resolve(window.FB);
    };
    const id = 'facebook-jssdk';
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.onerror = () => reject(new Error('Failed to load Facebook SDK'));
    document.body.appendChild(script);
  });

  return _fbSdkPromise;
}

export default function FacebookConnectModal({
  open: controlledOpen,
  onClose,
  onContinue,
  onConnect,
  onError,
  appName = 'our app',
}) {
  const isControlled = typeof controlledOpen === 'boolean';

  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;

  const [checked, setChecked] = useState(buildInitialChecked);
  const [sdkReady, setSdkReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [openTooltip, setOpenTooltip] = useState(null);

  const dialogRef = useRef(null);
  const lastFocusedRef = useRef(null);
  const firstFocusableRef = useRef(null);

  const allRequiredChecked = useMemo(
    () => REQUIRED_PERMISSIONS.every((p) => checked[p.scope]),
    [checked]
  );

  // Only load the FB SDK when we'll actually call FB.login() (no onContinue).
  const useSdk = !onContinue;

  useEffect(() => {
    if (!useSdk) {
      setSdkReady(true);
      return undefined;
    }
    let cancelled = false;
    loadFacebookSdk(FB_APP_ID, FB_API_VERSION)
      .then(() => {
        if (!cancelled) setSdkReady(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMsg('Could not load Facebook. Please refresh and try again.');
          if (onError) onError(err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [useSdk, onError]);

  const handleOpen = useCallback(() => {
    lastFocusedRef.current =
      typeof document !== 'undefined' ? document.activeElement : null;
    setErrorMsg('');
    setChecked(buildInitialChecked());
    setInternalOpen(true);
  }, []);

  const closeAndNotify = useCallback(() => {
    if (!isControlled) setInternalOpen(false);
    setOpenTooltip(null);
    setSubmitting(false);
    if (lastFocusedRef.current && lastFocusedRef.current.focus) {
      lastFocusedRef.current.focus();
    }
    if (onClose) onClose();
  }, [isControlled, onClose]);

  // Reset checkbox state whenever a controlled-open transitions to true
  useEffect(() => {
    if (isControlled && controlledOpen) {
      setChecked(buildInitialChecked());
      setErrorMsg('');
      setOpenTooltip(null);
    }
  }, [isControlled, controlledOpen]);

  // Escape key + focus trap + body scroll lock
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeAndNotify();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    requestAnimationFrame(() => {
      if (firstFocusableRef.current) firstFocusableRef.current.focus();
    });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, closeAndNotify]);

  const toggle = (scope) => {
    setChecked((prev) => ({ ...prev, [scope]: !prev[scope] }));
  };

  const buildScope = () =>
    ALL_PERMISSIONS.filter((p) => checked[p.scope])
      .map((p) => p.scope)
      .join(',');

  const handleContinue = () => {
    setErrorMsg('');
    if (!allRequiredChecked) return;

    const scope = buildScope();

    if (onContinue) {
      onContinue(scope, { ...checked });
      return;
    }

    if (!sdkReady || !window.FB) {
      setErrorMsg('Loading Facebook…');
      return;
    }
    setSubmitting(true);
    window.FB.login(
      (response) => {
        if (response && response.authResponse) {
          const token = response.authResponse.accessToken;
          window.FB.api(
            '/me',
            { fields: 'id,name,email,picture' },
            (userResp) => {
              setSubmitting(false);
              if (userResp && !userResp.error) {
                if (onConnect) onConnect(token, userResp);
                closeAndNotify();
              } else {
                const message =
                  (userResp && userResp.error && userResp.error.message) ||
                  'Could not fetch your profile.';
                setErrorMsg(message);
                if (onError) onError(userResp && userResp.error);
              }
            }
          );
        } else {
          setSubmitting(false);
          const message =
            response && response.status === 'not_authorized'
              ? 'You denied one or more required permissions.'
              : 'Facebook login was canceled.';
          setErrorMsg(message);
          if (onError) onError(response);
        }
      },
      { scope, return_scopes: true, auth_type: 'rerequest' }
    );
  };

  const continueDisabled =
    !allRequiredChecked ||
    submitting ||
    (useSdk && !sdkReady);

  const continueLabel = submitting
    ? 'Connecting…'
    : useSdk && !sdkReady
    ? 'Loading Facebook…'
    : 'Continue with Facebook';

  return (
    <>
      {!isControlled && (
        <button
          type="button"
          onClick={handleOpen}
          aria-label="Connect Facebook and Instagram"
          style={styles.triggerBtn}
        >
          <FbGlyph size={16} />
          Connect Facebook &amp; Instagram
        </button>
      )}

      {open && (
        <div role="presentation" style={styles.overlay}>
          <div onClick={closeAndNotify} aria-hidden="true" style={styles.backdrop} />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="fb-connect-title"
            aria-describedby="fb-connect-desc"
            style={styles.dialog}
          >
            <div style={styles.header}>
              <button
                ref={firstFocusableRef}
                type="button"
                onClick={closeAndNotify}
                aria-label="Close dialog"
                style={styles.closeBtn}
              >
                <CloseGlyph />
              </button>
              <div style={styles.appLogoWrap}>
                <BrandMark size={48} />
              </div>
              <h2 id="fb-connect-title" style={styles.title}>
                Connect Your Facebook &amp; Instagram
              </h2>
              <p id="fb-connect-desc" style={styles.subtitle}>
                To continue, please review and approve the permissions below.
                You&apos;ll be redirected to Facebook to confirm.
              </p>
            </div>

            <div style={styles.body}>
              <SectionLabel>Required Permissions</SectionLabel>
              <ul style={styles.list}>
                {REQUIRED_PERMISSIONS.map((p) => (
                  <PermissionRow
                    key={p.scope}
                    perm={p}
                    required
                    checked={checked[p.scope]}
                    onToggle={() => toggle(p.scope)}
                    tooltipOpen={openTooltip === p.scope}
                    onTooltipToggle={() =>
                      setOpenTooltip(openTooltip === p.scope ? null : p.scope)
                    }
                  />
                ))}
              </ul>

              {OPTIONAL_PERMISSIONS.length > 0 && (
                <>
                  <div style={styles.divider}>
                    <span style={styles.dividerLine} />
                    <span style={styles.dividerText}>Optional</span>
                    <span style={styles.dividerLine} />
                  </div>

                  <SectionLabel>Optional Permissions</SectionLabel>
                  <ul style={styles.list}>
                    {OPTIONAL_PERMISSIONS.map((p) => (
                      <PermissionRow
                        key={p.scope}
                        perm={p}
                        checked={checked[p.scope]}
                        onToggle={() => toggle(p.scope)}
                        tooltipOpen={openTooltip === p.scope}
                        onTooltipToggle={() =>
                          setOpenTooltip(openTooltip === p.scope ? null : p.scope)
                        }
                      />
                    ))}
                  </ul>
                </>
              )}

              {errorMsg && (
                <div role="alert" style={styles.errorBox}>
                  {errorMsg}
                </div>
              )}
            </div>

            <div style={styles.footer}>
              <div style={styles.btnRow}>
                <button
                  type="button"
                  onClick={closeAndNotify}
                  aria-label="Cancel and close dialog"
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={continueDisabled}
                  aria-label="Continue with Facebook login"
                  aria-disabled={continueDisabled}
                  style={
                    continueDisabled
                      ? styles.continueBtnDisabled
                      : styles.continueBtn
                  }
                >
                  {(submitting || (useSdk && !sdkReady)) && <Spinner />}
                  {continueLabel}
                </button>
              </div>
              <p style={styles.legalNote}>
                By continuing, you agree to our{' '}
                <a href="/terms" style={styles.legalLink}>Terms of Service</a>{' '}
                and{' '}
                <a href="/privacy" style={styles.legalLink}>Privacy Policy</a>
                . You can revoke access anytime in your Facebook settings.
              </p>
            </div>
          </div>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes fbModalFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes fbModalSlideUp {
              from { opacity: 0; transform: translateY(8px) scale(0.98); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes fbModalSpin { to { transform: rotate(360deg); } }
          `,
        }}
      />
    </>
  );
}

function SectionLabel({ children }) {
  return <h3 style={styles.sectionLabel}>{children}</h3>;
}

function PermissionRow({ perm, required = false, checked, onToggle, tooltipOpen, onTooltipToggle }) {
  const inputId = `fb-perm-${perm.scope}`;
  return (
    <li>
      <label
        htmlFor={inputId}
        style={{ ...styles.row, ...(checked ? styles.rowChecked : {}) }}
      >
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-describedby={`${inputId}-desc`}
          style={styles.checkbox}
        />
        <div style={styles.rowBody}>
          <div style={styles.rowHead}>
            <span style={styles.rowLabel}>{perm.label}</span>
            {required && (
              <span aria-label="required" style={styles.requiredStar}>*</span>
            )}
            <code style={styles.scopeName}>{perm.scope}</code>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTooltipToggle();
              }}
              aria-label={`Technical info about ${perm.scope}`}
              aria-expanded={tooltipOpen}
              style={styles.infoBtn}
            >
              <InfoGlyph />
            </button>
          </div>
          <p id={`${inputId}-desc`} style={styles.rowDesc}>
            {perm.description}
          </p>
          {tooltipOpen && <p style={styles.tooltip}>{perm.technical}</p>}
        </div>
      </label>
    </li>
  );
}

function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'fbModalSpin 1s linear infinite' }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function FbGlyph({ size = 16 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 12a10 10 0 10-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0022 12z" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function InfoGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

const FB_BLUE = '#1877F2';
const FB_BLUE_DARK = '#166FE5';

const styles = {
  triggerBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '10px 18px', borderRadius: 10, border: 'none',
    background: FB_BLUE, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(24,119,242,0.25)', WebkitTapHighlightColor: 'transparent',
  },
  overlay: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  backdrop: { position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)', animation: 'fbModalFadeIn 150ms ease-out' },
  dialog: {
    position: 'relative', zIndex: 1, width: '100%', maxWidth: 500, maxHeight: '92vh',
    display: 'flex', flexDirection: 'column', background: 'var(--surface-card)', borderRadius: 20,
    boxShadow: '0 24px 64px rgba(0,0,0,0.28)', overflow: 'hidden',
    animation: 'fbModalSlideUp 180ms ease-out',
  },
  header: { position: 'relative', padding: '28px 24px 18px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center' },
  closeBtn: {
    position: 'absolute', top: 12, right: 12, width: 32, height: 32, border: 'none',
    background: 'transparent', borderRadius: 999, cursor: 'pointer', color: 'var(--text-tertiary)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  appLogoWrap: {
    width: 64, height: 64, margin: '0 auto 12px', borderRadius: 18,
    background: 'rgba(245, 254, 255, 0.96)', border: '1px solid rgba(31, 182, 207, 0.28)',
    boxShadow: '0 4px 16px rgba(31, 182, 207, 0.18)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  title: { margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' },
  subtitle: { margin: 0, fontSize: 13.5, color: 'var(--text-tertiary)', lineHeight: 1.55 },
  body: { flex: 1, overflowY: 'auto', padding: '18px 24px' },
  sectionLabel: { margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' },
  list: { listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 8 },
  row: {
    display: 'flex', gap: 12, padding: 12, borderRadius: 12,
    border: '1px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', transition: 'all 0.15s ease',
  },
  rowChecked: { border: '1px solid #bfdbfe', background: 'rgba(239,246,255,0.6)' },
  checkbox: { marginTop: 2, width: 16, height: 16, accentColor: FB_BLUE, cursor: 'pointer', flexShrink: 0 },
  rowBody: { flex: 1, minWidth: 0 },
  rowHead: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  rowLabel: { fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' },
  requiredStar: { color: '#ef4444', fontWeight: 700 },
  scopeName: {
    fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    color: 'var(--text-tertiary)', background: 'var(--surface-sunken)', padding: '1px 6px', borderRadius: 4,
  },
  infoBtn: {
    marginLeft: 'auto', width: 22, height: 22, border: 'none', background: 'transparent',
    borderRadius: 999, cursor: 'pointer', color: 'var(--text-tertiary)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  rowDesc: { margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.5 },
  tooltip: {
    margin: '8px 0 0', padding: '8px 10px', background: '#0f172a',
    color: '#e2e8f0', fontSize: 11.5, lineHeight: 1.55, borderRadius: 8,
  },
  divider: { display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' },
  dividerLine: { flex: 1, height: 1, background: '#e2e8f0' },
  dividerText: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' },
  errorBox: {
    marginTop: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca',
    color: '#b91c1c', fontSize: 13, borderRadius: 10,
  },
  footer: { padding: '14px 24px 18px', background: 'var(--surface-sunken)', borderTop: '1px solid var(--border-subtle)' },
  btnRow: { display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  cancelBtn: {
    padding: '10px 16px', border: '1px solid #cbd5e1', background: 'var(--surface-card)',
    borderRadius: 10, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer',
  },
  continueBtn: {
    padding: '10px 18px', border: 'none', background: FB_BLUE, color: '#fff',
    borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 8,
    boxShadow: '0 2px 8px rgba(24,119,242,0.3)',
  },
  continueBtnDisabled: {
    padding: '10px 18px', border: 'none', background: '#cbd5e1', color: 'var(--text-tertiary)',
    borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'not-allowed',
    display: 'inline-flex', alignItems: 'center', gap: 8,
  },
  legalNote: { margin: '12px 0 0', fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.55, textAlign: 'center' },
  legalLink: { color: '#2563eb', textDecoration: 'underline' },
};

export { FB_BLUE, FB_BLUE_DARK };
