'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminNav() {
  const pathname = usePathname();

  const navStyle = {
    backgroundColor: '#333',
    padding: '15px 20px',
    marginBottom: '20px',
  };

  const linkStyle = {
    color: 'white',
    textDecoration: 'none',
    marginRight: '20px',
    padding: '8px 12px',
    borderRadius: '4px',
  };

  const activeLinkStyle = {
    ...linkStyle,
    backgroundColor: '#0070f3',
  };

  return (
    <nav style={navStyle}>
      <Link
        href="/admin/clients"
        style={pathname === '/admin/clients' ? activeLinkStyle : linkStyle}
      >
        Clients
      </Link>
      <Link
        href="/admin/prices"
        style={pathname === '/admin/prices' ? activeLinkStyle : linkStyle}
      >
        Prices
      </Link>
      <Link
        href="/admin/funnel-routes"
        style={pathname === '/admin/funnel-routes' ? activeLinkStyle : linkStyle}
      >
        Funnel Routes
      </Link>
      <Link
        href="/admin/checkout-code"
        style={pathname === '/admin/checkout-code' ? activeLinkStyle : linkStyle}
      >
        Checkout Code
      </Link>
      <Link
        href="/admin/form-redirect-urls"
        style={pathname === '/admin/form-redirect-urls' ? activeLinkStyle : linkStyle}
      >
        Form Redirect URLs
      </Link>
      <Link
        href="/api/admin/logout"
        style={{ ...linkStyle, float: 'right' }}
      >
        Logout
      </Link>
    </nav>
  );
}

