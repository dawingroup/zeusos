/**
 * Strategy Generator Component
 * UI for generating and downloading strategy reports
 */

import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { functions } from '@/shared/services/firebase';
import { StrategyPDF } from './StrategyPDF';
import type { StrategyReport, GenerateStrategyInput } from '../types';

interface StrategyGeneratorProps {
  projectId: string;
  projectName: string;
  projectCode: string;
  clientBrief?: string;
  onClose: () => void;
}

export function StrategyGenerator({
  projectId: _projectId,
  projectName,
  projectCode,
  clientBrief: initialBrief = '',
  onClose,
}: StrategyGeneratorProps) {
  // projectId reserved for future use (save strategy to project)
  void _projectId;
  // Form state
  const [projectType, setProjectType] = useState('Custom Millwork');
  const [clientBrief, setClientBrief] = useState(initialBrief);
  const [location, setLocation] = useState('East Africa');
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<StrategyReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generate strategy report
  const handleGenerate = async () => {
    if (!clientBrief) {
      setError('Please provide a client brief');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const generateStrategy = httpsCallable<GenerateStrategyInput, StrategyReport>(
        functions,
        'generateStrategyReport'
      );

      const result = await generateStrategy({
        projectName,
        projectType,
        clientBrief,
        location,
        year: new Date().getFullYear(),
      });

      setReport(result.data);
    } catch (err) {
      console.error('Strategy generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate strategy');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-indigo-600 to-purple-600">
            <div>
              <h2 className="text-xl font-bold text-white">Generate Design Strategy</h2>
              <p className="text-indigo-200 text-sm">{projectName} ({projectCode})</p>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {!report ? (
              // Input Form
              <div className="space-y-6">
                <div className="bg-indigo-50 rounded-lg p-4">
                  <h3 className="font-medium text-indigo-900 mb-2">How it works</h3>
                  <ol className="text-sm text-indigo-700 space-y-1 list-decimal list-inside">
                    <li>AI searches for current design trends relevant to your project</li>
                    <li>Matches trends to your available manufacturing features</li>
                    <li>Generates recommendations based on what you can actually produce</li>
                    <li>Creates a downloadable PDF strategy report</li>
                  </ol>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Project Type
                    </label>
                    <select
                      value={projectType}
                      onChange={(e) => setProjectType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                    >
                      <option>Custom Millwork</option>
                      <option>Kitchen Cabinetry</option>
                      <option>Built-in Furniture</option>
                      <option>Commercial Interiors</option>
                      <option>Residential Interiors</option>
                      <option>Hospitality</option>
                      <option>Retail Fixtures</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location / Market
                    </label>
                    <select
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                    >
                      <option>East Africa</option>
                      <option>Uganda</option>
                      <option>Kenya</option>
                      <option>Tanzania</option>
                      <option>Rwanda</option>
                      <option>Global</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Brief *
                  </label>
                  <textarea
                    value={clientBrief}
                    onChange={(e) => setClientBrief(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                    placeholder="Describe the project requirements, client preferences, style direction, functional needs, budget considerations, etc."
                  />
                </div>

                {error && (
                  <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
                    {error}
                  </div>
                )}
              </div>
            ) : (
              // Report Preview
              <div className="space-y-6">
                {/* Success Banner */}
                <div className="bg-green-50 rounded-lg p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-green-900">Strategy Report Generated</h3>
                    <p className="text-sm text-green-700">
                      {report.trends.length} trends analyzed, {report.recommendations.length} recommendations
                    </p>
                  </div>
                </div>

                {/* Executive Summary */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Executive Summary</h4>
                  <p className="text-gray-600 text-sm">{report.executiveSummary}</p>
                </div>

                {/* Trends Preview */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Key Trends</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {report.trends.slice(0, 4).map((trend, i) => (
                      <div key={i} className="bg-blue-50 rounded-lg p-3">
                        <p className="font-medium text-blue-900">{trend.name}</p>
                        <p className="text-sm text-blue-700 mt-1">{trend.description.slice(0, 100)}...</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Production Feasibility */}
                <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-teal-900">Production Feasibility</h4>
                      <p className="text-sm text-teal-700">{report.productionFeasibility.notes}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-teal-600">
                        {report.productionFeasibility.overallScore}%
                      </p>
                      <p className="text-xs text-teal-600">Score</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-teal-200">
                    <p className="text-xs text-teal-700">
                      <strong>{report.metadata.featuresProposed}</strong> features proposed from{' '}
                      <strong>{report.metadata.totalAvailableFeatures}</strong> available |{' '}
                      Est. <strong>{report.productionFeasibility.estimatedTotalDays}</strong> days
                    </p>
                  </div>
                </div>

                {/* Color Scheme Preview */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Color Scheme</h4>
                  <div className="flex gap-3">
                    <div
                      className="w-16 h-16 rounded-lg shadow-inner flex items-center justify-center"
                      style={{ backgroundColor: report.colorScheme.primary }}
                    >
                      <span className="text-white text-xs font-medium">Primary</span>
                    </div>
                    <div
                      className="w-16 h-16 rounded-lg shadow-inner flex items-center justify-center"
                      style={{ backgroundColor: report.colorScheme.secondary }}
                    >
                      <span className="text-white text-xs font-medium">Secondary</span>
                    </div>
                    <div
                      className="w-16 h-16 rounded-lg shadow-inner flex items-center justify-center"
                      style={{ backgroundColor: report.colorScheme.accent }}
                    >
                      <span className="text-white text-xs font-medium">Accent</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center p-6 border-t bg-gray-50">
            {!report ? (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !clientBrief}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Generate Strategy
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setReport(null)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  ← Generate Another
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                  >
                    Close
                  </button>
                  <PDFDownloadLink
                    document={<StrategyPDF report={report} />}
                    fileName={`${projectCode}-strategy-${new Date().toISOString().split('T')[0]}.pdf`}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                  >
                    {({ loading }) => (
                      loading ? (
                        <>
                          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Preparing PDF...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Download PDF
                        </>
                      )
                    )}
                  </PDFDownloadLink>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
