/**
 * Voice Input Utilities
 * Handles text normalization and parsing of SKU + Size pairs.
 */

const VoiceUtils = {
    /**
     * Normalizes spoken text to a standard format.
     * @param {string} text - Raw transcript
     * @returns {string} Normalized text associated with digits and sizes
     */
    normalizeText: (text) => {
        if (!text) return '';
        let s = text.toLowerCase();

        // 1. Word to Digit Mapping (Basic 0-9)
        const digits = {
            'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
            'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9'
        };
        Object.keys(digits).forEach(word => {
            // Replace whole words only
            s = s.replace(new RegExp(`\\b${word}\\b`, 'g'), digits[word]);
        });

        // 2. Specific Size Phrasings (Order matters: longest first)
        const sizeMap = [
            { patterns: ['triple xl', 'triple extra large', '3 xl', '3xl', 'xxxl'], val: 'XXXL' },
            { patterns: ['double xl', 'double extra large', '2 xl', '2xl', 'xxl'], val: 'XXL' },
            { patterns: ['extra large', 'xl'], val: 'XL' },
            { patterns: ['large', ' l '], val: 'L' }, // ' l ' with spaces to avoid matching inside words? Or rely on regex boundaries.
            // "l" is risky as a single letter, but user asked for "l" -> L.
            { patterns: ['medium', ' m '], val: 'M' },
            { patterns: ['small', ' s '], val: 'S' }
        ];

        // We replace known size phrases with a unique placeholder to facilitate parsing
        // Or we just capitalize them to standard codes?
        // Let's replace them with spaced codes: " SIZE_XXL "

        sizeMap.forEach(item => {
            item.patterns.forEach(pat => {
                // strict word boundary for short codes, loose for phrases?
                // For 'l', 'm', 's', definitely need boundaries.
                const regex = new RegExp(`\\b${pat}\\b`, 'g');
                s = s.replace(regex, ` ${item.val} `);
            });
        });

        // Cleanup multiple spaces
        return s.replace(/\s+/g, ' ').trim();
    },

    /**
     * Parses normalized text into SKU and Size objects.
     * Strategy: Look for Size codes. The text PRIOR to a Size code (since the last match) is the SKU.
     * @param {string} text 
     * @returns {Array<{sku: string, size: string}>}
     */
    parseTranscript: (text) => {
        const normalized = VoiceUtils.normalizeText(text);
        const tokens = normalized.split(' ');

        const pairs = [];
        const validSizes = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

        let skuBuffer = [];

        tokens.forEach(token => {
            const upper = token.toUpperCase();
            if (validSizes.includes(upper)) {
                // Found a size anchor.
                // Everything in buffer is the SKU.
                if (skuBuffer.length > 0) {
                    // SKU cleaning: remove non-alphanumeric chars usually? 
                    // Voice might give spaces "5 0 1 4", we should join them "5014".
                    const sku = skuBuffer.join('').toUpperCase();
                    pairs.push({ sku, size: upper });
                    skuBuffer = []; // Reset
                }
            } else {
                // Not a size, append to buffer
                // Filter simple filler words if needed? e.g. "item", "product"
                // For now, assume everything else is part of SKU.
                if (token.trim().length > 0) {
                    skuBuffer.push(token);
                }
            }
        });

        return { normalized, pairs };
    }
};
