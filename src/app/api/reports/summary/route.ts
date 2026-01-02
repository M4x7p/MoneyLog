import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getCurrentFamily } from '@/lib/auth';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subMonths, subYears } from 'date-fns';

type GroupBy = 'day' | 'week' | 'month' | 'year';

// GET - Get expense summary with aggregations
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

        // Parse parameters
        const ownerId = searchParams.get('ownerId'); // null = all members
        const groupBy = (searchParams.get('groupBy') || 'month') as GroupBy;
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const period = searchParams.get('period'); // 'this-month', 'last-month', 'this-year', etc.

        // Calculate date range
        let dateFrom: Date;
        let dateTo: Date;

        if (startDate && endDate) {
            dateFrom = new Date(startDate);
            dateTo = new Date(endDate + 'T23:59:59.999Z');
        } else {
            // Use period shortcuts
            const now = new Date();
            switch (period) {
                case 'today':
                    dateFrom = startOfDay(now);
                    dateTo = endOfDay(now);
                    break;
                case 'yesterday':
                    dateFrom = startOfDay(subDays(now, 1));
                    dateTo = endOfDay(subDays(now, 1));
                    break;
                case 'this-week':
                    dateFrom = startOfWeek(now, { weekStartsOn: 1 });
                    dateTo = endOfWeek(now, { weekStartsOn: 1 });
                    break;
                case 'last-week':
                    const lastWeek = subDays(now, 7);
                    dateFrom = startOfWeek(lastWeek, { weekStartsOn: 1 });
                    dateTo = endOfWeek(lastWeek, { weekStartsOn: 1 });
                    break;
                case 'this-month':
                    dateFrom = startOfMonth(now);
                    dateTo = endOfMonth(now);
                    break;
                case 'last-month':
                    const lastMonth = subMonths(now, 1);
                    dateFrom = startOfMonth(lastMonth);
                    dateTo = endOfMonth(lastMonth);
                    break;
                case 'this-year':
                    dateFrom = startOfYear(now);
                    dateTo = endOfYear(now);
                    break;
                case 'last-year':
                    const lastYear = subYears(now, 1);
                    dateFrom = startOfYear(lastYear);
                    dateTo = endOfYear(lastYear);
                    break;
                case 'last-30-days':
                    dateFrom = subDays(now, 30);
                    dateTo = now;
                    break;
                case 'last-90-days':
                    dateFrom = subDays(now, 90);
                    dateTo = now;
                    break;
                default:
                    // Default to this month
                    dateFrom = startOfMonth(now);
                    dateTo = endOfMonth(now);
            }
        }

        // Build where clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            familyId: family.id,
            dateTime: {
                gte: dateFrom,
                lte: dateTo,
            },
        };

        if (ownerId) {
            where.ownerUserId = ownerId;
        }

        // Get total spent
        const totalResult = await prisma.expenseTransaction.aggregate({
            where,
            _sum: { amount: true },
            _count: true,
        });

        // Get per-owner totals
        const ownerTotals = await prisma.expenseTransaction.groupBy({
            by: ['ownerUserId'],
            where: {
                familyId: family.id,
                dateTime: {
                    gte: dateFrom,
                    lte: dateTo,
                },
            },
            _sum: { amount: true },
            _count: true,
        });

        // Get user details for owner totals
        const memberMap = new Map(
            family.memberships.map(m => [m.user.id, m.user])
        );

        const perMember = ownerTotals.map(o => ({
            userId: o.ownerUserId,
            name: memberMap.get(o.ownerUserId)?.name || 'Unknown',
            total: o._sum.amount?.toString() || '0',
            count: o._count,
        }));

        // Get category breakdown
        const categoryTotals = await prisma.expenseTransaction.groupBy({
            by: ['categoryId'],
            where,
            _sum: { amount: true },
            _count: true,
            orderBy: {
                _sum: { amount: 'desc' },
            },
        });

        // Get category details
        const categoryIds = categoryTotals
            .map(c => c.categoryId)
            .filter((id): id is string => id !== null);

        const categories = await prisma.category.findMany({
            where: { id: { in: categoryIds } },
        });
        const categoryMap = new Map(categories.map(c => [c.id, c]));

        const byCategory = categoryTotals.map(c => ({
            categoryId: c.categoryId,
            categoryName: c.categoryId ? categoryMap.get(c.categoryId)?.name || 'Unknown' : 'Uncategorized',
            categoryEmoji: c.categoryId ? categoryMap.get(c.categoryId)?.emoji || '📦' : '❓',
            total: c._sum.amount?.toString() || '0',
            count: c._count,
        }));

        // Get recent transactions
        const recentTransactions = await prisma.expenseTransaction.findMany({
            where,
            include: {
                category: { select: { id: true, name: true, emoji: true } },
                owner: { select: { id: true, name: true } },
            },
            orderBy: { dateTime: 'desc' },
            take: 10,
        });

        // Calculate uncategorized count  
        const uncategorizedCount = await prisma.expenseTransaction.count({
            where: {
                ...where,
                categoryId: null,
            },
        });

        return NextResponse.json({
            summary: {
                dateRange: {
                    from: dateFrom.toISOString(),
                    to: dateTo.toISOString(),
                },
                total: totalResult._sum.amount?.toString() || '0',
                transactionCount: totalResult._count,
                uncategorizedCount,
                perMember,
                byCategory,
            },
            recentTransactions: recentTransactions.map(t => ({
                id: t.id,
                dateTime: t.dateTime.toISOString(),
                amount: t.amount.toString(),
                description: t.descriptionRaw,
                category: t.category,
                owner: t.owner,
            })),
        });
    } catch (error) {
        console.error('Get summary error:', error);
        return NextResponse.json(
            { error: 'Failed to get summary' },
            { status: 500 }
        );
    }
}
