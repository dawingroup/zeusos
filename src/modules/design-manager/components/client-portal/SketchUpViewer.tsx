/**
 * SketchUp Viewer Component
 * Embeds SketchUp 3D models for client viewing using the SketchUp Viewer API
 */

import { useState, useEffect } from 'react';
import { 
  Box, 
  Maximize2, 
  Minimize2, 
  Eye,
  Tag,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import {
  getProjectSketchUpModels,
} from '../../services/clientPortalExtendedService';
import type { SketchUpModel } from '../../types/clientPortal';

interface SketchUpViewerProps {
  projectId: string;
  designItemId?: string;
  onAnnotationClick?: (annotationId: string, linkedApprovalItemId?: string) => void;
}

export default function SketchUpViewer({
  projectId,
  designItemId,
  onAnnotationClick,
}: SketchUpViewerProps) {
  const [models, setModels] = useState<SketchUpModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<SketchUpModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  const [showAnnotations, setShowAnnotations] = useState(true);

  useEffect(() => {
    loadModels();
  }, [projectId]);

  const loadModels = async () => {
    try {
      const data = await getProjectSketchUpModels(projectId);
      const filtered = designItemId 
        ? data.filter(m => m.designItemId === designItemId)
        : data;
      setModels(filtered);
      if (filtered.length > 0) {
        setSelectedModel(filtered[0]);
      }
    } catch (err) {
      console.error('Failed to load SketchUp models:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleSceneChange = (sceneId: string) => {
    setSelectedScene(sceneId);
    // In a real implementation, this would communicate with the SketchUp viewer
  };

  const handleAnnotationClick = (annotation: NonNullable<SketchUpModel['annotations']>[number]) => {
    if (onAnnotationClick && annotation) {
      onAnnotationClick(annotation.id, annotation.linkedApprovalItemId);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" />
          Loading 3D models...
        </CardContent>
      </Card>
    );
  }

  if (models.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Box className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No 3D models available</p>
          <p className="text-sm">3D models will appear here when uploaded</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isFullscreen ? 'fixed inset-4 z-50' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Box className="h-4 w-4" />
            3D Model Viewer
          </span>
          <div className="flex items-center gap-2">
            {/* Model Selector (if multiple) */}
            {models.length > 1 && (
              <select
                value={selectedModel?.id || ''}
                onChange={(e) => {
                  const model = models.find(m => m.id === e.target.value);
                  setSelectedModel(model || null);
                }}
                className="text-sm border rounded px-2 py-1"
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            )}
            
            {/* Toggle Annotations */}
            <Button
              size="sm"
              variant={showAnnotations ? 'default' : 'outline'}
              onClick={() => setShowAnnotations(!showAnnotations)}
              title="Toggle annotations"
            >
              <Tag className="h-4 w-4" />
            </Button>
            
            {/* Fullscreen Toggle */}
            <Button
              size="sm"
              variant="outline"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {selectedModel && (
          <>
            {/* Model Info */}
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{selectedModel.name}</span>
              {selectedModel.version > 1 && (
                <Badge variant="outline">v{selectedModel.version}</Badge>
              )}
            </div>
            
            {selectedModel.description && (
              <p className="text-sm text-muted-foreground">
                {selectedModel.description}
              </p>
            )}

            {/* Viewer Container */}
            <div 
              className={`relative bg-gray-900 rounded-lg overflow-hidden ${
                isFullscreen ? 'h-[calc(100vh-200px)]' : 'h-[400px]'
              }`}
            >
              {/* SketchUp Viewer Embed */}
              {selectedModel.viewerEmbedUrl ? (
                <iframe
                  src={selectedModel.viewerEmbedUrl}
                  className="w-full h-full border-0"
                  allow="autoplay; fullscreen; vr"
                  allowFullScreen
                  title={selectedModel.name}
                />
              ) : selectedModel.thumbnailUrl ? (
                // Fallback to thumbnail with model download link
                <div className="relative w-full h-full">
                  <img
                    src={selectedModel.thumbnailUrl}
                    alt={selectedModel.name}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-center text-white">
                      <Box className="h-12 w-12 mx-auto mb-2 opacity-75" />
                      <p className="mb-2">3D Preview Not Available</p>
                      <a
                        href={selectedModel.modelFileUrl}
                        download
                        className="inline-flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-100"
                      >
                        Download SketchUp File
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                // No viewer or thumbnail
                <div className="w-full h-full flex items-center justify-center text-white">
                  <div className="text-center">
                    <Box className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>3D Viewer Loading...</p>
                    <p className="text-sm opacity-75">
                      If the viewer doesn&apos;t load, you may need to download the SketchUp file
                    </p>
                    <a
                      href={selectedModel.modelFileUrl}
                      download
                      className="inline-flex items-center gap-2 mt-4 bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-100"
                    >
                      Download .skp File
                    </a>
                  </div>
                </div>
              )}

              {/* Annotation Markers */}
              {showAnnotations && selectedModel.annotations && selectedModel.annotations.length > 0 && (
                <div className="absolute top-4 right-4 space-y-2">
                  {selectedModel.annotations.map((annotation, idx) => (
                    <button
                      key={annotation.id}
                      onClick={() => handleAnnotationClick(annotation)}
                      className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg hover:bg-white text-sm"
                      title={annotation.description}
                    >
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                        {idx + 1}
                      </span>
                      <span>{annotation.label}</span>
                      {annotation.linkedApprovalItemId && (
                        <Badge variant="outline" className="text-xs">
                          Approval
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Scene Selector */}
            {selectedModel.scenes && selectedModel.scenes.length > 0 && (
              <div>
                <span className="text-sm font-medium mb-2 block">Views</span>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {selectedModel.scenes.map((scene) => (
                    <button
                      key={scene.id}
                      onClick={() => handleSceneChange(scene.id)}
                      className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                        selectedScene === scene.id
                          ? 'border-primary'
                          : 'border-transparent hover:border-muted'
                      }`}
                    >
                      {scene.thumbnailUrl ? (
                        <img
                          src={scene.thumbnailUrl}
                          alt={scene.name}
                          className="w-20 h-14 object-cover"
                        />
                      ) : (
                        <div className="w-20 h-14 bg-muted flex items-center justify-center">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="text-xs text-center py-1 bg-muted/50">
                        {scene.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Controls Info */}
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <p className="font-medium mb-1">Navigation Controls:</p>
              <ul className="space-y-0.5">
                <li>• <strong>Orbit:</strong> Left-click + drag</li>
                <li>• <strong>Pan:</strong> Right-click + drag (or Shift + left-click)</li>
                <li>• <strong>Zoom:</strong> Scroll wheel</li>
                <li>• <strong>Reset:</strong> Double-click to reset view</li>
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
