import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface CategoryDef {
    name: string;
    emoji: string;
    sortOrder: number;
}

const DEFAULT_CATEGORIES: CategoryDef[] = [
    { name: 'อาหาร/เครื่องดื่ม', emoji: '🍜', sortOrder: 1 },
    { name: 'เดินทาง/น้ำมัน/รถ', emoji: '🚗', sortOrder: 2 },
    { name: 'บิลบ้าน(ไฟ/น้ำ/เน็ต/โทร)', emoji: '🏠', sortOrder: 3 },
    { name: 'ผ่อน/บัตรเครดิต/หนี้', emoji: '💳', sortOrder: 4 },
    { name: 'สัตว์เลี้ยง', emoji: '🐕', sortOrder: 5 },
    { name: 'เลี้ยงดูบุตร', emoji: '👶', sortOrder: 6 },
    { name: 'ช้อปปิ้ง', emoji: '🛍️', sortOrder: 7 },
    { name: 'สุขภาพ', emoji: '🏥', sortOrder: 8 },
    { name: 'โอนให้คน/ครอบครัว', emoji: '💝', sortOrder: 9 },
    { name: 'สมัครสมาชิก/ตัดอัตโนมัติ', emoji: '🔄', sortOrder: 10 },
    { name: 'อื่นๆ/ยังไม่รู้หมวด', emoji: '📦', sortOrder: 99 },
];

async function main() {
    console.log('🌱 Starting seed...');

    // Create demo users
    const password = await bcrypt.hash('password123', 12);

    const user1 = await prisma.user.upsert({
        where: { email: 'demo1@moneylog.app' },
        update: {},
        create: {
            email: 'demo1@moneylog.app',
            name: 'Demo User 1',
            passwordHash: password,
        },
    });

    const user2 = await prisma.user.upsert({
        where: { email: 'demo2@moneylog.app' },
        update: {},
        create: {
            email: 'demo2@moneylog.app',
            name: 'Demo User 2',
            passwordHash: password,
        },
    });

    console.log('✅ Created demo users');

    // Create demo family
    let family = await prisma.family.findFirst({
        where: {
            memberships: {
                some: { userId: user1.id },
            },
        },
    });

    if (!family) {
        family = await prisma.family.create({
            data: {
                name: 'Demo Family',
            },
        });

        // Add memberships
        await prisma.membership.create({
            data: {
                userId: user1.id,
                familyId: family.id,
                role: 'OWNER',
            },
        });

        await prisma.membership.create({
            data: {
                userId: user2.id,
                familyId: family.id,
                role: 'MEMBER',
            },
        });

        console.log('✅ Created demo family with 2 members');

        // Create default categories
        for (const cat of DEFAULT_CATEGORIES) {
            await prisma.category.create({
                data: {
                    familyId: family.id,
                    name: cat.name,
                    emoji: cat.emoji,
                    sortOrder: cat.sortOrder,
                },
            });
        }

        console.log('✅ Created default categories');
    } else {
        console.log('ℹ️ Family already exists, skipping...');
    }

    // Create sample category rules
    const categories = await prisma.category.findMany({
        where: { familyId: family.id },
    });

    const categoryMap = new Map(categories.map((c: { name: string; id: string }) => [c.name, c.id]));

    const sampleRules = [
        { pattern: 'GRABFOOD', categoryName: 'อาหาร/เครื่องดื่ม' },
        { pattern: 'STARBUCKS', categoryName: 'อาหาร/เครื่องดื่ม' },
        { pattern: 'PTT', categoryName: 'เดินทาง/น้ำมัน/รถ' },
        { pattern: 'SHELL', categoryName: 'เดินทาง/น้ำมัน/รถ' },
        { pattern: 'MEA', categoryName: 'บิลบ้าน(ไฟ/น้ำ/เน็ต/โทร)' },
        { pattern: 'TRUE', categoryName: 'บิลบ้าน(ไฟ/น้ำ/เน็ต/โทร)' },
        { pattern: 'NETFLIX', categoryName: 'สมัครสมาชิก/ตัดอัตโนมัติ' },
        { pattern: 'SPOTIFY', categoryName: 'สมัครสมาชิก/ตัดอัตโนมัติ' },
        { pattern: 'SHOPEE', categoryName: 'ช้อปปิ้ง' },
        { pattern: 'LAZADA', categoryName: 'ช้อปปิ้ง' },
    ];

    const existingRules = await prisma.categoryRule.count({
        where: { familyId: family.id },
    });

    if (existingRules === 0) {
        for (const rule of sampleRules) {
            const categoryId = categoryMap.get(rule.categoryName);
            if (categoryId) {
                await prisma.categoryRule.create({
                    data: {
                        familyId: family.id,
                        categoryId,
                        pattern: rule.pattern,
                        matchType: 'CONTAINS',
                        priority: 10,
                        enabled: true,
                    },
                });
            }
        }
        console.log('✅ Created sample category rules');
    }

    console.log('');
    console.log('🎉 Seed completed!');
    console.log('');
    console.log('Demo accounts:');
    console.log('  Email: demo1@moneylog.app');
    console.log('  Email: demo2@moneylog.app');
    console.log('  Password: password123');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
