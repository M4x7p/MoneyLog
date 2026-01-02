export default {
    datasource: {
        db: {
            url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
        },
    },
};
