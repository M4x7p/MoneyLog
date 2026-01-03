import { generateTransactionFingerprint } from '@/lib/utils';
import { INFLOW_PATTERNS } from '@/lib/constants';

export interface ParsedTransaction {
    dateTime: Date;
    amount: number;
    itemType: string;
    channel: string;
    descriptionRaw: string;
    fingerprint: string;
}

export interface CsvParseResult {
    success: boolean;
    transactions: ParsedTransaction[];
    statementMonth: string | null;
    accountNumber?: string;
    error?: string;
    rawRowCount: number;
    filteredOutCount: number;
}

/**
 * Parse CSV content from KBank or SCB statement export
 */
export async function parseCsvStatement(
    fileContent: string,
    bank: 'kbank' | 'scb' = 'kbank'
): Promise<CsvParseResult> {
    try {
        const lines = fileContent.split(/\r?\n/).filter(line => line.trim());

        if (lines.length < 2) {
            return {
                success: false,
                transactions: [],
                statementMonth: null,
                error: 'CSV file appears to be empty or invalid',
                rawRowCount: 0,
                filteredOutCount: 0,
            };
        }

        const transactions: ParsedTransaction[] = [];
        let rawRowCount = 0;
        let filteredOutCount = 0;
        let accountNumber: string | undefined;

        // Skip header row and parse data rows
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            rawRowCount++;

            const parsed = bank === 'kbank'
                ? parseKBankCsvRow(line)
                : parseSCBCsvRow(line);

            if (!parsed) continue;

            // Check if this is inflow (income) - skip these
            const isInflow = INFLOW_PATTERNS.some(pattern =>
                parsed.description.toLowerCase().includes(pattern.toLowerCase())
            ) || parsed.isInflow;

            if (isInflow) {
                filteredOutCount++;
                continue;
            }

            // Extract account number from first transaction if available
            if (!accountNumber && parsed.accountNumber) {
                accountNumber = parsed.accountNumber;
            }

            const fingerprint = generateTransactionFingerprint(
                parsed.dateTime,
                parsed.amount,
                parsed.channel,
                parsed.description
            );

            transactions.push({
                dateTime: parsed.dateTime,
                amount: parsed.amount,
                itemType: parsed.itemType,
                channel: parsed.channel,
                descriptionRaw: parsed.description,
                fingerprint,
            });
        }

        // Determine statement month from transactions
        const statementMonth = detectStatementMonth(transactions);

        // Sort by date (newest first)
        transactions.sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());

        return {
            success: true,
            transactions,
            statementMonth,
            accountNumber,
            rawRowCount,
            filteredOutCount,
        };

    } catch (error) {
        console.error('CSV parsing error:', error);
        return {
            success: false,
            transactions: [],
            statementMonth: null,
            error: `Failed to parse CSV: ${(error as Error).message}`,
            rawRowCount: 0,
            filteredOutCount: 0,
        };
    }
}

interface ParsedRow {
    dateTime: Date;
    amount: number;
    itemType: string;
    channel: string;
    description: string;
    accountNumber?: string;
    isInflow: boolean;
}

/**
 * Parse KBank CSV row
 * Expected format: Date, Time, Transaction Type, Channel, Withdrawal, Deposit, Balance, Description
 * Or: Date, Time, Description, Withdrawal, Deposit, Balance
 */
function parseKBankCsvRow(line: string): ParsedRow | null {
    try {
        // Split by comma, handling quoted fields
        const fields = parseCsvLine(line);

        if (fields.length < 4) return null;

        // Try to detect format and extract data
        // Format 1: DD/MM/YYYY, HH:MM, Type, Channel, Withdrawal, Deposit, Balance, Description
        // Format 2: DD/MM/YYYY, HH:MM, Description, Withdrawal, Deposit, Balance

        const dateStr = fields[0]?.trim();
        const timeStr = fields[1]?.trim();

        if (!dateStr || !timeStr) return null;

        // Parse date (DD/MM/YYYY)
        const dateTime = parseDate(dateStr, timeStr);
        if (!dateTime) return null;

        // Determine format based on field count and content
        let withdrawal = 0;
        let deposit = 0;
        let description = '';
        let channel = 'K PLUS';
        let itemType = 'รายจ่าย';

        if (fields.length >= 8) {
            // Format with Type and Channel
            itemType = fields[2]?.trim() || 'รายจ่าย';
            channel = fields[3]?.trim() || 'K PLUS';
            withdrawal = parseAmount(fields[4]);
            deposit = parseAmount(fields[5]);
            description = fields[7]?.trim() || '';
        } else if (fields.length >= 6) {
            // Format without Type and Channel
            description = fields[2]?.trim() || '';
            withdrawal = parseAmount(fields[3]);
            deposit = parseAmount(fields[4]);
        } else if (fields.length >= 4) {
            // Minimal format
            description = fields[2]?.trim() || '';
            withdrawal = parseAmount(fields[3]);
        }

        // Determine if inflow or outflow
        const isInflow = deposit > 0 && withdrawal === 0;
        const amount = withdrawal > 0 ? withdrawal : deposit;

        if (amount <= 0) return null;

        return {
            dateTime,
            amount,
            itemType,
            channel,
            description,
            isInflow,
        };
    } catch {
        return null;
    }
}

/**
 * Parse SCB CSV row
 */
function parseSCBCsvRow(line: string): ParsedRow | null {
    try {
        const fields = parseCsvLine(line);

        if (fields.length < 4) return null;

        const dateStr = fields[0]?.trim();
        const timeStr = fields[1]?.trim() || '00:00';

        if (!dateStr) return null;

        const dateTime = parseDate(dateStr, timeStr);
        if (!dateTime) return null;

        const description = fields[2]?.trim() || '';
        const withdrawal = parseAmount(fields[3]);
        const deposit = parseAmount(fields[4] || '0');

        const isInflow = deposit > 0 && withdrawal === 0;
        const amount = withdrawal > 0 ? withdrawal : deposit;

        if (amount <= 0) return null;

        return {
            dateTime,
            amount,
            itemType: 'รายจ่าย',
            channel: 'SCB Easy',
            description,
            isInflow,
        };
    } catch {
        return null;
    }
}

/**
 * Parse CSV line handling quoted fields
 */
function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);

    return result.map(s => s.replace(/^"|"$/g, '').trim());
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr: string, timeStr: string): Date | null {
    try {
        // Try DD/MM/YYYY format
        let match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (match) {
            let day = parseInt(match[1]);
            let month = parseInt(match[2]);
            let year = parseInt(match[3]);

            if (year < 100) year = year > 50 ? 1900 + year : 2000 + year;
            if (year > 2500) year = year - 543; // Buddhist year

            const timeParts = timeStr.split(':');
            const hour = parseInt(timeParts[0]) || 0;
            const minute = parseInt(timeParts[1]) || 0;

            return new Date(year, month - 1, day, hour, minute);
        }

        // Try YYYY-MM-DD format
        match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (match) {
            let year = parseInt(match[1]);
            let month = parseInt(match[2]);
            let day = parseInt(match[3]);

            if (year > 2500) year = year - 543;

            const timeParts = timeStr.split(':');
            const hour = parseInt(timeParts[0]) || 0;
            const minute = parseInt(timeParts[1]) || 0;

            return new Date(year, month - 1, day, hour, minute);
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Parse amount string to number
 */
function parseAmount(amountStr: string): number {
    if (!amountStr) return 0;
    const cleaned = amountStr.replace(/[,\s฿]/g, '').trim();
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : Math.abs(amount);
}

/**
 * Detect statement month from transactions
 */
function detectStatementMonth(transactions: ParsedTransaction[]): string | null {
    if (transactions.length === 0) return null;

    const monthCounts: Record<string, number> = {};
    transactions.forEach(tx => {
        const month = `${tx.dateTime.getFullYear()}-${String(tx.dateTime.getMonth() + 1).padStart(2, '0')}`;
        monthCounts[month] = (monthCounts[month] || 0) + 1;
    });

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
