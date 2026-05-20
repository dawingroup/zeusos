/**
 * Schema Utilities
 * JSON-LD schema generation for products
 */

import type { LaunchProduct } from '../types/product.types';
/**
 * Generate JSON-LD Product schema for SEO
 * @see https://schema.org/Product
 */
export function generateProductSchema(
  product: LaunchProduct,
  options?: {
    baseUrl?: string;
    organizationName?: string;
    brandName?: string;
    currency?: string;
  }
): object {
  const {
    baseUrl = 'https://dawinfinishes.com',
    organizationName = 'Dawin Finishes',
    brandName = 'Dawin Finishes',
    currency = 'UGX',
  } = options || {};

  const productUrl = `${baseUrl}/products/${product.handle}`;

  // Base schema
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    url: productUrl,
    sku: product.handle,
    brand: {
      '@type': 'Brand',
      name: brandName,
    },
    manufacturer: {
      '@type': 'Organization',
      name: organizationName,
    },
  };

  // Add category
  if (product.category) {
    schema.category = formatCategoryForSchema(product.category);
  }

  // Add images
  if (product.deliverables?.length) {
    const images = product.deliverables
      .filter(d => d.mimeType?.startsWith('image/'))
      .map(d => d.url);

    if (images.length > 0) {
      schema.image = images.length === 1 ? images[0] : images;
    }
  }

  // Add dimensions
  if (product.specifications?.dimensions) {
    const { length, width, height, unit } = product.specifications.dimensions;
    schema.depth = {
      '@type': 'QuantitativeValue',
      value: length,
      unitCode: getUnitCode(unit),
    };
    schema.width = {
      '@type': 'QuantitativeValue',
      value: width,
      unitCode: getUnitCode(unit),
    };
    schema.height = {
      '@type': 'QuantitativeValue',
      value: height,
      unitCode: getUnitCode(unit),
    };
  }

  // Add weight
  if (product.specifications?.weight) {
    schema.weight = {
      '@type': 'QuantitativeValue',
      value: product.specifications.weight.value,
      unitCode: product.specifications.weight.unit === 'kg' ? 'KGM' : 'LBR',
    };
  }

  // Add materials
  if (product.specifications?.materials?.length) {
    schema.material = product.specifications.materials.join(', ');
  }

  // Add color
  if (product.specifications?.colors?.length) {
    schema.color = product.specifications.colors.join(', ');
  }

  // Add offers (pricing) if available from Shopify
  if (product.shopifySync?.shopifyProductId) {
    schema.offers = {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: currency,
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: organizationName,
      },
    };
  }

  // Add aggregate rating if audit available
  if (product.lastAudit?.overallScore) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: (product.lastAudit.overallScore / 20).toFixed(1), // Convert 0-100 to 0-5
      bestRating: 5,
      worstRating: 1,
      ratingCount: product.auditHistory?.length || 1,
    };
  }

  return schema;
}

/**
 * Generate JSON-LD BreadcrumbList schema
 */
export function generateBreadcrumbSchema(
  product: LaunchProduct,
  options?: {
    baseUrl?: string;
    categoryLabel?: string;
  }
): object {
  const { baseUrl = 'https://dawinfinishes.com', categoryLabel } = options || {};

  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: baseUrl,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Products',
      item: `${baseUrl}/products`,
    },
  ];

  if (product.category) {
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: categoryLabel || formatCategoryForSchema(product.category),
      item: `${baseUrl}/products?category=${product.category}`,
    });
  }

  items.push({
    '@type': 'ListItem',
    position: items.length + 1,
    name: product.name,
    item: `${baseUrl}/products/${product.handle}`,
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

/**
 * Generate FAQ schema from AI discovery data
 */
export function generateFAQSchema(product: LaunchProduct): object | null {
  const faqs = product.aiDiscovery?.faqs;

  if (!faqs || faqs.length === 0) {
    return null;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Generate all schemas for a product page
 */
export function generateAllSchemas(
  product: LaunchProduct,
  options?: {
    baseUrl?: string;
    organizationName?: string;
    brandName?: string;
    currency?: string;
  }
): object[] {
  const schemas: object[] = [];

  // Product schema
  schemas.push(generateProductSchema(product, options));

  // Breadcrumb schema
  schemas.push(generateBreadcrumbSchema(product, options));

  // FAQ schema
  const faqSchema = generateFAQSchema(product);
  if (faqSchema) {
    schemas.push(faqSchema);
  }

  return schemas;
}

/**
 * Convert schemas to script tag content
 */
export function schemasToScriptContent(schemas: object[]): string {
  if (schemas.length === 1) {
    return JSON.stringify(schemas[0], null, 2);
  }
  return JSON.stringify(schemas, null, 2);
}

// Helper functions

function formatCategoryForSchema(category: string): string {
  const categoryMap: Record<string, string> = {
    casework: 'Casework & Cabinetry',
    furniture: 'Furniture',
    millwork: 'Millwork',
    doors: 'Doors & Panels',
    fixtures: 'Fixtures',
    specialty: 'Specialty Items',
  };
  return categoryMap[category] || category;
}

function getUnitCode(unit: 'mm' | 'cm' | 'in'): string {
  const codes: Record<string, string> = {
    mm: 'MMT',
    cm: 'CMT',
    in: 'INH',
  };
  return codes[unit] || 'CMT';
}
