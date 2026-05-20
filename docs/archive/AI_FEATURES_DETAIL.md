# AI Features - Detailed Specifications

Comprehensive documentation for AI capabilities in the Dawin Design-to-Production Platform.

---

## Table of Contents

1. [AI Service Architecture](#1-ai-service-architecture)
2. [Design Manager AI Features](#2-design-manager-ai-features)
3. [Cutlist Processor AI Features](#3-cutlist-processor-ai-features)
4. [Production AI Features (Planned)](#4-production-ai-features)
5. [Implementation Guide](#5-implementation-guide)

---

## 1. AI Service Architecture

### 1.1 Core Service Structure

```typescript
// src/shared/ai/service.ts

interface AIServiceConfig {
  claudeApiKey: string;
  maxRetries: number;
  cacheEnabled: boolean;
  cacheTTL: number;  // milliseconds
  rateLimitPerMinute: number;
}

class AIService {
  private claude: Anthropic;
  private cache: Map<string, CachedResponse>;
  private rateLimiter: RateLimiter;
  
  constructor(config: AIServiceConfig) {
    this.claude = new Anthropic({ apiKey: config.claudeApiKey });
    this.cache = new Map();
    this.rateLimiter = new RateLimiter(config.rateLimitPerMinute);
  }
  
  async complete(request: AIRequest): Promise<AIResponse> {
    // 1. Check cache
    const cacheKey = this.getCacheKey(request);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!.response;
    }
    
    // 2. Rate limiting
    await this.rateLimiter.acquire();
    
    // 3. Execute with retry
    const response = await this.executeWithRetry(request);
    
    // 4. Cache response
    this.cache.set(cacheKey, { response, timestamp: Date.now() });
    
    return response;
  }
}

export const aiService = new AIService({
  claudeApiKey: import.meta.env.VITE_CLAUDE_API_KEY,
  maxRetries: 3,
  cacheEnabled: true,
  cacheTTL: 3600000,
  rateLimitPerMinute: 50
});
```

### 1.2 Request/Response Types

```typescript
interface AIRequest {
  type: 'brief-parse' | 'dfm-analyze' | 'material-map' | 'cost-estimate';
  input: Record<string, unknown>;
  context?: Record<string, unknown>;
  options?: {
    temperature?: number;
    maxTokens?: number;
  };
}

interface AIResponse {
  success: boolean;
  data: Record<string, unknown>;
  confidence: number;
  processingTime: number;
  modelUsed: string;
}
```

---

## 2. Design Manager AI Features

### 2.1 Brief Parser

**Purpose:** Extract structured design parameters from text briefs and client requirements.

#### Input/Output Schema

```typescript
interface BriefParserInput {
  brief: string;           // Raw text brief
  clientName?: string;     // For context
  projectType?: string;    // For context
}

interface ParsedBrief {
  itemType: DesignCategory;
  dimensions: {
    width?: number;
    height?: number;
    depth?: number;
    unit: 'mm' | 'inches';
  };
  materials: {
    primary?: string;
    secondary?: string[];
  };
  hardware: string[];
  finish: {
    type?: string;
    color?: string;
    sheen?: string;
  };
  specialRequirements: string[];
  uncertainties: string[];  // Things AI couldn't determine
  confidence: number;
}
```

#### Implementation

```typescript
// src/shared/ai/brief-parser.ts

const BRIEF_PARSER_SYSTEM = `You are a millwork design analyst for Dawin Finishes, 
a custom cabinet and furniture manufacturer in Uganda.

Extract structured design parameters from client briefs. Be conservative - 
only extract what is explicitly stated or can be confidently inferred.

Standard materials available:
- Sheet: MDF (6,9,12,16,18,25mm), Plywood, Blockboard, Chipboard
- Veneer: Oak, Walnut, Mahogany, Sapele
- Solid: Pine, Mahogany, Mvule, Eucalyptus

Standard finishes:
- Paint (any RAL/Pantone color)
- Stain + Lacquer
- Clear Lacquer
- Veneer + Lacquer

Hardware suppliers: Blum, Hettich, Hafele

Return ONLY parameters you can confidently extract. Mark uncertainties.`;

export async function parseDesignBrief(input: BriefParserInput): Promise<ParsedBrief> {
  const response = await aiService.claude.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2000,
    system: BRIEF_PARSER_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Parse this design brief:\n\n${input.brief}
        
${input.clientName ? `Client: ${input.clientName}` : ''}
${input.projectType ? `Project type: ${input.projectType}` : ''}`
      }
    ],
    tools: [
      {
        name: 'extract_design_parameters',
        description: 'Extract structured design parameters from brief',
        input_schema: {
          type: 'object',
          properties: {
            itemType: { 
              type: 'string', 
              enum: ['casework', 'furniture', 'millwork', 'doors', 'fixtures', 'specialty'] 
            },
            dimensions: {
              type: 'object',
              properties: {
                width: { type: 'number', description: 'Width in mm' },
                height: { type: 'number', description: 'Height in mm' },
                depth: { type: 'number', description: 'Depth in mm' },
                unit: { type: 'string', enum: ['mm', 'inches'], default: 'mm' }
              }
            },
            materials: {
              type: 'object',
              properties: {
                primary: { type: 'string' },
                secondary: { type: 'array', items: { type: 'string' } }
              }
            },
            hardware: { type: 'array', items: { type: 'string' } },
            finish: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                color: { type: 'string' },
                sheen: { type: 'string', enum: ['flat', 'matte', 'satin', 'semi-gloss', 'gloss'] }
              }
            },
            specialRequirements: { type: 'array', items: { type: 'string' } },
            uncertainties: { type: 'array', items: { type: 'string' } },
            confidence: { type: 'number', minimum: 0, maximum: 1 }
          },
          required: ['itemType', 'confidence']
        }
      }
    ],
    tool_choice: { type: 'tool', name: 'extract_design_parameters' }
  });
  
  return parseToolResponse(response);
}
```

#### Example Usage

```typescript
const brief = `
Client wants a modern TV unit for their living room.
Should be about 2 meters wide to fit under their 65" TV.
Floating design, wall mounted. White matte finish.
Need space for cable box, gaming console, and sound bar.
Soft close drawers for remotes and accessories.
Budget is around 3 million UGX.
`;

const parsed = await parseDesignBrief({ brief, clientName: 'John Doe' });
// Result:
// {
//   itemType: 'furniture',
//   dimensions: { width: 2000, height: null, depth: null, unit: 'mm' },
//   materials: { primary: 'MDF' },
//   hardware: ['soft-close drawer slides', 'wall mounting brackets'],
//   finish: { type: 'paint', color: 'white', sheen: 'matte' },
//   specialRequirements: ['floating/wall-mounted', 'cable management'],
//   uncertainties: ['exact height', 'exact depth', 'number of compartments'],
//   confidence: 0.75
// }
```

---

### 2.2 DfM (Design for Manufacturability) Analyzer

**Purpose:** Analyze designs for manufacturability issues and suggest improvements.

#### Rule Categories

| Category | Rules Count | Examples |
|----------|-------------|----------|
| Structural | 12 | Panel thickness, span limits, support requirements |
| Material | 10 | Grain direction, moisture considerations, availability |
| Joinery | 8 | Joint strength, appropriate methods, clearances |
| Finish | 6 | Surface prep, coating compatibility, durability |
| Hardware | 8 | Mounting requirements, load capacity, accessibility |
| Assembly | 6 | Sequence feasibility, access for fasteners |

#### Rule Engine Implementation

```typescript
// src/shared/ai/dfm-analyzer.ts

interface DfMRule {
  id: string;
  name: string;
  category: 'structural' | 'material' | 'joinery' | 'finish' | 'hardware' | 'assembly';
  severity: 'error' | 'warning' | 'info';
  check: (params: DesignParameters) => DfMIssue | null;
  aiEnhanced?: boolean;  // Whether AI provides additional analysis
}

interface DfMIssue {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion: string;
  affectedAspects: string[];  // RAG aspects to address
  estimatedImpact?: {
    cost: 'none' | 'low' | 'medium' | 'high';
    time: 'none' | 'low' | 'medium' | 'high';
  };
}

// Example Rules
const DFM_RULES: DfMRule[] = [
  // STRUCTURAL RULES
  {
    id: 'STR-001',
    name: 'Minimum Panel Thickness for Span',
    category: 'structural',
    severity: 'error',
    check: (params) => {
      const { width, height } = params.dimensions;
      const thickness = params.primaryMaterial?.thickness || 0;
      const maxSpan = Math.max(width || 0, height || 0);
      
      // Unsupported span calculations
      const minThickness = maxSpan > 900 ? 25 : maxSpan > 600 ? 18 : 16;
      
      if (thickness < minThickness && maxSpan > 400) {
        return {
          ruleId: 'STR-001',
          severity: 'error',
          message: `Span of ${maxSpan}mm requires minimum ${minThickness}mm thickness (currently ${thickness}mm)`,
          suggestion: `Increase material thickness to ${minThickness}mm or add intermediate support`,
          affectedAspects: ['materialSpecs', 'joineryDetails'],
          estimatedImpact: { cost: 'low', time: 'low' }
        };
      }
      return null;
    }
  },
  
  {
    id: 'STR-002',
    name: 'Shelf Sag Prevention',
    category: 'structural',
    severity: 'warning',
    check: (params) => {
      // Check if shelves exceed recommended span without support
      const shelfSpan = params.dimensions.width || 0;
      const thickness = params.primaryMaterial?.thickness || 18;
      
      // MDF/Chipboard sag threshold: span/thickness ratio
      const ratio = shelfSpan / thickness;
      if (ratio > 40) {
        return {
          ruleId: 'STR-002',
          severity: 'warning',
          message: `Shelf may sag over time (span/thickness ratio: ${ratio.toFixed(1)}, recommended <40)`,
          suggestion: 'Add center support, use thicker material, or add front rail',
          affectedAspects: ['joineryDetails', 'materialSpecs']
        };
      }
      return null;
    }
  },
  
  // MATERIAL RULES
  {
    id: 'MAT-001',
    name: 'Grain Direction for Tall Doors',
    category: 'material',
    severity: 'warning',
    check: (params) => {
      if (params.primaryMaterial?.grainDirection) {
        const { width, height } = params.dimensions;
        if (height > width && height > 600) {
          return {
            ruleId: 'MAT-001',
            severity: 'warning',
            message: 'Tall door/panel should have vertical grain direction',
            suggestion: 'Confirm grain runs vertically for structural strength and aesthetics',
            affectedAspects: ['materialSpecs']
          };
        }
      }
      return null;
    }
  },
  
  {
    id: 'MAT-002',
    name: 'Moisture Sensitive Material in Wet Areas',
    category: 'material',
    severity: 'error',
    check: (params) => {
      const moistureSensitive = ['MDF', 'Chipboard', 'Particle Board'];
      const material = params.primaryMaterial?.name || '';
      const isWetArea = params.specialRequirements?.some(r => 
        r.toLowerCase().includes('bathroom') || 
        r.toLowerCase().includes('kitchen sink') ||
        r.toLowerCase().includes('wet')
      );
      
      if (isWetArea && moistureSensitive.some(m => material.includes(m))) {
        return {
          ruleId: 'MAT-002',
          severity: 'error',
          message: `${material} not recommended for moisture-prone areas`,
          suggestion: 'Use moisture-resistant MDF (MR MDF), marine plywood, or solid wood',
          affectedAspects: ['materialSpecs'],
          estimatedImpact: { cost: 'medium', time: 'low' }
        };
      }
      return null;
    }
  },
  
  // JOINERY RULES
  {
    id: 'JNT-001',
    name: 'Edge Banding on Exposed Edges',
    category: 'joinery',
    severity: 'warning',
    check: (params) => {
      const needsEdgeBanding = ['MDF', 'Chipboard', 'Plywood'];
      const material = params.primaryMaterial?.name || '';
      
      if (needsEdgeBanding.some(m => material.includes(m)) && !params.edgeBanding) {
        return {
          ruleId: 'JNT-001',
          severity: 'warning',
          message: 'Exposed edges of sheet material should have edge banding',
          suggestion: 'Add PVC, veneer, or solid wood edge banding to visible edges',
          affectedAspects: ['finishSpecs', 'joineryDetails']
        };
      }
      return null;
    }
  },
  
  // HARDWARE RULES
  {
    id: 'HW-001',
    name: 'Hinge Mounting Surface Thickness',
    category: 'hardware',
    severity: 'error',
    check: (params) => {
      const thickness = params.primaryMaterial?.thickness || 0;
      const hasHinges = params.hardware?.some(h => 
        h.category === 'hinges' || h.name.toLowerCase().includes('hinge')
      );
      
      if (hasHinges && thickness < 16) {
        return {
          ruleId: 'HW-001',
          severity: 'error',
          message: `Material thickness (${thickness}mm) too thin for standard concealed hinges`,
          suggestion: 'Use minimum 16mm thickness for Blum/Hettich hinges, or use surface-mount hinges',
          affectedAspects: ['hardwareSpecs', 'materialSpecs']
        };
      }
      return null;
    }
  },
  
  // ... 44 more rules
];

// Main analysis function
export async function analyzeDfM(designItem: DesignItem): Promise<DfMAnalysisResult> {
  // 1. Run rule-based checks
  const ruleIssues = DFM_RULES
    .map(rule => rule.check(designItem.parameters))
    .filter((issue): issue is DfMIssue => issue !== null);
  
  // 2. Run AI-enhanced analysis for complex patterns
  const aiIssues = await runAIDfMAnalysis(designItem);
  
  // 3. Combine and deduplicate
  const allIssues = deduplicateIssues([...ruleIssues, ...aiIssues]);
  
  // 4. Calculate overall score
  const score = calculateDfMScore(allIssues);
  
  // 5. Generate RAG suggestions
  const ragSuggestions = generateRAGSuggestions(allIssues);
  
  return {
    issues: allIssues,
    overallScore: score,
    suggestedRAGUpdates: ragSuggestions,
    analyzedAt: new Date().toISOString()
  };
}
```

---

### 2.3 Auto-RAG Suggester

**Purpose:** Analyze uploaded files and suggest RAG status updates.

```typescript
// src/shared/ai/auto-rag.ts

interface AutoRAGInput {
  files: DesignFile[];
  currentRAGStatus: RAGStatus;
  designParameters: DesignParameters;
}

interface RAGSuggestion {
  aspect: string;
  currentStatus: RAGStatusValue;
  suggestedStatus: RAGStatusValue;
  reason: string;
  confidence: number;
  evidenceFiles: string[];
}

export async function suggestRAGUpdates(input: AutoRAGInput): Promise<RAGSuggestion[]> {
  const suggestions: RAGSuggestion[] = [];
  
  // Analyze file types to determine what aspects might be addressed
  const fileAnalysis = analyzeFileTypes(input.files);
  
  // For each aspect, check if uploaded files could improve status
  if (fileAnalysis.has3DModel && input.currentRAGStatus.designCompleteness.model3D.status !== 'green') {
    suggestions.push({
      aspect: 'designCompleteness.model3D',
      currentStatus: input.currentRAGStatus.designCompleteness.model3D.status,
      suggestedStatus: 'green',
      reason: '3D model file detected in uploads',
      confidence: 0.9,
      evidenceFiles: fileAnalysis.modelFiles
    });
  }
  
  if (fileAnalysis.hasDrawings && input.currentRAGStatus.designCompleteness.productionDrawings.status !== 'green') {
    suggestions.push({
      aspect: 'designCompleteness.productionDrawings',
      currentStatus: input.currentRAGStatus.designCompleteness.productionDrawings.status,
      suggestedStatus: 'amber',  // Amber until reviewed
      reason: 'Production drawings detected in uploads',
      confidence: 0.8,
      evidenceFiles: fileAnalysis.drawingFiles
    });
  }
  
  // Use AI to analyze drawing content for more detailed suggestions
  if (fileAnalysis.hasDrawings) {
    const aiSuggestions = await analyzeDrawingsWithAI(fileAnalysis.drawingFiles, input.currentRAGStatus);
    suggestions.push(...aiSuggestions);
  }
  
  return suggestions;
}
```

---

### 2.4 Cost Estimator

**Purpose:** Estimate production cost based on design parameters.

```typescript
// src/shared/ai/cost-estimator.ts

interface CostEstimateInput {
  parameters: DesignParameters;
  complexity: 'simple' | 'moderate' | 'complex';
  quantity: number;
}

interface CostBreakdown {
  materials: {
    sheets: number;
    hardware: number;
    finish: number;
    edgeBanding: number;
    total: number;
  };
  labor: {
    cutting: number;
    machining: number;
    assembly: number;
    finishing: number;
    total: number;
  };
  overhead: number;
  total: number;
  perUnit: number;
  confidence: number;
  assumptions: string[];
}

// Cost factors (UGX)
const COST_FACTORS = {
  materials: {
    mdf18mm: 85000,      // per sheet (2440x1220)
    plywood18mm: 180000,
    blockboard18mm: 120000,
    veneer: 45000,       // per sqm
    edgeBanding: 2500,   // per meter
  },
  hardware: {
    hingeBlum: 35000,    // per pair
    slideBlum: 85000,    // per pair
    handle: 15000,       // each
  },
  labor: {
    hourlyRate: 15000,   // UGX per hour
    cuttingPerSheet: 0.5,
    machiningPerItem: 2,
    assemblyPerUnit: 4,
    finishingPerSqm: 0.3,
  },
  finish: {
    paintPerSqm: 25000,
    lacquerPerSqm: 35000,
    veneerPerSqm: 65000,
  },
  overheadPercent: 0.15,
};

export function estimateCost(input: CostEstimateInput): CostBreakdown {
  const { parameters, complexity, quantity } = input;
  const assumptions: string[] = [];
  
  // Calculate surface area
  const dims = parameters.dimensions;
  const surfaceArea = calculateSurfaceArea(dims);
  assumptions.push(`Estimated surface area: ${surfaceArea.toFixed(2)} sqm`);
  
  // Calculate sheets needed
  const sheetArea = 2.44 * 1.22; // sqm
  const sheetsNeeded = Math.ceil(surfaceArea / (sheetArea * 0.7)); // 70% yield
  assumptions.push(`Sheets needed: ${sheetsNeeded} (assuming 70% yield)`);
  
  // Material costs
  const materialType = parameters.primaryMaterial?.name || 'MDF';
  const sheetCost = COST_FACTORS.materials.mdf18mm * sheetsNeeded;
  
  // Hardware costs
  const hardwareCost = estimateHardwareCost(parameters.hardware || []);
  
  // Finish costs
  const finishCost = surfaceArea * COST_FACTORS.finish.paintPerSqm;
  
  // Edge banding
  const edgeBandingMeters = calculateEdgeBandingLength(dims);
  const edgeBandingCost = edgeBandingMeters * COST_FACTORS.materials.edgeBanding;
  
  const materialTotal = sheetCost + hardwareCost + finishCost + edgeBandingCost;
  
  // Labor costs
  const complexityMultiplier = { simple: 1, moderate: 1.5, complex: 2.5 }[complexity];
  const laborHours = (
    sheetsNeeded * COST_FACTORS.labor.cuttingPerSheet +
    COST_FACTORS.labor.machiningPerItem * complexityMultiplier +
    COST_FACTORS.labor.assemblyPerUnit * complexityMultiplier +
    surfaceArea * COST_FACTORS.labor.finishingPerSqm
  );
  const laborCost = laborHours * COST_FACTORS.labor.hourlyRate;
  
  // Overhead
  const subtotal = materialTotal + laborCost;
  const overhead = subtotal * COST_FACTORS.overheadPercent;
  
  const total = (subtotal + overhead) * quantity;
  
  return {
    materials: {
      sheets: sheetCost,
      hardware: hardwareCost,
      finish: finishCost,
      edgeBanding: edgeBandingCost,
      total: materialTotal
    },
    labor: {
      cutting: sheetsNeeded * COST_FACTORS.labor.cuttingPerSheet * COST_FACTORS.labor.hourlyRate,
      machining: COST_FACTORS.labor.machiningPerItem * complexityMultiplier * COST_FACTORS.labor.hourlyRate,
      assembly: COST_FACTORS.labor.assemblyPerUnit * complexityMultiplier * COST_FACTORS.labor.hourlyRate,
      finishing: surfaceArea * COST_FACTORS.labor.finishingPerSqm * COST_FACTORS.labor.hourlyRate,
      total: laborCost
    },
    overhead,
    total,
    perUnit: total / quantity,
    confidence: 0.7,
    assumptions
  };
}
```

---

## 3. Cutlist Processor AI Features

### 3.1 Smart Material Mapping

**Purpose:** Automatically map unknown material names to supplier materials.

```typescript
// src/shared/ai/material-mapper.ts

interface MaterialMappingInput {
  unknownMaterial: string;
  existingMappings: Record<string, string>;
  context?: string;  // e.g., "from Polyboard export"
}

interface MaterialMapping {
  genericName: string;
  supplierName: string;
  confidence: number;
  reasoning: string;
  alternatives?: string[];
}

const MATERIAL_MAPPER_SYSTEM = `You are a materials expert for millwork manufacturing.
Map generic/CAD material names to specific PG Bison or local supplier materials.

Known material patterns:
- "Generic XXXX" from Polyboard → Usually refers to melamine colors
- "OSB" variants → Map to appropriate chipboard/MDF
- Color codes (0180, 0031, etc.) → PG Bison color codes

Available PG Bison products:
- MelaWood (melamine faced chipboard): White, Black, various woodgrains
- SupaWood MDF: Raw, Primed, various thicknesses
- Chipboard: STD, MR (moisture resistant)

Local alternatives:
- Blockboard (local production)
- Marine Plywood
- Solid wood species: Pine, Mahogany, Mvule`;

export async function suggestMaterialMapping(
  input: MaterialMappingInput
): Promise<MaterialMapping[]> {
  const response = await aiService.claude.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1000,
    system: MATERIAL_MAPPER_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Map this material name: "${input.unknownMaterial}"

Existing mappings for reference:
${JSON.stringify(input.existingMappings, null, 2)}

${input.context ? `Context: ${input.context}` : ''}`
      }
    ]
  });
  
  return parseMappingResponse(response);
}
```

### 3.2 Optimization Advisor

**Purpose:** Suggest optimal settings for cutting optimization.

```typescript
// src/shared/ai/optimization-advisor.ts

interface OptimizationAdvice {
  rotationAllowed: boolean;
  grainGrouping: boolean;
  prioritizeWaste: boolean;
  suggestedKerfWidth: number;
  reasoning: string[];
}

export function adviseOptimizationSettings(
  panels: Panel[],
  materials: StockMaterial[]
): OptimizationAdvice {
  const advice: OptimizationAdvice = {
    rotationAllowed: true,
    grainGrouping: false,
    prioritizeWaste: true,
    suggestedKerfWidth: 4,
    reasoning: []
  };
  
  // Check for grain-sensitive materials
  const hasGrainPanels = panels.some(p => p.grain === 1);
  if (hasGrainPanels) {
    advice.rotationAllowed = false;
    advice.grainGrouping = true;
    advice.reasoning.push('Grain-sensitive panels detected - rotation disabled');
  }
  
  // Check panel sizes for kerf optimization
  const avgPanelArea = panels.reduce((sum, p) => sum + p.length * p.width, 0) / panels.length;
  if (avgPanelArea < 100000) {  // Small panels
    advice.suggestedKerfWidth = 3;
    advice.reasoning.push('Small panels - reduced kerf width recommended');
  }
  
  // Check quantity for batch optimization
  const totalQuantity = panels.reduce((sum, p) => sum + p.quantity, 0);
  if (totalQuantity > 50) {
    advice.prioritizeWaste = true;
    advice.reasoning.push('Large batch - prioritizing waste minimization');
  }
  
  return advice;
}
```

### 3.3 Anomaly Detection

**Purpose:** Flag unusual dimensions or potential errors in panel data.

```typescript
// src/shared/ai/anomaly-detector.ts

interface Anomaly {
  panelIndex: number;
  field: string;
  value: number;
  issue: string;
  severity: 'warning' | 'error';
  suggestion?: string;
}

export function detectAnomalies(panels: Panel[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  
  // Calculate statistics
  const lengths = panels.map(p => p.length);
  const widths = panels.map(p => p.width);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const avgWidth = widths.reduce((a, b) => a + b, 0) / widths.length;
  
  panels.forEach((panel, index) => {
    // Check for suspiciously small panels
    if (panel.length < 50 || panel.width < 50) {
      anomalies.push({
        panelIndex: index,
        field: panel.length < 50 ? 'length' : 'width',
        value: panel.length < 50 ? panel.length : panel.width,
        issue: 'Unusually small dimension',
        severity: 'warning',
        suggestion: 'Verify this is not a data entry error'
      });
    }
    
    // Check for panels larger than standard stock
    if (panel.length > 2440 || panel.width > 1220) {
      anomalies.push({
        panelIndex: index,
        field: panel.length > 2440 ? 'length' : 'width',
        value: panel.length > 2440 ? panel.length : panel.width,
        issue: 'Exceeds standard stock sheet size',
        severity: 'error',
        suggestion: 'Panel must be joined or use larger stock'
      });
    }
    
    // Check for statistical outliers (>3 std dev)
    const lengthZScore = Math.abs(panel.length - avgLength) / standardDeviation(lengths);
    if (lengthZScore > 3) {
      anomalies.push({
        panelIndex: index,
        field: 'length',
        value: panel.length,
        issue: 'Statistical outlier',
        severity: 'warning',
        suggestion: 'Verify dimension is correct'
      });
    }
    
    // Check for swapped dimensions (width > length is unusual)
    if (panel.width > panel.length && panel.grain === 0) {
      anomalies.push({
        panelIndex: index,
        field: 'dimensions',
        value: panel.width,
        issue: 'Width exceeds length (unusual orientation)',
        severity: 'warning',
        suggestion: 'Consider if length/width are swapped'
      });
    }
  });
  
  return anomalies;
}
```

---

## 4. Production AI Features (Planned)

### 4.1 Schedule Optimizer

```typescript
// Planned: src/shared/ai/schedule-optimizer.ts

interface ScheduleInput {
  workOrders: WorkOrder[];
  resources: Resource[];
  constraints: ScheduleConstraint[];
}

interface OptimizedSchedule {
  assignments: Assignment[];
  estimatedCompletion: Date;
  utilization: Record<string, number>;
  bottlenecks: string[];
}
```

### 4.2 Quality Predictor

```typescript
// Planned: src/shared/ai/quality-predictor.ts

interface QualityRisk {
  workOrderId: string;
  riskScore: number;  // 0-100
  factors: string[];
  recommendations: string[];
}
```

---

## 5. Implementation Guide

### 5.1 Environment Setup

```env
# .env
VITE_CLAUDE_API_KEY=sk-ant-api03-...
VITE_AI_CACHE_TTL=3600000
VITE_AI_RATE_LIMIT=50
```

### 5.2 Firebase Function for Secure AI Calls

```typescript
// functions/ai.ts
// Keep API key server-side for security

export const analyzeDesign = onCall(async (request) => {
  const { designItemId } = request.data;
  
  // Verify authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }
  
  // Call AI service
  const result = await aiService.analyzeDfM(designItemId);
  
  // Store result
  await db.collection('aiAnalyses').add({
    type: 'dfm',
    sourceId: designItemId,
    result,
    requestedBy: request.auth.uid,
    requestedAt: FieldValue.serverTimestamp()
  });
  
  return result;
});
```

### 5.3 Usage in Components

```typescript
// Example: Design Item Detail component
function DesignItemDetail({ itemId }: { itemId: string }) {
  const [analysis, setAnalysis] = useState<DfMAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  
  const runAnalysis = async () => {
    setLoading(true);
    try {
      const result = await aiService.analyzeDfM(itemId);
      setAnalysis(result);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <Button onClick={runAnalysis} disabled={loading}>
        {loading ? 'Analyzing...' : 'Run AI Analysis'}
      </Button>
      
      {analysis && (
        <DfMResultsPanel 
          issues={analysis.issues}
          score={analysis.overallScore}
          suggestions={analysis.suggestedRAGUpdates}
        />
      )}
    </div>
  );
}
```
