'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/SessionContext';
import { Navbar } from './Navbar';
import { Spinner } from '@/components/ui';

interface ProtectedLayoutProps {
    children: React.ReactNode;
    requireFamily?: boolean;
}

export function ProtectedLayout({ children, requireFamily = true }: ProtectedLayoutProps) {
    const { isLoading, isAuthenticated, hasFamily } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!isLoading) {
            if (!isAuthenticated) {
                router.push('/login');
            } else if (requireFamily && !hasFamily && pathname !== '/family/create' && pathname !== '/family/join') {
                router.push('/family/create');
            }
        }
    }, [isLoading, isAuthenticated, hasFamily, requireFamily, router, pathname]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Spinner size="lg" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    if (requireFamily && !hasFamily && pathname !== '/family/create' && pathname !== '/family/join') {
        return null;
    }

    return (
        <div className="min-h-screen bg-slate-950">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}
