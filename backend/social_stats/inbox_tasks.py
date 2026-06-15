# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Inbox sync — Celery tasks that pull comments / DMs / mentions / reviews from
each platform and upsert into Conversation + Message rows (and UnifiedReview
for GMB).

One task per platform; a top-level `sync_inbox_for_client` fans out to the
appropriate per-platform task per active credential. Beat schedule (in
settings.py) runs that fan-out every few minutes.

Tenant isolation: every query is scoped by client_id. Sync tasks NEVER touch
data outside their client.

Sentiment: each new inbound message is classified via `sentiment.classify`
(Anthropic Haiku when configured; 'unknown' otherwise). Outbound messages
inherit sentiment from the source.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone as dt_tz
from typing import Optional

import requests
from celery import shared_task
from django.db import transaction
from django.utils import timezone

from .models import (
    Client, PlatformCredential, UnifiedReview,
    Conversation, Message,
)
from . import sentiment as _sentiment
from .automation_engine import dispatch_event
from .realtime import push_event

logger = logging.getLogger(__name__)

GRAPH_VERSION = 'v21.0'
GRAPH_BASE = f'https://graph.facebook.com/{GRAPH_VERSION}'
DEFAULT_TIMEOUT = (10, 30)

# How far back to look on first run (and after long gaps).
INITIAL_LOOKBACK_DAYS = 7


# ── Top-level fan-out ────────────────────────────────────────────────────────
@shared_task(bind=True)
def sync_inbox_for_all_clients(self):
    """Beat-schedule entry. Walk every active credential and queue per-platform sync."""
    creds = PlatformCredential.objects.filter(is_active=True).only(
        'id', 'client_id', 'platform',
    )
    queued = 0
    by_platform = {
        'facebook':           sync_facebook_inbox,
        'instagram':          sync_instagram_inbox,
        'youtube':            sync_youtube_inbox,
        'linkedin':           sync_linkedin_inbox,
        'google_my_business': sync_gmb_reviews_unified,
    }
    for c in creds:
        task = by_platform.get(c.platform)
        if task is not None:
            task.delay(c.client_id)
            queued += 1
    if queued:
        logger.info('sync_inbox_for_all_clients queued %s syncs', queued)
    return queued


# ── Facebook ─────────────────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def sync_facebook_inbox(self, client_id: int):
    """Pull comments on Page posts (Page Inbox DMs require pages_messaging — skipped)."""
    cred = _active_cred(client_id, 'facebook')
    if not cred:
        return

    since_iso = _last_seen_iso(client_id, 'facebook')
    try:
        feed = _graph_get(
            f'/{cred.page_id}/feed',
            access_token=cred.access_token,
            params={
                'fields': 'id,message,created_time,'
                          'comments.limit(50){id,from,message,created_time,parent}',
                'limit':  50,
                'since':  since_iso,
            },
        )
    except _GraphHTTPError as e:
        logger.warning('FB feed inbox sync failed for client=%s: %s', client_id, e)
        return

    posts = (feed or {}).get('data') or []
    new_msgs = 0
    for post in posts:
        post_id = post.get('id')
        comments = (post.get('comments') or {}).get('data') or []
        for cmt in comments:
            if _upsert_fb_ig_comment(cred.client_id, 'facebook', post_id, cmt):
                new_msgs += 1
    logger.info('sync_facebook_inbox client=%s new_messages=%s', client_id, new_msgs)
    return new_msgs


# ── Instagram ────────────────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def sync_instagram_inbox(self, client_id: int):
    """Pull comments on the IG account's recent media."""
    cred = _active_cred(client_id, 'instagram')
    if not cred:
        return

    try:
        media = _graph_get(
            f'/{cred.instagram_account_id}/media',
            access_token=cred.access_token,
            params={
                'fields': 'id,caption,permalink,timestamp,'
                          'comments.limit(50){id,username,text,timestamp,parent_id,from}',
                'limit':  25,
            },
        )
    except _GraphHTTPError as e:
        logger.warning('IG inbox sync failed for client=%s: %s', client_id, e)
        return

    items = (media or {}).get('data') or []
    new_msgs = 0
    for m in items:
        media_id = m.get('id')
        comments = (m.get('comments') or {}).get('data') or []
        for cmt in comments:
            if _upsert_fb_ig_comment(cred.client_id, 'instagram', media_id, cmt):
                new_msgs += 1
    logger.info('sync_instagram_inbox client=%s new_messages=%s', client_id, new_msgs)
    return new_msgs


def _upsert_fb_ig_comment(client_id: int, platform: str, post_id: str, cmt: dict) -> bool:
    """Returns True when a NEW Message row was created (existing rows just touch updated_at)."""
    cmt_id = cmt.get('id')
    if not cmt_id or not post_id:
        return False

    sender = cmt.get('from') or {}
    author_name   = sender.get('name') or cmt.get('username') or ''
    author_handle = (cmt.get('username') or sender.get('id') or '').strip()
    body          = cmt.get('message') or cmt.get('text') or ''
    created_at    = _parse_iso(cmt.get('created_time') or cmt.get('timestamp'))

    with transaction.atomic():
        conv, _ = Conversation.objects.get_or_create(
            client_id=client_id,
            platform=platform,
            platform_thread_id=post_id,
            defaults={'type': 'comment'},
        )
        msg, created = Message.objects.get_or_create(
            conversation=conv,
            platform_message_id=cmt_id,
            defaults={
                'direction':    'inbound',
                'author_name':  author_name,
                'author_handle': author_handle,
                'content':      body,
                'sent_at':      created_at,
                'sentiment':    _sentiment.classify(body) if body else 'unknown',
            },
        )
        if created:
            # Update the conversation summary
            conv.last_message_preview = (body or '')[:500]
            conv.last_message_at      = created_at
            conv.unread_count        += 1
            conv.contact_name        = conv.contact_name or author_name
            conv.contact_handle      = conv.contact_handle or author_handle
            if msg.sentiment in ('positive', 'neutral', 'negative'):
                conv.sentiment = msg.sentiment
            conv.save(update_fields=[
                'last_message_preview', 'last_message_at', 'unread_count',
                'contact_name', 'contact_handle', 'sentiment',
            ])
            dispatch_event('message_created', msg.id, client_id)
            push_event('inbox.new_message', client_id, {
                'message_id':      msg.id,
                'conversation_id': conv.id,
                'platform':        platform,
                'preview':         conv.last_message_preview,
                'sentiment':       conv.sentiment,
                'contact_name':    conv.contact_name,
            })
            _emit_message_received_event(client_id, msg, platform, is_new_thread=(conv.unread_count == 1))
            return True
    return False


# ── YouTube ──────────────────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def sync_youtube_inbox(self, client_id: int):
    """Pull comment threads from the channel via commentThreads.list."""
    cred = _active_cred(client_id, 'youtube')
    if not cred:
        return

    # Need a fresh OAuth access token if expired
    from .publishers._google_client import GoogleClient
    try:
        client = GoogleClient(cred)
        access = client.access_token()
    except Exception as e:
        logger.warning('YouTube inbox: token refresh failed for client=%s: %s', client_id, e)
        return

    try:
        resp = requests.get(
            'https://www.googleapis.com/youtube/v3/commentThreads',
            params={
                'part':        'snippet,replies',
                'allThreadsRelatedToChannelId': cred.channel_id,
                'maxResults':  50,
            },
            headers={'Authorization': f'Bearer {access}'},
            timeout=DEFAULT_TIMEOUT,
        )
    except requests.RequestException as e:
        logger.warning('YouTube inbox network error: %s', e)
        return

    if resp.status_code != 200:
        logger.warning('YouTube inbox got status=%s body=%s', resp.status_code, resp.text[:200])
        return

    items = (resp.json() or {}).get('items') or []
    new_msgs = 0
    for thread in items:
        snippet = (thread.get('snippet') or {})
        top_comment = ((snippet.get('topLevelComment') or {}).get('snippet') or {})
        thread_id = thread.get('id')
        if not thread_id:
            continue

        # The "thread" itself is the parent comment; treat as Conversation
        if _upsert_yt_comment(cred.client_id, thread_id, snippet.get('topLevelComment', {}).get('id'), top_comment, is_top=True):
            new_msgs += 1

        # Replies
        for reply in (thread.get('replies') or {}).get('comments', []) or []:
            r_snippet = reply.get('snippet') or {}
            if _upsert_yt_comment(cred.client_id, thread_id, reply.get('id'), r_snippet, is_top=False):
                new_msgs += 1

    logger.info('sync_youtube_inbox client=%s new_messages=%s', client_id, new_msgs)
    return new_msgs


def _upsert_yt_comment(client_id: int, thread_id: str, comment_id: Optional[str],
                       snippet: dict, *, is_top: bool) -> bool:
    if not comment_id:
        return False
    body = snippet.get('textDisplay') or snippet.get('textOriginal') or ''
    author_name = snippet.get('authorDisplayName') or ''
    author_handle = snippet.get('authorChannelId', {}).get('value', '') if isinstance(snippet.get('authorChannelId'), dict) else ''
    created_at = _parse_iso(snippet.get('publishedAt'))

    with transaction.atomic():
        conv, _ = Conversation.objects.get_or_create(
            client_id=client_id,
            platform='youtube',
            platform_thread_id=thread_id,
            defaults={'type': 'comment'},
        )
        msg, created = Message.objects.get_or_create(
            conversation=conv,
            platform_message_id=comment_id,
            defaults={
                'direction':    'inbound',
                'author_name':  author_name,
                'author_handle': author_handle,
                'content':      body,
                'sent_at':      created_at,
                'sentiment':    _sentiment.classify(body) if body else 'unknown',
            },
        )
        if created:
            conv.last_message_preview = (body or '')[:500]
            conv.last_message_at      = created_at
            conv.unread_count        += 1
            if is_top and not conv.contact_name:
                conv.contact_name = author_name
                conv.contact_handle = author_handle
            if msg.sentiment in ('positive', 'neutral', 'negative'):
                conv.sentiment = msg.sentiment
            conv.save(update_fields=[
                'last_message_preview', 'last_message_at', 'unread_count',
                'contact_name', 'contact_handle', 'sentiment',
            ])
            dispatch_event('message_created', msg.id, client_id)
            push_event('inbox.new_message', client_id, {
                'message_id':      msg.id,
                'conversation_id': conv.id,
                'platform':        platform,
                'preview':         conv.last_message_preview,
                'sentiment':       conv.sentiment,
                'contact_name':    conv.contact_name,
            })
            _emit_message_received_event(client_id, msg, platform, is_new_thread=(conv.unread_count == 1))
            return True
    return False


# ── LinkedIn ─────────────────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def sync_linkedin_inbox(self, client_id: int):
    """
    LinkedIn comments require iterating over each of the org's recent posts
    via /rest/socialActions/{post_urn}/comments. This is partner-API limited
    and complex without an internal post catalog.

    For this task, this task walks UnifiedPost.publish_logs for LinkedIn-published
    posts in the last N days and pulls comments for each. If the org has zero
    Social Stats-published posts yet, the inbox stays empty for LinkedIn.

    A future iteration can expand to /rest/posts?author={urn} to discover
    posts published outside of Social Stats.
    """
    cred = _active_cred(client_id, 'linkedin')
    if not cred:
        return

    from .models import PlatformPublishLog
    cutoff = timezone.now() - timedelta(days=14)
    logs = PlatformPublishLog.objects.filter(
        unified_post__client_id=client_id,
        platform='linkedin',
        status='success',
        completed_at__gte=cutoff,
    ).only('platform_post_id')

    new_msgs = 0
    for log in logs:
        urn = log.platform_post_id
        if not urn:
            continue
        new_msgs += _sync_linkedin_post_comments(cred, urn)

    logger.info('sync_linkedin_inbox client=%s new_messages=%s', client_id, new_msgs)
    return new_msgs


def _sync_linkedin_post_comments(cred: PlatformCredential, post_urn: str) -> int:
    from urllib.parse import quote
    quoted = quote(post_urn, safe='')
    url = f'https://api.linkedin.com/rest/socialActions/{quoted}/comments'
    try:
        resp = requests.get(
            url,
            headers={
                'Authorization':              f'Bearer {cred.access_token}',
                'X-Restli-Protocol-Version':  '2.0.0',
                'LinkedIn-Version':           '202404',
            },
            timeout=DEFAULT_TIMEOUT,
        )
    except requests.RequestException as e:
        logger.warning('LinkedIn comments network error: %s', e)
        return 0

    if resp.status_code != 200:
        logger.warning('LinkedIn comments status=%s body=%s', resp.status_code, resp.text[:200])
        return 0

    elements = (resp.json() or {}).get('elements') or []
    new_msgs = 0
    for cmt in elements:
        cmt_urn = cmt.get('urn') or cmt.get('id')
        if not cmt_urn:
            continue
        actor = cmt.get('actor') or ''
        body = (cmt.get('message') or {}).get('text') or ''
        created_at_ms = cmt.get('created', {}).get('time')
        sent_at = (datetime.fromtimestamp(created_at_ms / 1000, tz=dt_tz.utc)
                   if created_at_ms else timezone.now())
        with transaction.atomic():
            conv, _ = Conversation.objects.get_or_create(
                client_id=cred.client_id,
                platform='linkedin',
                platform_thread_id=post_urn,
                defaults={'type': 'comment'},
            )
            msg, created = Message.objects.get_or_create(
                conversation=conv,
                platform_message_id=str(cmt_urn),
                defaults={
                    'direction':     'inbound',
                    'author_handle': str(actor),
                    'content':       body,
                    'sent_at':       sent_at,
                    'sentiment':     _sentiment.classify(body) if body else 'unknown',
                },
            )
            if created:
                conv.last_message_preview = (body or '')[:500]
                conv.last_message_at      = sent_at
                conv.unread_count        += 1
                if msg.sentiment in ('positive', 'neutral', 'negative'):
                    conv.sentiment = msg.sentiment
                conv.save(update_fields=[
                    'last_message_preview', 'last_message_at',
                    'unread_count', 'sentiment',
                ])
                dispatch_event('message_created', msg.id, cred.client_id)
                push_event('inbox.new_message', cred.client_id, {
                    'message_id':      msg.id,
                    'conversation_id': conv.id,
                    'platform':        'linkedin',
                    'preview':         conv.last_message_preview,
                    'sentiment':       conv.sentiment,
                })
                _emit_message_received_event(cred.client_id, msg, 'linkedin', is_new_thread=(conv.unread_count == 1))
                new_msgs += 1
    return new_msgs


# ── — central event-bus helper ──────────────────────────────────────
def _emit_message_received_event(client_id: int, msg, platform: str, *, is_new_thread: bool):
    """Publish `message.received` to the central event bus alongside the
    legacy `dispatch_event` + `push_event` calls.

    The legacy calls are an *inbox-internal* dispatcher and a *WebSocket
    bridge*; this is the new cross-feature event bus that activity-log +
    notification handlers subscribe to. defence-in-depth — never let the
    publish failure block sync.
    """
    try:
        from .events.publisher import EventPublisher
        from .models import Client
        client = Client.objects.filter(id=client_id).first()
        if not client:
            return
        EventPublisher.publish(
            'message.received',
            client=client,
            actor=None,
            actor_type='system',
            payload={
                'message_id': msg.id,
                'channel': platform,
                'is_new_thread': is_new_thread,
            },
        )
    except Exception:
        # Never let the event bus break inbox sync. The legacy dispatch above
        # still fires regardless.
        pass


# ── GMB reviews → UnifiedReview ──────────────────────────────────────────────
@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def sync_gmb_reviews_unified(self, client_id: int):
    """
    Pull GMB reviews into UnifiedReview rows (separate from the legacy
    GMBReview model populated by tasks.sync_gmb — we don't disturb that).
    """
    cred = _active_cred(client_id, 'google_my_business')
    if not cred:
        return

    from .publishers._google_client import GoogleClient
    try:
        client = GoogleClient(cred)
        access = client.access_token()
    except Exception as e:
        logger.warning('GMB reviews: token refresh failed for client=%s: %s', client_id, e)
        return

    parent = f'accounts/{cred.gmb_account_id}/locations/{cred.gmb_location_id}'
    try:
        resp = requests.get(
            f'https://mybusiness.googleapis.com/v4/{parent}/reviews',
            params={'pageSize': 50},
            headers={'Authorization': f'Bearer {access}'},
            timeout=DEFAULT_TIMEOUT,
        )
    except requests.RequestException as e:
        logger.warning('GMB reviews network error: %s', e)
        return

    if resp.status_code != 200:
        logger.warning('GMB reviews status=%s body=%s', resp.status_code, resp.text[:200])
        return

    items = (resp.json() or {}).get('reviews') or []
    new = 0
    for r in items:
        rid = r.get('reviewId') or r.get('name')
        if not rid:
            continue
        rating = _gmb_rating_to_int(r.get('starRating'))
        comment = r.get('comment') or ''
        reviewer = (r.get('reviewer') or {})
        with transaction.atomic():
            review, created = UnifiedReview.objects.get_or_create(
                client_id=client_id,
                platform='google_my_business',
                platform_review_id=str(rid),
                defaults={
                    'reviewer_name':       reviewer.get('displayName', ''),
                    'reviewer_avatar_url': reviewer.get('profilePhotoUrl', ''),
                    'rating':              rating,
                    'comment':             comment,
                    'created_at_platform': _parse_iso(r.get('createTime')),
                    'sentiment':           _sentiment.classify(comment) if comment else 'unknown',
                },
            )
            if not created:
                # Pull updates (rating change, reply added, etc.)
                changed = []
                reply = (r.get('reviewReply') or {}).get('comment')
                if reply and review.reply_text != reply:
                    review.reply_text = reply
                    review.replied_at = _parse_iso((r.get('reviewReply') or {}).get('updateTime'))
                    review.status = 'replied'
                    changed += ['reply_text', 'replied_at', 'status']
                if changed:
                    review.save(update_fields=changed)
            else:
                new += 1
                dispatch_event('review_created', review.id, client_id)
                push_event('inbox.new_review', client_id, {
                    'review_id':     review.id,
                    'platform':      'google_my_business',
                    'rating':        review.rating,
                    'reviewer_name': review.reviewer_name,
                    'sentiment':     review.sentiment,
                })

    logger.info('sync_gmb_reviews_unified client=%s new_reviews=%s', client_id, new)
    return new


def _gmb_rating_to_int(s) -> int:
    """GMB returns ratings as enum strings: 'ONE'|'TWO'|...|'FIVE'."""
    return {'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5}.get(str(s).upper(), 5)


# ── Helpers ──────────────────────────────────────────────────────────────────
class _GraphHTTPError(Exception):
    pass


def _graph_get(path: str, *, access_token: str, params: Optional[dict] = None) -> dict:
    url = f'{GRAPH_BASE}{path if path.startswith("/") else "/" + path}'
    p = dict(params or {})
    p['access_token'] = access_token
    try:
        resp = requests.get(url, params=p, timeout=DEFAULT_TIMEOUT)
    except requests.RequestException as e:
        raise _GraphHTTPError(f'network: {e}')
    if resp.status_code >= 400:
        try:
            err = resp.json().get('error', {})
        except Exception:
            err = {}
        raise _GraphHTTPError(f'HTTP {resp.status_code}: {err.get("message", resp.text[:200])}')
    try:
        return resp.json()
    except Exception:
        return {}


def _active_cred(client_id: int, platform: str) -> Optional[PlatformCredential]:
    cred = PlatformCredential.objects.filter(
        client_id=client_id, platform=platform, is_active=True,
    ).first()
    if not cred:
        logger.debug('No active %s credential for client=%s', platform, client_id)
    return cred


def _last_seen_iso(client_id: int, platform: str) -> str:
    last = (Conversation.objects
            .filter(client_id=client_id, platform=platform)
            .values_list('last_message_at', flat=True)
            .order_by('-last_message_at')
            .first())
    cutoff = last or (timezone.now() - timedelta(days=INITIAL_LOOKBACK_DAYS))
    return cutoff.isoformat()


def _parse_iso(value) -> Optional[datetime]:
    if not value:
        return None
    try:
        # Meta uses '2024-05-12T08:30:00+0000' (no colon in tz offset); YouTube uses RFC3339 'Z'
        v = str(value).replace('Z', '+0000')
        # Handle "+0000" (Meta) by inserting colon for fromisoformat
        if v[-5] in '+-' and v[-4:].isdigit() and v[-3] != ':':
            v = v[:-2] + ':' + v[-2:]
        return datetime.fromisoformat(v)
    except (ValueError, TypeError):
        return timezone.now()
