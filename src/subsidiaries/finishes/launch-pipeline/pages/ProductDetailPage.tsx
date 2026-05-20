/**
 * Product Detail Page
 * Full product view with specifications, AI tools, deliverables, and stage history
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Sparkles,
  Package,
  FileCheck,
  History,
  ExternalLink,
  Upload,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Tag,
  Ruler,
  Star,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import type { LaunchProduct } from '../types/product.types';
import type { PipelineStage } from '../types/stage.types';
import { getStageConfig } from '../constants/stages';
import { ProductForm } from '../components/product/ProductForm';
import { NamingWizard, DescriptionGenerator, DiscoverabilityPanel, AuditDashboard } from '../components/ai-assistant';
import { deleteProduct, updateProduct } from '../services/pipelineService';

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const STAGE_COLORS: Record<PipelineStage, string> = {
  idea: 'bg-purple-100 text-purple-700',
  research: 'bg-blue-100 text-blue-700',
  design: 'bg-cyan-100 text-cyan-700',
  prototype: 'bg-orange-100 text-orange-700',
  photography: 'bg-red-100 text-red-700',
  documentation: 'bg-emerald-100 text-emerald-700',
  launched: 'bg-green-100 text-green-700',
};

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  
  const [product, setProduct] = useState<LaunchProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showNamingWizard, setShowNamingWizard] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    specifications: true,
    aiContent: true,
    deliverables: true,
    history: false,
  });

  useEffect(() => {
    if (!productId) {
      setError('Product ID not found');
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'launchProducts', productId),
      (snapshot) => {
        if (snapshot.exists()) {
          setProduct({ id: snapshot.id, ...snapshot.data() } as LaunchProduct);
          setError(null);
        } else {
          setError('Product not found');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error loading product:', err);
        setError('Failed to load product');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [productId]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleDelete = async () => {
    if (!product || !confirm('Are you sure you want to delete this product?')) return;
    
    try {
      await deleteProduct(product.id);
      navigate('/launch-pipeline');
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#872E5C]" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error || 'Product not found'}
        </div>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/launch-pipeline')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Pipeline
        </Button>
      </div>
    );
  }

  const stageConfig = getStageConfig(product.currentStage);
  if (!stageConfig) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Unknown pipeline stage: {product.currentStage}
        </div>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/launch-pipeline')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Pipeline
        </Button>
      </div>
    );
  }
  const completedDeliverables = product.deliverables.filter(
    d => d.stage === product.currentStage
  ).length;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate('/launch-pipeline')} className="min-h-[44px]">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-gray-900 break-words">{product.name || 'Untitled Product'}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[product.priority]}`}>
                {product.priority}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[product.currentStage]}`}>
                {stageConfig.label}
              </span>
              {product.shopifySync?.status === 'synced' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Published</span>
              )}
            </div>
            <p className="text-gray-500 capitalize break-words">{product.category} • {product.handle || 'no-handle'}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowEditForm(true)} className="min-h-[44px]">
            <Edit className="w-4 h-4 mr-1" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-600 hover:text-red-700 min-h-[44px]">
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 w-full justify-start overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="overview" className="flex items-center gap-2 min-h-[44px]">
            <Package className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="ai-tools" className="flex items-center gap-2 min-h-[44px]">
            <Sparkles className="w-4 h-4" />
            AI Tools
          </TabsTrigger>
          <TabsTrigger value="deliverables" className="flex items-center gap-2 min-h-[44px]">
            <FileCheck className="w-4 h-4" />
            Deliverables
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2 min-h-[44px]">
            <History className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700">{product.description || 'No description provided'}</p>
                </CardContent>
              </Card>

              {/* Specifications */}
              <Card>
                <CardHeader 
                  className="cursor-pointer" 
                  onClick={() => toggleSection('specifications')}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Ruler className="w-5 h-5" />
                      Specifications
                    </CardTitle>
                    {expandedSections.specifications ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </CardHeader>
                {expandedSections.specifications && (
                  <CardContent className="space-y-4">
                    {product.specifications?.dimensions && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">Dimensions</h4>
                        <p className="text-gray-900">
                          {product.specifications.dimensions.length} × {product.specifications.dimensions.width} × {product.specifications.dimensions.height} {product.specifications.dimensions.unit}
                        </p>
                      </div>
                    )}
                    
                    {product.specifications?.materials?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">Materials</h4>
                        <div className="flex flex-wrap gap-2">
                          {product.specifications.materials.map((mat, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                            >
                              {mat}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {product.specifications?.finishes?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">Finishes</h4>
                        <div className="flex flex-wrap gap-2">
                          {product.specifications.finishes.map((fin, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                            >
                              {fin}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {product.specifications?.features?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">Features</h4>
                        <div className="flex flex-wrap gap-2">
                          {product.specifications.features.map((feat, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                            >
                              {feat}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {!product.specifications?.dimensions && 
                     !product.specifications?.materials?.length && 
                     !product.specifications?.finishes?.length && (
                      <p className="text-gray-500 text-sm">No specifications added yet</p>
                    )}
                  </CardContent>
                )}
              </Card>

              {/* AI-Generated Content */}
              {product.aiContent && (
                <Card>
                  <CardHeader 
                    className="cursor-pointer" 
                    onClick={() => toggleSection('aiContent')}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                        AI-Generated Content
                      </CardTitle>
                      {expandedSections.aiContent ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </CardHeader>
                  {expandedSections.aiContent && (
                    <CardContent className="space-y-4">
                      {product.aiContent.shortDescription && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-1">Short Description</h4>
                          <p className="text-gray-900">{product.aiContent.shortDescription}</p>
                        </div>
                      )}
                      
                      {product.aiContent.bulletPoints?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-1">Key Features</h4>
                          <ul className="list-disc list-inside space-y-1 text-gray-700">
                            {product.aiContent.bulletPoints.map((point, i) => (
                              <li key={i}>{point}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {product.aiContent.metaDescription && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-1">Meta Description</h4>
                          <p className="text-gray-700 text-sm">{product.aiContent.metaDescription}</p>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              )}
            </div>

            {/* Right Column - Status & Quick Actions */}
            <div className="space-y-6">
              {/* Stage Progress */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Stage Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">Deliverables</span>
                      <span className="font-medium">{completedDeliverables}/{stageConfig.requiredDeliverables.length}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${stageConfig.requiredDeliverables.length > 0 ? (completedDeliverables / stageConfig.requiredDeliverables.length) * 100 : 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Required for this stage</h4>
                    <ul className="space-y-2">
                      {stageConfig.requiredDeliverables.map((del) => {
                        const hasDeliverable = product.deliverables.some(d => d.type === del && d.stage === product.currentStage);
                        return (
                          <li key={del} className="flex items-center gap-2 text-sm">
                            {hasDeliverable ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-amber-500" />
                            )}
                            <span className={hasDeliverable ? 'text-gray-700' : 'text-gray-500'}>
                              {del.replace(/_/g, ' ')}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Tags */}
              {product.tags?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Tag className="w-5 h-5" />
                      Tags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {product.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-full text-xs font-medium border border-gray-200 text-gray-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Shopify Status */}
              {product.shopifySync && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ExternalLink className="w-5 h-5" />
                      Shopify
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Status</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${product.shopifySync.status === 'synced' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {product.shopifySync.status}
                        </span>
                      </div>
                      {product.shopifySync.shopifyProductId && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Product ID</span>
                          <span className="text-sm font-mono">{product.shopifySync.shopifyProductId}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              {product.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 text-sm whitespace-pre-wrap">{product.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* AI Tools Tab */}
        <TabsContent value="ai-tools" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Naming */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500" />
                  Product Naming
                </CardTitle>
              </CardHeader>
              <CardContent>
                {product.namingSession ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Current Name</span>
                      <span className="font-medium">{product.name}</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {product.namingSession.candidates?.length || 0} name candidates generated
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setShowNamingWizard(true)}>
                      Generate New Names
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-500 mb-3">Generate AI-powered name suggestions</p>
                    <Button onClick={() => setShowNamingWizard(true)}>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Start Naming Wizard
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Description Generator */}
            <DescriptionGenerator
              product={product}
              onApply={async (content) => {
                const sanitized = Object.fromEntries(
                  Object.entries(content).filter(([, v]) => v !== undefined)
                ) as Partial<typeof content>;

                await updateProduct(product.id, {
                  aiContent: {
                    shortDescription: product.aiContent?.shortDescription ?? '',
                    fullDescription: product.aiContent?.fullDescription ?? '',
                    metaDescription: product.aiContent?.metaDescription ?? '',
                    bulletPoints: product.aiContent?.bulletPoints ?? [],
                    faqs: product.aiContent?.faqs ?? [],
                    altTexts: product.aiContent?.altTexts ?? [],
                    generatedAt: Timestamp.now(),
                    modelVersion: product.aiContent?.modelVersion ?? 'gemini-2.5-flash',
                    editedByUser: true,
                    ...sanitized,
                  },
                });
              }}
            />
          </div>

          {/* Discoverability */}
          <DiscoverabilityPanel
            product={product}
            onApply={async (data) => {
              await updateProduct(product.id, { aiDiscovery: data });
            }}
          />

          {/* Audit Dashboard */}
          {product.shopifySync?.status === 'synced' && (
            <AuditDashboard products={[product]} />
          )}
        </TabsContent>

        {/* Deliverables Tab */}
        <TabsContent value="deliverables" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Deliverables</CardTitle>
                <Button size="sm">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {product.deliverables.length > 0 ? (
                <div className="divide-y">
                  {product.deliverables.map((deliverable) => (
                    <div key={deliverable.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileCheck className="w-5 h-5 text-green-500" />
                        <div>
                          <p className="font-medium">{deliverable.name}</p>
                          <p className="text-sm text-gray-500">
                            {deliverable.type.replace(/_/g, ' ')} • Stage: {deliverable.stage}
                          </p>
                        </div>
                      </div>
                      {deliverable.url && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={deliverable.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No deliverables uploaded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Stage History</CardTitle>
            </CardHeader>
            <CardContent>
              {product.stageHistory?.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                  <div className="space-y-4">
                    {product.stageHistory.map((transition, i) => (
                      <div key={i} className="relative pl-10">
                        <div className="absolute left-2.5 w-3 h-3 rounded-full bg-[#872E5C] border-2 border-white" />
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[transition.from]}`}>{transition.from}</span>
                            <span className="text-gray-400">→</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[transition.to]}`}>{transition.to}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Clock className="w-3.5 h-3.5" />
                            {transition.transitionedAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                          </div>
                          {transition.notes && (
                            <p className="text-sm text-gray-600 mt-2">{transition.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No stage transitions yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Form Modal */}
      {showEditForm && (
        <ProductForm
          product={product}
          onSubmit={async (data) => {
            await updateProduct(product.id, data);
          }}
          onClose={() => setShowEditForm(false)}
        />
      )}

      {/* Naming Wizard Modal */}
      {showNamingWizard && (
        <NamingWizard
          productId={product.id}
          initialContext={{
            category: product.category,
            materials: product.specifications?.materials || [],
            features: product.specifications?.features || [],
          }}
          existingNames={[]}
          onClose={() => setShowNamingWizard(false)}
          onComplete={async (selectedName, handle) => {
            await updateProduct(product.id, { name: selectedName, handle });
            setShowNamingWizard(false);
          }}
        />
      )}
    </div>
  );
}
