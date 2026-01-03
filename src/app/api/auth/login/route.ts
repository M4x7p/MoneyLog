import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createToken, setSessionCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as any;
        const { email, password } = body;

        // Validate input
        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            include: {
                memberships: {
                    include: {
                        family: true,
                    },
                },
            },
        });

        if (!user) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        // Verify password
        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        // Create session token
        const token = createToken({ userId: user.id, email: user.email });

        // Create response with user data
        const response = NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                createdAt: user.createdAt,
                memberships: user.memberships.map(m => ({
                    id: m.id,
                    role: m.role,
                    family: {
                        id: m.family.id,
                        name: m.family.name,
                    },
                })),
            },
        });

        // Set cookie on response
        response.cookies.set('moneylog-session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return response;
    } catch (error: any) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Failed to login', details: error?.message || 'Unknown error' },
            { status: 500 }
        );
    }
}
