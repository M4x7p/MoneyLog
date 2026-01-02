import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getCurrentFamily } from '@/lib/auth';
import { MatchType } from '@/lib/categorization';

// GET - List all category rules
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

        const rules = await prisma.categoryRule.findMany({
            where: { familyId: family.id },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        emoji: true,
                    },
                },
            },
            orderBy: [
                { priority: 'desc' },
                { createdAt: 'desc' },
            ],
        });

        return NextResponse.json({
            rules: rules.map(r => ({
                id: r.id,
                pattern: r.pattern,
                matchType: r.matchType,
                channel: r.channel,
                priority: r.priority,
                enabled: r.enabled,
                category: r.category,
                createdAt: r.createdAt.toISOString(),
            })),
        });
    } catch (error) {
        console.error('Get rules error:', error);
        return NextResponse.json(
            { error: 'Failed to get rules' },
            { status: 500 }
        );
    }
}

// POST - Create a new rule
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
        const {
            categoryId,
            pattern,
            matchType = 'CONTAINS',
            channel,
            priority = 10
        } = body;

        if (!categoryId) {
            return NextResponse.json(
                { error: 'Category ID is required' },
                { status: 400 }
            );
        }

        if (!pattern || pattern.trim().length === 0) {
            return NextResponse.json(
                { error: 'Pattern is required' },
                { status: 400 }
            );
        }

        // Validate category belongs to family
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

        // Validate match type
        const validMatchTypes = Object.values(MatchType);
        if (!validMatchTypes.includes(matchType as MatchType)) {
            return NextResponse.json(
                { error: 'Invalid match type' },
                { status: 400 }
            );
        }

        const rule = await prisma.categoryRule.create({
            data: {
                familyId: family.id,
                categoryId,
                pattern: pattern.trim(),
                matchType: matchType as MatchType,
                channel: channel?.trim() || null,
                priority: Math.max(0, Math.min(100, priority)),
                enabled: true,
            },
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

        return NextResponse.json({
            success: true,
            rule: {
                id: rule.id,
                pattern: rule.pattern,
                matchType: rule.matchType,
                channel: rule.channel,
                priority: rule.priority,
                enabled: rule.enabled,
                category: rule.category,
            },
        });
    } catch (error) {
        console.error('Create rule error:', error);
        return NextResponse.json(
            { error: 'Failed to create rule' },
            { status: 500 }
        );
    }
}

// PUT - Update a rule
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
        const { id, pattern, matchType, channel, priority, enabled } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'Rule ID is required' },
                { status: 400 }
            );
        }

        // Verify rule belongs to family
        const existing = await prisma.categoryRule.findFirst({
            where: {
                id,
                familyId: family.id,
            },
        });

        if (!existing) {
            return NextResponse.json(
                { error: 'Rule not found' },
                { status: 404 }
            );
        }

        // Build update data
        const updateData: {
            pattern?: string;
            matchType?: MatchType;
            channel?: string | null;
            priority?: number;
            enabled?: boolean;
        } = {};

        if (pattern !== undefined) updateData.pattern = pattern.trim();
        if (matchType !== undefined) {
            const validMatchTypes = Object.values(MatchType);
            if (!validMatchTypes.includes(matchType as MatchType)) {
                return NextResponse.json(
                    { error: 'Invalid match type' },
                    { status: 400 }
                );
            }
            updateData.matchType = matchType as MatchType;
        }
        if (channel !== undefined) updateData.channel = channel?.trim() || null;
        if (priority !== undefined) updateData.priority = Math.max(0, Math.min(100, priority));
        if (enabled !== undefined) updateData.enabled = enabled;

        const rule = await prisma.categoryRule.update({
            where: { id },
            data: updateData,
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

        return NextResponse.json({
            success: true,
            rule: {
                id: rule.id,
                pattern: rule.pattern,
                matchType: rule.matchType,
                channel: rule.channel,
                priority: rule.priority,
                enabled: rule.enabled,
                category: rule.category,
            },
        });
    } catch (error) {
        console.error('Update rule error:', error);
        return NextResponse.json(
            { error: 'Failed to update rule' },
            { status: 500 }
        );
    }
}

// DELETE - Delete a rule
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
                { error: 'Rule ID is required' },
                { status: 400 }
            );
        }

        // Verify rule belongs to family
        const existing = await prisma.categoryRule.findFirst({
            where: {
                id,
                familyId: family.id,
            },
        });

        if (!existing) {
            return NextResponse.json(
                { error: 'Rule not found' },
                { status: 404 }
            );
        }

        await prisma.categoryRule.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: 'Rule deleted successfully',
        });
    } catch (error) {
        console.error('Delete rule error:', error);
        return NextResponse.json(
            { error: 'Failed to delete rule' },
            { status: 500 }
        );
    }
}
