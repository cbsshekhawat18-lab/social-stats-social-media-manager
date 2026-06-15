# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
social_stats.ai — centralised AI infrastructure for Social Stats.

Public API:
    AIClient            — tenant-scoped Anthropic wrapper (cache + rate-limit + log)
    AIError             — base exception for SDK / config failures
    RateLimited         — raised when client/global cap exceeded
    prompts             — prompt-template package (load by name)

Usage:

    from social_stats.ai import AIClient, prompts

    ai = AIClient(client=client, user=request.user, feature='caption')
    cfg = prompts.build('post_writer', topic='New summer menu', platform='instagram')
    text = ai.complete(cfg['user_message'], system=cfg['system'],
                       max_tokens=cfg['max_tokens'], temperature=cfg['temperature'])

For introspection / admin dashboards:

    from social_stats.ai import cost_tracker, rate_limiter
    cost_tracker.budget_status()
    rate_limiter.get_usage(client_id)
"""
from .client import AIClient, AIError
from .rate_limiter import RateLimited
from . import prompts
from . import cost_tracker
from . import rate_limiter
from . import cache

__all__ = [
    'AIClient',
    'AIError',
    'RateLimited',
    'prompts',
    'cost_tracker',
    'rate_limiter',
    'cache',
]
