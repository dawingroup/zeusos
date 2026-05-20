/**
 * MatFlow AI Module Index
 * 
 * Central export for AI-powered BOQ parsing functionality.
 */

// Core AI Parser
export {
  analyzeExcelStructureLocally,
  parseSectionLocally,
  parseFullBOQLocally,
  type ExcelAnalysisInput,
  type ExcelAnalysisResult,
  type SectionParsingInput,
  type SectionParsingResult,
  type ParsedItemResult,
  type FullParsingInput,
  type FullParsingResult,
} from './boq-parser-ai';

// Prompt Templates
export {
  BOQ_PARSER_SYSTEM_PROMPT,
  EXCEL_ANALYSIS_PROMPT,
  SECTION_PARSING_PROMPT,
  MATERIAL_MATCHING_PROMPT,
  VALIDATION_PROMPT,
  UNIT_NORMALIZATION_PROMPT,
  CATEGORY_DETECTION_PROMPT,
  buildParsingPrompt,
  extractJSON,
  validateResponse,
  normalizeText,
  generateTempId,
} from './parsing-prompts';

// Confidence Scoring
export {
  calculateOverallConfidence,
  calculateFieldConfidence,
  calculateItemConfidence,
  calculateSectionConfidence,
  getConfidenceLevel,
  getReviewStatus,
  getConfidenceColor,
} from './confidence-scorer';

// Material Matching
export {
  matchMaterialsLocally,
  matchMaterialsBatched,
  applyMatchesToItems,
  type MatchingInput,
  type MaterialLibraryEntry,
  type MatchingResult,
} from './material-matcher-ai';
