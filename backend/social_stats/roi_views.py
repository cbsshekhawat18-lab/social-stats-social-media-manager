"""
ROI Calculator DRF views.
"""
from decimal import Decimal
from rest_framework.views import APIView
from rest_framework.generics import RetrieveUpdateAPIView, ListAPIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from .models import ROISettings, ROIReport, Client
from .serializers import ROISettingsSerializer, ROIReportSerializer
from .roi_calculator import calculate_roi, get_roi_trend


def _is_admin(user):
    try:
        return user.profile.role in ('superadmin', 'staff')
    except Exception:
        return False


class ROISettingsView(APIView):
    """GET/PUT /api/roi/settings/<client_id>/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, client_id):
        try:
            settings = ROISettings.objects.get(client_id=client_id)
            return Response(ROISettingsSerializer(settings).data)
        except ROISettings.DoesNotExist:
            # Return empty defaults
            return Response({
                'client':              client_id,
                'facebook_budget':     '0.00',
                'instagram_budget':    '0.00',
                'youtube_budget':      '0.00',
                'linkedin_budget':     '0.00',
                'gmb_budget':          '0.00',
                'agency_fee':          '0.00',
                'avg_sale_value':      '0.00',
                'conversion_rate':     '2.50',
                'lead_to_sale_rate':   '20.00',
                'currency':            'USD',
                'currency_symbol':     '$',
                'monthly_revenue_goal':'0.00',
                'monthly_leads_goal':  0,
                'configured':          False,
            })

    def put(self, request, client_id):
        if not _is_admin(request.user):
            return Response({'error': 'Only agency staff can update ROI settings.'}, status=403)
        try:
            client = Client.objects.get(id=client_id)
        except Client.DoesNotExist:
            return Response({'error': 'Client not found.'}, status=404)

        settings, _ = ROISettings.objects.get_or_create(client=client)
        serializer  = ROISettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)


class ROICalculateView(APIView):
    """POST /api/roi/calculate/  — calculates and saves to ROIReport."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        client_id = request.data.get('client_id')
        month     = request.data.get('month')
        year      = request.data.get('year')

        if not all([client_id, month, year]):
            return Response({'error': 'client_id, month, year are required.'}, status=400)

        try:
            result = calculate_roi(int(client_id), int(month), int(year))
        except ValueError as e:
            return Response({'error': str(e), 'not_configured': True}, status=400)
        except Exception as e:
            return Response({'error': f'Calculation failed: {str(e)}'}, status=500)

        # Save to ROIReport
        try:
            bd = result['platform_breakdown']
            roi_report, _ = ROIReport.objects.update_or_create(
                client_id=int(client_id), month=int(month), year=int(year),
                defaults={
                    'total_investment':  Decimal(str(result['total_investment'])),
                    'agency_fee':        Decimal(str(result['agency_fee'])),
                    'total_clicks':      result['total_clicks'],
                    'total_impressions': result['total_impressions'],
                    'total_reach':       result['total_reach'],
                    'website_clicks':    result['total_website_clicks'],
                    'estimated_leads':   result['estimated_leads'],
                    'estimated_sales':   result['estimated_sales'],
                    'estimated_revenue': Decimal(str(result['estimated_revenue'])),
                    'roi_percentage':    Decimal(str(result['roi_percentage'])),
                    'cost_per_click':    Decimal(str(result['cost_per_click'])),
                    'cost_per_lead':     Decimal(str(result['cost_per_lead'])),
                    'cost_per_sale':     Decimal(str(result['cost_per_sale'])),
                    'platform_breakdown': bd,
                }
            )
        except Exception:
            pass  # Don't fail the response if save fails

        result['trend'] = get_roi_trend(int(client_id))
        return Response(result)


class ROIReportView(ListAPIView):
    """GET /api/roi/reports/?client_id=&year="""
    permission_classes = [IsAuthenticated]
    serializer_class   = ROIReportSerializer

    def get_queryset(self):
        qs        = ROIReport.objects.select_related('client')
        client_id = self.request.query_params.get('client_id')
        year      = self.request.query_params.get('year')
        if client_id:
            qs = qs.filter(client_id=client_id)
        if year:
            qs = qs.filter(year=year)
        return qs.order_by('-year', '-month')


class ROILiveView(APIView):
    """GET /api/roi/live/?client_id=&month=&year=&<budget_params>  — does NOT save."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        client_id = request.query_params.get('client_id')
        month     = request.query_params.get('month')
        year      = request.query_params.get('year')

        if not all([client_id, month, year]):
            return Response({'error': 'client_id, month, year are required.'}, status=400)

        # Build override from query params
        def _d(key, default=0):
            v = request.query_params.get(key)
            try:
                return float(v) if v is not None else default
            except (ValueError, TypeError):
                return default

        override = {
            'facebook_budget':    _d('facebook_budget'),
            'instagram_budget':   _d('instagram_budget'),
            'youtube_budget':     _d('youtube_budget'),
            'linkedin_budget':    _d('linkedin_budget'),
            'gmb_budget':         _d('gmb_budget'),
            'agency_fee':         _d('agency_fee'),
            'avg_sale_value':     _d('avg_sale_value'),
            'conversion_rate':    _d('conversion_rate', 2.5),
            'lead_to_sale_rate':  _d('lead_to_sale_rate', 20.0),
            'monthly_revenue_goal': _d('monthly_revenue_goal'),
            'monthly_leads_goal': int(_d('monthly_leads_goal')),
            'currency':           request.query_params.get('currency', 'USD'),
            'currency_symbol':    request.query_params.get('currency_symbol', '$'),
        }

        try:
            result = calculate_roi(int(client_id), int(month), int(year), settings_override=override)
        except ValueError as e:
            return Response({'error': str(e), 'not_configured': True}, status=400)
        except Exception as e:
            return Response({'error': f'Calculation failed: {str(e)}'}, status=500)

        return Response(result)
