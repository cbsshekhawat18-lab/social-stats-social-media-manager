import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isWithinInterval,
  startOfMonth,
  subDays,
} from 'date-fns';

export function isDemoClient(_clientId) {
  return false;
}

export const demoClient = {
  id: 1,
  company: 'Xper8',
  industry: 'Digital Marketing',
  website: 'https://xper8.example.com',
};

const demoPublishedPosts = [
  makePost(101, 'instagram', 2, 'Spring challenge launch reel with coach intro and CTA to join today.', {
    post_type: 'reel',
    impressions: 22400, reach: 18600, likes: 1480, comments: 96, saves: 280, video_views: 19400, shares: 64,
    account_name: 'xper8fit',
  }),
  makePost(102, 'facebook', 4, 'Transformation story spotlight with member quote and class schedule.', {
    post_type: 'image',
    impressions: 18400, reach: 15220, likes: 912, comments: 54, shares: 80, clicks: 392,
    account_name: 'xper8fit',
  }),
  makePost(103, 'linkedin', 6, 'Behind the campaign: how Xper8 reduced CPL with local content sequencing.', {
    post_type: 'article',
    impressions: 9200, reach: 7600, clicks: 248, likes: 188, comments: 21, shares: 14,
    account_name: 'xper8agency',
  }),
  makePost(104, 'youtube', 9, 'Member success video with coach tips and free-trial landing page mention.', {
    post_type: 'video',
    impressions: 15800, reach: 12400, likes: 624, comments: 42, shares: 28, video_views: 11840,
    account_name: 'xper8fit',
  }),
  makePost(105, 'google_my_business', 11, 'Weekend promo for personal training sessions and nutrition plan.', {
    post_type: 'text',
    impressions: 7400, reach: 6100, website_clicks: 164, phone_calls: 32, likes: 96,
    account_name: 'Xper8 Studio',
  }),
  makePost(106, 'instagram', 13, 'Carousel of before-and-after results from the eight-week strength program.', {
    post_type: 'carousel',
    impressions: 19800, reach: 16400, likes: 1220, comments: 88, saves: 242, shares: 52,
    account_name: 'xper8fit',
  }),
  makePost(107, 'facebook', 16, 'Community event announcement with signup link and trainer lineup.', {
    post_type: 'image',
    impressions: 14600, reach: 11880, clicks: 310, likes: 684, comments: 33, shares: 41,
    account_name: 'xper8fit',
  }),
  makePost(108, 'linkedin', 18, 'Quarterly social performance recap for franchise growth partners.', {
    post_type: 'text',
    impressions: 8400, reach: 7020, clicks: 212, likes: 166, comments: 18, shares: 12,
    account_name: 'xper8agency',
  }),
  makePost(109, 'youtube', 21, 'Mobility tutorial clip that drove strong retention and replay activity.', {
    post_type: 'short',
    impressions: 13200, reach: 11040, video_views: 10220, likes: 540, comments: 27, shares: 19,
    account_name: 'xper8fit',
  }),
  makePost(110, 'google_my_business', 24, 'Customer review graphic encouraging direct calls for consultation.', {
    post_type: 'image',
    impressions: 6800, reach: 5640, website_clicks: 141, phone_calls: 28, likes: 74,
    account_name: 'Xper8 Studio',
  }),
  makePost(111, 'instagram', 26, 'Nutrition myth-busting story sequence turned into a high-save carousel.', {
    post_type: 'story',
    impressions: 11200, reach: 9400, likes: 588, comments: 14, shares: 16, saves: 108, video_views: 4200,
    account_name: 'xper8fit',
  }),
  makePost(112, 'facebook', 28, 'Final week offer with trainer testimonial and book-now button.', {
    post_type: 'video',
    impressions: 16500, reach: 13900, clicks: 418, likes: 740, comments: 46, shares: 37, video_views: 9200,
    account_name: 'xper8fit',
  }),
];

const demoScheduledOffsets = [1, 3, 5, 8, 10];
const demoScheduledPlatforms = ['instagram', 'facebook', 'linkedin', 'youtube', 'google_my_business'];

export function getDemoClientSummary() {
  const byPlatformMap = {};
  const totals = {
    total_impressions: 0,
    total_reach: 0,
    total_clicks: 0,
    total_likes: 0,
    total_video_views: 0,
    total_followers: 18420,
    total_website_clicks: 820,
    total_phone_calls: 148,
  };

  demoPublishedPosts.forEach((post) => {
    const bucket = byPlatformMap[post.platform] || {
      platform: post.platform,
      impressions: 0,
      reach: 0,
      clicks: 0,
      likes: 0,
      video_views: 0,
      followers: 0,
    };

    bucket.impressions += post.impressions || 0;
    bucket.reach += post.reach || 0;
    bucket.clicks += post.clicks || post.website_clicks || 0;
    bucket.likes += post.likes || 0;
    bucket.video_views += post.video_views || 0;
    bucket.followers += platformFollowerCount(post.platform);
    byPlatformMap[post.platform] = bucket;

    totals.total_impressions += post.impressions || 0;
    totals.total_reach += post.reach || 0;
    totals.total_clicks += post.clicks || post.website_clicks || 0;
    totals.total_likes += post.likes || 0;
    totals.total_video_views += post.video_views || 0;
  });

  return {
    client: demoClient,
    totals,
    by_platform: Object.values(byPlatformMap),
  };
}

export function getDemoTimeseries(range) {
  const end = range?.until ? new Date(range.until) : new Date();
  const start = range?.since ? new Date(range.since) : subDays(end, 29);
  return eachDayOfInterval({ start, end }).map((day, index) => ({
    date: format(day, 'yyyy-MM-dd'),
    impressions: 9200 + (index * 360) + (index % 4) * 280,
    engagement: 620 + (index * 18) + (index % 5) * 14,
    likes: 260 + (index * 9),
    clicks: 88 + (index * 4),
    video_views: 1800 + (index * 75),
    reach: 6400 + (index * 220),
  }));
}

export function getDemoPosts(platform, range) {
  const start = range?.since ? new Date(range.since) : startOfMonth(new Date());
  const end = range?.until ? new Date(range.until) : endOfMonth(new Date());
  return demoPublishedPosts.filter((post) => {
    const published = new Date(post.published_at);
    const matchesPlatform = !platform || platform === 'all' || post.platform === platform;
    return matchesPlatform && isWithinInterval(published, { start, end });
  });
}

export function getDemoOAuthStatus() {
  return {
    facebook: { status: 'active', account_name: 'xper8fit' },
    instagram: { status: 'active', account_name: 'xper8fit' },
    linkedin: { status: 'active', account_name: 'xper8agency' },
    youtube: { status: 'active', account_name: 'xper8fit' },
    google_my_business: { status: 'active', account_name: 'Xper8 Studio' },
  };
}

export function getDemoGoalProgress(month, year) {
  return [
    makeGoal(1, 'instagram', 'impressions', 188000, 240000, month, year),
    makeGoal(2, 'facebook', 'clicks', 2650, 3200, month, year),
    makeGoal(3, 'youtube', 'video_views', 68400, 75000, month, year),
    makeGoal(4, 'google_my_business', 'phone_calls', 148, 180, month, year),
  ];
}

export function getDemoCalendarPosts(month, year, platform) {
  const scheduledPosts = demoScheduledOffsets.map((offset, index) => {
    const scheduledDay = addDays(new Date(year, month - 1, Math.max(2, index + 3)), offset);
    return {
      id: 300 + index,
      platform: demoScheduledPlatforms[index],
      title: `Scheduled ${demoScheduledPlatforms[index]} post`,
      caption: scheduledCaptions[index],
      post_type: index % 2 === 0 ? 'image' : 'video',
      status: 'scheduled',
      scheduled_at: scheduledDay.toISOString(),
      account_name: demoScheduledPlatforms[index] === 'google_my_business' ? 'Xper8 Studio' : 'xper8fit',
      notes: 'Ready for approval',
      media_url: '',
      post_url: '',
    };
  });

  const monthPosts = [
    ...demoPublishedPosts.filter((post) => {
      const d = new Date(post.published_at);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    }).map((post) => ({ ...post, status: 'published', scheduled_at: post.published_at })),
    ...scheduledPosts.filter((post) => {
      const d = new Date(post.scheduled_at);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    }),
  ].filter((post) => !platform || platform === 'all' || post.platform === platform);

  return monthPosts.reduce((acc, post) => {
    const key = format(new Date(post.scheduled_at || post.published_at), 'yyyy-MM-dd');
    if (!acc[key]) acc[key] = [];
    acc[key].push(post);
    return acc;
  }, {});
}

export function getDemoCalendarNotes(month, year) {
  const base = new Date(year, month - 1, 1);
  return [
    { id: 1, date: format(addDays(base, 6), 'yyyy-MM-dd'), title: 'Promo shoot', color: '#F59E0B' },
    { id: 2, date: format(addDays(base, 12), 'yyyy-MM-dd'), title: 'Client approval due', color: '#2563EB' },
    { id: 3, date: format(addDays(base, 19), 'yyyy-MM-dd'), title: 'Offer refresh', color: '#10B981' },
  ];
}

export function getDemoCalendarStats(month, year) {
  const postsByDate = getDemoCalendarPosts(month, year, '');
  const publishedPosts = Object.values(postsByDate).flat().filter((post) => post.status === 'published');
  const byPlatform = {};
  const byPostType = {};
  const byDayOfWeek = {
    Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0,
  };

  publishedPosts.forEach((post) => {
    byPlatform[post.platform] = (byPlatform[post.platform] || 0) + 1;
    byPostType[post.post_type] = (byPostType[post.post_type] || 0) + 1;
    const dayName = new Date(post.published_at).toLocaleDateString('en-US', { weekday: 'long' });
    byDayOfWeek[dayName] = (byDayOfWeek[dayName] || 0) + 1;
  });

  return {
    total_published: publishedPosts.length,
    avg_per_week: 3.4,
    by_platform: byPlatform,
    by_day_of_week: byDayOfWeek,
    by_post_type: byPostType,
    best_performing_post: publishedPosts[0],
    posting_gaps: [
      format(new Date(year, month - 1, 7), 'yyyy-MM-dd'),
      format(new Date(year, month - 1, 8), 'yyyy-MM-dd'),
      format(new Date(year, month - 1, 13), 'yyyy-MM-dd'),
      format(new Date(year, month - 1, 14), 'yyyy-MM-dd'),
      format(new Date(year, month - 1, 15), 'yyyy-MM-dd'),
    ],
  };
}

export function getDemoUpcomingPosts(clientId) {
  if (!isDemoClient(clientId)) return [];
  return demoScheduledOffsets.map((offset, index) => ({
    id: 500 + index,
    platform: demoScheduledPlatforms[index],
    caption: scheduledCaptions[index],
    scheduled_at: addDays(new Date(), offset).toISOString(),
  }));
}

export function getDemoROISettings() {
  return {
    facebook_budget: 1800,
    instagram_budget: 2400,
    youtube_budget: 1200,
    linkedin_budget: 900,
    gmb_budget: 600,
    agency_fee: 1500,
    avg_sale_value: 420,
    conversion_rate: 4.2,
    lead_to_sale_rate: 26,
    monthly_revenue_goal: 28000,
    monthly_leads_goal: 180,
    currency: 'USD',
    currency_symbol: '$',
  };
}

export function calculateDemoROI(inputs, month, year) {
  const fb = Number(inputs.facebook_budget) || 0;
  const ig = Number(inputs.instagram_budget) || 0;
  const yt = Number(inputs.youtube_budget) || 0;
  const li = Number(inputs.linkedin_budget) || 0;
  const gmb = Number(inputs.gmb_budget) || 0;
  const fee = Number(inputs.agency_fee) || 0;
  const totalInvestment = fb + ig + yt + li + gmb + fee;
  const conversionRate = (Number(inputs.conversion_rate) || 0) / 100;
  const leadToSaleRate = (Number(inputs.lead_to_sale_rate) || 0) / 100;
  const avgSale = Number(inputs.avg_sale_value) || 0;

  const platformBreakdown = [
    roiRow('facebook', fb, 1120),
    roiRow('instagram', ig, 1460),
    roiRow('youtube', yt, 780),
    roiRow('linkedin', li, 410),
    roiRow('google_my_business', gmb, 320),
  ].filter((row) => row.budget > 0);

  let totalClicks = 0;
  let totalWebsiteClicks = 0;
  platformBreakdown.forEach((row) => {
    totalClicks += row.clicks;
    totalWebsiteClicks += row.website_clicks;
  });

  const estimatedLeads = Math.round(totalWebsiteClicks * conversionRate);
  const estimatedSales = Math.round(estimatedLeads * leadToSaleRate);
  const estimatedRevenue = estimatedSales * avgSale;
  const roiPercentage = totalInvestment > 0 ? ((estimatedRevenue - totalInvestment) / totalInvestment) * 100 : 0;

  platformBreakdown.forEach((row) => {
    row.leads = Math.round(row.website_clicks * conversionRate);
    row.sales = Math.round(row.leads * leadToSaleRate);
    row.revenue = row.sales * avgSale;
    row.roi_percentage = row.budget > 0 ? ((row.revenue - row.budget) / row.budget) * 100 : 0;
  });

  return {
    has_data: true,
    roi_percentage: roiPercentage,
    per_dollar_earned: totalInvestment > 0 ? estimatedRevenue / totalInvestment : 0,
    total_investment: totalInvestment,
    estimated_revenue: estimatedRevenue,
    total_clicks: totalClicks,
    total_website_clicks: totalWebsiteClicks,
    estimated_leads: estimatedLeads,
    estimated_sales: estimatedSales,
    cost_per_click: totalClicks > 0 ? totalInvestment / totalClicks : 0,
    cost_per_lead: estimatedLeads > 0 ? totalInvestment / estimatedLeads : 0,
    cost_per_sale: estimatedSales > 0 ? totalInvestment / estimatedSales : 0,
    platform_breakdown: platformBreakdown,
    goals: {
      revenue_goal: Number(inputs.monthly_revenue_goal) || 0,
      leads_goal: Number(inputs.monthly_leads_goal) || 0,
      revenue_progress: inputs.monthly_revenue_goal ? (estimatedRevenue / inputs.monthly_revenue_goal) * 100 : null,
      leads_progress: inputs.monthly_leads_goal ? (estimatedLeads / inputs.monthly_leads_goal) * 100 : null,
    },
    month,
    year,
  };
}

export function getDemoROIReports() {
  const now = new Date();
  return Array.from({ length: 4 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (3 - index), 1);
    return {
      id: index + 1,
      label: format(date, 'MMM yyyy'),
      roi_percentage: 168 + index * 22,
      estimated_revenue: 18200 + index * 2600,
    };
  });
}

export function getDemoInsight(month, year) {
  return {
    id: 1,
    content: `Instagram reels and Facebook offer posts are driving the strongest top-of-funnel momentum for Xper8 in ${format(new Date(year, month - 1, 1), 'MMMM yyyy')}. Video-led creative is outperforming static content on reach and saves, while Google Business posts are converting efficiently into direct actions like calls and website visits.\n\nFor the next cycle, keep short-form video as the lead asset, reuse the strongest offer hooks across Facebook and Instagram, and publish mid-week educational posts to support LinkedIn performance. The current mix suggests budget should continue leaning toward Instagram and Facebook, with Google My Business maintained as a high-intent conversion channel.`,
    generated_at: new Date().toISOString(),
  };
}

export function getDemoTopPosts() {
  return [
    topPostEntry('instagram', demoPublishedPosts[0], 18220, 12400),
    topPostEntry('facebook', demoPublishedPosts[1], 11840, 8800),
    topPostEntry('youtube', demoPublishedPosts[3], 10580, 7920),
  ];
}

export function getDemoOnboardingSteps() {
  const now = new Date();
  return [
    step(1, 'connect_platform', 'Connect social accounts', 'Facebook, Instagram, LinkedIn, YouTube, and Google Business are connected.', true, subDays(now, 12)),
    step(2, 'first_sync', 'Run first sync', 'Initial sync completed and platform analytics are now available.', true, subDays(now, 11)),
    step(3, 'set_goals', 'Set monthly goals', 'Revenue, lead, and engagement goals are configured for the current month.', true, subDays(now, 10)),
    step(4, 'add_credentials', 'Add brand credentials', 'Brand tone, CTAs, and publishing preferences are ready for the content team.', true, subDays(now, 9)),
    step(5, 'invite_team', 'Invite team members', 'Add content and approval collaborators for the client workspace.', false, null),
    step(6, 'configure_alerts', 'Configure alerts', 'Enable pacing and performance alerts for campaign monitoring.', false, null),
  ];
}

function makePost(id, platform, day, caption, metrics = {}) {
  const now = new Date();
  const published = new Date(now.getFullYear(), now.getMonth(), day, 10 + (id % 5), 0);
  return {
    id,
    client: 1,
    platform,
    title: metrics.title || '',
    caption,
    post_type: metrics.post_type || 'image',
    published_at: published.toISOString(),
    post_url: `https://example.com/posts/${id}`,
    media_url: '',
    thumbnail_url: '',
    impressions: metrics.impressions || 0,
    reach: metrics.reach || 0,
    clicks: metrics.clicks || 0,
    likes: metrics.likes || 0,
    comments: metrics.comments || 0,
    shares: metrics.shares || 0,
    saves: metrics.saves || 0,
    video_views: metrics.video_views || 0,
    followers: metrics.followers || 0,
    website_clicks: metrics.website_clicks || 0,
    phone_calls: metrics.phone_calls || 0,
    account_name: metrics.account_name || 'xper8fit',
  };
}

function platformFollowerCount(platform) {
  return {
    facebook: 3200,
    instagram: 6200,
    youtube: 2700,
    linkedin: 1800,
    google_my_business: 900,
  }[platform] || 0;
}

function makeGoal(id, platform, metric, current, target, month, year) {
  const percentage = target > 0 ? Math.round((current / target) * 100) : 0;
  let status = 'at_risk';
  if (percentage >= 100) status = 'completed';
  else if (percentage >= 75) status = 'on_track';
  else if (percentage < 50) status = 'missed';

  return {
    id,
    platform,
    metric,
    current_value: current,
    target_value: target,
    percentage,
    status,
    month,
    year,
  };
}

function roiRow(platform, budget, clicks) {
  const websiteClicks = platform === 'google_my_business' ? Math.round(clicks * 0.85) : Math.round(clicks * 0.62);
  return {
    platform,
    budget,
    clicks,
    website_clicks: websiteClicks,
    leads: 0,
    sales: 0,
    revenue: 0,
    roi_percentage: 0,
  };
}

function topPostEntry(platform, post, score, avgScore) {
  return {
    platform,
    score,
    avg_score: avgScore,
    post,
  };
}

function step(id, stepKey, label, description, isCompleted, completedAt) {
  return {
    id,
    client: 1,
    step_key: stepKey,
    label,
    description,
    is_completed: isCompleted,
    completed_at: completedAt ? completedAt.toISOString() : null,
  };
}

const scheduledCaptions = [
  'Monday motivation carousel with coach quote and trial link.',
  'Client testimonial graphic scheduled for morning engagement spike.',
  'LinkedIn case study post on local ad efficiency.',
  'Short-form tutorial clip queued for evening audience peak.',
  'Google Business update promoting limited-time assessment offer.',
];
