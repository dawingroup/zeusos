/**
 * Constraint Engine Service
 *
 * Evaluates PDD constraints and computes BOM from template expressions.
 * Checks stock availability. Pricing is delegated to the estimation bridge
 * which calls Design Manager's material pricing service.
 *
 * Design Studio owns: constraint evaluation, BOM computation, stock checks.
 * Design Manager owns: pricing (via estimationBridge → getMaterialUnitCost).
 */
import { Parser } from 'expr-eval';
import { getPDD } from './pdd.service';
import { computePricingFromBOM } from './estimationBridge.service';
import { searchEntries, getMaterialRules } from './knowledgeBase.service';
import type {
  ProductDefinitionDocument,
  Constraint,
} from '../types/productDefinition.types';
import type {
  ConstraintValidationRequest,
  ConstraintValidationResult,
  ConstraintViolation,
  ComputedBOMLine,
  StockStatus,
  DKBValidationResult,
  DKBViolation,
} from '../types/constraintEngine.types';
import type { ComponentEntry } from '../types/knowledgeBase.types';

const parser = new Parser();

/**
 * Core validation: load PDD, evaluate constraints, compute BOM, check stock, price.
 */
export async function validateConfiguration(
  request: ConstraintValidationRequest,
): Promise<ConstraintValidationResult> {
  const pdd = await getPDD(request.pddId);
  if (!pdd) throw new Error(`PDD ${request.pddId} not found`);

  // 1. Evaluate all active constraints
  const violations: ConstraintViolation[] = [];
  const warnings: ConstraintViolation[] = [];
  const infos: ConstraintViolation[] = [];

  for (const constraint of pdd.constraints.filter(c => c.isActive)) {
    const violation = evaluateConstraint(constraint, request.configuration);
    if (violation) {
      switch (violation.action) {
        case 'reject': violations.push(violation); break;
        case 'warn': warnings.push(violation); break;
        case 'info': infos.push(violation); break;
      }
    }
  }

  // 2. Compute BOM
  const computedBOM = await computeBOM(pdd, request.configuration, request.finishSelections);

  // 3. Check stock
  const stockAvailability = await checkStockAvailability(computedBOM);

  // 4. Compute pricing via estimation bridge (delegates to Design Manager)
  const estimatedPrice = await computePricingFromBOM(pdd, computedBOM);

  return {
    valid: violations.length === 0,
    violations,
    warnings,
    infos,
    computedBOM,
    estimatedPrice,
    stockAvailability,
  };
}

/**
 * Evaluate a single constraint against parameter values.
 * Returns a violation if the constraint condition evaluates to true (constraint fired).
 */
export function evaluateConstraint(
  constraint: Constraint,
  parameters: Record<string, unknown>,
): ConstraintViolation | null {
  try {
    // Flatten parameters for expr-eval (it doesn't support nested objects)
    const flatParams: Record<string, number | string | boolean> = {};
    for (const [key, value] of Object.entries(parameters)) {
      if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
        flatParams[key] = value;
      }
    }

    const expr = parser.parse(constraint.condition);
    // expr-eval accepts a Record<string, primitive> as the variable scope at
    // runtime; its .d.ts narrows the param to Value | undefined.
    const result = expr.evaluate(flatParams as unknown as Parameters<typeof expr.evaluate>[0]);

    if (result) {
      return {
        constraintId: constraint.id,
        action: constraint.action,
        reason: constraint.reason,
        affectedParameters: constraint.affectedParameters,
      };
    }
  } catch (err) {
    // If expression evaluation fails, treat as an info-level issue
    return {
      constraintId: constraint.id,
      action: 'info',
      reason: `Constraint evaluation error: ${(err as Error).message}`,
      affectedParameters: constraint.affectedParameters,
    };
  }

  return null;
}

/**
 * Compute BOM by evaluating BomTemplateLine expressions with current parameters.
 * Resolves inventory items via inventoryBindings.
 */
export async function computeBOM(
  pdd: ProductDefinitionDocument,
  parameters: Record<string, unknown>,
  _finishSelections: Record<string, string>,
): Promise<ComputedBOMLine[]> {
  const lines: ComputedBOMLine[] = [];

  // Build evaluation context from parameters
  const evalContext: Record<string, number> = {};
  for (const [key, value] of Object.entries(parameters)) {
    if (typeof value === 'number') {
      evalContext[key] = value;
    }
  }

  for (const bomLine of pdd.bomTemplate) {
    try {
      // Evaluate quantity expression
      const expr = parser.parse(bomLine.quantityExpression);
      const quantity = expr.evaluate(evalContext);

      if (typeof quantity !== 'number' || quantity <= 0) continue;

      // Resolve inventory binding
      const binding = pdd.inventoryBindings[bomLine.materialCategory];
      const wastagePercent = binding?.wastagePercent ?? 5;
      const quantityWithWastage = quantity * (1 + wastagePercent / 100);
      const multiplier = binding?.quantityMultiplier ?? 1;
      const finalQuantity = quantityWithWastage * multiplier;

      // Resolve inventory item
      const inventoryItemId = binding?.inventoryItemId || binding?.inventoryFamilyId || '';
      const inventoryItemName = bomLine.materialCategory;

      // Cost is resolved later by the estimation bridge via getMaterialUnitCost()
      const unitCost = 0;

      lines.push({
        bomTemplateLineKey: bomLine.materialCategory,
        materialCategory: bomLine.materialCategory,
        description: `${bomLine.materialCategory} (${bomLine.unit})`,
        quantity: Math.round(finalQuantity * 1000) / 1000,
        unit: bomLine.unit,
        inventoryItemId,
        inventoryItemName,
        unitCost,
        currency: pdd.pricingConfig?.currencyOverride ?? 'UGX',
        totalCost: 0, // Filled by estimation bridge
        wastageApplied: wastagePercent,
      });
    } catch {
      // Skip lines with expression errors
    }
  }

  return lines;
}

/**
 * Check stock availability for each BOM line.
 */
export async function checkStockAvailability(
  bom: ComputedBOMLine[],
): Promise<Record<string, StockStatus>> {
  const result: Record<string, StockStatus> = {};

  for (const line of bom) {
    if (!line.inventoryItemId) {
      result[line.bomTemplateLineKey] = {
        inventoryItemId: '',
        inventoryItemName: line.inventoryItemName,
        requiredQuantity: line.quantity,
        availableQuantity: 0,
        status: 'out_of_stock',
      };
      continue;
    }

    // Simplified — real impl queries Firestore stockLevels collection
    result[line.bomTemplateLineKey] = {
      inventoryItemId: line.inventoryItemId,
      inventoryItemName: line.inventoryItemName,
      requiredQuantity: line.quantity,
      availableQuantity: 0, // Placeholder — Phase 5 adds useStockIndicators hook
      status: 'sufficient', // Placeholder
    };
  }

  return result;
}

// ── DKB Validation Functions ─────────────────────────────

/**
 * Validate BOM against DKB entries.
 * Cross-references part dimensions, material compatibility, and naming.
 */
export async function validateBOMAgainstDKB(
  bom: ComputedBOMLine[],
  configuration: Record<string, unknown>,
): Promise<DKBValidationResult> {
  const violations: DKBViolation[] = [];

  // Run all DKB checks
  const [dimViolations, materialViolations, namingViolations] = await Promise.all([
    validatePartDimensions(bom, configuration),
    validateMaterialCompatibility(bom),
    validatePartNaming(bom),
  ]);

  violations.push(...dimViolations, ...materialViolations, ...namingViolations);

  return {
    valid: violations.filter(v => v.severity === 'error').length === 0,
    violations,
  };
}

/**
 * Check part sizes against DKB dimensional standards.
 * E.g., "shelf span > 900mm requires 18mm+ thickness"
 */
export async function validatePartDimensions(
  bom: ComputedBOMLine[],
  configuration: Record<string, unknown>,
): Promise<DKBViolation[]> {
  const violations: DKBViolation[] = [];
  const width = typeof configuration.width === 'number' ? configuration.width : 0;
  const depth = typeof configuration.depth === 'number' ? configuration.depth : 0;

  // Fetch component entries from DKB for dimension checks
  const components = await searchEntries('', 'component', 50);
  const componentMap = new Map<string, ComponentEntry>();
  for (const comp of components) {
    if (comp.entryType === 'component') {
      componentMap.set(comp.name.toLowerCase(), comp as ComponentEntry);
    }
  }

  for (const line of bom) {
    const cat = line.materialCategory.toLowerCase();

    // Check shelf span rule: shelves wider than 900mm need 18mm+ substrate
    if (cat.includes('shelf') && width > 900) {
      const shelfComp = componentMap.get('shelf');
      if (shelfComp) {
        const minThickness = shelfComp.materialRequirements[0]?.defaultThicknessMm ?? 18;
        // If the BOM doesn't specify thickness, we check the DKB default
        if (minThickness < 18) {
          violations.push({
            type: 'dimension',
            severity: 'warning',
            bomLineKey: line.bomTemplateLineKey,
            message: `Shelf span ${width}mm exceeds 900mm — recommend minimum 18mm substrate thickness`,
            dkbEntryId: shelfComp.id,
            suggestion: 'Use 18mm or thicker board material for structural integrity',
          });
        }
      }
    }

    // Check component dimension ranges from DKB
    for (const [compName, comp] of componentMap) {
      if (cat.includes(compName)) {
        const dims = comp.dimensions;
        if (width > 0 && (width < dims.width.min || width > dims.width.max)) {
          violations.push({
            type: 'dimension',
            severity: 'error',
            bomLineKey: line.bomTemplateLineKey,
            message: `${comp.name} width ${width}mm outside DKB range [${dims.width.min}–${dims.width.max}mm]`,
            dkbEntryId: comp.id,
            suggestion: `Adjust width to ${dims.width.min}–${dims.width.max}mm`,
          });
        }
        if (depth > 0 && (depth < dims.depth.min || depth > dims.depth.max)) {
          violations.push({
            type: 'dimension',
            severity: 'error',
            bomLineKey: line.bomTemplateLineKey,
            message: `${comp.name} depth ${depth}mm outside DKB range [${dims.depth.min}–${dims.depth.max}mm]`,
            dkbEntryId: comp.id,
            suggestion: `Adjust depth to ${dims.depth.min}–${dims.depth.max}mm`,
          });
        }
        break; // Only match first component
      }
    }
  }

  return violations;
}

/**
 * Check material assignments against DKB material rules.
 * Flags incompatible finish/substrate combinations.
 */
export async function validateMaterialCompatibility(
  bom: ComputedBOMLine[],
): Promise<DKBViolation[]> {
  const violations: DKBViolation[] = [];

  // Group BOM lines by board vs finish to check pairs
  const boardLines = bom.filter(l => {
    const cat = l.materialCategory.toLowerCase();
    return cat.includes('board') || cat.includes('panel') || cat.includes('sheet');
  });

  for (const boardLine of boardLines) {
    const substrateCategory = boardLine.materialCategory;

    // Check each substrate against known material rules
    const rules = await getMaterialRules('', substrateCategory);
    for (const rule of rules) {
      for (const pair of rule.incompatiblePairs) {
        if (pair.a === substrateCategory || pair.b === substrateCategory) {
          violations.push({
            type: 'material_compatibility',
            severity: 'warning',
            bomLineKey: boardLine.bomTemplateLineKey,
            message: `Material incompatibility: ${pair.a} + ${pair.b} — ${pair.reason}`,
            dkbEntryId: rule.id,
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Ensure BOM part names follow DKB naming conventions.
 * Validates that part descriptions match known component names in the DKB.
 */
export async function validatePartNaming(
  bom: ComputedBOMLine[],
): Promise<DKBViolation[]> {
  const violations: DKBViolation[] = [];

  // Fetch all known component names from DKB
  const components = await searchEntries('', 'component', 100);
  const knownNames = new Set(
    components.map(c => c.name.toLowerCase()),
  );

  for (const line of bom) {
    const desc = line.description.toLowerCase();
    const cat = line.materialCategory.toLowerCase();

    // Skip hardware lines — they follow different naming
    if (cat.includes('hardware') || cat.includes('hinge') || cat.includes('handle')) {
      continue;
    }

    // Check if any known component name appears in the description
    const hasKnownName = [...knownNames].some(name => desc.includes(name) || cat.includes(name));

    if (!hasKnownName && knownNames.size > 0) {
      violations.push({
        type: 'naming',
        severity: 'info',
        bomLineKey: line.bomTemplateLineKey,
        message: `Part "${line.description}" does not match any DKB component name`,
        suggestion: `Consider using a standard name: ${[...knownNames].slice(0, 5).join(', ')}`,
      });
    }
  }

  return violations;
}
