import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getCurrentFamily } from '@/lib/auth';

// POST - Bulk update expense categories
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

        const body = await request.json();
        const { expenseIds, categoryId, createRule, rulePattern, ruleChannel } = body;

        if (!expenseIds || !Array.isArray(expenseIds) || expenseIds.length === 0) {
            return NextResponse.json(
                { error: 'At least one expense ID is required' },
                { status: 400 }
            );
        }

        if (expenseIds.length > 100) {
            return NextResponse.json(
                { error: 'Cannot update more than 100 expenses at once' },
                { status: 400 }
            );
        }

        // Verify all expenses belong to family
        const expenses = await prisma.expenseTransaction.findMany({
            where: {
                id: { in: expenseIds },
                familyId: family.id,
            },
        });

        if (expenses.length !== expenseIds.length) {
            return NextResponse.json(
                { error: 'Some expenses were not found or do not belong to your family' },
                { status: 400 }
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

        // Bulk update
        const result = await prisma.expenseTransaction.updateMany({
            where: {
                id: { in: expenseIds },
                familyId: family.id,
            },
            data: { categoryId: categoryId || null },
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
            updatedCount: result.count,
            message: `Successfully updated ${result.count} expenses`,
        });
    } catch (error) {
        console.error('Bulk update expenses error:', error);
        return NextResponse.json(
            { error: 'Failed to update expenses' },
            { status: 500 }
        );
    }
}
