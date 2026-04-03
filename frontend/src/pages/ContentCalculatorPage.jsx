import { FilePenLine, Hash, Sparkles, Type } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';

function MetricCard({ icon: Icon, label, value, hint, color }) {
  return (
    <div style={styles.metricCard}>
      <div style={{ ...styles.metricIcon, background: color + '18', color }}>
        <Icon size={16} />
      </div>
      <div>
        <div style={styles.metricLabel}>{label}</div>
        <div style={styles.metricValue}>{value}</div>
        <div style={styles.metricHint}>{hint}</div>
      </div>
    </div>
  );
}

export default function ContentCalculatorPage({ clientId }) {
  return (
    <div style={styles.page}>
      <PageHeader
        title="Content Calculator"
        subtitle="Plan stronger captions, measure writing length, and prepare post content before publishing."
        actions={<div style={styles.clientBadge}>Client ID: {clientId || 'Not selected'}</div>}
      />

      <div style={styles.metricGrid}>
        <MetricCard
          icon={Type}
          label="Caption Length"
          value="0 chars"
          hint="Ideal for quick draft reviews"
          color="#00d7ff"
        />
        <MetricCard
          icon={Hash}
          label="Hashtag Count"
          value="0 tags"
          hint="Keep platform-specific limits in mind"
          color="#00d7ff"
        />
        <MetricCard
          icon={Sparkles}
          label="Readability"
          value="Ready"
          hint="Use this area for tone and clarity checks"
          color="#059669"
        />
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.cardTitleWrap}>
            <div style={styles.cardIcon}>
              <FilePenLine size={16} />
            </div>
            <div>
              <h3 style={styles.cardTitle}>Draft Workspace</h3>
              <p style={styles.cardSub}>Start with a caption draft or headline here.</p>
            </div>
          </div>
        </div>

        <textarea
          style={styles.textarea}
          placeholder="Write your caption, hook, CTA, or content idea here..."
        />
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  clientBadge: {
    padding: '8px 12px',
    borderRadius: 999,
    background: '#fff',
    border: '1px solid #e6fbff',
    color: '#00d7ff',
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14,
  },
  metricCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 16,
    padding: '16px 18px',
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '.08em',
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0f172a',
    marginBottom: 4,
  },
  metricHint: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 1.5,
  },
  card: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 18,
    padding: 24,
  },
  cardHeader: {
    marginBottom: 16,
  },
  cardTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#e6fbff',
    color: '#00d7ff',
    flexShrink: 0,
  },
  cardTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: '#0f172a',
  },
  cardSub: {
    margin: '4px 0 0',
    fontSize: 12,
    color: '#64748b',
  },
  textarea: {
    width: '100%',
    minHeight: 240,
    resize: 'vertical',
    borderRadius: 14,
    border: '1px solid #dbe5f3',
    padding: '16px 18px',
    fontSize: 14,
    lineHeight: 1.6,
    color: '#0f172a',
    outline: 'none',
    background: '#f0f4f9',
    boxSizing: 'border-box',
  },
};
