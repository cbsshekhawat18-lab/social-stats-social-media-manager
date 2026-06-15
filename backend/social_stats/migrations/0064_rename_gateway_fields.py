# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Payments were removed (the product is now free and open-source). The
Subscription / Invoice tables are kept as inert storage, but the payment-gateway
columns are renamed off the old processor name. This is a pure column RENAME —
no data is dropped and the tables remain.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('social_stats', '0063_alter_hashtagset_platform'),
    ]

    operations = [
        migrations.RenameField('subscription', 'razorpay_customer_id', 'gateway_customer_id'),
        migrations.RenameField('subscription', 'razorpay_subscription_id', 'gateway_subscription_id'),
        migrations.RenameField('subscription', 'razorpay_plan_id', 'gateway_plan_id'),
        migrations.RenameField('invoice', 'razorpay_invoice_id', 'gateway_invoice_id'),
        migrations.RenameField('invoice', 'razorpay_payment_id', 'gateway_payment_id'),
    ]
