/* eslint-disable @typescript-eslint/no-require-imports */
import { INFLOW_PATTERNS } from '@/lib/constants';
import { generateTransactionFingerprint } from '@/lib/utils';

// Use unpdf for serverless compatibility (works without worker)
import { extractText } from 'unpdf';

export interface ParsedTransaction {
    dateTime: Date;
    amount: number;
    itemType: string;
    channel: string;
    descriptionRaw: string;
    fingerprint: string;
}

export interface ParseResult {
    success: boolean;
    transactions: ParsedTransaction[];
    statementMonth: string | null;
    accountNumber?: string;
    error?: string;
    rawRowCount: number;
    filteredOutCount: number;
}

export interface ParseOptions {
    password?: string;
}

/**
 * Extract text from PDF using unpdf
 */
async function extractPdfText(fileBuffer: Buffer, password?: string): Promise<string> {
    // Convert Buffer to Uint8Array as required by unpdf
    const uint8Array = new Uint8Array(fileBuffer);

    const { text } = await extractText(uint8Array, {
        mergePages: true,
    });
    return text;
}

/**
 * Parse KBank monthly statement PDF
 * Extracts expense (outflow) transactions only
 */
export async function parseKBankStatement(
    fileBuffer: Buffer,
    options: ParseOptions = {}
): Promise<ParseResult> {
    try {
        let text: string;

        try {
            text = await extractPdfText(fileBuffer, options.password);
        } catch (pdfError) {
            const errorMessage = (pdfError as Error).message || '';

            // Check if password is required or PDF is encrypted
            if (errorMessage.includes('password') || errorMessage.includes('encrypted') ||
                errorMessage.includes('PasswordException') || errorMessage.includes('decrypt')) {
                return {
                    success: false,
                    transactions: [],
                    statementMonth: null,
                    error: 'PDF_PASSWORD_PROTECTED',
                    rawRowCount: 0,
                    filteredOutCount: 0,
                };
            }

            throw pdfError;
        }

        // Check if we got any text
        if (!text || text.trim().length < 50) {
            return {
                success: false,
                transactions: [],
                statementMonth: null,
                error: 'Could not extract text from PDF. Make sure it\'s a text-based statement from K PLUS.',
                rawRowCount: 0,
                filteredOutCount: 0,
            };
        }

        // Extract statement month from the text
        const statementMonth = extractStatementMonth(text);

        // Extract account number
        const accountNumber = extractAccountNumber(text);

        // Parse transactions from text
        const { transactions, rawRowCount, filteredOutCount } = parseTransactions(text);

        return {
            success: true,
            transactions,
            statementMonth,
            accountNumber,
            rawRowCount,
            filteredOutCount,
        };

    } catch (error) {
        console.error('PDF parsing error:', error);
        return {
            success: false,
            transactions: [],
            statementMonth: null,
            error: `Failed to parse PDF: ${(error as Error).message}`,
            rawRowCount: 0,
            filteredOutCount: 0,
        };
    }
}

/**
 * Extract statement month from KBank statement text
 */
function extractStatementMonth(text: string): string | null {
    // Thai month patterns
    const thaiMonths: Record<string, string> = {
        'มกราคม': '01', 'กุมภาพันธ์': '02', 'มีนาคม': '03',
        'เมษายน': '04', 'พฤษภาคม': '05', 'มิถุนายน': '06',
        'กรกฎาคม': '07', 'สิงหาคม': '08', 'กันยายน': '09',
        'ตุลาคม': '10', 'พฤศจิกายน': '11', 'ธันวาคม': '12',
    };

    // English month patterns
    const engMonths: Record<string, string> = {
        'january': '01', 'february': '02', 'march': '03',
        'april': '04', 'may': '05', 'june': '06',
        'july': '07', 'august': '08', 'september': '09',
        'october': '10', 'november': '11', 'december': '12',
    };

    // Try Thai pattern first
    for (const [thaiMonth, monthNum] of Object.entries(thaiMonths)) {
        const regex = new RegExp(`${thaiMonth}\\s*(\\d{4})`, 'i');
        const match = text.match(regex);
        if (match) {
            let year = parseInt(match[1]);
            if (year > 2500) year = year - 543;
            return `${year}-${monthNum}`;
        }
    }

    // Try English pattern
    for (const [engMonth, monthNum] of Object.entries(engMonths)) {
        const regex = new RegExp(`${engMonth}\\s*(\\d{4})`, 'i');
        const match = text.match(regex);
        if (match) {
            return `${parseInt(match[1])}-${monthNum}`;
        }
    }

    // Try date range pattern
    const dateRangeMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})\s*[-–]\s*\d{2}\/\d{2}\/\d{4}/);
    if (dateRangeMatch) {
        let year = parseInt(dateRangeMatch[3]);
        if (year > 2500) year = year - 543;
        return `${year}-${dateRangeMatch[2]}`;
    }

    return null;
}

/**
 * Extract account number from KBank statement
 */
function extractAccountNumber(text: string): string | undefined {
    const patterns = [
        /บัญชี[:\s]*(\d{3}[-\s]?\d[-\s]?\d{5}[-\s]?\d)/i,
        /Account[:\s#]*(\d{3}[-\s]?\d[-\s]?\d{5}[-\s]?\d)/i,
        /(\d{3}-\d-\d{5}-\d)/,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1].replace(/\s/g, '');
    }
    return undefined;
}

/**
 * Parse transaction rows from text
 */
function parseTransactions(text: string): {
    transactions: ParsedTransaction[];
    rawRowCount: number;
    filteredOutCount: number;
} {
    const transactions: ParsedTransaction[] = [];
    let rawRowCount = 0;
    let filteredOutCount = 0;

    const lines = text.split(/\n|\r\n?/);

    // Pattern for KBank transactions
    const transactionPattern = /(\d{2}\/\d{2}\/\d{2,4})\s+(\d{2}:\d{2})\s+([\d,]+\.?\d*)\s+(.+)/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const match = line.match(transactionPattern);
        if (match) {
            rawRowCount++;

            const dateStr = match[1];
            const timeStr = match[2];
            const amountStr = match[3];
            const rest = match[4];

            const amount = parseFloat(amountStr.replace(/,/g, ''));
            if (isNaN(amount)) continue;

            // Check if this is inflow (income) - skip these
            const isInflow = INFLOW_PATTERNS.some(pattern =>
                rest.toLowerCase().includes(pattern.toLowerCase())
            );

            if (isInflow) {
                filteredOutCount++;
                continue;
            }

            const dateTime = parseTransactionDate(dateStr, timeStr);
            if (!dateTime) continue;

            const { itemType, channel, description } = parseTransactionDetails(rest);

            const fingerprint = generateTransactionFingerprint(
                dateTime,
                amount,
                channel,
                description
            );

            transactions.push({
                dateTime,
                amount,
                itemType,
                channel,
                descriptionRaw: description,
                fingerprint,
            });
        }
    }

    transactions.sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());

    return { transactions, rawRowCount, filteredOutCount };
}

/**
 * Parse transaction date from DD/MM/YYYY HH:MM format
 */
function parseTransactionDate(dateStr: string, timeStr: string): Date | null {
    try {
        const parts = dateStr.split('/');
        if (parts.length !== 3) return null;

        let day = parseInt(parts[0]);
        let month = parseInt(parts[1]);
        let year = parseInt(parts[2]);

        if (year < 100) year = year > 50 ? 1900 + year : 2000 + year;
        if (year > 2500) year = year - 543;

        const timeParts = timeStr.split(':');
        const hour = parseInt(timeParts[0]);
        const minute = parseInt(timeParts[1]);

        return new Date(year, month - 1, day, hour, minute);
    } catch {
        return null;
    }
}

/**
 * Parse transaction details
 */
function parseTransactionDetails(text: string): {
    itemType: string;
    channel: string;
    description: string;
} {
    const channels = [
        { pattern: /K\s*PLUS|K\+|KPLUS/i, name: 'K PLUS' },
        { pattern: /K-App/i, name: 'K-App' },
        { pattern: /ATM/i, name: 'ATM' },
        { pattern: /EDC|เครื่องรูด/i, name: 'EDC' },
        { pattern: /Mobile/i, name: 'Mobile Banking' },
    ];

    const itemTypes = [
        { pattern: /โอน|Transfer/i, name: 'โอนเงิน' },
        { pattern: /ชำระ|Payment|Pay/i, name: 'ชำระเงิน' },
        { pattern: /ถอน|Withdraw/i, name: 'ถอนเงิน' },
        { pattern: /QR/i, name: 'QR Payment' },
        { pattern: /PromptPay|พร้อมเพย์/i, name: 'PromptPay' },
    ];

    let channel = 'Other';
    let itemType = 'รายจ่าย';

    for (const ch of channels) {
        if (ch.pattern.test(text)) {
            channel = ch.name;
            break;
        }
    }

    for (const it of itemTypes) {
        if (it.pattern.test(text)) {
            itemType = it.name;
            break;
        }
    }

    return {
        itemType,
        channel,
        description: text.substring(0, 200).trim(),
    };
}

/**
 * Quick validation of PDF without full parsing
 */
export async function validatePdfFile(fileBuffer: Buffer): Promise<{
    valid: boolean;
    requiresPassword: boolean;
    error?: string;
}> {
    try {
        const text = await extractPdfText(fileBuffer);

        if (!text || text.trim().length < 50) {
            return {
                valid: false,
                requiresPassword: false,
                error: 'PDF appears to be empty or image-based. Please export a text-based statement.',
            };
        }

        // Check if it looks like a KBank statement
        const isKBank = text.includes('KBank') ||
            text.includes('กสิกร') ||
            text.includes('KASIKORN') ||
            text.includes('K PLUS');

        if (!isKBank) {
            return {
                valid: false,
                requiresPassword: false,
                error: 'This doesn\'t appear to be a KBank statement. Currently only KBank statements are supported.',
            };
        }

        return { valid: true, requiresPassword: false };

    } catch (error) {
        const errorMessage = (error as Error).message || '';

        if (errorMessage.includes('password') || errorMessage.includes('encrypted')) {
            return { valid: true, requiresPassword: true };
        }

        return {
            valid: false,
            requiresPassword: false,
            error: `Could not validate PDF: ${errorMessage}`,
        };
    }
}
