import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getCurrentFamily } from '@/lib/auth';
import { format } from 'date-fns';

// GET - Export expenses as CSV
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
        const categoryId = searchParams.get('categoryId');

        // Build where clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            familyId: family.id,
        };

        if (ownerId) {
            where.ownerUserId = ownerId;
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

        if (categoryId) {
            where.categoryId = categoryId;
        }

        // Fetch all matching expenses
        const expenses = await prisma.expenseTransaction.findMany({
            where,
            include: {
                category: { select: { name: true, emoji: true } },
                owner: { select: { name: true } },
            },
            orderBy: { dateTime: 'desc' },
            take: 10000, // Limit to 10k rows
        });

        // Build CSV
        const headers = [
            'Date',
            'Time',
            'Amount (THB)',
            'Category',
            'Type',
            'Channel',
            'Description',
            'Owner',
        ];

        const rows = expenses.map(e => [
            format(e.dateTime, 'yyyy-MM-dd'),
            format(e.dateTime, 'HH:mm:ss'),
            e.amount.toString(),
            e.category ? `${e.category.emoji} ${e.category.name}` : 'Uncategorized',
            e.itemType,
            e.channel,
            `"${e.descriptionRaw.replace(/"/g, '""')}"`,
            e.owner.name,
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.join(',')),
        ].join('\n');

        // Add BOM for Excel Thai text support
        const bom = '\uFEFF';
        const csvWithBom = bom + csv;

        // Return as downloadable file
        return new NextResponse(csvWithBom, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="expenses_${format(new Date(), 'yyyyMMdd')}.csv"`,
            },
        });
    } catch (error) {
        console.error('Export CSV error:', error);
        return NextResponse.json(
            { error: 'Failed to export CSV' },
            { status: 500 }
        );
    }
}
