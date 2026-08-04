'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/clients', label: 'Clients' },
  { href: '/admin/prices', label: 'Products' },
  { href: '/admin/funnel-routes', label: 'Routes' },
  { href: '/admin/transactions', label: 'Transactions' },
  { href: '/admin/checkout-code', label: 'Checkout Code' },
  { href: '/admin/form-redirect-urls', label: 'Redirect URLs' },
];

export default function AdminNav() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="nav-brand">
          Payment<span>Gateway</span>
        </div>

        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link ${isActive(link.href, link.exact) ? 'active' : ''}`}
          >
            {link.label}
          </Link>
        ))}

        <div className="spacer" />

        <Link href="/api/admin/logout" className="nav-logout">
          Sign out
        </Link>
      </div>
    </nav>
  );
}
