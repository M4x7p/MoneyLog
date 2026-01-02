import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getCurrentFamily } from '@/lib/auth';
import { generateInviteCode } from '@/lib/utils';

// GET - Get invite link/code for current family
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const family = await getCurrentFamily(user.id);
        if (!family) {
            return NextResponse.json(
                { error: 'You must create a family first' },
                { status: 400 }
            );
        }

        // Check if family already has 2 members
        if (family.memberships.length >= 2) {
            return NextResponse.json(
                { error: 'Family already has maximum members (2)' },
                { status: 400 }
            );
        }

        // Check if exists and valid
        if (family.inviteCode && family.inviteExpiresAt && new Date(family.inviteExpiresAt) > new Date()) {
            const inviteUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/invite/${family.inviteCode}`;
            return NextResponse.json({
                invite: {
                    code: family.inviteCode,
                    url: inviteUrl,
                    expiresAt: family.inviteExpiresAt,
                },
            });
        }

        return NextResponse.json({
            invite: null,
            message: 'No active invite. Create a new one.',
        });
    } catch (error) {
        console.error('Get invite error:', error);
        return NextResponse.json(
            { error: 'Failed to get invite' },
            { status: 500 }
        );
    }
}

// POST - Create a new invite link
export async function POST() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const family = await getCurrentFamily(user.id);
        if (!family) {
            return NextResponse.json(
                { error: 'You must create a family first' },
                { status: 400 }
            );
        }

        // Check if family already has 2 members
        if (family.memberships.length >= 2) {
            return NextResponse.json(
                { error: 'Family already has maximum members (2)' },
                { status: 400 }
            );
        }

        // Create new invite (valid for 7 days)
        const code = generateInviteCode();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await prisma.family.update({
            where: { id: family.id },
            data: {
                inviteCode: code,
                inviteExpiresAt: expiresAt,
            },
        });

        const inviteUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/invite/${code}`;

        return NextResponse.json({
            success: true,
            invite: {
                code: code,
                url: inviteUrl,
                expiresAt: expiresAt,
            },
            message: 'Invite link created! Share this with your partner.',
        });
    } catch (error) {
        console.error('Create invite error:', error);
        return NextResponse.json(
            { error: 'Failed to create invite' },
            { status: 500 }
        );
    }
}
