'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui';

export default function HomePage() {
  const { isLoading, isAuthenticated, hasFamily } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        if (hasFamily) {
          router.push('/dashboard');
        } else {
          router.push('/family/create');
        }
      } else {
        router.push('/login');
      }
    }
  }, [isLoading, isAuthenticated, hasFamily, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <Spinner size="lg" />
        <p className="mt-4 text-gray-400">Loading...</p>
      </div>
    </div>
  );
}
