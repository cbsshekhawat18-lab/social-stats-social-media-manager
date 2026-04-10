"""
User profile, password change, and agency disconnect views.
"""
import os
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone

from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response

from .models import UserProfile, Notification, Client, ClientInvitation
from .social_auth_views import _make_jwt

FRONTEND_URL   = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
FROM_EMAIL     = getattr(settings, 'DEFAULT_FROM_EMAIL', 'Statox <noreply@statox.ai>')


# ── Get / Update profile ──────────────────────────────────────────────────────

@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def user_profile(request):
    user    = request.user
    profile = getattr(user, 'profile', None)

    if request.method == 'GET':
        avatar_url = None
        if profile and profile.avatar:
            avatar_url = request.build_absolute_uri(profile.avatar.url)
        return Response({
            'id':            user.id,
            'first_name':    user.first_name,
            'last_name':     user.last_name,
            'email':         user.email,
            'role':          profile.role if profile else 'client',
            'avatar':        avatar_url,
            'is_social':     not user.has_usable_password(),
            'email_verified': profile.email_verified if profile else True,
            'agency_name':   _get_agency_name(profile),
            'agency_email':  _get_agency_email(profile),
            'agency_since':  _get_agency_since(profile),
        })

    # PATCH
    data       = request.data
    first_name = (data.get('first_name') or '').strip()
    last_name  = (data.get('last_name') or '').strip()

    if not first_name:
        return Response({'error': 'First name is required.'}, status=400)

    user.first_name = first_name
    user.last_name  = last_name
    user.save(update_fields=['first_name', 'last_name'])

    # Avatar upload
    avatar_file = request.FILES.get('avatar')
    if avatar_file and profile:
        # Delete old avatar
        if profile.avatar:
            try:
                old_path = profile.avatar.path
                if os.path.exists(old_path):
                    os.remove(old_path)
            except Exception:
                pass
        profile.avatar = avatar_file
        profile.save(update_fields=['avatar'])

    # Remove avatar
    if data.get('remove_avatar') and profile and profile.avatar:
        try:
            old_path = profile.avatar.path
            if os.path.exists(old_path):
                os.remove(old_path)
        except Exception:
            pass
        profile.avatar = None
        profile.save(update_fields=['avatar'])

    avatar_url = None
    if profile and profile.avatar:
        avatar_url = request.build_absolute_uri(profile.avatar.url)

    return Response({
        'first_name': user.first_name,
        'last_name':  user.last_name,
        'avatar':     avatar_url,
    })


# ── Change password ───────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    user = request.user

    if not user.has_usable_password():
        return Response({'error': 'Your account uses social login. Password change is not available.'}, status=400)

    current  = request.data.get('current_password', '')
    new_pwd  = request.data.get('new_password', '')
    confirm  = request.data.get('confirm_password', '')

    if not current or not new_pwd or not confirm:
        return Response({'error': 'All fields are required.'}, status=400)

    if not user.check_password(current):
        return Response({'error': 'Current password is incorrect.'}, status=400)

    if new_pwd != confirm:
        return Response({'error': 'New passwords do not match.'}, status=400)

    try:
        validate_password(new_pwd, user)
    except ValidationError as e:
        return Response({'error': ' '.join(e.messages)}, status=400)

    user.set_password(new_pwd)
    user.save(update_fields=['password'])

    return Response({'detail': 'Password changed successfully.'})


# ── Agency info ───────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def agency_info(request):
    profile = getattr(request.user, 'profile', None)
    if not profile or profile.role != 'client':
        return Response({'error': 'Only clients can access agency info.'}, status=403)

    if not profile.agency:
        return Response({'connected': False})

    return Response({
        'connected':     True,
        'agency_name':   _get_agency_name(profile),
        'agency_email':  _get_agency_email(profile),
        'agency_since':  _get_agency_since(profile),
    })


# ── Disconnect from agency ────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def disconnect_agency(request):
    user    = request.user
    profile = getattr(user, 'profile', None)

    if not profile or profile.role != 'client':
        return Response({'error': 'Only clients can disconnect from an agency.'}, status=403)

    if not profile.agency:
        return Response({'error': 'You are not connected to any agency.'}, status=400)

    agency_user  = profile.agency
    agency_name  = agency_user.get_full_name() or agency_user.email
    client_name  = user.get_full_name() or user.email

    # Disconnect
    profile.agency = None
    profile.save(update_fields=['agency'])

    # Notify agency via in-app notification
    Notification.objects.create(
        user      = agency_user,
        notif_type= 'system',
        title     = f"{client_name} has disconnected from your agency",
        body      = f"{client_name} ({user.email}) has removed your access to their account.",
        data      = {'client_email': user.email, 'event': 'agency_disconnected'},
    )

    # Email to agency
    _send_disconnect_email_to_agency(agency_user, agency_name, client_name, user.email)

    # New JWT without agency reference
    access, refresh = _make_jwt(user)

    return Response({
        'detail':  'Successfully disconnected from agency.',
        'access':  access,
        'refresh': refresh,
    })


# ── Email helpers ─────────────────────────────────────────────────────────────

def _get_agency_name(profile):
    if profile and profile.agency:
        return profile.agency.get_full_name() or profile.agency.email
    return None

def _get_agency_email(profile):
    if profile and profile.agency:
        return profile.agency.email
    return None

def _get_agency_since(profile):
    # Use the accepted invitation date if available
    if profile and profile.agency:
        from .models import ClientInvitation
        inv = ClientInvitation.objects.filter(
            invited_by=profile.agency,
            client_email__iexact=profile.user.email,
            status='accepted',
        ).order_by('-responded_at').first()
        if inv and inv.responded_at:
            return inv.responded_at.isoformat()
    return None


def _email_template(title, greeting, body_html, cta_url, cta_label, note, info_card_html=''):
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:linear-gradient(160deg,#f0f9ff 0%,#f0f4f9 50%,#f5f0ff 100%);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 20px 40px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:24px;border:1px solid rgba(0,215,255,0.18);
                    box-shadow:0 8px 40px rgba(15,23,42,0.10);overflow:hidden;">
        <tr><td style="background:linear-gradient(90deg,#00d7ff,#0099bb);height:4px;font-size:0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:32px 40px 24px;text-align:center;background:#ffffff;">
            <img src="{FRONTEND_URL}/favicon.png" alt="Statox" width="52" height="52"
                 style="border-radius:14px;display:inline-block;box-shadow:0 4px 16px rgba(0,215,255,0.25);margin-bottom:14px;" /><br>
            <span style="font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.04em;">Statox</span><span style="font-size:22px;font-weight:800;color:#00b8d9;letter-spacing:-0.04em;">.ai</span>
          </td>
        </tr>
        <tr><td style="padding:0 40px;"><div style="height:1px;background:linear-gradient(90deg,transparent,rgba(0,215,255,0.2),transparent);"></div></td></tr>
        <tr>
          <td style="padding:36px 40px 32px;">
            <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0f172a;letter-spacing:-0.03em;">{title}</h1>
            <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.7;">{greeting}</p>
            {info_card_html}
            {body_html}
            {"" if not cta_url else f'''<div style="text-align:center;margin:28px 0;">
              <a href="{cta_url}" style="display:inline-block;background:linear-gradient(135deg,#00d7ff,#00b0d0);color:#021418;font-weight:800;font-size:15px;padding:15px 40px;border-radius:14px;text-decoration:none;box-shadow:0 8px 24px rgba(0,215,255,0.3);">{cta_label}</a>
            </div>'''}
            <div style="background:linear-gradient(135deg,#f0f9ff,#f8faff);border:1px solid rgba(0,215,255,0.15);border-radius:12px;padding:14px 18px;">
              <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">{note}</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:linear-gradient(135deg,#f8fafc,#f0f9ff);padding:20px 40px;text-align:center;border-top:1px solid rgba(0,215,255,0.1);">
            <p style="margin:0;font-size:12px;color:#94a3b8;">&copy; 2026 <strong style="color:#64748b;">Statox.ai</strong> &mdash; Automation Intelligence Platform</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def send_invitation_accepted_email(client_user, agency_name, agency_email):
    """Email to client confirming they are now connected to agency."""
    name = client_user.first_name or client_user.email.split('@')[0]
    info = f"""<div style="background:linear-gradient(135deg,#f5f3ff,#faf0ff);border:1px solid rgba(124,58,237,0.15);border-radius:14px;padding:20px 24px;margin:0 0 24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:0.08em;">Connected Agency</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">{agency_name}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#64748b;">{agency_email}</p>
    </div>"""
    html = _email_template(
        title        = 'You\'re connected!',
        greeting     = f'Hi <strong style="color:#0f172a;">{name}</strong>, your account is now connected to <strong style="color:#0f172a;">{agency_name}</strong> on Statox. They can now manage your analytics and reports.',
        body_html    = '',
        cta_url      = f'{FRONTEND_URL}/dashboard',
        cta_label    = 'Go to Dashboard',
        note         = 'You can disconnect from your agency at any time from your Account Settings.',
        info_card_html = info,
    )
    plain = f"Hi {name},\n\nYour Statox account is now connected to {agency_name} ({agency_email}).\n\nGo to your dashboard: {FRONTEND_URL}/dashboard"
    try:
        send_mail(
            f'You\'re now connected to {agency_name} on Statox',
            plain, FROM_EMAIL, [client_user.email],
            html_message=html, fail_silently=True,
        )
    except Exception:
        pass


def _send_account_deleted_email_to_agency(agency_user, agency_name, client_name, client_email, reason):
    """Email to agency when their client deletes their Statox account."""
    name = agency_user.first_name or agency_user.email.split('@')[0]
    reason_html = f'<p style="margin:8px 0 0;font-size:13px;color:#64748b;"><strong>Reason:</strong> {reason}</p>' if reason else ''
    info = f"""<div style="background:linear-gradient(135deg,#fff5f5,#fff0f0);border:1px solid rgba(220,38,38,0.15);border-radius:14px;padding:20px 24px;margin:0 0 24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.08em;">Account Deleted</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">{client_name}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#64748b;">{client_email}</p>
      {reason_html}
    </div>"""
    html = _email_template(
        title        = 'A client deleted their account',
        greeting     = f'Hi <strong style="color:#0f172a;">{name}</strong>, we\'re letting you know that a client has permanently deleted their Statox account.',
        body_html    = '<p style="font-size:14px;color:#64748b;line-height:1.7;margin:0 0 20px;">Their account and all associated data have been permanently removed from Statox. You can no longer access their analytics or reports.</p>',
        cta_url      = f'{FRONTEND_URL}/admin/clients',
        cta_label    = 'View Clients',
        note         = 'This action is permanent and cannot be undone.',
        info_card_html = info,
    )
    plain = f"Hi {name},\n\n{client_name} ({client_email}) has permanently deleted their Statox account.\n\nReason: {reason or 'Not provided'}\n\nAll their data has been removed."
    try:
        send_mail(
            f'{client_name} deleted their Statox account',
            plain, FROM_EMAIL, [agency_user.email],
            html_message=html, fail_silently=True,
        )
    except Exception:
        pass


def _send_disconnect_email_to_agency(agency_user, agency_name, client_name, client_email):
    """Email to agency when client disconnects."""
    name = agency_user.first_name or agency_user.email.split('@')[0]
    info = f"""<div style="background:linear-gradient(135deg,#fff5f5,#fff0f0);border:1px solid rgba(220,38,38,0.15);border-radius:14px;padding:20px 24px;margin:0 0 24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.08em;">Client Disconnected</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">{client_name}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#64748b;">{client_email}</p>
    </div>"""
    html = _email_template(
        title        = 'A client has disconnected',
        greeting     = f'Hi <strong style="color:#0f172a;">{name}</strong>, we\'re letting you know that a client has removed your agency\'s access to their Statox account.',
        body_html    = '<p style="font-size:14px;color:#64748b;line-height:1.7;margin:0 0 20px;">Their data and connected accounts are no longer accessible to your agency. You can send them a new invitation if needed.</p>',
        cta_url      = f'{FRONTEND_URL}/admin/clients',
        cta_label    = 'View Clients',
        note         = 'If you believe this was a mistake, you can reach out to the client directly and send a new invitation from your dashboard.',
        info_card_html = info,
    )
    plain = f"Hi {name},\n\n{client_name} ({client_email}) has disconnected from your agency on Statox.\n\nYou can send them a new invitation from your dashboard: {FRONTEND_URL}/admin/clients"
    try:
        send_mail(
            f'{client_name} has disconnected from your agency',
            plain, FROM_EMAIL, [agency_user.email],
            html_message=html, fail_silently=True,
        )
    except Exception:
        pass


# ── Delete Account ────────────────────────────────────────────────────────────

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_account(request):
    """
    Permanently delete a client's account and all related data.
    Only available to client role.
    Body: { reason: str }
    """
    user    = request.user
    profile = getattr(user, 'profile', None)

    if not profile or profile.role != 'client':
        return Response({'error': 'Only client accounts can be deleted this way.'}, status=403)

    reason      = (request.data.get('reason') or '').strip()
    client      = profile.client
    client_name = user.get_full_name() or user.email
    client_email = user.email

    # Notify connected agency before deletion
    if profile.agency:
        agency_user = profile.agency
        agency_name = agency_user.get_full_name() or agency_user.email
        try:
            Notification.objects.create(
                user       = agency_user,
                notif_type = 'system',
                title      = f'{client_name} deleted their Statox account',
                body       = reason or 'No reason provided.',
                data       = {'client_email': client_email, 'event': 'account_deleted'},
            )
            _send_account_deleted_email_to_agency(agency_user, agency_name, client_name, client_email, reason)
        except Exception:
            pass

    # Delete Client record — all related data cascades (metrics, credentials,
    # posts, goals, alerts, insights, ROI, calendar, captions, hashtags, etc.)
    if client:
        client.delete()

    # Delete the Django User — cascades UserProfile, tokens, invitations
    user.delete()

    return Response({'detail': 'Your account has been permanently deleted.'}, status=200)
