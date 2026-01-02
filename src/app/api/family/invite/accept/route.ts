import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// POST - Accept an invite
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json() as any;
        const { code } = body;

        if (!code) {
            return NextResponse.json(
                { error: 'Invite code is required' },
                { status: 400 }
            );
        }

        // Check if user already has a family
        const existingMembership = await prisma.membership.findFirst({
            where: { userId: user.id },
        });

        if (existingMembership) {
            return NextResponse.json(
                { error: 'You already belong to a family. Leave your current family first.' },
                { status: 400 }
            );
        }

        // Find the family by invite code
        const family = await prisma.family.findUnique({
            where: { inviteCode: code },
            include: {
                memberships: {
                    include: {
                        user: true
                    }
                },
            },
        });

        if (!family) {
            return NextResponse.json(
                { error: 'Invalid invite code' },
                { status: 400 }
            );
        }

        // Check if invite is expired
        if (family.inviteExpiresAt && family.inviteExpiresAt < new Date()) {
            return NextResponse.json(
                { error: 'This invite has expired. Ask the family owner for a new invite.' },
                { status: 400 }
            );
        }

        // Check if family already has 2 members
        if (family.memberships.length >= 2) {
            return NextResponse.json(
                { error: 'This family already has maximum members (2)' },
                { status: 400 }
            );
        }

        // Create membership
        // transaction is not strictly required here as it's a single insert, but good practice if we want to ensure consistency
        const membership = await prisma.membership.create({
            data: {
                userId: user.id,
                familyId: family.id,
                role: 'MEMBER',
            },
            include: {
                family: {
                    include: {
                        memberships: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            family: {
                id: membership.family.id,
                name: membership.family.name,
                members: membership.family.memberships.map(m => ({
                    userId: m.user.id,
                    name: m.user.name,
                    email: m.user.email,
                    role: m.role,
                })),
            },
            message: `Welcome to ${membership.family.name}!`,
        });
    } catch (error) {
        console.error('Accept invite error:', error);
        return NextResponse.json(
            { error: 'Failed to accept invite' },
            { status: 500 }
        );
    }
}

// GET - Validate an invite code
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');

        if (!code) {
            return NextResponse.json(
                { error: 'Invite code is required' },
                { status: 400 }
            );
        }

        const family = await prisma.family.findUnique({
            where: { inviteCode: code },
            include: {
                memberships: {
                    include: {
                        user: {
                            select: { name: true },
                        },
                    },
                },
            },
        });

        if (!family) {
            return NextResponse.json(
                { valid: false, error: 'Invalid invite code' },
                { status: 200 }
            );
        }

        if (family.inviteExpiresAt && family.inviteExpiresAt < new Date()) {
            return NextResponse.json(
                { valid: false, error: 'This invite has expired' },
                { status: 200 }
            );
        }

        if (family.memberships.length >= 2) {
            return NextResponse.json(
                { valid: false, error: 'This family already has maximum members' },
                { status: 200 }
            );
        }

        // Find the owner/creator name (heuristic: first member or OWNER role if we had that info, usually first member is creator)
        const creatorName = family.memberships[0]?.user.name || 'someone';

        return NextResponse.json({
            valid: true,
            invite: {
                familyName: family.name,
                creatorName: creatorName,
                expiresAt: family.inviteExpiresAt,
            },
        });
    } catch (error) {
        console.error('Validate invite error:', error);
        return NextResponse.json(
            { valid: false, error: 'Failed to validate invite' },
            { status: 500 }
        );
    }
}
