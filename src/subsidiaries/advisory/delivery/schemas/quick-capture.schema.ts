import { z } from 'zod';

export const quickCaptureDocumentSchema = z.object({
  type: z.enum(['Receipt', 'Invoice', 'DeliveryNote', 'Photo', 'Other']),
  storageUrl: z.string().url(),
  fileName: z.string(),
});

export const quickCaptureSchema = z.object({
  date: z.date(),
  vendorName: z.string().min(1, 'Vendor name is required').max(200),
  description: z.string().min(1, 'Description is required').max(500),
  totalAmount: z.number().positive('Amount must be positive'),
  currency: z.enum(['UGX', 'USD']).default('UGX'),
  paymentMethod: z.enum(['Cash', 'MobileMoney', 'BankTransfer', 'Cheque']),
  paymentReference: z.string().max(100).nullable().default(null),
  projectId: z.string().min(1, 'Project is required'),
  budgetCategory: z.string().min(1, 'Budget line is required'),
  requisitionId: z.string().nullable().default(null),
  documents: z.array(quickCaptureDocumentSchema).min(0), // Phase 1: photos optional; Phase 2: min 1
  notes: z.string().max(1000).default(''),
});

export type QuickCaptureFormValues = z.infer<typeof quickCaptureSchema>;
