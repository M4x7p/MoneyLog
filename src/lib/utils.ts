import crypto from 'crypto';
import CryptoJS from 'crypto-js';

/**
 * Generate a fingerprint for a transaction to detect duplicates
 * fingerprint = hash(date + time + amount + channel + normalized(description))
 */
export function generateTransactionFingerprint(
    dateTime: Date,
    amount: number,
    channel: string,
    description: string
): string {
    const normalizedDescription = normalizeDescription(description);
    const dataString = `${dateTime.toISOString()}|${amount}|${channel}|${normalizedDescription}`;
    return crypto.createHash('sha256').update(dataString).digest('hex');
}

/**
 * Generate file hash for detecting duplicate uploads
 */
export function generateFileHash(fileBuffer: Buffer): string {
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Normalize description for consistent fingerprinting
 */
export function normalizeDescription(description: string): string {
    return description
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s]/g, ''); // Keep Thai, alphanumeric, and spaces
}

/**
 * Generate a secure random invite code
 */
export function generateInviteCode(): string {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate a magic link token
 */
export function generateMagicLinkToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Encrypt sensitive data (not for passwords - use for temporary storage only)
 */
export function encryptData(data: string, key: string): string {
    return CryptoJS.AES.encrypt(data, key).toString();
}

/**
 * Decrypt sensitive data
 */
export function decryptData(encryptedData: string, key: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedData, key);
    return bytes.toString(CryptoJS.enc.Utf8);
}

/**
 * Format amount for display (Thai Baht)
 */
export function formatCurrency(amount: number | string): string {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: 'THB',
    }).format(numAmount);
}

/**
 * Parse Thai date formats from KBank statement
 * Formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
 */
export function parseThaiDate(dateStr: string, timeStr?: string): Date {
    // Remove extra spaces
    dateStr = dateStr.trim();

    let day: number, month: number, year: number;

    // Try DD/MM/YYYY or DD-MM-YYYY format (most common in Thai bank statements)
    const thaiFormat = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (thaiFormat) {
        day = parseInt(thaiFormat[1], 10);
        month = parseInt(thaiFormat[2], 10) - 1; // JS months are 0-indexed
        year = parseInt(thaiFormat[3], 10);

        // Convert Buddhist Era to Common Era if needed (year > 2400)
        if (year > 2400) {
            year -= 543;
        }
    } else {
        // Try YYYY-MM-DD format
        const isoFormat = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
        if (isoFormat) {
            year = parseInt(isoFormat[1], 10);
            month = parseInt(isoFormat[2], 10) - 1;
            day = parseInt(isoFormat[3], 10);

            if (year > 2400) {
                year -= 543;
            }
        } else {
            throw new Error(`Unable to parse date: ${dateStr}`);
        }
    }

    // Parse time if provided
    let hours = 0, minutes = 0, seconds = 0;
    if (timeStr) {
        const timeParts = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if (timeParts) {
            hours = parseInt(timeParts[1], 10);
            minutes = parseInt(timeParts[2], 10);
            seconds = timeParts[3] ? parseInt(timeParts[3], 10) : 0;
        }
    }

    return new Date(year, month, day, hours, minutes, seconds);
}

/**
 * Detect statement month from parsed transactions or filename
 */
export function detectStatementMonth(dates: Date[]): string | null {
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
