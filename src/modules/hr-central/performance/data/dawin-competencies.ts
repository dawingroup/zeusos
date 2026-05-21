// ============================================================================
// DAWIN GROUP STANDARD COMPETENCY FRAMEWORK
// ZeusOS v2.0 - HR Performance Module
// Standard competencies for consulting/advisory/investment firm
// ============================================================================

import type { Competency, CompetencyCategory } from '../types/development.types';

/**
 * Standard Competency Framework for Zeus Group
 * Covers: Advisory, Capital, Finishes, and Technology subsidiaries
 */

export const DAWIN_COMPETENCIES: Omit<Competency, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>[] = [
  // ========================================
  // TECHNICAL COMPETENCIES
  // ========================================
  {
    name: 'Financial Modeling & Analysis',
    description: 'Ability to build and analyze financial models for investment decisions and business planning',
    category: 'technical',
    isActive: true,
    applicableRoles: ['Financial Analyst', 'Investment Analyst', 'Associate', 'Consultant'],
    levelDefinitions: [
      {
        level: 'novice',
        description: 'Learning financial modeling basics',
        indicators: [
          'Can understand basic financial statements',
          'Familiar with Excel formulas',
          'Requires guidance on model structure',
        ],
      },
      {
        level: 'beginner',
        description: 'Can build simple models with supervision',
        indicators: [
          'Builds basic 3-statement models',
          'Understands DCF concepts',
          'Can perform sensitivity analysis',
        ],
      },
      {
        level: 'intermediate',
        description: 'Independently builds robust financial models',
        indicators: [
          'Creates complex LBO and M&A models',
          'Performs scenario analysis independently',
          'Validates model accuracy',
        ],
      },
      {
        level: 'advanced',
        description: 'Builds sophisticated models and guides others',
        indicators: [
          'Designs custom valuation frameworks',
          'Mentors junior analysts on modeling',
          'Identifies and fixes model errors quickly',
        ],
      },
      {
        level: 'expert',
        description: 'Subject matter expert in financial modeling',
        indicators: [
          'Develops firm-wide modeling standards',
          'Trains teams on advanced techniques',
          'Innovates new modeling approaches',
        ],
      },
    ],
  },

  {
    name: 'Industry & Market Analysis',
    description: 'Deep understanding of industry dynamics, market trends, and competitive landscapes',
    category: 'technical',
    isActive: true,
    applicableRoles: ['Consultant', 'Analyst', 'Associate', 'Manager'],
    levelDefinitions: [
      {
        level: 'novice',
        description: 'Learning industry research methods',
        indicators: [
          'Can gather basic industry data',
          'Understands common industry terms',
          'Requires guidance on analysis approach',
        ],
      },
      {
        level: 'beginner',
        description: 'Conducts supervised industry research',
        indicators: [
          'Performs competitive analysis',
          'Identifies key market trends',
          'Uses industry databases effectively',
        ],
      },
      {
        level: 'intermediate',
        description: 'Independent industry expert in specific sectors',
        indicators: [
          'Provides deep sector insights',
          'Identifies investment opportunities',
          'Builds industry network',
        ],
      },
      {
        level: 'advanced',
        description: 'Recognized authority in multiple industries',
        indicators: [
          'Advises on strategic positioning',
          'Predicts market shifts',
          'Published thought leadership',
        ],
      },
      {
        level: 'expert',
        description: 'Market leader and industry influencer',
        indicators: [
          'Shapes industry conversations',
          'Advises C-suite on market strategy',
          'Regular media contributor',
        ],
      },
    ],
  },

  {
    name: 'Project Management',
    description: 'Planning, executing, and delivering projects on time and within scope',
    category: 'technical',
    isActive: true,
    applicableRoles: ['Project Manager', 'Consultant', 'Manager', 'Associate'],
    levelDefinitions: [
      {
        level: 'novice',
        description: 'Supports project activities',
        indicators: [
          'Tracks project tasks',
          'Updates project documentation',
          'Participates in team meetings',
        ],
      },
      {
        level: 'beginner',
        description: 'Manages small project workstreams',
        indicators: [
          'Creates project plans',
          'Coordinates team activities',
          'Reports progress to stakeholders',
        ],
      },
      {
        level: 'intermediate',
        description: 'Independently manages full projects',
        indicators: [
          'Manages budgets and timelines',
          'Resolves project conflicts',
          'Delivers projects successfully',
        ],
      },
      {
        level: 'advanced',
        description: 'Manages complex multi-workstream projects',
        indicators: [
          'Handles multiple concurrent projects',
          'Mentors junior PMs',
          'Innovates project methodologies',
        ],
      },
      {
        level: 'expert',
        description: 'Strategic program director',
        indicators: [
          'Oversees enterprise programs',
          'Defines PM best practices',
          'Certified in multiple methodologies (PMP, Agile)',
        ],
      },
    ],
  },

  // ========================================
  // CLIENT MANAGEMENT COMPETENCIES
  // ========================================
  {
    name: 'Client Relationship Management',
    description: 'Building and maintaining strong client relationships and trust',
    category: 'client',
    isActive: true,
    applicableRoles: ['Consultant', 'Manager', 'Partner', 'Associate'],
    levelDefinitions: [
      {
        level: 'novice',
        description: 'Learning client interaction basics',
        indicators: [
          'Participates in client meetings',
          'Follows client communication protocols',
          'Responds to client requests promptly',
        ],
      },
      {
        level: 'beginner',
        description: 'Manages client touchpoints',
        indicators: [
          'Leads client working sessions',
          'Handles routine client queries',
          'Builds rapport with client teams',
        ],
      },
      {
        level: 'intermediate',
        description: 'Trusted client advisor',
        indicators: [
          'Manages client relationships independently',
          'Identifies client needs proactively',
          'Generates repeat business',
        ],
      },
      {
        level: 'advanced',
        description: 'Strategic client partner',
        indicators: [
          'Advises C-suite clients',
          'Expands account relationships',
          'Resolves complex client issues',
        ],
      },
      {
        level: 'expert',
        description: 'Client portfolio leader',
        indicators: [
          'Manages key accounts portfolio',
          'Drives significant revenue growth',
          'Recognized as trusted advisor by industry',
        ],
      },
    ],
  },

  {
    name: 'Presentation & Communication',
    description: 'Effectively communicating complex ideas to diverse audiences',
    category: 'client',
    isActive: true,
    applicableRoles: ['Consultant', 'Analyst', 'Manager', 'Associate'],
    levelDefinitions: [
      {
        level: 'novice',
        description: 'Developing presentation skills',
        indicators: [
          'Creates basic slides',
          'Presents to small internal teams',
          'Requires significant feedback',
        ],
      },
      {
        level: 'beginner',
        description: 'Delivers clear presentations',
        indicators: [
          'Presents findings confidently',
          'Uses data visualization effectively',
          'Handles Q&A adequately',
        ],
      },
      {
        level: 'intermediate',
        description: 'Compelling presenter',
        indicators: [
          'Tailors message to audience',
          'Presents to senior stakeholders',
          'Persuades and influences',
        ],
      },
      {
        level: 'advanced',
        description: 'Executive communicator',
        indicators: [
          'Presents to C-suite and boards',
          'Handles difficult questions skillfully',
          'Coaches others on presentations',
        ],
      },
      {
        level: 'expert',
        description: 'Master communicator',
        indicators: [
          'Keynote speaker at conferences',
          'Shapes organizational narrative',
          'Media spokesperson',
        ],
      },
    ],
  },

  // ========================================
  // LEADERSHIP COMPETENCIES
  // ========================================
  {
    name: 'Team Leadership & Development',
    description: 'Leading, motivating, and developing high-performing teams',
    category: 'leadership',
    isActive: true,
    applicableRoles: ['Manager', 'Senior Manager', 'Director', 'Partner'],
    levelDefinitions: [
      {
        level: 'novice',
        description: 'Learning leadership fundamentals',
        indicators: [
          'Contributes as team member',
          'Supports team initiatives',
          'Shares knowledge with peers',
        ],
      },
      {
        level: 'beginner',
        description: 'Leads small teams or workstreams',
        indicators: [
          'Delegates tasks effectively',
          'Provides constructive feedback',
          'Resolves minor team conflicts',
        ],
      },
      {
        level: 'intermediate',
        description: 'Manages team performance',
        indicators: [
          'Builds high-performing teams',
          'Develops team members actively',
          'Creates inclusive team culture',
        ],
      },
      {
        level: 'advanced',
        description: 'Strategic people leader',
        indicators: [
          'Leads cross-functional teams',
          'Succession planning for key roles',
          'Drives organizational change',
        ],
      },
      {
        level: 'expert',
        description: 'Organizational leader',
        indicators: [
          'Sets leadership standards',
          'Develops future leaders',
          'Shapes company culture',
        ],
      },
    ],
  },

  {
    name: 'Strategic Thinking',
    description: 'Analyzing complex situations and developing long-term strategies',
    category: 'leadership',
    isActive: true,
    applicableRoles: ['Manager', 'Director', 'Partner', 'Consultant'],
    levelDefinitions: [
      {
        level: 'novice',
        description: 'Learning strategic concepts',
        indicators: [
          'Understands business objectives',
          'Contributes to strategy discussions',
          'Thinks beyond immediate tasks',
        ],
      },
      {
        level: 'beginner',
        description: 'Applies strategic frameworks',
        indicators: [
          'Uses strategic analysis tools',
          'Identifies strategic options',
          'Connects tactics to strategy',
        ],
      },
      {
        level: 'intermediate',
        description: 'Develops strategic recommendations',
        indicators: [
          'Formulates business strategies',
          'Evaluates strategic alternatives',
          'Anticipates market changes',
        ],
      },
      {
        level: 'advanced',
        description: 'Strategic advisor and visionary',
        indicators: [
          'Shapes organizational strategy',
          'Advises on transformational initiatives',
          'Balances short and long-term goals',
        ],
      },
      {
        level: 'expert',
        description: 'Strategic thought leader',
        indicators: [
          'Defines industry strategy trends',
          'Boards and advisory councils',
          'Published strategist',
        ],
      },
    ],
  },

  // ========================================
  // CORE COMPETENCIES (Company-wide)
  // ========================================
  {
    name: 'Problem Solving & Critical Thinking',
    description: 'Analyzing complex problems and developing innovative solutions',
    category: 'core',
    isActive: true,
    levelDefinitions: [
      {
        level: 'novice',
        description: 'Solving structured problems',
        indicators: [
          'Follows established processes',
          'Identifies obvious issues',
          'Seeks guidance on complex problems',
        ],
      },
      {
        level: 'beginner',
        description: 'Analyzes problems independently',
        indicators: [
          'Breaks down complex issues',
          'Uses analytical frameworks',
          'Proposes viable solutions',
        ],
      },
      {
        level: 'intermediate',
        description: 'Solves ambiguous problems',
        indicators: [
          'Handles unstructured challenges',
          'Develops creative solutions',
          'Evaluates trade-offs effectively',
        ],
      },
      {
        level: 'advanced',
        description: 'Master problem solver',
        indicators: [
          'Tackles organization-wide challenges',
          'Innovates new approaches',
          'Teaches problem-solving methods',
        ],
      },
      {
        level: 'expert',
        description: 'Thought leader in problem solving',
        indicators: [
          'Solves industry-level problems',
          'Publishes frameworks and methodologies',
          'Recognized expert',
        ],
      },
    ],
  },

  {
    name: 'Collaboration & Teamwork',
    description: 'Working effectively with diverse teams across the organization',
    category: 'behavioral',
    isActive: true,
    levelDefinitions: [
      {
        level: 'novice',
        description: 'Contributing team member',
        indicators: [
          'Participates in team activities',
          'Shares information willingly',
          'Respects diverse perspectives',
        ],
      },
      {
        level: 'beginner',
        description: 'Active collaborator',
        indicators: [
          'Works well in team settings',
          'Supports team goals',
          'Helps resolve team issues',
        ],
      },
      {
        level: 'intermediate',
        description: 'Cross-functional collaborator',
        indicators: [
          'Builds partnerships across teams',
          'Facilitates collaboration',
          'Leverages diverse expertise',
        ],
      },
      {
        level: 'advanced',
        description: 'Collaboration champion',
        indicators: [
          'Creates collaborative culture',
          'Leads cross-functional initiatives',
          'Breaks down silos',
        ],
      },
      {
        level: 'expert',
        description: 'Organizational connector',
        indicators: [
          'Drives enterprise collaboration',
          'Models collaborative leadership',
          'Builds strategic partnerships',
        ],
      },
    ],
  },

  {
    name: 'Adaptability & Learning Agility',
    description: 'Quickly adapting to change and continuously learning new skills',
    category: 'behavioral',
    isActive: true,
    levelDefinitions: [
      {
        level: 'novice',
        description: 'Open to learning',
        indicators: [
          'Willing to learn new things',
          'Adapts to minor changes',
          'Seeks feedback',
        ],
      },
      {
        level: 'beginner',
        description: 'Self-directed learner',
        indicators: [
          'Learns new skills independently',
          'Adapts approach when needed',
          'Embraces constructive feedback',
        ],
      },
      {
        level: 'intermediate',
        description: 'Change agent',
        indicators: [
          'Thrives in changing environments',
          'Quickly masters new domains',
          'Helps others adapt to change',
        ],
      },
      {
        level: 'advanced',
        description: 'Transformation leader',
        indicators: [
          'Drives organizational change',
          'Continuously reinvents approaches',
          'Develops others agility',
        ],
      },
      {
        level: 'expert',
        description: 'Innovation pioneer',
        indicators: [
          'Leads industry transformation',
          'Creates learning organizations',
          'Disrupts traditional models',
        ],
      },
    ],
  },

  {
    name: 'Integrity & Professional Ethics',
    description: 'Maintaining highest standards of integrity and ethical conduct',
    category: 'core',
    isActive: true,
    levelDefinitions: [
      {
        level: 'novice',
        description: 'Understanding ethical standards',
        indicators: [
          'Follows code of conduct',
          'Asks questions about ethical dilemmas',
          'Demonstrates honesty',
        ],
      },
      {
        level: 'beginner',
        description: 'Ethical practitioner',
        indicators: [
          'Makes ethical decisions consistently',
          'Speaks up about concerns',
          'Maintains confidentiality',
        ],
      },
      {
        level: 'intermediate',
        description: 'Ethics champion',
        indicators: [
          'Guides others on ethical matters',
          'Demonstrates courage in tough situations',
          'Builds trust with stakeholders',
        ],
      },
      {
        level: 'advanced',
        description: 'Ethics role model',
        indicators: [
          'Sets ethical standards for teams',
          'Handles complex ethical situations',
          'Trusted advisor on integrity matters',
        ],
      },
      {
        level: 'expert',
        description: 'Organizational conscience',
        indicators: [
          'Shapes organizational ethics',
          'Industry thought leader on ethics',
          'Drives ethical culture',
        ],
      },
    ],
  },
];

/**
 * Helper function to get competencies by category
 */
export function getCompetenciesByCategory(category: CompetencyCategory) {
  return DAWIN_COMPETENCIES.filter(c => c.category === category);
}

/**
 * Helper function to get competencies for a specific role
 */
export function getCompetenciesForRole(roleName: string) {
  return DAWIN_COMPETENCIES.filter(
    c => !c.applicableRoles || c.applicableRoles.includes(roleName)
  );
}
