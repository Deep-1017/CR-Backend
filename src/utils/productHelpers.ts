import { IProduct, IProductVariant } from '../models/product.model';

type ProductLike = Pick<IProduct, 'variants'>;

const normalizeCode = (value: string, maxLength: number): string => {
    const words = value
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9\s-]/g, '')
        .split(/[\s-]+/)
        .filter(Boolean);

    const code = words.length > 1
        ? words.map((word) => word[0]).join('')
        : words[0] ?? '';

    return code.slice(0, maxLength).padEnd(Math.min(maxLength, 2), 'X');
};

export const getTotalStock = (product: ProductLike): number =>
    product.variants.reduce((total, variant) => total + variant.stock, 0);

export const getVariantByConfigurationFinish = (
    product: ProductLike,
    configuration: string,
    finish: string
): IProductVariant | undefined => {
    const normalizedConfiguration = configuration.trim().toLowerCase();
    const normalizedFinish = finish.trim().toLowerCase();

    return product.variants.find((variant) =>
        variant.configuration.trim().toLowerCase() === normalizedConfiguration &&
        variant.finish.trim().toLowerCase() === normalizedFinish
    );
};

export const isVariantAvailable = (variant: Pick<IProductVariant, 'stock'>): boolean =>
    variant.stock > 0;

export const generateSKU = (
    productId: string,
    finish: string,
    configuration: string
): string => {
    const normalizedProductId = productId
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 20);
    const finishCode = normalizeCode(finish, 8);
    const configurationCode = normalizeCode(configuration, 4);

    return `GTR-${normalizedProductId}-${finishCode}-${configurationCode}`;
};
