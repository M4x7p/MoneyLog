import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getCurrentFamily } from '@/lib/auth';
import { parseKBankStatement, validatePdfFile } from '@/lib/parser/kbank-parser';
import { parseCsvStatement } from '@/lib/parser/csv-parser';
import { generateFileHash } from '@/lib/utils';
import { MAX_FILE_SIZE } from '@/lib/constants';

// Supported file types
const ALLOWED_EXTENSIONS = ['.pdf', '.csv'];
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'text/plain',
];

// POST - Upload and parse a PDF or CSV statement (preview mode)
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
        const bank = (formData.get('bank') as string | null) || 'kbank';

        if (!file) {
            return NextResponse.json(
                { error: 'File is required' },
                { status: 400 }
            );
        }

        // Get file extension
        const fileName = file.name.toLowerCase();
        const fileExt = fileName.substring(fileName.lastIndexOf('.'));
        const isCsv = fileExt === '.csv' || file.type.includes('csv') || file.type === 'text/plain';
        const isPdf = fileExt === '.pdf' || file.type === 'application/pdf';

        // Validate file type
        if (!isCsv && !isPdf) {
            return NextResponse.json(
                { error: 'Only PDF and CSV files are allowed' },
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

        // Read file content
        const arrayBuffer = await file.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);

        // Generate file hash
        const fileHash = generateFileHash(fileBuffer);

        // Check for duplicate file upload
        const existingBatch = await prisma.importBatch.findFirst({
            where: {
                familyId: family.id,
                fileHash,
            },
            orderBy: { importedAt: 'desc' },
        });

        let parseResult;

        if (isCsv) {
            // Parse CSV file
            const textContent = new TextDecoder('utf-8').decode(fileBuffer);
            parseResult = await parseCsvStatement(textContent, bank as 'kbank' | 'scb');
        } else {
            // Parse PDF file
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

            parseResult = await parseKBankStatement(fileBuffer, {
                password: password || undefined,
            });
        }

        if (!parseResult.success) {
            // Check specific error types
            if (parseResult.error === 'PASSWORD_REQUIRED') {
                return NextResponse.json({
                    success: false,
                    step: 'PASSWORD_REQUIRED',
                    message: 'This PDF is password-protected. Please enter the password.',
                });
            }

            // PDF is password protected but we can't decrypt it
            if (parseResult.error === 'PDF_PASSWORD_PROTECTED') {
                return NextResponse.json({
                    success: false,
                    step: 'PASSWORD_NOT_SUPPORTED',
                    message: 'ขออภัย ระบบยังไม่รองรับ PDF ที่มีรหัสผ่าน กรุณาใช้ไฟล์ CSV แทน หรือปลดล็อก PDF ก่อนอัปโหลด',
                }, { status: 400 });
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

        // Check if we got any transactions
        if (parseResult.transactions.length === 0) {
            return NextResponse.json(
                {
                    error: 'ไม่พบรายการใดในไฟล์ กรุณาตรวจสอบว่าไฟล์ถูกต้องและมีรายการรายจ่าย',
                    step: 'NO_TRANSACTIONS',
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
            fileType: isCsv ? 'csv' : 'pdf',
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
            // Store parsed data temporarily
            _parsedData: {
                transactions: parseResult.transactions.map(t => ({
                    ...t,
                    dateTime: t.dateTime.toISOString(),
                })),
                fileHash,
                statementMonth: parseResult.statementMonth,
            },
        });

    } catch (error: any) {
        console.error('Import parse error:', error);
        return NextResponse.json(
            {
                error: 'Failed to process file',
                details: error?.message || 'Unknown error',
            },
            { status: 500 }
        );
    }
}
