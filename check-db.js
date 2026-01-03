const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        // ดู Users ทั้งหมด
        const users = await prisma.user.findMany({
            select: { id: true, email: true, name: true }
        });
        console.log('Users:', JSON.stringify(users, null, 2));

        // ดู Families ทั้งหมด
        const families = await prisma.family.findMany({
            select: { id: true, name: true }
        });
        console.log('Families:', JSON.stringify(families, null, 2));

        // ดู Memberships ทั้งหมด
        const memberships = await prisma.membership.findMany({
            include: {
                user: { select: { email: true } },
                family: { select: { name: true } }
            }
        });
        console.log('Memberships:', JSON.stringify(memberships, null, 2));

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}
check();
