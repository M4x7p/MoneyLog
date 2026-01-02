'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { Card, Button, Input, Modal, Spinner } from '@/components/ui';
import {
    Plus,
    Edit2,
    Trash2,
    GripVertical,
    Check,
    X,
    Tag
} from 'lucide-react';

interface Category {
    id: string;
    name: string;
    emoji: string;
    active: boolean;
    sortOrder: number;
    expenseCount: number;
}

export default function CategoriesPage() {
    const { family } = useAuth();
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [name, setName] = useState('');
    const [emoji, setEmoji] = useState('📦');
    const [isSaving, setIsSaving] = useState(false);

    const fetchCategories = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/categories');
            const data = await res.json() as any;
            setCategories(data.categories || []);
        } catch (error) {
            console.error('Failed to fetch categories:', error);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (family) {
            fetchCategories();
        }
    }, [family, fetchCategories]);

    const openCreateModal = () => {
        setEditingCategory(null);
        setName('');
        setEmoji('📦');
        setShowModal(true);
    };

    const openEditModal = (category: Category) => {
        setEditingCategory(category);
        setName(category.name);
        setEmoji(category.emoji);
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!name.trim()) return;

        setIsSaving(true);
        try {
            if (editingCategory) {
                // Update
                await fetch('/api/categories', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: editingCategory.id,
                        name: name.trim(),
                        emoji: emoji.trim() || '📦',
                    }),
                });
            } else {
                // Create
                await fetch('/api/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name.trim(),
                        emoji: emoji.trim() || '📦',
                    }),
                });
            }

            setShowModal(false);
            fetchCategories();
        } catch (error) {
            console.error('Failed to save category:', error);
        }
        setIsSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('ต้องการลบหมวดหมู่นี้หรือไม่?')) return;

        try {
            await fetch(`/api/categories?id=${id}`, {
                method: 'DELETE',
            });
            fetchCategories();
        } catch (error) {
            console.error('Failed to delete category:', error);
        }
    };

    const toggleActive = async (category: Category) => {
        try {
            await fetch('/api/categories', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: category.id,
                    active: !category.active,
                }),
            });
            fetchCategories();
        } catch (error) {
            console.error('Failed to toggle category:', error);
        }
    };

    // Common emojis for expense categories
    const emojiPicker = [
        '🍜', '🍕', '🍔', '☕', '🍺',
        '🚗', '⛽', '🚌', '✈️', '🚕',
        '🏠', '💡', '💧', '📱', '🌐',
        '💳', '💰', '📊', '🏦', '💸',
        '🐕', '🐈', '🐾', '🦴', '🐟',
        '👶', '🧒', '🎓', '📚', '🧸',
        '🛍️', '👗', '👟', '💄', '⌚',
        '🏥', '💊', '🩺', '🏋️', '🧘',
        '💝', '👨‍👩‍👧', '💑', '🎁', '❤️',
        '🔄', '📅', '🎮', '🎬', '🎵',
        '📦', '❓', '⭐', '🎯', '✨',
    ];

    return (
        <ProtectedLayout>
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">หมวดหมู่</h1>
                        <p className="text-gray-400">จัดการหมวดหมู่ค่าใช้จ่ายของครอบครัว</p>
                    </div>

                    <Button onClick={openCreateModal}>
                        <Plus className="w-4 h-4 mr-2" />
                        เพิ่มหมวดหมู่
                    </Button>
                </div>

                {/* Categories List */}
                <Card className="p-0 overflow-hidden">
                    {isLoading ? (
                        <div className="flex justify-center py-20">
                            <Spinner size="lg" />
                        </div>
                    ) : categories.length > 0 ? (
                        <div className="divide-y divide-white/5">
                            {categories.map((category) => (
                                <div
                                    key={category.id}
                                    className={`flex items-center justify-between p-4 hover:bg-white/5 transition-colors ${!category.active ? 'opacity-50' : ''
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="text-gray-500 cursor-move">
                                            <GripVertical className="w-5 h-5" />
                                        </div>
                                        <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-2xl">
                                            {category.emoji}
                                        </div>
                                        <div>
                                            <p className="text-white font-medium">{category.name}</p>
                                            <p className="text-gray-500 text-sm">
                                                {category.expenseCount} รายการ
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleActive(category)}
                                            title={category.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                                        >
                                            {category.active ? (
                                                <Check className="w-4 h-4 text-emerald-400" />
                                            ) : (
                                                <X className="w-4 h-4 text-gray-500" />
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openEditModal(category)}
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(category.id)}
                                            disabled={category.expenseCount > 0}
                                            title={category.expenseCount > 0 ? 'ไม่สามารถลบได้เพราะมีรายการอยู่' : 'ลบ'}
                                        >
                                            <Trash2 className="w-4 h-4 text-red-400" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <Tag className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-500 mb-4">ยังไม่มีหมวดหมู่</p>
                            <Button onClick={openCreateModal}>
                                <Plus className="w-4 h-4 mr-2" />
                                สร้างหมวดหมู่แรก
                            </Button>
                        </div>
                    )}
                </Card>
            </div>

            {/* Create/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingCategory ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}
            >
                <div className="space-y-4">
                    <Input
                        label="ชื่อหมวดหมู่"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="เช่น อาหาร, เดินทาง, ช้อปปิ้ง"
                    />

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            ไอคอน
                        </label>
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center text-3xl">
                                {emoji}
                            </div>
                            <Input
                                value={emoji}
                                onChange={(e) => setEmoji(e.target.value)}
                                placeholder="📦"
                                className="w-24 text-center text-xl"
                                maxLength={4}
                            />
                        </div>
                        <div className="grid grid-cols-10 gap-1">
                            {emojiPicker.map((e) => (
                                <button
                                    key={e}
                                    type="button"
                                    onClick={() => setEmoji(e)}
                                    className={`w-8 h-8 rounded flex items-center justify-center hover:bg-white/10 transition-colors ${emoji === e ? 'bg-violet-500/20 ring-1 ring-violet-500' : ''
                                        }`}
                                >
                                    {e}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                        <Button variant="ghost" onClick={() => setShowModal(false)}>
                            ยกเลิก
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!name.trim()}
                            isLoading={isSaving}
                        >
                            <Check className="w-4 h-4 mr-2" />
                            {editingCategory ? 'บันทึก' : 'สร้างหมวดหมู่'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </ProtectedLayout>
    );
}
