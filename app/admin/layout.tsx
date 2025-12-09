import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminNav from './components/AdminNav';

// Simple password-based authentication
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get('admin_auth')?.value === 'true';

  if (!isAuthenticated) {
    redirect('/admin/login');
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <AdminNav />
      <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        {children}
      </div>
    </div>
  );
}

