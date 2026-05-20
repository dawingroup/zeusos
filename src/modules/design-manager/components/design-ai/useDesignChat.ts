/**
 * Design Chat Hook
 * Manages chat state and API calls for design AI assistant
 *
 * Features:
 * - Real-time chat with Gemini AI for design assistance
 * - Clipper library integration (attach clips for AI assessment)
 * - Persistent chat history per design item (survives page reloads)
 * - Write-back agreed parameters to design item indexes
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { updateDesignItem } from '@/modules/design-manager/services/firestore';
import type { DesignClip, ClipAIAnalysis } from '@/subsidiaries/finishes/clipper/types';
import type { ConstructionMethod, JoineryType } from '@/modules/design-manager/types';

const API_BASE = 'https://api-okekivpl2a-uc.a.run.app';

// ============================================
// Types
// ============================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  imageUrl?: string;
  metadata?: ChatMessageMetadata;
}

export interface ChatMessageMetadata {
  imageAnalysis?: ImageAnalysis;
  featureRecommendations?: string[];
  modelUsed?: string;
  suggestedParameters?: SuggestedParameters;
  appliedParameters?: boolean;
  clipRef?: ClipReference;
}

export interface ClipReference {
  clipId: string;
  title: string;
  imageUrl: string;
  thumbnailUrl?: string;
  clipType: string;
  aiAnalysis?: ClipAIAnalysis;
  materials?: string[];
  dimensions?: {
    width?: number;
    height?: number;
    depth?: number;
    unit: string;
  };
}

export interface ImageAnalysis {
  styleElements: string[];
  detectedMaterials: string[];
  colorPalette: string[];
  constructionDetails: string[];
  suggestedFeatures: string[];
}

export interface SuggestedParameters {
  description?: string;
  dimensions?: {
    width?: number;
    height?: number;
    depth?: number;
    unit?: string;
  };
  primaryMaterial?: {
    name: string;
    type: string;
    thickness?: number;
  };
  finish?: {
    type: string;
    color?: string;
    sheen?: string;
  };
  hardware?: Array<{
    name: string;
    quantity: number;
    category?: string;
  }>;
  constructionMethod?: ConstructionMethod;
  joineryTypes?: JoineryType[];
  awiGrade?: 'economy' | 'custom' | 'premium';
  specialRequirements?: string[];
  confidence?: number;
  reasoning?: string;
}

export interface UsageMetadata {
  inputTokens: number;
  outputTokens: number;
  modelUsed: string;
}

interface UseDesignChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  sendMessage: (message: string, imageData?: string) => Promise<void>;
  attachClip: (clip: DesignClip) => Promise<void>;
  applyParameters: (messageId: string, params: SuggestedParameters) => Promise<void>;
  isApplyingParams: boolean;
  clearError: () => void;
  usageStats: UsageMetadata | null;
}

// ============================================
// Firestore persistence helpers
// ============================================

const CONVERSATIONS_COLLECTION = 'designItemConversations';

interface FirestoreMessage {
  role: string;
  content: string;
  timestamp: Timestamp | ReturnType<typeof serverTimestamp>;
  imageUrl?: string;
  metadata?: ChatMessageMetadata;
}

async function ensureConversationDoc(designItemId: string, projectId: string) {
  const ref = doc(db, CONVERSATIONS_COLLECTION, designItemId);
  try {
    await setDoc(ref, {
      designItemId,
      projectId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      messages: [],
    }, { merge: true });
  } catch {
    // Doc may already exist, merge handles this
  }
}

/**
 * Recursively strip undefined values from an object so Firestore doesn't reject it.
 * Preserves Firestore Timestamp instances and other class objects.
 */
function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined) as unknown as T;
  // Preserve class instances (Timestamp, Date, etc.) — only clean plain objects
  if (obj.constructor && obj.constructor !== Object) return obj;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value !== undefined) {
      cleaned[key] = stripUndefined(value);
    }
  }
  return cleaned as T;
}

async function appendMessages(designItemId: string, msgs: FirestoreMessage[]) {
  const ref = doc(db, CONVERSATIONS_COLLECTION, designItemId);
  await updateDoc(ref, {
    messages: arrayUnion(...msgs.map(stripUndefined)),
    updatedAt: serverTimestamp(),
  });
}

// ============================================
// Hook
// ============================================

export function useDesignChat(
  designItemId: string,
  projectId: string,
  userId?: string
): UseDesignChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isApplyingParams, setIsApplyingParams] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usageStats, setUsageStats] = useState<UsageMetadata | null>(null);
  const initializedRef = useRef(false);

  // Load and subscribe to conversation from Firestore
  useEffect(() => {
    if (!designItemId) {
      setIsLoading(false);
      return;
    }

    // Ensure conversation doc exists
    if (!initializedRef.current) {
      ensureConversationDoc(designItemId, projectId);
      initializedRef.current = true;
    }

    const conversationRef = doc(db, CONVERSATIONS_COLLECTION, designItemId);

    const unsubscribe = onSnapshot(conversationRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const loadedMessages: ChatMessage[] = (data.messages || []).map((msg: any, index: number) => ({
          id: `${designItemId}-${index}`,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp?.toDate?.() || new Date(),
          imageUrl: msg.imageUrl,
          metadata: msg.metadata,
        }));
        setMessages(loadedMessages);
      } else {
        setMessages([]);
      }
      setIsLoading(false);
    }, (err) => {
      console.error('Error loading conversation:', err);
      setError('Failed to load conversation');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [designItemId, projectId]);

  // Send a chat message (with optional image)
  const sendMessage = useCallback(async (message: string, imageData?: string) => {
    if (!message.trim() && !imageData) return;

    setIsSending(true);
    setError(null);

    // Optimistically add user message
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: message || '[Image uploaded]',
      timestamp: new Date(),
      imageUrl: imageData,
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Persist user message to Firestore
      const userFirestoreMsg: FirestoreMessage = {
        role: 'user',
        content: message || '[Image uploaded]',
        timestamp: Timestamp.now(),
        imageUrl: imageData,
      };
      await appendMessages(designItemId, [userFirestoreMsg]);

      const response = await fetch(`${API_BASE}/ai/design-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designItemId,
          projectId,
          message,
          imageData,
          conversationHistory: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
          })),
          userId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to send message');
      }

      // Persist assistant response to Firestore
      const assistantMetadata: ChatMessageMetadata = {
        imageAnalysis: result.imageAnalysis,
        featureRecommendations: result.featureRecommendations,
        modelUsed: result.usageMetadata?.modelUsed,
        suggestedParameters: result.suggestedParameters,
      };

      const assistantFirestoreMsg: FirestoreMessage = {
        role: 'assistant',
        content: result.text || result.message,
        timestamp: Timestamp.now(),
        metadata: assistantMetadata,
      };
      await appendMessages(designItemId, [assistantFirestoreMsg]);

      setUsageStats(result.usageMetadata);

    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'Failed to send message');
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setIsSending(false);
    }
  }, [designItemId, projectId, messages, userId]);

  // Attach a clip from the clipper library to the conversation
  const attachClip = useCallback(async (clip: DesignClip) => {
    setIsSending(true);
    setError(null);

    const clipRef: ClipReference = {
      clipId: clip.id,
      title: clip.title,
      imageUrl: clip.imageUrl,
      thumbnailUrl: clip.thumbnailUrl,
      clipType: clip.clipType,
      aiAnalysis: clip.aiAnalysis,
      materials: clip.materials,
      dimensions: clip.dimensions,
    };

    // Build a descriptive message about the clip
    const clipDescription = buildClipDescription(clip);

    const clipMessage: ChatMessage = {
      id: `clip-${Date.now()}`,
      role: 'user',
      content: clipDescription,
      timestamp: new Date(),
      imageUrl: clip.imageUrl,
      metadata: { clipRef },
    };
    setMessages(prev => [...prev, clipMessage]);

    try {
      // Persist clip message to Firestore
      const clipFirestoreMsg: FirestoreMessage = {
        role: 'user',
        content: clipDescription,
        timestamp: Timestamp.now(),
        imageUrl: clip.imageUrl,
        metadata: { clipRef },
      };
      await appendMessages(designItemId, [clipFirestoreMsg]);

      // Send to AI with clip context
      const response = await fetch(`${API_BASE}/ai/design-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designItemId,
          projectId,
          message: clipDescription,
          imageData: clip.imageUrl,
          clipContext: {
            clipId: clip.id,
            title: clip.title,
            clipType: clip.clipType,
            aiAnalysis: clip.aiAnalysis,
            materials: clip.materials,
            dimensions: clip.dimensions,
            price: clip.price,
            brand: clip.brand,
          },
          conversationHistory: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
          })),
          userId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to analyze clip');
      }

      // Persist assistant response
      const assistantMetadata: ChatMessageMetadata = {
        imageAnalysis: result.imageAnalysis,
        featureRecommendations: result.featureRecommendations,
        modelUsed: result.usageMetadata?.modelUsed,
        suggestedParameters: result.suggestedParameters,
      };

      const assistantFirestoreMsg: FirestoreMessage = {
        role: 'assistant',
        content: result.text || result.message,
        timestamp: Timestamp.now(),
        metadata: assistantMetadata,
      };
      await appendMessages(designItemId, [assistantFirestoreMsg]);

      setUsageStats(result.usageMetadata);

    } catch (err: any) {
      console.error('Error attaching clip:', err);
      setError(err.message || 'Failed to analyze clip');
      setMessages(prev => prev.filter(m => m.id !== clipMessage.id));
    } finally {
      setIsSending(false);
    }
  }, [designItemId, projectId, messages, userId]);

  // Apply suggested parameters to the design item
  const applyParameters = useCallback(async (messageId: string, params: SuggestedParameters) => {
    if (!designItemId || !projectId || !userId) return;

    setIsApplyingParams(true);
    setError(null);

    try {
      // Build partial DesignParameters update from suggestions
      const parameterUpdates: Record<string, any> = {};

      if (params.dimensions) {
        parameterUpdates['parameters.dimensions'] = {
          width: params.dimensions.width || null,
          height: params.dimensions.height || null,
          depth: params.dimensions.depth || null,
          unit: params.dimensions.unit === 'inches' ? 'inches' : 'mm',
        };
      }

      if (params.primaryMaterial) {
        parameterUpdates['parameters.primaryMaterial'] = {
          id: `ai-suggested-${Date.now()}`,
          name: params.primaryMaterial.name,
          type: params.primaryMaterial.type || 'other',
          thickness: params.primaryMaterial.thickness || 0,
          supplier: null,
          sku: null,
          grainDirection: false,
          estimatedCostPerUnit: null,
        };
      }

      if (params.finish) {
        parameterUpdates['parameters.finish'] = {
          type: params.finish.type || 'none',
          color: params.finish.color || null,
          sheen: params.finish.sheen || null,
          coats: null,
          brand: null,
          productCode: null,
        };
      }

      if (params.hardware && params.hardware.length > 0) {
        parameterUpdates['parameters.hardware'] = params.hardware.map((hw, i) => ({
          id: `ai-hw-${Date.now()}-${i}`,
          name: hw.name,
          category: hw.category || 'other',
          quantity: hw.quantity,
          supplier: null,
          sku: null,
          estimatedCostPerUnit: null,
        }));
      }

      if (params.constructionMethod) {
        parameterUpdates['parameters.constructionMethod'] = params.constructionMethod;
      }

      if (params.joineryTypes && params.joineryTypes.length > 0) {
        parameterUpdates['parameters.joineryTypes'] = params.joineryTypes;
      }

      if (params.awiGrade) {
        parameterUpdates['parameters.awiGrade'] = params.awiGrade;
      }

      if (params.specialRequirements && params.specialRequirements.length > 0) {
        parameterUpdates['parameters.specialRequirements'] = params.specialRequirements;
      }

      if (params.description) {
        parameterUpdates.description = params.description;
      }

      // Write to design item
      await updateDesignItem(projectId, designItemId, parameterUpdates as any, userId);

      // Mark this message's parameters as applied in conversation history
      const conversationRef = doc(db, CONVERSATIONS_COLLECTION, designItemId);
      const snapshot = await (await import('firebase/firestore')).getDoc(conversationRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        const msgs = [...(data.messages || [])];
        // Find the message by index (messageId = designItemId-index)
        const msgIndex = parseInt(messageId.split('-').pop() || '-1', 10);
        if (msgIndex >= 0 && msgIndex < msgs.length && msgs[msgIndex].metadata) {
          msgs[msgIndex].metadata.appliedParameters = true;
          await updateDoc(conversationRef, { messages: msgs, updatedAt: serverTimestamp() });
        }
      }

      // Add a system message confirming the write-back
      const confirmMsg: FirestoreMessage = {
        role: 'system',
        content: 'Parameters applied to design item successfully.',
        timestamp: Timestamp.now(),
        metadata: { appliedParameters: true },
      };
      await appendMessages(designItemId, [confirmMsg]);

    } catch (err: any) {
      console.error('Error applying parameters:', err);
      setError(err.message || 'Failed to apply parameters to design item');
    } finally {
      setIsApplyingParams(false);
    }
  }, [designItemId, projectId, userId]);

  const clearError = useCallback(() => setError(null), []);

  return {
    messages,
    isLoading,
    isSending,
    error,
    sendMessage,
    attachClip,
    applyParameters,
    isApplyingParams,
    clearError,
    usageStats,
  };
}

// ============================================
// Helpers
// ============================================

function buildClipDescription(clip: DesignClip): string {
  const parts: string[] = [`[Clip: ${clip.title}]`];

  if (clip.clipType) {
    parts.push(`Type: ${clip.clipType}`);
  }

  if (clip.aiAnalysis) {
    if (clip.aiAnalysis.productType) {
      parts.push(`Product: ${clip.aiAnalysis.productType}`);
    }
    if (clip.aiAnalysis.style) {
      parts.push(`Style: ${clip.aiAnalysis.style}`);
    }
    if (clip.aiAnalysis.primaryMaterials?.length) {
      parts.push(`Materials: ${clip.aiAnalysis.primaryMaterials.join(', ')}`);
    }
    if (clip.aiAnalysis.millworkAssessment) {
      const mw = clip.aiAnalysis.millworkAssessment;
      parts.push(`Complexity: ${mw.complexity}`);
      if (mw.keyFeatures?.length) {
        parts.push(`Key features: ${mw.keyFeatures.join(', ')}`);
      }
    }
  }

  if (clip.materials?.length) {
    parts.push(`Detected materials: ${clip.materials.join(', ')}`);
  }

  if (clip.dimensions) {
    const d = clip.dimensions;
    const dims = [d.width && `W:${d.width}`, d.height && `H:${d.height}`, d.depth && `D:${d.depth}`].filter(Boolean);
    if (dims.length) parts.push(`Dimensions: ${dims.join(' x ')} ${d.unit}`);
  }

  if (clip.brand) parts.push(`Brand: ${clip.brand}`);
  if (clip.price) parts.push(`Price: ${clip.price.formatted}`);

  parts.push('\nPlease assess this clip for the current design item. Analyze the style, materials, manufacturing requirements, and suggest how it could inform our design parameters.');

  return parts.join('\n');
}
