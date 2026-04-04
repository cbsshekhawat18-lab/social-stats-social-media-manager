const PLATFORM_ALIASES = {
  google: 'google',
  google_my_business: 'google_my_business',
  gmb: 'google_my_business',
};

function normalizePlatform(platform) {
  if (!platform) return 'default';
  return PLATFORM_ALIASES[platform] || platform;
}

function SvgWrap({ size, title, children, viewBox = '0 0 24 24', style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : 'presentation'}
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export default function SocialPlatformIcon({ platform, size = 18, title, style }) {
  const key = normalizePlatform(platform);

  switch (key) {
    case 'facebook':
      return (
        <SvgWrap size={size} title={title || 'Facebook'} style={style}>
          <path fill="#1877F2" d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.885v2.27h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
        </SvgWrap>
      );
    case 'instagram':
      return (
        <SvgWrap size={size} title={title || 'Instagram'} style={style}>
          <defs>
            <linearGradient id="statox-instagram-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F58529" />
              <stop offset="35%" stopColor="#DD2A7B" />
              <stop offset="70%" stopColor="#8134AF" />
              <stop offset="100%" stopColor="#515BD4" />
            </linearGradient>
          </defs>
          <rect x="2.25" y="2.25" width="19.5" height="19.5" rx="5.5" fill="url(#statox-instagram-gradient)" />
          <circle cx="12" cy="12" r="4.25" fill="none" stroke="#fff" strokeWidth="1.9" />
          <circle cx="17.3" cy="6.9" r="1.15" fill="#fff" />
          <rect x="6.1" y="6.1" width="11.8" height="11.8" rx="3.6" fill="none" stroke="#fff" strokeWidth="1.9" />
        </SvgWrap>
      );
    case 'youtube':
      return (
        <SvgWrap size={size} title={title || 'YouTube'} style={style}>
          <rect x="2" y="5" width="20" height="14" rx="4.5" fill="#FF0000" />
          <path fill="#fff" d="M10 9.2v5.6l5-2.8-5-2.8z" />
        </SvgWrap>
      );
    case 'linkedin':
      return (
        <SvgWrap size={size} title={title || 'LinkedIn'} style={style}>
          <rect width="24" height="24" rx="4.5" fill="#0A66C2" />
          <rect x="5.2" y="9.2" width="2.5" height="9.2" fill="#fff" />
          <circle cx="6.45" cy="6.55" r="1.45" fill="#fff" />
          <path fill="#fff" d="M10 9.2h2.4v1.25h.03c.33-.63 1.14-1.55 2.95-1.55 3.16 0 3.75 2.08 3.75 4.78v4.7h-2.5V14.2c0-1-.02-2.29-1.39-2.29-1.4 0-1.61 1.09-1.61 2.22v4.27H10V9.2z" />
        </SvgWrap>
      );
    case 'google':
      return (
        <SvgWrap size={size} title={title || 'Google'} style={style} viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </SvgWrap>
      );
    case 'google_my_business':
      return (
        <SvgWrap size={size} title={title || 'Google My Business'} style={style}>
          <path fill="#4285F4" d="M4.5 8.2h15l2.6 3.3v8.8a2.7 2.7 0 0 1-2.7 2.7H7.2a2.7 2.7 0 0 1-2.7-2.7V8.2z" />
          <path fill="#34A853" d="M2 7.8 4.4 4h15.2L22 7.8H2z" />
          <path fill="#FBBC04" d="M9.1 10.2h5.8v10.1H9.1z" />
          <path fill="#fff" d="M12 12.1a3.1 3.1 0 1 0 0 6.2c1.2 0 2.1-.45 2.85-1.2l-1.15-.95c-.42.4-.95.7-1.7.7-1.45 0-2.5-1.2-2.5-2.6s1.05-2.6 2.5-2.6c.83 0 1.42.32 1.74.62l1-1.02c-.62-.6-1.53-1.17-2.59-1.17z" />
          <circle cx="18.3" cy="13.2" r="1.25" fill="#EA4335" />
        </SvgWrap>
      );
    default:
      return (
        <SvgWrap size={size} title={title || 'Platform'} style={style}>
          <circle cx="12" cy="12" r="10" fill="#CBD5E1" />
          <path fill="#fff" d="M12 6.5a5.5 5.5 0 0 0-5.44 4.75h2.05a3.6 3.6 0 1 1 .01 1.5H6.56A5.5 5.5 0 1 0 12 6.5z" />
        </SvgWrap>
      );
  }
}
