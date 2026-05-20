/**
 * Integration Service
 * 
 * Manages cross-module integration between Advisory, Investment, and Delivery.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  CrossModuleLink,
  CrossModuleLinkType,
  LinkableEntityType,
  DealConversion,
  DealConversionStatus,
  CapitalDeployment,
  PortfolioDealAllocation,
  ProjectHoldingLink,
  InitiateDealConversionInput,
  CreateCapitalDeploymentInput,
} from '../types/integration';
import type {
  CoInvestor,
  CoInvestmentOpportunity,
  CoInvestmentVehicle,
  SyndicationWorkflow,
  CreateCoInvestorInput,
  CreateCoInvestmentOpportunityInput,
} from '../types/co-investment';
import type {
  UnifiedAssetView,
  AssetAggregation,
  CrossModuleDashboard,
  AggregationGroupBy,
  AssetStatus,
  ScheduleStatus,
} from '../types/asset-view';

// Collection paths
const LINKS_COLLECTION = 'advisoryPlatform/crossModuleLinks';
const CONVERSIONS_COLLECTION = 'advisoryPlatform/advisory/dealConversions';
const DEPLOYMENTS_COLLECTION = 'advisoryPlatform/advisory/capitalDeployments';
const ALLOCATIONS_COLLECTION = 'advisoryPlatform/advisory/portfolioDealAllocations';
const PROJECT_LINKS_COLLECTION = 'advisoryPlatform/advisory/projectHoldingLinks';
const CO_INVESTORS_COLLECTION = 'advisoryPlatform/advisory/coInvestors';
const OPPORTUNITIES_COLLECTION = 'advisoryPlatform/advisory/coInvestmentOpportunities';
const VEHICLES_COLLECTION = 'advisoryPlatform/advisory/coInvestmentVehicles';
const SYNDICATION_COLLECTION = 'advisoryPlatform/advisory/syndicationWorkflows';
const ASSET_VIEWS_COLLECTION = 'advisoryPlatform/advisory/unifiedAssetViews';

// ============================================================================
// CROSS-MODULE LINKS
// ============================================================================

export async function createCrossModuleLink(
  sourceType: LinkableEntityType,
  sourceId: string,
  sourceModule: CrossModuleLink['sourceModule'],
  targetType: LinkableEntityType,
  targetId: string,
  targetModule: CrossModuleLink['targetModule'],
  linkType: CrossModuleLinkType,
  relationship: CrossModuleLink['relationship'],
  createdBy: string,
  context?: CrossModuleLink['context']
): Promise<CrossModuleLink> {
  const linkRef = doc(collection(db, LINKS_COLLECTION));
  
  const link: CrossModuleLink = {
    id: linkRef.id,
    sourceType,
    sourceId,
    sourceModule,
    targetType,
    targetId,
    targetModule,
    linkType,
    relationship,
    strength: relationship === 'parent' || relationship === 'child' ? 'strong' : 'weak',
    context,
    createdAt: Timestamp.now(),
    createdBy,
  };
  
  await setDoc(linkRef, link);
  return link;
}

export async function getLinksForEntity(
  entityType: LinkableEntityType,
  entityId: string,
  direction: 'source' | 'target' | 'both' = 'both'
): Promise<CrossModuleLink[]> {
  const links: CrossModuleLink[] = [];
  
  if (direction === 'source' || direction === 'both') {
    const sourceQuery = query(
      collection(db, LINKS_COLLECTION),
      where('sourceType', '==', entityType),
      where('sourceId', '==', entityId)
    );
    const sourceSnap = await getDocs(sourceQuery);
    links.push(...sourceSnap.docs.map(d => d.data() as CrossModuleLink));
  }
  
  if (direction === 'target' || direction === 'both') {
    const targetQuery = query(
      collection(db, LINKS_COLLECTION),
      where('targetType', '==', entityType),
      where('targetId', '==', entityId)
    );
    const targetSnap = await getDocs(targetQuery);
    links.push(...targetSnap.docs.map(d => d.data() as CrossModuleLink));
  }
  
  return links;
}

export async function deleteCrossModuleLink(linkId: string): Promise<void> {
  await deleteDoc(doc(db, LINKS_COLLECTION, linkId));
}

export async function deleteLinksForEntity(
  entityType: LinkableEntityType,
  entityId: string
): Promise<void> {
  const links = await getLinksForEntity(entityType, entityId);
  const batch = writeBatch(db);
  
  for (const link of links) {
    batch.delete(doc(db, LINKS_COLLECTION, link.id));
  }
  
  await batch.commit();
}

// ============================================================================
// DEAL-TO-HOLDING CONVERSION
// ============================================================================

export async function initiateDealConversion(
  input: InitiateDealConversionInput,
  createdBy: string
): Promise<DealConversion> {
  const conversionRef = doc(collection(db, CONVERSIONS_COLLECTION));
  
  const conversion: DealConversion = {
    id: conversionRef.id,
    dealId: input.dealId,
    dealName: input.dealName,
    dealStage: input.dealStage,
    targetPortfolios: input.targets.map(t => ({
      ...t,
      approved: false,
    })),
    status: 'pending_approval',
    approval: {
      icApproved: false,
      portfolioApprovals: input.targets.map(t => ({
        portfolioId: t.portfolioId,
        approved: false,
      })),
      finalApproved: false,
    },
    createdHoldings: [],
    createdAt: Timestamp.now(),
    createdBy,
    updatedAt: Timestamp.now(),
    updatedBy: createdBy,
  };
  
  await setDoc(conversionRef, conversion);
  return conversion;
}

export async function getDealConversion(conversionId: string): Promise<DealConversion | null> {
  const snap = await getDoc(doc(db, CONVERSIONS_COLLECTION, conversionId));
  return snap.exists() ? (snap.data() as DealConversion) : null;
}

export async function getConversionsForDeal(dealId: string): Promise<DealConversion[]> {
  const q = query(
    collection(db, CONVERSIONS_COLLECTION),
    where('dealId', '==', dealId),
    orderBy('createdAt', 'desc')
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as DealConversion);
}

export async function getPendingConversions(portfolioId?: string): Promise<DealConversion[]> {
  const q = query(
    collection(db, CONVERSIONS_COLLECTION),
    where('status', 'in', ['pending_approval', 'partially_approved']),
    orderBy('createdAt', 'desc')
  );
  
  const snap = await getDocs(q);
  let conversions = snap.docs.map(d => d.data() as DealConversion);
  
  if (portfolioId) {
    conversions = conversions.filter(c =>
      c.targetPortfolios.some(tp => tp.portfolioId === portfolioId)
    );
  }
  
  return conversions;
}

export async function approveICForConversion(
  conversionId: string,
  approvedBy: string,
  notes?: string
): Promise<void> {
  const ref = doc(db, CONVERSIONS_COLLECTION, conversionId);
  
  await updateDoc(ref, {
    'approval.icApproved': true,
    'approval.icApprovedBy': approvedBy,
    'approval.icApprovedAt': Timestamp.now(),
    'approval.icNotes': notes,
    updatedAt: Timestamp.now(),
    updatedBy: approvedBy,
  });
  
  await updateConversionStatus(conversionId);
}

export async function approvePortfolioForConversion(
  conversionId: string,
  portfolioId: string,
  approvedBy: string,
  notes?: string
): Promise<void> {
  const ref = doc(db, CONVERSIONS_COLLECTION, conversionId);
  const snap = await getDoc(ref);
  
  if (!snap.exists()) {
    throw new Error('Conversion not found');
  }
  
  const conversion = snap.data() as DealConversion;
  
  const portfolioApprovals = conversion.approval.portfolioApprovals.map(pa => {
    if (pa.portfolioId === portfolioId) {
      return {
        ...pa,
        approved: true,
        approvedBy,
        approvedAt: Timestamp.now(),
        notes,
      };
    }
    return pa;
  });
  
  const targetPortfolios = conversion.targetPortfolios.map(tp => {
    if (tp.portfolioId === portfolioId) {
      return {
        ...tp,
        approved: true,
        approvedBy,
        approvedAt: Timestamp.now(),
      };
    }
    return tp;
  });
  
  await updateDoc(ref, {
    'approval.portfolioApprovals': portfolioApprovals,
    targetPortfolios,
    updatedAt: Timestamp.now(),
    updatedBy: approvedBy,
  });
  
  await updateConversionStatus(conversionId);
}

async function updateConversionStatus(conversionId: string): Promise<void> {
  const ref = doc(db, CONVERSIONS_COLLECTION, conversionId);
  const snap = await getDoc(ref);
  
  if (!snap.exists()) return;
  
  const conversion = snap.data() as DealConversion;
  const { approval } = conversion;
  
  let newStatus: DealConversionStatus = conversion.status;
  
  const allApproved = approval.portfolioApprovals.every(pa => pa.approved);
  const someApproved = approval.portfolioApprovals.some(pa => pa.approved);
  
  if (approval.icApproved && allApproved) {
    newStatus = 'fully_approved';
  } else if (approval.icApproved && someApproved) {
    newStatus = 'partially_approved';
  }
  
  if (newStatus !== conversion.status) {
    await updateDoc(ref, { status: newStatus });
  }
}

export async function executeConversion(
  conversionId: string,
  executedBy: string
): Promise<string[]> {
  return await runTransaction(db, async (transaction) => {
    const conversionRef = doc(db, CONVERSIONS_COLLECTION, conversionId);
    const conversionSnap = await transaction.get(conversionRef);
    
    if (!conversionSnap.exists()) {
      throw new Error('Conversion not found');
    }
    
    const conversion = conversionSnap.data() as DealConversion;
    
    if (conversion.status !== 'fully_approved') {
      throw new Error('Conversion not fully approved');
    }
    
    transaction.update(conversionRef, {
      status: 'converting',
      conversionDate: Timestamp.now(),
      updatedAt: Timestamp.now(),
      updatedBy: executedBy,
    });
    
    const holdingIds: string[] = [];
    
    for (const target of conversion.targetPortfolios.filter(t => t.approved)) {
      const holdingRef = doc(collection(db, 'advisoryPlatform/advisory/holdings'));
      holdingIds.push(holdingRef.id);
      
      const holding = {
        id: holdingRef.id,
        portfolioId: target.portfolioId,
        name: conversion.dealName,
        holdingType: target.holdingConfig.type,
        status: 'committed',
        
        costBasis: {
          initialInvestment: target.allocationAmount,
          totalCost: target.allocationAmount,
          adjustedCostBasis: target.allocationAmount,
        },
        
        keyDates: {
          initialInvestmentDate: Timestamp.now(),
        },
        
        linkedEntities: {
          portfolioId: target.portfolioId,
          dealId: conversion.dealId,
          transactionIds: [],
          valuationHistoryIds: [],
          incomeRecordIds: [],
        },
        
        sourceType: 'deal_conversion',
        sourceDealId: conversion.dealId,
        conversionId: conversion.id,
        
        createdAt: Timestamp.now(),
        createdBy: executedBy,
      };
      
      transaction.set(holdingRef, holding);
      
      // Create cross-module link
      const linkRef = doc(collection(db, LINKS_COLLECTION));
      const link: CrossModuleLink = {
        id: linkRef.id,
        sourceType: 'deal',
        sourceId: conversion.dealId,
        sourceModule: 'investment',
        targetType: 'holding',
        targetId: holdingRef.id,
        targetModule: 'advisory',
        linkType: 'deal_to_holding',
        relationship: 'parent',
        strength: 'strong',
        context: { conversionId: conversion.id },
        createdAt: Timestamp.now(),
        createdBy: executedBy,
      };
      
      transaction.set(linkRef, link);
    }
    
    transaction.update(conversionRef, {
      status: 'completed',
      createdHoldings: holdingIds,
      effectiveDate: Timestamp.now(),
      updatedAt: Timestamp.now(),
      updatedBy: executedBy,
    });
    
    return holdingIds;
  });
}

export async function cancelConversion(
  conversionId: string,
  cancelledBy: string
): Promise<void> {
  await updateDoc(doc(db, CONVERSIONS_COLLECTION, conversionId), {
    status: 'cancelled',
    updatedAt: Timestamp.now(),
    updatedBy: cancelledBy,
  });
}

// ============================================================================
// CAPITAL DEPLOYMENT
// ============================================================================

export async function createCapitalDeployment(
  input: CreateCapitalDeploymentInput,
  createdBy: string
): Promise<CapitalDeployment> {
  const deploymentRef = doc(collection(db, DEPLOYMENTS_COLLECTION));
  
  const deployment: CapitalDeployment = {
    ...input,
    id: deploymentRef.id,
    status: 'planned',
    createdAt: Timestamp.now(),
    createdBy,
    updatedAt: Timestamp.now(),
    updatedBy: createdBy,
  };
  
  await setDoc(deploymentRef, deployment);
  
  // Create cross-module link
  await createCrossModuleLink(
    'holding',
    input.holdingId,
    'advisory',
    'project',
    input.projectId,
    'delivery',
    'holding_to_project',
    'parent',
    createdBy,
    { deploymentId: deploymentRef.id }
  );
  
  return deployment;
}

export async function getCapitalDeployment(deploymentId: string): Promise<CapitalDeployment | null> {
  const snap = await getDoc(doc(db, DEPLOYMENTS_COLLECTION, deploymentId));
  return snap.exists() ? (snap.data() as CapitalDeployment) : null;
}

export async function updateDeploymentStatus(
  deploymentId: string,
  status: CapitalDeployment['status'],
  updatedBy: string,
  disbursementRef?: string
): Promise<void> {
  await updateDoc(doc(db, DEPLOYMENTS_COLLECTION, deploymentId), {
    status,
    disbursementRef,
    updatedAt: Timestamp.now(),
    updatedBy,
  });
}

export async function getDeploymentsForHolding(holdingId: string): Promise<CapitalDeployment[]> {
  const q = query(
    collection(db, DEPLOYMENTS_COLLECTION),
    where('holdingId', '==', holdingId),
    orderBy('deploymentDate', 'desc')
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as CapitalDeployment);
}

export async function getDeploymentsForProject(projectId: string): Promise<CapitalDeployment[]> {
  const q = query(
    collection(db, DEPLOYMENTS_COLLECTION),
    where('projectId', '==', projectId),
    orderBy('deploymentDate', 'desc')
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as CapitalDeployment);
}

export async function getTotalDeployedForHolding(holdingId: string): Promise<number> {
  const deployments = await getDeploymentsForHolding(holdingId);
  return deployments
    .filter(d => d.status === 'disbursed')
    .reduce((sum, d) => sum + d.amount.amount, 0);
}

// ============================================================================
// PORTFOLIO-DEAL ALLOCATIONS
// ============================================================================

export async function getPortfolioDealAllocations(portfolioId: string): Promise<PortfolioDealAllocation[]> {
  const q = query(
    collection(db, ALLOCATIONS_COLLECTION),
    where('portfolioId', '==', portfolioId),
    orderBy('createdAt', 'desc')
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as PortfolioDealAllocation);
}

export async function getDealAllocations(dealId: string): Promise<PortfolioDealAllocation[]> {
  const q = query(
    collection(db, ALLOCATIONS_COLLECTION),
    where('dealId', '==', dealId),
    orderBy('createdAt', 'desc')
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as PortfolioDealAllocation);
}

// ============================================================================
// PROJECT-HOLDING LINKS
// ============================================================================

export async function getProjectHoldingLinks(projectId: string): Promise<ProjectHoldingLink[]> {
  const q = query(
    collection(db, PROJECT_LINKS_COLLECTION),
    where('projectId', '==', projectId)
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as ProjectHoldingLink);
}

export async function getHoldingProjectLinks(holdingId: string): Promise<ProjectHoldingLink[]> {
  const q = query(
    collection(db, PROJECT_LINKS_COLLECTION),
    where('holdingId', '==', holdingId)
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as ProjectHoldingLink);
}

// ============================================================================
// CO-INVESTORS
// ============================================================================

export async function createCoInvestor(
  input: CreateCoInvestorInput,
  createdBy: string
): Promise<CoInvestor> {
  const coInvestorRef = doc(collection(db, CO_INVESTORS_COLLECTION));
  
  const coInvestor: CoInvestor = {
    ...input,
    id: coInvestorRef.id,
    relationshipStatus: 'prospect',
    investmentProfile: input.investmentProfile || {},
    trackRecord: {
      totalDeals: 0,
      totalInvested: { amount: 0, currency: 'USD' },
      averageTicket: { amount: 0, currency: 'USD' },
    },
    isActive: true,
    createdAt: Timestamp.now(),
    createdBy,
    updatedAt: Timestamp.now(),
    updatedBy: createdBy,
  };
  
  await setDoc(coInvestorRef, coInvestor);
  return coInvestor;
}

export async function getCoInvestor(coInvestorId: string): Promise<CoInvestor | null> {
  const snap = await getDoc(doc(db, CO_INVESTORS_COLLECTION, coInvestorId));
  return snap.exists() ? (snap.data() as CoInvestor) : null;
}

export async function getActiveCoInvestors(): Promise<CoInvestor[]> {
  const q = query(
    collection(db, CO_INVESTORS_COLLECTION),
    where('isActive', '==', true),
    orderBy('name')
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as CoInvestor);
}

export async function updateCoInvestor(
  coInvestorId: string,
  updates: Partial<CoInvestor>,
  updatedBy: string
): Promise<void> {
  await updateDoc(doc(db, CO_INVESTORS_COLLECTION, coInvestorId), {
    ...updates,
    updatedAt: Timestamp.now(),
    updatedBy,
  });
}

// ============================================================================
// CO-INVESTMENT OPPORTUNITIES
// ============================================================================

export async function createCoInvestmentOpportunity(
  input: CreateCoInvestmentOpportunityInput,
  createdBy: string
): Promise<CoInvestmentOpportunity> {
  const opportunityRef = doc(collection(db, OPPORTUNITIES_COLLECTION));
  
  const opportunity: CoInvestmentOpportunity = {
    ...input,
    id: opportunityRef.id,
    openDate: Timestamp.now(),
    status: 'preparing',
    invitations: [],
    commitments: [],
    totalCommitted: { amount: 0, currency: input.totalDealSize.currency },
    commitmentProgress: 0,
    createdAt: Timestamp.now(),
    createdBy,
    updatedAt: Timestamp.now(),
    updatedBy: createdBy,
  };
  
  await setDoc(opportunityRef, opportunity);
  return opportunity;
}

export async function getCoInvestmentOpportunity(opportunityId: string): Promise<CoInvestmentOpportunity | null> {
  const snap = await getDoc(doc(db, OPPORTUNITIES_COLLECTION, opportunityId));
  return snap.exists() ? (snap.data() as CoInvestmentOpportunity) : null;
}

export async function getOpportunitiesForDeal(dealId: string): Promise<CoInvestmentOpportunity[]> {
  const q = query(
    collection(db, OPPORTUNITIES_COLLECTION),
    where('dealId', '==', dealId),
    orderBy('createdAt', 'desc')
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as CoInvestmentOpportunity);
}

export async function getActiveOpportunities(): Promise<CoInvestmentOpportunity[]> {
  const q = query(
    collection(db, OPPORTUNITIES_COLLECTION),
    where('status', 'in', ['preparing', 'marketing', 'soft_circle', 'final_circle']),
    orderBy('expectedCloseDate')
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as CoInvestmentOpportunity);
}

// ============================================================================
// CO-INVESTMENT VEHICLES
// ============================================================================

export async function getCoInvestmentVehicle(vehicleId: string): Promise<CoInvestmentVehicle | null> {
  const snap = await getDoc(doc(db, VEHICLES_COLLECTION, vehicleId));
  return snap.exists() ? (snap.data() as CoInvestmentVehicle) : null;
}

export async function getVehiclesForDeal(dealId: string): Promise<CoInvestmentVehicle[]> {
  const q = query(
    collection(db, VEHICLES_COLLECTION),
    where('dealId', '==', dealId)
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as CoInvestmentVehicle);
}

// ============================================================================
// SYNDICATION WORKFLOWS
// ============================================================================

export async function getSyndicationWorkflow(workflowId: string): Promise<SyndicationWorkflow | null> {
  const snap = await getDoc(doc(db, SYNDICATION_COLLECTION, workflowId));
  return snap.exists() ? (snap.data() as SyndicationWorkflow) : null;
}

export async function getActiveSyndicationWorkflows(): Promise<SyndicationWorkflow[]> {
  const q = query(
    collection(db, SYNDICATION_COLLECTION),
    where('status', '==', 'active'),
    orderBy('targetCloseDate')
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as SyndicationWorkflow);
}

// ============================================================================
// UNIFIED ASSET VIEW
// ============================================================================

function getScheduleStatus(actual: number, scheduled: number): ScheduleStatus {
  const variance = actual - scheduled;
  if (variance >= 5) return 'ahead';
  if (variance >= -5) return 'on_track';
  if (variance >= -15) return 'behind';
  return 'critical';
}

function mapProjectStatusToAssetStatus(projectStatus: string): AssetStatus {
  const mapping: Record<string, AssetStatus> = {
    'planning': 'pipeline',
    'design': 'development',
    'procurement': 'development',
    'construction': 'construction',
    'commissioning': 'commissioning',
    'completed': 'operational',
    'operational': 'operational',
    'closed': 'exited',
  };
  return mapping[projectStatus] || 'pipeline';
}

export async function buildUnifiedAssetView(
  projectId: string,
  _createdBy: string
): Promise<UnifiedAssetView> {
  const projectRef = doc(db, 'advisoryPlatform/delivery/projects', projectId);
  const projectSnap = await getDoc(projectRef);
  
  if (!projectSnap.exists()) {
    throw new Error('Project not found');
  }
  
  const project = projectSnap.data();
  
  // Get linked holdings
  const holdingLinks = await getLinksForEntity('project', projectId, 'target');
  const holdingIds = holdingLinks
    .filter(l => l.sourceType === 'holding')
    .map(l => l.sourceId);
  
  // Get linked deals
  const dealLinks = await getLinksForEntity('project', projectId, 'target');
  const dealIds = dealLinks
    .filter(l => l.sourceType === 'deal')
    .map(l => l.sourceId);
  
  const currency = project.budget?.currency || 'USD';
  
  const assetView: UnifiedAssetView = {
    id: `asset_${projectId}`,
    assetType: project.constructionType === 'new' ? 'greenfield' : 'brownfield',
    assetName: project.name || 'Unnamed Asset',
    assetDescription: project.description,
    
    location: {
      country: project.location?.country || 'Uganda',
      region: project.location?.region,
      city: project.location?.city,
      coordinates: project.location?.coordinates,
    },
    
    sector: project.sector || 'healthcare',
    subSector: project.subSector,
    
    linkedEntities: {
      portfolioIds: [],
      holdingIds,
      clientIds: [],
      dealIds,
      projectIds: [projectId],
      engagementIds: project.engagementId ? [project.engagementId] : [],
      programIds: project.programId ? [project.programId] : [],
    },
    
    financials: {
      totalInvestment: project.budget || { amount: 0, currency },
      equityInvested: { amount: 0, currency },
      debtOutstanding: { amount: 0, currency },
      currentValuation: project.budget || { amount: 0, currency },
      valuationMethod: 'cost',
      valuationDate: Timestamp.now(),
      unrealizedValue: { amount: 0, currency },
      realizedValue: { amount: 0, currency },
      totalValue: project.budget || { amount: 0, currency },
      moic: 1.0,
      cumulativeDistributions: { amount: 0, currency },
      cumulativeContributions: project.totalSpent || { amount: 0, currency },
      netCashFlow: { amount: -(project.totalSpent?.amount || 0), currency },
      budgetedCost: project.budget,
      actualCost: project.totalSpent,
      costVariance: {
        amount: (project.budget?.amount || 0) - (project.totalSpent?.amount || 0),
        currency,
      },
      costVariancePercent: project.budget?.amount > 0
        ? ((project.budget.amount - (project.totalSpent?.amount || 0)) / project.budget.amount) * 100
        : 0,
    },
    
    progress: {
      physicalProgress: project.physicalProgress || 0,
      physicalProgressMethod: 'milestone',
      financialProgress: project.budget?.amount > 0
        ? ((project.totalSpent?.amount || 0) / project.budget.amount) * 100
        : 0,
      scheduledProgress: project.scheduledProgress || 0,
      scheduleVariance: (project.physicalProgress || 0) - (project.scheduledProgress || 0),
      scheduleStatus: getScheduleStatus(
        project.physicalProgress || 0,
        project.scheduledProgress || 0
      ),
      lastProgressUpdate: project.lastProgressUpdate || Timestamp.now(),
      activeIssues: project.activeIssues || 0,
      criticalIssues: project.criticalIssues || 0,
    },
    
    status: mapProjectStatusToAssetStatus(project.status || 'planning'),
    
    timeline: {
      developmentStartDate: project.startDate,
      constructionStartDate: project.constructionStartDate,
      expectedCompletionDate: project.expectedEndDate,
      actualCompletionDate: project.actualEndDate,
    },
    
    lastUpdated: Timestamp.now(),
    dataFreshness: 'real_time',
  };
  
  await setDoc(doc(db, ASSET_VIEWS_COLLECTION, assetView.id), assetView);
  
  return assetView;
}

export async function getUnifiedAssetView(projectId: string): Promise<UnifiedAssetView | null> {
  const snap = await getDoc(doc(db, ASSET_VIEWS_COLLECTION, `asset_${projectId}`));
  return snap.exists() ? (snap.data() as UnifiedAssetView) : null;
}

export async function getAssetAggregation(
  groupBy: AggregationGroupBy,
  groupValue: string
): Promise<AssetAggregation | null> {
  let q;
  
  switch (groupBy) {
    case 'sector':
      q = query(collection(db, ASSET_VIEWS_COLLECTION), where('sector', '==', groupValue));
      break;
    case 'country':
      q = query(collection(db, ASSET_VIEWS_COLLECTION), where('location.country', '==', groupValue));
      break;
    case 'status':
      q = query(collection(db, ASSET_VIEWS_COLLECTION), where('status', '==', groupValue));
      break;
    default:
      return null;
  }
  
  const snap = await getDocs(q);
  const assets = snap.docs.map(d => d.data() as UnifiedAssetView);
  
  if (assets.length === 0) return null;
  
  const currency = assets[0].financials.totalInvestment.currency;
  const totalInvestment = assets.reduce((sum, a) => sum + a.financials.totalInvestment.amount, 0);
  
  const statusBreakdown: Record<string, { count: number; value: number }> = {};
  for (const asset of assets) {
    if (!statusBreakdown[asset.status]) {
      statusBreakdown[asset.status] = { count: 0, value: 0 };
    }
    statusBreakdown[asset.status].count++;
    statusBreakdown[asset.status].value += asset.financials.currentValuation.amount;
  }
  
  return {
    groupBy,
    groupValue,
    assetCount: assets.length,
    totalInvestment: { amount: totalInvestment, currency },
    totalValuation: {
      amount: assets.reduce((sum, a) => sum + a.financials.currentValuation.amount, 0),
      currency,
    },
    totalEquity: {
      amount: assets.reduce((sum, a) => sum + a.financials.equityInvested.amount, 0),
      currency,
    },
    totalDebt: {
      amount: assets.reduce((sum, a) => sum + a.financials.debtOutstanding.amount, 0),
      currency,
    },
    weightedMOIC: totalInvestment > 0
      ? assets.reduce((sum, a) => sum + a.financials.moic * a.financials.totalInvestment.amount, 0) / totalInvestment
      : 1.0,
    averagePhysicalProgress: assets.reduce((sum, a) => sum + (a.progress?.physicalProgress || 0), 0) / assets.length,
    averageFinancialProgress: assets.reduce((sum, a) => sum + (a.progress?.financialProgress || 0), 0) / assets.length,
    statusBreakdown: Object.entries(statusBreakdown).map(([status, data]) => ({
      status: status as AssetStatus,
      count: data.count,
      value: { amount: data.value, currency },
    })),
  };
}

// ============================================================================
// CROSS-MODULE DASHBOARD
// ============================================================================

export async function buildCrossModuleDashboard(): Promise<CrossModuleDashboard> {
  const currency = 'USD';
  
  return {
    summary: {
      totalAUM: { amount: 0, currency },
      totalClientsServed: 0,
      totalActiveDeals: 0,
      totalActiveProjects: 0,
      totalAssets: 0,
    },
    pipeline: {
      dealsInPipeline: 0,
      pipelineValue: { amount: 0, currency },
      expectedCloses30Days: 0,
      expectedClosesValue30Days: { amount: 0, currency },
    },
    portfolioPerformance: {
      aggregateIRR: 0,
      aggregateMOIC: 1.0,
      tvpi: 1.0,
      dpi: 0,
      rvpi: 1.0,
    },
    deliveryStatus: {
      activeProjects: 0,
      onTrackProjects: 0,
      atRiskProjects: 0,
      delayedProjects: 0,
      totalBudget: { amount: 0, currency },
      totalSpent: { amount: 0, currency },
    },
    recentActivity: [],
    alerts: [],
    lastUpdated: Timestamp.now(),
  };
}
