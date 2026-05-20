/**
 * Design Item Enhancement Logic Module
 * 
 * Core logic for design item enhancement that can be used by both
 * the onCall Cloud Function and the Express API endpoint.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// DfM Rules Engine
const DFM_RULES = [
  {
    id: 'min-panel-thickness',
    category: 'material',
    check: (specs) => {
      if (specs.dimensions?.width > 600 && specs.material?.thickness < 18) {
        return {
          severity: 'warning',
          rule: 'min-panel-thickness',
          description: 'Panel width exceeds 600mm with thickness under 18mm. Risk of sagging.',
          suggestedFix: 'Increase panel thickness to 18mm or add support rails.',
        };
      }
      return null;
    },
  },
  {
    id: 'max-sheet-dimension',
    category: 'material',
    check: (specs) => {
      const maxDim = Math.max(specs.dimensions?.width || 0, specs.dimensions?.height || 0);
      if (maxDim > 2440) {
        return {
          severity: 'error',
          rule: 'max-sheet-dimension',
          description: `Maximum dimension ${maxDim}mm exceeds standard sheet size (2440mm).`,
          suggestedFix: 'Split into multiple panels or use joining method.',
        };
      }
      return null;
    },
  },
  {
    id: 'grain-direction',
    category: 'aesthetic',
    check: (specs) => {
      if (specs.material?.grainDirection && specs.dimensions?.height > specs.dimensions?.width) {
        return {
          severity: 'info',
          rule: 'grain-direction',
          description: 'Vertical orientation may require grain matching across panels.',
          suggestedFix: 'Plan grain direction in cutting layout.',
        };
      }
      return null;
    },
  },
];

// Default Specifications by Item Type
const DEFAULT_SPECIFICATIONS = {
  wardrobe: {
    dimensions: { width: 1200, height: 2100, depth: 600 },
    material: { type: 'melamine_mdf', thickness: 18, grainDirection: false },
    finish: { type: 'laminate', sheen: 'matte' },
    hardware: [
      { type: 'soft_close_hinge', quantity: 6 },
      { type: 'drawer_slide', quantity: 4 },
      { type: 'hanging_rail', quantity: 2 },
    ],
    estimatedHours: 12,
  },
  nightstand: {
    dimensions: { width: 500, height: 550, depth: 450 },
    material: { type: 'veneer_mdf', thickness: 18, grainDirection: true },
    finish: { type: 'lacquer', sheen: 'matte' },
    hardware: [
      { type: 'drawer_slide', quantity: 2 },
    ],
    estimatedHours: 3,
  },
  desk_unit: {
    dimensions: { width: 1400, height: 750, depth: 700 },
    material: { type: 'veneer_mdf', thickness: 25, grainDirection: true },
    finish: { type: 'lacquer', sheen: 'satin' },
    hardware: [
      { type: 'drawer_slide', quantity: 4 },
      { type: 'cable_grommet', quantity: 2 },
    ],
    estimatedHours: 8,
  },
  tv_unit: {
    dimensions: { width: 1600, height: 500, depth: 450 },
    material: { type: 'melamine_mdf', thickness: 18, grainDirection: false },
    finish: { type: 'laminate', sheen: 'matte' },
    hardware: [
      { type: 'soft_close_hinge', quantity: 4 },
      { type: 'cable_grommet', quantity: 2 },
    ],
    estimatedHours: 5,
  },
  bathroom_vanity: {
    dimensions: { width: 1000, height: 850, depth: 550 },
    material: { type: 'marine_plywood', thickness: 18, grainDirection: false },
    finish: { type: 'lacquer', sheen: 'semi-gloss' },
    hardware: [
      { type: 'soft_close_hinge', quantity: 4 },
      { type: 'drawer_slide', quantity: 2 },
    ],
    estimatedHours: 10,
  },
  reception_desk: {
    dimensions: { width: 2400, height: 1100, depth: 800 },
    material: { type: 'veneer_mdf', thickness: 25, grainDirection: true },
    finish: { type: 'lacquer', sheen: 'satin' },
    hardware: [
      { type: 'drawer_slide', quantity: 6 },
      { type: 'cable_grommet', quantity: 4 },
    ],
    estimatedHours: 24,
  },
};

/**
 * Infer specifications for an item type
 */
function inferSpecifications(itemType, context = {}) {
  const normalizedType = itemType.toLowerCase().replace(/\s+/g, '_');
  const defaults = DEFAULT_SPECIFICATIONS[normalizedType];
  
  if (!defaults) {
    return {
      dimensions: null,
      material: null,
      finish: null,
      hardware: [],
      estimatedHours: 4,
      note: 'No default specifications available - requires manual input',
    };
  }

  const specs = JSON.parse(JSON.stringify(defaults));

  // Adjust for budget tier
  if (context.budgetTier === 'premium' || context.budgetTier === 'luxury') {
    specs.material.type = specs.material.type.replace('melamine', 'veneer');
    specs.finish.type = 'lacquer';
    specs.finish.sheen = 'satin';
  }

  return specs;
}

/**
 * Run DfM validation
 */
function validateDfM(specifications) {
  const issues = [];
  
  for (const rule of DFM_RULES) {
    const issue = rule.check(specifications);
    if (issue) {
      issues.push(issue);
    }
  }

  return {
    passed: issues.filter(i => i.severity === 'error').length === 0,
    issues,
  };
}

/**
 * Mock supplier discovery (to be replaced with real API calls)
 */
async function discoverSuppliers(itemType, category) {
  if (category !== 'PROCURED') {
    return { supplierOptions: [], recommendedSupplier: null };
  }

  // Mock suppliers for demonstration
  const mockSuppliers = [
    { supplier: 'East Africa Furniture Co.', platform: 'Local', unitPriceUsd: 120, totalLeadTime: 14 },
    { supplier: 'China Direct Imports', platform: 'Alibaba', unitPriceUsd: 85, totalLeadTime: 45 },
    { supplier: 'Kenya Office Supplies', platform: 'Local', unitPriceUsd: 150, totalLeadTime: 7 },
  ];

  return {
    supplierOptions: mockSuppliers,
    recommendedSupplier: mockSuppliers[0],
  };
}

/**
 * Main processing function
 */
async function processDesignItemEnhancement(options) {
  const {
    deliverable,
    projectContext,
    includeSuppliers,
    geminiApiKey,
    db,
    memoryPrompt,
  } = options;

  const startTime = Date.now();
  const enhanced = { ...deliverable };

  // 1. Infer specifications if not provided
  console.log('Phase 1: Inferring specifications...');
  enhanced.specifications = inferSpecifications(
    deliverable.itemType,
    projectContext
  );

  // 2. DfM Validation
  console.log('Phase 2: DfM validation...');
  enhanced.dfmValidation = validateDfM(enhanced.specifications);

  // 3. Supplier Discovery (for PROCURED items)
  if (includeSuppliers && deliverable.category === 'PROCURED') {
    console.log('Phase 3: Supplier discovery...');
    enhanced.procurement = await discoverSuppliers(
      deliverable.itemType,
      deliverable.category
    );
  }

  // 4. AI Enhancement
  let aiEnhancement = null;
  if (geminiApiKey) {
    try {
      console.log('Phase 4: AI enhancement...');
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      let prompt = `For a ${deliverable.itemType} with dimensions ${JSON.stringify(enhanced.specifications?.dimensions || {})}:

1. Suggest 2 material alternatives with cost implications
2. Estimate cost range in USD
3. Note any quality considerations

Keep response under 100 words, format as JSON with keys: materialAlternatives, estimatedCostRange, qualityGrade`;

      // Inject business memory context if available
      if (memoryPrompt) {
        prompt += memoryPrompt;
      }

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Try to parse JSON from response
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiEnhancement = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        aiEnhancement = {
          refinements: [responseText],
          materialAlternatives: [],
          estimatedCostRange: { min: 100, max: 500, currency: 'USD' },
          qualityGrade: 'commercial',
        };
      }
    } catch (aiError) {
      console.warn('AI enhancement failed:', aiError.message);
    }
  }

  enhanced.aiEnhancement = aiEnhancement;
  enhanced.aiMetadata = {
    confidenceScore: 0.85,
    enhancedAt: new Date().toISOString(),
    processingTimeMs: Date.now() - startTime,
  };

  return enhanced;
}

module.exports = {
  processDesignItemEnhancement,
  inferSpecifications,
  validateDfM,
  discoverSuppliers,
  DEFAULT_SPECIFICATIONS,
  DFM_RULES,
};
