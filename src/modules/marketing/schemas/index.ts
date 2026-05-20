/**
 * Marketing Module - Zod Validation Schemas
 * Input validation schemas for campaigns, posts, and templates
 */

import { z } from 'zod';
import {
  CAMPAIGN_NAME_MIN_LENGTH,
  CAMPAIGN_NAME_MAX_LENGTH,
  CAMPAIGN_DESCRIPTION_MAX_LENGTH,
  POST_CONTENT_MAX_LENGTH,
  POST_TITLE_MAX_LENGTH,
  TEMPLATE_NAME_MIN_LENGTH,
  TEMPLATE_NAME_MAX_LENGTH,
} from '../constants';

// ============================================
// Audience Segment Schema
// ============================================

export const audienceFiltersSchema = z.object({
  customerType: z.array(z.enum(['residential', 'commercial', 'contractor', 'designer'])).optional(),
  customerStatus: z.array(z.enum(['active', 'inactive', 'prospect'])).optional(),
  tags: z.array(z.string()).optional(),
  hasWhatsApp: z.boolean().optional(),
  minProjectCount: z.number().int().min(0).optional(),
});

export const audienceSegmentSchema = z.object({
  segmentType: z.enum(['all', 'custom', 'customer_ids', 'filters']),
  customerIds: z.array(z.string()).optional(),
  filters: audienceFiltersSchema.optional(),
  estimatedSize: z.number().int().min(0),
});

// ============================================
// Campaign Configuration Schemas
// ============================================

export const throttleConfigSchema = z.object({
  messagesPerMinute: z.number().int().min(1).max(60),
  messagesPerHour: z.number().int().min(1).max(1000),
});

export const whatsappCampaignConfigSchema = z.object({
  templateId: z.string().min(1, 'Template is required'),
  templateName: z.string().min(1),
  templateParams: z.record(z.string(), z.string()).optional(),
  usePersonalization: z.boolean(),
  sendRate: z.enum(['immediate', 'scheduled', 'throttled']),
  throttleConfig: throttleConfigSchema.optional(),
});

export const scheduledPostSchema = z.object({
  id: z.string(),
  platform: z.enum(['facebook', 'instagram', 'linkedin', 'twitter']),
  scheduledFor: z.date(),
  content: z.string(),
  mediaUrls: z.array(z.string().url()).optional(),
  status: z.enum(['pending', 'published', 'failed']),
});

export const socialMediaCampaignConfigSchema = z.object({
  platforms: z.array(z.enum(['facebook', 'instagram', 'linkedin', 'twitter'])).min(1),
  postType: z.enum(['single', 'carousel', 'story', 'reel']),
  contentTemplateId: z.string().optional(),
  scheduledPosts: z.array(scheduledPostSchema),
});

export const utmParametersSchema = z.object({
  source: z.string().min(1),
  medium: z.string().min(1),
  campaign: z.string().min(1),
  term: z.string().optional(),
  content: z.string().optional(),
});

export const productPromotionConfigSchema = z.object({
  productIds: z.array(z.string()).min(1, 'At least one product is required'),
  shopifyProductIds: z.array(z.string()).optional(),
  discountCode: z.string().optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  landingPageUrl: z.string().url().optional(),
  utmParameters: utmParametersSchema.optional(),
});

// ============================================
// Campaign Goal Schema
// ============================================

export const campaignGoalSchema = z.object({
  type: z.enum(['reach', 'engagement', 'conversion', 'revenue', 'custom']),
  name: z.string().min(1),
  targetValue: z.number().min(0),
  unit: z.string().min(1),
});

// ============================================
// Campaign Form Schema
// ============================================

const campaignFormBaseSchema = z.object({
  name: z
    .string()
    .min(CAMPAIGN_NAME_MIN_LENGTH, `Name must be at least ${CAMPAIGN_NAME_MIN_LENGTH} characters`)
    .max(
      CAMPAIGN_NAME_MAX_LENGTH,
      `Name must not exceed ${CAMPAIGN_NAME_MAX_LENGTH} characters`
    ),
  description: z
    .string()
    .max(
      CAMPAIGN_DESCRIPTION_MAX_LENGTH,
      `Description must not exceed ${CAMPAIGN_DESCRIPTION_MAX_LENGTH} characters`
    ),
  campaignType: z.enum(['whatsapp', 'social_media', 'product_promotion', 'hybrid']),
  targetAudience: audienceSegmentSchema,
  scheduledStartDate: z.date(),
  scheduledEndDate: z.date(),
  whatsappConfig: whatsappCampaignConfigSchema.optional(),
  socialMediaConfig: socialMediaCampaignConfigSchema.optional(),
  productPromotionConfig: productPromotionConfigSchema.optional(),
  budget: z.number().min(0).optional(),
  budgetCurrency: z.string().default('UGX'),
  goals: z.array(campaignGoalSchema),
  tags: z.array(z.string()),
});

export const campaignFormSchema = campaignFormBaseSchema
  .refine((data) => data.scheduledEndDate >= data.scheduledStartDate, {
    message: 'End date must be after start date',
    path: ['scheduledEndDate'],
  })
  .refine(
    (data) => {
      if (data.campaignType === 'whatsapp') {
        return !!data.whatsappConfig;
      }
      return true;
    },
    {
      message: 'WhatsApp configuration is required for WhatsApp campaigns',
      path: ['whatsappConfig'],
    }
  )
  .refine(
    (data) => {
      if (data.campaignType === 'social_media') {
        return !!data.socialMediaConfig;
      }
      return true;
    },
    {
      message: 'Social media configuration is required for social media campaigns',
      path: ['socialMediaConfig'],
    }
  )
  .refine(
    (data) => {
      if (data.campaignType === 'product_promotion') {
        return !!data.productPromotionConfig;
      }
      return true;
    },
    {
      message: 'Product promotion configuration is required for product promotion campaigns',
      path: ['productPromotionConfig'],
    }
  );

export type CampaignFormInput = z.infer<typeof campaignFormSchema>;

// ============================================
// Social Media Post Form Schema
// ============================================

export const socialPostFormSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(POST_TITLE_MAX_LENGTH, `Title must not exceed ${POST_TITLE_MAX_LENGTH} characters`),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(POST_CONTENT_MAX_LENGTH, `Content must not exceed ${POST_CONTENT_MAX_LENGTH} characters`),
  platforms: z.array(z.enum(['facebook', 'instagram', 'linkedin', 'twitter'])).min(1),
  mediaUrls: z.array(z.string().url()),
  mediaType: z.enum(['image', 'video', 'carousel', 'story', 'reel']),
  scheduledFor: z.date().optional(),
  campaignId: z.string().optional(),
  tags: z.array(z.string()),
  category: z.string().optional(),
});

export type SocialPostFormInput = z.infer<typeof socialPostFormSchema>;

// ============================================
// Content Template Form Schema
// ============================================

export const templateFormSchema = z.object({
  name: z
    .string()
    .min(TEMPLATE_NAME_MIN_LENGTH, `Name must be at least ${TEMPLATE_NAME_MIN_LENGTH} characters`)
    .max(
      TEMPLATE_NAME_MAX_LENGTH,
      `Name must not exceed ${TEMPLATE_NAME_MAX_LENGTH} characters`
    ),
  description: z.string(),
  templateType: z.enum(['whatsapp', 'social_post', 'email']),
  content: z.string().min(1, 'Content is required'),
  mediaUrls: z.array(z.string().url()).optional(),
  suggestedHashtags: z.array(z.string()).optional(),
  whatsappTemplateId: z.string().optional(),
  whatsappTemplateName: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()),
});

export type TemplateFormInput = z.infer<typeof templateFormSchema>;

// ============================================
// Update Schemas (Partial)
// ============================================

export const campaignUpdateSchema = campaignFormBaseSchema.partial();
export const socialPostUpdateSchema = socialPostFormSchema.partial();
export const templateUpdateSchema = templateFormSchema.partial();
