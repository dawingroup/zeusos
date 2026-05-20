/**
 * Reverse Image Search Cloud Function
 * Uses Google Vision API to perform reverse image search
 */

const { onCall } = require('firebase-functions/v2/https');
const vision = require('@google-cloud/vision');
const { logger } = require('firebase-functions/v2');

// Initialize Vision API client
const visionClient = new vision.ImageAnnotatorClient();

/**
 * Reverse Image Search
 * Performs reverse image search using Google Vision API
 */
exports.reverseImageSearch = onCall(
  {
    cors: ['https://dawinos.web.app', 'https://dawinos.firebaseapp.com'],
    maxInstances: 10,
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (request) => {
    const { imageBase64, imageMimeType } = request.data;

    // Validate input
    if (!imageBase64) {
      logger.error('Missing imageBase64 in request');
      throw new Error('imageBase64 is required');
    }

    try {
      logger.info('Starting reverse image search');

      // Prepare the image for Vision API
      // Create a proper request object with image content
      const request = {
        image: {
          content: Buffer.from(imageBase64, 'base64'),
        },
        features: [{ type: 'WEB_DETECTION' }],
      };

      // Perform web detection (reverse image search)
      const [result] = await visionClient.annotateImage(request);
      const webDetection = result.webDetection;

      if (!webDetection) {
        logger.warn('No web detection results found');
        return {
          success: true,
          matches: [],
          webEntities: [],
          bestGuessLabels: [],
          totalResultsFound: 0,
        };
      }

      // Extract matches with full size images
      const matches = (webDetection.fullMatchingImages || [])
        .concat(webDetection.partialMatchingImages || [])
        .slice(0, 20) // Limit to 20 results
        .map((img, index) => ({
          id: `match-${index}`,
          url: img.url,
          score: img.score || 0,
          source: 'vision-api',
        }));

      // Extract web entities
      const webEntities = (webDetection.webEntities || [])
        .slice(0, 10)
        .map((entity) => ({
          description: entity.description || '',
          score: entity.score || 0,
        }));

      // Extract best guess labels
      const bestGuessLabels = (webDetection.bestGuessLabels || []).map(
        (label) => label.label
      );

      // Also include pages with matching images
      const pagesWithMatching = webDetection.pagesWithMatchingImages || [];
      pagesWithMatching.slice(0, 10).forEach((page, index) => {
        if (page.fullMatchingImages?.[0]?.url) {
          matches.push({
            id: `page-match-${index}`,
            url: page.fullMatchingImages[0].url,
            score: 0.8,
            source: 'page-match',
            pageUrl: page.url,
            pageTitle: page.pageTitle,
          });
        }
      });

      logger.info(`Found ${matches.length} matches`);

      return {
        success: true,
        matches,
        webEntities,
        bestGuessLabels,
        totalResultsFound: matches.length,
      };
    } catch (error) {
      logger.error('Error in reverse image search:', error);
      throw new Error(`Failed to perform reverse image search: ${error.message}`);
    }
  }
);
