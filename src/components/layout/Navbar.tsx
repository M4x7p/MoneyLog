'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
    LayoutDashboard,
    Upload,
    List,
    Tags,
    Settings,
    LogOut,
    Users,
    ChevronDown,
    Wallet
} from 'lucide-react';
import { useState } from 'react';

export function Navbar() {
    const { user, family, logout } = useAuth();
    const pathname = usePathname();
    const [showUserMenu, setShowUserMenu] = useState(false);

    const navigation = [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Import', href: '/import', icon: Upload },
        { name: 'Expenses', href: '/expenses', icon: List },
        { name: 'Categories', href: '/categories', icon: Tags },
        { name: 'Settings', href: '/settings', icon: Settings },
    ];

    const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

    return (
        <nav className="bg-slate-900/80 backdrop-blur-xl border-b border-white/10 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    {/* Logo */}
                    <div className="flex items-center">
                        <Link href="/dashboard" className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center">
                                <Wallet className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                                MoneyLog
                            </span>
                        </Link>
                    </div>

                    {/* Navigation Links */}
                    <div className="hidden md:flex items-center space-x-1">
                        {navigation.map((item) => {
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive(item.href)
                                            ? 'bg-violet-500/20 text-violet-400'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span>{item.name}</span>
                                </Link>
                            );
                        })}
                    </div>

                    {/* User Menu */}
                    <div className="flex items-center">
                        {family && (
                            <div className="hidden md:flex items-center mr-4 px-3 py-1 bg-white/5 rounded-lg border border-white/10">
                                <Users className="w-4 h-4 text-violet-400 mr-2" />
                                <span className="text-sm text-gray-300">{family.name}</span>
                            </div>
                        )}

                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
                            >
                                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full flex items-center justify-center">
                                    <span className="text-white font-semibold">
                                        {user?.name?.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <span className="hidden sm:block">{user?.name}</span>
                                <ChevronDown className="w-4 h-4" />
                            </button>

                            {showUserMenu && (
                                <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-white/10 rounded-xl shadow-xl py-1">
                                    <div className="px-4 py-2 border-b border-white/10">
                                        <p className="text-sm font-medium text-white">{user?.name}</p>
                                        <p className="text-xs text-gray-400">{user?.email}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            logout();
                                            setShowUserMenu(false);
                                        }}
                                        className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        <span>Sign out</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Navigation */}
            <div className="md:hidden border-t border-white/10">
                <div className="flex overflow-x-auto scrollbar-hide">
                    {navigation.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex flex-col items-center flex-shrink-0 px-4 py-3 text-xs font-medium transition-all ${isActive(item.href)
                                        ? 'text-violet-400 border-b-2 border-violet-400'
                                        : 'text-gray-400'
                                    }`}
                            >
                                <Icon className="w-5 h-5 mb-1" />
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
