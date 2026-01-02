import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getCurrentFamily } from '@/lib/auth';
import { categorizeTransactions } from '@/lib/categorization';

interface ParsedTransaction {
    dateTime: string;
    amount: number;
    itemType: string;
    channel: string;
    descriptionRaw: string;
    fingerprint: string;
}

// POST - Confirm and save the import
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const family = await getCurrentFamily(user.id);
        if (!family) {
            return NextResponse.json(
                { error: 'You must join a family first' },
                { status: 400 }
            );
        }

        const body = await request.json() as any;
        const {
            transactions: rawTransactions,
            fileHash,
            statementMonth,
            ownerId,
            mergeMode = 'DEDUP' // 'DEDUP' or 'REPLACE'
        } = body;

        if (!rawTransactions || !Array.isArray(rawTransactions)) {
            return NextResponse.json(
                { error: 'Transactions data is required' },
                { status: 400 }
            );
        }

        if (!fileHash || !statementMonth) {
            return NextResponse.json(
                { error: 'File hash and statement month are required' },
                { status: 400 }
            );
        }

        // Validate owner
        const selectedOwnerId = ownerId || user.id;
        const isValidOwner = family.memberships.some(m => m.user.id === selectedOwnerId);
        if (!isValidOwner) {
            return NextResponse.json(
                { error: 'Invalid owner selected' },
                { status: 400 }
            );
        }

        const transactions = rawTransactions as ParsedTransaction[];

        // Run import in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Handle replace mode - delete existing transactions for this month/owner
            if (mergeMode === 'REPLACE') {
                // Find existing batch for this month/owner
                const existingBatches = await tx.importBatch.findMany({
                    where: {
                        familyId: family.id,
                        ownerUserId: selectedOwnerId,
                        statementMonth,
                    },
                });

                // Delete existing transactions
                for (const batch of existingBatches) {
                    await tx.expenseTransaction.deleteMany({
                        where: { importBatchId: batch.id },
                    });
                    await tx.importBatch.delete({
                        where: { id: batch.id },
                    });
                }
            }

            // Get existing fingerprints for dedup mode
            let existingFingerprints = new Set<string>();
            if (mergeMode === 'DEDUP') {
                const existing = await tx.expenseTransaction.findMany({
                    where: {
                        familyId: family.id,
                        fingerprint: { in: transactions.map(t => t.fingerprint) },
                    },
                    select: { fingerprint: true },
                });
                existingFingerprints = new Set(existing.map(t => t.fingerprint));
            }

            // Filter out duplicates
            const newTransactions = transactions.filter(
                t => !existingFingerprints.has(t.fingerprint)
            );

            // Auto-categorize transactions
            const categorizeResults = await categorizeTransactions(
                family.id,
                newTransactions.map(t => ({
                    description: t.descriptionRaw,
                    channel: t.channel,
                    itemType: t.itemType,
                }))
            );

            // Create import batch
            const batch = await tx.importBatch.create({
                data: {
                    familyId: family.id,
                    uploadedByUserId: user.id,
                    ownerUserId: selectedOwnerId,
                    sourceBank: 'KBank',
                    statementMonth,
                    fileHash,
                    totalRowsFound: transactions.length,
                    importedCount: newTransactions.length,
                    skippedDuplicateCount: transactions.length - newTransactions.length,
                    uncategorizedCount: 0, // Will update after creating transactions
                    status: 'COMPLETED',
                },
            });

            // Create transactions
            let uncategorizedCount = 0;
            const createdTransactions = [];

            for (let i = 0; i < newTransactions.length; i++) {
                const t = newTransactions[i];
                const categorization = categorizeResults.get(i);

                if (!categorization?.categoryId) {
                    uncategorizedCount++;
                }

                const transaction = await tx.expenseTransaction.create({
                    data: {
                        familyId: family.id,
                        importBatchId: batch.id,
                        ownerUserId: selectedOwnerId,
                        dateTime: new Date(t.dateTime),
                        amount: t.amount,
                        itemType: t.itemType,
                        channel: t.channel,
                        descriptionRaw: t.descriptionRaw,
                        categoryId: categorization?.categoryId || null,
                        fingerprint: t.fingerprint,
                    },
                });

                createdTransactions.push({
                    id: transaction.id,
                    categoryId: categorization?.categoryId,
                    matchedBy: categorization?.matchedBy,
                });
            }

            // Update uncategorized count
            await tx.importBatch.update({
                where: { id: batch.id },
                data: { uncategorizedCount },
            });

            return {
                batchId: batch.id,
                importedCount: newTransactions.length,
                skippedDuplicateCount: transactions.length - newTransactions.length,
                uncategorizedCount,
                transactions: createdTransactions,
            };
        });

        // Log batch-level metadata only (no personal transaction data)
        console.log(`[IMPORT] Batch ${result.batchId} completed: ` +
            `imported=${result.importedCount}, skipped=${result.skippedDuplicateCount}, ` +
            `uncategorized=${result.uncategorizedCount}, month=${statementMonth}`);

        return NextResponse.json({
            success: true,
            batch: {
                id: result.batchId,
                importedCount: result.importedCount,
                skippedDuplicateCount: result.skippedDuplicateCount,
                uncategorizedCount: result.uncategorizedCount,
            },
            message: `Successfully imported ${result.importedCount} transactions. ` +
                `${result.skippedDuplicateCount > 0 ? `Skipped ${result.skippedDuplicateCount} duplicates. ` : ''}` +
                `${result.uncategorizedCount > 0 ? `${result.uncategorizedCount} need categorization.` : ''}`,
        });

    } catch (error) {
        console.error('Import confirm error:', error);

        // Check for unique constraint violation (duplicate fingerprint)
        if ((error as { code?: string }).code === 'P2002') {
            return NextResponse.json(
                { error: 'Some transactions already exist. Try using Merge mode.' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to import transactions' },
            { status: 500 }
        );
    }
}
