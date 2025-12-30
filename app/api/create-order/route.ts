import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPaymentProvider, PaymentProviderError, PaymentGateway } from '@/lib/payment-providers';

// Initialize Supabase client with service role key (server-side only)
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Main POST handler
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { page_url, name, email, contact } = body;

    // Validate required fields
    if (!page_url || !name || !email || !contact) {
      return NextResponse.json(
        { error: 'missing_fields', detail: 'page_url, name, email, and contact are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Parse URL to extract hostname and pathname
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(page_url);
    } catch (error) {
      return NextResponse.json(
        { error: 'invalid_url', detail: 'page_url must be a valid URL' },
        { status: 400, headers: corsHeaders }
      );
    }

    const hostname = parsedUrl.hostname;
    const pathname = parsedUrl.pathname;

    // Normalize pathname (remove trailing slash for matching)
    const normalizedPathname = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;
    
    // Look up funnel route - try exact match first, then try with/without trailing slash
    // Select gateway column to determine which payment provider to use
    let { data: route, error: routeError } = await supabase
      .from('funnel_routes')
      .select('client_id, price_id, gateway')
      .eq('hostname', hostname)
      .eq('path_prefix', normalizedPathname)
      .eq('is_active', true)
      .single();

    // If not found, try with trailing slash
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
      console.error('Route lookup error:', routeError);
      console.error('Looking for:', { hostname, pathname, normalizedPathname });
      return NextResponse.json(
        { 
          error: 'route_not_found', 
          detail: `No active route found for ${hostname}${pathname}. Please check that a funnel route is configured with hostname="${hostname}" and path_prefix="${normalizedPathname}" (or "${normalizedPathname}/") and is_active=true.` 
        },
        { status: 404, headers: corsHeaders }
      );
    }

    // Determine gateway (default to 'razorpay' for backward compatibility)
    const gateway: PaymentGateway = (route.gateway as PaymentGateway) || 'razorpay';

    // Fetch client credentials (both Razorpay and Cashfree)
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

    // Fetch price (product details)
    const { data: price, error: priceError } = await supabase
      .from('prices')
      .select('id, product_name, amount_paise, currency, thank_you_url')
      .eq('id', route.price_id)
      .single();

    if (priceError || !price) {
      console.error('Price lookup error:', priceError);
      return NextResponse.json(
        { error: 'price_not_found', detail: `Price ${route.price_id} not found` },
        { status: 404, headers: corsHeaders }
      );
    }

    // Get the appropriate payment provider
    const paymentProvider = getPaymentProvider(gateway);

    // Create order using the provider
    try {
      const orderResponse = await paymentProvider.createOrder({
        client,
        price,
        customer: {
          name,
          email,
          contact,
        },
      });

      // Return standardized response
      return NextResponse.json(
        {
          gateway: orderResponse.gateway,
          order_id: orderResponse.order_id,
          checkout_data: orderResponse.checkout_data,
          product_name: orderResponse.product_name,
          thank_you_url: orderResponse.thank_you_url,
          prefill: orderResponse.prefill,
        },
        { headers: corsHeaders }
      );
    } catch (error: any) {
      // Handle payment provider errors
      if (error instanceof PaymentProviderError) {
        console.error(`${error.gateway} API error:`, error.details);
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
      // Re-throw to be caught by outer catch block
      throw error;
    }
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'unexpected_error',
        detail: error.message || 'An unexpected error occurred',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

