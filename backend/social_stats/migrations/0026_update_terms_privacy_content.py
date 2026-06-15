# Generated manually on 2026-04-10
# Updates Terms of Service and Privacy Policy to meet Google, Meta, and LinkedIn API compliance.

import datetime
from django.db import migrations


def update_site_content(apps, schema_editor):
    SiteContent = apps.get_model('social_stats', 'SiteContent')

    # ── Privacy Policy ────────────────────────────────────────────────────────
    SiteContent.objects.update_or_create(
        key='privacy-policy',
        defaults={
            'title': 'Privacy Policy',
            'effective_date': datetime.date(2026, 4, 10),
            'last_updated': datetime.date(2026, 4, 10),
            'is_public': True,
            'content': {
                'footer_link_label': 'Terms of Service',
                'footer_link_url': '/terms',
                'sections': [
                    {
                        'title': '1. Introduction',
                        'html': (
                            '<p>Social Stats ("we", "our", or "us") operates a social media analytics platform at '
                            '<strong>socialstats.app</strong>. We connect to Facebook, Instagram, Google, YouTube, and LinkedIn '
                            'to display performance statistics for your social accounts. This Privacy Policy explains what '
                            'data we collect, how we use it, how we protect it, and the rights available to you.</p>'
                            '<p>By using Social Stats you agree to this Privacy Policy. If you do not agree, please disconnect '
                            'your accounts and stop using the Service.</p>'
                        ),
                    },
                    {
                        'title': '2. Data We Collect',
                        'html': (
                            '<p>We collect only the data necessary to provide the analytics service:</p>'
                            '<ul>'
                            '<li><strong>Account identifiers</strong> — page IDs, channel IDs, and profile IDs from connected accounts</li>'
                            '<li><strong>Performance metrics</strong> — reach, impressions, likes, comments, shares, follower counts, engagement rates, video views, watch time</li>'
                            '<li><strong>Post data</strong> — post captions, media thumbnails, published timestamps, and per-post metrics retrieved from platform APIs</li>'
                            '<li><strong>Basic profile information</strong> — name and profile picture of connected pages/accounts</li>'
                            '<li><strong>OAuth tokens</strong> — access tokens and refresh tokens issued by each platform, stored encrypted, used solely to fetch analytics on your behalf</li>'
                            '<li><strong>Account information</strong> — email address, name, and role within Social Stats, provided at registration</li>'
                            '</ul>'
                            '<p>We do <strong>not</strong> collect passwords to third-party platforms, private messages, '
                            'friend lists, personal photos, or any data beyond what is needed for analytics.</p>'
                        ),
                    },
                    {
                        'title': '3. How We Use Your Data',
                        'html': (
                            '<p>Data collected is used exclusively for the following purposes:</p>'
                            '<ul>'
                            '<li>Displaying analytics dashboards and reports within Social Stats</li>'
                            '<li>Syncing performance data on a scheduled basis so your statistics remain current</li>'
                            '<li>Generating AI-powered insights and recommendations based on your performance trends</li>'
                            '<li>Producing shareable reports you choose to export or share</li>'
                            '<li>Sending transactional emails (invitations, account notifications) to addresses you provide</li>'
                            '</ul>'
                            '<p>We do <strong>not</strong>:</p>'
                            '<ul>'
                            '<li>Sell, rent, lease, or share your data with third parties for advertising or marketing</li>'
                            '<li>Use your data to train AI or machine-learning models without your explicit consent</li>'
                            '<li>Post, publish, delete, or modify content on any of your connected social accounts</li>'
                            '<li>Transfer your data to any data broker or data reseller</li>'
                            '</ul>'
                        ),
                    },
                    {
                        'title': '4. Google API Services — Limited Use Disclosure',
                        'html': (
                            '<p>Social Stats uses Google APIs to access YouTube and Google Business Profile data. '
                            'Our use of information received from Google APIs adheres to the '
                            '<a href="https://developers.google.com/terms/api-services-user-data-policy" '
                            'target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, '
                            'including the <strong>Limited Use</strong> requirements.</p>'
                            '<p>Specifically:</p>'
                            '<ul>'
                            '<li>We access Google user data only to provide or improve user-facing features of Social Stats.</li>'
                            '<li>Google user data is not transferred to third parties except as necessary to provide the service, '
                            'or as required by law.</li>'
                            '<li>We do not use Google user data for serving advertisements.</li>'
                            '<li>We do not allow humans to read Google user data unless you have given us explicit permission, '
                            'it is necessary for security purposes, it is required by law, or the data has been aggregated and '
                            'anonymised.</li>'
                            '</ul>'
                            '<p><strong>Scopes requested from Google:</strong></p>'
                            '<ul>'
                            '<li><code>https://www.googleapis.com/auth/youtube.readonly</code> — read-only access to YouTube account data</li>'
                            '<li><code>https://www.googleapis.com/auth/yt-analytics.readonly</code> — read-only access to YouTube Analytics</li>'
                            '<li><code>https://www.googleapis.com/auth/business.manage</code> — read-only access to Google Business Profile data</li>'
                            '</ul>'
                            '<p>You can revoke Social Stats\'s access to your Google data at any time via '
                            '<a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>.</p>'
                        ),
                    },
                    {
                        'title': '5. Facebook & Instagram Data (Meta Platform)',
                        'html': (
                            '<p>Social Stats connects to the Meta Graph API to retrieve Facebook Page and Instagram Business '
                            'account analytics. We request only the permissions necessary to read analytics data:</p>'
                            '<ul>'
                            '<li><code>pages_read_engagement</code> — read page engagement metrics</li>'
                            '<li><code>pages_show_list</code> — list Facebook Pages you manage</li>'
                            '<li><code>instagram_basic</code> — access basic Instagram account information</li>'
                            '<li><code>instagram_manage_insights</code> — read Instagram audience and post insights</li>'
                            '<li><code>read_insights</code> — read Facebook Page Insights</li>'
                            '</ul>'
                            '<p>Data obtained from Meta APIs is used solely to display analytics within Social Stats. '
                            'We comply with the '
                            '<a href="https://developers.facebook.com/policy/" target="_blank" rel="noreferrer">Meta Platform Terms</a> '
                            'and the '
                            '<a href="https://developers.facebook.com/devpolicy/" target="_blank" rel="noreferrer">Meta Developer Policies</a>.</p>'
                            '<p>Social Stats does not share Facebook or Instagram data with third parties, does not use it for advertising '
                            'targeting, and does not store it beyond what is necessary to display your analytics dashboard.</p>'
                            '<p>You can revoke access via Facebook Settings → Apps and Websites, or by disconnecting within Social Stats Settings.</p>'
                            '<p>To request deletion of your Facebook/Instagram data from our servers, '
                            'visit our <a href="/data-deletion">Data Deletion page</a> or email '
                            '<a href="mailto:support@socialstats.app">support@socialstats.app</a>.</p>'
                        ),
                    },
                    {
                        'title': '6. LinkedIn Data',
                        'html': (
                            '<p>Social Stats connects to the LinkedIn Marketing API to retrieve LinkedIn Page and post analytics. '
                            'We request only the scopes needed for read-only analytics access:</p>'
                            '<ul>'
                            '<li><code>r_organization_social</code> — read LinkedIn Page posts and social metrics</li>'
                            '<li><code>r_organization_followers</code> — read Page follower statistics</li>'
                            '<li><code>rw_organization_admin</code> — required to access Page analytics (read portion only)</li>'
                            '</ul>'
                            '<p>We comply with the '
                            '<a href="https://legal.linkedin.com/api-terms-of-use" target="_blank" rel="noreferrer">LinkedIn API Terms of Use</a>. '
                            'LinkedIn data is used solely to display analytics within Social Stats and is not shared with third parties.</p>'
                            '<p>You can revoke access via LinkedIn Settings → Data Privacy → Other applications, '
                            'or by disconnecting within Social Stats Settings.</p>'
                        ),
                    },
                    {
                        'title': '7. Data Sharing & Third Parties',
                        'html': (
                            '<p>We do not sell or rent your personal data. We may share data only in these limited circumstances:</p>'
                            '<ul>'
                            '<li><strong>Service providers</strong> — infrastructure providers (cloud hosting, email delivery) who process data on our behalf under confidentiality agreements</li>'
                            '<li><strong>Legal requirements</strong> — when required by applicable law, court order, or government authority</li>'
                            '<li><strong>Business transfer</strong> — in the event of a merger or acquisition, your data may be transferred as a business asset; we will notify you in advance</li>'
                            '</ul>'
                            '<p>In all cases, third parties are prohibited from using your data for any purpose beyond the service they provide to us.</p>'
                        ),
                    },
                    {
                        'title': '8. Data Retention',
                        'html': (
                            '<ul>'
                            '<li>Analytics data is retained for as long as your Social Stats account remains active</li>'
                            '<li>OAuth tokens are stored encrypted and refreshed automatically; they are deleted immediately upon disconnecting a social account</li>'
                            '<li>Upon account deletion, all personal data and social analytics data is permanently removed within <strong>30 days</strong></li>'
                            '<li>Anonymised aggregate statistics (e.g. platform-wide benchmarks) may be retained indefinitely — these cannot be linked back to your identity</li>'
                            '</ul>'
                        ),
                    },
                    {
                        'title': '9. Data Security',
                        'html': (
                            '<p>We protect your data using industry-standard security practices:</p>'
                            '<ul>'
                            '<li>All data in transit is encrypted via TLS/HTTPS</li>'
                            '<li>OAuth tokens are encrypted at rest using AES-256</li>'
                            '<li>Access to production systems is restricted by role and enforced with MFA</li>'
                            '<li>Regular security reviews and dependency updates</li>'
                            '</ul>'
                            '<p>No system is completely secure. If you believe your account has been compromised, '
                            'contact us immediately at <a href="mailto:support@socialstats.app">support@socialstats.app</a>.</p>'
                        ),
                    },
                    {
                        'title': '10. Your Rights',
                        'html': (
                            '<p>You have the following rights with respect to your personal data:</p>'
                            '<ul>'
                            '<li><strong>Access</strong> — request a copy of the data we hold about you</li>'
                            '<li><strong>Correction</strong> — request corrections to inaccurate or incomplete data</li>'
                            '<li><strong>Deletion</strong> — request permanent deletion of your account and all associated data</li>'
                            '<li><strong>Portability</strong> — request your data in a machine-readable format</li>'
                            '<li><strong>Revoke access</strong> — disconnect any social account at any time from Social Stats Settings or directly from the platform</li>'
                            '<li><strong>Opt out of communications</strong> — unsubscribe from non-essential emails at any time</li>'
                            '</ul>'
                            '<p>To exercise any of these rights, contact us at '
                            '<a href="mailto:support@socialstats.app">support@socialstats.app</a>.</p>'
                        ),
                    },
                    {
                        'title': '11. Children\'s Privacy',
                        'html': (
                            '<p>Social Stats is not directed at children under the age of 16. We do not knowingly collect '
                            'personal data from children. If you believe a child has provided us with personal data, '
                            'contact us at <a href="mailto:support@socialstats.app">support@socialstats.app</a> and we will delete it promptly.</p>'
                        ),
                    },
                    {
                        'title': '12. Changes to This Policy',
                        'html': (
                            '<p>We may update this Privacy Policy from time to time. When we do, we will update the '
                            '"Last Updated" date at the top of this page. Material changes will be communicated by email '
                            'or via an in-app notice. Continued use of Social Stats after changes take effect constitutes your '
                            'acceptance of the updated policy.</p>'
                        ),
                    },
                    {
                        'title': '13. Contact Us',
                        'html': (
                            '<p>For privacy-related questions, data requests, or concerns:</p>'
                            '<p>'
                            '<strong>Email:</strong> <a href="mailto:support@socialstats.app">support@socialstats.app</a><br />'
                            '<strong>General Support:</strong> <a href="mailto:support@socialstats.app">support@socialstats.app</a><br />'
                            '<strong>Website:</strong> <a href="https://socialstats.app" target="_blank" rel="noreferrer">socialstats.app</a>'
                            '</p>'
                        ),
                    },
                ],
            },
        },
    )

    # ── Terms of Service ──────────────────────────────────────────────────────
    SiteContent.objects.update_or_create(
        key='terms-of-service',
        defaults={
            'title': 'Terms of Service',
            'effective_date': datetime.date(2026, 4, 10),
            'last_updated': datetime.date(2026, 4, 10),
            'is_public': True,
            'content': {
                'footer_link_label': 'Privacy Policy',
                'footer_link_url': '/privacy',
                'sections': [
                    {
                        'title': '1. Acceptance of Terms',
                        'html': (
                            '<p>By accessing or using the Social Stats platform ("the Service") at '
                            '<a href="https://socialstats.app">socialstats.app</a>, you agree to be bound by these '
                            'Terms of Service ("Terms") and our <a href="/privacy">Privacy Policy</a>. '
                            'If you do not agree to all Terms, do not use the Service.</p>'
                            '<p>We may revise these Terms at any time by posting an updated version. '
                            'Material changes will be communicated via email or in-app notice. Continued use '
                            'after revisions constitutes acceptance of the updated Terms.</p>'
                        ),
                    },
                    {
                        'title': '2. Description of the Service',
                        'html': (
                            '<p>Social Stats is a social media analytics platform that connects to your Facebook, '
                            'Instagram, Google, YouTube, and LinkedIn accounts — with your explicit permission — '
                            'and displays performance statistics, engagement metrics, post analytics, and related '
                            'insights in a unified dashboard.</p>'
                            '<p>Social Stats is a <strong>read-only</strong> analytics tool. We do <strong>not</strong> '
                            'post, publish, schedule, edit, delete, or otherwise modify any content on your '
                            'connected social media accounts.</p>'
                        ),
                    },
                    {
                        'title': '3. Account Registration',
                        'html': (
                            '<ul>'
                            '<li>You must provide accurate, current, and complete registration information</li>'
                            '<li>You are responsible for maintaining the confidentiality of your login credentials</li>'
                            '<li>You must be at least 18 years of age to use the Service</li>'
                            '<li>You may not create multiple accounts or allow others to use your account</li>'
                            '<li>You must notify us immediately of any unauthorised use of your account</li>'
                            '</ul>'
                        ),
                    },
                    {
                        'title': '4. Connecting Third-Party Social Accounts',
                        'html': (
                            '<p>When you connect a Facebook, Instagram, Google, YouTube, or LinkedIn account, '
                            'you authorise Social Stats to access that account\'s analytics data via the platform\'s '
                            'official API under your explicit OAuth consent. You can revoke this access at any time:</p>'
                            '<ul>'
                            '<li><strong>Facebook/Instagram</strong> — Facebook Settings → Apps and Websites → find Social Stats → Remove</li>'
                            '<li><strong>Google/YouTube</strong> — '
                            '<a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a> '
                            '→ find Social Stats → Remove Access</li>'
                            '<li><strong>LinkedIn</strong> — LinkedIn Settings → Data Privacy → Other applications → find Social Stats → Remove</li>'
                            '<li><strong>Social Stats dashboard</strong> — Settings page → Connected Accounts → Disconnect</li>'
                            '</ul>'
                        ),
                    },
                    {
                        'title': '5. Google API Services — Compliance',
                        'html': (
                            '<p>Social Stats\'s use of data obtained from Google APIs complies with the '
                            '<a href="https://developers.google.com/terms/api-services-user-data-policy" '
                            'target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, '
                            'including the Limited Use requirements.</p>'
                            '<p>Google user data accessed by Social Stats:</p>'
                            '<ul>'
                            '<li>Is used only to provide analytics features directly visible to you within Social Stats</li>'
                            '<li>Is not transferred to third parties for advertising, data brokerage, or any purpose '
                            'unrelated to the Social Stats service</li>'
                            '<li>Is not used to train AI or machine-learning models</li>'
                            '<li>Is not read by Social Stats employees or contractors unless you have given explicit permission, '
                            'it is required for security purposes, or it is required by law</li>'
                            '</ul>'
                            '<p>YouTube data is subject to the '
                            '<a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">YouTube Terms of Service</a>. '
                            'By connecting a YouTube account, you agree to those terms in addition to these Terms.</p>'
                        ),
                    },
                    {
                        'title': '6. Meta Platform Terms Compliance',
                        'html': (
                            '<p>Social Stats\'s use of Facebook and Instagram data is governed by the '
                            '<a href="https://developers.facebook.com/policy/" target="_blank" rel="noreferrer">Meta Platform Terms</a> '
                            'and the '
                            '<a href="https://developers.facebook.com/devpolicy/" target="_blank" rel="noreferrer">Meta Developer Policies</a>.</p>'
                            '<p>By connecting a Facebook or Instagram account, you represent that you have the right '
                            'to authorise access to that account and that you will use the analytics data in compliance '
                            'with Meta\'s terms and policies.</p>'
                            '<p>Social Stats does not sell, license, or otherwise commercialise Facebook or Instagram data, '
                            'and does not use it for purposes beyond the analytics features explicitly provided within the platform.</p>'
                            '<p>Meta\'s user data is deleted from our systems within 30 days of account disconnection or deletion. '
                            'A data deletion callback endpoint is registered with Meta at '
                            '<code>https://socialstats.app/api/oauth/facebook/data-deletion/</code>.</p>'
                        ),
                    },
                    {
                        'title': '7. LinkedIn API Terms Compliance',
                        'html': (
                            '<p>Social Stats\'s use of LinkedIn data is governed by the '
                            '<a href="https://legal.linkedin.com/api-terms-of-use" target="_blank" rel="noreferrer">LinkedIn API Terms of Use</a>.</p>'
                            '<p>By connecting a LinkedIn account, you represent that you are authorised to grant '
                            'access to the LinkedIn Page(s) associated with your account.</p>'
                            '<p>Social Stats uses LinkedIn data solely to display Page analytics and post performance '
                            'metrics within your dashboard. LinkedIn data is not shared with third parties or used '
                            'for any purpose beyond the analytics service.</p>'
                        ),
                    },
                    {
                        'title': '8. Acceptable Use',
                        'html': (
                            '<p>You agree not to:</p>'
                            '<ul>'
                            '<li>Use the Service for any unlawful purpose or in violation of applicable laws</li>'
                            '<li>Attempt to reverse-engineer, decompile, scrape, or extract data from the Service or its APIs</li>'
                            '<li>Share your account credentials with unauthorised parties</li>'
                            '<li>Use the Service in a way that violates the terms of any connected social media platform</li>'
                            '<li>Interfere with or attempt to disrupt the Service\'s infrastructure or security</li>'
                            '<li>Misrepresent your identity or affiliation when using the Service</li>'
                            '<li>Use the Service to collect, store, or process data of other users without their consent</li>'
                            '</ul>'
                        ),
                    },
                    {
                        'title': '9. Data and Privacy',
                        'html': (
                            '<p>Your use of the Service is governed by our <a href="/privacy">Privacy Policy</a>, '
                            'which is incorporated into these Terms by reference. We handle your data in compliance '
                            'with applicable privacy laws and the data policies of Meta, Google, and LinkedIn.</p>'
                        ),
                    },
                    {
                        'title': '10. Intellectual Property',
                        'html': (
                            '<p>The Social Stats platform — including its design, code, branding, and content — is owned by us '
                            'and protected by intellectual property laws. You may not copy, reproduce, distribute, or create '
                            'derivative works from any part of the Service without our written permission.</p>'
                            '<p>Your social media data remains owned by you and the respective platforms. Social Stats claims no '
                            'ownership over analytics data retrieved from your connected accounts.</p>'
                        ),
                    },
                    {
                        'title': '11. Disclaimers',
                        'html': (
                            '<p>The Service is provided "as is" and "as available" without warranties of any kind, '
                            'express or implied. We do not guarantee that:</p>'
                            '<ul>'
                            '<li>Analytics data will be 100% accurate (data is sourced from third-party platform APIs and '
                            'may reflect API delays or discrepancies)</li>'
                            '<li>The Service will be uninterrupted, error-free, or free of security vulnerabilities</li>'
                            '<li>Third-party platforms will maintain API access that enables our Service to function</li>'
                            '</ul>'
                        ),
                    },
                    {
                        'title': '12. Limitation of Liability',
                        'html': (
                            '<p>To the maximum extent permitted by applicable law, Social Stats and its officers, employees, '
                            'and affiliates shall not be liable for any indirect, incidental, special, consequential, or '
                            'punitive damages arising from your use of the Service, including but not limited to loss of '
                            'data, loss of revenue, or business interruption.</p>'
                        ),
                    },
                    {
                        'title': '13. Termination',
                        'html': (
                            '<p>We reserve the right to suspend or terminate accounts that violate these Terms, '
                            'with or without notice.</p>'
                            '<p>You may delete your account at any time from the Settings page. Upon termination, '
                            'your personal data and connected account data will be permanently deleted within '
                            '<strong>30 days</strong>.</p>'
                        ),
                    },
                    {
                        'title': '14. Governing Law',
                        'html': (
                            '<p>These Terms are governed by and construed in accordance with applicable law. '
                            'Any disputes arising under these Terms shall be subject to the exclusive jurisdiction '
                            'of the competent courts.</p>'
                        ),
                    },
                    {
                        'title': '15. Contact Us',
                        'html': (
                            '<p>For questions about these Terms:</p>'
                            '<p>'
                            '<strong>Email:</strong> <a href="mailto:support@socialstats.app">support@socialstats.app</a><br />'
                            '<strong>Website:</strong> <a href="https://socialstats.app" target="_blank" rel="noreferrer">socialstats.app</a>'
                            '</p>'
                        ),
                    },
                ],
            },
        },
    )


def revert_site_content(apps, schema_editor):
    # No-op: reverting legal content updates is non-trivial; handled manually if needed
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('social_stats', '0025_email_verification_password_reset'),
    ]

    operations = [
        migrations.RunPython(update_site_content, revert_site_content),
    ]
