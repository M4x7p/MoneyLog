import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { DEFAULT_CATEGORIES } from '@/lib/constants';

// GET - Get current user's family
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const membership = await prisma.membership.findFirst({
            where: { userId: user.id },
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
                                        lineUserId: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!membership) {
            return NextResponse.json({ hasFamily: false, family: null });
        }

        return NextResponse.json({
            hasFamily: true,
            family: {
                id: membership.family.id,
                name: membership.family.name,
                role: membership.role,
                members: membership.family.memberships.map((m: any) => ({
                    userId: m.user.id,
                    name: m.user.name,
                    email: m.user.email,
                    role: m.role,
                    joinedAt: m.joinedAt,
                })),
                memberCount: membership.family.memberships.length,
                categories: [],
            },
        });
    } catch (error) {
        console.error('Get family error:', error);
        return NextResponse.json(
            { error: 'Failed to get family' },
            { status: 500 }
        );
    }
}

// POST - Create a new family
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json() as any;
        const { name } = body;

        if (!name) {
            return NextResponse.json(
                { error: 'Family name is required' },
                { status: 400 }
            );
        }

        // Check if user already has a family
        const existingMembership = await prisma.membership.findFirst({
            where: { userId: user.id },
        });

        if (existingMembership) {
            return NextResponse.json(
                { error: 'You are already in a family' },
                { status: 400 }
            );
        }

        // Create family and membership in transaction
        const family = await prisma.$transaction(async (tx) => {
            const newFamily = await tx.family.create({
                data: { name },
            });

            await tx.membership.create({
                data: {
                    userId: user.id,
                    familyId: newFamily.id,
                    role: 'OWNER',
                },
            });

            // Create default categories
            for (const category of DEFAULT_CATEGORIES) {
                await tx.category.create({
                    data: {
                        familyId: newFamily.id,
                        name: category.name,
                        emoji: category.emoji,
                        sortOrder: category.sortOrder,
                    },
                });
            }

            return newFamily;
        });

        return NextResponse.json({
            success: true,
            family: {
                id: family.id,
                name: family.name,
            },
            message: 'Family created successfully! You can now invite your partner.',
        });
    } catch (error) {
        console.error('Create family error:', error);
        return NextResponse.json(
            { error: 'Failed to create family' },
            { status: 500 }
        );
    }
}
