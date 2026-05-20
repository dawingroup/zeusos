/**
 * Contractor Card - Contractor information or direct implementation notice
 */

import { Building, Phone, Mail, User, FileText } from 'lucide-react';
import { BaseCard } from '@/shared/components/cards';
import type { Project } from '@/subsidiaries/advisory/core/project/types/project.types';

interface ContractorCardProps {
  project: Project;
}

export function ContractorCard({ project }: ContractorCardProps) {
  // Access contractor from the project object (may be on the Firestore doc beyond typed fields)
  const projectData = project as unknown as Record<string, unknown>;
  const contractor = projectData.contractor as {
    companyName?: string;
    contractNumber?: string;
    contractValue?: number;
    contactPerson?: {
      name?: string;
      role?: string;
      email?: string;
      phone?: string;
    };
  } | undefined;

  const implementationType = projectData.implementationType as string | undefined;

  return (
    <BaseCard padding="lg">
      <h3 className="text-base font-medium text-gray-900 mb-3 flex items-center gap-2">
        <Building className="w-4 h-4 text-gray-400" />
        {implementationType === 'direct' ? 'Implementation' : 'Contractor'}
      </h3>

      {implementationType === 'direct' || !contractor ? (
        <div className="text-center py-4">
          <Building className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm font-medium text-gray-700">Direct Implementation</p>
          <p className="text-xs text-gray-500 mt-1">Managed by internal team</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="text-lg font-medium text-gray-900">{contractor.companyName || 'Unknown'}</div>
            {contractor.contractNumber && (
              <div className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                <FileText className="w-3.5 h-3.5" />
                Contract: {contractor.contractNumber}
              </div>
            )}
          </div>

          {contractor.contractValue && contractor.contractValue > 0 && (
            <div className="bg-blue-50 rounded-lg px-3 py-2">
              <div className="text-xs text-blue-600">Contract Value</div>
              <div className="text-sm font-semibold text-blue-800">
                UGX {(contractor.contractValue / 1000000).toFixed(0)}M
              </div>
            </div>
          )}

          {contractor.contactPerson && (
            <div className="pt-2 border-t space-y-2">
              <div className="text-xs text-gray-500 font-medium">Contact Person</div>
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-gray-900">{contractor.contactPerson.name}</div>
                  {contractor.contactPerson.role && (
                    <div className="text-xs text-gray-500">{contractor.contactPerson.role}</div>
                  )}
                </div>
              </div>
              {contractor.contactPerson.email && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  {contractor.contactPerson.email}
                </div>
              )}
              {contractor.contactPerson.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  {contractor.contactPerson.phone}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </BaseCard>
  );
}
