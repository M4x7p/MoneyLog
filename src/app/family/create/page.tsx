'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Card } from '@/components/ui';
import { Users, Home, Copy, Check } from 'lucide-react';

export default function CreateFamilyPage() {
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [inviteCode, setInviteCode] = useState('');
    const [inviteUrl, setInviteUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const { user, refreshFamily } = useAuth();
    const router = useRouter();

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/family', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });

            const data = await res.json() as any;

            if (data.success) {
                await refreshFamily();
                // Generate invite link
                const inviteRes = await fetch('/api/family/invite', { method: 'POST' });
                const inviteData = await inviteRes.json();

                if (inviteData.success) {
                    setInviteCode(inviteData.invite.code);
                    setInviteUrl(inviteData.invite.url);
                }
            } else {
                setError(data.error || 'Failed to create family');
            }
        } catch {
            setError('Network error');
        }

        setIsLoading(false);
    };

    const copyInvite = () => {
        navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const goToDashboard = () => {
        router.push('/dashboard');
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
            </div>

            <div className="relative max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-2xl mb-4">
                        <Users className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Create Family Space</h1>
                    <p className="text-gray-400 mt-2">Welcome, {user?.name}! Set up your household.</p>
                </div>

                <Card className="animate-fadeIn">
                    {!inviteCode ? (
                        <>
                            <h2 className="text-xl font-semibold text-white mb-2">Name your family</h2>
                            <p className="text-gray-400 text-sm mb-6">
                                This will be the name of your shared expense space.
                            </p>

                            <form onSubmit={handleCreate} className="space-y-4">
                                {error && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                        {error}
                                    </div>
                                )}

                                <div className="relative">
                                    <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                    <Input
                                        type="text"
                                        placeholder="e.g., The Smiths, Our Home, Family Budget"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
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
                                    Create Family Space
                                </Button>
                            </form>

                            <div className="mt-6 text-center border-t border-white/10 pt-6">
                                <p className="text-gray-400 text-sm">
                                    Have an invite code?{' '}
                                    <Link href="/family/join" className="text-violet-400 hover:text-violet-300 font-medium">
                                        Join a family
                                    </Link>
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="text-center">
                                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Check className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-xl font-semibold text-white mb-2">Family Created!</h2>
                                <p className="text-gray-400 text-sm mb-6">
                                    Share this invite link with your partner to join your family space.
                                </p>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
                                <p className="text-xs text-gray-400 mb-2">Invite Link</p>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 text-sm text-violet-400 truncate">
                                        {inviteUrl}
                                    </code>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={copyInvite}
                                        className="shrink-0"
                                    >
                                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    </Button>
                                </div>
                            </div>

                            <Button onClick={goToDashboard} className="w-full" size="lg">
                                Go to Dashboard
                            </Button>

                            <p className="text-center text-gray-500 text-xs mt-4">
                                You can also find this invite link in Settings later.
                            </p>
                        </>
                    )}
                </Card>
            </div>
        </div>
    );
}
