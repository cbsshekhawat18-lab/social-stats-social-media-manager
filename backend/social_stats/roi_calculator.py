# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
ROI calculation engine — standalone module.
"""
from decimal import Decimal
from datetime import date
from django.db.models import Sum


def _safe_div(numerator, denominator, default=Decimal('0')):
    """Division that returns default on zero/None denominator."""
    try:
        if not denominator or denominator == 0:
            return default
        return Decimal(str(numerator)) / Decimal(str(denominator))
    except Exception:
        return default


def _pct_change(current, previous):
    """Returns % change as float, or None if previous is 0."""
    try:
        if not previous or previous == 0:
            return None
        return round(((float(current) - float(previous)) / float(previous)) * 100, 1)
    except Exception:
        return None


PLATFORM_BUDGET_MAP = {
    'facebook':          'facebook_budget',
    'instagram':         'instagram_budget',
    'youtube':           'youtube_budget',
    'linkedin':          'linkedin_budget',
    'google_my_business':'gmb_budget',
}


def calculate_roi(client_id, month, year, settings_override=None):
    """
    Full ROI calculation. Returns a dict with all metrics.
    settings_override: dict of field overrides (used for live calculator).
    Raises ValueError if ROISettings not configured.
    """
    from .models import ROISettings, DailyMetric, Client

    try:
        client = Client.objects.get(id=client_id)
    except Client.DoesNotExist:
        raise ValueError(f"Client {client_id} not found")

    # Get settings (or raise)
    try:
        settings = ROISettings.objects.get(client_id=client_id)
    except ROISettings.DoesNotExist:
        if settings_override is None:
            raise ValueError("ROI settings not configured for this client. Please set up budgets and business numbers first.")
        # Build a temporary settings-like object from override
        settings = _DictSettings(settings_override)

    # Apply overrides if provided
    if settings_override:
        settings = _DictSettings({
            'facebook_budget':    settings_override.get('facebook_budget',    getattr(settings, 'facebook_budget',    0)),
            'instagram_budget':   settings_override.get('instagram_budget',   getattr(settings, 'instagram_budget',   0)),
            'youtube_budget':     settings_override.get('youtube_budget',     getattr(settings, 'youtube_budget',     0)),
            'linkedin_budget':    settings_override.get('linkedin_budget',    getattr(settings, 'linkedin_budget',    0)),
            'gmb_budget':         settings_override.get('gmb_budget',         getattr(settings, 'gmb_budget',         0)),
            'agency_fee':         settings_override.get('agency_fee',         getattr(settings, 'agency_fee',         0)),
            'avg_sale_value':     settings_override.get('avg_sale_value',     getattr(settings, 'avg_sale_value',     0)),
            'conversion_rate':    settings_override.get('conversion_rate',    getattr(settings, 'conversion_rate',    2.5)),
            'lead_to_sale_rate':  settings_override.get('lead_to_sale_rate',  getattr(settings, 'lead_to_sale_rate',  20.0)),
            'currency':           settings_override.get('currency',           getattr(settings, 'currency',           'USD')),
            'currency_symbol':    settings_override.get('currency_symbol',    getattr(settings, 'currency_symbol',    '$')),
            'monthly_revenue_goal': settings_override.get('monthly_revenue_goal', getattr(settings, 'monthly_revenue_goal', 0)),
            'monthly_leads_goal': settings_override.get('monthly_leads_goal', getattr(settings, 'monthly_leads_goal', 0)),
        })

    # Date ranges
    since = date(year, month, 1)
    if month == 12:
        until = date(year + 1, 1, 1)
        import datetime
        until = until - datetime.timedelta(days=1)
    else:
        import datetime
        until = date(year, month + 1, 1) - datetime.timedelta(days=1)

    # Previous month
    if month == 1:
        prev_month, prev_year = 12, year - 1
    else:
        prev_month, prev_year = month - 1, year

    prev_since = date(prev_year, prev_month, 1)
    if prev_month == 12:
        import datetime
        prev_until = date(prev_year + 1, 1, 1) - datetime.timedelta(days=1)
    else:
        import datetime
        prev_until = date(prev_year, prev_month + 1, 1) - datetime.timedelta(days=1)

    # Aggregate per platform
    platform_rows = list(
        DailyMetric.objects.filter(
            client_id=client_id, date__range=(since, until)
        ).values('platform').annotate(
            impressions=Sum('impressions'),
            reach=Sum('reach'),
            clicks=Sum('clicks'),
            website_clicks=Sum('website_clicks'),
            video_views=Sum('video_views'),
            followers=Sum('followers'),
            phone_calls=Sum('phone_calls'),
        )
    )

    prev_rows = list(
        DailyMetric.objects.filter(
            client_id=client_id, date__range=(prev_since, prev_until)
        ).values('platform').annotate(
            impressions=Sum('impressions'),
            reach=Sum('reach'),
            clicks=Sum('clicks'),
            website_clicks=Sum('website_clicks'),
        )
    )
    prev_map = {r['platform']: r for r in prev_rows}

    # Totals
    total_impressions = sum(r['impressions'] or 0 for r in platform_rows)
    total_reach       = sum(r['reach'] or 0 for r in platform_rows)
    total_clicks      = sum(r['clicks'] or 0 for r in platform_rows)
    total_website_clicks = sum(r['website_clicks'] or 0 for r in platform_rows)

    # Previous month totals
    prev_impressions = sum(r['impressions'] or 0 for r in prev_rows)
    prev_reach       = sum(r['reach'] or 0 for r in prev_rows)
    prev_clicks      = sum(r['clicks'] or 0 for r in prev_rows)
    prev_website_clicks = sum(r['website_clicks'] or 0 for r in prev_rows)

    # Investment
    conv_rate       = Decimal(str(settings.conversion_rate))
    lead_sale_rate  = Decimal(str(settings.lead_to_sale_rate))
    avg_sale        = Decimal(str(settings.avg_sale_value))
    agency_fee      = Decimal(str(settings.agency_fee))

    total_ad_spend = (
        Decimal(str(settings.facebook_budget)) +
        Decimal(str(settings.instagram_budget)) +
        Decimal(str(settings.youtube_budget)) +
        Decimal(str(settings.linkedin_budget)) +
        Decimal(str(settings.gmb_budget))
    )
    total_investment = total_ad_spend + agency_fee

    # Conversion funnel
    estimated_leads = int(Decimal(str(total_website_clicks)) * conv_rate / Decimal('100'))
    estimated_sales = int(Decimal(str(estimated_leads)) * lead_sale_rate / Decimal('100'))
    estimated_revenue = Decimal(str(estimated_sales)) * avg_sale

    # ROI
    roi_pct = _safe_div(
        (estimated_revenue - total_investment) * Decimal('100'),
        total_investment,
        Decimal('0')
    )

    # Cost metrics
    cpc  = _safe_div(total_investment, total_clicks)
    cpl  = _safe_div(total_investment, estimated_leads)
    cps  = _safe_div(total_investment, estimated_sales)

    # Per-platform breakdown
    platform_breakdown = []
    for row in platform_rows:
        plat = row['platform']
        budget_field = PLATFORM_BUDGET_MAP.get(plat)
        plat_budget = Decimal(str(getattr(settings, budget_field, 0))) if budget_field else Decimal('0')

        plat_wc    = row['website_clicks'] or 0
        plat_leads = int(Decimal(str(plat_wc)) * conv_rate / Decimal('100'))
        plat_sales = int(Decimal(str(plat_leads)) * lead_sale_rate / Decimal('100'))
        plat_rev   = Decimal(str(plat_sales)) * avg_sale
        plat_inv   = plat_budget + (agency_fee / Decimal(str(len(platform_rows))) if platform_rows else Decimal('0'))
        plat_roi   = _safe_div(
            (plat_rev - plat_inv) * Decimal('100'),
            plat_inv, Decimal('0')
        )
        prev = prev_map.get(plat, {})
        platform_breakdown.append({
            'platform':     plat,
            'budget':       float(plat_budget),
            'impressions':  row['impressions'] or 0,
            'reach':        row['reach'] or 0,
            'clicks':       row['clicks'] or 0,
            'website_clicks': plat_wc,
            'leads':        plat_leads,
            'sales':        plat_sales,
            'revenue':      float(plat_rev),
            'roi_percentage': float(round(plat_roi, 2)),
            'vs_prev_impressions': _pct_change(row['impressions'] or 0, prev.get('impressions') or 0),
            'vs_prev_clicks': _pct_change(row['clicks'] or 0, prev.get('clicks') or 0),
        })

    # Goal progress
    rev_goal = Decimal(str(settings.monthly_revenue_goal))
    leads_goal = int(settings.monthly_leads_goal)
    revenue_goal_pct = float(_safe_div(estimated_revenue * Decimal('100'), rev_goal)) if rev_goal > 0 else None
    leads_goal_pct   = (estimated_leads / leads_goal * 100) if leads_goal > 0 else None

    # Per $1 invested
    per_dollar = _safe_div(estimated_revenue, total_investment, Decimal('0'))

    return {
        'client_id':   client_id,
        'client_name': client.company,
        'month':       month,
        'year':        year,
        'currency':    settings.currency,
        'currency_symbol': settings.currency_symbol,

        # Investment
        'total_investment':  float(round(total_investment, 2)),
        'total_ad_spend':    float(round(total_ad_spend, 2)),
        'agency_fee':        float(round(agency_fee, 2)),

        # Traffic
        'total_impressions':    total_impressions,
        'total_reach':          total_reach,
        'total_clicks':         total_clicks,
        'total_website_clicks': total_website_clicks,

        # Funnel
        'conversion_rate':    float(conv_rate),
        'lead_to_sale_rate':  float(lead_sale_rate),
        'estimated_leads':    estimated_leads,
        'estimated_sales':    estimated_sales,
        'estimated_revenue':  float(round(estimated_revenue, 2)),

        # ROI
        'roi_percentage': float(round(roi_pct, 2)),
        'per_dollar_earned': float(round(per_dollar, 4)),

        # Cost metrics
        'cost_per_click': float(round(cpc, 4)),
        'cost_per_lead':  float(round(cpl, 4)),
        'cost_per_sale':  float(round(cps, 4)),

        # Platform breakdown
        'platform_breakdown': platform_breakdown,
        'has_data': len(platform_rows) > 0,

        # Previous month comparison
        'vs_prev': {
            'impressions':    _pct_change(total_impressions, prev_impressions),
            'reach':          _pct_change(total_reach, prev_reach),
            'clicks':         _pct_change(total_clicks, prev_clicks),
            'website_clicks': _pct_change(total_website_clicks, prev_website_clicks),
        },

        # Goal progress
        'goals': {
            'revenue_goal':     float(rev_goal),
            'leads_goal':       leads_goal,
            'revenue_progress': revenue_goal_pct,
            'leads_progress':   leads_goal_pct,
        },

        # Settings snapshot (for UI)
        'settings': {
            'facebook_budget':   float(settings.facebook_budget),
            'instagram_budget':  float(settings.instagram_budget),
            'youtube_budget':    float(settings.youtube_budget),
            'linkedin_budget':   float(settings.linkedin_budget),
            'gmb_budget':        float(settings.gmb_budget),
            'agency_fee':        float(agency_fee),
            'avg_sale_value':    float(avg_sale),
            'conversion_rate':   float(conv_rate),
            'lead_to_sale_rate': float(lead_sale_rate),
            'monthly_revenue_goal': float(rev_goal),
            'monthly_leads_goal':   leads_goal,
        },
    }


def get_roi_trend(client_id, months=6):
    """Returns last N months of saved ROIReport records for charting."""
    from .models import ROIReport
    reports = list(
        ROIReport.objects.filter(client_id=client_id)
        .order_by('-year', '-month')[:months]
    )
    return [
        {
            'month':            r.month,
            'year':             r.year,
            'label':            f"{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][r.month-1]} {r.year}",
            'roi_percentage':   float(r.roi_percentage),
            'estimated_revenue': float(r.estimated_revenue),
            'total_investment': float(r.total_investment),
            'estimated_leads':  r.estimated_leads,
            'estimated_sales':  r.estimated_sales,
        }
        for r in reversed(reports)
    ]


class _DictSettings:
    """Wraps a dict as an attribute-accessible settings object."""
    def __init__(self, d):
        self._d = {k: v for k, v in d.items()}

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError(name)
        return self._d.get(name, 0)
