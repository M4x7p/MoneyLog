import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getCurrentFamily } from '@/lib/auth';
import { parseKBankStatement, validatePdfFile } from '@/lib/parser/kbank-parser';
import { generateFileHash } from '@/lib/utils';
import { MAX_FILE_SIZE, ALLOWED_MIME_TYPES } from '@/lib/constants';

// POST - Upload and parse a PDF statement (preview mode)
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

        // Parse multipart form data
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const password = formData.get('password') as string | null;
        const ownerId = formData.get('ownerId') as string | null;

        if (!file) {
            return NextResponse.json(
                { error: 'PDF file is required' },
                { status: 400 }
            );
        }

        // Validate file type
        if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.name.endsWith('.pdf')) {
            return NextResponse.json(
                { error: 'Only PDF files are allowed' },
                { status: 400 }
            );
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: 'File size must be less than 10MB' },
                { status: 400 }
            );
        }

        // Validate owner if provided
        const selectedOwnerId = ownerId || user.id;
        const isValidOwner = family.memberships.some(m => m.user.id === selectedOwnerId);
        if (!isValidOwner) {
            return NextResponse.json(
                { error: 'Invalid owner selected' },
                { status: 400 }
            );
        }

        // Get owner info
        const owner = family.memberships.find(m => m.user.id === selectedOwnerId)?.user;

        // Read file into buffer
        const arrayBuffer = await file.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);

        // Generate file hash before parsing
        const fileHash = generateFileHash(fileBuffer);

        // Check for duplicate file upload
        const existingBatch = await prisma.importBatch.findFirst({
            where: {
                familyId: family.id,
                fileHash,
            },
            orderBy: { importedAt: 'desc' },
        });

        // Quick validation first
        const validation = await validatePdfFile(fileBuffer);

        if (!validation.valid && !validation.requiresPassword) {
            return NextResponse.json(
                {
                    error: validation.error || 'Invalid PDF file',
                    step: 'VALIDATION_FAILED',
                },
                { status: 400 }
            );
        }

        if (validation.requiresPassword && !password) {
            return NextResponse.json({
                success: false,
                step: 'PASSWORD_REQUIRED',
                message: 'This PDF is password-protected. Please enter the password.',
            });
        }

        // Parse the statement
        const parseResult = await parseKBankStatement(fileBuffer, {
            password: password || undefined,
        });

        if (!parseResult.success) {
            // Check specific error types
            if (parseResult.error === 'PASSWORD_REQUIRED') {
                return NextResponse.json({
                    success: false,
                    step: 'PASSWORD_REQUIRED',
                    message: 'This PDF is password-protected. Please enter the password.',
                });
            }

            if (parseResult.error?.includes('password')) {
                return NextResponse.json({
                    success: false,
                    step: 'PASSWORD_INVALID',
                    message: 'Incorrect password. Please try again.',
                });
            }

            return NextResponse.json(
                {
                    error: parseResult.error || 'Failed to parse statement',
                    step: 'PARSE_FAILED',
                },
                { status: 400 }
            );
        }

        // Check for existing transactions with same fingerprints
        const fingerprints = parseResult.transactions.map(t => t.fingerprint);
        const existingTransactions = await prisma.expenseTransaction.findMany({
            where: {
                familyId: family.id,
                fingerprint: { in: fingerprints },
            },
            select: { fingerprint: true },
        });
        const existingFingerprints = new Set(existingTransactions.map(t => t.fingerprint));

        // Prepare preview data
        const previewTransactions = parseResult.transactions.slice(0, 10).map((t, index) => ({
            index,
            dateTime: t.dateTime.toISOString(),
            amount: t.amount,
            itemType: t.itemType,
            channel: t.channel,
            description: t.descriptionRaw,
            isDuplicate: existingFingerprints.has(t.fingerprint),
        }));

        const duplicateCount = parseResult.transactions.filter(t =>
            existingFingerprints.has(t.fingerprint)
        ).length;

        return NextResponse.json({
            success: true,
            step: 'PREVIEW',
            fileHash,
            statementMonth: parseResult.statementMonth,
            accountNumber: parseResult.accountNumber,
            owner: {
                id: owner!.id,
                name: owner!.name,
            },
            summary: {
                totalTransactions: parseResult.transactions.length,
                duplicateCount,
                newTransactionCount: parseResult.transactions.length - duplicateCount,
            },
            preview: previewTransactions,
            existingBatch: existingBatch ? {
                id: existingBatch.id,
                importedAt: existingBatch.importedAt,
                statementMonth: existingBatch.statementMonth,
            } : null,
            // Store parsed data temporarily in session/memory 
            // In production, use Redis or similar for this
            _parsedData: {
                transactions: parseResult.transactions.map(t => ({
                    ...t,
                    dateTime: t.dateTime.toISOString(),
                })),
                fileHash,
                statementMonth: parseResult.statementMonth,
            },
        });

    } catch (error) {
        console.error('Import parse error:', error);
        return NextResponse.json(
            { error: 'Failed to process file' },
            { status: 500 }
        );
    }
}
