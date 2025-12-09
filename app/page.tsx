import Link from 'next/link';

export default function Home() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        textAlign: 'center',
      }}
    >
      <h1 style={{ marginBottom: '20px' }}>Razorpay Gateway</h1>
      <p style={{ marginBottom: '30px', color: '#666' }}>
        Multi-tenant Razorpay order creation microservice
      </p>
      <Link
        href="/admin/login"
        style={{
          padding: '12px 24px',
          backgroundColor: '#0070f3',
          color: 'white',
          borderRadius: '4px',
          textDecoration: 'none',
          display: 'inline-block',
        }}
      >
        Go to Admin Panel
      </Link>
    </div>
  );
}

