/**
 * Validation Utilities
 * Functions for validating launch pipeline data
 */

import type { LaunchProduct, ProductCategory, SEOMetadata, ProductSpecifications } from '../types/product.types';
import type { PipelineStage } from '../types/stage.types';

// Validation result type
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

// Product name validation
export function validateProductName(name: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!name || name.trim().length === 0) {
    errors.push({
      field: 'name',
      message: 'Product name is required',
      code: 'NAME_REQUIRED',
    });
  } else if (name.length < 3) {
    errors.push({
      field: 'name',
      message: 'Product name must be at least 3 characters',
      code: 'NAME_TOO_SHORT',
    });
  } else if (name.length > 100) {
    errors.push({
      field: 'name',
      message: 'Product name must be less than 100 characters',
      code: 'NAME_TOO_LONG',
    });
  }

  if (name && !/^[a-zA-Z]/.test(name)) {
    warnings.push({
      field: 'name',
      message: 'Product name should start with a letter for better SEO',
      suggestion: 'Consider starting the name with a descriptive word',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Handle validation (URL-friendly slug)
export function validateHandle(handle: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!handle || handle.trim().length === 0) {
    errors.push({
      field: 'handle',
      message: 'Handle is required',
      code: 'HANDLE_REQUIRED',
    });
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)) {
    errors.push({
      field: 'handle',
      message: 'Handle must be lowercase letters, numbers, and hyphens only',
      code: 'HANDLE_INVALID_FORMAT',
    });
  } else if (handle.length > 50) {
    errors.push({
      field: 'handle',
      message: 'Handle must be less than 50 characters',
      code: 'HANDLE_TOO_LONG',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// SEO metadata validation
export function validateSEOMetadata(seo: Partial<SEOMetadata> | undefined): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!seo) {
    warnings.push({
      field: 'seoMetadata',
      message: 'SEO metadata is not set',
      suggestion: 'Add meta title, description, and keywords for better search visibility',
    });
    return { valid: true, errors, warnings };
  }

  // Meta title
  if (!seo.metaTitle) {
    warnings.push({
      field: 'seoMetadata.metaTitle',
      message: 'Meta title is missing',
      suggestion: 'Add a descriptive title under 60 characters',
    });
  } else if (seo.metaTitle.length > 60) {
    errors.push({
      field: 'seoMetadata.metaTitle',
      message: 'Meta title exceeds 60 characters and may be truncated in search results',
      code: 'META_TITLE_TOO_LONG',
    });
  } else if (seo.metaTitle.length < 30) {
    warnings.push({
      field: 'seoMetadata.metaTitle',
      message: 'Meta title is short',
      suggestion: 'Consider a more descriptive title between 30-60 characters',
    });
  }

  // Meta description
  if (!seo.metaDescription) {
    warnings.push({
      field: 'seoMetadata.metaDescription',
      message: 'Meta description is missing',
      suggestion: 'Add a compelling description under 155 characters',
    });
  } else if (seo.metaDescription.length > 155) {
    errors.push({
      field: 'seoMetadata.metaDescription',
      message: 'Meta description exceeds 155 characters and may be truncated',
      code: 'META_DESCRIPTION_TOO_LONG',
    });
  } else if (seo.metaDescription.length < 70) {
    warnings.push({
      field: 'seoMetadata.metaDescription',
      message: 'Meta description is short',
      suggestion: 'Consider a more detailed description between 70-155 characters',
    });
  }

  // Keywords
  if (!seo.keywords || seo.keywords.length === 0) {
    warnings.push({
      field: 'seoMetadata.keywords',
      message: 'No keywords specified',
      suggestion: 'Add relevant keywords to improve discoverability',
    });
  } else if (seo.keywords.length > 10) {
    warnings.push({
      field: 'seoMetadata.keywords',
      message: 'Too many keywords',
      suggestion: 'Focus on 5-10 most relevant keywords',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Product specifications validation
export function validateSpecifications(specs: Partial<ProductSpecifications> | undefined): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!specs) {
    warnings.push({
      field: 'specifications',
      message: 'Product specifications are not set',
      suggestion: 'Add dimensions, materials, and other specifications',
    });
    return { valid: true, errors, warnings };
  }

  // Dimensions
  if (specs.dimensions) {
    const { length, width, height } = specs.dimensions;
    if (length <= 0 || width <= 0 || height <= 0) {
      errors.push({
        field: 'specifications.dimensions',
        message: 'All dimensions must be positive numbers',
        code: 'INVALID_DIMENSIONS',
      });
    }
  } else {
    warnings.push({
      field: 'specifications.dimensions',
      message: 'Product dimensions not specified',
      suggestion: 'Add length, width, and height',
    });
  }

  // Materials
  if (!specs.materials || specs.materials.length === 0) {
    warnings.push({
      field: 'specifications.materials',
      message: 'No materials specified',
      suggestion: 'Add primary materials used in the product',
    });
  }

  // Finishes
  if (!specs.finishes || specs.finishes.length === 0) {
    warnings.push({
      field: 'specifications.finishes',
      message: 'No finishes specified',
      suggestion: 'Add available finish options',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Full product validation
export function validateProduct(product: Partial<LaunchProduct>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Name
  const nameResult = validateProductName(product.name || '');
  errors.push(...nameResult.errors);
  warnings.push(...nameResult.warnings);

  // Handle
  if (product.handle) {
    const handleResult = validateHandle(product.handle);
    errors.push(...handleResult.errors);
    warnings.push(...handleResult.warnings);
  }

  // Category
  const validCategories: ProductCategory[] = ['casework', 'furniture', 'millwork', 'doors', 'fixtures', 'specialty'];
  if (!product.category) {
    errors.push({
      field: 'category',
      message: 'Product category is required',
      code: 'CATEGORY_REQUIRED',
    });
  } else if (!validCategories.includes(product.category)) {
    errors.push({
      field: 'category',
      message: 'Invalid product category',
      code: 'CATEGORY_INVALID',
    });
  }

  // Description
  if (!product.description || product.description.trim().length === 0) {
    warnings.push({
      field: 'description',
      message: 'Product description is empty',
      suggestion: 'Add a detailed description for better customer understanding',
    });
  } else if (product.description.length < 50) {
    warnings.push({
      field: 'description',
      message: 'Product description is very short',
      suggestion: 'Aim for at least 100 characters for better SEO',
    });
  }

  // SEO
  const seoResult = validateSEOMetadata(product.seoMetadata);
  errors.push(...seoResult.errors);
  warnings.push(...seoResult.warnings);

  // Specifications
  const specsResult = validateSpecifications(product.specifications);
  errors.push(...specsResult.errors);
  warnings.push(...specsResult.warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Validate product for specific stage
export function validateForStage(
  product: Partial<LaunchProduct>,
  stage: PipelineStage
): ValidationResult {
  const baseResult = validateProduct(product);

  // Add stage-specific validation
  switch (stage) {
    case 'photography':
      if (!product.deliverables?.some(d => d.type === 'hero_images')) {
        baseResult.errors.push({
          field: 'deliverables',
          message: 'Hero images are required for photography stage',
          code: 'HERO_IMAGES_REQUIRED',
        });
      }
      break;

    case 'documentation':
      if (!product.seoMetadata?.metaTitle || !product.seoMetadata?.metaDescription) {
        baseResult.errors.push({
          field: 'seoMetadata',
          message: 'SEO metadata is required for documentation stage',
          code: 'SEO_REQUIRED',
        });
      }
      break;

    case 'launched':
      if (!product.shopifySync?.shopifyProductId) {
        baseResult.errors.push({
          field: 'shopifySync',
          message: 'Product must be synced to Shopify before launch',
          code: 'SHOPIFY_SYNC_REQUIRED',
        });
      }
      break;
  }

  baseResult.valid = baseResult.errors.length === 0;
  return baseResult;
}

// Quick validation check
export function isValidProduct(product: Partial<LaunchProduct>): boolean {
  return validateProduct(product).valid;
}
