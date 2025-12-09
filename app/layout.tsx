import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Razorpay Gateway',
  description: 'Multi-tenant Razorpay order creation microservice',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

