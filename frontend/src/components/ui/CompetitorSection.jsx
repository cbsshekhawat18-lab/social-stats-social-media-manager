import { Building2, Link2, Plus, Sparkles, Trash2, Trophy } from 'lucide-react';

export default function CompetitorSection({
  competitors = [],
  socialPlatforms = [],
  onAddCompetitor,
  onUpdateCompetitor,
  onRemoveCompetitor,
  onAddLink,
  onUpdateLink,
  onRemoveLink,
  maxCompetitors = 3,
  title = 'Competitors',
  subtitle = 'Add a few key competitors so we can understand your market and shape smarter content.',
}) {
  return (
    <div style={styles.shell}>
      <div style={styles.hero}>
        <div style={styles.heroIcon}>
          <Trophy size={18} />
        </div>
        <div>
          <div style={styles.heroTitle}>{title}</div>
          <p style={styles.heroText}>{subtitle}</p>
        </div>
      </div>

      {competitors.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyBadge}>
            <Sparkles size={16} />
            Competitive Snapshot
          </div>
          <h3 style={styles.emptyTitle}>Start with one competitor</h3>
          <p style={styles.emptyText}>
            Add the brands your audience also watches so the onboarding and settings stay useful later.
          </p>
          <button type="button" onClick={onAddCompetitor} style={styles.primaryAddBtn}>
            <Plus size={16} />
            Add Competitor
          </button>
        </div>
      ) : (
        <div style={styles.cardStack}>
          {competitors.map((competitor, index) => (
            <section key={index} style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={styles.cardHeaderMain}>
                  <div style={styles.cardIndex}>{String(index + 1).padStart(2, '0')}</div>
                  <div>
                    <div style={styles.cardTitle}>Competitor Profile</div>
                    <div style={styles.cardSubtitle}>Track brand name and the channels they use most.</div>
                  </div>
                </div>
                <button type="button" onClick={() => onRemoveCompetitor(index)} style={styles.removeCompetitorBtn}>
                  <Trash2 size={14} />
                  Remove competitor
                </button>
              </div>

              <div style={styles.nameField}>
                <label style={styles.label}>
                  <Building2 size={14} />
                  Competitor Name <span style={styles.requiredAsterisk}>*</span>
                </label>
                <input
                  type="text"
                  value={competitor.name}
                  onChange={(e) => onUpdateCompetitor(index, 'name', e.target.value)}
                  style={styles.input}
                  placeholder="Competitor company name"
                />
              </div>

              <div style={styles.linkPanel}>
                <div style={styles.linkPanelHeader}>
                  <div>
                    <div style={styles.linkPanelTitle}>Social Links</div>
                    <div style={styles.linkPanelText}>Keep these neat and scannable. One row per channel works best.</div>
                  </div>
                  <button type="button" onClick={() => onAddLink(index)} style={styles.addLinkBtn}>
                    <Plus size={14} />
                    Add link
                  </button>
                </div>

                <div style={styles.linkList}>
                  {(competitor.social_links || []).map((link, linkIndex) => (
                    <div key={`${index}-${linkIndex}`} style={styles.linkRow}>
                      <div style={styles.selectField}>
                        <label style={styles.subLabel}>Platform</label>
                        <select
                          value={link.platform}
                          onChange={(e) => onUpdateLink(index, linkIndex, 'platform', e.target.value)}
                          style={styles.select}
                        >
                          {socialPlatforms.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div style={styles.urlField}>
                        <label style={styles.subLabel}>
                          <Link2 size={13} />
                          Profile URL
                        </label>
                        <input
                          type="url"
                          value={link.url}
                          onChange={(e) => onUpdateLink(index, linkIndex, 'url', e.target.value)}
                          style={styles.input}
                          placeholder="https://instagram.com/competitor"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveLink(index, linkIndex)}
                        style={styles.removeLinkBtn}
                        aria-label="Remove link"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      {competitors.length > 0 && competitors.length < maxCompetitors && (
        <button type="button" onClick={onAddCompetitor} style={styles.secondaryAddBtn}>
          <Plus size={16} />
          Add Another Competitor
        </button>
      )}
    </div>
  );
}

const styles = {
  shell: {
    display: 'grid',
    gap: 18,
  },
  hero: {
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
    padding: '18px 20px',
    borderRadius: 18,
    background: 'linear-gradient(135deg, #ecfeff 0%, #f8fafc 55%, #eef2ff 100%)',
    border: '1px solid #c7f3ff',
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    background: 'linear-gradient(135deg, #00d7ff 0%, #0ea5e9 100%)',
    color: '#042f3a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 8px 18px rgba(14,165,233,.18)',
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: '#0f172a',
  },
  heroText: {
    margin: '6px 0 0',
    fontSize: 13,
    lineHeight: 1.6,
    color: '#64748b',
    maxWidth: 720,
  },
  emptyState: {
    padding: '30px 26px',
    borderRadius: 22,
    border: '1px dashed #bae6fd',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
    textAlign: 'center',
  },
  emptyBadge: {
    display: 'inline-flex',
    gap: 8,
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: 999,
    background: '#ecfeff',
    color: '#0f766e',
    fontSize: 12,
    fontWeight: 700,
  },
  emptyTitle: {
    margin: '14px 0 8px',
    fontSize: 22,
    fontWeight: 800,
    color: '#0f172a',
  },
  emptyText: {
    margin: '0 auto 18px',
    maxWidth: 540,
    fontSize: 14,
    lineHeight: 1.65,
    color: '#64748b',
  },
  cardStack: {
    display: 'grid',
    gap: 18,
  },
  card: {
    display: 'grid',
    gap: 18,
    padding: 22,
    borderRadius: 22,
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    boxShadow: '0 10px 26px rgba(15,23,42,.05)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },
  cardHeaderMain: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  cardIndex: {
    width: 42,
    height: 42,
    borderRadius: 14,
    background: '#f1f5f9',
    color: '#0f172a',
    fontSize: 13,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: '#0f172a',
  },
  cardSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
  },
  label: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 700,
    color: '#334155',
    marginBottom: 8,
  },
  requiredAsterisk: {
    color: '#ef4444',
    fontWeight: 800,
  },
  subLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 700,
    color: '#64748b',
    marginBottom: 6,
  },
  nameField: {
    display: 'grid',
    gap: 6,
  },
  input: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '13px 14px',
    borderRadius: 14,
    border: '1.5px solid #dbe4ee',
    background: '#fff',
    color: '#0f172a',
    fontSize: 14,
    outline: 'none',
  },
  select: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '13px 14px',
    borderRadius: 14,
    border: '1.5px solid #dbe4ee',
    background: '#fff',
    color: '#0f172a',
    fontSize: 14,
    outline: 'none',
    cursor: 'pointer',
  },
  linkPanel: {
    display: 'grid',
    gap: 14,
    padding: 18,
    borderRadius: 18,
    background: 'linear-gradient(180deg, #fbfdff 0%, #f8fafc 100%)',
    border: '1px solid #e2e8f0',
  },
  linkPanelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },
  linkPanelTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: '#0f172a',
  },
  linkPanelText: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
  },
  linkList: {
    display: 'grid',
    gap: 12,
  },
  linkRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(160px, 220px) minmax(0, 1fr) auto',
    gap: 12,
    alignItems: 'end',
  },
  selectField: {
    minWidth: 0,
  },
  urlField: {
    minWidth: 0,
  },
  primaryAddBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 18px',
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(135deg, #00d7ff 0%, #38bdf8 100%)',
    color: '#042f3a',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryAddBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 18px',
    borderRadius: 14,
    border: '1.5px dashed #94dfff',
    background: '#f8fdff',
    color: '#0369a1',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  addLinkBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#0f172a',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  removeCompetitorBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid #fecaca',
    background: '#fff5f5',
    color: '#dc2626',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  removeLinkBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#dc2626',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
};
