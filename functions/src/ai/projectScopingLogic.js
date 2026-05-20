/**
 * Project Scoping Logic Module
 * 
 * Core logic for project scoping that can be used by both
 * the onCall Cloud Function and the Express API endpoint.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Room Type Ontology (Hospitality Standards)
const ROOM_ONTOLOGY = {
  guest_room_standard: {
    name: 'Standard Guest Room',
    items: [
      { type: 'wardrobe', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'bed_frame', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 1 },
      { type: 'nightstand', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 2 },
      { type: 'desk_unit', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 1 },
      { type: 'tv_unit', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'luggage_bench', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 1 },
      { type: 'bathroom_vanity', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'mirror_frame', category: 'MANUFACTURED', subcategory: 'accessories', quantity: 1 },
    ],
  },
  guest_room_suite: {
    name: 'Suite Guest Room',
    items: [
      { type: 'wardrobe_walk_in', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'bed_frame_king', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 1 },
      { type: 'nightstand', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 2 },
      { type: 'desk_executive', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 1 },
      { type: 'tv_unit_large', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'minibar_unit', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'seating_area', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 1 },
      { type: 'bathroom_vanity_double', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
    ],
  },
  restaurant: {
    name: 'Restaurant',
    items: [
      { type: 'dining_table_2_seater', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 0.3 },
      { type: 'dining_table_4_seater', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 0.5 },
      { type: 'dining_chair', category: 'PROCURED', subcategory: 'seating', quantity: 1 },
      { type: 'bar_counter', category: 'MANUFACTURED', subcategory: 'casework', quantity: 0.1 },
      { type: 'bar_stool', category: 'PROCURED', subcategory: 'seating', quantity: 0.2 },
      { type: 'service_station', category: 'MANUFACTURED', subcategory: 'casework', quantity: 0.15 },
      { type: 'host_stand', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 0.05 },
    ],
  },
  lobby: {
    name: 'Lobby/Reception',
    items: [
      { type: 'reception_desk', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'lounge_sofa', category: 'PROCURED', subcategory: 'seating', quantity: 2 },
      { type: 'lounge_chair', category: 'PROCURED', subcategory: 'seating', quantity: 4 },
      { type: 'coffee_table', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 2 },
      { type: 'console_table', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 1 },
      { type: 'luggage_rack', category: 'MANUFACTURED', subcategory: 'accessories', quantity: 2 },
    ],
  },
  kitchen: {
    name: 'Kitchen',
    items: [
      { type: 'base_cabinet', category: 'MANUFACTURED', subcategory: 'casework', quantity: 6 },
      { type: 'wall_cabinet', category: 'MANUFACTURED', subcategory: 'casework', quantity: 4 },
      { type: 'tall_cabinet', category: 'MANUFACTURED', subcategory: 'casework', quantity: 2 },
      { type: 'island', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'countertop', category: 'PROCURED', subcategory: 'surfaces', quantity: 1 },
    ],
  },
  office: {
    name: 'Office',
    items: [
      { type: 'desk_workstation', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 1 },
      { type: 'credenza', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'bookshelf', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'meeting_table', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 0.25 },
      { type: 'office_chair', category: 'PROCURED', subcategory: 'seating', quantity: 1 },
    ],
  },
};

/**
 * Extract entities from brief text
 */
function extractEntities(briefText) {
  const entities = {
    projectType: null,
    location: null,
    roomGroups: [],
    explicitItems: [],
    qualityLevel: 'commercial',
    timeline: null,
  };

  const lowerText = briefText.toLowerCase();

  // Project type detection
  const projectTypes = {
    hotel: ['hotel', 'lodge', 'resort', 'boutique hotel', 'guest house'],
    restaurant: ['restaurant', 'café', 'cafe', 'bistro', 'eatery', 'dining'],
    office: ['office', 'workspace', 'coworking', 'corporate'],
    retail: ['retail', 'shop', 'store', 'showroom', 'boutique'],
    residential: ['home', 'house', 'apartment', 'residence', 'villa'],
  };

  for (const [type, keywords] of Object.entries(projectTypes)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      entities.projectType = type;
      break;
    }
  }

  // Room group extraction with multipliers - more flexible patterns
  const roomPatterns = [
    // Guest rooms - multiple pattern variations
    { regex: /(\d+)\s*(?:standard\s+)?(?:guest\s+)?rooms?/gi, type: 'guest_room_standard' },
    { regex: /(?:guest\s+)?rooms?\s*[:\-]?\s*(\d+)/gi, type: 'guest_room_standard' },
    { regex: /(\d+)\s*bedrooms?/gi, type: 'guest_room_standard' },
    { regex: /bedrooms?\s*[:\-]?\s*(\d+)/gi, type: 'guest_room_standard' },
    // Suites
    { regex: /(\d+)\s*(?:junior\s+)?suites?/gi, type: 'guest_room_suite' },
    { regex: /suites?\s*[:\-]?\s*(\d+)/gi, type: 'guest_room_suite' },
    // Restaurant
    { regex: /restaurant\s*(?:with|seating|for)?\s*(\d+)\s*(?:seats|covers|pax|guests|people)?/gi, type: 'restaurant', countType: 'seats' },
    { regex: /(\d+)\s*(?:seat|cover|pax)\s*restaurant/gi, type: 'restaurant', countType: 'seats' },
    { regex: /dining\s*(?:area|room|space)?\s*(?:for)?\s*(\d+)/gi, type: 'restaurant', countType: 'seats' },
    // Lobby/reception - always 1
    { regex: /lobby|reception\s*(?:area|desk)?/gi, type: 'lobby', quantity: 1 },
    // Kitchen
    { regex: /(\d+)?\s*kitchens?/gi, type: 'kitchen', quantity: 1 },
    // Offices
    { regex: /(\d+)\s*offices?/gi, type: 'office' },
    { regex: /offices?\s*[:\-]?\s*(\d+)/gi, type: 'office' },
  ];

  // Track what we've already added to avoid duplicates
  const addedGroups = new Set();

  for (const pattern of roomPatterns) {
    let match;
    while ((match = pattern.regex.exec(briefText)) !== null) {
      const quantity = pattern.quantity || (match[1] ? parseInt(match[1], 10) : 1);
      const groupKey = `${pattern.type}-${quantity}`;
      
      // Avoid duplicates
      if (!addedGroups.has(groupKey) && quantity > 0) {
        addedGroups.add(groupKey);
        entities.roomGroups.push({
          type: pattern.type,
          quantity,
          countType: pattern.countType || 'units',
        });
      }
    }
    pattern.regex.lastIndex = 0;
  }

  // If no room groups found but we detected a project type, add a default
  if (entities.roomGroups.length === 0 && entities.projectType) {
    console.log('No specific room groups found, adding defaults for project type:', entities.projectType);
    switch (entities.projectType) {
      case 'hotel':
        entities.roomGroups.push({ type: 'guest_room_standard', quantity: 10, countType: 'units' });
        entities.roomGroups.push({ type: 'lobby', quantity: 1, countType: 'units' });
        break;
      case 'restaurant':
        entities.roomGroups.push({ type: 'restaurant', quantity: 40, countType: 'seats' });
        break;
      case 'office':
        entities.roomGroups.push({ type: 'office', quantity: 5, countType: 'units' });
        break;
      case 'residential':
        entities.roomGroups.push({ type: 'guest_room_standard', quantity: 3, countType: 'units' });
        break;
    }
  }

  // Quality level detection
  if (lowerText.includes('luxury') || lowerText.includes('premium') || lowerText.includes('5-star') || lowerText.includes('five star')) {
    entities.qualityLevel = 'luxury';
  } else if (lowerText.includes('budget') || lowerText.includes('economy')) {
    entities.qualityLevel = 'economy';
  }

  // Location extraction
  const locations = ['kampala', 'nairobi', 'dar es salaam', 'kigali', 'addis ababa', 'east africa', 'uganda', 'kenya', 'tanzania', 'rwanda', 'ethiopia'];
  for (const loc of locations) {
    if (lowerText.includes(loc)) {
      entities.location = loc.charAt(0).toUpperCase() + loc.slice(1);
      break;
    }
  }

  return entities;
}

/**
 * Expand room groups into deliverables
 */
function expandRoomGroups(roomGroups) {
  const deliverables = [];
  let deliverableId = 1;

  for (const group of roomGroups) {
    const ontology = ROOM_ONTOLOGY[group.type];
    if (!ontology) continue;

    const multiplier = group.countType === 'seats' ? Math.ceil(group.quantity / 4) : group.quantity;

    for (const item of ontology.items) {
      const itemQuantity = typeof item.quantity === 'number' && item.quantity < 1
        ? Math.ceil(multiplier * item.quantity)
        : multiplier * item.quantity;

      if (itemQuantity > 0) {
        deliverables.push({
          id: `del-${deliverableId++}`,
          name: item.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          itemType: item.type,
          category: item.category,
          subcategory: item.subcategory,
          quantity: itemQuantity,
          roomTypeName: ontology.name,
          roomTypeId: group.type,
          estimatedHoursPerUnit: 4,
          specifications: null,
          aiMetadata: {
            confidence: 0.85,
            source: 'room_ontology',
            requiresClarification: false,
          },
        });
      }
    }
  }

  return deliverables;
}

/**
 * Generate summary from deliverables
 */
function generateSummary(deliverables) {
  const summary = {
    totalDeliverables: deliverables.length,
    totalUnits: 0,
    byCategory: {},
    byRoomType: {},
    estimatedTotalHours: 0,
    itemsRequiringClarification: 0,
  };

  for (const del of deliverables) {
    summary.totalUnits += del.quantity;
    summary.byCategory[del.category] = (summary.byCategory[del.category] || 0) + del.quantity;
    summary.byRoomType[del.roomTypeName] = (summary.byRoomType[del.roomTypeName] || 0) + del.quantity;
    
    if (del.estimatedHoursPerUnit) {
      summary.estimatedTotalHours += del.estimatedHoursPerUnit * del.quantity;
    }
    
    if (del.aiMetadata?.requiresClarification) {
      summary.itemsRequiringClarification++;
    }
  }

  return summary;
}

/**
 * Main processing function
 */
async function processProjectScoping(options) {
  const {
    briefText,
    projectId,
    projectName,
    projectType: explicitProjectType,
    location: explicitLocation,
    includeResearch,
    geminiApiKey,
    db,
  } = options;

  const startTime = Date.now();

  // 1. Entity Extraction
  console.log('Phase 1: Entity extraction...');
  const entities = extractEntities(briefText);
  entities.projectType = explicitProjectType || entities.projectType;
  entities.location = explicitLocation || entities.location || 'East Africa';

  // 2. Room Group Expansion
  console.log('Phase 2: Expanding room groups...');
  const deliverables = expandRoomGroups(entities.roomGroups);

  // 3. Generate Summary
  const summary = generateSummary(deliverables);

  // 4. AI Enhancement (optional)
  let aiEnhancement = null;
  if (includeResearch && geminiApiKey) {
    try {
      console.log('Phase 3: AI enhancement...');
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      const enhancementPrompt = `Analyze this design brief for a ${entities.projectType || 'hospitality'} project:

"${briefText}"

Extracted deliverables: ${deliverables.length} items across ${Object.keys(summary.byRoomType).length} room types.

Provide brief insights on:
1. Any missing deliverables typically needed for this type of project
2. Material recommendations for ${entities.location}
3. Key design considerations

Keep response concise (under 200 words).`;

      const result = await model.generateContent(enhancementPrompt);
      const response = result.response;

      aiEnhancement = {
        insights: response.text(),
        suggestions: [],
        trendInsights: [],
      };
    } catch (aiError) {
      console.warn('AI enhancement failed:', aiError.message);
    }
  }

  const processingTime = Date.now() - startTime;

  return {
    success: true,
    entities,
    deliverables,
    summary,
    aiEnhancement,
    metadata: {
      processingTimeMs: processingTime,
      briefLength: briefText.length,
      projectId,
      projectName,
    },
  };
}

module.exports = {
  processProjectScoping,
  extractEntities,
  expandRoomGroups,
  generateSummary,
  ROOM_ONTOLOGY,
};
