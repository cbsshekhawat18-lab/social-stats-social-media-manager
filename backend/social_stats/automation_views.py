# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Automation rule API.

ViewSet:
  - AutomationRuleViewSet — CRUD + actions: toggle / run_now / templates

`templates` is a *collection*-level action that returns the prebuilt rule
templates from automation_engine.RULE_TEMPLATES (no DB writes — just JSON).
"""
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .automation_engine import RULE_TEMPLATES, evaluate_automation_rules
from .models import AutomationRule
from .tenant_mixins import TenantScopedMixin


class AutomationRuleSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = AutomationRule
        fields = [
            'id', 'client',
            'name',
            'trigger_type', 'trigger_filters',
            'action_type',  'action_config',
            'is_active',
            'run_count', 'last_run_at',
            'created_by', 'created_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'run_count', 'last_run_at',
            'created_by', 'created_by_name',
            'created_at', 'updated_at',
        ]
        # Client is stamped by TenantScopedMixin.perform_create — never trusted
        # from the request body, but the field is exposed read-only for clients.
        extra_kwargs = {
            'client': {'required': False, 'read_only': True},
        }

    def validate_trigger_filters(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('trigger_filters must be an object')
        return value

    def validate_action_config(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('action_config must be an object')
        return value


class AutomationRuleViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = AutomationRule.objects.all()
    serializer_class = AutomationRuleSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get('active'):
            qs = qs.filter(is_active=(params['active'] in ('1', 'true', 'True')))
        if params.get('trigger_type'):
            qs = qs.filter(trigger_type=params['trigger_type'])
        return qs

    @action(detail=True, methods=['post'])
    def toggle(self, request, pk=None):
        rule = self.get_object()
        rule.is_active = not rule.is_active
        rule.save(update_fields=['is_active'])
        return Response({'is_active': rule.is_active})

    @action(detail=True, methods=['post'])
    def run_now(self, request, pk=None):
        """Manual trigger for testing — fires the rule against an arbitrary
        object_id provided in the body. Useful for the rule-builder UI's
        'Test rule' button."""
        rule = self.get_object()
        event_type = request.data.get('event_type')
        object_id  = request.data.get('object_id')
        if event_type not in ('message_created', 'review_created'):
            return Response({'error': 'event_type must be message_created or review_created'},
                            status=400)
        if not object_id:
            return Response({'error': 'object_id is required'}, status=400)
        # Run synchronously so the caller sees the result; it goes through the
        # same evaluator — only this rule's id gets touched if it matches.
        # NB: this could fire OTHER rules too. For that's acceptable.
        evaluate_automation_rules(event_type, int(object_id), rule.client_id)
        rule.refresh_from_db()
        return Response({
            'run_count':   rule.run_count,
            'last_run_at': rule.last_run_at,
        })

    @action(detail=False, methods=['get'])
    def templates(self, request):
        """Return the pre-built rule templates (no DB writes)."""
        return Response({'templates': RULE_TEMPLATES})
