import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getCurrentFamily } from '@/lib/auth';

// GET - List expenses with filters
export async function GET(request: NextRequest) {
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

        // Parse filters
        const ownerId = searchParams.get('ownerId');
        const categoryId = searchParams.get('categoryId');
        const uncategorizedOnly = searchParams.get('uncategorizedOnly') === 'true';
        const channel = searchParams.get('channel');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const minAmount = searchParams.get('minAmount');
        const maxAmount = searchParams.get('maxAmount');
        const search = searchParams.get('search');
        const batchId = searchParams.get('batchId');

        // Pagination
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
        const skip = (page - 1) * limit;

        // Build where clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            familyId: family.id,
        };

        if (ownerId) {
            where.ownerUserId = ownerId;
        }

        if (categoryId) {
            where.categoryId = categoryId;
        }

        if (uncategorizedOnly) {
            where.categoryId = null;
        }

        if (channel) {
            where.channel = { contains: channel, mode: 'insensitive' };
        }

        if (startDate) {
            where.dateTime = {
                ...(where.dateTime as object),
                gte: new Date(startDate),
            };
        }

        if (endDate) {
            where.dateTime = {
                ...(where.dateTime as object),
                lte: new Date(endDate + 'T23:59:59.999Z'),
            };
        }

        if (minAmount) {
            where.amount = {
                ...(where.amount as object),
                gte: parseFloat(minAmount),
            };
        }

        if (maxAmount) {
            where.amount = {
                ...(where.amount as object),
                lte: parseFloat(maxAmount),
            };
        }

        if (search) {
            where.descriptionRaw = { contains: search, mode: 'insensitive' };
        }

        if (batchId) {
            where.importBatchId = batchId;
        }

        // Fetch expenses
        const [expenses, total] = await Promise.all([
            prisma.expenseTransaction.findMany({
                where,
                include: {
                    category: {
                        select: {
                            id: true,
                            name: true,
                            emoji: true,
                        },
                    },
                    owner: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: { dateTime: 'desc' },
                skip,
                take: limit,
            }),
            prisma.expenseTransaction.count({ where }),
        ]);

        return NextResponse.json({
            expenses: expenses.map(e => ({
                id: e.id,
                dateTime: e.dateTime.toISOString(),
                amount: e.amount.toString(),
                itemType: e.itemType,
                channel: e.channel,
                description: e.descriptionRaw,
                category: e.category,
                owner: e.owner,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Get expenses error:', error);
        return NextResponse.json(
            { error: 'Failed to get expenses' },
            { status: 500 }
        );
    }
}

// PUT - Update a single expense (category)
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
        const { id, categoryId, createRule, rulePattern, ruleChannel } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'Expense ID is required' },
                { status: 400 }
            );
        }

        // Verify expense belongs to family
        const expense = await prisma.expenseTransaction.findFirst({
            where: {
                id,
                familyId: family.id,
            },
        });

        if (!expense) {
            return NextResponse.json(
                { error: 'Expense not found' },
                { status: 404 }
            );
        }

        // Verify category belongs to family if provided
        if (categoryId) {
            const category = await prisma.category.findFirst({
                where: {
                    id: categoryId,
                    familyId: family.id,
                },
            });

            if (!category) {
                return NextResponse.json(
                    { error: 'Category not found' },
                    { status: 404 }
                );
            }
        }

        // Update expense
        const updated = await prisma.expenseTransaction.update({
            where: { id },
            data: { categoryId: categoryId || null },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        emoji: true,
                    },
                },
            },
        });

        // Create rule if requested
        if (createRule && categoryId && rulePattern) {
            await prisma.categoryRule.create({
                data: {
                    familyId: family.id,
                    categoryId,
                    pattern: rulePattern.trim(),
                    channel: ruleChannel || null,
                    matchType: 'CONTAINS',
                    priority: 10,
                    enabled: true,
                },
            });
        }

        return NextResponse.json({
            success: true,
            expense: {
                id: updated.id,
                categoryId: updated.categoryId,
                category: updated.category,
            },
        });
    } catch (error) {
        console.error('Update expense error:', error);
        return NextResponse.json(
            { error: 'Failed to update expense' },
            { status: 500 }
        );
    }
}
