/* eslint-disable @typescript-eslint/no-require-imports */
import { INFLOW_PATTERNS } from '@/lib/constants';
import { parseThaiDate, generateTransactionFingerprint } from '@/lib/utils';

// Use pdfjs-dist legacy build for serverless compatibility (no worker needed)
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Disable worker to work in serverless environment
if (typeof window === 'undefined') {
    // @ts-ignore - Server-side only
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
}

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
 * Extract text from PDF using pdfjs-dist
 */
async function extractPdfText(fileBuffer: Buffer, password?: string): Promise<string> {
    const data = new Uint8Array(fileBuffer);

    const loadingTask = pdfjsLib.getDocument({
        data,
        password: password || undefined,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
    });

    const pdfDoc = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
        fullText += pageText + '\n';
    }

    return fullText;
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

            // Check if password is required
            if (errorMessage.includes('password') || errorMessage.includes('encrypted') || errorMessage.includes('PasswordException')) {
                return {
                    success: false,
                    transactions: [],
                    statementMonth: null,
                    error: 'PASSWORD_REQUIRED',
                    rawRowCount: 0,
                    filteredOutCount: 0,
                };
            }

            // Check if it's a scan/image-based PDF
            if (errorMessage.includes('stream')) {
                return {
                    success: false,
                    transactions: [],
                    statementMonth: null,
                    error: 'This appears to be a scanned/image-based PDF. Please export a text-based statement from K PLUS.',
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
 * Looks for patterns like "เดือน ธันวาคม 2567" or "December 2024"
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
        'jan': '01', 'feb': '02', 'mar': '03',
        'apr': '04', 'jun': '06', 'jul': '07',
        'aug': '08', 'sep': '09', 'oct': '10',
        'nov': '11', 'dec': '12',
    };

    // Try Thai pattern first: เดือน ธันวาคม 2567
    for (const [thaiMonth, monthNum] of Object.entries(thaiMonths)) {
        const regex = new RegExp(`${thaiMonth}\\s*(\\d{4})`, 'i');
        const match = text.match(regex);
        if (match) {
            let year = parseInt(match[1]);
            // Convert Buddhist year to Gregorian if > 2500
            if (year > 2500) {
                year = year - 543;
            }
            return `${year}-${monthNum}`;
        }
    }

    // Try English pattern: December 2024
    for (const [engMonth, monthNum] of Object.entries(engMonths)) {
        const regex = new RegExp(`${engMonth}\\s*(\\d{4})`, 'i');
        const match = text.match(regex);
        if (match) {
            const year = parseInt(match[1]);
            return `${year}-${monthNum}`;
        }
    }

    // Try pattern with date range: 01/12/2567 - 31/12/2567
    const dateRangeMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})\s*[-–]\s*\d{2}\/\d{2}\/\d{4}/);
    if (dateRangeMatch) {
        let year = parseInt(dateRangeMatch[3]);
        if (year > 2500) {
            year = year - 543;
        }
        return `${year}-${dateRangeMatch[2]}`;
    }

    return null;
}

/**
 * Extract account number from KBank statement
 */
function extractAccountNumber(text: string): string | undefined {
    // Pattern: xxx-x-xxxxx-x
    const patterns = [
        /บัญชี[:\s]*(\d{3}[-\s]?\d[-\s]?\d{5}[-\s]?\d)/i,
        /Account[:\s#]*(\d{3}[-\s]?\d[-\s]?\d{5}[-\s]?\d)/i,
        /A\/C[:\s#]*(\d{3}[-\s]?\d[-\s]?\d{5}[-\s]?\d)/i,
        /(\d{3}-\d-\d{5}-\d)/,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return match[1].replace(/\s/g, '');
        }
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

    // Split into lines and process
    const lines = text.split(/\n|\r\n?/);

    // Pattern for transaction lines
    // Format: DD/MM/YYYY HH:MM amount type channel description
    // or similar variations
    const transactionPattern = /(\d{2}\/\d{2}\/\d{2,4})\s+(\d{2}:\d{2})\s+([\d,]+\.?\d*)\s+(.+)/;

    // Alternative pattern for grouped data
    const altPattern = /(\d{2}\/\d{2}\/\d{2,4})\s+(\d{2}:\d{2})\s+([\d,]+\.?\d*)/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Try main pattern
        const match = line.match(transactionPattern);
        if (match) {
            rawRowCount++;

            const dateStr = match[1];
            const timeStr = match[2];
            const amountStr = match[3];
            const rest = match[4];

            // Parse amount
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

            // Parse date
            const dateTime = parseTransactionDate(dateStr, timeStr);
            if (!dateTime) continue;

            // Extract item type and channel from rest
            const { itemType, channel, description } = parseTransactionDetails(rest);

            // Generate fingerprint
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

    // Sort by date
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

        // Handle 2-digit year
        if (year < 100) {
            year = year > 50 ? 1900 + year : 2000 + year;
        }
        // Handle Buddhist year
        if (year > 2500) {
            year = year - 543;
        }

        const timeParts = timeStr.split(':');
        const hour = parseInt(timeParts[0]);
        const minute = parseInt(timeParts[1]);

        return new Date(year, month - 1, day, hour, minute);
    } catch {
        return null;
    }
}

/**
 * Parse transaction details to extract item type, channel, and description
 */
function parseTransactionDetails(text: string): {
    itemType: string;
    channel: string;
    description: string;
} {
    // Common channel patterns
    const channels = [
        { pattern: /K\s*PLUS|K\+|KPLUS/i, name: 'K PLUS' },
        { pattern: /K-App/i, name: 'K-App' },
        { pattern: /ATM/i, name: 'ATM' },
        { pattern: /EDC|เครื่องรูด/i, name: 'EDC' },
        { pattern: /Internet|Online/i, name: 'Internet Banking' },
        { pattern: /Counter|เคาน์เตอร์/i, name: 'Counter' },
        { pattern: /Mobile/i, name: 'Mobile Banking' },
    ];

    // Common item type patterns
    const itemTypes = [
        { pattern: /โอน|Transfer/i, name: 'โอนเงิน' },
        { pattern: /ชำระ|Payment|Pay/i, name: 'ชำระเงิน' },
        { pattern: /ถอน|Withdraw/i, name: 'ถอนเงิน' },
        { pattern: /ซื้อ|Purchase/i, name: 'ซื้อสินค้า' },
        { pattern: /จ่าย/i, name: 'จ่ายเงิน' },
        { pattern: /QR/i, name: 'QR Payment' },
        { pattern: /PromptPay|พร้อมเพย์/i, name: 'PromptPay' },
    ];

    let channel = 'Other';
    let itemType = 'รายจ่าย';

    // Find channel
    for (const ch of channels) {
        if (ch.pattern.test(text)) {
            channel = ch.name;
            break;
        }
    }

    // Find item type
    for (const it of itemTypes) {
        if (it.pattern.test(text)) {
            itemType = it.name;
            break;
        }
    }

    return {
        itemType,
        channel,
        description: text.substring(0, 200).trim(), // Limit description length
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

        if (errorMessage.includes('password') || errorMessage.includes('encrypted') || errorMessage.includes('PasswordException')) {
            return {
                valid: true,
                requiresPassword: true,
            };
        }

        return {
            valid: false,
            requiresPassword: false,
            error: `Could not validate PDF: ${errorMessage}`,
        };
    }
}
