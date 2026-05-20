/**
 * FormPageTemplate Component
 * Template for create/edit form pages
 */

import { ArrowLeft, Save, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/core/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/core/components/ui/card';
import { PageTemplate } from './PageTemplate';

interface FormSection {
  id: string;
  title: string;
  description?: string;
  content: React.ReactNode;
}

interface FormPageTemplateProps {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  sections: FormSection[];
  isSubmitting?: boolean;
  isDirty?: boolean;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  isValid?: boolean;
}

export function FormPageTemplate({
  title,
  description,
  breadcrumbs,
  sections,
  isSubmitting = false,
  isDirty: _isDirty = false,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  isValid = true,
}: FormPageTemplateProps) {
  const navigate = useNavigate();

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(-1);
    }
  };

  const actions = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={handleCancel}
        disabled={isSubmitting}
      >
        <X className="h-4 w-4 mr-2" />
        {cancelLabel}
      </Button>
      <Button
        onClick={onSubmit}
        disabled={isSubmitting || !isValid}
      >
        <Save className="h-4 w-4 mr-2" />
        {isSubmitting ? 'Saving...' : submitLabel}
      </Button>
    </div>
  );

  return (
    <PageTemplate
      title={title}
      description={description}
      breadcrumbs={breadcrumbs}
      actions={actions}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="mb-4 -ml-2"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <div className="space-y-6">
        {sections.map((section) => (
          <Card key={section.id}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              {section.description && (
                <CardDescription>{section.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>{section.content}</CardContent>
          </Card>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t md:hidden">
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            {cancelLabel}
          </Button>
          <Button
            className="flex-1"
            onClick={onSubmit}
            disabled={isSubmitting || !isValid}
          >
            {isSubmitting ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </div>
    </PageTemplate>
  );
}
