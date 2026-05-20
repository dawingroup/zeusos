/**
 * useManualUpload Hook
 * State machine for the manual photo upload + reverse image search flow.
 *
 * Steps: upload → searching → select-result → analyzing → complete
 */

import { useState, useCallback, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/shared/services/firebase/functions';
import { useAuth } from '@/contexts/AuthContext';
import {
  uploadClientPhoto,
  searchSimilarImages,
  fetchAndUploadSelectedImage,
} from '../services/manualUploadService';
import { createClip, updateClip, linkClipToDesignItem } from '../services/clipService';
import type { ReverseSearchMatch, ClipAIAnalysis } from '../types';

export type UploadStep = 'upload' | 'searching' | 'select-result' | 'analyzing' | 'complete';

interface WebEntity {
  description: string;
  score: number;
}

interface UseManualUploadOptions {
  projectId: string;
  designItemId?: string;
}

interface UseManualUploadReturn {
  step: UploadStep;
  error: string | null;

  // Step 1 - Upload
  uploadPhoto: (file: File, title?: string) => Promise<void>;

  // Step 2 - Search results
  searchResults: ReverseSearchMatch[];
  webEntities: WebEntity[];
  bestGuessLabels: string[];
  isSearching: boolean;

  // Step 3 - Selection
  selectedResult: ReverseSearchMatch | null;
  selectResult: (match: ReverseSearchMatch) => void;
  useOriginal: () => void;

  // Step 4 - Analyze & save
  confirmAndAnalyze: () => Promise<string | null>;
  isAnalyzing: boolean;
  analysisResult: ClipAIAnalysis | null;
  createdClipId: string | null;

  // General
  skipSearch: () => Promise<string | null>;
  reset: () => void;
}

export function useManualUpload({ projectId, designItemId }: UseManualUploadOptions): UseManualUploadReturn {
  const { user } = useAuth();

  const [step, setStep] = useState<UploadStep>('upload');
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const uploadedDataRef = useRef<{
    imageUrl: string;
    thumbnailUrl: string;
    base64: string;
    mimeType: string;
    title: string;
    tempClipId: string;
  } | null>(null);

  // Search state
  const [searchResults, setSearchResults] = useState<ReverseSearchMatch[]>([]);
  const [webEntities, setWebEntities] = useState<WebEntity[]>([]);
  const [bestGuessLabels, setBestGuessLabels] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Selection state
  const [selectedResult, setSelectedResult] = useState<ReverseSearchMatch | null>(null);
  const [usingOriginal, setUsingOriginal] = useState(false);

  // Analyze state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ClipAIAnalysis | null>(null);
  const [createdClipId, setCreatedClipId] = useState<string | null>(null);

  /**
   * Step 1: Upload a client photo and trigger reverse image search.
   */
  const uploadPhoto = useCallback(async (file: File, title?: string) => {
    if (!user?.uid) {
      setError('Not authenticated');
      return;
    }

    setError(null);
    const tempClipId = `manual_${Date.now()}`;

    try {
      // Upload the photo
      const result = await uploadClientPhoto(file, projectId, tempClipId);

      uploadedDataRef.current = {
        ...result,
        title: title || file.name.replace(/\.[^.]+$/, ''),
        tempClipId,
      };

      // Start reverse image search
      setStep('searching');
      setIsSearching(true);

      const searchResponse = await searchSimilarImages(result.base64, result.mimeType);

      setSearchResults(searchResponse.matches);
      setWebEntities(searchResponse.webEntities || []);
      setBestGuessLabels(searchResponse.bestGuessLabels || []);
      setIsSearching(false);

      if (searchResponse.matches.length > 0) {
        setStep('select-result');
      } else {
        // No results found — go straight to analyzing with the original
        setUsingOriginal(true);
        setStep('select-result');
      }
    } catch (err) {
      console.error('Upload/search failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setIsSearching(false);
      setStep('upload');
    }
  }, [user?.uid, projectId]);

  /**
   * Step 3a: Select a search result image.
   */
  const selectResult = useCallback((match: ReverseSearchMatch) => {
    setSelectedResult(match);
    setUsingOriginal(false);
  }, []);

  /**
   * Step 3b: Use the original uploaded image instead.
   */
  const useOriginal = useCallback(() => {
    setSelectedResult(null);
    setUsingOriginal(true);
  }, []);

  /**
   * Step 4: Confirm selection, create clip, trigger AI analysis.
   */
  const confirmAndAnalyze = useCallback(async (): Promise<string | null> => {
    if (!user?.uid || !uploadedDataRef.current) {
      setError('Missing upload data');
      return null;
    }

    setStep('analyzing');
    setIsAnalyzing(true);
    setError(null);

    const uploaded = uploadedDataRef.current;

    try {
      let finalImageUrl = uploaded.imageUrl;
      let finalThumbnailUrl = uploaded.thumbnailUrl;
      let imageBase64ForAnalysis = uploaded.base64;
      let imageMimeForAnalysis = uploaded.mimeType;
      let sourceUrl = '';
      const isFromSearch = !usingOriginal && selectedResult !== null;

      // If a search result was selected, fetch and upload it
      if (isFromSearch && selectedResult) {
        const fetched = await fetchAndUploadSelectedImage(
          selectedResult.url,
          projectId,
          uploaded.tempClipId
        );
        finalImageUrl = fetched.storedImageUrl;
        finalThumbnailUrl = fetched.storedThumbnailUrl;
        imageBase64ForAnalysis = fetched.base64;
        imageMimeForAnalysis = fetched.mimeType;
        sourceUrl = selectedResult.pageUrl || selectedResult.url;
      }

      // Create the clip document
      const clipId = await createClip({
        sourceUrl,
        imageUrl: finalImageUrl,
        thumbnailUrl: finalThumbnailUrl,
        title: uploaded.title,
        clipType: 'inspiration',
        clipContext: {
          module: 'design-manager',
          triggeredFrom: 'manual-upload',
        },
        linkages: [],
        analysisStatus: 'analyzing',
        tags: bestGuessLabels.slice(0, 5),
        syncStatus: 'synced',
        createdBy: user.uid,
        // Manual upload fields
        uploadSource: 'manual-upload',
        originalUploadUrl: uploaded.imageUrl,
        selectedFromSearch: isFromSearch,
        reverseSearchResults: searchResults.slice(0, 10),
        projectId,
        ...(designItemId ? { designItemId } : {}),
      } as any);

      setCreatedClipId(clipId);

      // Link to design item if provided
      if (designItemId) {
        await linkClipToDesignItem(clipId, projectId, designItemId);
      }

      // Trigger AI analysis via the analyzeClip cloud function
      const analyzeClipFn = httpsCallable<
        { imageBase64: string; imageMimeType: string; clipId: string; title: string; sourceUrl: string },
        { success: boolean; analysis: ClipAIAnalysis }
      >(functions, 'analyzeClip');

      const analysisResponse = await analyzeClipFn({
        imageBase64: imageBase64ForAnalysis,
        imageMimeType: imageMimeForAnalysis,
        clipId,
        title: uploaded.title,
        sourceUrl,
      });

      if (analysisResponse.data.success && analysisResponse.data.analysis) {
        setAnalysisResult(analysisResponse.data.analysis);
        await updateClip(clipId, { analysisStatus: 'completed' });
      }

      setIsAnalyzing(false);
      setStep('complete');
      return clipId;
    } catch (err) {
      console.error('Analyze failed:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setIsAnalyzing(false);
      return null;
    }
  }, [user?.uid, projectId, designItemId, selectedResult, usingOriginal, searchResults, bestGuessLabels]);

  /**
   * Skip search entirely — upload and analyze the original directly.
   */
  const skipSearch = useCallback(async (): Promise<string | null> => {
    setUsingOriginal(true);
    setSelectedResult(null);
    // Directly go to analyze with original
    return confirmAndAnalyze();
  }, [confirmAndAnalyze]);

  /**
   * Reset all state for a fresh upload.
   */
  const reset = useCallback(() => {
    setStep('upload');
    setError(null);
    uploadedDataRef.current = null;
    setSearchResults([]);
    setWebEntities([]);
    setBestGuessLabels([]);
    setIsSearching(false);
    setSelectedResult(null);
    setUsingOriginal(false);
    setIsAnalyzing(false);
    setAnalysisResult(null);
    setCreatedClipId(null);
  }, []);

  return {
    step,
    error,
    uploadPhoto,
    searchResults,
    webEntities,
    bestGuessLabels,
    isSearching,
    selectedResult,
    selectResult,
    useOriginal,
    confirmAndAnalyze,
    isAnalyzing,
    analysisResult,
    createdClipId,
    skipSearch,
    reset,
  };
}
