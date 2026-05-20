/**
 * Proxy Fetch Image Cloud Function
 * Fetches external images and returns them as base64
 */

const { onCall } = require('firebase-functions/v2/https');
const axios = require('axios');
const { logger } = require('firebase-functions/v2');

/**
 * Proxy Fetch Image
 * Fetches an external image URL and returns it as base64
 */
exports.proxyFetchImage = onCall(
  {
    cors: ['https://dawinos.web.app', 'https://dawinos.firebaseapp.com'],
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (request) => {
    const { imageUrl } = request.data;

    // Validate input
    if (!imageUrl) {
      logger.error('Missing imageUrl in request');
      throw new Error('imageUrl is required');
    }

    // Validate URL format
    try {
      new URL(imageUrl);
    } catch (error) {
      logger.error('Invalid URL format:', imageUrl);
      throw new Error('Invalid image URL format');
    }

    try {
      logger.info('Fetching image:', imageUrl);

      // Fetch the image
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 25000, // 25 second timeout
        maxContentLength: 10 * 1024 * 1024, // 10MB max
        headers: {
          'User-Agent': 'DawinOS/1.0 (Image Fetcher)',
          Accept: 'image/*',
        },
      });

      // Get MIME type from response
      const mimeType = response.headers['content-type'] || 'image/jpeg';

      // Validate that it's an image
      if (!mimeType.startsWith('image/')) {
        logger.error('Response is not an image:', mimeType);
        throw new Error('URL does not point to an image');
      }

      // Convert to base64
      const base64 = Buffer.from(response.data).toString('base64');
      const size = response.data.length;

      logger.info(`Successfully fetched image: ${size} bytes, type: ${mimeType}`);

      return {
        success: true,
        base64,
        mimeType,
        size,
      };
    } catch (error) {
      logger.error('Error fetching image:', error);

      if (error.code === 'ECONNABORTED') {
        throw new Error('Image fetch timeout - URL took too long to respond');
      }

      if (error.response?.status === 404) {
        throw new Error('Image not found (404)');
      }

      if (error.response?.status === 403) {
        throw new Error('Access denied to image (403)');
      }

      throw new Error(`Failed to fetch image: ${error.message}`);
    }
  }
);
