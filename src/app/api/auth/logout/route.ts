import { NextResponse } from 'next/server';
export const runtime = 'edge';
import { clearSessionCookie } from '@/lib/auth';

export async function POST() {
    try {
        await clearSessionCookie();
        return NextResponse.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { error: 'Failed to logout' },
            { status: 500 }
        );
    }
}
