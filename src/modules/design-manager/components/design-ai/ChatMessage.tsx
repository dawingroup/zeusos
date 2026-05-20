/**
 * Chat Message Component
 * Individual message bubble with support for images, clips, and parameter suggestions
 */

import { User, Sparkles } from 'lucide-react';
import type { ChatMessage as ChatMessageType, SuggestedParameters } from './useDesignChat';
import { ImageAnalysisCard } from './ImageAnalysisCard';
import { AgreedParametersPanel } from './AgreedParametersPanel';

interface ChatMessageProps {
  message: ChatMessageType;
  onApplyParameters?: (messageId: string, params: SuggestedParameters) => Promise<void>;
  isApplyingParams?: boolean;
}

/**
 * Simple markdown parser for chat messages
 * Converts **bold**, *italic*, `code`, and - lists to HTML
 */
function parseMarkdown(text: string): string {
  // Escape HTML to prevent XSS
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Convert **bold** to <strong>
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>');

  // Convert *italic* to <em> (but not if it's part of a list item)
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em class="italic text-gray-600">$1</em>');

  // Convert `code` to <code>
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-200 px-1 py-0.5 rounded text-xs font-mono">$1</code>');

  // Convert lines starting with - to list items
  const lines = html.split('\n');
  let inList = false;
  const processedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      if (!inList) {
        processedLines.push('<ul class="list-disc list-inside space-y-1 my-2">');
        inList = true;
      }
      processedLines.push(`<li class="text-sm">${trimmed.substring(2)}</li>`);
    } else {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      processedLines.push(line);
    }
  }
  if (inList) {
    processedLines.push('</ul>');
  }

  html = processedLines.join('\n');

  // Convert section headers (lines ending with :)
  html = html.replace(/^([A-Z][A-Z\s]+):$/gm, '<h4 class="font-semibold text-gray-900 mt-3 mb-1 text-sm">$1</h4>');

  return html;
}

export function ChatMessage({ message, onApplyParameters, isApplyingParams }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const clipRef = message.metadata?.clipRef;

  if (isSystem) {
    return (
      <div className="text-center py-2">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-blue-100' : 'bg-gradient-to-br from-purple-100 to-blue-100'
      }`}>
        {isUser ? (
          <User className="w-4 h-4 text-blue-600" />
        ) : (
          <Sparkles className="w-4 h-4 text-purple-600" />
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block px-4 py-2.5 rounded-2xl ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-800 rounded-bl-md'
        }`}>
          {/* Clip Reference Card (for user messages with attached clips) */}
          {clipRef && (
            <div className={`mb-2 flex items-center gap-2 p-2 rounded-lg ${
              isUser ? 'bg-blue-500/30' : 'bg-white/60'
            }`}>
              <img
                src={clipRef.thumbnailUrl || clipRef.imageUrl}
                alt={clipRef.title}
                className="w-12 h-12 rounded-md object-cover flex-shrink-0"
              />
              <div className="min-w-0 flex-1 text-left">
                <p className={`text-xs font-medium truncate ${isUser ? 'text-white' : 'text-gray-800'}`}>
                  {clipRef.title}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    isUser ? 'bg-blue-400/40 text-white' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {clipRef.clipType}
                  </span>
                  {clipRef.aiAnalysis?.primaryMaterials?.[0] && (
                    <span className={`text-[10px] ${isUser ? 'text-blue-200' : 'text-gray-500'}`}>
                      {clipRef.aiAnalysis.primaryMaterials[0]}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Image Preview (only if not a clip — clips show their own thumbnail above) */}
          {message.imageUrl && !clipRef && (
            <div className="mb-2">
              <img
                src={message.imageUrl}
                alt="Uploaded"
                className="max-w-full rounded-lg max-h-48 object-cover"
              />
            </div>
          )}

          {/* Text Content */}
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">
              {clipRef ? stripClipDescriptionForDisplay(message.content) : message.content}
            </p>
          ) : (
            <div
              className="text-sm prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }}
            />
          )}
        </div>

        {/* Image Analysis Card */}
        {message.metadata?.imageAnalysis && (
          <div className="mt-2">
            <ImageAnalysisCard analysis={message.metadata.imageAnalysis} />
          </div>
        )}

        {/* Feature Recommendations */}
        {message.metadata?.featureRecommendations && message.metadata.featureRecommendations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.metadata.featureRecommendations.map((rec, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs"
              >
                {rec}
              </span>
            ))}
          </div>
        )}

        {/* Suggested Parameters — Write-back Panel */}
        {message.metadata?.suggestedParameters && onApplyParameters && (
          <AgreedParametersPanel
            messageId={message.id}
            parameters={message.metadata.suggestedParameters}
            alreadyApplied={message.metadata.appliedParameters}
            onApply={onApplyParameters}
            isApplying={isApplyingParams || false}
          />
        )}

        {/* Timestamp */}
        <p className={`text-xs text-gray-400 mt-1 ${isUser ? 'text-right' : ''}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

/**
 * Strip the verbose clip description down to a short user-friendly display.
 * The full description is sent to the AI, but in the UI we show a cleaner version.
 */
function stripClipDescriptionForDisplay(content: string): string {
  const match = content.match(/^\[Clip: (.+?)\]/);
  if (match) {
    return `Attached clip: ${match[1]}`;
  }
  return content;
}
