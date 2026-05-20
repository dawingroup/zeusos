/**
 * Skills Catalog - DawinOS v2.0
 * Defines skills and competencies for role matching and task assignment
 */

import { SkillCategory, ProficiencyLevel } from '../types/role-profile.types';

// ============================================
// Skill Definition Type
// ============================================

export interface SkillDefinition {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
  hrCategory: 'technical' | 'soft' | 'language' | 'certification' | 'other'; // Maps to HR EmployeeSkill
  keywords: string[];
  subsidiaries: ('all' | 'finishes' | 'advisory' | 'technology' | 'capital')[];
  departments: string[];
  relatedSkills?: string[];
}

// ============================================
// Dawin Finishes Skills
// ============================================

export const FINISHES_SKILLS: SkillDefinition[] = [
  // Design Skills
  {
    id: 'cad-modeling',
    name: 'CAD Modeling',
    category: 'creative',
    description: '2D/3D computer-aided design using software like AutoCAD, SketchUp, or SolidWorks',
    hrCategory: 'technical',
    keywords: ['CAD', 'AutoCAD', 'SketchUp', 'SolidWorks', '3D modeling', 'drafting'],
    subsidiaries: ['finishes'],
    departments: ['design'],
    relatedSkills: ['technical-drawing', '3d-visualization'],
  },
  {
    id: 'technical-drawing',
    name: 'Technical Drawing',
    category: 'technical',
    description: 'Creating detailed production drawings with dimensions, tolerances, and specifications',
    hrCategory: 'technical',
    keywords: ['shop drawings', 'production drawings', 'blueprints', 'detailing'],
    subsidiaries: ['finishes'],
    departments: ['design'],
    relatedSkills: ['cad-modeling', 'manufacturing-processes'],
  },
  {
    id: '3d-visualization',
    name: '3D Visualization',
    category: 'creative',
    description: 'Creating photorealistic renders and visualizations for client presentations',
    hrCategory: 'technical',
    keywords: ['rendering', 'V-Ray', 'Lumion', 'visualization', '3D renders'],
    subsidiaries: ['finishes'],
    departments: ['design'],
    relatedSkills: ['cad-modeling'],
  },
  {
    id: 'material-knowledge',
    name: 'Material Knowledge',
    category: 'technical',
    description: 'Understanding of wood species, sheet materials, hardware, and finishes',
    hrCategory: 'technical',
    keywords: ['wood', 'veneer', 'MDF', 'plywood', 'hardware', 'finishes', 'materials'],
    subsidiaries: ['finishes'],
    departments: ['design', 'production', 'procurement'],
    relatedSkills: ['joinery-design', 'finish-specifications'],
  },
  {
    id: 'joinery-design',
    name: 'Joinery Design',
    category: 'technical',
    description: 'Designing wood joints, connections, and structural elements',
    hrCategory: 'technical',
    keywords: ['joinery', 'joints', 'mortise', 'tenon', 'dovetail', 'connections'],
    subsidiaries: ['finishes'],
    departments: ['design', 'production'],
    relatedSkills: ['material-knowledge', 'manufacturing-processes'],
  },
  {
    id: 'finish-specifications',
    name: 'Finish Specifications',
    category: 'technical',
    description: 'Specifying surface finishes, paints, lacquers, and coatings',
    hrCategory: 'technical',
    keywords: ['lacquer', 'paint', 'stain', 'varnish', 'coating', 'finish'],
    subsidiaries: ['finishes'],
    departments: ['design', 'production'],
    relatedSkills: ['material-knowledge'],
  },

  // Production Skills
  {
    id: 'cnc-programming',
    name: 'CNC Programming',
    category: 'technical',
    description: 'Programming CNC routers, panel saws, and machining centers',
    hrCategory: 'technical',
    keywords: ['CNC', 'G-code', 'CAM', 'router', 'nesting', 'machining'],
    subsidiaries: ['finishes'],
    departments: ['production'],
    relatedSkills: ['cad-modeling', 'material-optimization'],
  },
  {
    id: 'cad-cam-software',
    name: 'CAD/CAM Software',
    category: 'technical',
    description: 'Proficiency in CAD/CAM software for CNC production',
    hrCategory: 'technical',
    keywords: ['CAD/CAM', 'Alphacam', 'Cabinet Vision', 'Polyboard', 'Mastercam'],
    subsidiaries: ['finishes'],
    departments: ['production', 'design'],
    relatedSkills: ['cnc-programming', 'cad-modeling'],
  },
  {
    id: 'material-optimization',
    name: 'Material Optimization',
    category: 'technical',
    description: 'Optimizing cutting patterns for material efficiency and waste reduction',
    hrCategory: 'technical',
    keywords: ['nesting', 'yield', 'optimization', 'cutting', 'waste reduction'],
    subsidiaries: ['finishes'],
    departments: ['production'],
    relatedSkills: ['cnc-programming', 'production-planning'],
  },
  {
    id: 'production-planning',
    name: 'Production Planning',
    category: 'operational',
    description: 'Planning and scheduling production activities and capacity',
    hrCategory: 'technical',
    keywords: ['scheduling', 'capacity', 'planning', 'production', 'workflow'],
    subsidiaries: ['finishes'],
    departments: ['production'],
    relatedSkills: ['material-optimization', 'quality-management'],
  },
  {
    id: 'quality-assurance',
    name: 'Quality Assurance',
    category: 'technical',
    description: 'Ensuring quality standards through inspection and process control',
    hrCategory: 'technical',
    keywords: ['QA', 'QC', 'inspection', 'quality', 'standards', 'defects'],
    subsidiaries: ['finishes'],
    departments: ['production'],
    relatedSkills: ['process-improvement'],
  },
  {
    id: 'process-improvement',
    name: 'Process Improvement',
    category: 'technical',
    description: 'Identifying and implementing process improvements',
    hrCategory: 'technical',
    keywords: ['lean', 'continuous improvement', 'efficiency', 'optimization'],
    subsidiaries: ['finishes'],
    departments: ['production'],
    relatedSkills: ['quality-assurance'],
  },
  {
    id: 'equipment-maintenance',
    name: 'Equipment Maintenance',
    category: 'technical',
    description: 'Maintaining and repairing workshop machinery and equipment',
    hrCategory: 'technical',
    keywords: ['maintenance', 'repair', 'machinery', 'equipment', 'preventive'],
    subsidiaries: ['finishes'],
    departments: ['production'],
    relatedSkills: ['mechanical-repair', 'electrical-systems'],
  },
  {
    id: 'mechanical-repair',
    name: 'Mechanical Repair',
    category: 'technical',
    description: 'Diagnosing and repairing mechanical systems',
    hrCategory: 'technical',
    keywords: ['mechanical', 'repair', 'diagnosis', 'troubleshooting'],
    subsidiaries: ['finishes'],
    departments: ['production'],
    relatedSkills: ['equipment-maintenance'],
  },
  {
    id: 'electrical-systems',
    name: 'Electrical Systems',
    category: 'technical',
    description: 'Understanding and troubleshooting electrical systems',
    hrCategory: 'technical',
    keywords: ['electrical', 'wiring', 'motors', 'controls', 'PLC'],
    subsidiaries: ['finishes'],
    departments: ['production'],
    relatedSkills: ['equipment-maintenance'],
  },

  // Operations Skills
  {
    id: 'inventory-management',
    name: 'Inventory Management',
    category: 'operational',
    description: 'Managing stock levels, materials, and inventory control',
    hrCategory: 'technical',
    keywords: ['inventory', 'stock', 'warehouse', 'materials', 'control'],
    subsidiaries: ['finishes'],
    departments: ['logistics', 'procurement'],
    relatedSkills: ['stock-control', 'procurement'],
  },
  {
    id: 'stock-control',
    name: 'Stock Control',
    category: 'operational',
    description: 'Maintaining accurate stock records and levels',
    hrCategory: 'technical',
    keywords: ['stock', 'counting', 'records', 'control', 'reconciliation'],
    subsidiaries: ['finishes'],
    departments: ['logistics'],
    relatedSkills: ['inventory-management'],
  },
  {
    id: 'procurement',
    name: 'Procurement',
    category: 'operational',
    description: 'Sourcing and purchasing materials, hardware, and services',
    hrCategory: 'technical',
    keywords: ['purchasing', 'sourcing', 'suppliers', 'vendors', 'buying'],
    subsidiaries: ['finishes'],
    departments: ['procurement'],
    relatedSkills: ['vendor-management', 'cost-management'],
  },
  {
    id: 'vendor-management',
    name: 'Vendor Management',
    category: 'operational',
    description: 'Managing supplier relationships and performance',
    hrCategory: 'technical',
    keywords: ['suppliers', 'vendors', 'relationships', 'performance'],
    subsidiaries: ['finishes'],
    departments: ['procurement'],
    relatedSkills: ['procurement'],
  },
  {
    id: 'cost-management',
    name: 'Cost Management',
    category: 'financial',
    description: 'Managing costs and budgets in operations',
    hrCategory: 'technical',
    keywords: ['costs', 'budget', 'pricing', 'margins', 'profitability'],
    subsidiaries: ['finishes'],
    departments: ['procurement', 'production', 'operations'],
    relatedSkills: ['procurement'],
  },

  // Customer & Project Skills
  {
    id: 'client-relations',
    name: 'Client Relations',
    category: 'customer',
    description: 'Building and maintaining client relationships',
    hrCategory: 'soft',
    keywords: ['client', 'customer', 'relationship', 'communication'],
    subsidiaries: ['finishes'],
    departments: ['design', 'operations'],
    relatedSkills: ['project-coordination'],
  },
  {
    id: 'project-coordination',
    name: 'Project Coordination',
    category: 'operational',
    description: 'Coordinating project activities and stakeholders',
    hrCategory: 'soft',
    keywords: ['coordination', 'project', 'stakeholders', 'communication'],
    subsidiaries: ['finishes'],
    departments: ['operations'],
    relatedSkills: ['client-relations', 'project-management'],
  },
  {
    id: 'project-management',
    name: 'Project Management',
    category: 'management',
    description: 'Managing project scope, schedule, and resources',
    hrCategory: 'soft',
    keywords: ['project', 'management', 'schedule', 'budget', 'scope'],
    subsidiaries: ['finishes'],
    departments: ['operations'],
    relatedSkills: ['project-coordination', 'team-leadership'],
  },

  // E-commerce Skills
  {
    id: 'ecommerce-platforms',
    name: 'E-commerce Platforms',
    category: 'technical',
    description: 'Managing online stores on platforms like Shopify',
    hrCategory: 'technical',
    keywords: ['Shopify', 'e-commerce', 'online', 'store', 'listings'],
    subsidiaries: ['finishes'],
    departments: ['operations'],
    relatedSkills: ['product-content', 'seo-sem'],
  },
  {
    id: 'product-content',
    name: 'Product Content',
    category: 'creative',
    description: 'Creating product descriptions, images, and marketing content',
    hrCategory: 'technical',
    keywords: ['content', 'copywriting', 'photography', 'product', 'marketing'],
    subsidiaries: ['finishes'],
    departments: ['operations'],
    relatedSkills: ['ecommerce-platforms'],
  },
  {
    id: 'seo-sem',
    name: 'SEO/SEM',
    category: 'technical',
    description: 'Search engine optimization and marketing',
    hrCategory: 'technical',
    keywords: ['SEO', 'SEM', 'search', 'keywords', 'rankings', 'traffic'],
    subsidiaries: ['finishes'],
    departments: ['operations'],
    relatedSkills: ['ecommerce-platforms', 'product-content'],
  },

  // Interior Design Skills
  {
    id: 'design-concepts',
    name: 'Design Concepts',
    category: 'creative',
    description: 'Creating and developing interior design concepts and aesthetic direction',
    hrCategory: 'technical',
    keywords: ['interior design', 'concepts', 'aesthetics', 'style', 'mood boards'],
    subsidiaries: ['finishes'],
    departments: ['design'],
    relatedSkills: ['color-theory', '3d-visualization'],
  },
  {
    id: 'space-planning',
    name: 'Space Planning',
    category: 'creative',
    description: 'Analyzing spatial requirements and creating functional layouts',
    hrCategory: 'technical',
    keywords: ['space planning', 'layout', 'floor plan', 'circulation', 'zoning'],
    subsidiaries: ['finishes'],
    departments: ['design'],
    relatedSkills: ['site-analysis', 'building-code-knowledge'],
  },
  {
    id: 'color-theory',
    name: 'Color Theory',
    category: 'creative',
    description: 'Understanding color psychology, harmony, and application in design',
    hrCategory: 'technical',
    keywords: ['color', 'palette', 'harmony', 'psychology', 'schemes'],
    subsidiaries: ['finishes'],
    departments: ['design'],
    relatedSkills: ['design-concepts', 'material-knowledge'],
  },
  {
    id: 'building-code-knowledge',
    name: 'Building Code Knowledge',
    category: 'compliance',
    description: 'Understanding building codes, accessibility, and safety requirements',
    hrCategory: 'certification',
    keywords: ['building codes', 'regulations', 'accessibility', 'safety', 'compliance'],
    subsidiaries: ['finishes'],
    departments: ['design'],
    relatedSkills: ['space-planning', 'site-analysis'],
  },
  {
    id: 'site-analysis',
    name: 'Site Analysis',
    category: 'technical',
    description: 'Analyzing site conditions, constraints, and opportunities',
    hrCategory: 'technical',
    keywords: ['site', 'analysis', 'constraints', 'survey', 'assessment'],
    subsidiaries: ['finishes'],
    departments: ['design'],
    relatedSkills: ['space-planning', 'building-code-knowledge'],
  },
  {
    id: 'active-listening',
    name: 'Active Listening',
    category: 'customer',
    description: 'Attentively listening to client needs and understanding requirements',
    hrCategory: 'soft',
    keywords: ['listening', 'empathy', 'understanding', 'communication', 'needs'],
    subsidiaries: ['finishes'],
    departments: ['design', 'operations'],
    relatedSkills: ['client-relations', 'conflict-resolution'],
  },
  {
    id: 'conflict-resolution',
    name: 'Conflict Resolution',
    category: 'customer',
    description: 'Managing and resolving conflicts with clients and stakeholders',
    hrCategory: 'soft',
    keywords: ['conflict', 'resolution', 'negotiation', 'mediation', 'problem-solving'],
    subsidiaries: ['finishes'],
    departments: ['operations'],
    relatedSkills: ['client-relations', 'active-listening'],
  },
  {
    id: 'site-safety',
    name: 'Site Safety',
    category: 'operational',
    description: 'Ensuring workplace safety on installation and construction sites',
    hrCategory: 'certification',
    keywords: ['safety', 'site', 'hazards', 'PPE', 'regulations', 'workplace'],
    subsidiaries: ['finishes'],
    departments: ['operations'],
    relatedSkills: ['project-coordination', 'logistics-management'],
  },
  {
    id: 'sustainability-knowledge',
    name: 'Sustainability Knowledge',
    category: 'technical',
    description: 'Understanding sustainable materials, practices, and certifications',
    hrCategory: 'certification',
    keywords: ['sustainability', 'green', 'eco-friendly', 'LEED', 'carbon', 'environment'],
    subsidiaries: ['finishes'],
    departments: ['design', 'procurement'],
    relatedSkills: ['material-knowledge', 'vendor-management'],
  },
  {
    id: 'logistics-management',
    name: 'Logistics Management',
    category: 'operational',
    description: 'Managing delivery, installation scheduling, and on-site coordination',
    hrCategory: 'technical',
    keywords: ['logistics', 'delivery', 'scheduling', 'coordination', 'installation'],
    subsidiaries: ['finishes'],
    departments: ['operations'],
    relatedSkills: ['project-coordination', 'site-safety'],
  },

  // Management Skills
  {
    id: 'team-leadership',
    name: 'Team Leadership',
    category: 'management',
    description: 'Leading and motivating team members',
    hrCategory: 'soft',
    keywords: ['leadership', 'team', 'motivation', 'management'],
    subsidiaries: ['all'],
    departments: ['design', 'production', 'operations'],
    relatedSkills: ['project-management'],
  },
  {
    id: 'design-leadership',
    name: 'Design Leadership',
    category: 'management',
    description: 'Leading design teams and setting design direction',
    hrCategory: 'soft',
    keywords: ['design', 'leadership', 'creative', 'direction'],
    subsidiaries: ['finishes'],
    departments: ['design'],
    relatedSkills: ['team-leadership', 'cad-modeling'],
  },
  {
    id: 'production-management',
    name: 'Production Management',
    category: 'management',
    description: 'Managing production operations and teams',
    hrCategory: 'soft',
    keywords: ['production', 'management', 'operations', 'manufacturing'],
    subsidiaries: ['finishes'],
    departments: ['production'],
    relatedSkills: ['team-leadership', 'quality-assurance'],
  },
  {
    id: 'quality-management',
    name: 'Quality Management',
    category: 'management',
    description: 'Managing quality systems and processes',
    hrCategory: 'soft',
    keywords: ['quality', 'management', 'systems', 'ISO', 'standards'],
    subsidiaries: ['finishes'],
    departments: ['production'],
    relatedSkills: ['quality-assurance', 'process-improvement'],
  },
];

// ============================================
// Shared/Cross-Subsidiary Skills
// ============================================

export const SHARED_SKILLS: SkillDefinition[] = [
  {
    id: 'documentation',
    name: 'Documentation',
    category: 'administrative',
    description: 'Creating and maintaining accurate documentation',
    hrCategory: 'soft',
    keywords: ['documentation', 'records', 'writing', 'reports'],
    subsidiaries: ['all'],
    departments: ['design', 'production', 'operations', 'procurement'],
  },
  {
    id: 'communication',
    name: 'Communication',
    category: 'customer',
    description: 'Clear verbal and written communication',
    hrCategory: 'soft',
    keywords: ['communication', 'verbal', 'written', 'presentation'],
    subsidiaries: ['all'],
    departments: ['design', 'production', 'operations'],
  },
  {
    id: 'problem-solving',
    name: 'Problem Solving',
    category: 'technical',
    description: 'Analyzing problems and developing solutions',
    hrCategory: 'soft',
    keywords: ['problem', 'solving', 'analysis', 'solutions', 'troubleshooting'],
    subsidiaries: ['all'],
    departments: ['design', 'production', 'operations'],
  },
];

// ============================================
// Complete Skills Catalog
// ============================================

export const SKILLS_CATALOG: SkillDefinition[] = [
  ...FINISHES_SKILLS,
  ...SHARED_SKILLS,
];

// ============================================
// Skill Lookup Functions
// ============================================

/**
 * Get skill definition by ID
 */
export function getSkillById(skillId: string): SkillDefinition | undefined {
  return SKILLS_CATALOG.find((s) => s.id === skillId);
}

/**
 * Get skills by category
 */
export function getSkillsByCategory(category: SkillCategory): SkillDefinition[] {
  return SKILLS_CATALOG.filter((s) => s.category === category);
}

/**
 * Get skills by subsidiary
 */
export function getSkillsBySubsidiary(
  subsidiary: 'finishes' | 'advisory' | 'technology' | 'capital'
): SkillDefinition[] {
  return SKILLS_CATALOG.filter(
    (s) => s.subsidiaries.includes(subsidiary) || s.subsidiaries.includes('all')
  );
}

/**
 * Get skills by department
 */
export function getSkillsByDepartment(departmentId: string): SkillDefinition[] {
  return SKILLS_CATALOG.filter((s) => s.departments.includes(departmentId));
}

/**
 * Search skills by keyword
 */
export function searchSkills(query: string): SkillDefinition[] {
  const lowerQuery = query.toLowerCase();
  return SKILLS_CATALOG.filter(
    (s) =>
      s.name.toLowerCase().includes(lowerQuery) ||
      s.description.toLowerCase().includes(lowerQuery) ||
      s.keywords.some((k) => k.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Map role skill category to HR skill category
 */
export function mapToHRSkillCategory(
  roleCategory: SkillCategory
): 'technical' | 'soft' | 'language' | 'certification' | 'other' {
  const mapping: Record<SkillCategory, 'technical' | 'soft' | 'language' | 'certification' | 'other'> =
    {
      technical: 'technical',
      management: 'soft',
      financial: 'technical',
      customer: 'soft',
      operational: 'technical',
      strategic: 'soft',
      compliance: 'certification',
      administrative: 'soft',
      creative: 'technical',
      sales: 'soft',
      analytical: 'technical',
    };
  return mapping[roleCategory];
}

/**
 * Get proficiency level display text
 */
export function getProficiencyLabel(level: ProficiencyLevel): string {
  const labels: Record<ProficiencyLevel, string> = {
    novice: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    expert: 'Expert',
  };
  return labels[level];
}

/**
 * Convert proficiency levels between systems
 * Role profile uses: 'novice' | 'intermediate' | 'advanced' | 'expert'
 * HR uses: 'beginner' | 'intermediate' | 'advanced' | 'expert'
 */
export function normalizeHRProficiency(
  hrLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert'
): ProficiencyLevel {
  if (hrLevel === 'beginner') return 'novice';
  return hrLevel;
}

export function normalizeRoleProficiency(
  roleLevel: ProficiencyLevel
): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
  if (roleLevel === 'novice') return 'beginner';
  return roleLevel;
}
