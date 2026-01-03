// Default categories for Thai family expense tracking
export const DEFAULT_CATEGORIES = [
    { name: 'อาหาร/เครื่องดื่ม', emoji: '🍜', sortOrder: 1 },
    { name: 'เดินทาง/น้ำมัน/รถ', emoji: '🚗', sortOrder: 2 },
    { name: 'บิลบ้าน(ไฟ/น้ำ/เน็ต/โทร)', emoji: '🏠', sortOrder: 3 },
    { name: 'ผ่อน/บัตรเครดิต/หนี้', emoji: '💳', sortOrder: 4 },
    { name: 'สัตว์เลี้ยง', emoji: '🐕', sortOrder: 5 },
    { name: 'เลี้ยงดูบุตร', emoji: '👶', sortOrder: 6 },
    { name: 'ช้อปปิ้ง', emoji: '🛍️', sortOrder: 7 },
    { name: 'สุขภาพ', emoji: '🏥', sortOrder: 8 },
    { name: 'โอนให้คน/ครอบครัว', emoji: '💝', sortOrder: 9 },
    { name: 'สมัครสมาชิก/ตัดอัตโนมัติ', emoji: '🔄', sortOrder: 10 },
    { name: 'อื่นๆ/ยังไม่รู้หมวด', emoji: '📦', sortOrder: 99 },
];

// KBank statement channels
export const KBANK_CHANNELS = [
    'K PLUS',
    'K PLUS BUSINESS',
    'EDC',
    'K SHOP',
    'Online Direct Debit',
    'Internet/Mobile',
    'ATM',
    'Counter',
    'Auto Debit',
    'Other',
] as const;

// KBank item types (transaction types)
export const KBANK_ITEM_TYPES = [
    'โอนเงิน',
    'ชำระเงิน',
    'หักบัญชี',
    'ถอนเงิน',
    'ซื้อสินค้า',
    'จ่ายบิล',
    'Other',
] as const;

// Patterns to exclude from import (inflows, not expenses)
export const INFLOW_PATTERNS = [
    'ยอดยกมา',
    'รับโอนเงิน',
    'รับฝาก',
    'ดอกเบี้ย',
    'คืนเงิน',
    'REFUND',
    'เงินเข้า',
];

// Channel-based auto-categorization hints
export const CHANNEL_CATEGORY_HINTS: Record<string, string[]> = {
    'บิลบ้าน(ไฟ/น้ำ/เน็ต/โทร)': ['MEA', 'PEA', 'MWA', 'PWA', 'TOT', 'TRUE', 'AIS', 'DTAC', '3BB', 'NT'],
    'สมัครสมาชิก/ตัดอัตโนมัติ': ['NETFLIX', 'SPOTIFY', 'YOUTUBE', 'APPLE', 'GOOGLE', 'ICLOUD', 'GRAB'],
    'ผ่อน/บัตรเครดิต/หนี้': ['PAYMENT', 'LOAN', 'CREDIT CARD', 'บัตรเครดิต', 'ผ่อน'],
    'อาหาร/เครื่องดื่ม': ['GRAB FOOD', 'FOODPANDA', 'LINEMAN', 'SHOPEE FOOD', 'STARBUCKS', 'MK', 'PIZZA'],
    'เดินทาง/น้ำมัน/รถ': ['PTT', 'SHELL', 'ESSO', 'BANGCHAK', 'BOLT', 'GRAB', 'ปั๊ม'],
    'ช้อปปิ้ง': ['SHOPEE', 'LAZADA', 'CENTRAL', 'BIG C', 'TESCO', 'LOTUS', '7-ELEVEN', 'MAKRO'],
    'สุขภาพ': ['HOSPITAL', 'CLINIC', 'PHARMACY', 'ร้านยา', 'โรงพยาบาล'],
};

export type FileValidationError = {
    type: 'INVALID_TYPE' | 'TOO_LARGE' | 'EMPTY' | 'PASSWORD_REQUIRED' | 'PASSWORD_INVALID' | 'PARSE_ERROR';
    message: string;
};

// File validation constants
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'text/plain',
];
