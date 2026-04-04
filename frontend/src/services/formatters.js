export function formatTimeAgo(dateStr, options = {}) {
  const { includeSeconds = true, empty = '—' } = options;

  if (!dateStr) return empty;

  const timestamp = new Date(dateStr).getTime();
  if (Number.isNaN(timestamp)) return empty;

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (includeSeconds && diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return `${Math.floor(diffHours / 24)}d ago`;
}
