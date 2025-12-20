// ===========================================================
// Redirect to new Admin Dashboard
// ===========================================================

import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AdminRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/admin/dashboard');
  }, [router]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-gray-500">Redirecionando...</p>
      </div>
    </div>
  );
}
