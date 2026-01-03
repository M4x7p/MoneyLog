import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

const AUTH_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'fallback-secret-do-not-use-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface JWTPayload {
    userId: string;
    email: string;
    iat?: number;
    exp?: number;
}

// Password hashing
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
}

// JWT Token handling
export function createToken(payload: { userId: string; email: string }): string {
    return jwt.sign(payload, AUTH_SECRET, { expiresIn: 60 * 60 * 24 * 7 }); // 7 days in seconds
}

export function verifyToken(token: string): JWTPayload | null {
    try {
        return jwt.verify(token, AUTH_SECRET) as JWTPayload;
    } catch {
        return null;
    }
}

// Session management
const COOKIE_NAME = 'moneylog-session';

export async function setSessionCookie(token: string): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
    });
}

export async function getSessionCookie(): Promise<string | undefined> {
    const cookieStore = await cookies();
    return cookieStore.get(COOKIE_NAME)?.value;
}

export async function clearSessionCookie(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}

// Get current user from session
export async function getCurrentUser() {
    const token = await getSessionCookie();
    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload) return null;

    try {
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: {
                id: true,
                email: true,
                name: true,
                createdAt: true,
                memberships: {
                    include: {
                        family: true,
                    },
                },
            },
        });
        return user;
    } catch {
        return null;
    }
}

// Get user's family (since we expect exactly one family per user)
export async function getCurrentFamily(userId: string) {
    const membership = await prisma.membership.findFirst({
        where: { userId },
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
    return membership?.family || null;
}

// Validate that user belongs to a specific family
export async function validateFamilyMembership(userId: string, familyId: string): Promise<boolean> {
    const membership = await prisma.membership.findUnique({
        where: {
            userId_familyId: { userId, familyId },
        },
    });
    return !!membership;
}
