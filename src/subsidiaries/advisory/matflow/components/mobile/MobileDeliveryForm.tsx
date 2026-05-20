/**
 * Mobile Delivery Form Component
 * Touch-friendly form for logging material deliveries on site
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/core/components/ui/sheet';
import { Camera, Check, X, Truck, Calendar, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { format } from 'date-fns';

const deliverySchema = z.object({
  materialId: z.string().min(1, 'Select a material'),
  supplierName: z.string().min(1, 'Enter supplier name'),
  deliveryDate: z.string().min(1, 'Select delivery date'),
  quantityReceived: z.number().positive('Enter quantity received'),
  quantityAccepted: z.number().min(0, 'Enter accepted quantity'),
  unitPrice: z.number().positive('Enter unit price'),
  deliveryCondition: z.enum(['good', 'partial', 'damaged', 'rejected']),
  notes: z.string().optional(),
});

type DeliveryFormData = z.infer<typeof deliverySchema>;

interface MobileDeliveryFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: DeliveryFormData) => Promise<void>;
  materials: Array<{ id: string; name: string; unit: string }>;
  preSelectedMaterialId?: string;
}

export function MobileDeliveryForm({
  open,
  onClose,
  onSubmit,
  materials,
  preSelectedMaterialId,
}: MobileDeliveryFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<DeliveryFormData>({
    resolver: zodResolver(deliverySchema),
    defaultValues: {
      materialId: preSelectedMaterialId || '',
      deliveryDate: format(new Date(), 'yyyy-MM-dd'),
      deliveryCondition: 'good',
      quantityReceived: 0,
      quantityAccepted: 0,
      unitPrice: 0,
    },
  });

  const selectedMaterial = materials.find((m) => m.id === watch('materialId'));

  const handlePhotoCapture = async () => {
    // Create input for camera
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Use back camera

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setPhotos((prev) => [...prev, file]);
      }
    };

    input.click();
  };

  const handleFormSubmit = async (data: DeliveryFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      console.log('[Delivery] Logged successfully');
      reset();
      setPhotos([]);
      onClose();
    } catch (error: unknown) {
      const err = error as Error;
      console.error('[Delivery] Failed:', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const conditionOptions = [
    { value: 'good', label: 'Good', color: 'bg-green-100 text-green-700' },
    { value: 'partial', label: 'Partial', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'damaged', label: 'Damaged', color: 'bg-orange-100 text-orange-700' },
    { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-700' },
  ];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="bottom"
        className="h-[90vh] rounded-t-2xl overflow-y-auto"
      >
        <SheetHeader className="text-left sticky top-0 bg-background pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Log Delivery
          </SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          className="space-y-6 pb-8"
        >
          {/* Material Selection */}
          <div className="space-y-2">
            <Label>Material *</Label>
            <Select
              value={watch('materialId')}
              onValueChange={(value: string) => setValue('materialId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select material" />
              </SelectTrigger>
              <SelectContent>
                {materials.map((material) => (
                  <SelectItem key={material.id} value={material.id}>
                    {material.name} ({material.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.materialId && (
              <p className="text-sm text-red-500">{errors.materialId.message}</p>
            )}
          </div>

          {/* Supplier */}
          <div className="space-y-2">
            <Label>Supplier Name *</Label>
            <Input
              {...register('supplierName')}
              placeholder="Enter supplier name"
            />
            {errors.supplierName && (
              <p className="text-sm text-red-500">
                {errors.supplierName.message}
              </p>
            )}
          </div>

          {/* Delivery Date */}
          <div className="space-y-2">
            <Label>Delivery Date *</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                {...register('deliveryDate')}
                className="pl-9"
              />
            </div>
          </div>

          {/* Quantities */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Qty Received *</Label>
              <Input
                type="number"
                inputMode="decimal"
                {...register('quantityReceived', { valueAsNumber: true })}
                placeholder="0"
              />
              {selectedMaterial && (
                <p className="text-xs text-muted-foreground">
                  {selectedMaterial.unit}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Qty Accepted *</Label>
              <Input
                type="number"
                inputMode="decimal"
                {...register('quantityAccepted', { valueAsNumber: true })}
                placeholder="0"
              />
            </div>
          </div>

          {/* Unit Price */}
          <div className="space-y-2">
            <Label>Unit Price (UGX) *</Label>
            <Input
              type="number"
              inputMode="numeric"
              {...register('unitPrice', { valueAsNumber: true })}
              placeholder="0"
            />
            {watch('quantityAccepted') > 0 && watch('unitPrice') > 0 && (
              <p className="text-sm font-medium">
                Total: UGX{' '}
                {(watch('quantityAccepted') * watch('unitPrice')).toLocaleString()}
              </p>
            )}
          </div>

          {/* Delivery Condition */}
          <div className="space-y-2">
            <Label>Delivery Condition *</Label>
            <div className="grid grid-cols-2 gap-2">
              {conditionOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setValue(
                      'deliveryCondition',
                      option.value as DeliveryFormData['deliveryCondition']
                    )
                  }
                  className={cn(
                    'p-3 rounded-lg border-2 transition-colors',
                    watch('deliveryCondition') === option.value
                      ? 'border-primary'
                      : 'border-transparent',
                    option.color
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <Label>Photos</Label>
            <div className="flex gap-2 flex-wrap">
              {photos.map((photo, index) => (
                <div
                  key={index}
                  className="relative h-20 w-20 rounded-lg overflow-hidden bg-muted"
                >
                  <img
                    src={URL.createObjectURL(photo)}
                    alt={`Photo ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPhotos((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handlePhotoCapture}
                className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/50 flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Camera className="h-6 w-6" />
                <span className="text-xs mt-1">Add</span>
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              {...register('notes')}
              placeholder="Any additional notes..."
              rows={3}
            />
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Log Delivery
                </>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export default MobileDeliveryForm;
