'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/clients', label: 'Clients' },
  { href: '/admin/prices', label: 'Products' },
  { href: '/admin/transactions', label: 'Transactions' },
  { href: '/admin/checkout-code', label: 'Checkout Code' },
  { href: '/admin/form-redirect-urls', label: 'Redirect URLs' },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  /**
   * Sign out is a button, not a <Link>. Next.js prefetches links in production,
   * so linking to a logout endpoint makes the browser sign the user out on its
   * own as soon as the nav renders.
   */
  async function signOut() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  }

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

        <button type="button" className="nav-logout" onClick={signOut}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
