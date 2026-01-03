const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    try {
        // ลองสร้าง user
        const user = await prisma.user.create({
            data: {
                email: 'localtest@example.com',
                passwordHash: 'test-hash-123',
                name: 'Local Test User'
            }
        });
        console.log('User created successfully:', JSON.stringify(user, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}
test();
