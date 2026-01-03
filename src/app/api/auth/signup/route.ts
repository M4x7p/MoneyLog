import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, createToken, setSessionCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as any;
        const { email, password, name } = body;

        // Validate input
        if (!email || !password || !name) {
            return NextResponse.json(
                { error: 'Email, password, and name are required' },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Validate password strength
        if (password.length < 8) {
            return NextResponse.json(
                { error: 'Password must be at least 8 characters' },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });

        if (existingUser) {
            return NextResponse.json(
                { error: 'Email already registered' },
                { status: 409 }
            );
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create user
        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                passwordHash,
                name,
            },
            select: {
                id: true,
                email: true,
                name: true,
                createdAt: true,
            },
        });

        // Create session token
        const token = createToken({ userId: user.id, email: user.email });
        await setSessionCookie(token);

        return NextResponse.json({
            success: true,
            user,
            message: 'Account created successfully',
        });
    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json(
            { error: 'Failed to create account' },
            { status: 500 }
        );
    }
}
