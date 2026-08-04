/**
 * Admin API — create a Razorpay plan for a subscription price.
 *
 * Plans are account-scoped, so this creates the plan inside the owning client's
 * Razorpay account using that client's credentials, then stores the returned
 * plan id on the price.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin-auth';
import { createRazorpayPlan } from '@/lib/payment-providers/razorpay-plans';
import { PaymentProviderError, BillingPeriod } from '@/lib/payment-providers/types';

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { price_id } = await request.json();
  if (!price_id) {
    return NextResponse.json({ error: 'price_id is required' }, { status: 400 });
  }

  const supabase = getAdminSupabase();

  const { data: price, error: priceError } = await supabase
    .from('prices')
    // Kept on one line: supabase-js infers row types from this string literal,
    // and concatenation defeats that inference.
    .select('id, client_id, product_name, amount_paise, currency, payment_type, billing_period, billing_interval, razorpay_plan_id')
    .eq('id', price_id)
    .single();

  if (priceError || !price) {
    return NextResponse.json({ error: 'Price not found' }, { status: 404 });
  }

  if (price.payment_type !== 'subscription') {
    return NextResponse.json(
      { error: 'This price is not a subscription. Set it to Subscription first.' },
      { status: 400 }
    );
  }

  if (!price.billing_period) {
    return NextResponse.json(
      { error: 'Set a billing period (monthly, yearly, ...) before creating a plan.' },
      { status: 400 }
    );
  }

  if (price.razorpay_plan_id) {
    return NextResponse.json({ plan_id: price.razorpay_plan_id, already_existed: true });
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, razorpay_key_id, razorpay_key_secret')
    .eq('id', price.client_id)
    .single();

  if (clientError || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  try {
    const planId = await createRazorpayPlan({
      client,
      productName: price.product_name,
      amountPaise: price.amount_paise,
      currency: price.currency,
      period: price.billing_period as BillingPeriod,
      interval: price.billing_interval || 1,
    });

    const { error: updateError } = await supabase
      .from('prices')
      .update({ razorpay_plan_id: planId })
      .eq('id', price.id);

    if (updateError) {
      // The plan exists in Razorpay but we failed to store it. Surface the id so
      // it can be recovered manually rather than silently orphaned.
      return NextResponse.json(
        {
          error: `Plan ${planId} was created in Razorpay but could not be saved: ${updateError.message}`,
          plan_id: planId,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ plan_id: planId });
  } catch (error: any) {
    if (error instanceof PaymentProviderError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status || 500 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
