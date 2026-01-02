import { prisma } from './prisma';
import { CHANNEL_CATEGORY_HINTS } from './constants';
import { normalizeDescription } from './utils';

export const MatchType = {
    CONTAINS: 'CONTAINS',
    STARTS_WITH: 'STARTS_WITH',
    ENDS_WITH: 'ENDS_WITH',
    EXACT: 'EXACT',
    REGEX: 'REGEX',
} as const;

export type MatchType = typeof MatchType[keyof typeof MatchType];

export interface CategorizeResult {
    categoryId: string | null;
    categoryName: string | null;
    matchedBy: 'RULE' | 'HINT' | 'NONE';
    matchedRule?: string;
}

/**
 * Auto-categorize a single transaction
 * Priority: 1) User-defined rules, 2) Built-in hints, 3) None
 */
export async function categorizeTransaction(
    familyId: string,
    description: string,
    channel: string,
    itemType: string
): Promise<CategorizeResult> {
    // 1. Try user-defined rules first (sorted by priority)
    const ruleMatch = await matchUserRules(familyId, description, channel);
    if (ruleMatch) {
        return ruleMatch;
    }

    // 2. Try built-in hints based on description keywords
    const hintMatch = await matchBuiltInHints(familyId, description);
    if (hintMatch) {
        return hintMatch;
    }

    // 3. No match found
    return {
        categoryId: null,
        categoryName: null,
        matchedBy: 'NONE',
    };
}

/**
 * Match against user-defined category rules
 */
async function matchUserRules(
    familyId: string,
    description: string,
    channel: string
): Promise<CategorizeResult | null> {
    const rules = await prisma.categoryRule.findMany({
        where: {
            familyId,
            enabled: true,
        },
        include: {
            category: true,
        },
        orderBy: {
            priority: 'desc',
        },
    });

    const normalizedDesc = normalizeDescription(description).toLowerCase();
    const normalizedChannel = channel.toLowerCase();

    for (const rule of rules) {
        // Check channel match if specified
        if (rule.channel && !normalizedChannel.includes(rule.channel.toLowerCase())) {
            continue;
        }

        // Check pattern match
        const pattern = rule.pattern.toLowerCase();
        let matched = false;

        switch (rule.matchType) {
            case MatchType.CONTAINS:
                matched = normalizedDesc.includes(pattern);
                break;
            case MatchType.STARTS_WITH:
                matched = normalizedDesc.startsWith(pattern);
                break;
            case MatchType.ENDS_WITH:
                matched = normalizedDesc.endsWith(pattern);
                break;
            case MatchType.EXACT:
                matched = normalizedDesc === pattern;
                break;
            case MatchType.REGEX:
                try {
                    matched = new RegExp(pattern, 'i').test(normalizedDesc);
                } catch {
                    // Invalid regex, skip
                    matched = false;
                }
                break;
        }

        if (matched) {
            return {
                categoryId: rule.category.id,
                categoryName: rule.category.name,
                matchedBy: 'RULE',
                matchedRule: `${rule.matchType}: "${rule.pattern}"`,
            };
        }
    }

    return null;
}

/**
 * Match against built-in category hints
 */
async function matchBuiltInHints(
    familyId: string,
    description: string
): Promise<CategorizeResult | null> {
    const normalizedDesc = normalizeDescription(description).toUpperCase();

    // Get family's categories
    const categories = await prisma.category.findMany({
        where: {
            familyId,
            active: true,
        },
    });

    // Create a map for quick lookup
    const categoryMap = new Map(categories.map(c => [c.name, c]));

    // Check each hint category
    for (const [categoryName, keywords] of Object.entries(CHANNEL_CATEGORY_HINTS)) {
        const category = categoryMap.get(categoryName);
        if (!category) continue;

        for (const keyword of keywords) {
            if (normalizedDesc.includes(keyword.toUpperCase())) {
                return {
                    categoryId: category.id,
                    categoryName: category.name,
                    matchedBy: 'HINT',
                    matchedRule: `keyword: "${keyword}"`,
                };
            }
        }
    }

    return null;
}

/**
 * Batch categorize multiple transactions
 */
export async function categorizeTransactions(
    familyId: string,
    transactions: Array<{
        id?: string;
        description: string;
        channel: string;
        itemType: string;
    }>
): Promise<Map<number, CategorizeResult>> {
    const results = new Map<number, CategorizeResult>();

    // Get all rules once
    const rules = await prisma.categoryRule.findMany({
        where: {
            familyId,
            enabled: true,
        },
        include: {
            category: true,
        },
        orderBy: {
            priority: 'desc',
        },
    });

    // Get all categories
    const categories = await prisma.category.findMany({
        where: {
            familyId,
            active: true,
        },
    });
    const categoryMap = new Map(categories.map(c => [c.name, c]));

    // Process each transaction
    for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];
        const normalizedDesc = normalizeDescription(tx.description).toLowerCase();
        const normalizedChannel = tx.channel.toLowerCase();

        // 1. Check user rules
        let matched = false;
        for (const rule of rules) {
            if (rule.channel && !normalizedChannel.includes(rule.channel.toLowerCase())) {
                continue;
            }

            const pattern = rule.pattern.toLowerCase();
            let patternMatched = false;

            switch (rule.matchType) {
                case MatchType.CONTAINS:
                    patternMatched = normalizedDesc.includes(pattern);
                    break;
                case MatchType.STARTS_WITH:
                    patternMatched = normalizedDesc.startsWith(pattern);
                    break;
                case MatchType.ENDS_WITH:
                    patternMatched = normalizedDesc.endsWith(pattern);
                    break;
                case MatchType.EXACT:
                    patternMatched = normalizedDesc === pattern;
                    break;
                case MatchType.REGEX:
                    try {
                        patternMatched = new RegExp(pattern, 'i').test(normalizedDesc);
                    } catch {
                        patternMatched = false;
                    }
                    break;
            }

            if (patternMatched) {
                results.set(i, {
                    categoryId: rule.category.id,
                    categoryName: rule.category.name,
                    matchedBy: 'RULE',
                    matchedRule: `${rule.matchType}: "${rule.pattern}"`,
                });
                matched = true;
                break;
            }
        }

        if (matched) continue;

        // 2. Check built-in hints
        const upperDesc = normalizedDesc.toUpperCase();
        for (const [categoryName, keywords] of Object.entries(CHANNEL_CATEGORY_HINTS)) {
            const category = categoryMap.get(categoryName);
            if (!category) continue;

            for (const keyword of keywords) {
                if (upperDesc.includes(keyword.toUpperCase())) {
                    results.set(i, {
                        categoryId: category.id,
                        categoryName: category.name,
                        matchedBy: 'HINT',
                        matchedRule: `keyword: "${keyword}"`,
                    });
                    matched = true;
                    break;
                }
            }
            if (matched) break;
        }

        if (!matched) {
            results.set(i, {
                categoryId: null,
                categoryName: null,
                matchedBy: 'NONE',
            });
        }
    }

    return results;
}

/**
 * Create a category rule from a transaction categorization
 */
export async function createRuleFromTransaction(
    familyId: string,
    categoryId: string,
    pattern: string,
    channel?: string,
    matchType: MatchType = MatchType.CONTAINS
): Promise<void> {
    await prisma.categoryRule.create({
        data: {
            familyId,
            categoryId,
            pattern: pattern.trim(),
            channel: channel || null,
            matchType,
            priority: 10, // Default priority
            enabled: true,
        },
    });
}
