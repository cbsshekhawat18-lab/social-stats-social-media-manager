export const PLATFORMS = {
  facebook: {
    label: 'Facebook',
    color: '#1877F2',
    bg:    '#EBF3FF',
    icon:  '📘',
    metrics: ['impressions','reach','clicks','likes','followers','profile_views'],
  },
  instagram: {
    label: 'Instagram',
    color: '#E1306C',
    bg:    '#FDE8F0',
    icon:  '📸',
    metrics: ['impressions','reach','clicks','likes','saves','video_views','followers'],
  },
  youtube: {
    label: 'YouTube',
    color: '#FF0000',
    bg:    '#FFE9E9',
    icon:  '▶️',
    metrics: ['video_views','impressions','likes','comments','shares','followers','ctr'],
  },
  linkedin: {
    label: 'LinkedIn',
    color: '#0A66C2',
    bg:    '#E8F0F9',
    icon:  '💼',
    metrics: ['impressions','clicks','followers','engagement_rate'],
  },
  google_my_business: {
    label: 'Google My Business',
    color: '#34A853',
    bg:    '#E6F4EA',
    icon:  '🏢',
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
