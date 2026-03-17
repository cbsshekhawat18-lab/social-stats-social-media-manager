import { useNavigate } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';

export default function NoAccessPage() {
  const navigate = useNavigate();
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <ShieldOff size={36} color="#dc2626" />
        </div>
        <h2 style={styles.title}>Access Restricted</h2>
        <p style={styles.sub}>
          You don't have permission to view this page.<br />
          Contact your administrator if you think this is a mistake.
        </p>
        <button onClick={() => navigate(-1)} style={styles.btn}>Go Back</button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
  },
  card: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 20,
    padding: '48px 56px',
    maxWidth: 420,
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(15,23,42,0.08)',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: '#fef2f2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: '#0f172a',
    margin: '0 0 10px',
  },
  sub: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 1.7,
    margin: '0 0 28px',
  },
  btn: {
    padding: '11px 28px',
    background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
};
