/**
 * AI Tools Page
 * 
 * Central hub for all AI-powered design tools:
 * - Project Scoping AI (brief analysis + strategy)
 * - Image Analysis AI
 * - Brief Analyzer (legacy)
 * - DfM Checker
 */

import { useState } from 'react';
import { 
  Sparkles, 
  FileText, 
  Image as ImageIcon, 
  Wrench,
  ChevronRight,
} from 'lucide-react';
import { ProjectScopingAI } from '../components/ai/ProjectScopingAI';
import { ImageAnalysisAI } from '../components/ai/ImageAnalysisAI';
import { BriefAnalyzer } from '../components/ai/BriefAnalyzer';

type AITool = 'scoping' | 'image' | 'brief' | null;

const AI_TOOLS = [
  {
    id: 'scoping' as AITool,
    name: 'Project Scoping AI',
    description: 'Extract deliverables from design briefs with multiplier detection',
    icon: Sparkles,
    color: 'from-purple-500 to-blue-600',
    badge: 'NEW',
  },
  {
    id: 'image' as AITool,
    name: 'Image Analysis',
    description: 'Analyze reference images for design elements and materials',
    icon: ImageIcon,
    color: 'from-pink-500 to-orange-500',
    badge: 'NEW',
  },
  {
    id: 'brief' as AITool,
    name: 'Brief Analyzer',
    description: 'Parse design briefs to extract items and specifications',
    icon: FileText,
    color: 'from-green-500 to-teal-500',
    badge: null,
  },
];

export function AIToolsPage() {
  const [activeTool, setActiveTool] = useState<AITool>(null);

  const handleScopingComplete = (result: unknown) => {
    console.log('Scoping complete:', result);
  };

  const handleImageAnalysisComplete = (result: unknown) => {
    console.log('Image analysis complete:', result);
  };

  const handleBriefAnalysisComplete = (result: unknown) => {
    console.log('Brief analysis complete:', result);
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b">
        <div className="py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Design Tools</h1>
              <p className="text-sm text-gray-500">
                Powered by Gemini 2.0 Flash • Feature Library integrated
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6">
        <div className="grid grid-cols-12 gap-8">
          {/* Tool Selector */}
          <div className="col-span-4">
            <div className="bg-white rounded-xl shadow-sm border p-4 sticky top-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                Select Tool
              </h2>
              <div className="space-y-2">
                {AI_TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  const isActive = activeTool === tool.id;
                  
                  return (
                    <button
                      key={tool.id}
                      onClick={() => setActiveTool(tool.id)}
                      className={`w-full flex items-center gap-3 p-4 rounded-lg text-left transition-all ${
                        isActive 
                          ? 'bg-gradient-to-r ' + tool.color + ' text-white shadow-lg' 
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${isActive ? 'bg-white/20' : 'bg-white shadow-sm'}`}>
                        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{tool.name}</span>
                          {tool.badge && (
                            <span className={`px-1.5 py-0.5 text-xs font-bold rounded ${
                              isActive ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {tool.badge}
                            </span>
                          )}
                        </div>
                        <p className={`text-sm truncate ${isActive ? 'text-white/80' : 'text-gray-500'}`}>
                          {tool.description}
                        </p>
                      </div>
                      <ChevronRight className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                    </button>
                  );
                })}
              </div>

              {/* Quick Stats */}
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Rate Limits
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">AI Requests</span>
                    <span className="font-medium">100/hour</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Image Analysis</span>
                    <span className="font-medium">30/hour</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Grounded Search</span>
                    <span className="font-medium">20/hour</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tool Panel */}
          <div className="col-span-8">
            <div className="bg-white rounded-xl shadow-sm border p-6 min-h-[600px]">
              {!activeTool && (
                <div className="flex flex-col items-center justify-center h-96 text-center">
                  <div className="p-4 bg-gray-100 rounded-full mb-4">
                    <Wrench className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Select an AI Tool
                  </h3>
                  <p className="text-gray-500 max-w-md">
                    Choose a tool from the left panel to start analyzing your design 
                    briefs, reference images, or generate project scopes.
                  </p>
                </div>
              )}

              {activeTool === 'scoping' && (
                <ProjectScopingAI
                  projectName="Test Project"
                  onScopingComplete={handleScopingComplete}
                />
              )}

              {activeTool === 'image' && (
                <ImageAnalysisAI
                  onAnalysisComplete={handleImageAnalysisComplete}
                />
              )}

              {activeTool === 'brief' && (
                <BriefAnalyzer
                  projectId="test-project"
                  onAnalysisComplete={handleBriefAnalysisComplete}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIToolsPage;
