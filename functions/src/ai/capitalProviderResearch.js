/**
 * Capital Provider Research Cloud Function
 *
 * AI-powered capital provider discovery and enrichment for Uganda/East Africa.
 *
 * Actions:
 *   'search-providers' — Gemini + Google Search to find providers matching a query
 *   'enrich-provider'  — Deep research on a specific provider's profile & products
 *   'enrich-product'   — Detailed product terms, requirements, and process
 *   'match-providers'  — Gemini search + Claude analysis to match providers to business needs
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ALLOWED_ORIGINS } = require('../config/cors');
const { parseJsonResponse } = require('../utils/geminiClient');
const claudeClient = require('../utils/claudeClient');

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// ============================================================================
// VALID ENUM VALUES (for prompt guidance)
// ============================================================================

const PRODUCT_TYPES = [
  'term_loan', 'overdraft', 'line_of_credit', 'asset_finance',
  'trade_finance', 'invoice_discounting', 'factoring', 'lpo_financing',
  'lease', 'hire_purchase', 'equity', 'convertible_note', 'grant',
  'dfi_loan', 'supplier_credit', 'microfinance',
];

const PROVIDER_TYPES = [
  'bank', 'dfi', 'government', 'investor', 'supplier', 'microfinance', 'fintech',
];

// ============================================================================
// PROMPTS
// ============================================================================

function buildProviderSearchPrompt(query, filters) {
  return `You are a financial market researcher specializing in Uganda and East Africa.

Search for capital providers (banks, DFIs, microfinance institutions, fintechs, government programs, grant-making bodies, development partners, tax incentive programs) matching this query: "${query}"

${filters?.providerType ? `Focus on provider type: ${filters.providerType}` : ''}
${filters?.productType ? `Looking for product type: ${filters.productType}` : ''}
${filters?.region ? `Region: ${filters.region}` : 'Region: Uganda / East Africa'}

IMPORTANT: Include ALL forms of capital including:
- Traditional debt (loans, overdrafts, credit lines)
- Asset-based financing (leasing, hire purchase, asset finance)
- Trade finance (LPO financing, invoice discounting, factoring)
- Equity and quasi-equity (equity investment, convertible notes)
- Grants and subsidies (government grants, donor-funded grants, matching grants)
- Tax incentives and rebates (UIA incentives, free zone benefits, export incentives)
- DFI concessional facilities (below-market-rate loans, technical assistance grants)

For EACH provider found, return structured JSON.
Valid providerType values: ${PROVIDER_TYPES.join(', ')}
Valid productType values: ${PRODUCT_TYPES.join(', ')}

{
  "providers": [
    {
      "name": "Provider Name",
      "providerType": "bank",
      "website": "https://...",
      "description": "Brief description",
      "specializations": ["SME lending", "trade finance"],
      "products": [
        {
          "name": "Product Name",
          "productType": "term_loan",
          "description": "Brief product description",
          "minAmount": null,
          "maxAmount": null,
          "currency": "UGX",
          "interestRate": null,
          "interestType": "reducing_balance",
          "tenorMinMonths": null,
          "tenorMaxMonths": null,
          "processingFee": null,
          "collateralRequired": true,
          "collateralTypes": [],
          "requirements": ["Audited financials", "Tax clearance"],
          "eligibility": "Brief eligibility summary"
        }
      ],
      "contactInfo": { "phone": "...", "email": "...", "address": "..." },
      "sectors": ["manufacturing", "agriculture"],
      "minRevenue": null,
      "minYearsInBusiness": null
    }
  ]
}

Guidelines:
- Focus on Uganda-based or East Africa-operating institutions
- Include commercial banks (Stanbic, dfcu, Centenary, etc.), DFIs (UDB, IFC, etc.), microfinance, and fintechs
- Include government agencies (UIA, UDC, Enterprise Uganda) offering grants, tax incentives, or subsidies
- Include development partners (USAID, EU, GIZ, World Bank) with grant programs for SMEs
- For grants: use productType "grant" and set interestRate to 0, collateralRequired to false
- For tax incentives: use providerType "government" and productType "grant"
- Only include verifiable information from search results
- Use null for unavailable numeric data
- Return ONLY valid JSON, no markdown.`;
}

function buildProviderEnrichmentPrompt(provider) {
  return `You are a financial market intelligence researcher.

Research the capital provider "${provider.name}"${provider.website ? ` (website: ${provider.website})` : ''} operating in Uganda/East Africa.
${provider.providerType ? `Provider type: ${provider.providerType}` : ''}

Find and return a comprehensive profile as valid JSON. Include ALL financial products they offer including loans, grants, subsidies, tax incentives, and any other forms of capital or financial support.
Valid providerType values: ${PROVIDER_TYPES.join(', ')}
Valid productType values: ${PRODUCT_TYPES.join(', ')}

{
  "fullName": "Official registered name",
  "providerType": "bank",
  "website": "https://...",
  "description": "Comprehensive description",
  "yearEstablished": 2000,
  "regulatedBy": "Bank of Uganda",
  "headquarters": { "address": "...", "city": "Kampala", "country": "Uganda" },
  "branches": [{ "name": "Branch Name", "city": "...", "phone": "..." }],
  "contactInfo": {
    "generalPhone": "...",
    "generalEmail": "...",
    "customerCarePhone": "...",
    "smeUnit": { "contactPerson": "...", "phone": "...", "email": "..." }
  },
  "specializations": ["SME lending", "trade finance"],
  "sectors": ["manufacturing", "agriculture", "services"],
  "products": [
    {
      "name": "Product Name",
      "productType": "term_loan",
      "description": "Detailed description",
      "minAmount": null,
      "maxAmount": null,
      "currency": "UGX",
      "interestRate": null,
      "interestType": "reducing_balance",
      "tenorMinMonths": null,
      "tenorMaxMonths": null,
      "processingFee": null,
      "collateralRequired": false,
      "collateralTypes": [],
      "requirements": [
        { "document": "Audited Financial Statements", "description": "Last 3 years", "mandatory": true }
      ],
      "eligibilityCriteria": "Minimum requirements summary",
      "applicationProcess": "Step-by-step process",
      "typicalTimeline": "2-4 weeks",
      "successFactors": ["Strong cash flow", "Good credit history"]
    }
  ],
  "recentNews": [
    { "title": "...", "date": "2025-01-15", "summary": "...", "url": "..." }
  ]
}

Guidelines:
- Only include verified data from search results
- For products, include ALL financing products offered (loans, grants, subsidies, incentives, equity)
- For grants and incentives: set interestRate to 0 and collateralRequired to false
- For requirements, map to standard documents: audited financials, bank statements, tax clearance, etc.
- Use null for unavailable data
- Return ONLY valid JSON, no markdown.`;
}

function buildProductEnrichmentPrompt(provider, product, productType) {
  return `You are a financial product research specialist.

Research the specific capital product "${product}" offered by "${provider}" in Uganda/East Africa.
${productType ? `Product type: ${productType}` : ''}

Find detailed product information and return as valid JSON.
Valid productType values: ${PRODUCT_TYPES.join(', ')}

{
  "name": "${product}",
  "productType": "${productType || 'term_loan'}",
  "description": "Detailed product description",
  "minAmount": null,
  "maxAmount": null,
  "currency": "UGX",
  "interestRate": null,
  "interestType": "reducing_balance",
  "tenorMinMonths": null,
  "tenorMaxMonths": null,
  "processingFee": null,
  "collateralRequired": false,
  "collateralTypes": [],
  "requirements": [
    { "document": "Audited Financial Statements", "description": "Last 2-3 years", "mandatory": true },
    { "document": "Tax Clearance Certificate", "description": "Current valid certificate from URA", "mandatory": true },
    { "document": "Bank Statements", "description": "Last 6-12 months", "mandatory": true }
  ],
  "eligibilityCriteria": "Detailed eligibility requirements",
  "applicationProcess": "Step 1: Submit application form. Step 2: ...",
  "typicalTimeline": "2-6 weeks from application to disbursement",
  "successFactors": ["Strong cash flow history", "Adequate collateral", "Clean credit record"]
}

Guidelines:
- Include ALL document requirements for application
- Detail the full application process if available
- Include realistic timelines based on research
- Use null for unavailable numeric data
- Return ONLY valid JSON, no markdown.`;
}

function buildMatchSearchPrompt(capitalNeed) {
  const needType = capitalNeed.type || 'working_capital';
  const amount = capitalNeed.amountRequired || 0;
  const currency = capitalNeed.currency || 'UGX';

  return `You are a financial market researcher specializing in Uganda and East Africa.

Search for capital providers and products suitable for this business need:
- Need type: ${needType}
- Amount required: ${currency} ${amount.toLocaleString()}
- Urgency: ${capitalNeed.urgency || 'medium_term'}
- Purpose: ${capitalNeed.description || needType.replace(/_/g, ' ')}

Valid providerType values: ${PROVIDER_TYPES.join(', ')}
Valid productType values: ${PRODUCT_TYPES.join(', ')}

Return providers and their relevant products as JSON:
{
  "providers": [
    {
      "name": "...",
      "providerType": "bank",
      "website": "...",
      "description": "...",
      "products": [
        {
          "name": "...",
          "productType": "term_loan",
          "minAmount": null,
          "maxAmount": null,
          "currency": "${currency}",
          "interestRate": null,
          "interestType": "reducing_balance",
          "tenorMinMonths": null,
          "tenorMaxMonths": null,
          "collateralRequired": true,
          "requirements": ["..."],
          "eligibility": "..."
        }
      ],
      "contactInfo": { "phone": "...", "email": "...", "address": "..." },
      "sectors": []
    }
  ]
}

Focus on providers whose products match the amount range and need type.
Return ONLY valid JSON, no markdown.`;
}

function buildMatchAnalysisPrompt(searchResults, businessProfile, capitalNeed) {
  return `You are a capital advisory specialist for SMEs in Uganda.

Analyze the following capital providers and their products against this business profile and capital need.

## Business Profile
- Monthly Revenue: UGX ${(businessProfile.monthlyRevenue || 0).toLocaleString()}
- Years in Business: ${businessProfile.yearsInBusiness || 'Unknown'}
- Has Collateral: ${businessProfile.hasCollateral ? 'Yes' : 'No'}
- Sectors: ${(businessProfile.sectors || []).join(', ') || 'Not specified'}
- Overall Readiness Score: ${businessProfile.readinessScore || 0}/100
- Document Readiness: ${businessProfile.documentReadiness || 0}/100
- Financial Health Score: ${businessProfile.financialHealth || 0}/100

## Capital Need
- Type: ${capitalNeed.type || 'working_capital'}
- Amount: ${capitalNeed.currency || 'UGX'} ${(capitalNeed.amountRequired || 0).toLocaleString()}
- Urgency: ${capitalNeed.urgency || 'medium_term'}
- Purpose: ${capitalNeed.description || ''}

## Available Providers & Products
${JSON.stringify(searchResults.providers || [], null, 2)}

Return analysis as valid JSON:
{
  "matches": [
    {
      "providerName": "...",
      "productName": "...",
      "matchScore": 85,
      "strengths": ["Good fit for amount range", "No collateral required"],
      "gaps": ["Revenue may be below minimum threshold"],
      "readinessActions": ["Upload audited financials", "Get tax clearance certificate"],
      "estimatedTimeline": "4-6 weeks",
      "recommendation": "Strong match - apply after completing document checklist"
    }
  ],
  "overallRecommendation": "Summary recommendation for the business",
  "preparationActions": ["Complete action 1", "Complete action 2"],
  "alternativeStrategies": ["Consider splitting across two facilities"]
}

Rank matches by matchScore (highest first). Only include providers where matchScore >= 30.
Return ONLY valid JSON.`;
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

async function handleSearchProviders({ query, filters }) {
  if (!query) {
    throw new HttpsError('invalid-argument', 'query is required for search-providers');
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
    tools: [{ googleSearch: {} }],
  });

  const prompt = buildProviderSearchPrompt(query, filters);
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  console.log('Provider search response length:', responseText.length);

  let parsed;
  try {
    parsed = parseJsonResponse(responseText);
  } catch (parseErr) {
    console.warn('Failed to parse provider search JSON:', parseErr.message);
    parsed = { providers: [] };
  }

  // Extract grounding citations
  const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;
  const sources = groundingMetadata?.groundingChunks
    ?.filter(c => c.web)
    ?.map(c => ({ url: c.web.uri, title: c.web.title }))
    ?.slice(0, 10) || [];

  return {
    providers: parsed.providers || [],
    sources,
    searchQueries: groundingMetadata?.webSearchQueries || [],
  };
}

async function handleEnrichProvider({ provider }) {
  if (!provider?.name) {
    throw new HttpsError('invalid-argument', 'provider.name is required for enrich-provider');
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
    tools: [{ googleSearch: {} }],
  });

  const prompt = buildProviderEnrichmentPrompt(provider);
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  console.log('Provider enrichment response length:', responseText.length);

  let enrichedProvider;
  try {
    enrichedProvider = parseJsonResponse(responseText);
  } catch (parseErr) {
    console.warn('Failed to parse provider enrichment JSON:', parseErr.message);
    enrichedProvider = { fullName: provider.name, providerType: provider.providerType || 'bank', products: [] };
  }

  // Extract sources
  const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;
  enrichedProvider._sources = groundingMetadata?.groundingChunks
    ?.filter(c => c.web)
    ?.map(c => ({ url: c.web.uri, title: c.web.title }))
    ?.slice(0, 10) || [];

  return { enrichedProvider };
}

async function handleEnrichProduct({ provider, product, productType }) {
  if (!provider || !product) {
    throw new HttpsError('invalid-argument', 'provider and product are required for enrich-product');
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
    tools: [{ googleSearch: {} }],
  });

  const prompt = buildProductEnrichmentPrompt(provider, product, productType);
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  console.log('Product enrichment response length:', responseText.length);

  let enrichedProduct;
  try {
    enrichedProduct = parseJsonResponse(responseText);
  } catch (parseErr) {
    console.warn('Failed to parse product enrichment JSON:', parseErr.message);
    enrichedProduct = { name: product, productType: productType || 'term_loan', requirements: [], collateralRequired: false };
  }

  return { enrichedProduct };
}

async function handleMatchProviders({ businessProfile, capitalNeed }) {
  if (!businessProfile || !capitalNeed) {
    throw new HttpsError('invalid-argument', 'businessProfile and capitalNeed are required for match-providers');
  }

  // Stage 1: Gemini searches for relevant providers
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
    tools: [{ googleSearch: {} }],
  });

  const searchPrompt = buildMatchSearchPrompt(capitalNeed);
  const searchResult = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: searchPrompt }] }],
  });

  const searchText = searchResult.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  let searchData;
  try {
    searchData = parseJsonResponse(searchText);
  } catch {
    searchData = { providers: [] };
  }

  console.log(`Match search found ${(searchData.providers || []).length} providers`);

  // Stage 2: Claude analyzes matches against business profile
  const analysisPrompt = buildMatchAnalysisPrompt(searchData, businessProfile, capitalNeed);
  const claudeResponse = await claudeClient.createMessageWithRetry(
    ANTHROPIC_API_KEY.value(),
    'standard',
    'You are a capital advisory specialist for SMEs. Always respond with valid JSON only, no explanations or markdown.',
    analysisPrompt,
  );

  let analysis;
  try {
    analysis = claudeClient.parseJsonFromResponse(claudeResponse);
  } catch {
    analysis = {
      matches: [],
      overallRecommendation: 'Unable to generate recommendations. Please try again.',
      preparationActions: [],
      alternativeStrategies: [],
    };
  }

  return analysis;
}

// ============================================================================
// CLOUD FUNCTION
// ============================================================================

const capitalProviderResearch = onCall(
  {
    memory: '1GiB',
    timeoutSeconds: 120,
    cors: ALLOWED_ORIGINS,
    secrets: [GEMINI_API_KEY, ANTHROPIC_API_KEY],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { action, ...params } = request.data;

    if (!action) {
      throw new HttpsError('invalid-argument', 'action is required');
    }

    console.log(`Capital Provider Research [${action}]`);

    try {
      switch (action) {
        case 'search-providers':
          return await handleSearchProviders(params);
        case 'enrich-provider':
          return await handleEnrichProvider(params);
        case 'enrich-product':
          return await handleEnrichProduct(params);
        case 'match-providers':
          return await handleMatchProviders(params);
        default:
          throw new HttpsError('invalid-argument', `Unknown action: ${action}`);
      }
    } catch (error) {
      console.error('Capital Provider Research error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', `Capital provider research failed: ${error.message}`);
    }
  }
);

module.exports = { capitalProviderResearch };
