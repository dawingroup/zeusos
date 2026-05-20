/**
 * Product Research Cloud Function
 *
 * Accepts an uploaded image or product URL and uses Google Search grounding
 * + Gemini AI to research and extract full product details including pricing.
 *
 * This powers the "Manual Clip" feature for sites that block the Clipper extension.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const vision = require('@google-cloud/vision');
const admin = require('firebase-admin');
const { logger } = require('firebase-functions/v2');
const { parseGeminiJSON } = require('../intelligence/intelligenceUtils');
const { checkRateLimit } = require('../utils/rateLimiter');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const visionClient = new vision.ImageAnnotatorClient();
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// ============================================
// Product Research Prompt
// ============================================

const PRODUCT_RESEARCH_PROMPT = `You are a product research specialist for Dawin Group, a custom millwork and furniture manufacturing company in East Africa. We source materials, hardware, and furnishings from global suppliers.

Using Google Search, research this product thoroughly and extract detailed commercial information.

**PRODUCT DETAILS:**
- Product name (specific, commercial name)
- Brand / manufacturer
- Brief description (1-2 sentences)
- Product category (e.g., sheet-goods, solid-wood, hardware, edge-banding, finishing, furniture, lighting, fabric, stone, metal, other)

**PRICING:**
- Unit price (numeric amount)
- Currency (USD, EUR, GBP, KES, etc.)
- Price formatted (e.g., "$149.99")
- Price per unit (e.g., per piece, per sqft, per linear meter)

**SPECIFICATIONS:**
- Materials used (list all: wood species, metal type, fabric, etc.)
- Colors available (hex codes if possible)
- Dimensions (width, height, depth/thickness in mm)
- SKU or model number
- Weight if available

**SOURCE & SUPPLIER:**
- Product page URL (most authoritative/official source)
- Best product image URL (high-resolution, direct image link)
- Supplier or retailer name
- Manufacturer website if different from supplier

Return ONLY a JSON object (no markdown, no explanation):
{
  "name": "Product Name",
  "brand": "Brand Name",
  "description": "Brief description",
  "category": "category-slug",
  "price": {
    "amount": 149.99,
    "currency": "USD",
    "formatted": "$149.99",
    "unit": "piece"
  },
  "materials": ["material1", "material2"],
  "colors": ["#hex1", "#hex2"],
  "dimensions": {
    "width": null,
    "height": null,
    "depth": null,
    "unit": "mm"
  },
  "sku": "SKU-123",
  "sourceUrl": "https://...",
  "imageUrl": "https://...",
  "supplier": "Supplier Name",
  "manufacturerUrl": "https://...",
  "confidence": 0.85,
  "searchSources": ["https://source1.com", "https://source2.com"]
}

Set confidence between 0-1 based on how certain you are about the data. If a field cannot be determined, use null.`;

/**
 * Fetch URL metadata (og:image, title, description) by scraping the page HTML.
 * This extracts product images that Gemini cannot find via search alone.
 */
async function fetchUrlMetadata(url, depth = 0) {
  const EMPTY = { ogImage: null, title: null, description: null, productImages: [] };
  const MAX_REDIRECTS = 3;
  const HARD_TIMEOUT_MS = 8000;

  if (depth > MAX_REDIRECTS) {
    logger.warn(`fetchUrlMetadata: too many redirects for ${url}`);
    return EMPTY;
  }

  const https = require('https');
  const http = require('http');

  return new Promise((resolve) => {
    let resolved = false;
    const done = (result) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };

    // Hard total timeout — guarantees the promise resolves
    const hardTimer = setTimeout(() => {
      logger.warn(`fetchUrlMetadata: hard timeout (${HARD_TIMEOUT_MS}ms) for ${url}`);
      if (req) {
        try { req.destroy(); } catch (_) { /* ignore */ }
      }
      done(EMPTY);
    }, HARD_TIMEOUT_MS);

    const protocol = url.startsWith('https') ? https : http;

    let req;
    try {
      req = protocol.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: 6000,
      }, (res) => {
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          res.resume();
          clearTimeout(hardTimer);
          fetchUrlMetadata(redirectUrl, depth + 1).then(done);
          return;
        }

        let html = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          html += chunk;
          if (html.length > 100000) {
            res.destroy();
          }
        });
        res.on('end', () => {
          clearTimeout(hardTimer);
          done(parseHtmlMetadata(html, url));
        });
        res.on('close', () => {
          // 'close' fires even if 'end' didn't (e.g. after res.destroy())
          clearTimeout(hardTimer);
          if (html.length > 0) {
            done(parseHtmlMetadata(html, url));
          } else {
            done(EMPTY);
          }
        });
        res.on('error', () => {
          clearTimeout(hardTimer);
          done(EMPTY);
        });
      });

      req.on('error', () => {
        clearTimeout(hardTimer);
        done(EMPTY);
      });
      req.on('timeout', () => {
        logger.warn(`fetchUrlMetadata: socket timeout for ${url}`);
        req.destroy();
        clearTimeout(hardTimer);
        done(EMPTY);
      });
    } catch (err) {
      clearTimeout(hardTimer);
      logger.warn(`fetchUrlMetadata: request error for ${url}:`, err.message);
      done(EMPTY);
    }
  });
}

/**
 * Parse HTML to extract metadata (og:image, product images, title, description).
 */
function parseHtmlMetadata(html, baseUrl) {
  const result = { ogImage: null, title: null, description: null, productImages: [] };

  // og:image
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogImageMatch) {
    result.ogImage = resolveUrl(ogImageMatch[1], baseUrl);
  }

  // twitter:image as fallback
  if (!result.ogImage) {
    const twitterMatch = html.match(/<meta[^>]*(?:name|property)=["']twitter:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']twitter:image["']/i);
    if (twitterMatch) {
      result.ogImage = resolveUrl(twitterMatch[1], baseUrl);
    }
  }

  // og:title
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if (ogTitleMatch) {
    result.title = decodeHtmlEntities(ogTitleMatch[1]);
  }

  // og:description
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
  if (ogDescMatch) {
    result.description = decodeHtmlEntities(ogDescMatch[1]);
  }

  // Fallback: <title> tag
  if (!result.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      result.title = decodeHtmlEntities(titleMatch[1].trim());
    }
  }

  // Extract product-like images (large images in the page)
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*/gi;
  let imgMatch;
  const seenUrls = new Set();
  while ((imgMatch = imgRegex.exec(html)) !== null && result.productImages.length < 5) {
    const src = resolveUrl(imgMatch[0].match(/src=["']([^"']+)["']/i)?.[1] || '', baseUrl);
    if (!src || seenUrls.has(src)) continue;
    seenUrls.add(src);

    // Filter for likely product images (skip tiny icons, tracking pixels, etc.)
    const imgTag = imgMatch[0].toLowerCase();
    const isSmall = /width=["']?[1-9]\d?["']?/i.test(imgTag) || /height=["']?[1-9]\d?["']?/i.test(imgTag);
    const isIcon = /icon|logo|sprite|pixel|track|badge|flag|avatar/i.test(src);
    if (!isSmall && !isIcon && /\.(jpg|jpeg|png|webp)/i.test(src)) {
      result.productImages.push(src);
    }
  }

  return result;
}

function resolveUrl(url, baseUrl) {
  if (!url) return null;
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url.startsWith('http') ? url : null;
  }
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

/**
 * Run reverse image search via Google Cloud Vision to get product context.
 */
async function getImageContext(imageBase64) {
  try {
    const request = {
      image: {
        content: Buffer.from(imageBase64, 'base64'),
      },
      features: [{ type: 'WEB_DETECTION' }],
    };

    const [result] = await visionClient.annotateImage(request);
    const webDetection = result.webDetection;

    if (!webDetection) {
      return { webEntities: [], bestGuessLabels: [], pageUrls: [] };
    }

    const webEntities = (webDetection.webEntities || [])
      .filter((e) => e.description)
      .slice(0, 10)
      .map((e) => ({ description: e.description, score: e.score || 0 }));

    const bestGuessLabels = (webDetection.bestGuessLabels || []).map(
      (l) => l.label
    );

    const pageUrls = (webDetection.pagesWithMatchingImages || [])
      .slice(0, 5)
      .map((p) => p.url)
      .filter(Boolean);

    return { webEntities, bestGuessLabels, pageUrls };
  } catch (err) {
    logger.warn('Vision API failed, continuing without image context:', err.message);
    return { webEntities: [], bestGuessLabels: [], pageUrls: [] };
  }
}

/**
 * researchProduct - Callable Cloud Function
 *
 * Accepts an image (base64) or product URL, researches the product
 * using Google Search + Gemini, and returns structured product data.
 */
exports.researchProduct = onCall(
  {
    secrets: [GEMINI_API_KEY],
    cors: true,
    timeoutSeconds: 120,
    memory: '1GiB',
    maxInstances: 10,
  },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const userId = request.auth.uid;
    const { imageBase64, imageMimeType, productUrl, title } = request.data;

    if (!imageBase64 && !productUrl) {
      throw new HttpsError(
        'invalid-argument',
        'Either imageBase64 or productUrl is required'
      );
    }

    // Rate limit
    const rateResult = await checkRateLimit(userId, 'search', db);
    if (!rateResult.allowed) {
      throw new HttpsError(
        'resource-exhausted',
        `Rate limit exceeded. ${rateResult.remaining} requests remaining. Resets at ${rateResult.resetAt}`
      );
    }

    const apiKey = GEMINI_API_KEY.value();
    const genAI = new GoogleGenerativeAI(apiKey);

    // Initialize model with Google Search grounding
    let model;
    try {
      model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        tools: [{ googleSearch: {} }],
      });
    } catch (e) {
      logger.warn('Google Search grounding not available, falling back:', e.message);
      model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }

    try {
      // Build context based on input type
      let contextParts = [];
      let imageContext = null;

      if (imageBase64) {
        // Run reverse image search to get product identity context
        logger.info('Running reverse image search for product context...');
        imageContext = await getImageContext(imageBase64);

        // Add the image to the prompt
        contextParts.push({
          inlineData: {
            mimeType: imageMimeType || 'image/jpeg',
            data: imageBase64,
          },
        });

        // Build text context from Vision results
        let textContext = 'Research this product image.\n\n';
        if (imageContext.bestGuessLabels.length > 0) {
          textContext += `Image identified as: ${imageContext.bestGuessLabels.join(', ')}\n`;
        }
        if (imageContext.webEntities.length > 0) {
          textContext += `Related terms: ${imageContext.webEntities.map((e) => e.description).join(', ')}\n`;
        }
        if (imageContext.pageUrls.length > 0) {
          textContext += `Found on these pages: ${imageContext.pageUrls.join(', ')}\n`;
        }
        if (title) {
          textContext += `User says this is: "${title}"\n`;
        }
        textContext += '\n' + PRODUCT_RESEARCH_PROMPT;
        contextParts.push({ text: textContext });
      } else {
        // URL-based research: first fetch page metadata for images and context
        logger.info(`Fetching URL metadata from: ${productUrl}`);
        const urlMetadata = await fetchUrlMetadata(productUrl);
        logger.info(`URL metadata: ogImage=${!!urlMetadata.ogImage}, title=${urlMetadata.title || 'none'}, productImages=${urlMetadata.productImages.length}`);

        let textContext = `Research this product from: ${productUrl}\n`;
        if (title) {
          textContext += `User describes it as: "${title}"\n`;
        }
        if (urlMetadata.title) {
          textContext += `Page title: "${urlMetadata.title}"\n`;
        }
        if (urlMetadata.description) {
          textContext += `Page description: "${urlMetadata.description}"\n`;
        }
        if (urlMetadata.ogImage) {
          textContext += `Page product image (og:image): ${urlMetadata.ogImage}\n`;
        }
        if (urlMetadata.productImages.length > 0) {
          textContext += `Other images found on page: ${urlMetadata.productImages.slice(0, 3).join(', ')}\n`;
        }
        textContext += '\nUse Google Search to find additional product information, pricing, and specifications.\n';
        textContext += 'IMPORTANT: For the imageUrl field, use the og:image URL or one of the page images listed above if available.\n\n';
        textContext += PRODUCT_RESEARCH_PROMPT;
        contextParts.push({ text: textContext });

        // Store the best image from URL metadata as fallback
        imageContext = {
          urlMetadata,
        };
      }

      // Call Gemini with search grounding
      logger.info('Calling Gemini with Google Search grounding...');
      const result = await model.generateContent(contextParts);
      const response = result.response;
      const text = response.text();

      logger.info('Gemini response received, parsing...');

      // Parse the JSON response
      const research = parseGeminiJSON(text);

      if (!research) {
        throw new Error('Failed to parse product research from AI response');
      }

      // Determine best image URL (Gemini response → og:image → page images)
      let bestImageUrl = research.imageUrl || null;
      if (!bestImageUrl && imageContext?.urlMetadata) {
        bestImageUrl = imageContext.urlMetadata.ogImage
          || (imageContext.urlMetadata.productImages && imageContext.urlMetadata.productImages[0])
          || null;
      }

      // Ensure required fields have defaults
      const normalizedResearch = {
        name: research.name || title || 'Unknown Product',
        brand: research.brand || null,
        description: research.description || null,
        category: research.category || 'other',
        price: research.price || null,
        materials: Array.isArray(research.materials) ? research.materials : [],
        colors: Array.isArray(research.colors) ? research.colors : [],
        dimensions: research.dimensions || null,
        sku: research.sku || null,
        sourceUrl: research.sourceUrl || productUrl || null,
        imageUrl: bestImageUrl,
        supplier: research.supplier || null,
        manufacturerUrl: research.manufacturerUrl || null,
        confidence: typeof research.confidence === 'number' ? research.confidence : 0.5,
        searchSources: Array.isArray(research.searchSources) ? research.searchSources : [],
      };

      // Include Vision context if available
      const visionContext = imageContext?.webEntities
        ? {
            webEntities: imageContext.webEntities,
            bestGuessLabels: imageContext.bestGuessLabels,
          }
        : null;

      logger.info(`Product research complete: "${normalizedResearch.name}" (confidence: ${normalizedResearch.confidence})`);

      return {
        success: true,
        research: normalizedResearch,
        visionContext,
      };
    } catch (err) {
      logger.error('Product research failed:', err);
      throw new HttpsError(
        'internal',
        `Product research failed: ${err.message}`
      );
    }
  }
);
