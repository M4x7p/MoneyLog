import { NextResponse } from 'next/server';
export const runtime = 'edge';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                { authenticated: false, user: null },
                { status: 200 }
            );
        }

        return NextResponse.json({
            authenticated: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                createdAt: user.createdAt,
                memberships: user.memberships.map(m => ({
                    id: m.id,
                    role: (m as { role: string }).role,
                    family: {
                        id: m.family.id,
                        name: m.family.name,
                    },
                })),
            },
        });
    } catch (error) {
        console.error('Session check error:', error);
        return NextResponse.json(
            { authenticated: false, user: null },
            { status: 200 }
        );
    }
}
