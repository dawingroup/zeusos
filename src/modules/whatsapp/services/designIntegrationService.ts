/**
 * Design Manager Integration Service
 * Share design materials, quotes, and files via WhatsApp
 */

import { sendWhatsAppMessage } from './whatsappApiService';
import type { SendMessagePayload } from '../types';

/**
 * Share a quote/proposal PDF via WhatsApp
 */
export async function shareQuoteViaWhatsApp(
  phoneNumber: string,
  quoteData: { url: string; fileName: string; description?: string },
  conversationId?: string
): Promise<void> {
  const payload: SendMessagePayload = {
    conversationId,
    phoneNumber,
    messageType: 'image',
    imageUrl: quoteData.url,
    imageCaption: quoteData.description || `Quote: ${quoteData.fileName}`,
  };
  await sendWhatsAppMessage(payload);
}

/**
 * Share a design file (image, document) via WhatsApp
 */
export async function shareDesignFileViaWhatsApp(
  phoneNumber: string,
  fileUrl: string,
  fileName: string,
  conversationId?: string
): Promise<void> {
  const payload: SendMessagePayload = {
    conversationId,
    phoneNumber,
    messageType: 'image',
    imageUrl: fileUrl,
    imageCaption: fileName,
  };
  await sendWhatsAppMessage(payload);
}

/**
 * Send a material details message via WhatsApp
 */
export async function shareMaterialViaWhatsApp(
  phoneNumber: string,
  material: { name: string; description?: string; imageUrl?: string; price?: string },
  conversationId?: string
): Promise<void> {
  if (material.imageUrl) {
    await sendWhatsAppMessage({
      conversationId,
      phoneNumber,
      messageType: 'image',
      imageUrl: material.imageUrl,
      imageCaption: `${material.name}${material.description ? `\n${material.description}` : ''}${material.price ? `\nPrice: ${material.price}` : ''}`,
    });
  } else {
    await sendWhatsAppMessage({
      conversationId,
      phoneNumber,
      messageType: 'text',
      text: `${material.name}${material.description ? `\n${material.description}` : ''}${material.price ? `\nPrice: ${material.price}` : ''}`,
    });
  }
}
