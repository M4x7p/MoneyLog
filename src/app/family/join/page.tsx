'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Card } from '@/components/ui';
import { Users, Link as LinkIcon, Check } from 'lucide-react';
import { Suspense } from 'react';

function JoinFamilyContent() {
    const searchParams = useSearchParams();
    const initialCode = searchParams.get('code') || '';

    const [code, setCode] = useState(initialCode);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [familyName, setFamilyName] = useState('');
    const { refreshFamily } = useAuth();
    const router = useRouter();

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/family/invite/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code.trim() }),
            });

            const data = await res.json() as any;

            if (data.success) {
                setFamilyName(data.family.name);
                setSuccess(true);
                await refreshFamily();
            } else {
                setError(data.error || 'Failed to join family');
            }
        } catch {
            setError('Network error');
        }

        setIsLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
            </div>

            <div className="relative max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl mb-4">
                        <Users className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Join Family</h1>
                    <p className="text-gray-400 mt-2">Enter your invite code to join a family space</p>
                </div>

                <Card className="animate-fadeIn">
                    {!success ? (
                        <>
                            <form onSubmit={handleJoin} className="space-y-4">
                                {error && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                        {error}
                                    </div>
                                )}

                                <div className="relative">
                                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                    <Input
                                        type="text"
                                        placeholder="Paste invite code or link"
                                        value={code}
                                        onChange={(e) => {
                                            // Extract code from URL if pasted
                                            const value = e.target.value;
                                            const match = value.match(/invite\/([a-f0-9-]+)/);
                                            setCode(match ? match[1] : value);
                                        }}
                                        className="pl-10"
                                        required
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full"
                                    size="lg"
                                    isLoading={isLoading}
                                >
                                    Join Family
                                </Button>
                            </form>

                            <div className="mt-6 text-center border-t border-white/10 pt-6">
                                <p className="text-gray-400 text-sm">
                                    Want to create your own?{' '}
                                    <Link href="/family/create" className="text-violet-400 hover:text-violet-300 font-medium">
                                        Create a family
                                    </Link>
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="text-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-xl font-semibold text-white mb-2">Welcome!</h2>
                            <p className="text-gray-400 mb-6">
                                You&apos;ve joined <span className="text-white font-medium">{familyName}</span>
                            </p>

                            <Button onClick={() => router.push('/dashboard')} className="w-full" size="lg">
                                Go to Dashboard
                            </Button>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}

export default function JoinFamilyPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
            </div>
        }>
            <JoinFamilyContent />
        </Suspense>
    );
}
