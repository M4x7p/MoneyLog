'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { Card, Badge, Spinner, Select } from '@/components/ui';
import {
    TrendingUp,
    TrendingDown,
    Calendar,
    ArrowUpRight,
    Users,
    PieChart
} from 'lucide-react';
import Link from 'next/link';

interface CategorySummary {
    categoryId: string | null;
    categoryName: string;
    categoryEmoji: string;
    total: string;
    count: number;
}

interface MemberSummary {
    userId: string;
    name: string;
    total: string;
    count: number;
}

interface Transaction {
    id: string;
    dateTime: string;
    amount: string;
    description: string;
    category: { id: string; name: string; emoji: string } | null;
    owner: { id: string; name: string };
}

interface Summary {
    dateRange: { from: string; to: string };
    total: string;
    transactionCount: number;
    uncategorizedCount: number;
    perMember: MemberSummary[];
    byCategory: CategorySummary[];
}

const PERIODS = [
    { value: 'this-month', label: 'เดือนนี้' },
    { value: 'last-month', label: 'เดือนที่แล้ว' },
    { value: 'this-week', label: 'สัปดาห์นี้' },
    { value: 'last-30-days', label: '30 วันที่ผ่านมา' },
    { value: 'this-year', label: 'ปีนี้' },
];

export default function DashboardPage() {
    const { user, family } = useAuth();
    const [period, setPeriod] = useState('this-month');
    const [ownerFilter, setOwnerFilter] = useState<string>('');
    const [summary, setSummary] = useState<Summary | null>(null);
    const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({ period });
            if (ownerFilter) params.set('ownerId', ownerFilter);

            const res = await fetch(`/api/reports/summary?${params}`);
            const data = await res.json() as any;

            if (data.summary) {
                setSummary(data.summary);
                setRecentTransactions(data.recentTransactions || []);
            }
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        }
        setIsLoading(false);
    }, [period, ownerFilter]);

    useEffect(() => {
        if (family) {
            fetchData();
        }
    }, [family, fetchData]);

    const formatCurrency = (amount: string | number) => {
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(num);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'short',
        });
    };

    const ownerOptions = [
        { value: '', label: 'ทั้งหมด (ครอบครัว)' },
        ...(family?.members.map(m => ({
            value: m.userId,
            label: m.userId === user?.id ? `${m.name} (ฉัน)` : m.name,
        })) || []),
    ];

    return (
        <ProtectedLayout>
            <div className="space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                        <p className="text-gray-400">{family?.name}</p>
                    </div>

                    <div className="flex gap-3">
                        <Select
                            options={PERIODS}
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            className="w-40"
                        />
                        <Select
                            options={ownerOptions}
                            value={ownerFilter}
                            onChange={(e) => setOwnerFilter(e.target.value)}
                            className="w-44"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Spinner size="lg" />
                    </div>
                ) : summary ? (
                    <>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Total Spent */}
                            <Card className="card-hover">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-gray-400 text-sm">ใช้จ่ายทั้งหมด</p>
                                        <p className="text-3xl font-bold text-white mt-1">
                                            {formatCurrency(summary.total)}
                                        </p>
                                        <p className="text-gray-500 text-sm mt-1">
                                            {summary.transactionCount} รายการ
                                        </p>
                                    </div>
                                    <div className="p-3 bg-violet-500/20 rounded-xl">
                                        <TrendingDown className="w-6 h-6 text-violet-400" />
                                    </div>
                                </div>
                            </Card>

                            {/* Per Member */}
                            {summary.perMember.map((member) => (
                                <Card key={member.userId} className="card-hover">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-gray-400 text-sm flex items-center gap-2">
                                                <Users className="w-4 h-4" />
                                                {member.name}
                                            </p>
                                            <p className="text-2xl font-bold text-white mt-1">
                                                {formatCurrency(member.total)}
                                            </p>
                                            <p className="text-gray-500 text-sm mt-1">
                                                {member.count} รายการ
                                            </p>
                                        </div>
                                        <div className="p-3 bg-emerald-500/20 rounded-xl">
                                            <TrendingUp className="w-6 h-6 text-emerald-400" />
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>

                        {/* Uncategorized alert */}
                        {summary.uncategorizedCount > 0 && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-500/20 rounded-lg">
                                        <PieChart className="w-5 h-5 text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="text-amber-400 font-medium">
                                            {summary.uncategorizedCount} รายการยังไม่ได้จัดหมวดหมู่
                                        </p>
                                        <p className="text-gray-400 text-sm">
                                            จัดหมวดหมู่เพื่อดูรายงานที่แม่นยำขึ้น
                                        </p>
                                    </div>
                                </div>
                                <Link
                                    href="/expenses?uncategorizedOnly=true"
                                    className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors text-sm font-medium"
                                >
                                    ดูรายการ
                                </Link>
                            </div>
                        )}

                        {/* Main Content Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Top Categories */}
                            <Card>
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-lg font-semibold text-white">หมวดหมู่ยอดนิยม</h2>
                                    <Link
                                        href="/expenses"
                                        className="text-violet-400 hover:text-violet-300 text-sm flex items-center gap-1"
                                    >
                                        ดูทั้งหมด <ArrowUpRight className="w-4 h-4" />
                                    </Link>
                                </div>

                                {summary.byCategory.length > 0 ? (
                                    <div className="space-y-4">
                                        {summary.byCategory.slice(0, 6).map((cat, index) => {
                                            const total = parseFloat(summary.total) || 1;
                                            const catTotal = parseFloat(cat.total) || 0;
                                            const percentage = (catTotal / total) * 100;

                                            return (
                                                <div key={cat.categoryId || 'uncategorized'}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xl">{cat.categoryEmoji}</span>
                                                            <span className="text-white">{cat.categoryName}</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-white font-medium">
                                                                {formatCurrency(cat.total)}
                                                            </span>
                                                            <span className="text-gray-500 text-sm ml-2">
                                                                {percentage.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="progress-bar">
                                                        <div
                                                            className="progress-bar-fill"
                                                            style={{ width: `${Math.min(percentage, 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-center py-8">
                                        ยังไม่มีข้อมูลค่าใช้จ่าย
                                    </p>
                                )}
                            </Card>

                            {/* Recent Transactions */}
                            <Card>
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-lg font-semibold text-white">รายการล่าสุด</h2>
                                    <Link
                                        href="/expenses"
                                        className="text-violet-400 hover:text-violet-300 text-sm flex items-center gap-1"
                                    >
                                        ดูทั้งหมด <ArrowUpRight className="w-4 h-4" />
                                    </Link>
                                </div>

                                {recentTransactions.length > 0 ? (
                                    <div className="space-y-3">
                                        {recentTransactions.slice(0, 8).map((tx) => (
                                            <div
                                                key={tx.id}
                                                className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xl">
                                                        {tx.category?.emoji || '📦'}
                                                    </span>
                                                    <div>
                                                        <p className="text-white text-sm line-clamp-1 max-w-[200px]">
                                                            {tx.description || tx.category?.name || 'ไม่มีรายละเอียด'}
                                                        </p>
                                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                                            <Calendar className="w-3 h-3" />
                                                            {formatDate(tx.dateTime)}
                                                            <span>•</span>
                                                            <span>{tx.owner.name}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-white font-medium">
                                                        {formatCurrency(tx.amount)}
                                                    </p>
                                                    {!tx.category && (
                                                        <Badge variant="warning">ยังไม่จัดหมวดหมู่</Badge>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-gray-500 mb-4">ยังไม่มีรายการค่าใช้จ่าย</p>
                                        <Link
                                            href="/import"
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500/20 text-violet-400 rounded-lg hover:bg-violet-500/30 transition-colors"
                                        >
                                            นำเข้า Statement
                                        </Link>
                                    </div>
                                )}
                            </Card>
                        </div>
                    </>
                ) : (
                    <Card className="text-center py-12">
                        <p className="text-gray-400">ไม่สามารถโหลดข้อมูลได้</p>
                    </Card>
                )}
            </div>
        </ProtectedLayout>
    );
}
