import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getCurrentFamily } from '@/lib/auth';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';

// GET - Get top categories for a period
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

        const ownerId = searchParams.get('ownerId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 20);

        // Default to this month
        const now = new Date();
        const dateFrom = startDate ? new Date(startDate) : startOfMonth(now);
        const dateTo = endDate ? new Date(endDate + 'T23:59:59.999Z') : endOfMonth(now);

        // Build where clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            familyId: family.id,
            dateTime: {
                gte: dateFrom,
                lte: dateTo,
            },
            categoryId: { not: null },
        };

        if (ownerId) {
            where.ownerUserId = ownerId;
        }

        // Get category totals
        const categoryTotals = await prisma.expenseTransaction.groupBy({
            by: ['categoryId'],
            where,
            _sum: { amount: true },
            _count: true,
            orderBy: {
                _sum: { amount: 'desc' },
            },
            take: limit,
        });

        // Get category details
        const categoryIds = categoryTotals
            .map(c => c.categoryId)
            .filter((id): id is string => id !== null);

        const categories = await prisma.category.findMany({
            where: { id: { in: categoryIds } },
        });
        const categoryMap = new Map(categories.map(c => [c.id, c]));

        // Calculate total for percentage
        const totalAmount = categoryTotals.reduce(
            (sum, c) => sum + (c._sum.amount || 0),
            0
        );

        // Get last month's data for comparison
        const lastMonthFrom = startOfMonth(subMonths(dateFrom, 1));
        const lastMonthTo = endOfMonth(subMonths(dateFrom, 1));

        const lastMonthTotals = await prisma.expenseTransaction.groupBy({
            by: ['categoryId'],
            where: {
                familyId: family.id,
                dateTime: {
                    gte: lastMonthFrom,
                    lte: lastMonthTo,
                },
                categoryId: { in: categoryIds },
                ...(ownerId ? { ownerUserId: ownerId } : {}),
            },
            _sum: { amount: true },
        });

        const lastMonthMap = new Map(
            lastMonthTotals.map(c => [c.categoryId, c._sum.amount || 0])
        );

        const topCategories = categoryTotals.map(c => {
            const category = c.categoryId ? categoryMap.get(c.categoryId) : null;
            const currentAmount = c._sum.amount || 0;
            const lastMonthAmount = lastMonthMap.get(c.categoryId!) || 0;

            let change = 0;
            if (lastMonthAmount > 0) {
                change = ((currentAmount - lastMonthAmount) / lastMonthAmount) * 100;
            }

            return {
                categoryId: c.categoryId,
                categoryName: category?.name || 'Unknown',
                categoryEmoji: category?.emoji || '📦',
                total: c._sum.amount?.toString() || '0',
                count: c._count,
                percentage: totalAmount > 0 ? (currentAmount / totalAmount) * 100 : 0,
                changeFromLastMonth: change,
            };
        });

        return NextResponse.json({
            topCategories,
            dateRange: {
                from: dateFrom.toISOString(),
                to: dateTo.toISOString(),
            },
            total: totalAmount.toString(),
        });
    } catch (error) {
        console.error('Get top categories error:', error);
        return NextResponse.json(
            { error: 'Failed to get top categories' },
            { status: 500 }
        );
    }
}
