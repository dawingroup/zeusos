/**
 * Shop Traveler Component
 * UI for generating and downloading shop traveler PDFs
 */

import { useState, useMemo } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import {
  Download,
  Printer,
  Eye,
  Loader2,
  CheckCircle,
  AlertCircle,
  ClipboardList,
} from 'lucide-react';

import { Button } from '@/core/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/core/components/ui/dialog';
import {
  ShopTravelerDocument,
  buildShopTravelerData,
  type ShopTravelerData,
} from '@/shared/services/pdf/shopTravelerService';

interface ShopTravelerProps {
  project: {
    id: string;
    name: string;
    code?: string;
    customerName?: string;
    dueDate?: string;
    priority?: 'normal' | 'high' | 'urgent';
    productionNotes?: string;
  };
  designItems: any[];
  optimizationState?: any;
  onGenerate?: () => void;
}

export function ShopTraveler({
  project,
  designItems,
  optimizationState,
  onGenerate,
}: ShopTravelerProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Build traveler data
  const travelerData = useMemo<ShopTravelerData>(() => {
    return buildShopTravelerData(project, designItems, optimizationState);
  }, [project, designItems, optimizationState]);

  // Check readiness
  const readinessChecks = useMemo(() => {
    const checks = [
      {
        label: 'Design items defined',
        passed: designItems.length > 0,
        required: true,
      },
      {
        label: 'Production nesting complete',
        passed: !!optimizationState?.production,
        required: true,
      },
      {
        label: 'Parts lists complete',
        passed: designItems.every(item => item.parts?.length > 0),
        required: false,
      },
      {
        label: 'Materials specified',
        passed: designItems.every(item => item.materials?.length > 0 || item.material),
        required: false,
      },
    ];

    return {
      checks,
      canGenerate: checks.filter(c => c.required).every(c => c.passed),
      allPassed: checks.every(c => c.passed),
    };
  }, [designItems, optimizationState]);

  const priorityColors = {
    normal: 'bg-gray-100 text-gray-800',
    high: 'bg-yellow-100 text-yellow-800',
    urgent: 'bg-red-100 text-red-800',
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Shop Traveler</CardTitle>
          </div>
          {project.priority && (
            <Badge className={priorityColors[project.priority]}>
              {project.priority.toUpperCase()}
            </Badge>
          )}
        </div>
        <CardDescription>
          Generate printable work instructions for the production floor
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Readiness Checks */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Readiness</h4>
          <div className="grid grid-cols-2 gap-2">
            {readinessChecks.checks.map((check, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-sm p-2 rounded ${
                  check.passed 
                    ? 'bg-green-50 text-green-700' 
                    : check.required 
                      ? 'bg-red-50 text-red-700'
                      : 'bg-yellow-50 text-yellow-700'
                }`}
              >
                {check.passed ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span>{check.label}</span>
                {check.required && !check.passed && (
                  <span className="text-xs">(Required)</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 py-3 border-y">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{designItems.length}</p>
            <p className="text-xs text-muted-foreground">Design Items</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {travelerData.materialSummary.reduce((sum, m) => sum + m.totalSheets, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Total Sheets</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">
              {travelerData.qualityCheckpoints?.length || 0}
            </p>
            <p className="text-xs text-muted-foreground">QC Checkpoints</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {/* Preview Button */}
          <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!readinessChecks.canGenerate}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Shop Traveler Preview</DialogTitle>
                <DialogDescription>
                  Review before printing or downloading
                </DialogDescription>
              </DialogHeader>
              <ShopTravelerPreview data={travelerData} />
            </DialogContent>
          </Dialog>

          {/* Download Button */}
          {readinessChecks.canGenerate ? (
            <PDFDownloadLink
              document={<ShopTravelerDocument data={travelerData} />}
              fileName={`shop-traveler-${project.code || project.id}.pdf`}
            >
              {({ loading }) => (
                <Button disabled={loading} onClick={onGenerate}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download PDF
                </Button>
              )}
            </PDFDownloadLink>
          ) : (
            <Button disabled>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          )}

          {/* Print Button */}
          <Button
            variant="outline"
            disabled={!readinessChecks.canGenerate}
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>

        {/* Warning if not ready */}
        {!readinessChecks.canGenerate && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 text-yellow-800 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              Complete required items above before generating the shop traveler.
              Production nesting must be run to calculate material requirements.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Preview component for the dialog
function ShopTravelerPreview({ data }: { data: ShopTravelerData }) {
  return (
    <div className="space-y-6 p-4 bg-white">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4">
        <div>
          <h1 className="text-xl font-bold">SHOP TRAVELER</h1>
          <p className="text-gray-600">{data.projectName}</p>
          {data.customerName && (
            <p className="text-sm text-gray-500">Customer: {data.customerName}</p>
          )}
        </div>
        <div className="text-right">
          {data.projectCode && (
            <p className="text-2xl font-bold">{data.projectCode}</p>
          )}
          <Badge
            variant={
              data.priority === 'urgent'
                ? 'destructive'
                : 'secondary'
            }
          >
            {(data.priority || 'normal').toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Material Summary */}
      {data.materialSummary.length > 0 && (
        <div>
          <h2 className="font-bold bg-gray-100 p-2 mb-2">MATERIAL REQUIREMENTS</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Material</th>
                <th className="text-left p-2">Thickness</th>
                <th className="text-left p-2">Sheets</th>
                <th className="text-left p-2">Supplier</th>
              </tr>
            </thead>
            <tbody>
              {data.materialSummary.map((mat, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2">{mat.material}</td>
                  <td className="p-2">{mat.thickness}</td>
                  <td className="p-2">{mat.totalSheets}</td>
                  <td className="p-2">{mat.supplier || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Design Items */}
      <div>
        <h2 className="font-bold bg-gray-100 p-2 mb-2">
          DESIGN ITEMS ({data.designItems.length})
        </h2>
        <div className="space-y-4">
          {data.designItems.map((item, i) => (
            <div key={i} className="border rounded p-3">
              <div className="flex justify-between items-center border-b pb-2 mb-2">
                <span className="font-bold">{item.name}</span>
                <span className="text-blue-600 font-bold">Qty: {item.quantity}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Category:</span> {item.category}
                </div>
                {item.dimensions && (
                  <div>
                    <span className="text-gray-500">Dimensions:</span>{' '}
                    {item.dimensions.width} x {item.dimensions.height} x{' '}
                    {item.dimensions.depth} {item.dimensions.unit}
                  </div>
                )}
              </div>
              {item.parts && item.parts.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium">Parts: {item.parts.length}</p>
                </div>
              )}
              {item.specialInstructions && (
                <div className="mt-2 p-2 bg-yellow-50 border-l-2 border-yellow-400 text-sm">
                  <span className="font-medium">Note:</span> {item.specialInstructions}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quality Checkpoints */}
      {data.qualityCheckpoints && data.qualityCheckpoints.length > 0 && (
        <div>
          <h2 className="font-bold bg-gray-100 p-2 mb-2">QUALITY CHECKPOINTS</h2>
          <div className="space-y-3">
            {data.qualityCheckpoints.map((checkpoint, i) => (
              <div key={i}>
                <h3 className="font-medium">{checkpoint.stage}</h3>
                <ul className="ml-4 space-y-1">
                  {checkpoint.checks.map((check, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm">
                      <div className="w-4 h-4 border border-gray-400" />
                      {check}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Production Notes */}
      {data.productionNotes && (
        <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400">
          <h3 className="font-bold text-sm mb-1">Production Notes</h3>
          <p className="text-sm">{data.productionNotes}</p>
        </div>
      )}
    </div>
  );
}
