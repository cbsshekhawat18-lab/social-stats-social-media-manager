/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useQueryClient } from '@tanstack/react-query';

import { useRealtime } from './useRealtime';
import { useAppStore, useCurrentClientId } from '../stores/appStore';
import { QK } from '../services/queryClient';

/**
 *
 * The `useRealtime` hook fires a callback on every inbound WebSocket event.
 * This hook turns those events into:
 *
 *   1. React Query cache invalidation — only the relevant query keys are
 *      touched, so the active page refetches but unrelated data stays cached.
 *   2. Optimistic badge bumps — when a `inbox.new_message` arrives between
 *      counts polls, the inbox badge increments immediately. The next
 *      `/api/dashboard/counts/` poll reconciles authoritatively.
 *
 * Mount once inside <App /> (under both <RealtimeProvider> and
 * <QueryClientProvider>). Renders nothing.
 *
 * ### Event-type → invalidation map
 *
 * | WS type                       | invalidates                              | bumps |
 * |-------------------------------|------------------------------------------|-------|
 * | inbox.new_message             | conversations(client) + dashboard.counts | unread_inbox |
 * | inbox.new_review              | conversations(client) + dashboard.counts | unread_inbox |
 * | composer.post_published       | posts(client) + calendar(client)         | scheduled_posts -1 |
 * | composer.post_failed          | posts(client) + dashboard.counts         | — |
 * | composer.post_partial         | posts(client)                            | — |
 * | credential.token_expired      | dashboard.counts                         | — |
 * | lead.captured                 | leads(client) + dashboard.counts         | new_leads |
 * | lead.status_changed           | leads(client) + lead(id)                 | — |
 * | bot.handoff_requested         | conversations(client) + bot-flows(client)| — |
 * | approval.requested            | approvals(client) + dashboard.counts     | pending_approvals |
 * | approval.granted | .rejected  | approvals(client) + dashboard.counts     | pending_approvals -1 |
 *
 * Anything else: invalidate `dashboard.counts` only — cheap insurance that
 * the sidebar stays accurate even for events we haven't mapped yet.
 */
export default function useRealtimeSync() {
  const queryClient = useQueryClient();
  const clientId    = useCurrentClientId();
  const bumpBadge   = useAppStore((s) => s.bumpBadge);

  useRealtime((event) => {
    const t = event?.type;
    if (!t) return;

    // Only act on events for the active client. Multi-client agency users
    // shouldn't see inbox bumps from other workspaces in their badge.
    const evClient = event.client_id;
    const inScope  = evClient == null || evClient === clientId;

    // Dashboard counts always invalidate — cheap and authoritative.
    queryClient.invalidateQueries({ queryKey: ['dashboard.counts'] });

    if (!inScope) return;

    switch (t) {
      case 'inbox.new_message':
      case 'inbox.new_review':
        queryClient.invalidateQueries({ queryKey: QK.conversations(clientId) });
        bumpBadge('unread_inbox', +1);
        break;

      case 'composer.post_published':
        queryClient.invalidateQueries({ queryKey: QK.posts(clientId) });
        queryClient.invalidateQueries({ queryKey: QK.calendar(clientId) });
        bumpBadge('scheduled_posts', -1);
        break;

      case 'composer.post_failed':
      case 'composer.post_partial':
        queryClient.invalidateQueries({ queryKey: QK.posts(clientId) });
        break;

      case 'lead.captured':
        queryClient.invalidateQueries({ queryKey: QK.leads(clientId) });
        bumpBadge('new_leads', +1);
        break;

      case 'lead.status_changed':
      case 'lead.converted': {
        queryClient.invalidateQueries({ queryKey: QK.leads(clientId) });
        const leadId = event.data?.lead_id;
        if (leadId) {
          queryClient.invalidateQueries({ queryKey: QK.lead(leadId) });
        }
        break;
      }

      case 'bot.handoff_requested':
      case 'bot.conversation_started':
      case 'bot.conversation_completed':
        queryClient.invalidateQueries({ queryKey: QK.botFlows(clientId) });
        queryClient.invalidateQueries({ queryKey: QK.conversations(clientId) });
        break;

      case 'approval.requested':
        queryClient.invalidateQueries({ queryKey: QK.approvals(clientId) });
        bumpBadge('pending_approvals', +1);
        break;

      case 'approval.granted':
      case 'approval.rejected':
        queryClient.invalidateQueries({ queryKey: QK.approvals(clientId) });
        bumpBadge('pending_approvals', -1);
        break;

      case 'credential.token_expired':
        // Token state isn't a separate query yet, but the dashboard counts
        // pick this up via `unread_notifications`.
        break;

      default:
        // Unmapped events — counts invalidation above is enough.
        break;
    }
  });

  return null;
}
