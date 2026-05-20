/**
 * Market Intelligence Cloud Function (Gen 2)
 * AI-driven competitive intelligence that scrubs digital profiles of
 * identified competitors for each Dawin Group subsidiary, returning
 * detailed assessments, trend analysis, and strategic recommendations.
 *
 * Uses Gemini with Google Search grounding for real-time web intelligence.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');
const {
  findBestCompetitorMatch,
  mapFindingCategoryToMoveType,
} = require('../intelligence/intelligenceUtils');

// Define secrets
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Dawin Group subsidiaries context
const SUBSIDIARY_CONTEXT = {
  finishes: {
    name: 'Dawin Finishes',
    description: 'Custom millwork, furniture manufacturing, and interior fit-out for hospitality, residential, and commercial projects in East Africa.',
    industries: ['manufacturing', 'construction', 'real_estate', 'hospitality'],
    competitorKeywords: ['custom furniture', 'millwork', 'interior fit-out', 'joinery', 'cabinet making', 'hospitality furniture'],
  },
  advisory: {
    name: 'Dawin Advisory',
    description: 'Strategic advisory, project management, procurement consulting, and professional services across infrastructure, real estate, and development sectors in East Africa.',
    industries: ['advisory', 'construction', 'infrastructure', 'procurement'],
    competitorKeywords: ['management consulting', 'project management', 'procurement advisory', 'infrastructure advisory', 'development consulting'],
  },
  technology: {
    name: 'Dawin Technology',
    description: 'Technology solutions, digital transformation, and software development for enterprises in East Africa.',
    industries: ['technology', 'fintech', 'digital'],
    competitorKeywords: ['enterprise software', 'digital transformation', 'fintech', 'SaaS', 'IT services'],
  },
  capital: {
    name: 'Dawin Capital',
    description: 'Investment management, private equity, venture capital, and financial services across East African markets.',
    industries: ['investment', 'financial_services', 'private_equity'],
    competitorKeywords: ['private equity', 'venture capital', 'investment management', 'fund management', 'impact investing'],
  },
};

/**
 * Scan competitor digital profiles and generate market intelligence report.
 *
 * Input: {
 *   subsidiaryId: string ('finishes' | 'advisory' | 'technology' | 'capital'),
 *   competitorIds?: string[] (optional - specific competitors, else fetch all for subsidiary),
 *   focusAreas?: string[] (optional - e.g. ['pricing', 'new_products', 'partnerships']),
 *   timeHorizon?: string (optional - 'last_month' | 'last_quarter' | 'last_6_months' | 'last_year'),
 *   depth?: string (optional - 'quick' | 'standard' | 'deep'),
 * }
 */
exports.marketIntelligenceScan = onCall(
  {
    memory: '2GiB',
    timeoutSeconds: 540,
    secrets: [GEMINI_API_KEY],
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    // Require authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const apiKey = GEMINI_API_KEY.value();
    const userId = request.auth.uid;
    const userEmail = request.auth.token.email || 'unknown';

    const {
      subsidiaryId,
      competitorIds = [],
      focusAreas = [],
      timeHorizon = 'last_quarter',
      depth = 'standard',
    } = request.data;

    // Validate subsidiary
    if (!subsidiaryId || !SUBSIDIARY_CONTEXT[subsidiaryId]) {
      throw new HttpsError(
        'invalid-argument',
        `Invalid subsidiaryId. Must be one of: ${Object.keys(SUBSIDIARY_CONTEXT).join(', ')}`
      );
    }

    const subsidiary = SUBSIDIARY_CONTEXT[subsidiaryId];
    console.log(`Market Intelligence Scan requested by ${userEmail} for ${subsidiary.name}`);
    console.log(`Depth: ${depth}, Time horizon: ${timeHorizon}, Focus areas: ${focusAreas.join(', ') || 'all'}`);

    try {
      // ================================================================
      // Step 1: Fetch competitors for this subsidiary from Firestore
      // ================================================================
      console.log('Step 1: Fetching competitors...');

      let competitors = [];

      if (competitorIds.length > 0) {
        // Fetch specific competitors
        for (const id of competitorIds) {
          const docSnap = await db.collection('competitors').doc(id).get();
          if (docSnap.exists) {
            competitors.push({ id: docSnap.id, ...docSnap.data() });
          }
        }
      } else {
        // Fetch all competitors linked to this subsidiary
        const snapshot = await db
          .collection('competitors')
          .where('subsidiariesCompeting', 'array-contains', subsidiaryId)
          .where('status', '==', 'active')
          .get();

        competitors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fallback: if no competitors linked by subsidiariesCompeting, try by industry overlap
        if (competitors.length === 0) {
          const industrySnapshot = await db
            .collection('competitors')
            .where('status', '==', 'active')
            .get();

          competitors = industrySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(c => {
              const cIndustries = c.industries || [];
              return cIndustries.some(i => subsidiary.industries.includes(i));
            });
        }
      }

      console.log(`Found ${competitors.length} competitors to analyze`);

      // If still no competitors, provide guidance
      if (competitors.length === 0) {
        return {
          success: false,
          message: 'No competitors found for this subsidiary. Please add competitors to the system first.',
          subsidiaryId,
          subsidiaryName: subsidiary.name,
        };
      }

      // ================================================================
      // Step 2: Fetch recent competitive moves for context
      // ================================================================
      console.log('Step 2: Fetching recent competitive moves...');

      const competitorIdList = competitors.map(c => c.id);
      let recentMoves = [];

      // Fetch in batches of 10 (Firestore 'in' query limit)
      for (let i = 0; i < competitorIdList.length; i += 10) {
        const batch = competitorIdList.slice(i, i + 10);
        const movesSnapshot = await db
          .collection('competitive_moves')
          .where('competitorId', 'in', batch)
          .orderBy('dateObserved', 'desc')
          .limit(20)
          .get();

        recentMoves.push(
          ...movesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        );
      }

      console.log(`Found ${recentMoves.length} recent competitive moves`);

      // ================================================================
      // Step 3: Build competitor profiles for AI analysis
      // ================================================================
      console.log('Step 3: Building competitor profiles...');

      const competitorProfiles = competitors.map(c => ({
        id: c.id,
        name: c.name || 'Unknown Competitor',
        description: c.description || '',
        website: c.website || '',
        type: c.type || c.competitorType || 'direct',
        threatLevel: c.threatLevel || 'moderate',
        industries: c.industries || [],
        headquarters: typeof c.headquarters === 'object'
          ? `${c.headquarters?.city || ''}, ${c.headquarters?.country || ''}`.trim().replace(/^,\s*|,\s*$/g, '')
          : c.headquarters || '',
        products: (c.products || []).slice(0, 10),
        services: (c.services || []).slice(0, 10),
        employeeCount: c.employeeCount,
        estimatedRevenue: c.estimatedRevenue,
        socialMedia: {
          linkedin: c.socialMedia?.linkedin || c.positioning?.linkedinUrl || '',
          twitter: c.socialMedia?.twitter || '',
          facebook: c.socialMedia?.facebook || '',
        },
        strengths: (c.positioning?.differentiators || c.strengths || []).slice(0, 5),
        weaknesses: (c.positioning?.weaknessAreas || c.weaknesses || []).slice(0, 5),
      }));

      // Recent moves context
      const movesContext = recentMoves.slice(0, 15).map(m => ({
        competitor: m.competitorName,
        move: m.title,
        type: m.moveType,
        date: m.dateObserved?.toDate?.()?.toISOString?.() || '',
        significance: m.impactSignificance,
      }));

      // ================================================================
      // Step 4: AI Analysis with Google Search Grounding
      // ================================================================
      console.log('Step 4: Running AI analysis with Google Search grounding...');

      const genAI = new GoogleGenerativeAI(apiKey);

      // Configure model with grounding
      let model;
      let useGrounding = true;

      try {
        model = genAI.getGenerativeModel({
          model: 'gemini-2.0-flash',
          generationConfig: {
            temperature: 0.4,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 8192,
          },
          tools: [{ googleSearch: {} }],
        });
      } catch (groundingError) {
        console.warn('Google Search grounding not available, using standard model:', groundingError.message);
        useGrounding = false;
        model = genAI.getGenerativeModel({
          model: 'gemini-2.0-flash',
          generationConfig: {
            temperature: 0.4,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 8192,
          },
        });
      }

      // Time horizon mapping
      const timeHorizonLabels = {
        last_month: 'the last 30 days',
        last_quarter: 'the last 3 months (quarter)',
        last_6_months: 'the last 6 months',
        last_year: 'the past year',
      };

      // Depth instructions
      const depthInstructions = {
        quick: 'Provide a concise overview with key highlights only. 2-3 findings per competitor.',
        standard: 'Provide a balanced analysis with 3-5 findings per competitor, including evidence and recommendations.',
        deep: 'Provide an exhaustive analysis with 5-8 findings per competitor, detailed evidence, strategic implications, and actionable counter-strategies.',
      };

      // Focus areas context
      const focusAreasSection = focusAreas.length > 0
        ? `\n**FOCUS AREAS (prioritize these):**\n${focusAreas.map(a => `- ${a}`).join('\n')}`
        : '';

      // Known moves context
      const knownMovesSection = movesContext.length > 0
        ? `\n**PREVIOUSLY TRACKED COMPETITIVE MOVES (for context):**\n${movesContext.map(m => `- [${m.date?.substring(0, 10) || 'Unknown date'}] ${m.competitor}: ${m.move} (${m.type}, ${m.significance})`).join('\n')}`
        : '';

      const prompt = `You are a Senior Competitive Intelligence Analyst for Dawin Group, a diversified Ugandan conglomerate. You are conducting a market intelligence scan for the **${subsidiary.name}** subsidiary.

**SUBSIDIARY CONTEXT:**
- Name: ${subsidiary.name}
- Description: ${subsidiary.description}
- Industries: ${subsidiary.industries.join(', ')}
- Keywords: ${subsidiary.competitorKeywords.join(', ')}

**COMPETITORS TO ANALYZE:**
${competitorProfiles.map((c, i) => `
${i + 1}. **${c.name}**
   - Website: ${c.website || 'Unknown'}
   - Type: ${c.type}
   - Current Threat Level: ${c.threatLevel}
   - Headquarters: ${c.headquarters}
   - Products/Services: ${[...c.products, ...c.services].join(', ') || 'Unknown'}
   - Known Strengths: ${c.strengths.join(', ') || 'Unknown'}
   - Known Weaknesses: ${c.weaknesses.join(', ') || 'Unknown'}
   - Social Media: LinkedIn: ${c.socialMedia.linkedin || 'N/A'}, Twitter: ${c.socialMedia.twitter || 'N/A'}
`).join('')}
${knownMovesSection}
${focusAreasSection}

**ANALYSIS INSTRUCTIONS:**
- Time Horizon: Focus on activities and changes from ${timeHorizonLabels[timeHorizon] || 'the last 3 months'}
- Depth: ${depthInstructions[depth] || depthInstructions.standard}

**YOUR TASK:**
Using Google Search, scrub the digital profiles (websites, social media, news articles, press releases, job postings, regulatory filings) of each competitor listed above. For each competitor, identify:

1. **New Activities**: Product launches, service expansions, new partnerships, hiring trends, marketing campaigns
2. **Strategic Moves**: Market entries/exits, pricing changes, acquisitions, leadership changes, funding rounds
3. **Digital Presence Changes**: Website updates, new social media strategies, content marketing shifts, SEO moves
4. **Market Positioning Shifts**: Rebranding, new target segments, messaging changes, competitive positioning

Then synthesize across all competitors to identify:
5. **Industry Trends**: Common patterns and trends across competitors
6. **Strategic Opportunities**: Gaps and opportunities for ${subsidiary.name} to exploit
7. **Threat Assessment**: Emerging threats that require immediate attention
8. **Recommended Counter-Strategies**: Specific actions ${subsidiary.name} should take

**OUTPUT FORMAT:**
Return ONLY valid JSON matching this exact schema:

{
  "reportTitle": "Market Intelligence Report: ${subsidiary.name}",
  "generatedAt": "ISO date string",
  "subsidiaryId": "${subsidiaryId}",
  "subsidiaryName": "${subsidiary.name}",
  "timeHorizon": "${timeHorizon}",
  "executiveSummary": "3-4 paragraph executive summary of key findings, most critical threats, and top opportunities",
  "overallThreatLevel": "low|moderate|elevated|high|critical",
  "marketSentiment": "bullish|neutral|bearish",
  "competitorAnalyses": [
    {
      "competitorId": "competitor-id",
      "competitorName": "Competitor Name",
      "updatedThreatLevel": "minimal|low|moderate|high|critical",
      "threatLevelChange": "increased|decreased|unchanged",
      "digitalPresenceScore": 75,
      "activityLevel": "dormant|low|moderate|active|very_active",
      "findings": [
        {
          "category": "product_launch|partnership|expansion|pricing|hiring|marketing|technology|leadership|funding|regulatory|other",
          "title": "Finding title",
          "description": "Detailed description of what was found",
          "evidence": "Source URL or specific evidence",
          "significance": "minor|moderate|significant|major|transformative",
          "dateObserved": "ISO date or approximate date",
          "implications": "What this means for ${subsidiary.name}",
          "confidence": 0.85
        }
      ],
      "overallAssessment": "2-3 sentence assessment of this competitor's trajectory and what it means for us",
      "watchItems": ["Item 1 to keep monitoring", "Item 2"]
    }
  ],
  "trendAnalysis": {
    "industryTrends": [
      {
        "trend": "Trend name",
        "description": "Description of the trend",
        "adoptionRate": "early|growing|mainstream|mature",
        "relevance": "low|medium|high|critical",
        "competitorsRiding": ["Competitor names riding this trend"],
        "opportunityForUs": "How Dawin can leverage or respond to this trend"
      }
    ],
    "emergingPatterns": [
      {
        "pattern": "Pattern name",
        "description": "What is emerging",
        "signalStrength": "weak|moderate|strong",
        "timeToImpact": "immediate|short_term|medium_term|long_term"
      }
    ]
  },
  "strategicRecommendations": [
    {
      "priority": "critical|high|medium|low",
      "category": "offensive|defensive|monitoring|investment",
      "title": "Recommendation title",
      "description": "Detailed recommendation",
      "rationale": "Why this matters now",
      "targetCompetitors": ["Which competitors this addresses"],
      "estimatedTimeframe": "immediate|1_month|3_months|6_months|12_months",
      "resourceRequirement": "minimal|moderate|significant|major"
    }
  ],
  "riskAlerts": [
    {
      "severity": "warning|elevated|critical",
      "title": "Risk alert title",
      "description": "Description of the risk",
      "affectedAreas": ["area1", "area2"],
      "suggestedAction": "Immediate action to take"
    }
  ],
  "metadata": {
    "competitorsAnalyzed": 0,
    "totalFindings": 0,
    "sourcesConsulted": 0,
    "searchGroundingUsed": ${useGrounding},
    "analysisDepth": "${depth}",
    "confidenceScore": 0.0
  }
}`;

      let result;
      let text;

      try {
        result = await model.generateContent(prompt);
        text = result.response.text();
      } catch (genError) {
        console.warn('Generation with grounding failed, retrying without:', genError.message);
        const fallbackModel = genAI.getGenerativeModel({
          model: 'gemini-2.0-flash',
          generationConfig: {
            temperature: 0.4,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 8192,
          },
        });
        result = await fallbackModel.generateContent(prompt);
        text = result.response.text();
      }

      console.log('AI response received, length:', text.length);

      // Parse JSON response
      let jsonStr = text;
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      } else {
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          jsonStr = text.substring(jsonStart, jsonEnd + 1);
        }
      }

      let reportData;
      try {
        reportData = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError.message);
        console.error('JSON preview:', jsonStr.substring(0, 500));
        throw new HttpsError('internal', `Failed to parse intelligence report: ${parseError.message}`);
      }

      // ================================================================
      // Step 5: Enrich with metadata and save to Firestore
      // ================================================================
      console.log('Step 5: Enriching and saving report...');

      // Compute metadata
      const totalFindings = (reportData.competitorAnalyses || [])
        .reduce((sum, ca) => sum + (ca.findings?.length || 0), 0);

      reportData.metadata = {
        ...reportData.metadata,
        competitorsAnalyzed: competitors.length,
        totalFindings,
        searchGroundingUsed: useGrounding,
        analysisDepth: depth,
        requestedBy: userId,
        requestedByEmail: userEmail,
        generatedAt: new Date().toISOString(),
      };

      // Map competitor IDs back from our data using fuzzy matching
      const unmatchedCompetitors = [];
      if (reportData.competitorAnalyses) {
        for (const analysis of reportData.competitorAnalyses) {
          const matchResult = findBestCompetitorMatch(
            analysis.competitorName,
            competitors
          );

          if (matchResult.competitor) {
            analysis.competitorId = matchResult.competitor.id;
            analysis.matchConfidence = matchResult.confidence;
            analysis.isExactMatch = matchResult.isExactMatch;

            // Log fuzzy matches for monitoring
            if (!matchResult.isExactMatch) {
              console.log(`Fuzzy matched "${analysis.competitorName}" to "${matchResult.competitor.name}" (confidence: ${matchResult.confidence.toFixed(2)})`);
            }
          } else {
            // No acceptable match found - track for reporting
            console.warn(`No match found for competitor: "${analysis.competitorName}"`);
            unmatchedCompetitors.push({
              aiGeneratedName: analysis.competitorName,
              bestAttempt: matchResult.confidence > 0 ? competitors[0]?.name : null,
              confidence: matchResult.confidence,
            });
          }
        }
      }

      // Save the report to Firestore
      const reportDoc = {
        ...reportData,
        subsidiaryId,
        subsidiaryName: subsidiary.name,
        status: 'completed',
        createdBy: userId,
        createdByEmail: userEmail,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      };

      const docRef = await db.collection('market_intelligence_reports').add(reportDoc);

      console.log(`Market intelligence report saved: ${docRef.id}`);

      // ================================================================
      // Step 6: Auto-create competitive moves for significant findings
      // ================================================================
      console.log('Step 6: Creating competitive move records for major findings...');

      let movesCreated = 0;
      const failedMoves = [];

      if (reportData.competitorAnalyses) {
        for (const analysis of reportData.competitorAnalyses) {
          const significantFindings = (analysis.findings || []).filter(
            f => f.significance === 'major' || f.significance === 'transformative'
          );

          for (const finding of significantFindings) {
            try {
              // Skip if no valid competitor ID (don't create orphaned records)
              if (!analysis.competitorId) {
                const failureReason = `No matching competitor found for "${analysis.competitorName}"`;
                console.warn(`Skipping competitive move: ${failureReason}`);
                failedMoves.push({
                  competitorName: analysis.competitorName,
                  findingTitle: finding.title,
                  reason: failureReason,
                });
                continue;
              }

              await db.collection('competitive_moves').add({
                competitorId: analysis.competitorId,
                competitorName: analysis.competitorName,
                moveType: mapFindingCategoryToMoveType(finding.category),
                title: finding.title,
                description: finding.description,
                dateObserved: admin.firestore.Timestamp.now(),
                impactSignificance: finding.significance,
                impactedSubsidiaries: [subsidiaryId],
                strategicImplications: [finding.implications || ''],
                sources: [{
                  source: 'ai_scan',
                  title: `AI Market Intelligence Scan - ${new Date().toISOString().substring(0, 10)}`,
                  summary: finding.evidence || '',
                  reliability: Math.round((finding.confidence || 0.7) * 100),
                  collectedAt: admin.firestore.Timestamp.now(),
                  collectedBy: userId,
                  tags: ['ai-generated', 'market-intel-scan'],
                }],
                confidence: finding.confidence || 0.7,
                matchConfidence: analysis.matchConfidence, // Track matching quality
                verified: false,
                status: 'identified',
                assignedTo: [],
                createdBy: userId,
                createdAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now(),
              });
              movesCreated++;
            } catch (moveError) {
              const errorMsg = `Failed to create competitive move: ${moveError.message}`;
              console.error(errorMsg);
              failedMoves.push({
                competitorName: analysis.competitorName,
                findingTitle: finding.title,
                reason: moveError.message,
              });
            }
          }
        }
      }

      console.log(`Created ${movesCreated} competitive move records`);
      if (failedMoves.length > 0) {
        console.warn(`Failed to create ${failedMoves.length} competitive moves`);
      }

      // Return the complete report with diagnostics
      return {
        success: true,
        reportId: docRef.id,
        report: reportData,
        competitorsAnalyzed: competitors.length,
        totalFindings,
        movesCreated,
        // Diagnostic information for unmatched competitors and failed moves
        warnings: {
          unmatchedCompetitors: unmatchedCompetitors.length > 0 ? unmatchedCompetitors : undefined,
          failedMoves: failedMoves.length > 0 ? failedMoves : undefined,
        },
      };

    } catch (error) {
      console.error('Market Intelligence Scan error:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', `Market intelligence scan failed: ${error.message}`);
    }
  }
);

/**
 * Fetch historical market intelligence reports for a subsidiary.
 */
exports.getMarketIntelligenceReports = onCall(
  {
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { subsidiaryId, limit: queryLimit = 10 } = request.data;

    if (!subsidiaryId) {
      throw new HttpsError('invalid-argument', 'subsidiaryId is required');
    }

    try {
      const snapshot = await db
        .collection('market_intelligence_reports')
        .where('subsidiaryId', '==', subsidiaryId)
        .orderBy('createdAt', 'desc')
        .limit(queryLimit)
        .get();

      const reports = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
      }));

      return { success: true, reports };
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      throw new HttpsError('internal', `Failed to fetch reports: ${error.message}`);
    }
  }
);

// Helper functions are now imported from intelligenceUtils.js
