/**
 * Placeholder Page
 * DawinOS v2.0 - Testing Framework
 * Placeholder for individual module test pages
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Construction, ArrowLeft } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  parentPath?: string;
  parentTitle?: string;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  parentPath = '/test',
  parentTitle = 'Test Dashboard',
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="p-4 bg-amber-100 rounded-full mb-4">
        <Construction className="w-12 h-12 text-amber-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-600 max-w-md mb-6">
        This page connects to the existing {title} implementation.
        The full testing interface will be available once the module is complete.
      </p>
      <Link
        to={parentPath}
        className="inline-flex items-center gap-2 px-4 py-2 text-[#872E5C] hover:bg-[#872E5C]/10 rounded-lg transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {parentTitle}
      </Link>
    </div>
  );
};

export default PlaceholderPage;
