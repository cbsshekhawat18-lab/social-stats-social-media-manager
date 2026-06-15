/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
export const PLATFORMS = {
  facebook: {
    label: 'Facebook',
    shortLabel: 'Facebook',
    color: '#1877F2',
    bg:    '#EBF3FF',
    metrics: ['impressions','reach','clicks','likes','followers','profile_views'],
  },
  instagram: {
    label: 'Instagram',
    shortLabel: 'Instagram',
    color: '#E1306C',
    bg:    '#FDE8F0',
    metrics: ['impressions','reach','clicks','likes','saves','video_views','followers'],
  },
  linkedin: {
    label: 'LinkedIn',
    shortLabel: 'LinkedIn',
    color: '#0A66C2',
    bg:    '#E8F0F9',
    metrics: ['impressions','clicks','followers','engagement_rate'],
  },
  youtube: {
    label: 'YouTube',
    shortLabel: 'YouTube',
    color: '#FF0000',
    bg:    '#FFE9E9',
    metrics: ['video_views','impressions','likes','comments','shares','followers','ctr'],
  },
  google_my_business: {
    label: 'Google My Business',
    shortLabel: 'GMB',
    color: '#34A853',
    bg:    '#E6F4EA',
    metrics: ['impressions','website_clicks','phone_calls','direction_requests'],
  },
};

export const PLATFORM_LIST = Object.keys(PLATFORMS);

export const METRIC_LABELS = {
  impressions:        'Impressions',
  reach:              'Reach',
  clicks:             'Clicks',
  likes:              'Likes',
  comments:           'Comments',
  shares:             'Shares',
  saves:              'Saves',
  video_views:        'Video Views',
  followers:          'Followers',
  profile_views:      'Profile Views',
  website_clicks:     'Website Clicks',
  phone_calls:        'Phone Calls',
  direction_requests: 'Direction Requests',
  engagement_rate:    'Engagement Rate',
  ctr:                'CTR',
  sessions:           'Sessions',
  users:              'Users',
  page_views:         'Page Views',
};

export function fmt(num) {
  if (!num) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000)     return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function getPlatformLabel(platform, { short = false } = {}) {
  const meta = PLATFORMS[platform];
  if (!meta) return platform;
  return short ? meta.shortLabel || meta.label : meta.label;
}
