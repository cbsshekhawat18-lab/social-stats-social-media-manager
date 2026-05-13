import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Public routes where a 401 should NOT redirect — the user is already on
// or being sent to an unauthenticated surface, and bouncing them produces
// a redirect loop.
const PUBLIC_PATH_PREFIXES = [
  '/login', '/signup', '/auth/end-user', '/verify-email', '/forgot-password',
  '/reset-password', '/oauth/callback', '/auth/callback', '/invite/',
  '/agency-invite/', '/invitation/', '/report/',
];

function _redirectToLogin() {
  try { localStorage.clear(); } catch {}
  if (typeof window === 'undefined') return;
  const path = window.location.pathname || '';
  if (PUBLIC_PATH_PREFIXES.some((p) => path.startsWith(p))) return;
  window.location.href = '/login';
}

// Auto-refresh token on 401. Skip the refresh call entirely when there's
// no refresh token in storage — that always 400s with "may not be null"
// and pollers loop on it.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original?._retry) {
      return Promise.reject(error);
    }
    original._retry = true;

    const refresh = localStorage.getItem('refresh_token');
    if (!refresh) {
      _redirectToLogin();
      return Promise.reject(error);
    }

    try {
      const res = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/auth/refresh/`,
        { refresh }
      );
      localStorage.setItem('access_token', res.data.access);
      original.headers.Authorization = `Bearer ${res.data.access}`;
      return api(original);
    } catch {
      _redirectToLogin();
      return Promise.reject(error);
    }
  }
);

// ── Auth ──────────────────────────────────────────────
export const profileAPI = {
  get:               ()       => api.get('/profile/'),
  update:            (data)   => api.patch('/profile/', data, data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined),
  changePassword:    (data)   => api.post('/profile/change-password/', data),
  agencyInfo:        ()       => api.get('/profile/agency/'),
  disconnectAgency:  ()       => api.post('/profile/disconnect-agency/'),
  deleteAccount:     (data)   => api.delete('/profile/delete-account/', { data }),
};

export const authAPI = {
  login:              (email, password, termsAccepted) => api.post('/auth/login/', { username: email, password, terms_accepted: termsAccepted }),
  me:                 ()              => api.get('/auth/me/'),
  refresh:            (refresh)       => api.post('/auth/refresh/', { refresh }),
  signup:             (data)          => api.post('/auth/signup/', data),
  verifyEmail:        (token)         => api.get('/auth/verify-email/', { params: { token } }),
  resendVerification: (email)         => api.post('/auth/resend-verification/', { email }),
  passwordResetRequest: (email)       => api.post('/auth/password-reset/', { email }),
  passwordResetConfirm: (token, password) => api.post('/auth/password-reset/confirm/', { token, password }),
};

// ── End-user (B2C, marketplace) ───────────────────────
export const endUserAPI = {
  signup:        (data) => api.post('/end-user/signup/',    data),
  me:            ()     => api.get ('/end-user/me/'),
  updateProfile: (data) => api.put ('/end-user/profile/',   data),
  workspace:     ()     => api.get ('/end-user/workspace/'),
  updateWorkspace: (data) => api.put('/end-user/workspace/', data),
  incomingRequests: () => api.get ('/end-user/incoming-requests/'),
};

// ── Marketplace: manage requests (agency invites end-user) ─
export const manageRequestAPI = {
  send:    (data)            => api.post  ('/manage-request/send/', data),
  sent:    (params)          => api.get   ('/manage-request/sent/', { params }),
  cancel:  (id)              => api.delete(`/manage-request/${id}/`),
  // Public fetch (no auth required server-side, but interceptor still attaches token if present)
  invite:  (token)           => api.get   (`/manage-invite/${token}/`),
  accept:  (token, payload)  => api.post  (`/manage-invite/${token}/accept/`,  payload || {}),
  decline: (token, payload)  => api.post  (`/manage-invite/${token}/decline/`, payload || {}),
};

// ── Marketplace: relations (Stage 5) ───────────────────
export const relationAPI = {
  list:           ()             => api.get(`/relations/`),
  get:            (id)           => api.get(`/relations/${id}/`),
  updatePerms:    (id, payload)  => api.put(`/relations/${id}/permissions/`, payload),
  pause:          (id)           => api.post(`/relations/${id}/pause/`,     {}),
  resume:         (id)           => api.post(`/relations/${id}/resume/`,    {}),
  terminate:      (id, reason)   => api.post(`/relations/${id}/terminate/`, { reason }),
  flag:           (id, reason)   => api.post(`/relations/${id}/flag/`,      { reason }),
  agencyProfile:  (id)           => api.get(`/relations/${id}/agency-profile/`),
};

// ── CTWA bot builder ────────────────────────────────────
export const botAPI = {
  list:        (params)         => api.get   ('/bot-flows/', { params }),
  get:         (id)             => api.get   (`/bot-flows/${id}/`),
  create:      (data, params)   => api.post  ('/bot-flows/', data, { params }),
  update:      (id, data)       => api.put   (`/bot-flows/${id}/`, data),
  patch:       (id, data)       => api.patch (`/bot-flows/${id}/`, data),
  delete:      (id)             => api.delete(`/bot-flows/${id}/`),
  duplicate:   (id)             => api.post  (`/bot-flows/${id}/duplicate/`, {}),
  validate:    (id)             => api.post  (`/bot-flows/${id}/validate/`, {}),
  publish:     (id)             => api.post  (`/bot-flows/${id}/publish/`, {}),
  unpublish:   (id)             => api.post  (`/bot-flows/${id}/unpublish/`, {}),
  test:        (id, phone)      => api.post  (`/bot-flows/${id}/test/`, { phone }),
  analytics:   (id)             => api.get   (`/bot-flows/${id}/analytics/`),
  generateWithAI: (payload, params) =>
    api.post('/bot-flows/generate-with-ai/', payload, { params }),
};

export const botTemplateAPI = {
  list:  (params) => api.get(`/bot-templates/`, { params }),
  get:   (id)     => api.get(`/bot-templates/${id}/`),
  use:   (id, data) => api.post(`/bot-templates/${id}/use/`, data),
};

export const botConversationAPI = {
  list:    (params)  => api.get(`/bot-conversations/`, { params }),
  get:     (id)      => api.get(`/bot-conversations/${id}/`),
  handoff: (id, data)=> api.post(`/bot-conversations/${id}/handoff/`, data || {}),
  end:     (id)      => api.post(`/bot-conversations/${id}/end/`, {}),
  suggestReplies: (id) => api.post(`/bot-conversations/${id}/ai-suggest-replies/`, {}),
  handoffQueue:   (params) => api.get(`/bot-conversations/handoff-queue/`, { params }),
};

export const aiPersonaAPI = {
  build: (payload) => api.post('/ai/persona-builder/', payload),
};

export const botSettingsAPI = {
  get:    ()        => api.get ('/bot-settings/'),
  update: (payload) => api.put ('/bot-settings/', payload),
};

export const leadAPI = {
  list:        (params)        => api.get   (`/leads/`, { params }),
  get:         (id)            => api.get   (`/leads/${id}/`),
  update:      (id, data)      => api.put   (`/leads/${id}/`, data),
  patch:       (id, data)      => api.patch (`/leads/${id}/`, data),
  assign:      (id, user_id)   => api.post  (`/leads/${id}/assign/`,   { user_id }),
  status:      (id, payload)   => api.post  (`/leads/${id}/status/`,   payload),
  activity:    (id, payload)   => api.post  (`/leads/${id}/activity/`, payload),
  convert:     (id, value)     => api.post  (`/leads/${id}/convert/`,  { conversion_value: value }),
  timeline:    (id)            => api.get   (`/leads/${id}/timeline/`),
  bulkAssign:  (data)          => api.post  (`/leads/bulk-assign/`, data),
  scoreWithAI: (id)            => api.post  (`/leads/${id}/score-with-ai/`, {}),
  importCsv:   (formData)      => api.post  (`/leads/import_csv/`, formData,
                                              { headers: { 'Content-Type': 'multipart/form-data' } }),
  exportCsvUrl: (params={}) => {
    const base = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
    const qs = new URLSearchParams(params).toString();
    return `${base}/leads/export.csv/${qs ? '?' + qs : ''}`;
  },
};

export const ctwaAPI = {
  list:      (params)          => api.get   (`/ctwa-campaigns/`, { params }),
  get:       (id)              => api.get   (`/ctwa-campaigns/${id}/`),
  create:    (data, params)    => api.post  (`/ctwa-campaigns/`, data, { params }),
  update:    (id, data)        => api.put   (`/ctwa-campaigns/${id}/`, data),
  delete:    (id)              => api.delete(`/ctwa-campaigns/${id}/`),
  analytics: (id)              => api.get   (`/ctwa-campaigns/${id}/analytics/`),
  syncMeta:  (id)              => api.post  (`/ctwa-campaigns/${id}/sync-meta/`, {}),
  adBreakdown: (id)            => api.get   (`/ctwa-campaigns/${id}/ad-breakdown/`),
};

export const metaAdsAPI = {
  accounts:  ()        => api.get('/meta-ads/accounts/'),
  campaigns: (account) => api.get('/meta-ads/campaigns/', { params: { ad_account_id: account } }),
  ads:       (campaign) => api.get('/meta-ads/ads/', { params: { campaign_id: campaign } }),
  health:    ()        => api.get('/meta-ads/health/'),
};

// ── Notification preferences (Stage 13) ────────────────
export const notificationPrefsAPI = {
  get:    ()       => api.get ('/notifications/preferences/'),
  update: (rows)   => api.put ('/notifications/preferences/update/', { rows }),
};

// ── Verification + Disputes (Stage 15) ─────────────────
export const verificationAPI = {
  submit:  (slug, documents) => api.post(`/agency/${slug}/verification/submit/`, { documents }),
  pending: ()                => api.get('/admin/verifications/pending/'),
  get:     (id)              => api.get(`/admin/verifications/${id}/`),
  approve: (id, note = '')   => api.post(`/admin/verifications/${id}/approve/`, { note }),
  reject:  (id, note = '')   => api.post(`/admin/verifications/${id}/reject/`,  { note }),
};

export const disputeAPI = {
  file:    (data)            => api.post('/disputes/file/', data),
  list:    (params)          => api.get('/admin/disputes/', { params }),
  get:     (id)              => api.get(`/admin/disputes/${id}/`),
  resolve: (id, payload)     => api.post(`/admin/disputes/${id}/resolve/`, payload),
};

// ── Activity feed (Stages 5 + 12) ──────────────────────
export const activityAPI = {
  list:    (params)     => api.get(`/activity/`, { params }),
  flag:    (id, reason) => api.post(`/activity/${id}/flag/`, { reason }),
  revert:  (id)         => api.post(`/activity/${id}/revert/`, {}),
  // CSV download URL (token attached via the same axios baseURL pattern)
  exportCsvUrl: (params = {}) => {
    const base = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
    const qs = new URLSearchParams(params).toString();
    return `${base}/activity/export.csv${qs ? '?' + qs : ''}`;
  },
};

// ── Approvals (Stage 6) ────────────────────────────────
export const approvalAPI = {
  pending: ()              => api.get('/approvals/pending/'),
  history: ()              => api.get('/approvals/history/'),
  get:     (id)            => api.get(`/approvals/${id}/`),
  approve: (id, payload)   => api.post(`/approvals/${id}/approve/`, payload || {}),
  reject:  (id, reason)    => api.post(`/approvals/${id}/reject/`,  { reason }),
};

// ── Agency invites (Stage 7 — user invites agency) ─────
export const agencyInviteAPI = {
  send:           (data)            => api.post('/end-user/invite-agency/', data),
  sent:           ()                => api.get ('/end-user/sent-agency-invites/'),
  invite:         (token)           => api.get (`/agency-invite/${token}/`),
  accept:         (token)           => api.post(`/agency-invite/${token}/accept/`,  {}),
  decline:        (token)           => api.post(`/agency-invite/${token}/decline/`, {}),
  agencyIncoming: (slug)            => api.get (`/agency/${slug}/incoming-invites/`),
};

// ── Marketplace (Stage 8) ───────────────────────────────
export const marketplaceAPI = {
  list:       (params)        => api.get('/marketplace/agencies/', { params }),
  get:        (slug)          => api.get(`/marketplace/agencies/${slug}/`),
  featured:   ()              => api.get('/marketplace/featured/'),
  categories: ()              => api.get('/marketplace/categories/'),
  contact:    (slug, message) => api.post(`/marketplace/agencies/${slug}/contact/`, { message }),
};

export const agencyAPI = {
  get:    (slug)        => api.get (`/agency/${slug}/`),
  update: (slug, data)  => api.put (`/agency/${slug}/`, data),
};

// ── Billing (Stage 10 — end-user) ───────────────────────
export const billingAPI = {
  plans:        (side = 'end_user') => api.get('/billing/plans/', { params: { side } }),
  subscription: ()                  => api.get('/billing/subscription/'),
  checkout:     (plan)              => api.post('/billing/checkout/', { plan }),
  confirm:      (payload)           => api.post('/billing/confirm/',  payload),
  cancel:       ()                  => api.post('/billing/cancel/',   {}),
  invoices:     ()                  => api.get('/billing/invoices/'),
};

// ── Agency billing (Stage 11) ───────────────────────────
export const agencyBillingAPI = {
  subscription: (slug)        => api.get (`/agency/${slug}/billing/subscription/`),
  checkout:     (slug, plan)  => api.post(`/agency/${slug}/billing/checkout/`, { plan }),
  confirm:      (slug, p)     => api.post(`/agency/${slug}/billing/confirm/`,  p),
  cancel:       (slug)        => api.post(`/agency/${slug}/billing/cancel/`,   {}),
  invoices:     (slug)        => api.get (`/agency/${slug}/billing/invoices/`),
};

// ── Reviews (Stage 9) ───────────────────────────────────
export const reviewAPI = {
  list:    (slug, params)        => api.get(`/agencies/${slug}/reviews/`, { params }),
  create:  (slug, payload)       => api.post(`/agencies/${slug}/reviews/`, payload),
  update:  (id, payload)         => api.put(`/reviews/${id}/`, payload),
  delete:  (id)                  => api.delete(`/reviews/${id}/`),
  respond: (id, response)        => api.post(`/reviews/${id}/respond/`, { response }),
  helpful: (id)                  => api.post(`/reviews/${id}/helpful/`, {}),
};

// ── Clients ───────────────────────────────────────────
export const clientsAPI = {
  list:        ()           => api.get('/clients/'),
  get:         (id)         => api.get(`/clients/${id}/`),
  create:      (data)       => api.post('/clients/', data),
  update:      (id, data)   => api.patch(
    `/clients/${id}/`,
    data,
    data instanceof FormData
      ? { headers: { 'Content-Type': 'multipart/form-data' } }
      : undefined
  ),
  delete:      (id)         => api.delete(`/clients/${id}/`),
  summary:     (id, params) => api.get(`/clients/${id}/summary/`, { params }),
  timeseries:  (id, params) => api.get(`/clients/${id}/timeseries/`, { params }),
  posts:       (id, params) => api.get(`/clients/${id}/posts/`, { params }),
  triggerSync: (id, platforms) => api.post(`/clients/${id}/trigger_sync/`, { platforms }),
  syncStatus:  (id)         => api.get(`/clients/${id}/sync_status/`),
  syncAll:     ()           => api.post('/admin/sync-all/'),
};

// ── OAuth ─────────────────────────────────────────────
export const oauthAPI = {
  status:     (clientId)           => api.get(`/oauth/status/${clientId}/`),
  disconnect: (clientId, platform) => api.delete(`/oauth/disconnect/${clientId}/${platform}/`),
  // Connect URLs (redirect browser directly)
  facebookUrl: (clientId)           => `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/oauth/facebook/start/${clientId}/`,
  googleUrl:   (clientId, platform) => `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/oauth/google/start/${clientId}/?platform=${platform || 'all'}`,
  linkedinUrl: (clientId)           => `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/oauth/linkedin/start/${clientId}/`,
};

// ── Overview ──────────────────────────────────────────
export const overviewAPI = {
  get: (params) => api.get('/overview/', { params }),
};

// ── Admin ─────────────────────────────────────────────
export const adminAPI = {
  createClient: (data) => api.post('/admin/create-client/', data),
};

// ── Sync Logs ─────────────────────────────────────────
export const syncLogsAPI = {
  list: (params) => api.get('/synclogs/', { params }),
};

// ── Goals ─────────────────────────────────────────────
export const goalsAPI = {
  list:     (params)   => api.get('/goals/', { params }),
  create:   (data)     => api.post('/goals/', data),
  update:   (id, data) => api.put(`/goals/${id}/`, data),
  delete:   (id)       => api.delete(`/goals/${id}/`),
  progress: (params)   => api.get('/goals/progress/', { params }),
};

// ── AI Insights ───────────────────────────────────────
export const insightsAPI = {
  list:     (params) => api.get('/insights/', { params }),
  generate: (data)   => api.post('/insights/generate/', data),
};

// ── Weekly Top Posts ──────────────────────────────────
export const topPostsAPI = {
  list:    (params) => api.get('/top-posts/', { params }),
  allTime: (params) => api.get('/top-posts/all-time/', { params }),
  run:     ()       => api.post('/top-posts/run/'),
};

// ── Alerts ────────────────────────────────────────────
export const alertsAPI = {
  list:        (params) => api.get('/alerts/', { params }),
  markRead:    (id)     => api.post(`/alerts/${id}/mark_read/`),
  markAllRead: (params) => api.post('/alerts/mark_all_read/', null, { params }),
  runCheck:    ()       => api.post('/alerts/run_check/'),
};

// ── ROI Calculator ─────────────────────────────────────
export const roiAPI = {
  getSettings:  (clientId)        => api.get(`/roi/settings/${clientId}/`),
  saveSettings: (clientId, data)  => api.put(`/roi/settings/${clientId}/`, data),
  calculate:    (data)            => api.post('/roi/calculate/', data),
  getLive:      (params)          => api.get('/roi/live/', { params }),
  getReports:   (params)          => api.get('/roi/reports/', { params }),
};

// ── Content Calendar ──────────────────────────────────
export const calendarAPI = {
  getPosts:     (params)   => api.get('/calendar/posts/',               { params }),
  getPost:      (id)       => api.get(`/calendar/posts/${id}/`),
  createPost:   (data)     => api.post('/calendar/posts/', data),
  updatePost:   (id, data) => api.put(`/calendar/posts/${id}/`, data),
  deletePost:   (id)       => api.delete(`/calendar/posts/${id}/`),
  reschedule:   (id, data) => api.post(`/calendar/posts/${id}/reschedule/`, data),
  getUpcoming:  (params)   => api.get('/calendar/posts/upcoming/',      { params }),
  getStats:     (params)   => api.get('/calendar/posts/stats/',         { params }),
  getNotes:     (params)   => api.get('/calendar/notes/',               { params }),
  createNote:   (data)     => api.post('/calendar/notes/', data),
  updateNote:   (id, data) => api.put(`/calendar/notes/${id}/`, data),
  deleteNote:   (id)       => api.delete(`/calendar/notes/${id}/`),
  getSchedule:  (params)   => api.get('/calendar/schedule/',            { params }),
  saveSchedule: (data)     => api.post('/calendar/schedule/', data),
  suggestTimes: (params)   => api.get('/calendar/suggest-times/',       { params }),
};

// ── GMB Business Info & Reviews ───────────────────────
export const gmbAPI = {
  info:    (clientId)         => api.get(`/gmb/info/${clientId}/`),
  reviews: (clientId, params) => api.get(`/gmb/reviews/${clientId}/`, { params }),
};

// ── Onboarding ────────────────────────────────────────
export const onboardingAPI = {
  list:   (params) => api.get('/onboarding/', { params }),
  update: (id, data) => api.patch(`/onboarding/${id}/`, data),
};

// ── Shared Reports (authenticated) ────────────────────
export const sharedReportsAPI = {
  list:   (params) => api.get('/shared-reports/', { params }),
  create: (data)   => api.post('/shared-reports/', data),
  delete: (id)     => api.delete(`/shared-reports/${id}/`),
  update: (id, data) => api.patch(`/shared-reports/${id}/`, data),
};

// ── Public Report (no auth — separate axios instance) ─
const publicApi = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

export const publicReportAPI = {
  get:    (token)          => publicApi.get(`/public/report/${token}/`),
  verify: (token, password) => publicApi.post(`/public/report/${token}/verify/`, { password }),
};

export const lookupsAPI = {
  get: () => publicApi.get('/public/lookups/'),
};

export const contentAPI = {
  getPublic: (key) => publicApi.get(`/public/content/${key}/`),
};

// ── Social Auth URLs ──────────────────────────────────────────────────────────
export const socialAuthAPI = {
  googleUrl:    () => `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/auth/social/google/start/`,
  facebookUrl:  () => `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/auth/social/facebook/start/`,
  microsoftUrl: () => `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/auth/social/microsoft/start/`,
};

// ── Invitations ───────────────────────────────────────────────────────────────
export const invitationAPI = {
  send:       (data)         => api.post('/invitations/send/', data),
  getByToken: (token)        => api.get(`/invitations/token/${token}/`),
  respond:    (token, action) => api.post(`/invitations/token/${token}/respond/`, { action }),
  mine:       ()             => api.get('/invitations/mine/'),
  cancel:     (id)           => api.delete(`/invitations/${id}/cancel/`),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationAPI = {
  list:     ()   => api.get('/notifications/'),
  markRead: (id) => api.post(`/notifications/${id}/read/`),
  markAll:  ()   => api.post('/notifications/read-all/'),
};

// ── Solo Client Setup ─────────────────────────────────────────────────────────
export const soloAPI = {
  setup: () => api.post('/client/setup-solo/'),
};

// ── Management (superadmin only) ──────────────────────
export const managementAPI = {
  // Staff
  listStaff:           ()           => api.get('/management/staff/'),
  createStaff:         (data)       => api.post('/management/staff/', data),
  getStaff:            (id)         => api.get(`/management/staff/${id}/`),
  updateStaff:         (id, data)   => api.patch(`/management/staff/${id}/`, data),
  deleteStaff:         (id)         => api.delete(`/management/staff/${id}/`),
  getStaffPermissions: (id)         => api.get(`/management/staff/${id}/permissions/`),
  setStaffPermissions: (id, data)   => api.post(`/management/staff/${id}/permissions/`, data),
  getStaffClients:     (id)         => api.get(`/management/staff/${id}/clients/`),
  setStaffClients:     (id, data)   => api.post(`/management/staff/${id}/clients/`, data),
  // Clients
  listClients:               ()           => api.get('/management/clients/'),
  getClient:                 (id)         => api.get(`/management/clients/${id}/`),
  updateClient:              (id, data)   => api.patch(`/management/clients/${id}/`, data),
  getClientPermissions:      (id)         => api.get(`/management/clients/${id}/permissions/`),
  setClientPermissions:      (id, data)   => api.post(`/management/clients/${id}/permissions/`, data),
  getClientPortalConfig:     (id)         => api.get(`/management/clients/${id}/portal-config/`),
  saveClientPortalConfig:    (id, data)   => api.put(`/management/clients/${id}/portal-config/`, data),
  // Permissions & Roles
  listPermissions:     ()           => api.get('/management/permissions/'),
  getRoleDefaults:     (role)       => api.get(`/management/role-defaults/${role}/`),
  setRoleDefaults:     (role, data) => api.put(`/management/role-defaults/${role}/`, data),
};

// ── AI Caption Writer ──────────────────────────────
export const captionAPI = {
  generate:   (data)     => api.post('/ai/caption/', data),
  getHistory: (clientId) => api.get('/ai/caption/', { params: { client_id: clientId } }),
};

// ── AI Post Ideas Generator ────────────────────────
export const postIdeasAPI = {
  generate:      (data)              => api.post('/ai/post-ideas/', data),
  getHistory:    (params)            => api.get('/ai/post-ideas/', { params }),
  approveAll:    (id)                => api.post(`/ai/post-ideas/${id}/approve-all/`),
  addToCalendar: (id, data)          => api.post(`/ai/post-ideas/${id}/add-to-calendar/`, data),
  updateIdea:    (id, ideaId, data)  => api.patch(`/ai/post-ideas/${id}/ideas/${ideaId}/`, data),
};

// ── AI Hashtag Research Tool ───────────────────────
export const hashtagAPI = {
  generate:    (data)   => api.post('/ai/hashtags/', data),
  getHistory:  (params) => api.get('/ai/hashtags/', { params }),
  saveSet:     (id, data) => api.post(`/ai/hashtags/${id}/save-set/`, data),
  getSavedSets:(params) => api.get('/ai/hashtags/saved-sets/', { params }),
};

// ── AI Assistant (Stage 8) ─────────────────────────────
export const aiAPI = {
  composePost:        (data) => api.post('/ai/compose-post/', data),
  suggestHashtags:    (data) => api.post('/ai/suggest-hashtags/', data),
  bestTimeToPost:     (data) => api.post('/ai/best-time-to-post/', data),
  suggestReply:       (data) => api.post('/ai/suggest-reply/', data),
  rewrite:            (data) => api.post('/ai/rewrite/', data),
  translate:          (data) => api.post('/ai/translate/', data),
  generateImageCaption: (data) => api.post('/ai/generate-image-caption/', data),
  contentCalendar:    (data) => api.post('/ai/content-calendar/', data),
  trainBrandVoice:    (data) => api.post('/ai/train-brand-voice/', data),
  getBrandVoice:      ()     => api.get('/ai/brand-voice/'),
};

// ── AI v2 — Smart Composer (Stage 2 of comprehensive AI build) ─────────
// Routed through the new AIClient with caching + rate limiting + cost logs.
export const aiV2API = {
  compose:         (data) => api.post('/ai/v2/compose/',          data),
  rewrite:         (data) => api.post('/ai/v2/rewrite/',          data),
  extend:          (data) => api.post('/ai/v2/extend/',           data),
  summarize:       (data) => api.post('/ai/v2/summarize/',        data),
  hashtagResearch: (data) => api.post('/ai/v2/hashtag-research/', data),
  optimalTime:     (data) => api.post('/ai/v2/optimal-time/',     data),
  titleGenerator:  (data) => api.post('/ai/v2/title-generator/',  data),
  postImprove:     (data) => api.post('/ai/v2/post-improve/',     data),

  describeImage:        (data) => api.post('/ai/v2/describe-image/',          data),
  imageToPost:          (data) => api.post('/ai/v2/image-to-post/',           data),
  altText:              (data) => api.post('/ai/v2/alt-text/',                data),
  brandComplianceCheck: (data) => api.post('/ai/v2/brand-compliance-check/',  data),

  videoScript:    (data) => api.post('/ai/v2/video-script/',    data),
  videoCaptions:  (data) => api.post('/ai/v2/video-captions/',  data),
  videoChapters:  (data) => api.post('/ai/v2/video-chapters/',  data),
  videoSummary:   (data) => api.post('/ai/v2/video-summary/',   data),

  replySuggest:      (data) => api.post('/ai/v2/reply-suggest/',     data),
  autoReply:         (data) => api.post('/ai/v2/auto-reply/',        data),
  sentimentAnalyze:  (data) => api.post('/ai/v2/sentiment-analyze/', data),
  intentClassify:    (data) => api.post('/ai/v2/intent-classify/',   data),
  reviewReply:       (data) => api.post('/ai/v2/review-reply/',      data),
  crisisDetect:      (data) => api.post('/ai/v2/crisis-detect/',     data),
  spamFilter:        (data) => api.post('/ai/v2/spam-filter/',       data),

  brandVoiceGet:    (params) => api.get('/ai/v2/brand-voice/',         { params }),
  brandVoiceTrain:  (data)   => api.post('/ai/v2/brand-voice/train/',  data),
  brandVoiceTest:   (data)   => api.post('/ai/v2/brand-voice/test/',   data),

  chat:                  (data)   => api.post('/ai/v2/chat/', data),
  chatListConversations: (params) => api.get('/ai/v2/chat/conversations/', { params }),
  chatGetConversation:   (id)     => api.get(`/ai/v2/chat/conversations/${id}/`),
  chatPatchConversation: (id, d)  => api.patch(`/ai/v2/chat/conversations/${id}/`, d),
  chatDeleteConversation:(id)     => api.delete(`/ai/v2/chat/conversations/${id}/`),

  insightGenerate:    (data)   => api.post('/ai/v2/insight-generate/',  data),
  insightsList:       (params) => api.get('/ai/v2/insights/',           { params }),
  insightUpdate:      (id, d)  => api.patch(`/ai/v2/insights/${id}/`,    d),
  anomalyDetect:      (data)   => api.post('/ai/v2/anomaly-detect/',    data),
  trendAnalysis:      (data)   => api.post('/ai/v2/trend-analysis/',    data),
  forecast:           (data)   => api.post('/ai/v2/forecast/',          data),
  competitorInsight:  (data)   => api.post('/ai/v2/competitor-insight/', data),
  audienceProfile:    (data)   => api.post('/ai/v2/audience-profile/',  data),
  todayBriefing:      (params) => api.get('/ai/v2/today-briefing/',     { params }),

  reportWrite:        (data) => api.post('/ai/v2/report-write/',   data),
  reportNarrate:      (data) => api.post('/ai/v2/report-narrate/', data),

  usageOverview:   (params) => api.get('/ai/v2/usage/',           { params }),
  usageByClient:   (params) => api.get('/ai/v2/usage/by-client/', { params }),
  usageByUser:     (params) => api.get('/ai/v2/usage/by-user/',   { params }),
  usageBudget:     ()       => api.get('/ai/v2/usage/budget/'),
  usageQuota:      (params) => api.get('/ai/v2/usage/quota/',     { params }),
  audit:           (params) => api.get('/ai/v2/audit/',           { params }),
};

// ── Audit + Notification preferences + Approval queue (Stage 13) ──
export const auditAPI = {
  list: (params) => api.get('/audit/log/', { params }),
};

export const notificationsAPI = {
  getPreferences: ()       => api.get('/notifications/preferences/'),
  putPreferences: (matrix) => api.put('/notifications/preferences/', { matrix }),
  approvalQueue:  (params) => api.get('/composer/approvals/', { params }),
};

// ── Competitors + Benchmark (Stage 12) ─────────────────
export const competitorAPI = {
  list:       (params)   => api.get('/competitors/', { params }),
  get:        (id)       => api.get(`/competitors/${id}/`),
  create:     (data)     => api.post('/competitors/', data),
  update:     (id, data) => api.patch(`/competitors/${id}/`, data),
  delete:     (id)       => api.delete(`/competitors/${id}/`),
  timeline:   (id, params) => api.get(`/competitors/${id}/timeline/`, { params }),
  posts:      (id, params) => api.get(`/competitors/${id}/posts/`, { params }),
  insights:   (id)       => api.post(`/competitors/${id}/insights/`),
  snapshotNow:(id)       => api.post(`/competitors/${id}/snapshot_now/`),
  benchmark:  (data)     => api.post('/competitors/benchmark/', data),
};

// ── Audience Insights (Stage 12) ───────────────────────
export const audienceAPI = {
  unified: (params) => api.get('/audience/unified/', { params }),
};

// ── Video Studio (Stage 10) ────────────────────────────
export const videoAPI = {
  upload:           (formData) => api.post('/video/upload/', formData,
                                  { headers: { 'Content-Type': 'multipart/form-data' } }),
  importFromUrl:    (data)     => api.post('/video/upload/', data),
  trim:             (data)     => api.post('/video/trim/', data),
  resize:           (data)     => api.post('/video/resize/', data),
  extractThumbnail: (data)     => api.post('/video/extract-thumbnail/', data),
  addCaptions:      (data)     => api.post('/video/add-captions/', data),
  youtubeUpload:    (data)     => api.post('/video/youtube-upload/', data),
};

// ── Automations (Stage 9) ──────────────────────────────
export const automationsAPI = {
  list:      (params)   => api.get('/automations/', { params }),
  get:       (id)       => api.get(`/automations/${id}/`),
  create:    (data)     => api.post('/automations/', data),
  update:    (id, data) => api.patch(`/automations/${id}/`, data),
  delete:    (id)       => api.delete(`/automations/${id}/`),
  toggle:    (id)       => api.post(`/automations/${id}/toggle/`),
  runNow:    (id, data) => api.post(`/automations/${id}/run_now/`, data),
  templates: ()         => api.get('/automations/templates/'),
};

// ── Unified Composer ───────────────────────────────────
export const composerAPI = {
  posts: {
    list:        (params)   => api.get('/composer/posts/', { params }),
    get:         (id)       => api.get(`/composer/posts/${id}/`),
    create:      (data)     => api.post('/composer/posts/', data),
    update:      (id, data) => api.patch(`/composer/posts/${id}/`, data),
    delete:      (id)       => api.delete(`/composer/posts/${id}/`),
    publishNow:  (id)       => api.post(`/composer/posts/${id}/publish_now/`),
    schedule:    (id, scheduled_at) => api.post(`/composer/posts/${id}/schedule/`, { scheduled_at }),
    cancel:      (id)       => api.post(`/composer/posts/${id}/cancel/`),
    duplicate:   (id)       => api.post(`/composer/posts/${id}/duplicate/`),
    approve:     (id)       => api.post(`/composer/posts/${id}/approve/`),
    addToQueue:  (id, queue_id) => api.post(`/composer/posts/${id}/add_to_queue/`, { queue_id }),
    preview:     (id)       => api.get(`/composer/posts/${id}/preview/`),
  },
  media: {
    list:        (params)   => api.get('/composer/media/', { params }),
    get:         (id)       => api.get(`/composer/media/${id}/`),
    delete:      (id)       => api.delete(`/composer/media/${id}/`),
    update:      (id, data) => api.patch(`/composer/media/${id}/`, data),
    upload:      (formData) => api.post('/composer/media/', formData,
                              { headers: { 'Content-Type': 'multipart/form-data' } }),
    bulkUpload:  (formData) => api.post('/composer/media/bulk_upload/', formData,
                              { headers: { 'Content-Type': 'multipart/form-data' } }),
  },
  queues: {
    list:        (params)   => api.get('/composer/queues/', { params }),
    get:         (id)       => api.get(`/composer/queues/${id}/`),
    create:      (data)     => api.post('/composer/queues/', data),
    update:      (id, data) => api.patch(`/composer/queues/${id}/`, data),
    delete:      (id)       => api.delete(`/composer/queues/${id}/`),
    addItems:    (id, items) => api.post(`/composer/queues/${id}/add_items/`, { items }),
    reorder:     (id, order) => api.post(`/composer/queues/${id}/reorder/`, { order }),
    pause:       (id)       => api.post(`/composer/queues/${id}/pause/`),
    resume:      (id)       => api.post(`/composer/queues/${id}/resume/`),
  },
  preflight:     (data)     => api.post('/composer/preflight/', data),
};

// ── Unified Inbox ──────────────────────────────────────
export const inboxAPI = {
  conversations: {
    list:        (params)   => api.get('/inbox/conversations/', { params }),
    get:         (id)       => api.get(`/inbox/conversations/${id}/`),
    markRead:    (id)       => api.post(`/inbox/conversations/${id}/mark_read/`),
    archive:     (id)       => api.post(`/inbox/conversations/${id}/archive/`),
    unarchive:   (id)       => api.post(`/inbox/conversations/${id}/unarchive/`),
    star:        (id)       => api.post(`/inbox/conversations/${id}/star/`),
    unstar:      (id)       => api.post(`/inbox/conversations/${id}/unstar/`),
    resolve:     (id)       => api.post(`/inbox/conversations/${id}/resolve/`),
    reopen:      (id)       => api.post(`/inbox/conversations/${id}/reopen/`),
    assign:      (id, user_id) => api.post(`/inbox/conversations/${id}/assign/`, { user_id }),
    reply:       (id, text) => api.post(`/inbox/conversations/${id}/reply/`, { text }),
  },
  messages: {
    list:        (params)   => api.get('/inbox/messages/', { params }),
  },
  reviews: {
    list:        (params)   => api.get('/inbox/reviews/', { params }),
    get:         (id)       => api.get(`/inbox/reviews/${id}/`),
    reply:       (id, text) => api.post(`/inbox/reviews/${id}/reply/`, { text }),
    flag:        (id)       => api.post(`/inbox/reviews/${id}/flag/`),
  },
  stats:         ()         => api.get('/inbox/stats/'),
};

// ── WhatsApp (Pinbot) ──────────────────────────────────
export const whatsappAPI = {
  account: {
    list:           (params)     => api.get('/whatsapp/accounts/', { params }),
    get:            (id)         => api.get(`/whatsapp/accounts/${id}/`),
    create:         (data)       => api.post('/whatsapp/accounts/', data),
    update:         (id, data)   => api.patch(`/whatsapp/accounts/${id}/`, data),
    delete:         (id)         => api.delete(`/whatsapp/accounts/${id}/`),
    testConnection: (id)         => api.post(`/whatsapp/accounts/${id}/test_connection/`),
    syncStatus:     (id)         => api.post(`/whatsapp/accounts/${id}/sync_status/`),
  },
  contacts: {
    list:        (params)   => api.get('/whatsapp/contacts/', { params }),
    get:         (id)       => api.get(`/whatsapp/contacts/${id}/`),
    create:      (data)     => api.post('/whatsapp/contacts/', data),
    update:      (id, data) => api.patch(`/whatsapp/contacts/${id}/`, data),
    delete:      (id)       => api.delete(`/whatsapp/contacts/${id}/`),
    importCSV:   (formData) => api.post('/whatsapp/contacts/import_csv/', formData, {
                                  headers: { 'Content-Type': 'multipart/form-data' },
                                }),
    bulkOptIn:   (ids)      => api.post('/whatsapp/contacts/bulk_opt_in/',  { ids }),
    bulkOptOut:  (ids)      => api.post('/whatsapp/contacts/bulk_opt_out/', { ids }),
    addToList:   (ids, list_id) => api.post('/whatsapp/contacts/add_to_list/', { ids, list_id }),
    exportCSV:   (params)   => api.get('/whatsapp/contacts/export_csv/', { params, responseType: 'blob' }),
  },
  lists: {
    list:           (params)   => api.get('/whatsapp/lists/', { params }),
    get:            (id)       => api.get(`/whatsapp/lists/${id}/`),
    create:         (data)     => api.post('/whatsapp/lists/', data),
    update:         (id, data) => api.patch(`/whatsapp/lists/${id}/`, data),
    delete:         (id)       => api.delete(`/whatsapp/lists/${id}/`),
    addContacts:    (id, ids)  => api.post(`/whatsapp/lists/${id}/add_contacts/`,    { ids }),
    removeContacts: (id, ids)  => api.post(`/whatsapp/lists/${id}/remove_contacts/`, { ids }),
  },
  templates: {
    list:    (params)   => api.get('/whatsapp/templates/', { params }),
    get:     (id)       => api.get(`/whatsapp/templates/${id}/`),
    create:  (data)     => api.post('/whatsapp/templates/', data),
    update:  (id, data) => api.patch(`/whatsapp/templates/${id}/`, data),
    delete:  (id)       => api.delete(`/whatsapp/templates/${id}/`),
    submit:  (id)       => api.post(`/whatsapp/templates/${id}/submit/`),
    sync:    (id)       => api.post(`/whatsapp/templates/${id}/sync/`),
    preview: (id, variables) => api.post(`/whatsapp/templates/${id}/preview/`, { variables }),
  },
  campaigns: {
    list:        (params)   => api.get('/whatsapp/campaigns/', { params }),
    get:         (id)       => api.get(`/whatsapp/campaigns/${id}/`),
    create:      (data)     => api.post('/whatsapp/campaigns/', data),
    update:      (id, data) => api.patch(`/whatsapp/campaigns/${id}/`, data),
    delete:      (id)       => api.delete(`/whatsapp/campaigns/${id}/`),
    launch:      (id)       => api.post(`/whatsapp/campaigns/${id}/launch/`),
    pause:       (id)       => api.post(`/whatsapp/campaigns/${id}/pause/`),
    resume:      (id)       => api.post(`/whatsapp/campaigns/${id}/resume/`),
    cancel:      (id)       => api.post(`/whatsapp/campaigns/${id}/cancel/`),
    stats:       (id)       => api.get(`/whatsapp/campaigns/${id}/stats/`),
    retryFailed: (id)       => api.post(`/whatsapp/campaigns/${id}/retry_failed/`),
  },
  messages: {
    list: (params) => api.get('/whatsapp/messages/', { params }),
  },
  dashboard: (params) => api.get('/whatsapp/dashboard/', { params }),
  inbox: {
    list:       (params)    => api.get('/whatsapp/inbox/', { params }),
    thread:     (contactId) => api.get('/whatsapp/inbox/thread/', { params: { contact_id: contactId } }),
    sendDirect: (data)      => api.post('/whatsapp/send/', data),
  },
};

// ── Stage 10 — security + privacy (Settings UI) ─────────────────────────
export const sessionsAPI = {
  list:      ()        => api.get  ('/auth/sessions/'),
  revoke:    (id)      => api.post (`/auth/sessions/${id}/revoke/`, {}),
  revokeAll: (keepJti) => api.post ('/auth/sessions/revoke-all/',  { keep_jti: keepJti || '' }),
};

export const mfaAPI = {
  status:               ()       => api.get  ('/auth/mfa/status/'),
  setup:                ()       => api.post ('/auth/mfa/setup/', {}),
  verifySetup:          (code)   => api.post ('/auth/mfa/verify-setup/', { code }),
  login:                (data)   => api.post ('/auth/mfa/login/', data),
  disable:              (data)   => api.post ('/auth/mfa/disable/', data),
  regenerateBackupCodes: (code)   => api.post ('/auth/mfa/regenerate-backup-codes/', { code }),
};

export const apiKeysAPI = {
  list:    (includeInactive) => api.get  ('/api-keys/', { params: includeInactive ? { include_inactive: 1 } : {} }),
  create:  (data)            => api.post ('/api-keys/', data),
  revoke:  (id, reason)      => api.post (`/api-keys/${id}/revoke/`, { reason: reason || 'user_revoked' }),
};

export const privacyAPI = {
  exportList:    ()       => api.get  ('/privacy/export-request/'),
  exportRequest: ()       => api.post ('/privacy/export-request/', {}),
  // download is a direct file URL — no JSON wrapper

  deleteAccount:       (reason) => api.post ('/privacy/delete-account/',         { reason: reason || '' }),
  cancelDeleteAccount: ()       => api.post ('/privacy/delete-account/cancel/',  {}),

  processingStatus:    ()                     => api.get  ('/privacy/processing-status/'),
  setProcessingPaused: (paused, clientId)     => api.post ('/privacy/processing-status/', {
    paused: !!paused, ...(clientId ? { client_id: clientId } : {}),
  }),

  consents:    ()                          => api.get ('/privacy/consents/'),
  setConsent:  (consentType, given, via)   => api.post('/privacy/consents/', {
    consent_type: consentType, given: !!given, given_via: via || 'settings_page',
  }),
};

export default api;
