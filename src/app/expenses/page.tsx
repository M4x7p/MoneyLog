'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { Card, Button, Input, Select, Spinner, Badge, Modal } from '@/components/ui';
import {
    Search,
    Filter,
    Download,
    Check,
    X,
    ChevronLeft,
    ChevronRight,
    Tags
} from 'lucide-react';

interface Category {
    id: string;
    name: string;
    emoji: string;
}

interface Transaction {
    id: string;
    dateTime: string;
    amount: string;
    itemType: string;
    channel: string;
    description: string;
    category: Category | null;
    owner: { id: string; name: string };
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

function ExpensesContent() {
    const { user, family } = useAuth();
    const searchParams = useSearchParams();

    const [expenses, setExpenses] = useState<Transaction[]>([]);
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
    });
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Filters
    const [search, setSearch] = useState('');
    const [ownerId, setOwnerId] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [uncategorizedOnly, setUncategorizedOnly] = useState(
        searchParams.get('uncategorizedOnly') === 'true'
    );
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Modal
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    const fetchExpenses = useCallback(async (page = 1) => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '50',
            });

            if (ownerId) params.set('ownerId', ownerId);
            if (categoryId) params.set('categoryId', categoryId);
            if (uncategorizedOnly) params.set('uncategorizedOnly', 'true');
            if (startDate) params.set('startDate', startDate);
            if (endDate) params.set('endDate', endDate);
            if (search) params.set('search', search);

            const res = await fetch(`/api/expenses?${params}`);
            const data = await res.json() as any;

            setExpenses(data.expenses || []);
            setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
        } catch (error) {
            console.error('Failed to fetch expenses:', error);
        }
        setIsLoading(false);
    }, [ownerId, categoryId, uncategorizedOnly, startDate, endDate, search]);

    const fetchCategories = useCallback(async () => {
        try {
            const res = await fetch('/api/categories');
            const data = await res.json() as any;
            setCategories(data.categories || []);
        } catch (error) {
            console.error('Failed to fetch categories:', error);
        }
    }, []);

    useEffect(() => {
        if (family) {
            fetchExpenses();
            fetchCategories();
        }
    }, [family, fetchExpenses, fetchCategories]);

    const handleSelectAll = () => {
        if (selectedIds.size === expenses.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(expenses.map(e => e.id)));
        }
    };

    const handleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleBulkCategory = async () => {
        if (selectedIds.size === 0 || !selectedCategory) return;

        setIsUpdating(true);
        try {
            const res = await fetch('/api/expenses/bulk-category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    expenseIds: Array.from(selectedIds),
                    categoryId: selectedCategory,
                }),
            });

            const data = await res.json() as any;

            if (data.success) {
                setShowCategoryModal(false);
                setSelectedIds(new Set());
                setSelectedCategory('');
                fetchExpenses(pagination.page);
            }
        } catch (error) {
            console.error('Failed to update categories:', error);
        }
        setIsUpdating(false);
    };

    const handleSingleCategory = async (expenseId: string, catId: string) => {
        try {
            await fetch('/api/expenses', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: expenseId,
                    categoryId: catId,
                }),
            });

            // Update local state
            setExpenses(prev => prev.map(e =>
                e.id === expenseId
                    ? { ...e, category: categories.find(c => c.id === catId) || null }
                    : e
            ));
        } catch (error) {
            console.error('Failed to update category:', error);
        }
    };

    const handleExport = () => {
        const params = new URLSearchParams();
        if (ownerId) params.set('ownerId', ownerId);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        if (categoryId) params.set('categoryId', categoryId);

        window.open(`/api/export/csv?${params}`, '_blank');
    };

    const formatCurrency = (amount: string) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
        }).format(parseFloat(amount));
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    const ownerOptions = [
        { value: '', label: 'ทุกคน' },
        ...(family?.members.map(m => ({
            value: m.userId,
            label: m.userId === user?.id ? `${m.name} (ฉัน)` : m.name,
        })) || []),
    ];

    const categoryOptions = [
        { value: '', label: 'ทุกหมวดหมู่' },
        ...categories.map(c => ({
            value: c.id,
            label: `${c.emoji} ${c.name}`,
        })),
    ];

    return (
        <ProtectedLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white">รายจ่าย</h1>
                        <p className="text-gray-400">
                            {pagination.total} รายการ
                            {uncategorizedOnly && ' (ยังไม่จัดหมวดหมู่)'}
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setShowFilters(!showFilters)}>
                            <Filter className="w-4 h-4 mr-2" />
                            ตัวกรอง
                        </Button>
                        <Button variant="secondary" onClick={handleExport}>
                            <Download className="w-4 h-4 mr-2" />
                            ส่งออก CSV
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                {showFilters && (
                    <Card className="animate-fadeIn">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <Input
                                    placeholder="ค้นหารายละเอียด..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-10"
                                />
                            </div>

                            <Select
                                options={ownerOptions}
                                value={ownerId}
                                onChange={(e) => setOwnerId(e.target.value)}
                            />

                            <Select
                                options={categoryOptions}
                                value={categoryId}
                                onChange={(e) => {
                                    setCategoryId(e.target.value);
                                    setUncategorizedOnly(false);
                                }}
                            />

                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={uncategorizedOnly}
                                        onChange={(e) => {
                                            setUncategorizedOnly(e.target.checked);
                                            if (e.target.checked) setCategoryId('');
                                        }}
                                    />
                                    <span className="text-gray-300 text-sm">ยังไม่จัดหมวดหมู่</span>
                                </label>
                            </div>

                            <Input
                                type="date"
                                placeholder="วันเริ่มต้น"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />

                            <Input
                                type="date"
                                placeholder="วันสิ้นสุด"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />

                            <Button onClick={() => fetchExpenses(1)} className="sm:col-span-2">
                                <Search className="w-4 h-4 mr-2" />
                                ค้นหา
                            </Button>
                        </div>
                    </Card>
                )}

                {/* Bulk Actions */}
                {selectedIds.size > 0 && (
                    <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 flex items-center justify-between animate-fadeIn">
                        <p className="text-violet-400">
                            เลือก {selectedIds.size} รายการ
                        </p>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                onClick={() => setShowCategoryModal(true)}
                            >
                                <Tags className="w-4 h-4 mr-2" />
                                จัดหมวดหมู่
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedIds(new Set())}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Table */}
                <Card className="overflow-hidden p-0">
                    {isLoading ? (
                        <div className="flex justify-center py-20">
                            <Spinner size="lg" />
                        </div>
                    ) : expenses.length > 0 ? (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-white/10 bg-white/5">
                                            <th className="text-left p-4">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.size === expenses.length}
                                                    onChange={handleSelectAll}
                                                />
                                            </th>
                                            <th className="text-left p-4 text-gray-400 text-sm font-medium">วันที่</th>
                                            <th className="text-left p-4 text-gray-400 text-sm font-medium">รายละเอียด</th>
                                            <th className="text-right p-4 text-gray-400 text-sm font-medium">จำนวน</th>
                                            <th className="text-left p-4 text-gray-400 text-sm font-medium">หมวดหมู่</th>
                                            <th className="text-left p-4 text-gray-400 text-sm font-medium">เจ้าของ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {expenses.map((expense) => (
                                            <tr
                                                key={expense.id}
                                                className="border-b border-white/5 table-row-hover"
                                            >
                                                <td className="p-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(expense.id)}
                                                        onChange={() => handleSelect(expense.id)}
                                                    />
                                                </td>
                                                <td className="p-4 text-white whitespace-nowrap">
                                                    {formatDate(expense.dateTime)}
                                                </td>
                                                <td className="p-4">
                                                    <div className="max-w-[300px]">
                                                        <p className="text-white text-sm truncate">
                                                            {expense.description || 'ไม่มีรายละเอียด'}
                                                        </p>
                                                        <p className="text-gray-500 text-xs">
                                                            {expense.channel} • {expense.itemType}
                                                        </p>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className="text-white font-medium">
                                                        {formatCurrency(expense.amount)}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <select
                                                        value={expense.category?.id || ''}
                                                        onChange={(e) => handleSingleCategory(expense.id, e.target.value)}
                                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                                                    >
                                                        <option value="" className="bg-slate-900">ยังไม่จัดหมวดหมู่</option>
                                                        {categories.map(c => (
                                                            <option key={c.id} value={c.id} className="bg-slate-900">
                                                                {c.emoji} {c.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="p-4">
                                                    <Badge>
                                                        {expense.owner.name}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {pagination.totalPages > 1 && (
                                <div className="flex items-center justify-between p-4 border-t border-white/10">
                                    <p className="text-gray-400 text-sm">
                                        หน้า {pagination.page} จาก {pagination.totalPages}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={pagination.page <= 1}
                                            onClick={() => fetchExpenses(pagination.page - 1)}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={pagination.page >= pagination.totalPages}
                                            onClick={() => fetchExpenses(pagination.page + 1)}
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-20">
                            <p className="text-gray-500">ไม่พบรายการ</p>
                        </div>
                    )}
                </Card>
            </div>

            {/* Bulk Category Modal */}
            <Modal
                isOpen={showCategoryModal}
                onClose={() => setShowCategoryModal(false)}
                title="จัดหมวดหมู่รายการที่เลือก"
            >
                <div className="space-y-4">
                    <p className="text-gray-400">
                        เลือกหมวดหมู่สำหรับ {selectedIds.size} รายการ
                    </p>

                    <Select
                        label="หมวดหมู่"
                        options={categories.map(c => ({
                            value: c.id,
                            label: `${c.emoji} ${c.name}`,
                        }))}
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                    />

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setShowCategoryModal(false)}>
                            ยกเลิก
                        </Button>
                        <Button
                            onClick={handleBulkCategory}
                            disabled={!selectedCategory}
                            isLoading={isUpdating}
                        >
                            <Check className="w-4 h-4 mr-2" />
                            บันทึก
                        </Button>
                    </div>
                </div>
            </Modal>
        </ProtectedLayout>
    );
}

export default function ExpensesPage() {
    return (
        <Suspense fallback={
            <ProtectedLayout>
                <div className="flex justify-center py-20">
                    <Spinner size="lg" />
                </div>
            </ProtectedLayout>
        }>
            <ExpensesContent />
        </Suspense>
    );
}
