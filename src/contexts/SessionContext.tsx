'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface User {
    id: string;
    email: string;
    name: string;
    createdAt: string;
    memberships: {
        id: string;
        role: 'OWNER' | 'MEMBER';
        family: {
            id: string;
            name: string;
        };
    }[];
}

interface Family {
    id: string;
    name: string;
    role: 'OWNER' | 'MEMBER';
    members: {
        userId: string;
        name: string;
        email: string;
        role: 'OWNER' | 'MEMBER';
    }[];
    memberCount: number;
    categories: {
        id: string;
        name: string;
        emoji: string;
        active: boolean;
        sortOrder: number;
    }[];
}

interface AuthContextType {
    user: User | null;
    family: Family | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    hasFamily: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signup: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    refreshFamily: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [family, setFamily] = useState<Family | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refreshUser = useCallback(async () => {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json() as any;
            if (data.authenticated) {
                setUser(data.user);
            } else {
                setUser(null);
                setFamily(null);
            }
        } catch {
            setUser(null);
            setFamily(null);
        }
    }, []);

    const refreshFamily = useCallback(async () => {
        try {
            const res = await fetch('/api/family');
            const data = await res.json() as any;
            console.log('[SessionContext] refreshFamily response:', data);
            if (data.hasFamily && data.family) {
                setFamily(data.family);
                console.log('[SessionContext] Family set:', data.family);
            } else {
                setFamily(null);
                console.log('[SessionContext] No family found');
            }
        } catch (e) {
            console.error('[SessionContext] refreshFamily error:', e);
            setFamily(null);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            try {
                // First check if user is authenticated
                const res = await fetch('/api/auth/me');
                const data = await res.json() as any;
                if (data.authenticated) {
                    setUser(data.user);
                    // Also load family data before setting isLoading to false
                    try {
                        const familyRes = await fetch('/api/family');
                        const familyData = await familyRes.json() as any;
                        console.log('[SessionContext] Initial family load:', familyData);
                        if (familyData.hasFamily && familyData.family) {
                            setFamily(familyData.family);
                        }
                    } catch (e) {
                        console.error('[SessionContext] Initial family load error:', e);
                    }
                } else {
                    setUser(null);
                    setFamily(null);
                }
            } catch {
                setUser(null);
                setFamily(null);
            }
            setIsLoading(false);
        };
        init();
    }, []);

    // Re-fetch family when user changes (e.g., after login)
    useEffect(() => {
        if (user && !family) {
            refreshFamily();
        }
    }, [user, family, refreshFamily]);

    const login = async (email: string, password: string) => {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json() as any;
            if (data.success) {
                setUser(data.user);
                return { success: true };
            }
            return { success: false, error: data.error || 'Login failed' };
        } catch {
            return { success: false, error: 'Network error' };
        }
    };

    const signup = async (email: string, password: string, name: string) => {
        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name }),
            });
            const data = await res.json() as any;
            if (data.success) {
                setUser(data.user);
                return { success: true };
            }
            return { success: false, error: data.error || 'Signup failed' };
        } catch {
            return { success: false, error: 'Network error' };
        }
    };

    const logout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } finally {
            setUser(null);
            setFamily(null);
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                family,
                isLoading,
                isAuthenticated: !!user,
                hasFamily: !!family,
                login,
                signup,
                logout,
                refreshUser,
                refreshFamily,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
