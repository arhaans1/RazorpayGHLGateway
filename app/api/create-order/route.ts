import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    let { data: route, error: routeError } = await supabase
      .from('funnel_routes')
      .select('client_id, price_id')
      .eq('hostname', hostname)
      .eq('path_prefix', normalizedPathname)
      .eq('is_active', true)
      .single();

    // If not found, try with trailing slash
    if (routeError || !route) {
      const altPathname = normalizedPathname === '/' ? '/' : normalizedPathname + '/';
      const { data: altRoute, error: altRouteError } = await supabase
        .from('funnel_routes')
        .select('client_id, price_id')
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

    // Fetch client (Razorpay credentials)
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, razorpay_key_id, razorpay_key_secret')
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

    // Prepare Razorpay order creation request
    const razorpayAuth = Buffer.from(
      `${client.razorpay_key_id}:${client.razorpay_key_secret}`
    ).toString('base64');

    const receiptId = `rcpt_${Date.now()}`;
    const contactDigits = contact.replace(/\D/g, ''); // Remove non-digits

    // Form-encoded body for Razorpay API
    const formData = new URLSearchParams({
      amount: price.amount_paise.toString(),
      currency: price.currency.toUpperCase(),
      receipt: receiptId,
      payment_capture: '1',
      'notes[name]': name,
      'notes[email]': email,
      'notes[contact]': contactDigits,
      'notes[product_name]': price.product_name,
    });

    // Call Razorpay Orders API
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${razorpayAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const razorpayData = await razorpayResponse.json();

    if (!razorpayResponse.ok || !razorpayData.id) {
      console.error('Razorpay API error:', razorpayData);
      const errorDetail = razorpayData.error?.description || razorpayData.error?.reason || JSON.stringify(razorpayData);
      return NextResponse.json(
        {
          error: 'order_create_failed',
          detail: `Razorpay API error: ${errorDetail}. Status: ${razorpayResponse.status}`,
          razorpay_response: razorpayData,
        },
        { status: razorpayResponse.status || 500, headers: corsHeaders }
      );
    }

    // Success: return order details
    return NextResponse.json(
      {
        order_id: razorpayData.id,
        key_id: client.razorpay_key_id,
        product_name: price.product_name,
        thank_you_url: price.thank_you_url,
        prefill: {
          name: name,
          email: email,
          contact: contact,
        },
      },
      { headers: corsHeaders }
    );
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

