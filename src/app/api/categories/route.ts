import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getCurrentFamily } from '@/lib/auth';

// GET - List all categories for the family
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const family = await getCurrentFamily(user.id);
        if (!family) {
            return NextResponse.json(
                { error: 'You must join a family first' },
                { status: 400 }
            );
        }

        const categories = await prisma.category.findMany({
            where: { familyId: family.id },
            orderBy: { sortOrder: 'asc' },
            include: {
                _count: {
                    select: { expenses: true },
                },
            },
        });

        return NextResponse.json({
            categories: categories.map(c => ({
                id: c.id,
                name: c.name,
                emoji: c.emoji,
                active: c.active,
                sortOrder: c.sortOrder,
                expenseCount: c._count.expenses,
            })),
        });
    } catch (error) {
        console.error('Get categories error:', error);
        return NextResponse.json(
            { error: 'Failed to get categories' },
            { status: 500 }
        );
    }
}

// POST - Create a new category
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const family = await getCurrentFamily(user.id);
        if (!family) {
            return NextResponse.json(
                { error: 'You must join a family first' },
                { status: 400 }
            );
        }

        const body = await request.json() as any;
        const { name, emoji = '📦' } = body;

        if (!name || name.trim().length === 0) {
            return NextResponse.json(
                { error: 'Category name is required' },
                { status: 400 }
            );
        }

        // Check for duplicate name
        const existing = await prisma.category.findUnique({
            where: {
                familyId_name: {
                    familyId: family.id,
                    name: name.trim(),
                },
            },
        });

        if (existing) {
            return NextResponse.json(
                { error: 'A category with this name already exists' },
                { status: 400 }
            );
        }

        // Get max sortOrder
        const maxSort = await prisma.category.aggregate({
            where: { familyId: family.id },
            _max: { sortOrder: true },
        });

        const category = await prisma.category.create({
            data: {
                familyId: family.id,
                name: name.trim(),
                emoji: emoji.trim() || '📦',
                sortOrder: (maxSort._max.sortOrder || 0) + 1,
            },
        });

        return NextResponse.json({
            success: true,
            category: {
                id: category.id,
                name: category.name,
                emoji: category.emoji,
                active: category.active,
                sortOrder: category.sortOrder,
            },
        });
    } catch (error) {
        console.error('Create category error:', error);
        return NextResponse.json(
            { error: 'Failed to create category' },
            { status: 500 }
        );
    }
}

// PUT - Update a category
export async function PUT(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const family = await getCurrentFamily(user.id);
        if (!family) {
            return NextResponse.json(
                { error: 'You must join a family first' },
                { status: 400 }
            );
        }

        const body = await request.json() as any;
        const { id, name, emoji, active, sortOrder } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'Category ID is required' },
                { status: 400 }
            );
        }

        // Verify category belongs to family
        const existing = await prisma.category.findFirst({
            where: {
                id,
                familyId: family.id,
            },
        });

        if (!existing) {
            return NextResponse.json(
                { error: 'Category not found' },
                { status: 404 }
            );
        }

        // Build update data
        const updateData: { name?: string; emoji?: string; active?: boolean; sortOrder?: number } = {};
        if (name !== undefined) updateData.name = name.trim();
        if (emoji !== undefined) updateData.emoji = emoji.trim();
        if (active !== undefined) updateData.active = active;
        if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

        // Check for duplicate name if updating name
        if (updateData.name && updateData.name !== existing.name) {
            const duplicate = await prisma.category.findUnique({
                where: {
                    familyId_name: {
                        familyId: family.id,
                        name: updateData.name,
                    },
                },
            });

            if (duplicate) {
                return NextResponse.json(
                    { error: 'A category with this name already exists' },
                    { status: 400 }
                );
            }
        }

        const category = await prisma.category.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({
            success: true,
            category: {
                id: category.id,
                name: category.name,
                emoji: category.emoji,
                active: category.active,
                sortOrder: category.sortOrder,
            },
        });
    } catch (error) {
        console.error('Update category error:', error);
        return NextResponse.json(
            { error: 'Failed to update category' },
            { status: 500 }
        );
    }
}

// DELETE - Delete a category (soft delete by setting active=false)
export async function DELETE(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const family = await getCurrentFamily(user.id);
        if (!family) {
            return NextResponse.json(
                { error: 'You must join a family first' },
                { status: 400 }
            );
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'Category ID is required' },
                { status: 400 }
            );
        }

        // Verify category belongs to family
        const existing = await prisma.category.findFirst({
            where: {
                id,
                familyId: family.id,
            },
        });

        if (!existing) {
            return NextResponse.json(
                { error: 'Category not found' },
                { status: 404 }
            );
        }

        // Soft delete - just deactivate
        await prisma.category.update({
            where: { id },
            data: { active: false },
        });

        return NextResponse.json({
            success: true,
            message: 'Category deleted successfully',
        });
    } catch (error) {
        console.error('Delete category error:', error);
        return NextResponse.json(
            { error: 'Failed to delete category' },
            { status: 500 }
        );
    }
}
