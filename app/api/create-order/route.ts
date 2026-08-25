import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getPaymentProvider, PaymentProviderError, PaymentGateway } from '@/lib/payment-providers';

// CORS headers — this endpoint is called cross-origin from GHL funnel pages.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const supabase = getAdminSupabase();

  try {
    const body = await request.json();
    const { page_url, name, email, contact } = body;

    if (!page_url || !name || !email || !contact) {
      return NextResponse.json(
        { error: 'missing_fields', detail: 'page_url, name, email, and contact are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(page_url);
    } catch {
      return NextResponse.json(
        { error: 'invalid_url', detail: 'page_url must be a valid URL' },
        { status: 400, headers: corsHeaders }
      );
    }

    const hostname = parsedUrl.hostname;
    const pathname = parsedUrl.pathname;
    const normalizedPathname =
      pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;

    // Look up funnel route — exact match, retried with a trailing slash.
    let { data: route, error: routeError } = await supabase
      .from('funnel_routes')
      .select('client_id, price_id, gateway')
      .eq('hostname', hostname)
      .eq('path_prefix', normalizedPathname)
      .eq('is_active', true)
      .single();

    if (routeError || !route) {
      const altPathname = normalizedPathname === '/' ? '/' : normalizedPathname + '/';
      const { data: altRoute, error: altRouteError } = await supabase
        .from('funnel_routes')
        .select('client_id, price_id, gateway')
        .eq('hostname', hostname)
        .eq('path_prefix', altPathname)
        .eq('is_active', true)
        .single();

      if (!altRouteError && altRoute) {
        route = altRoute;
        routeError = null;
      }
    }

    if (routeError || !route) {
      console.error('Route lookup failed:', { hostname, pathname, normalizedPathname });
      return NextResponse.json(
        {
          error: 'route_not_found',
          detail:
            `No active route found for ${hostname}${pathname}. Please check that a funnel route ` +
            `is configured with hostname="${hostname}" and path_prefix="${normalizedPathname}" ` +
            `(or "${normalizedPathname}/") and is_active=true.`,
        },
        { status: 404, headers: corsHeaders }
      );
    }

    const gateway: PaymentGateway = (route.gateway as PaymentGateway) || 'razorpay';

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, razorpay_key_id, razorpay_key_secret, cashfree_app_id, cashfree_secret_key, cashfree_env')
      .eq('id', route.client_id)
      .single();

    if (clientError || !client) {
      console.error('Client lookup error:', clientError);
      return NextResponse.json(
        { error: 'client_not_found', detail: `Client ${route.client_id} not found` },
        { status: 404, headers: corsHeaders }
      );
    }

    const { data: price, error: priceError } = await supabase
      .from('prices')
      // Kept on one line: supabase-js infers row types from this string literal,
      // and concatenation defeats that inference.
      .select('id, product_name, amount_paise, currency, thank_you_url, payment_type, razorpay_plan_id, billing_period, billing_interval, total_count, hidden_payment_methods')
      .eq('id', route.price_id)
      .single();

    if (priceError || !price) {
      console.error('Price lookup error:', priceError);
      return NextResponse.json(
        { error: 'price_not_found', detail: `Price ${route.price_id} not found` },
        { status: 404, headers: corsHeaders }
      );
    }

    const paymentProvider = getPaymentProvider(gateway);

    try {
      const orderResponse = await paymentProvider.createOrder({
        client,
        price,
        customer: { name, email, contact },
      });

      // ---------------------------------------------------------------------
      // Persist. This is best-effort: a logging failure must never block a
      // customer from paying, so we warn rather than throw.
      // ---------------------------------------------------------------------
      const isSubscription = orderResponse.payment_type === 'subscription';

      const { error: txError } = await supabase.from('transactions').insert({
        client_id: client.id,
        price_id: price.id,
        gateway,
        payment_type: orderResponse.payment_type,
        gateway_order_id: isSubscription ? null : orderResponse.order_id,
        gateway_subscription_id: orderResponse.subscription_id ?? null,
        status: 'created',
        amount_paise: price.amount_paise,
        currency: price.currency,
        customer_name: name,
        customer_email: email,
        customer_contact: contact,
        product_name: price.product_name,
        page_url,
      });

      if (txError) {
        console.error('Failed to record transaction (payment continues):', txError);
      }

      if (isSubscription && orderResponse.subscription_id) {
        const { error: subError } = await supabase.from('subscriptions').upsert(
          {
            client_id: client.id,
            price_id: price.id,
            gateway,
            gateway_subscription_id: orderResponse.subscription_id,
            gateway_plan_id: price.razorpay_plan_id ?? null,
            status: 'created',
            customer_name: name,
            customer_email: email,
            customer_contact: contact,
            product_name: price.product_name,
            charge_amount_paise: price.amount_paise,
            currency: price.currency,
            total_count: price.total_count ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'gateway,gateway_subscription_id' }
        );

        if (subError) {
          console.error('Failed to record subscription (payment continues):', subError);
        }
      }

      return NextResponse.json(
        {
          gateway: orderResponse.gateway,
          payment_type: orderResponse.payment_type,
          order_id: orderResponse.order_id,
          subscription_id: orderResponse.subscription_id,
          checkout_data: orderResponse.checkout_data,
          product_name: orderResponse.product_name,
          thank_you_url: orderResponse.thank_you_url,
          prefill: orderResponse.prefill,
        },
        { headers: corsHeaders }
      );
    } catch (error: any) {
      if (error instanceof PaymentProviderError) {
        console.error(`${error.gateway} API error:`, error.details);

        // Record the failed attempt so misconfiguration is visible in the admin
        // panel rather than only in server logs.
        await supabase
          .from('transactions')
          .insert({
            client_id: client.id,
            price_id: price.id,
            gateway,
            payment_type: price.payment_type || 'one_time',
            status: 'failed',
            amount_paise: price.amount_paise,
            currency: price.currency,
            customer_name: name,
            customer_email: email,
            customer_contact: contact,
            product_name: price.product_name,
            page_url,
            error_message: error.message,
          })
          .then(({ error: e }) => {
            if (e) console.error('Failed to record failed transaction:', e);
          });

        return NextResponse.json(
          {
            error: 'order_create_failed',
            detail: error.message,
            gateway: error.gateway,
            gateway_response: error.details,
          },
          { status: error.status || 500, headers: corsHeaders }
        );
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'unexpected_error', detail: error.message || 'An unexpected error occurred' },
      { status: 500, headers: corsHeaders }
    );
  }
}
