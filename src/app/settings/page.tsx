'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { Card, Button, Input, Badge, Spinner } from '@/components/ui';
import {
    Users,
    Copy,
    Check,
    RefreshCw,
    Settings as SettingsIcon,
    Shield,
    Bell,
    Trash2,
    UserPlus
} from 'lucide-react';

interface Invite {
    code: string;
    url: string;
    expiresAt: string;
}

interface Rule {
    id: string;
    pattern: string;
    matchType: string;
    channel: string | null;
    priority: number;
    enabled: boolean;
    category: {
        id: string;
        name: string;
        emoji: string;
    };
}

export default function SettingsPage() {
    const { user, family, refreshFamily } = useAuth();
    const [invite, setInvite] = useState<Invite | null>(null);
    const [rules, setRules] = useState<Rule[]>([]);
    const [isLoadingInvite, setIsLoadingInvite] = useState(false);
    const [isLoadingRules, setIsLoadingRules] = useState(true);
    const [copied, setCopied] = useState(false);

    const fetchInvite = useCallback(async () => {
        try {
            const res = await fetch('/api/family/invite');
            const data = await res.json();
            if (data.invite) {
                setInvite(data.invite);
            }
        } catch (error) {
            console.error('Failed to fetch invite:', error);
        }
    }, []);

    const fetchRules = useCallback(async () => {
        setIsLoadingRules(true);
        try {
            const res = await fetch('/api/rules');
            const data = await res.json();
            setRules(data.rules || []);
        } catch (error) {
            console.error('Failed to fetch rules:', error);
        }
        setIsLoadingRules(false);
    }, []);

    useEffect(() => {
        if (family) {
            fetchInvite();
            fetchRules();
        }
    }, [family, fetchInvite, fetchRules]);

    const generateNewInvite = async () => {
        setIsLoadingInvite(true);
        try {
            const res = await fetch('/api/family/invite', { method: 'POST' });
            const data = await res.json();
            if (data.success && data.invite) {
                setInvite(data.invite);
            }
        } catch (error) {
            console.error('Failed to generate invite:', error);
        }
        setIsLoadingInvite(false);
    };

    const copyInvite = () => {
        if (invite) {
            navigator.clipboard.writeText(invite.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const toggleRule = async (ruleId: string, enabled: boolean) => {
        try {
            await fetch('/api/rules', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: ruleId, enabled }),
            });
            setRules(prev => prev.map(r =>
                r.id === ruleId ? { ...r, enabled } : r
            ));
        } catch (error) {
            console.error('Failed to toggle rule:', error);
        }
    };

    const deleteRule = async (ruleId: string) => {
        if (!confirm('ต้องการลบกฎนี้หรือไม่?')) return;

        try {
            await fetch(`/api/rules?id=${ruleId}`, { method: 'DELETE' });
            setRules(prev => prev.filter(r => r.id !== ruleId));
        } catch (error) {
            console.error('Failed to delete rule:', error);
        }
    };

    const isOwner = family?.members.find(m => m.userId === user?.id)?.role === 'OWNER';
    const hasTwoMembers = (family?.memberCount || 0) >= 2;

    return (
        <ProtectedLayout>
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-white">ตั้งค่า</h1>
                    <p className="text-gray-400">จัดการครอบครัวและการตั้งค่าระบบ</p>
                </div>

                {/* Family Section */}
                <Card>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-violet-500/20 rounded-lg">
                            <Users className="w-5 h-5 text-violet-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-white">ครอบครัว</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                            <div>
                                <p className="text-white font-medium">{family?.name}</p>
                                <p className="text-gray-400 text-sm">
                                    {family?.memberCount} สมาชิก
                                </p>
                            </div>
                            {isOwner && (
                                <Badge variant="success">เจ้าของ</Badge>
                            )}
                        </div>

                        {/* Members List */}
                        <div className="space-y-2">
                            <p className="text-gray-400 text-sm">สมาชิก</p>
                            {family?.members.map((member) => (
                                <div
                                    key={member.userId}
                                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-full flex items-center justify-center">
                                            <span className="text-white font-semibold">
                                                {member.name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-white">
                                                {member.name}
                                                {member.userId === user?.id && (
                                                    <span className="text-gray-500 ml-2">(คุณ)</span>
                                                )}
                                            </p>
                                            <p className="text-gray-500 text-sm">{member.email}</p>
                                        </div>
                                    </div>
                                    <Badge variant={member.role === 'OWNER' ? 'success' : 'default'}>
                                        {member.role === 'OWNER' ? 'เจ้าของ' : 'สมาชิก'}
                                    </Badge>
                                </div>
                            ))}
                        </div>

                        {/* Invite Link (only if < 2 members) */}
                        {!hasTwoMembers && (
                            <div className="border-t border-white/10 pt-4 mt-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <UserPlus className="w-4 h-4 text-violet-400" />
                                    <p className="text-white font-medium">เชิญสมาชิกอีกคน</p>
                                </div>

                                {invite ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
                                            <code className="flex-1 text-sm text-violet-400 truncate">
                                                {invite.url}
                                            </code>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={copyInvite}
                                            >
                                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-500">
                                                หมดอายุ: {new Date(invite.expiresAt).toLocaleDateString('th-TH')}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={generateNewInvite}
                                                isLoading={isLoadingInvite}
                                            >
                                                <RefreshCw className="w-4 h-4 mr-2" />
                                                สร้างลิงก์ใหม่
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <Button onClick={generateNewInvite} isLoading={isLoadingInvite}>
                                        <UserPlus className="w-4 h-4 mr-2" />
                                        สร้างลิงก์เชิญ
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </Card>

                {/* Auto-categorization Rules */}
                <Card>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                            <SettingsIcon className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">กฎจัดหมวดหมู่อัตโนมัติ</h2>
                            <p className="text-gray-400 text-sm">ระบบจะใช้กฎเหล่านี้จัดหมวดหมู่รายการใหม่อัตโนมัติ</p>
                        </div>
                    </div>

                    {isLoadingRules ? (
                        <div className="flex justify-center py-8">
                            <Spinner />
                        </div>
                    ) : rules.length > 0 ? (
                        <div className="space-y-2">
                            {rules.map((rule) => (
                                <div
                                    key={rule.id}
                                    className={`flex items-center justify-between p-3 bg-white/5 rounded-lg ${!rule.enabled ? 'opacity-50' : ''
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{rule.category.emoji}</span>
                                        <div>
                                            <p className="text-white text-sm">
                                                <span className="text-gray-400">เมื่อ</span>{' '}
                                                <code className="px-1.5 py-0.5 bg-white/10 rounded text-violet-400">
                                                    {rule.pattern}
                                                </code>
                                                <span className="text-gray-400 mx-1">→</span>
                                                {rule.category.name}
                                            </p>
                                            <p className="text-gray-500 text-xs">
                                                {rule.matchType}
                                                {rule.channel && ` • ช่องทาง: ${rule.channel}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleRule(rule.id, !rule.enabled)}
                                        >
                                            {rule.enabled ? (
                                                <Check className="w-4 h-4 text-emerald-400" />
                                            ) : (
                                                <span className="text-gray-500">ปิด</span>
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => deleteRule(rule.id)}
                                        >
                                            <Trash2 className="w-4 h-4 text-red-400" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            <p>ยังไม่มีกฎจัดหมวดหมู่</p>
                            <p className="text-sm mt-1">
                                กฎจะถูกสร้างอัตโนมัติเมื่อคุณจัดหมวดหมู่รายการและเลือก &quot;สร้างกฎ&quot;
                            </p>
                        </div>
                    )}
                </Card>

                {/* Security Section */}
                <Card>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-amber-500/20 rounded-lg">
                            <Shield className="w-5 h-5 text-amber-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-white">ความปลอดภัย</h2>
                    </div>

                    <div className="space-y-4 text-sm text-gray-400">
                        <div className="flex items-start gap-3 p-3 bg-emerald-500/10 rounded-lg">
                            <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-white font-medium">ไฟล์ PDF ถูกลบหลังประมวลผล</p>
                                <p>ระบบไม่เก็บไฟล์ Statement ของคุณอย่างถาวร</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-emerald-500/10 rounded-lg">
                            <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-white font-medium">รหัสผ่าน PDF ไม่ถูกบันทึก</p>
                                <p>รหัสผ่านใช้เปิดไฟล์ครั้งเดียวและไม่ถูกเก็บไว้</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-emerald-500/10 rounded-lg">
                            <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-white font-medium">ข้อมูลดิบไม่ถูก Log</p>
                                <p>ระบบบันทึกเฉพาะข้อมูลสรุป ไม่บันทึกรายละเอียด Transaction</p>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Account Section */}
                <Card>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Bell className="w-5 h-5 text-blue-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-white">บัญชีผู้ใช้</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">ชื่อ</label>
                                <Input value={user?.name || ''} disabled />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">อีเมล</label>
                                <Input value={user?.email || ''} disabled />
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm">
                            * การเปลี่ยนแปลงข้อมูลบัญชียังไม่รองรับในเวอร์ชันนี้
                        </p>
                    </div>
                </Card>
            </div>
        </ProtectedLayout>
    );
}
