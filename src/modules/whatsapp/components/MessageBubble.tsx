/**
 * MessageBubble - Renders a single WhatsApp message
 * Left-aligned for inbound, right-aligned for outbound
 * Supports: text, template, image, document, location, interactive, greeting
 */

import {
  FileText,
  Download,
  MapPin,
  ExternalLink,
  LayoutTemplate,
  ThumbsUp,
  ThumbsDown,
  ListTree,
  Bot,
} from 'lucide-react';
import { WhatsAppStatusBadge } from './WhatsAppStatusBadge';
import type { WhatsAppMessage } from '../types';

interface Props {
  message: WhatsAppMessage;
}

function formatTime(timestamp: { toDate?: () => Date } | null | undefined): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp as unknown as string);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp: { toDate?: () => Date } | null | undefined): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp as unknown as string);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Render the body of a template message by substituting {{1}}, {{2}}, etc.
 * with the stored templateParams, and converting *bold* markers to <strong>.
 */
function renderTemplateBody(textContent: string, params?: Record<string, string>): string {
  let text = textContent;

  // Strip the "[Template: xxx]" wrapper if present
  const bracketMatch = text.match(/^\[Template:\s*[^\]]+\]$/);
  if (bracketMatch) return '';

  // Substitute params
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
  }

  return text;
}

/**
 * Parse WhatsApp-style formatting: *bold*, _italic_, ~strikethrough~
 * Returns React elements.
 */
function formatWhatsAppText(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  // Match *bold*, _italic_, ~strikethrough~
  const regex = /(\*[^*]+\*)|(_[^_]+_)|(~[^~]+~)/g;
  let lastIndex = 0;
  let match;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const raw = match[0];
    const inner = raw.slice(1, -1);
    if (raw.startsWith('*')) {
      parts.push(<strong key={keyIdx++}>{inner}</strong>);
    } else if (raw.startsWith('_')) {
      parts.push(<em key={keyIdx++}>{inner}</em>);
    } else if (raw.startsWith('~')) {
      parts.push(<s key={keyIdx++}>{inner}</s>);
    }
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

export function MessageBubble({ message }: Props) {
  const isOutbound = message.direction === 'outbound';
  const isSystem = message.senderType === 'system' || message.messageType === 'greeting';

  // System / greeting messages: centered, muted
  if (isSystem) {
    return (
      <div className="flex justify-center mb-2">
        <div className="max-w-[85%] bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-0.5">
            <Bot className="w-3 h-3 text-blue-400" />
            <span className="text-[10px] font-medium text-blue-400 uppercase tracking-wide">
              {message.messageType === 'greeting' ? 'Auto-reply' : 'System'}
            </span>
          </div>
          {message.textContent && (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{message.textContent}</p>
          )}
          <span className="text-[10px] text-gray-400 mt-1 block">
            {formatTime(message.sentAt)}
          </span>
        </div>
      </div>
    );
  }

  // Template message — rich rendering
  if (message.messageType === 'template') {
    const hasRichBody = message.textContent && !message.textContent.match(/^\[Template:\s*[^\]]+\]$/);
    const bodyText = hasRichBody
      ? renderTemplateBody(message.textContent!, message.templateParams) || message.textContent!
      : '';
    const buttons = message.templateButtons || [];
    const footer = message.templateFooter;
    const headerText = message.templateHeaderText;

    return (
      <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2`}>
        <div
          className={`max-w-[75%] rounded-lg overflow-hidden ${
            isOutbound
              ? 'bg-green-100 text-green-900 rounded-br-none'
              : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
          }`}
        >
          {/* Sender name */}
          {isOutbound && message.senderName && (
            <p className="text-xs font-medium text-green-700 px-3 pt-2">{message.senderName}</p>
          )}

          {/* Template header image (if stored) */}
          {message.imageUrl && (
            <img
              src={message.imageUrl}
              alt="Template header"
              className="w-full h-32 object-cover"
            />
          )}

          {/* Template header text (non-image) */}
          {!message.imageUrl && headerText && (
            <div className="px-3 pt-2">
              <p className="text-sm font-semibold text-gray-800">{headerText}</p>
            </div>
          )}

          {/* Template badge */}
          <div className="px-3 pt-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-indigo-100 text-indigo-700 rounded px-1.5 py-0.5">
              <LayoutTemplate className="w-2.5 h-2.5" />
              {(message.templateName || 'template').replace(/_/g, ' ')}
            </span>
          </div>

          {/* Template body */}
          <div className="px-3 pt-1.5 pb-1">
            {bodyText ? (
              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                {formatWhatsAppText(bodyText)}
              </p>
            ) : message.templateParams && Object.keys(message.templateParams).length > 0 ? (
              <div className="text-sm text-gray-700 space-y-0.5">
                {Object.entries(message.templateParams).map(([key, value]) => (
                  <p key={key}>
                    <span className="text-gray-400 text-xs mr-1">{`{{${key}}}`}</span>
                    {value}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">Template message sent</p>
            )}
          </div>

          {/* Footer */}
          {footer && (
            <p className="text-[10px] text-gray-400 px-3 pb-1">{footer}</p>
          )}

          {/* Template buttons — use stored labels, or fall back to interactive components */}
          {buttons.length > 0 ? (
            <div className="flex gap-1.5 px-3 pb-2 pt-0.5 border-t border-gray-200/50 mt-1">
              {buttons.map((label, idx) => {
                const isApprove = /approve|accept|yes|confirm/i.test(label);
                const isReject = /reject|decline|no|cancel/i.test(label);
                return (
                  <span
                    key={idx}
                    className={`flex-1 text-center py-1.5 rounded border text-xs font-medium flex items-center justify-center gap-1 ${
                      isApprove
                        ? 'border-green-300 bg-green-50 text-green-700'
                        : isReject
                        ? 'border-red-200 bg-red-50 text-red-600'
                        : 'border-gray-200 bg-gray-50 text-gray-600'
                    }`}
                  >
                    {isApprove && <ThumbsUp className="w-3 h-3" />}
                    {isReject && <ThumbsDown className="w-3 h-3" />}
                    {label}
                  </span>
                );
              })}
            </div>
          ) : Array.isArray(message.interactiveBody?.templateComponents) ? (
            <TemplateButtons components={message.interactiveBody.templateComponents as Record<string, unknown>[]} />
          ) : null}

          {/* Timestamp + status */}
          <div className={`flex items-center gap-1 px-3 pb-2 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-gray-500">{formatTime(message.sentAt)}</span>
            {isOutbound && <WhatsAppStatusBadge status={message.status} />}
          </div>

          {/* Error */}
          {message.status === 'failed' && message.errorMessage && (
            <p className="text-xs text-red-500 px-3 pb-2">{message.errorMessage}</p>
          )}
        </div>
      </div>
    );
  }

  // Document message
  if (message.messageType === 'document') {
    const filename = message.documentFilename
      || message.textContent?.replace(/^\[Document:\s*|\]$/g, '')
      || 'Document';
    const docUrl = message.documentUrl;

    return (
      <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2`}>
        <div
          className={`max-w-[75%] rounded-lg px-3 py-2 ${
            isOutbound
              ? 'bg-green-100 text-green-900 rounded-br-none'
              : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
          }`}
        >
          {isOutbound && message.senderName && (
            <p className="text-xs font-medium text-green-700 mb-1">{message.senderName}</p>
          )}

          {/* Document card */}
          <div className="flex items-center gap-2.5 bg-white/60 border border-gray-200 rounded-lg p-2.5">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{filename}</p>
              <p className="text-[10px] text-gray-400 uppercase">
                {filename.split('.').pop() || 'PDF'}
              </p>
            </div>
            {docUrl && (
              <a
                href={docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                title="Download"
              >
                <Download className="w-4 h-4 text-gray-500" />
              </a>
            )}
          </div>

          {/* Caption */}
          {message.documentCaption && (
            <p className="text-sm text-gray-700 mt-1.5 whitespace-pre-wrap">
              {message.documentCaption}
            </p>
          )}

          {/* Timestamp + status */}
          <div className={`flex items-center gap-1 mt-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-gray-500">{formatTime(message.sentAt)}</span>
            {isOutbound && <WhatsAppStatusBadge status={message.status} />}
          </div>
          {message.status === 'failed' && message.errorMessage && (
            <p className="text-xs text-red-500 mt-1">{message.errorMessage}</p>
          )}
        </div>
      </div>
    );
  }

  // Location message
  if (message.messageType === 'location') {
    const lat = message.locationLatitude;
    const lng = message.locationLongitude;
    const mapUrl = lat && lng
      ? `https://www.google.com/maps?q=${lat},${lng}`
      : null;

    return (
      <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2`}>
        <div
          className={`max-w-[75%] rounded-lg overflow-hidden ${
            isOutbound
              ? 'bg-green-100 text-green-900 rounded-br-none'
              : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
          }`}
        >
          {isOutbound && message.senderName && (
            <p className="text-xs font-medium text-green-700 px-3 pt-2">{message.senderName}</p>
          )}

          {/* Map preview placeholder */}
          <div className="bg-emerald-50 p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              {message.locationName && (
                <p className="text-sm font-medium text-gray-900 truncate">{message.locationName}</p>
              )}
              {message.locationAddress && (
                <p className="text-xs text-gray-500 truncate">{message.locationAddress}</p>
              )}
              {!message.locationName && !message.locationAddress && lat && lng && (
                <p className="text-xs text-gray-500">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
              )}
            </div>
            {mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 hover:bg-emerald-100 rounded-lg transition-colors"
                title="Open in Google Maps"
              >
                <ExternalLink className="w-4 h-4 text-emerald-600" />
              </a>
            )}
          </div>

          {/* Timestamp + status */}
          <div className={`flex items-center gap-1 px-3 py-1.5 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-gray-500">{formatTime(message.sentAt)}</span>
            {isOutbound && <WhatsAppStatusBadge status={message.status} />}
          </div>
          {message.status === 'failed' && message.errorMessage && (
            <p className="text-xs text-red-500 px-3 pb-2">{message.errorMessage}</p>
          )}
        </div>
      </div>
    );
  }

  // Interactive message (buttons / lists)
  if (message.messageType === 'interactive') {
    const iType = message.interactiveType || 'message';

    return (
      <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2`}>
        <div
          className={`max-w-[75%] rounded-lg px-3 py-2 ${
            isOutbound
              ? 'bg-green-100 text-green-900 rounded-br-none'
              : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
          }`}
        >
          {isOutbound && message.senderName && (
            <p className="text-xs font-medium text-green-700 mb-0.5">{message.senderName}</p>
          )}

          <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-purple-100 text-purple-700 rounded px-1.5 py-0.5 mb-1">
            <ListTree className="w-2.5 h-2.5" />
            Interactive {iType !== 'message' ? `(${iType})` : ''}
          </span>

          {message.textContent && (
            <p className="text-sm whitespace-pre-wrap break-words">
              {formatWhatsAppText(message.textContent)}
            </p>
          )}

          {/* Render interactive buttons if available */}
          {message.interactiveBody && <InteractiveBody body={message.interactiveBody} />}

          <div className={`flex items-center gap-1 mt-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-gray-500">{formatTime(message.sentAt)}</span>
            {isOutbound && <WhatsAppStatusBadge status={message.status} />}
          </div>
          {message.status === 'failed' && message.errorMessage && (
            <p className="text-xs text-red-500 mt-1">{message.errorMessage}</p>
          )}
        </div>
      </div>
    );
  }

  // Default: text / image / fallback
  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 ${
          isOutbound
            ? 'bg-green-100 text-green-900 rounded-br-none'
            : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
        }`}
      >
        {/* Sender name for outbound messages */}
        {isOutbound && message.senderName && (
          <p className="text-xs font-medium text-green-700 mb-0.5">{message.senderName}</p>
        )}

        {/* Image */}
        {message.messageType === 'image' && message.imageUrl && (
          <div className="mb-1 -mx-1">
            <img
              src={message.imageUrl}
              alt={message.imageCaption || 'Image'}
              className="rounded max-w-full max-h-64 object-cover cursor-pointer"
              onClick={() => window.open(message.imageUrl!, '_blank')}
            />
            {message.imageCaption && (
              <p className="text-sm mt-1 mx-1">{message.imageCaption}</p>
            )}
          </div>
        )}

        {/* Text content */}
        {message.textContent && message.messageType !== 'image' && (
          <p className="text-sm whitespace-pre-wrap break-words">
            {formatWhatsAppText(message.textContent)}
          </p>
        )}
        {message.messageType === 'image' && !message.imageCaption && message.textContent && (
          <p className="text-sm whitespace-pre-wrap break-words">
            {formatWhatsAppText(message.textContent)}
          </p>
        )}

        {/* Timestamp and status */}
        <div className={`flex items-center gap-1 mt-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] text-gray-500">{formatTime(message.sentAt)}</span>
          {isOutbound && <WhatsAppStatusBadge status={message.status} />}
        </div>

        {/* Error message */}
        {message.status === 'failed' && message.errorMessage && (
          <p className="text-xs text-red-500 mt-1">{message.errorMessage}</p>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────

/** Renders quick-reply buttons from template components */
function TemplateButtons({ components }: { components: Record<string, unknown>[] }) {
  const buttons = components.filter((c) => c.type === 'button');
  if (buttons.length === 0) return null;

  return (
    <div className="flex gap-1.5 px-3 pb-2 pt-0.5">
      {buttons.map((btn, idx) => {
        const params = btn.parameters as { type?: string; payload?: string }[] | undefined;
        const payload = params?.[0]?.payload || '';
        const isApprove = payload.includes('approve');
        const isReject = payload.includes('reject');

        return (
          <span
            key={idx}
            className={`flex-1 text-center py-1.5 rounded border text-xs font-medium flex items-center justify-center gap-1 ${
              isApprove
                ? 'border-green-300 bg-green-50 text-green-700'
                : isReject
                ? 'border-red-200 bg-red-50 text-red-600'
                : 'border-gray-200 bg-gray-50 text-gray-600'
            }`}
          >
            {isApprove && <ThumbsUp className="w-3 h-3" />}
            {isReject && <ThumbsDown className="w-3 h-3" />}
            {typeof btn.sub_type === 'string' && btn.sub_type === 'quick_reply'
              ? `Button ${idx + 1}`
              : `Option ${idx + 1}`}
          </span>
        );
      })}
    </div>
  );
}

/** Renders interactive message body (buttons / list sections) */
function InteractiveBody({ body }: { body: Record<string, unknown> }) {
  // Button replies
  const action = body.action as Record<string, unknown> | undefined;
  if (!action) return null;

  const buttons = action.buttons as { reply?: { id?: string; title?: string } }[] | undefined;
  const sections = action.sections as { title?: string; rows?: { id?: string; title?: string; description?: string }[] }[] | undefined;

  return (
    <div className="mt-1.5">
      {buttons && buttons.length > 0 && (
        <div className="flex flex-col gap-1">
          {buttons.map((btn, idx) => (
            <span
              key={idx}
              className="text-center py-1.5 rounded border border-blue-200 bg-blue-50 text-xs font-medium text-blue-700"
            >
              {btn.reply?.title || `Button ${idx + 1}`}
            </span>
          ))}
        </div>
      )}
      {sections && sections.length > 0 && (
        <div className="space-y-1.5">
          {sections.map((section, sIdx) => (
            <div key={sIdx}>
              {section.title && (
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{section.title}</p>
              )}
              {section.rows?.map((row, rIdx) => (
                <div key={rIdx} className="py-1 border-b border-gray-100 last:border-0">
                  <p className="text-xs font-medium text-gray-800">{row.title}</p>
                  {row.description && <p className="text-[10px] text-gray-500">{row.description}</p>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Export for use by MessageThread to group messages by date
export { formatDate };
