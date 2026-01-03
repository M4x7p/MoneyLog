'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/SessionContext';
import { Card, Button, Spinner } from '@/components/ui';
import { Users, Check, X, LogIn } from 'lucide-react';

interface InviteInfo {
    familyName: string;
    creatorName: string;
    expiresAt: string;
}

export default function InvitePage() {
    const params = useParams();
    const router = useRouter();
    const { isLoading: authLoading, isAuthenticated, refreshFamily } = useAuth();
    const code = params.code as string;

    const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAccepting, setIsAccepting] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const validateInvite = async () => {
            try {
                const res = await fetch(`/api/family/invite/accept?code=${code}`);
                const data = await res.json() as any;

                if (data.valid) {
                    setInviteInfo(data.invite);
                } else {
                    setError(data.error || 'ลิงก์เชิญไม่ถูกต้อง');
                }
            } catch {
                setError('ไม่สามารถตรวจสอบลิงก์เชิญได้');
            }
            setIsLoading(false);
        };

        if (code) {
            validateInvite();
        }
    }, [code]);

    const handleAccept = async () => {
        setIsAccepting(true);
        setError(null);

        try {
            const res = await fetch('/api/family/invite/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });

            const data = await res.json() as any;

            if (data.success) {
                setSuccess(true);
                await refreshFamily();
                setTimeout(() => {
                    router.push('/dashboard');
                }, 2000);
            } else {
                setError(data.error || 'ไม่สามารถเข้าร่วมครอบครัวได้');
            }
        } catch {
            setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }

        setIsAccepting(false);
    };

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
            </div>

            <div className="relative max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl mb-4">
                        <Users className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">เชิญเข้าร่วมครอบครัว</h1>
                </div>

                <Card className="animate-fadeIn">
                    {error && !inviteInfo ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <X className="w-8 h-8 text-red-400" />
                            </div>
                            <h2 className="text-xl font-semibold text-white mb-2">
                                ลิงก์ไม่ถูกต้อง
                            </h2>
                            <p className="text-gray-400 mb-6">{error}</p>
                            <Link href="/family/join">
                                <Button variant="secondary">
                                    กรอกรหัสเชิญด้วยตัวเอง
                                </Button>
                            </Link>
                        </div>
                    ) : success ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check className="w-8 h-8 text-emerald-400" />
                            </div>
                            <h2 className="text-xl font-semibold text-white mb-2">
                                ยินดีต้อนรับ!
                            </h2>
                            <p className="text-gray-400">
                                คุณได้เข้าร่วม {inviteInfo?.familyName} แล้ว
                            </p>
                            <p className="text-gray-500 text-sm mt-4">
                                กำลังพาไปยัง Dashboard...
                            </p>
                        </div>
                    ) : inviteInfo ? (
                        <div className="text-center py-8">
                            <p className="text-gray-400 mb-2">คุณได้รับเชิญจาก</p>
                            <p className="text-2xl font-bold text-white mb-1">
                                {inviteInfo.creatorName}
                            </p>
                            <p className="text-gray-400 mb-6">
                                เข้าร่วม <span className="text-violet-400">{inviteInfo.familyName}</span>
                            </p>

                            {!isAuthenticated ? (
                                <div className="space-y-4">
                                    <p className="text-gray-400 text-sm">
                                        กรุณาเข้าสู่ระบบหรือสมัครสมาชิกเพื่อยอมรับคำเชิญ
                                    </p>
                                    <div className="flex justify-center gap-3">
                                        <Link href={`/login?invite=${code}`}>
                                            <Button>
                                                <LogIn className="w-4 h-4 mr-2" />
                                                เข้าสู่ระบบ
                                            </Button>
                                        </Link>
                                        <Link href={`/signup?invite=${code}`}>
                                            <Button variant="secondary">
                                                สมัครสมาชิก
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {error && (
                                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                            {error}
                                        </div>
                                    )}
                                    <Button
                                        size="lg"
                                        onClick={handleAccept}
                                        isLoading={isAccepting}
                                        className="w-full"
                                    >
                                        <Check className="w-4 h-4 mr-2" />
                                        ยอมรับและเข้าร่วม
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : null}
                </Card>
            </div>
        </div>
    );
}
