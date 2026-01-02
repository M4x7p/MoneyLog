/* eslint-disable @typescript-eslint/no-require-imports */
import { INFLOW_PATTERNS } from '@/lib/constants';
import { parseThaiDate, generateTransactionFingerprint } from '@/lib/utils';

// pdf-parse v2 uses named exports, require works better for server-side
const pdfParse = require('pdf-parse/node');

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
 * Parse KBank monthly statement PDF
 * Extracts expense (outflow) transactions only
 */
export async function parseKBankStatement(
    fileBuffer: Buffer,
    options: ParseOptions = {}
): Promise<ParseResult> {
    try {
        // Attempt to parse PDF with optional password
        const pdfOptions: { password?: string } = {};
        if (options.password) {
            pdfOptions.password = options.password;
        }

        let data: { text: string; numpages: number; info: unknown };
        try {
            data = await pdfParse.pdf(fileBuffer, pdfOptions);
        } catch (pdfError) {
            const errorMessage = (pdfError as Error).message || '';

            // Check if password is required
            if (errorMessage.includes('password') || errorMessage.includes('encrypted')) {
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
            if (errorMessage.includes('stream') || data! && !data.text) {
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

        const text = data.text;

        // Check if we got any meaningful text
        if (!text || text.trim().length < 100) {
            return {
                success: false,
                transactions: [],
                statementMonth: null,
                error: 'Could not extract text from PDF. This may be a scanned/image-based document.',
                rawRowCount: 0,
                filteredOutCount: 0,
            };
        }

        // Parse the statement
        const transactions = parseStatementText(text);

        if (transactions.length === 0) {
            return {
                success: false,
                transactions: [],
                statementMonth: null,
                error: 'No expense transactions found in this statement. Please ensure this is a KBank monthly statement.',
                rawRowCount: 0,
                filteredOutCount: 0,
            };
        }

        // Detect statement month from transactions
        const dates = transactions.map(t => t.dateTime);
        const statementMonth = detectStatementMonthFromDates(dates);

        // Try to extract account number
        const accountNumber = extractAccountNumber(text);

        return {
            success: true,
            transactions,
            statementMonth,
            accountNumber,
            rawRowCount: transactions.length,
            filteredOutCount: 0, // Will be updated by caller if filtering applied
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
 * Parse statement text into transactions
 * This handles the typical KBank statement format
 */
function parseStatementText(text: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // KBank statement patterns
    // Date pattern: DD/MM/YYYY or DD-MM-YYYY
    const datePattern = /(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/;
    // Time pattern: HH:MM or HH:MM:SS
    const timePattern = /(\d{1,2}:\d{2}(?::\d{2})?)/;
    // Amount pattern: numbers with commas and decimals (negative or debit)
    const amountPattern = /([\d,]+\.\d{2})/g;

    let currentDate: string | null = null;
    let currentTime: string | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip header rows and balance rows
        if (isHeaderOrBalanceRow(line)) {
            continue;
        }

        // Check if this is an inflow (income) row - skip these
        if (isInflowRow(line)) {
            continue;
        }

        // Try to extract date from line
        const dateMatch = line.match(datePattern);
        if (dateMatch) {
            currentDate = dateMatch[1];
        }

        // Try to extract time from line
        const timeMatch = line.match(timePattern);
        if (timeMatch) {
            currentTime = timeMatch[1];
        }

        // Try to parse as a transaction row
        const transaction = parseTransactionLine(line, currentDate, currentTime);
        if (transaction) {
            // Verify it's an expense (outflow)
            if (isExpenseTransaction(line, transaction)) {
                transactions.push(transaction);
            }
        }
    }

    return transactions;
}

/**
 * Parse a single transaction line
 */
function parseTransactionLine(
    line: string,
    currentDate: string | null,
    currentTime: string | null
): ParsedTransaction | null {
    // Date pattern within the line
    const datePattern = /(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/;
    const timePattern = /(\d{1,2}:\d{2}(?::\d{2})?)/;
    const amountPattern = /([\d,]+\.\d{2})/g;

    // Extract date from line or use current
    const dateMatch = line.match(datePattern);
    const lineDate = dateMatch ? dateMatch[1] : currentDate;

    if (!lineDate) {
        return null;
    }

    // Extract time
    const timeMatch = line.match(timePattern);
    const lineTime = timeMatch ? timeMatch[1] : currentTime;

    // Extract all amounts from line
    const amounts: number[] = [];
    let amountMatch;
    while ((amountMatch = amountPattern.exec(line)) !== null) {
        const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
        if (amount > 0) {
            amounts.push(amount);
        }
    }

    // Need at least one amount for expenses
    if (amounts.length === 0) {
        return null;
    }

    // For KBank, outflow is typically the first significant amount
    // Balance is usually the last amount
    let expenseAmount = amounts[0];

    // If we have multiple amounts, try to identify the expense vs balance
    if (amounts.length >= 2) {
        // The expense amount is typically smaller than balance
        // or we look for specific patterns
        expenseAmount = amounts[0];
    }

    // Skip very small amounts (likely fees shown separately)
    if (expenseAmount < 1) {
        return null;
    }

    // Parse date/time
    let dateTime: Date;
    try {
        dateTime = parseThaiDate(lineDate, lineTime || undefined);
    } catch {
        return null;
    }

    // Extract channel and item type
    const { channel, itemType } = extractChannelAndType(line);

    // Clean description
    const description = cleanDescription(line);

    // Generate fingerprint
    const fingerprint = generateTransactionFingerprint(
        dateTime,
        expenseAmount,
        channel,
        description
    );

    return {
        dateTime,
        amount: expenseAmount,
        itemType,
        channel,
        descriptionRaw: description,
        fingerprint,
    };
}

/**
 * Extract channel and transaction type from line
 */
function extractChannelAndType(line: string): { channel: string; itemType: string } {
    const upperLine = line.toUpperCase();

    // Channel detection
    let channel = 'Other';
    if (upperLine.includes('K PLUS') || upperLine.includes('KPLUS')) {
        channel = 'K PLUS';
    } else if (upperLine.includes('EDC') || upperLine.includes('K SHOP')) {
        channel = 'EDC/K SHOP';
    } else if (upperLine.includes('DIRECT DEBIT')) {
        channel = 'Online Direct Debit';
    } else if (upperLine.includes('INTERNET') || upperLine.includes('MOBILE')) {
        channel = 'Internet/Mobile';
    } else if (upperLine.includes('ATM')) {
        channel = 'ATM';
    } else if (upperLine.includes('COUNTER') || upperLine.includes('BRANCH')) {
        channel = 'Counter';
    } else if (upperLine.includes('AUTO') && upperLine.includes('DEBIT')) {
        channel = 'Auto Debit';
    }

    // Item type detection (Thai terms)
    let itemType = 'Other';
    if (line.includes('โอนเงิน') || line.includes('โอน')) {
        itemType = 'โอนเงิน';
    } else if (line.includes('ชำระเงิน') || line.includes('ชำระ')) {
        itemType = 'ชำระเงิน';
    } else if (line.includes('หักบัญชี')) {
        itemType = 'หักบัญชี';
    } else if (line.includes('ถอนเงิน') || line.includes('ถอน')) {
        itemType = 'ถอนเงิน';
    } else if (line.includes('ซื้อสินค้า') || line.includes('ซื้อ')) {
        itemType = 'ซื้อสินค้า';
    } else if (line.includes('จ่ายบิล') || line.includes('จ่าย')) {
        itemType = 'จ่ายบิล';
    }

    return { channel, itemType };
}

/**
 * Clean and extract description from line
 */
function cleanDescription(line: string): string {
    // Remove dates, times, and amounts
    let description = line
        .replace(/\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/g, '')
        .replace(/\d{1,2}:\d{2}(:\d{2})?/g, '')
        .replace(/[\d,]+\.\d{2}/g, '')
        .trim();

    // Remove multiple spaces
    description = description.replace(/\s+/g, ' ').trim();

    // Limit length
    if (description.length > 500) {
        description = description.substring(0, 500);
    }

    return description || 'No description';
}

/**
 * Check if row should be skipped (headers, balance rows)
 */
function isHeaderOrBalanceRow(line: string): boolean {
    const skipPatterns = [
        'ยอดยกมา',
        'ยอดยกไป',
        'Statement',
        'Page',
        'รายการเดินบัญชี',
        'Account Statement',
        'เลขที่บัญชี',
        'Account No',
        'ชื่อบัญชี',
        'Account Name',
        'สาขา',
        'Branch',
        'วันที่',
        'Date',
        'รายการ',
        'Description',
        'จำนวนเงิน',
        'Amount',
        'คงเหลือ',
        'Balance',
    ];

    return skipPatterns.some(pattern =>
        line.includes(pattern) && line.length < 100
    );
}

/**
 * Check if row is an inflow (income) - should be skipped
 */
function isInflowRow(line: string): boolean {
    return INFLOW_PATTERNS.some(pattern =>
        line.includes(pattern.toUpperCase()) || line.includes(pattern)
    );
}

/**
 * Determine if a parsed transaction is an expense
 */
function isExpenseTransaction(line: string, transaction: ParsedTransaction): boolean {
    // Check for explicit inflow indicators
    if (line.includes('รับ') && !line.includes('รับชำระ')) {
        return false;
    }
    if (line.includes('ฝาก') && !line.includes('ฝากประจำ')) {
        return false;
    }
    if (line.includes('คืนเงิน') || line.includes('REFUND')) {
        return false;
    }
    if (line.includes('ดอกเบี้ย')) {
        return false;
    }

    // Amount should be positive for expenses
    return transaction.amount > 0;
}

/**
 * Extract account number from statement text
 */
function extractAccountNumber(text: string): string | undefined {
    // KBank account number patterns
    const patterns = [
        /(?:เลขที่บัญชี|Account No\.?|Account Number)[:\s]*(\d[\d\-\s]+\d)/i,
        /(\d{3}[\-\s]?\d[\-\s]?\d{5}[\-\s]?\d)/,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return match[1].replace(/[\s\-]/g, '');
        }
    }

    return undefined;
}

/**
 * Detect statement month from transaction dates
 */
function detectStatementMonthFromDates(dates: Date[]): string | null {
    if (dates.length === 0) return null;

    // Count occurrences of each month
    const monthCounts: Record<string, number> = {};
    dates.forEach(date => {
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthCounts[month] = (monthCounts[month] || 0) + 1;
    });

    // Find month with most transactions
    let maxMonth = '';
    let maxCount = 0;
    Object.entries(monthCounts).forEach(([month, count]) => {
        if (count > maxCount) {
            maxCount = count;
            maxMonth = month;
        }
    });

    return maxMonth || null;
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
        const data = await pdfParse.pdf(fileBuffer, {});

        if (!data.text || data.text.trim().length < 50) {
            return {
                valid: false,
                requiresPassword: false,
                error: 'PDF appears to be empty or image-based. Please export a text-based statement.',
            };
        }

        // Check if it looks like a KBank statement
        const isKBank = data.text.includes('KBank') ||
            data.text.includes('กสิกร') ||
            data.text.includes('KASIKORN') ||
            data.text.includes('K PLUS');

        if (!isKBank) {
            return {
                valid: true,
                requiresPassword: false,
                error: 'Warning: This may not be a KBank statement. Parsing might not work correctly.',
            };
        }

        return { valid: true, requiresPassword: false };
    } catch (error) {
        const message = (error as Error).message || '';

        if (message.includes('password') || message.includes('encrypted')) {
            return {
                valid: true,
                requiresPassword: true,
            };
        }

        return {
            valid: false,
            requiresPassword: false,
            error: `Invalid PDF: ${message}`,
        };
    }
}
