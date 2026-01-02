'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/SessionContext';
import { Button, Input, Card } from '@/components/ui';
import { Wallet, Mail, Lock, User } from 'lucide-react';

export default function SignupPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { signup } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setIsLoading(true);

        const result = await signup(email, password, name);

        if (result.success) {
            router.push('/family/create');
        } else {
            setError(result.error || 'Signup failed');
        }

        setIsLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
            {/* Background effects */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
            </div>

            <div className="relative max-w-md w-full">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl mb-4 animate-pulse-glow">
                        <Wallet className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                        MoneyLog
                    </h1>
                    <p className="text-gray-400 mt-2">Create your account</p>
                </div>

                {/* Signup Card */}
                <Card className="animate-fadeIn">
                    <h2 className="text-xl font-semibold text-white mb-6">Get started</h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <Input
                                type="text"
                                placeholder="Your name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="pl-10"
                                required
                            />
                        </div>

                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <Input
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="pl-10"
                                required
                            />
                        </div>

                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <Input
                                type="password"
                                placeholder="Password (min 8 characters)"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pl-10"
                                required
                            />
                        </div>

                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <Input
                                type="password"
                                placeholder="Confirm password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
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
                            Create account
                        </Button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-gray-400">
                            Already have an account?{' '}
                            <Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
}
