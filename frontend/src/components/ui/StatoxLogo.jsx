import iconStatox from '../../assets/icon_statox.png';
import logoStatox from '../../assets/logo_statox.png';
import logoStatoxBig from '../../assets/logo_statox_big.png';
import logoStatoxSmall from '../../assets/logo_statox_small.png';

function LogoImage({ src, alt, className, style }) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{
        display: 'block',
        width: 'auto',
        height: '100%',
        objectFit: 'contain',
        ...style,
      }}
    />
  );
}

export function StatoxMark({ size = 40, className, style: extraStyle }) {
  return (
    <LogoImage
      src={iconStatox}
      alt="STATOX icon"
      className={className}
      style={{
        height: size,
        ...extraStyle,
      }}
    />
  );
}

export function StatoxWordmark({ height = 22, className, style: extraStyle }) {
  return (
    <LogoImage
      src={logoStatoxSmall}
      alt="STATOX"
      className={className}
      style={{
        height,
        ...extraStyle,
      }}
    />
  );
}

export function StatoxLogoHorizontal({ height = 36, className, style: extraStyle }) {
  return (
    <LogoImage
      src={logoStatox}
      alt="STATOX"
      className={className}
      style={{
        height,
        ...extraStyle,
      }}
    />
  );
}

export function StatoxLogoStacked({ height = 100, className, style: extraStyle }) {
  return (
    <LogoImage
      src={logoStatoxBig}
      alt="STATOX"
      className={className}
      style={{
        height,
        ...extraStyle,
      }}
    />
  );
}

export function StatoxMarkInverted({ size = 40, className, style: extraStyle }) {
  return (
    <LogoImage
      src={iconStatox}
      alt="STATOX icon"
      className={className}
      style={{
        height: size,
        filter: 'brightness(0) invert(1)',
        ...extraStyle,
      }}
    />
  );
}
