# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Seed the 8 industry-specific BotFlowTemplate rows.

Idempotent — re-running updates an existing template (matched by name) so we
can iterate on the JSON without duplicates. The data migration shipped with
Callers call into `seed()` here.
"""
from __future__ import annotations

from django.core.management.base import BaseCommand

from social_stats.models import BotFlowTemplate


# ─────────────────────────────────────────────────────────────────────────────
# Tiny DSL — keeps each template terse + readable
# ─────────────────────────────────────────────────────────────────────────────
def _build(steps: list[tuple]) -> tuple[list, list, str]:
    """Convert a linear list of (id, type, data) tuples into nodes/edges,
    auto-wiring sequential edges. The first id is the starting node.

    For branched nodes (message_buttons / condition / message_list), pass
    the edges separately via `branches` list at the end.
    """
    nodes = []
    edges = []
    starting_id = steps[0][0] if steps else ''
    for i, (nid, ntype, data) in enumerate(steps):
        nodes.append({
            'id': nid, 'type': ntype,
            'position': {'x': 80 + i * 240, 'y': 200 + (i % 2) * 60},
            'data': data,
        })
        if i > 0:
            edges.append({
                'id': f'e{i}',
                'source': steps[i - 1][0],
                'target': nid,
            })
    return nodes, edges, starting_id


# ─────────────────────────────────────────────────────────────────────────────
# Templates
# ─────────────────────────────────────────────────────────────────────────────
def _real_estate():
    nodes, edges, start = _build([
        ('start',    'start',         {}),
        ('greet',    'message_text',  {'text': 'Hi! 🏡 Looking for your next home? I can help.'}),
        ('ask_name', 'ask_question',  {'question': 'Could you share your name?', 'store_var': 'name'}),
        ('intent',   'message_buttons', {
            'body': '{{name}}, are you looking to:',
            'buttons': [
                {'id': 'BUY',  'title': 'Buy'},
                {'id': 'RENT', 'title': 'Rent'},
                {'id': 'SELL', 'title': 'Sell'},
            ],
            'store_var': 'intent',
        }),
        ('budget',   'message_list',  {
            'body': "What's your approximate budget?",
            'button_label': 'Pick budget',
            'store_var': 'budget',
            'sections': [{
                'title': 'Budget',
                'rows': [
                    {'id': 'B0',  'title': 'Under ₹50 L'},
                    {'id': 'B50', 'title': '₹50 L – ₹1 Cr'},
                    {'id': 'B100','title': '₹1 Cr – ₹2 Cr'},
                    {'id': 'B200','title': '₹2 Cr+'},
                ],
            }],
        }),
        ('loc',      'ask_question',  {'question': 'Which area / city interests you most?', 'store_var': 'location'}),
        ('timeline', 'message_buttons', {
            'body': "When are you planning to {{intent|default:'move'}}?",
            'buttons': [
                {'id': 'URG',   'title': 'This month'},
                {'id': 'M3',    'title': '1–3 months'},
                {'id': 'EXPL',  'title': 'Just exploring'},
            ],
            'store_var': 'timeline',
        }),
        ('phone',    'ask_phone',     {'question': 'Best number to reach you on?', 'store_var': 'phone'}),
        ('thanks',   'message_text',  {'text': "Thanks {{name}}! Our agent will reach out within 24 hours about {{intent|default:'options'}} in {{location}}."}),
        ('lead',     'capture_lead',  {'tags': ['ctwa', 'real-estate']}),
        ('end',      'end_conversation', {}),
    ])
    return {
        'name': 'Real-estate lead capture',
        'description': 'Greet → name → buy/rent/sell intent → budget → location → timeline → phone → save lead.',
        'industry': 'real_estate', 'use_case': 'lead_capture',
        'nodes': nodes, 'edges': edges, 'starting_node_id': start,
        'is_featured': True,
    }


def _healthcare():
    nodes, edges, start = _build([
        ('start',     'start',         {}),
        ('greet',     'message_text',  {'text': 'Hello 👋 We can help you book a consultation. Could you share your name?'}),
        ('ask_name',  'ask_question',  {'question': 'Your full name?', 'store_var': 'name'}),
        ('doctor',    'message_list',  {
            'body': 'Pick a department:',
            'button_label': 'Choose',
            'store_var': 'department',
            'sections': [{
                'title': 'Departments',
                'rows': [
                    {'id': 'GENERAL', 'title': 'General Physician'},
                    {'id': 'DENTAL',  'title': 'Dental'},
                    {'id': 'DERMA',   'title': 'Dermatology'},
                    {'id': 'ORTHO',   'title': 'Orthopedics'},
                ],
            }],
        }),
        ('reason',    'ask_question',  {'question': 'Briefly, what brings you in?', 'store_var': 'reason'}),
        ('when',      'ask_question',  {'question': 'Preferred date/time? (e.g., "Monday 4pm")', 'store_var': 'preferred_at'}),
        ('phone',     'ask_phone',     {'question': 'Number for confirmation?', 'store_var': 'phone'}),
        ('thanks',    'message_text',  {'text': 'Thanks {{name}}! Our front desk will confirm your {{department}} appointment for {{preferred_at}} shortly.'}),
        ('lead',      'capture_lead',  {'tags': ['ctwa', 'healthcare', 'appointment']}),
        ('end',       'end_conversation', {}),
    ])
    return {
        'name': 'Healthcare appointment booking',
        'description': 'Patient picks department, shares reason + preferred time → save lead.',
        'industry': 'healthcare', 'use_case': 'appointment_booking',
        'nodes': nodes, 'edges': edges, 'starting_node_id': start,
        'is_featured': True,
    }


def _restaurant():
    nodes, edges, start = _build([
        ('start',   'start',         {}),
        ('greet',   'message_text',  {'text': 'Welcome! 🍽 Let me grab a table for you.'}),
        ('guests',  'message_buttons', {
            'body': 'How many guests?',
            'buttons': [
                {'id': 'G2',  'title': '1–2'},
                {'id': 'G4',  'title': '3–4'},
                {'id': 'G5',  'title': '5+'},
            ],
            'store_var': 'guests',
        }),
        ('date',    'ask_question',  {'question': 'Which date?', 'store_var': 'date'}),
        ('time',    'ask_question',  {'question': 'What time?', 'store_var': 'time'}),
        ('seat',    'message_buttons', {
            'body': 'Seating preference?',
            'buttons': [
                {'id': 'IN',  'title': 'Indoor'},
                {'id': 'OUT', 'title': 'Outdoor'},
                {'id': 'PRV', 'title': 'Private'},
            ],
            'store_var': 'seating',
        }),
        ('name',    'ask_question',  {'question': 'Name to reserve under?', 'store_var': 'name'}),
        ('phone',   'ask_phone',     {'question': 'Phone for the booking?', 'store_var': 'phone'}),
        ('confirm', 'message_text',  {'text': 'Got it, {{name}} — table for {{guests}}, {{seating|default:"indoor"}}, on {{date}} at {{time}}. We will text you to confirm.'}),
        ('lead',    'capture_lead',  {'tags': ['ctwa', 'restaurant', 'reservation']}),
        ('end',     'end_conversation', {}),
    ])
    return {
        'name': 'Restaurant reservation',
        'description': 'Guest count → date → time → seating → name → phone → save lead.',
        'industry': 'restaurant', 'use_case': 'appointment_booking',
        'nodes': nodes, 'edges': edges, 'starting_node_id': start,
        'is_featured': True,
    }


def _fitness():
    nodes, edges, start = _build([
        ('start',    'start',         {}),
        ('greet',    'message_text',  {'text': 'Welcome! 💪 Tell us about your goals and we will recommend a plan.'}),
        ('goal',     'message_buttons', {
            'body': 'Primary goal?',
            'buttons': [
                {'id': 'WL', 'title': 'Weight loss'},
                {'id': 'MG', 'title': 'Muscle gain'},
                {'id': 'GF', 'title': 'General fitness'},
            ],
            'store_var': 'goal',
        }),
        ('exp',      'message_buttons', {
            'body': 'Your fitness level?',
            'buttons': [
                {'id': 'BEG',  'title': 'Beginner'},
                {'id': 'INT',  'title': 'Intermediate'},
                {'id': 'ADV',  'title': 'Advanced'},
            ],
            'store_var': 'experience',
        }),
        ('plan',     'message_buttons', {
            'body': 'How long do you want to commit?',
            'buttons': [
                {'id': 'M1',  'title': '1 month'},
                {'id': 'M3',  'title': '3 months'},
                {'id': 'M12', 'title': '12 months'},
            ],
            'store_var': 'plan_duration',
        }),
        ('name',     'ask_question',  {'question': 'Your name?', 'store_var': 'name'}),
        ('phone',    'ask_phone',     {'question': 'Best number to reach you?', 'store_var': 'phone'}),
        ('thanks',   'message_text',  {'text': 'Awesome {{name}} — a coach will share a {{plan_duration}} plan tailored to {{goal}} for {{experience}} levels.'}),
        ('lead',     'capture_lead',  {'tags': ['ctwa', 'fitness']}),
        ('end',      'end_conversation', {}),
    ])
    return {
        'name': 'Fitness / gym lead capture',
        'description': 'Goal → fitness level → plan length → name → phone → save lead.',
        'industry': 'fitness', 'use_case': 'lead_capture',
        'nodes': nodes, 'edges': edges, 'starting_node_id': start,
        'is_featured': False,
    }


def _ecommerce():
    nodes, edges, start = _build([
        ('start',     'start',         {}),
        ('greet',     'message_text',  {'text': 'Hi! 🛍 Looking at any product in particular?'}),
        ('product',   'ask_question',  {'question': 'Which product / SKU?', 'store_var': 'product'}),
        ('action',    'message_buttons', {
            'body': 'How can I help?',
            'buttons': [
                {'id': 'BUY', 'title': 'Buy now'},
                {'id': 'ASK', 'title': 'Ask a question'},
                {'id': 'BR',  'title': 'Browse more'},
            ],
            'store_var': 'next_action',
        }),
        ('name',      'ask_question',  {'question': 'Your name?', 'store_var': 'name'}),
        ('phone',     'ask_phone',     {'question': 'Phone we can reach you on?', 'store_var': 'phone'}),
        ('thanks',    'message_text',  {'text': 'Thanks {{name}}! A product expert will reach out about "{{product}}" within an hour.'}),
        ('lead',      'capture_lead',  {'tags': ['ctwa', 'ecommerce']}),
        ('end',       'end_conversation', {}),
    ])
    return {
        'name': 'E-commerce product inquiry',
        'description': 'Greet → product → action → name → phone → save lead.',
        'industry': 'ecommerce', 'use_case': 'product_inquiry',
        'nodes': nodes, 'edges': edges, 'starting_node_id': start,
        'is_featured': False,
    }


def _education():
    nodes, edges, start = _build([
        ('start',    'start',         {}),
        ('greet',    'message_text',  {'text': 'Hello! Tell us a bit about your goals and we will recommend a course.'}),
        ('name',     'ask_question',  {'question': 'Your name?', 'store_var': 'name'}),
        ('course',   'ask_question',  {'question': 'Course / programme of interest?', 'store_var': 'course'}),
        ('current',  'message_buttons', {
            'body': 'Current education level?',
            'buttons': [
                {'id': 'SCH', 'title': 'School'},
                {'id': 'UG',  'title': 'Undergrad'},
                {'id': 'PG',  'title': 'Postgrad'},
                {'id': 'WK',  'title': 'Working pro'},
            ],
            'store_var': 'education_level',
        }),
        ('mode',     'message_buttons', {
            'body': 'Preferred mode?',
            'buttons': [
                {'id': 'ONLINE',  'title': 'Online'},
                {'id': 'OFFLINE', 'title': 'Offline'},
                {'id': 'HYBRID',  'title': 'Hybrid'},
            ],
            'store_var': 'mode',
        }),
        ('phone',    'ask_phone',     {'question': 'Number for our counsellor?', 'store_var': 'phone'}),
        ('thanks',   'message_text',  {'text': 'Thanks {{name}}! We will share a {{mode}} {{course}} brochure in a moment.'}),
        ('lead',     'capture_lead',  {'tags': ['ctwa', 'education']}),
        ('end',      'end_conversation', {}),
    ])
    return {
        'name': 'Education / course inquiry',
        'description': 'Name → course → current level → mode → phone → save lead.',
        'industry': 'education', 'use_case': 'lead_capture',
        'nodes': nodes, 'edges': edges, 'starting_node_id': start,
        'is_featured': False,
    }


def _lead_magnet():
    nodes, edges, start = _build([
        ('start',    'start',         {}),
        ('greet',    'message_text',  {'text': 'Hi! Drop your email and we will send the free guide right over.'}),
        ('email',    'ask_email',     {'question': 'What is your email?', 'store_var': 'email'}),
        ('name',     'ask_question',  {'question': 'And your name?', 'store_var': 'name'}),
        ('phone',    'ask_phone',     {'question': '(Optional) phone, in case we need to follow up.', 'store_var': 'phone'}),
        ('thanks',   'message_text',  {'text': 'Sent it to {{email}}! Let us know if it does not arrive.'}),
        ('lead',     'capture_lead',  {'tags': ['ctwa', 'lead-magnet']}),
        ('end',      'end_conversation', {}),
    ])
    return {
        'name': 'General lead magnet',
        'description': 'Email + name → save lead. Use this with a "free guide" CTWA ad.',
        'industry': 'general', 'use_case': 'lead_magnet',
        'nodes': nodes, 'edges': edges, 'starting_node_id': start,
        'is_featured': True,
    }


def _support():
    nodes, edges, start = _build([
        ('start',    'start',         {}),
        ('greet',    'message_text',  {'text': 'Hi! How can I help today? You can also type "agent" anytime to reach a human.'}),
        ('ai',       'ai_chat',       {
            'persona': 'You are a helpful customer-service assistant. Answer briefly. If asked anything you cannot verify, suggest connecting to a human teammate.',
            'opening_message': 'Sure — what would you like help with?',
            'max_turns': 8,
            'exit_keywords': ['agent', 'human', 'staff', 'representative', 'stop'],
        }),
        ('handoff',  'human_handoff', {'message': "I'll connect you to a teammate now."}),
    ])
    return {
        'name': 'Customer support triage',
        'description': 'AI chat handles common questions; user-typed "agent" hands off to a human.',
        'industry': 'general', 'use_case': 'support',
        'nodes': nodes, 'edges': edges, 'starting_node_id': start,
        'is_featured': False,
    }


ALL_TEMPLATES = [
    _real_estate, _healthcare, _restaurant, _fitness,
    _ecommerce, _education, _lead_magnet, _support,
]


def seed():
    """Idempotent seeder — run from migration or management command."""
    for builder in ALL_TEMPLATES:
        spec = builder()
        BotFlowTemplate.objects.update_or_create(
            name=spec['name'],
            defaults={
                'description':      spec['description'],
                'industry':         spec['industry'],
                'use_case':         spec['use_case'],
                'nodes':            spec['nodes'],
                'edges':            spec['edges'],
                'starting_node_id': spec['starting_node_id'],
                'is_featured':      spec.get('is_featured', False),
            },
        )


class Command(BaseCommand):
    help = 'Seed the 8 industry-specific BotFlowTemplate rows.'

    def handle(self, *args, **opts):
        seed()
        self.stdout.write(self.style.SUCCESS(
            f'Seeded {len(ALL_TEMPLATES)} templates.'
        ))
