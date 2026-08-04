import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminNav from '../components/AdminNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get('admin_auth')?.value === 'true';

  if (!isAuthenticated) {
    redirect('/admin/login');
  }

  return (
    <div className="app-shell">
      <AdminNav />
      <div className="page">{children}</div>
    </div>
  );
}
