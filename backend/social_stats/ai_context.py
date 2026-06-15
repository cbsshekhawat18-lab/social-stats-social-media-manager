# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
from .models import PostMetric, PlatformCredential


def build_client_ai_context(client):
    competitors = list(client.competitors.all()[:3])
    recent_posts = list(
        PostMetric.objects.filter(client=client)
        .exclude(caption='')
        .order_by('-published_at', '-synced_at')[:8]
    )
    credentials = list(
        PlatformCredential.objects.filter(client=client, is_active=True).order_by('platform')
    )

    profile_lines = [
        f"Business name: {client.company or 'Not specified'}",
        f"Primary contact: {client.name or 'Not specified'}",
        f"Business category: {client.business_category or 'Not specified'}",
        f"Business subcategories: {', '.join(client.business_subcategories or []) or 'Not specified'}",
        f"Brand tone: {client.brand_tone or 'Not specified'}",
        f"Brand description: {client.brand_description or 'Not specified'}",
        f"USP: {client.usp or 'Not specified'}",
        f"Target audience: {client.target_audience or 'Not specified'}",
        f"Gender focus: {client.gender or 'Not specified'}",
        f"Business location: {client.business_location or 'Not specified'}",
        f"Target locations: {', '.join(client.target_locations or []) or 'Not specified'}",
        f"Website: {client.website or 'Not specified'}",
        f"GMB URL: {client.gmb_url or 'Not specified'}",
    ]

    competitor_lines = []
    for competitor in competitors:
        links = competitor.social_links or {}
        formatted_links = ', '.join(f"{platform}: {url}" for platform, url in links.items()) or 'No links saved'
        competitor_lines.append(f"- {competitor.name}: {formatted_links}")
    if not competitor_lines:
        competitor_lines.append("- None saved")

    connected_platform_lines = []
    for credential in credentials:
        account_name = (
            credential.page_name
            or credential.channel_name
            or credential.organization_name
            or credential.platform
        )
        connected_platform_lines.append(f"- {credential.platform}: {account_name}")
    if not connected_platform_lines:
        connected_platform_lines.append("- No connected platforms")

    recent_post_lines = []
    for post in recent_posts:
        caption = (post.caption or '').replace('\n', ' ').strip()
        if len(caption) > 220:
            caption = caption[:217] + '...'
        recent_post_lines.append(
            f"- {post.platform} | {post.post_type or 'post'} | {caption or 'No caption saved'}"
        )
    if not recent_post_lines:
        recent_post_lines.append("- No recent posts available")

    return "\n".join([
        "Client profile context:",
        *profile_lines,
        "",
        "Connected platforms:",
        *connected_platform_lines,
        "",
        "Saved competitors:",
        *competitor_lines,
        "",
        "Recent post examples from the system:",
        *recent_post_lines,
        "",
        "Instruction: Use this context to keep outputs aligned with the client's brand, audience, positioning, and content history. Blend it with the user's current request instead of ignoring either source.",
    ])
