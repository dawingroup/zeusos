// ============================================================================
// DATA INGESTION SERVICE
// DawinOS v2.0 - Aggregates data from QBO, Project Module, and Manufacturing
// into the optimizer's expenditure queue and receipt projections
// ============================================================================

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type {
  ExpenditureItem,
  ExpenditureCategory,
  ExpenditureSourceType,
  IngestionResult,
  FullIngestionResult,
  RevenueUnlockInfo,
  ItemCostBreakdown,
  CostConfidenceLevel,
  ExpenditureCrossLinks,
  CommitmentLevel,
  CommitmentSource,
} from '../types/optimizer.types';
import {
  PROJECTED_RECEIPTS_COLLECTION,
  LIABILITY_REGISTER_COLLECTION,
  QUOTE_STATUS_CONFIDENCE,
  COMMITTED_DEAL_STAGES,
  EXCLUDED_DEAL_STAGES,
  SPECULATIVE_DEAL_STAGES,
  PROBABLE_DEADLINE_EXTENSION_DAYS,
  SO_COMMITTED_STATUSES,
  SO_PROBABLE_STATUSES,
  SO_EXCLUDED_STATUSES,
  SO_STATUS_CONFIDENCE,
} from '../constants/optimizer.constants';
import { optimizerService } from './optimizerService';
import { getSalesOrderByProject } from '@/modules/sales-orders/services/salesOrderService';

// ────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS
// ────────────────────────────────────────────────────────────────────────────

class DataIngestionService {

  // ══════════════════════════════════════════════════════════════════════════
  // QBO DATA INGESTION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Ingest outstanding bills from QBO synced data as expenditure items.
   * QBO bills represent confirmed vendor obligations.
   */
  async ingestQBOData(companyId: string): Promise<IngestionResult> {
    const result: IngestionResult = {
      source: 'qbo',
      timestamp: Timestamp.now(),
      itemsIngested: 0,
      itemsUpdated: 0,
      itemsSkipped: 0,
      errors: [],
    };

    try {
      // Read QBO synced bills (outstanding only)
      const billsRef = collection(db, 'companies', companyId, 'qbo_synced_data');
      const billsQuery = query(billsRef, where('dataType', '==', 'bills'));
      const billsSnapshot = await getDocs(billsQuery);

      // Track vendor frequency for recurring liability detection
      const vendorBillMap = new Map<string, { amounts: number[]; vendorId: string; vendorName: string }>();

      for (const billDoc of billsSnapshot.docs) {
        const billData = billDoc.data();
        const bills = billData.data || [];

        for (const bill of bills) {
          // Track all bills for recurring detection (even paid ones)
          const vendorName = bill.VendorRef?.name || '';
          if (vendorName) {
            const totalAmt = bill.TotalAmt || bill.Balance || 0;
            if (!vendorBillMap.has(vendorName)) {
              vendorBillMap.set(vendorName, { amounts: [], vendorId: bill.VendorRef?.value || '', vendorName });
            }
            vendorBillMap.get(vendorName)!.amounts.push(totalAmt);
          }

          if (!bill.Balance || bill.Balance <= 0) {
            result.itemsSkipped++;
            continue;
          }

          try {
            // Check if already ingested
            const existing = await this.findExistingExpenditure(
              companyId, 'qbo_bill', bill.Id?.toString() || billDoc.id
            );

            if (existing) {
              result.itemsUpdated++;
              continue;
            }

            const category = this.classifyBillCategory(bill);
            const dueDate = bill.DueDate
              ? Timestamp.fromDate(new Date(bill.DueDate))
              : Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

            await optimizerService.addExpenditure(companyId, {
              companyId,
              subsidiaryId: 'dawin-finishes',
              description: `${bill.VendorRef?.name || 'Vendor'}: ${bill.Line?.[0]?.Description || 'Bill payment'}`,
              category,
              vendor: bill.VendorRef?.name,
              vendorId: bill.VendorRef?.value,
              amount: bill.Balance,
              currency: bill.CurrencyRef?.value === 'USD' ? 'USD' : 'UGX',
              amountUGX: bill.CurrencyRef?.value === 'USD'
                ? bill.Balance * 3750
                : bill.Balance,
              sourceType: 'qbo_bill',
              sourceId: bill.Id?.toString() || billDoc.id,
              requestedDate: dueDate,
              earliestDate: Timestamp.now(),
              latestDate: dueDate,
              revenueUnlock: defaultRevenueUnlock(),
              risk: {
                receiptRiskScore: 0,
                vendorRelationshipRisk: 50,
                operationalImpact: 40,
                penaltyAmount: 0,
                contractualObligation: true,
              },
              status: 'pending',
            }, 'system');

            result.itemsIngested++;
          } catch (err) {
            result.errors.push(`Bill ${bill.Id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
      }

      // Auto-detect recurring liabilities from QBO bill patterns
      await this.detectRecurringLiabilities(companyId, vendorBillMap);
    } catch (err) {
      result.errors.push(`QBO ingestion failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Detect recurring vendor bills from QBO data and auto-create liability register entries.
   * A vendor with 3+ bills within 20% of the average amount is considered recurring.
   */
  private async detectRecurringLiabilities(
    companyId: string,
    vendorBillMap: Map<string, { amounts: number[]; vendorId: string; vendorName: string }>,
  ): Promise<void> {
    const liabilitiesRef = collection(db, 'companies', companyId, LIABILITY_REGISTER_COLLECTION);

    for (const [, data] of vendorBillMap) {
      if (data.amounts.length < 3) continue;

      const avg = data.amounts.reduce((s, a) => s + a, 0) / data.amounts.length;
      const allConsistent = data.amounts.every(a => Math.abs(a - avg) <= avg * 0.2);
      if (!allConsistent) continue;

      // Check if liability already exists for this vendor
      const existingQuery = query(
        liabilitiesRef,
        where('vendorName', '==', data.vendorName),
        limit(1),
      );
      const existingSnap = await getDocs(existingQuery);
      if (!existingSnap.empty) continue;

      // Classify by vendor name
      const name = data.vendorName.toLowerCase();
      let liabilityType = 'other';
      if (name.includes('landlord') || name.includes('rent') || name.includes('property')) liabilityType = 'rent';
      else if (name.includes('bank') || name.includes('loan') || name.includes('finance')) liabilityType = 'loan';
      else if (name.includes('umeme') || name.includes('nwsc') || name.includes('electric') || name.includes('water')) liabilityType = 'utility_contract';
      else if (name.includes('insurance') || name.includes('aua') || name.includes('jubilee')) liabilityType = 'insurance';
      else if (name.includes('ura') || name.includes('nssf') || name.includes('tax')) liabilityType = 'nssf';

      const isStatutory = ['tax_paye', 'tax_vat', 'tax_corporate', 'nssf'].includes(liabilityType);
      const priorityMap: Record<string, string> = {
        rent: 'contractual', loan: 'contractual', utility_contract: 'operational',
        insurance: 'contractual', other: 'operational', nssf: 'statutory',
      };
      const estimatedAmt = Math.round(avg);
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1, 1);

      await addDoc(liabilitiesRef, {
        companyId,
        type: liabilityType,
        description: `${data.vendorName} — recurring ${liabilityType.replace(/_/g, ' ')}`,
        vendorName: data.vendorName,
        vendorId: data.vendorId,
        totalAmount: estimatedAmt,
        amountPaid: 0,
        amountRemaining: estimatedAmt,
        currency: 'UGX',
        frequency: 'monthly',
        nextDueDate: Timestamp.fromDate(nextMonth),
        gracePeriodDays: liabilityType === 'rent' ? 5 : 15,
        priority: isStatutory ? 'statutory' : (priorityMap[liabilityType] || 'operational'),
        isNonNegotiable: isStatutory || liabilityType === 'rent',
        autoDetected: true,
        status: 'current',
        paymentHistory: [],
        detectedFromBillCount: data.amounts.length,
        subsidiaryId: 'dawin-finishes',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PROJECT BUDGET INGESTION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Ingest project design item costs as expenditure items.
   * Uses pure costs only (no profit, no overhead, no management fees).
   * Evaluates commitment via CRM deal stage, quote status, MO/PO existence.
   * Items from speculative/excluded deals are filtered out.
   */
  async ingestProjectCosts(companyId: string): Promise<IngestionResult> {
    const result: IngestionResult = {
      source: 'projects',
      timestamp: Timestamp.now(),
      itemsIngested: 0,
      itemsUpdated: 0,
      itemsSkipped: 0,
      errors: [],
    };

    try {
      const projectsRef = collection(db, 'designProjects');
      const projectsQuery = query(
        projectsRef,
        where('status', 'in', ['draft', 'concept', 'estimation', 'active', 'in-progress', 'approved', 'production']),
        orderBy('updatedAt', 'desc')
      );
      const projectsSnapshot = await getDocs(projectsQuery);

      // Pre-load all CRM deals referenced by these projects
      const dealIds = projectsSnapshot.docs
        .map(d => (d.data().dealId as string) || '')
        .filter(Boolean);
      const crmDealsCache = await this.preloadCrmDeals(dealIds);

      // Cache Sales Orders per project (avoids repeated Firestore queries)
      const salesOrderCache = new Map<string, { id: string; status: string } | null>();

      for (const projectDoc of projectsSnapshot.docs) {
        const project = projectDoc.data();

        // Pre-load Sales Order for this project
        if (!salesOrderCache.has(projectDoc.id)) {
          try {
            const so = await getSalesOrderByProject(projectDoc.id);
            salesOrderCache.set(projectDoc.id, so ? { id: so.id, status: so.status } : null);
          } catch {
            salesOrderCache.set(projectDoc.id, null);
          }
        }

        try {
          const itemsRef = collection(db, 'designProjects', projectDoc.id, 'designItems');
          const itemsSnapshot = await getDocs(itemsRef);

          for (const itemDoc of itemsSnapshot.docs) {
            const item = itemDoc.data();

            // Double-counting guard: skip items with existing MOs (MO ingestion handles them)
            if (item.manufacturingOrderId) {
              result.itemsSkipped++;
              continue;
            }

            // ── Commitment Gateway ──
            const commitmentSource = await this.evaluateProjectCommitment(
              project, item, companyId, crmDealsCache, salesOrderCache
            );

            // null = excluded (no SO confirmation, speculative, or lost deal)
            // Clean up any previously-ingested expenditure for this item
            if (!commitmentSource) {
              const staleSourceId = `project-${projectDoc.id}-item-${itemDoc.id}`;
              const staleEntry = await this.findExistingExpenditure(companyId, 'project', staleSourceId);
              if (staleEntry) {
                await deleteDoc(doc(db, 'companies', companyId, 'expenditure_queue', staleEntry.id));
              }
              result.itemsSkipped++;
              continue;
            }

            const commitmentLevel: CommitmentLevel = commitmentSource.level;

            // Extract pure cost breakdown (no profit, no overhead)
            let breakdown = this.extractItemCostBreakdown(item);

            // If no costs found on the item, try reverse-calculating from estimate
            if (breakdown.totalPureCost <= 0) {
              breakdown = this.extractCostFromEstimate(project, itemDoc.id, item);
            }

            if (breakdown.totalPureCost <= 0) {
              result.itemsSkipped++;
              continue;
            }

            const category = this.classifyFromBreakdown(breakdown, item);
            let dueDate = project.dueDate
              ? (project.dueDate.toDate ? project.dueDate : Timestamp.fromDate(new Date(project.dueDate)))
              : Timestamp.fromDate(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000));

            // For probable items, extend the deadline to soften urgency
            if (commitmentLevel === 'probable') {
              const dueDateObj = dueDate.toDate ? dueDate.toDate() : new Date(dueDate);
              dueDateObj.setDate(dueDateObj.getDate() + PROBABLE_DEADLINE_EXTENSION_DAYS);
              dueDate = Timestamp.fromDate(dueDateObj);
            }

            const revenueUnlock = this.calculateProjectRevenueUnlock(
              project, breakdown.totalPureCost
            );

            const projectStatus = (project.status as string) || '';

            const crossLinks: ExpenditureCrossLinks = {
              designProjectId: projectDoc.id,
              designProjectName: (project.name as string) || (project.code as string) || undefined,
              designItemId: itemDoc.id,
              designItemName: (item.name as string) || (item.description as string) || undefined,
              customerId: (project.customerId as string) || undefined,
              customerName: (project.customerName as string) || undefined,
              dealId: (project.dealId as string) || undefined,
            };

            // Check if already ingested — if so, enrich with new fields
            const sourceId = `project-${projectDoc.id}-item-${itemDoc.id}`;
            const existing = await this.findExistingExpenditure(companyId, 'project', sourceId);
            if (existing) {
              await optimizerService.updateExpenditure(companyId, existing.id, {
                costBreakdown: breakdown,
                crossLinks,
                commitmentLevel,
                commitmentSource,
                projectApprovalStatus: projectStatus,
              }, 'system');
              result.itemsUpdated++;
              continue;
            }

            await optimizerService.addExpenditure(companyId, {
              companyId,
              subsidiaryId: project.subsidiaryId || 'dawin-finishes',
              projectId: projectDoc.id,
              projectName: project.name || project.code,
              description: `${project.name}: ${item.name || item.description || 'Design item'}`,
              category,
              amount: breakdown.totalPureCost,
              currency: 'UGX',
              amountUGX: breakdown.totalPureCost,
              sourceType: 'project',
              sourceId,
              requestedDate: dueDate,
              earliestDate: Timestamp.now(),
              latestDate: dueDate,
              revenueUnlock,
              risk: {
                receiptRiskScore: 30,
                vendorRelationshipRisk: 20,
                operationalImpact: commitmentLevel === 'probable' ? 30 : 60,
                penaltyAmount: 0,
                contractualObligation: false,
              },
              costBreakdown: breakdown,
              crossLinks,
              commitmentLevel,
              commitmentSource,
              projectApprovalStatus: projectStatus,
              status: 'pending',
            }, 'system');

            result.itemsIngested++;
          }
        } catch (err) {
          result.errors.push(`Project ${projectDoc.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    } catch (err) {
      result.errors.push(`Project ingestion failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return result;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PROJECT RECEIPT INGESTION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Ingest projected income from project estimates, quotes, and CRM deals.
   * Receipt amount = estimate/quote total (includes overhead + margin — what client pays).
   * Also queries CRM deals with linkedProjectId for deal-level receipt expectations.
   */
  async ingestProjectIncome(companyId: string): Promise<IngestionResult> {
    const result: IngestionResult = {
      source: 'receipts',
      timestamp: Timestamp.now(),
      itemsIngested: 0,
      itemsUpdated: 0,
      itemsSkipped: 0,
      errors: [],
    };

    try {
      // ── 1. Project-based receipts (from estimates/quotes) ──
      const projectsRef = collection(db, 'designProjects');
      const projectsQuery = query(
        projectsRef,
        where('status', 'in', ['active', 'in-progress', 'approved', 'production']),
        orderBy('updatedAt', 'desc')
      );
      const projectsSnapshot = await getDocs(projectsQuery);

      for (const projectDoc of projectsSnapshot.docs) {
        const project = projectDoc.data();
        const estimate = project.consolidatedEstimate as Record<string, unknown> | undefined;
        const total = (estimate?.total as number) || 0;
        const sourceId = `project-receipt-${projectDoc.id}`;

        if (total <= 0) {
          result.itemsSkipped++;
          continue;
        }

        try {
          // ── SO Gate: check Sales Order status ──
          let so: { id: string; status: string } | null = null;
          try {
            const soResult = await getSalesOrderByProject(projectDoc.id);
            so = soResult ? { id: soResult.id, status: soResult.status } : null;
          } catch { /* ignore */ }

          // Exclude projects without SO confirmation (same logic as expenditure gateway)
          const hasSO = !!so;
          const soExcluded = hasSO && SO_EXCLUDED_STATUSES.includes(so!.status);
          const projectStatus = ((project.status as string) || '').toLowerCase();
          const quoteApproved = !!(project.quoteApproved) || (project.quoteStatus as string) === 'approved';
          const isInProduction = ['in-progress', 'production', 'in_progress'].includes(projectStatus);

          // Determine if this project qualifies for receipt projection
          const qualifies = (hasSO && !soExcluded) || isInProduction || quoteApproved;

          if (!qualifies) {
            // Clean up stale receipt if it was previously ingested
            const existingRef = collection(db, 'companies', companyId, PROJECTED_RECEIPTS_COLLECTION);
            const existingQ = query(existingRef, where('sourceId', '==', sourceId), limit(1));
            const existingSnap = await getDocs(existingQ);
            if (!existingSnap.empty) {
              await deleteDoc(doc(db, 'companies', companyId, PROJECTED_RECEIPTS_COLLECTION, existingSnap.docs[0].id));
            }
            result.itemsSkipped++;
            continue;
          }

          // Determine confidence from SO status (primary) or quote status (fallback)
          const quoteStatus = (project.quoteStatus as string) || 'estimate_only';
          const confidence = so && SO_STATUS_CONFIDENCE[so.status]
            ? SO_STATUS_CONFIDENCE[so.status]
            : (QUOTE_STATUS_CONFIDENCE[quoteStatus] || QUOTE_STATUS_CONFIDENCE.estimate_only);

          // Calculate cost basis by stripping overhead + margin
          const overheadAmount = (estimate?.overheadAmount as number) || 0;
          const marginAmount = (estimate?.marginAmount as number) || 0;
          const costBasis = (estimate?.subtotal as number || total) - overheadAmount - marginAmount;

          const dueDate = project.dueDate
            ? (project.dueDate.toDate ? project.dueDate : Timestamp.fromDate(new Date(project.dueDate)))
            : Timestamp.fromDate(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000));

          // Resolve customer and project names
          const customerName = (project.customerName as string) || (project.clientName as string) || null;
          const projectName = (project.name as string) || (project.code as string) || 'Project';

          // Check for existing receipt — update if found, create if not
          const existingRef = collection(db, 'companies', companyId, PROJECTED_RECEIPTS_COLLECTION);
          const existingQ = query(existingRef, where('sourceId', '==', sourceId), limit(1));
          const existingSnap = await getDocs(existingQ);

          const receiptData = {
            companyId,
            subsidiaryId: project.subsidiaryId || 'dawin-finishes',
            sourceType: 'project_milestone' as const,
            sourceId,
            sourceName: projectName,
            customerId: (project.customerId as string) || (project.clientId as string) || null,
            customerName,
            amount: total,
            currency: (estimate?.currency as string) || 'UGX',
            expectedDate: dueDate,
            confidenceLevel: confidence.level,
            confidenceScore: confidence.score,
            costBasis,
            grossProfit: overheadAmount + marginAmount,
            isStaleEstimate: (estimate?.isStale as boolean) || false,
            status: 'projected' as const,
            updatedAt: Timestamp.now(),
          };

          if (!existingSnap.empty) {
            // Update existing receipt with latest data
            const { updateDoc: updateFirestoreDoc } = await import('firebase/firestore');
            await updateFirestoreDoc(
              doc(db, 'companies', companyId, PROJECTED_RECEIPTS_COLLECTION, existingSnap.docs[0].id),
              receiptData
            );
            result.itemsUpdated++;
          } else {
            await addDoc(
              collection(db, 'companies', companyId, PROJECTED_RECEIPTS_COLLECTION),
              { ...receiptData, createdAt: Timestamp.now() }
            );
            result.itemsIngested++;
          }
        } catch (err) {
          result.errors.push(`Receipt ${projectDoc.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      // ── 2. CRM deal-based receipts (deals with linked projects) ──
      try {
        const dealsRef = collection(db, 'deals');
        const dealsQuery = query(
          dealsRef,
          where('stage', 'in', ['quotation', 'negotiation', 'won']),
          orderBy('updatedAt', 'desc')
        );
        const dealsSnapshot = await getDocs(dealsQuery);

        for (const dealDoc of dealsSnapshot.docs) {
          const deal = dealDoc.data();
          const dealValue = (deal.value as number) || 0;
          const linkedProjectId = (deal.linkedProjectId as string) || '';

          if (dealValue <= 0) continue;

          // Skip if this deal's project was already ingested above
          if (linkedProjectId) {
            const projectSourceId = `project-receipt-${linkedProjectId}`;
            const existingRef = collection(db, 'companies', companyId, PROJECTED_RECEIPTS_COLLECTION);
            const existingQ = query(existingRef, where('sourceId', '==', projectSourceId), limit(1));
            const existingSnap = await getDocs(existingQ);
            if (!existingSnap.empty) continue;
          }

          const dealSourceId = `deal-receipt-${dealDoc.id}`;
          const existingRef = collection(db, 'companies', companyId, PROJECTED_RECEIPTS_COLLECTION);
          const existingQ = query(existingRef, where('sourceId', '==', dealSourceId), limit(1));
          const existingSnap = await getDocs(existingQ);
          if (!existingSnap.empty) {
            result.itemsUpdated++;
            continue;
          }

          const dealStage = (deal.stage as string) || '';
          const confidence = dealStage === 'won'
            ? { level: 'confirmed' as const, score: 90 }
            : dealStage === 'negotiation'
              ? { level: 'probable' as const, score: 60 }
              : { level: 'possible' as const, score: 40 };

          const expectedDate = deal.expectedCloseDate
            ? (deal.expectedCloseDate.toDate ? deal.expectedCloseDate : Timestamp.fromDate(new Date(deal.expectedCloseDate)))
            : Timestamp.fromDate(new Date(Date.now() + 45 * 24 * 60 * 60 * 1000));

          await addDoc(
            collection(db, 'companies', companyId, PROJECTED_RECEIPTS_COLLECTION),
            {
              companyId,
              subsidiaryId: (deal.subsidiaryId as string) || 'dawin-finishes',
              sourceType: 'project_final',
              sourceId: dealSourceId,
              sourceName: (deal.name as string) || (deal.title as string) || 'Deal',
              customerId: (deal.customerId as string) || (deal.contactId as string) || null,
              customerName: (deal.customerName as string) || (deal.contactName as string) || null,
              amount: dealValue,
              currency: (deal.currency as string) || 'UGX',
              expectedDate,
              confidenceLevel: confidence.level,
              confidenceScore: confidence.score,
              status: 'projected',
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            }
          );

          result.itemsIngested++;
        }
      } catch (err) {
        result.errors.push(`CRM deal receipt ingestion: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    } catch (err) {
      result.errors.push(`Income ingestion failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return result;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MANUFACTURING DATA INGESTION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Ingest purchase orders, procurement requirements, and manufacturing orders.
   */
  async ingestManufacturingData(companyId: string): Promise<IngestionResult> {
    const result: IngestionResult = {
      source: 'manufacturing',
      timestamp: Timestamp.now(),
      itemsIngested: 0,
      itemsUpdated: 0,
      itemsSkipped: 0,
      errors: [],
    };

    try {
      // ── Purchase Orders ──
      await this.ingestPurchaseOrders(companyId, result);

      // ── Procurement Requirements (pre-PO forecasts) ──
      await this.ingestProcurementRequirements(companyId, result);

      // ── Manufacturing Orders (pre-PO cost projections) ──
      await this.ingestManufacturingOrders(companyId, result);

    } catch (err) {
      result.errors.push(`Manufacturing ingestion failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return result;
  }

  private async ingestPurchaseOrders(
    companyId: string,
    result: IngestionResult
  ): Promise<void> {
    const poRef = collection(db, 'purchaseOrders');
    const poQuery = query(
      poRef,
      where('status', 'in', ['draft', 'pending-approval', 'approved', 'sent', 'partially-received'])
    );
    const poSnapshot = await getDocs(poQuery);

    for (const poDoc of poSnapshot.docs) {
      const po = poDoc.data();

      try {
        const totalAmount = po.totals?.grandTotal || 0;
        if (totalAmount <= 0) {
          result.itemsSkipped++;
          continue;
        }

        const receivedValue = this.calculateReceivedValue(po);
        const remainingAmount = totalAmount - receivedValue;

        if (remainingAmount <= 0) {
          result.itemsSkipped++;
          continue;
        }

        const sourceId = `po-${poDoc.id}`;

        const currency = po.totals?.currency === 'USD' ? 'USD' : 'UGX';
        const exchangeRate = po.exchangeRateOverride || 3750;

        const linkedMOIds = (po.linkedMOIds as string[]) || [];
        const poCrossLinks: ExpenditureCrossLinks = {
          purchaseOrderId: poDoc.id,
          purchaseOrderRef: (po.poNumber as string) || undefined,
          supplierId: (po.supplierId as string) || undefined,
          supplierName: (po.supplierName as string) || undefined,
          designProjectId: (po.linkedProjectId as string) || undefined,
          manufacturingOrderId: linkedMOIds[0] || undefined,
        };

        // Check if already ingested — if so, enrich with new fields
        const existing = await this.findExistingExpenditure(companyId, 'purchase_order', sourceId);
        if (existing) {
          await optimizerService.updateExpenditure(companyId, existing.id, {
            crossLinks: poCrossLinks,
            commitmentLevel: 'committed',
          }, 'system');
          result.itemsUpdated++;
          continue;
        }

        await optimizerService.addExpenditure(companyId, {
          companyId,
          subsidiaryId: po.subsidiaryId || 'dawin-finishes',
          projectId: po.linkedProjectId,
          description: `PO ${po.poNumber}: ${po.supplierName || 'Supplier'}`,
          category: this.classifyPOCategory(po),
          vendor: po.supplierName,
          vendorId: po.supplierId,
          amount: remainingAmount,
          currency,
          exchangeRate: currency === 'USD' ? exchangeRate : undefined,
          amountUGX: currency === 'USD' ? remainingAmount * exchangeRate : remainingAmount,
          sourceType: 'purchase_order',
          sourceId,
          requestedDate: Timestamp.now(),
          earliestDate: Timestamp.now(),
          latestDate: Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
          revenueUnlock: po.linkedProjectId
            ? {
                enabled: true,
                unlockAmount: remainingAmount * 2,
                unlockTimelineDays: 30,
                unlockConfidence: 60,
                unlockMultiplier: 2,
                dependencyChain: [],
              }
            : defaultRevenueUnlock(),
          risk: {
            receiptRiskScore: 20,
            vendorRelationshipRisk: po.status === 'sent' ? 70 : 40,
            operationalImpact: 70,
            penaltyAmount: 0,
            contractualObligation: po.status === 'approved' || po.status === 'sent',
          },
          crossLinks: poCrossLinks,
          commitmentLevel: 'committed',
          status: 'pending',
        }, 'system');

        result.itemsIngested++;
      } catch (err) {
        result.errors.push(`PO ${poDoc.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  }

  private async ingestProcurementRequirements(
    companyId: string,
    result: IngestionResult
  ): Promise<void> {
    const reqRef = collection(db, 'procurementRequirements');
    const reqQuery = query(
      reqRef,
      where('status', 'in', ['pending', 'ordered'])
    );
    const reqSnapshot = await getDocs(reqQuery);

    for (const reqDoc of reqSnapshot.docs) {
      const req = reqDoc.data();

      try {
        const estimatedCost = req.estimatedTotalCost || 0;
        if (estimatedCost <= 0) {
          result.itemsSkipped++;
          continue;
        }

        // Skip if already converted to a PO
        if (req.poId) {
          result.itemsSkipped++;
          continue;
        }

        const sourceId = `procurement-req-${reqDoc.id}`;
        const existing = await this.findExistingExpenditure(
          companyId, 'procurement_requirement', sourceId
        );
        if (existing) {
          result.itemsUpdated++;
          continue;
        }

        const currency = req.currency === 'USD' ? 'USD' : 'UGX';

        await optimizerService.addExpenditure(companyId, {
          companyId,
          subsidiaryId: req.subsidiaryId || 'dawin-finishes',
          projectId: req.projectCode,
          description: `Procurement: ${req.itemDescription || 'Material requirement'}`,
          category: 'materials',
          vendor: req.supplierName,
          vendorId: req.supplierId,
          amount: estimatedCost,
          currency,
          amountUGX: currency === 'USD' ? estimatedCost * 3750 : estimatedCost,
          sourceType: 'procurement_requirement',
          sourceId,
          requestedDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
          earliestDate: Timestamp.now(),
          latestDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
          revenueUnlock: defaultRevenueUnlock(),
          risk: {
            receiptRiskScore: 40,
            vendorRelationshipRisk: 20,
            operationalImpact: 50,
            penaltyAmount: 0,
            contractualObligation: false,
          },
          status: 'pending',
        }, 'system');

        result.itemsIngested++;
      } catch (err) {
        result.errors.push(`Req ${reqDoc.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Ingest Manufacturing Orders as early-visibility cost projections.
   * Handles double-counting: if MO has linked POs, only ingest labor (materials covered by POs).
   */
  private async ingestManufacturingOrders(
    companyId: string,
    result: IngestionResult
  ): Promise<void> {
    const moRef = collection(db, 'manufacturingOrders');
    const moQuery = query(
      moRef,
      where('status', 'in', ['draft', 'pending-approval', 'approved', 'in-progress', 'on-hold'])
    );
    const moSnapshot = await getDocs(moQuery);

    for (const moDoc of moSnapshot.docs) {
      const mo = moDoc.data();

      try {
        const materialCost = mo.costSummary?.materialCost || 0;
        // Internal labour is payroll — not an incremental cash outflow
        // Only material cost counts as cash expenditure
        const cashCost = materialCost;

        if (cashCost <= 0) {
          result.itemsSkipped++;
          continue;
        }

        const linkedPOIds: string[] = mo.linkedPOIds || [];
        const hasLinkedPOs = linkedPOIds.length > 0;

        if (hasLinkedPOs) {
          // Materials are covered by POs.
          // Labour is internal payroll — not an incremental cash outflow. Skip entirely.
          result.itemsSkipped++;
          continue;
        } else {
          // No linked POs — check if design item already in queue
          if (mo.designItemId && mo.projectId) {
            const designItemSourceId = `project-${mo.projectId}-item-${mo.designItemId}`;
            const existingDesignItem = await this.findExistingExpenditure(companyId, 'project', designItemSourceId);
            if (existingDesignItem) {
              result.itemsSkipped++;
              continue;
            }
          }

          const sourceId = `mo-${moDoc.id}`;

          const moFullCrossLinks: ExpenditureCrossLinks = {
            manufacturingOrderId: moDoc.id,
            manufacturingOrderRef: (mo.moNumber as string) || undefined,
            designItemId: (mo.designItemId as string) || undefined,
            designProjectId: (mo.projectId as string) || undefined,
          };

          const existing = await this.findExistingExpenditure(companyId, 'manufacturing_order', sourceId);
          if (existing) {
            await optimizerService.updateExpenditure(companyId, existing.id, {
              crossLinks: moFullCrossLinks,
              commitmentLevel: 'committed',
              costBreakdown: {
                materialsCost: materialCost, laborCost: 0, processingCost: 0,
                logisticsCost: 0, subcontractorCost: 0,
                totalPureCost: cashCost, sourcingType: 'CUSTOM_FURNITURE_MILLWORK',
                confidenceLevel: 'estimated',
              },
            }, 'system');
            result.itemsUpdated++;
            continue;
          }

          await optimizerService.addExpenditure(companyId, {
            companyId,
            subsidiaryId: mo.subsidiaryId || 'dawin-finishes',
            projectId: mo.projectId,
            projectName: mo.projectCode,
            description: `MO ${mo.moNumber}: ${mo.designItemName || 'Manufacturing'}`,
            category: 'materials',
            amount: cashCost,
            currency: mo.costSummary?.currency || 'UGX',
            amountUGX: cashCost,
            sourceType: 'manufacturing_order',
            sourceId,
            requestedDate: mo.scheduling?.scheduledStart || Timestamp.now(),
            earliestDate: Timestamp.now(),
            latestDate: mo.scheduling?.scheduledEnd
              || Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
            revenueUnlock: defaultRevenueUnlock(),
            risk: {
              receiptRiskScore: 25,
              vendorRelationshipRisk: 15,
              operationalImpact: 75,
              penaltyAmount: 0,
              contractualObligation: false,
            },
            costBreakdown: {
              materialsCost: materialCost,
              laborCost: 0, // Internal payroll — excluded from cash expenditure
              processingCost: 0,
              logisticsCost: 0,
              subcontractorCost: 0,
              totalPureCost: cashCost,
              sourcingType: 'CUSTOM_FURNITURE_MILLWORK',
              confidenceLevel: 'estimated',
            },
            crossLinks: moFullCrossLinks,
            commitmentLevel: 'committed',
            status: 'pending',
          }, 'system');

          result.itemsIngested++;
        }
      } catch (err) {
        result.errors.push(`MO ${moDoc.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LIABILITY REGISTER INGESTION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Ingest active liabilities from the liability register into the expenditure queue.
   * Covers statutory obligations (PAYE, VAT, NSSF), rent, loans, vendor credits,
   * insurance, licenses, and utility contracts detected from QBO patterns.
   * Only ingests liabilities with outstanding balances (status !== 'paid').
   */
  async ingestLiabilities(companyId: string): Promise<IngestionResult> {
    const result: IngestionResult = {
      source: 'liabilities',
      timestamp: Timestamp.now(),
      itemsIngested: 0,
      itemsUpdated: 0,
      itemsSkipped: 0,
      errors: [],
    };

    try {
      const liabilitiesRef = collection(db, 'companies', companyId, LIABILITY_REGISTER_COLLECTION);
      const liabilitiesQuery = query(
        liabilitiesRef,
        where('status', 'in', ['current', 'due_soon', 'overdue', 'pending_review']),
      );
      const snapshot = await getDocs(liabilitiesQuery);

      for (const liabilityDoc of snapshot.docs) {
        try {
          const liability = liabilityDoc.data();
          // Support both new format (amountRemaining) and legacy (estimatedAmount)
          const amountRemaining = (liability.amountRemaining as number)
            || (liability.totalAmount as number)
            || (liability.estimatedAmount as number)
            || 0;

          if (amountRemaining <= 0) {
            result.itemsSkipped++;
            continue;
          }

          const liabilityType = (liability.type as string) || 'other';
          const category = this.classifyLiabilityCategory(liabilityType);
          const sourceType: ExpenditureSourceType =
            ['tax_paye', 'tax_vat', 'tax_corporate', 'nssf'].includes(liabilityType)
              ? 'statutory'
              : 'recurring';
          const sourceId = `liability-${liabilityDoc.id}`;

          const priority = (liability.priority as string) || 'operational';
          const isNonNegotiable = (liability.isNonNegotiable as boolean) || false;
          const commitmentLevel: CommitmentLevel =
            priority === 'statutory' || priority === 'contractual' || isNonNegotiable
              ? 'committed'
              : 'probable';

          const currency: 'UGX' | 'USD' = (liability.currency as string) === 'USD' ? 'USD' : 'UGX';
          const amountUGX = currency === 'USD' ? amountRemaining * 3750 : amountRemaining;

          const nextDueDate = liability.nextDueDate as Timestamp | undefined;
          const dueTimestamp = nextDueDate || Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
          const status = (liability.status as string) || 'current';

          const vendorName = (liability.vendorName as string) || undefined;
          const description = (liability.description as string) || liabilityType;

          const penaltyRate = (liability.penaltyRate as number) || 0;
          const penaltyAmount = status === 'overdue' ? amountRemaining * (penaltyRate / 100) : 0;

          const existing = await this.findExistingExpenditure(companyId, sourceType, sourceId);

          if (existing) {
            // Update with latest amounts and dates
            await optimizerService.updateExpenditure(companyId, existing.id, {
              amount: amountRemaining,
              amountUGX,
              requestedDate: dueTimestamp,
              latestDate: dueTimestamp,
              commitmentLevel,
              description: `${description}${vendorName ? ` — ${vendorName}` : ''}`,
              risk: {
                receiptRiskScore: 0,
                vendorRelationshipRisk: 0,
                operationalImpact: isNonNegotiable ? 100 : 60,
                penaltyAmount,
                contractualObligation: isNonNegotiable,
              },
            }, 'system');
            result.itemsUpdated++;
            continue;
          }

          await optimizerService.addExpenditure(companyId, {
            companyId,
            subsidiaryId: (liability.subsidiaryId as string) || 'dawin-finishes',
            description: `${description}${vendorName ? ` — ${vendorName}` : ''}`,
            category,
            vendor: vendorName,
            vendorId: (liability.vendorId as string) || undefined,
            amount: amountRemaining,
            currency,
            amountUGX,
            sourceType,
            sourceId,
            requestedDate: dueTimestamp,
            earliestDate: Timestamp.now(),
            latestDate: dueTimestamp,
            revenueUnlock: defaultRevenueUnlock(),
            risk: {
              receiptRiskScore: 0,
              vendorRelationshipRisk: 0,
              operationalImpact: isNonNegotiable ? 100 : 60,
              penaltyAmount,
              contractualObligation: isNonNegotiable,
            },
            commitmentLevel,
            status: 'pending',
          }, 'system');

          result.itemsIngested++;
        } catch (err) {
          result.errors.push(`Liability ${liabilityDoc.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      // Clean up paid liabilities that still have expenditure entries
      const paidQuery = query(
        liabilitiesRef,
        where('status', '==', 'paid'),
      );
      const paidSnapshot = await getDocs(paidQuery);
      for (const paidDoc of paidSnapshot.docs) {
        const statutorySourceId = `liability-${paidDoc.id}`;
        const staleStatutory = await this.findExistingExpenditure(companyId, 'statutory', statutorySourceId);
        if (staleStatutory) {
          await deleteDoc(doc(db, 'companies', companyId, 'expenditure_queue', staleStatutory.id));
        }
        const staleRecurring = await this.findExistingExpenditure(companyId, 'recurring', statutorySourceId);
        if (staleRecurring) {
          await deleteDoc(doc(db, 'companies', companyId, 'expenditure_queue', staleRecurring.id));
        }
      }
    } catch (err) {
      result.errors.push(`Liability ingestion failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return result;
  }

  private classifyLiabilityCategory(type: string): ExpenditureCategory {
    switch (type) {
      case 'tax_paye':
      case 'tax_vat':
      case 'tax_corporate':
      case 'nssf':
        return 'statutory';
      case 'rent':
        return 'rent';
      case 'loan':
      case 'vendor_credit':
        return 'loan_repayment';
      case 'insurance':
      case 'license':
        return 'overhead';
      case 'utility_contract':
        return 'utilities';
      default:
        return 'other';
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FULL INGESTION ORCHESTRATOR
  // ══════════════════════════════════════════════════════════════════════════

  async runFullIngestion(companyId: string): Promise<FullIngestionResult> {
    const startedAt = Timestamp.now();

    const [qboResult, projectsResult, manufacturingResult, receiptsResult, liabilitiesResult] = await Promise.all([
      this.ingestQBOData(companyId),
      this.ingestProjectCosts(companyId),
      this.ingestManufacturingData(companyId),
      this.ingestProjectIncome(companyId),
      this.ingestLiabilities(companyId),
    ]);

    const completedAt = Timestamp.now();

    return {
      startedAt,
      completedAt,
      sources: {
        qbo: qboResult,
        projects: projectsResult,
        manufacturing: manufacturingResult,
        receipts: receiptsResult,
        liabilities: liabilitiesResult,
      },
      totalExpenditureItems:
        qboResult.itemsIngested +
        projectsResult.itemsIngested +
        manufacturingResult.itemsIngested +
        liabilitiesResult.itemsIngested,
      totalReceiptItems: receiptsResult.itemsIngested,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COST BREAKDOWN EXTRACTION — Pure costs only (no profit, no overhead)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Extract granular cost breakdown from a design item.
   * Returns only pure costs — materials, labor, processing, logistics, subcontractor.
   * Explicitly EXCLUDES overhead, profit margins, and management fees.
   */
  private extractItemCostBreakdown(item: Record<string, unknown>): ItemCostBreakdown {
    const sourcingType = ((item.sourcingType as string) || '').toUpperCase();

    // Try manufacturing cost (MANUFACTURED / CUSTOM_FURNITURE_MILLWORK)
    const mfg = (item.manufacturing || item.manufacturingCost) as Record<string, unknown> | undefined;
    if (mfg && (sourcingType === 'MANUFACTURED' || sourcingType === 'CUSTOM_FURNITURE_MILLWORK' || mfg.totalCost)) {
      return this.extractManufacturingCost(mfg, sourcingType || 'CUSTOM_FURNITURE_MILLWORK');
    }

    // Try procurement pricing (PROCURED)
    const proc = (item.procurement || item.procurementPricing) as Record<string, unknown> | undefined;
    if (proc && (sourcingType === 'PROCURED' || proc.totalLandedCost)) {
      return this.extractProcurementCost(proc);
    }

    // Try construction pricing (CONSTRUCTION)
    const con = item.construction as Record<string, unknown> | undefined;
    if (con && (sourcingType === 'CONSTRUCTION' || con.totalCost)) {
      return this.extractConstructionCost(con);
    }

    // Try architectural pricing (ARCHITECTURAL / DESIGN_DOCUMENT)
    const arch = (item.architectural || item.architecturalPricing) as Record<string, unknown> | undefined;
    if (arch && (sourcingType === 'ARCHITECTURAL' || sourcingType === 'DESIGN_DOCUMENT' || arch.totalCost)) {
      return this.extractArchitecturalCost(arch, sourcingType || 'ARCHITECTURAL');
    }

    return zeroCostBreakdown(sourcingType || 'unknown');
  }

  private extractManufacturingCost(mfg: Record<string, unknown>, sourcingType: string): ItemCostBreakdown {
    // Item quantity multiplier (e.g., 4 nightstands — per-unit costs × 4)
    const itemQuantity = (mfg.quantity as number) || 1;

    const perUnitMaterialsCost =
      ((mfg.sheetMaterialsCost as number) || 0) +
      ((mfg.timberMaterialsCost as number) || 0) +
      ((mfg.linearMaterialsCost as number) || 0) +
      ((mfg.edgingMaterialsCost as number) || 0) +
      ((mfg.standardPartsCost as number) || 0) +
      ((mfg.specialPartsCost as number) || 0);

    const materialsCost = (perUnitMaterialsCost || ((mfg.materialCost as number) || 0)) * itemQuantity;
    const processingCost = ((mfg.processingCost as number) || 0) * itemQuantity;

    // Internal labour is covered by payroll — not an incremental cash outflow.
    // Track separately but exclude from totalPureCost (the cash expenditure amount).
    // const internalLaborCost = ((mfg.laborCost as number) || 0) * itemQuantity;

    // Cash expenditure = materials + processing only (no internal labour)
    let totalPureCost = materialsCost + processingCost;

    // Fallback: if individual breakdowns missing, use totalCost minus labour
    if (totalPureCost <= 0) {
      const totalCost = (mfg.totalCost as number) || 0;
      const laborPortion = (mfg.laborCost as number) || 0;
      totalPureCost = (totalCost - laborPortion) * itemQuantity;
    }

    const confidenceLevel: CostConfidenceLevel = mfg.autoCalculated ? 'estimated' : 'quoted';

    return {
      materialsCost,
      laborCost: 0, // Internal payroll — excluded from cash expenditure
      processingCost,
      logisticsCost: 0,
      subcontractorCost: 0,
      totalPureCost,
      sourcingType,
      confidenceLevel,
    };
  }

  private extractProcurementCost(proc: Record<string, unknown>): ItemCostBreakdown {
    const exchangeRate = (proc.exchangeRate as number) || 1;
    const totalItemCost = (proc.totalItemCost as number) || 0;
    const totalLogistics = (proc.totalLogistics as number) || 0;
    const totalCustoms = (proc.totalCustoms as number) || 0;

    const materialsCost = totalItemCost * exchangeRate;
    const logisticsCost = (totalLogistics + totalCustoms) * exchangeRate;

    // totalLandedCost is already in target currency
    const totalPureCost = (proc.totalLandedCost as number) || (materialsCost + logisticsCost);

    const confidenceLevel: CostConfidenceLevel = proc.quotedAt ? 'quoted' : 'estimated';

    return {
      materialsCost,
      laborCost: 0,
      processingCost: 0,
      logisticsCost,
      subcontractorCost: 0,
      totalPureCost,
      sourcingType: 'PROCURED',
      confidenceLevel,
    };
  }

  private extractConstructionCost(con: Record<string, unknown>): ItemCostBreakdown {
    const pricingMethod = (con.pricingMethod as string) || '';
    let materialsCost = 0;
    let laborCost = 0;
    let subcontractorCost = 0;

    switch (pricingMethod) {
      case 'cost_plus':
        // EXCLUDE managementFeeAmount — it is markup, not a cash outflow
        laborCost = (con.laborCost as number) || 0;
        materialsCost = (con.materialsCost as number) || 0;
        break;

      case 'day_works':
        laborCost = ((con.laborDays as number) || 0) * ((con.laborDailyRate as number) || 0);
        materialsCost = (con.materialsCost as number) || 0;
        break;

      case 'measured':
        // Contract price — entire amount goes to subcontractor
        subcontractorCost = ((con.quantity as number) || 0) * ((con.unitRate as number) || 0);
        break;

      case 'lump_sum':
        subcontractorCost = (con.lumpSumAmount as number) || 0;
        break;

      case 'contractor_quote': {
        const lineItems = (con.quoteLineItems as Array<{ amount?: number }>) || [];
        if (lineItems.length > 0) {
          subcontractorCost = lineItems.reduce((sum, li) => sum + ((li.amount as number) || 0), 0);
        } else {
          subcontractorCost = (con.lumpSumAmount as number) || 0;
        }
        break;
      }

      case 'composite': {
        // Recurse through sub-items, applying same rules
        const subItems = (con.subItems as Array<Record<string, unknown>>) || [];
        for (const sub of subItems) {
          const subMethod = (sub.pricingMethod as string) || '';
          if (subMethod === 'cost_plus') {
            laborCost += (sub.laborCost as number) || 0;
            materialsCost += (sub.materialsCost as number) || 0;
          } else if (subMethod === 'day_works') {
            laborCost += ((sub.laborDays as number) || 0) * ((sub.laborDailyRate as number) || 0);
            materialsCost += (sub.materialsCost as number) || 0;
          } else if (subMethod === 'measured') {
            subcontractorCost += ((sub.quantity as number) || 0) * ((sub.unitRate as number) || 0);
          } else if (subMethod === 'lump_sum') {
            subcontractorCost += (sub.lumpSumAmount as number) || 0;
          } else if (subMethod === 'contractor_quote') {
            const subLineItems = (sub.quoteLineItems as Array<{ amount?: number }>) || [];
            subcontractorCost += subLineItems.reduce((sum, li) => sum + ((li.amount as number) || 0), 0);
          } else {
            // Legacy sub-item
            subcontractorCost += (sub.totalCost as number) || 0;
          }
        }
        break;
      }

      default:
        // Legacy fallback: undefined pricingMethod
        laborCost = (con.laborCost as number) || 0;
        materialsCost = (con.materialsCost as number) || 0;
        subcontractorCost = ((con.quantity as number) || 0) * ((con.unitRate as number) || 0);
        break;
    }

    const totalPureCost = materialsCost + laborCost + subcontractorCost;
    const confidenceLevel: CostConfidenceLevel = con.quotedAt ? 'quoted' : 'estimated';

    return {
      materialsCost,
      laborCost,
      processingCost: 0,
      logisticsCost: 0,
      subcontractorCost,
      totalPureCost,
      sourcingType: 'CONSTRUCTION',
      confidenceLevel,
    };
  }

  private extractArchitecturalCost(arch: Record<string, unknown>, sourcingType: string): ItemCostBreakdown {
    const laborCost = (arch.totalLaborCost as number) || 0;
    const subcontractorCost = (arch.totalFixedCosts as number) || 0;
    const totalPureCost = laborCost + subcontractorCost;

    return {
      materialsCost: 0,
      laborCost,
      processingCost: 0,
      logisticsCost: 0,
      subcontractorCost,
      totalPureCost,
      sourcingType,
      confidenceLevel: 'estimated',
    };
  }

  /**
   * Fallback: reverse-calculate pure cost from the project estimate by stripping markup.
   * Used when a design item has no individual cost fields populated.
   */
  private extractCostFromEstimate(
    project: Record<string, unknown>,
    itemId: string,
    item: Record<string, unknown>
  ): ItemCostBreakdown {
    const estimate = project.consolidatedEstimate as Record<string, unknown> | undefined;
    if (!estimate) return zeroCostBreakdown((item.sourcingType as string) || 'unknown');

    const subtotal = (estimate.subtotal as number) || 0;
    if (subtotal <= 0) return zeroCostBreakdown((item.sourcingType as string) || 'unknown');

    const lineItems = (estimate.lineItems as Array<Record<string, unknown>>) || [];
    const itemLines = lineItems.filter(li => li.linkedDesignItemId === itemId);

    if (itemLines.length === 0) return zeroCostBreakdown((item.sourcingType as string) || 'unknown');

    const itemSubtotal = itemLines.reduce((s, li) => s + ((li.totalPrice as number) || 0), 0);

    // Method 1: Use tracked overhead/margin amounts (most accurate)
    const overheadAmount = (estimate.overheadAmount as number) || 0;
    const marginAmount = (estimate.marginAmount as number) || 0;

    let pureCost: number;
    if (overheadAmount > 0 || marginAmount > 0) {
      const costBasis = subtotal - overheadAmount - marginAmount;
      const proportion = subtotal > 0 ? itemSubtotal / subtotal : 0;
      pureCost = Math.round(costBasis * proportion);
    } else {
      // Method 2: Reverse-calculate using percentages
      const overheadPercent = (estimate.overheadPercent as number) || 0;
      const marginPercent = (estimate.marginPercent as number) || 0;
      const totalMarkup = (1 + overheadPercent) * (1 + marginPercent);
      pureCost = Math.round(itemSubtotal / totalMarkup);
    }

    return {
      materialsCost: pureCost,
      laborCost: 0,
      processingCost: 0,
      logisticsCost: 0,
      subcontractorCost: 0,
      totalPureCost: pureCost,
      sourcingType: (item.sourcingType as string) || 'unknown',
      confidenceLevel: 'estimated',
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Evaluate whether a project+item should enter the expenditure queue.
   * Returns CommitmentSource if it qualifies, or null if it should be excluded
   * (speculative/lost deals are filtered out entirely).
   */
  private async evaluateProjectCommitment(
    project: Record<string, unknown>,
    item: Record<string, unknown>,
    _companyId: string,
    crmDealsCache: Map<string, Record<string, unknown>>,
    salesOrderCache: Map<string, { id: string; status: string } | null>
  ): Promise<CommitmentSource | null> {
    const now = new Date().toISOString();
    const projectStatus = ((project.status as string) || '').toLowerCase();
    const projectDealId = (project.dealId as string) || '';
    const projectId = (project.id as string) || '';

    // ── Check CRM deal stage (exclusions first) ──
    let dealStage = '';
    if (projectDealId && crmDealsCache.has(projectDealId)) {
      const deal = crmDealsCache.get(projectDealId)!;
      dealStage = ((deal.stage as string) || '').toLowerCase();

      // Excluded deals — skip entirely
      if (EXCLUDED_DEAL_STAGES.includes(dealStage)) return null;

      // Speculative deals — skip entirely
      if (SPECULATIVE_DEAL_STAGES.includes(dealStage)) return null;
    }

    // ── Check Sales Order status (primary commitment signal) ──
    const salesOrder = projectId ? salesOrderCache.get(projectId) || null : null;

    if (salesOrder) {
      const soStatus = salesOrder.status;

      // SO cancelled/disputed → exclude
      if (SO_EXCLUDED_STATUSES.includes(soStatus)) return null;

      // SO committed statuses (deposit paid or production started)
      if (SO_COMMITTED_STATUSES.includes(soStatus)) {
        return {
          level: 'committed',
          reason: buildCommitmentReason('Sales Order confirmed', { soStatus }),
          salesOrderId: salesOrder.id,
          salesOrderStatus: soStatus,
          crmDealId: projectDealId || undefined,
          crmDealStage: dealStage || undefined,
          quoteApproved: !!project.quoteApproved,
          hasMO: !!(item.manufacturingOrderId),
          hasPO: !!(item.purchaseOrderId),
          hasShopifyOrder: false,
          evaluatedAt: now,
        };
      }

      // SO probable statuses (client accepted but not yet in production)
      if (SO_PROBABLE_STATUSES.includes(soStatus)) {
        return {
          level: 'probable',
          reason: buildCommitmentReason('Sales Order in progress', { soStatus }),
          salesOrderId: salesOrder.id,
          salesOrderStatus: soStatus,
          crmDealId: projectDealId || undefined,
          crmDealStage: dealStage || undefined,
          quoteApproved: !!project.quoteApproved,
          hasMO: !!(item.manufacturingOrderId),
          hasPO: !!(item.purchaseOrderId),
          hasShopifyOrder: false,
          evaluatedAt: now,
        };
      }
    }

    // ── CRM deal won (without SO) → probable (downgraded — no SO formalizes it) ──
    if (COMMITTED_DEAL_STAGES.includes(dealStage)) {
      return {
        level: 'probable',
        reason: buildCommitmentReason('CRM deal won, awaiting Sales Order', { dealStage }),
        crmDealId: projectDealId,
        crmDealStage: dealStage,
        quoteApproved: !!project.quoteApproved,
        hasMO: !!(item.manufacturingOrderId),
        hasPO: !!(item.purchaseOrderId),
        hasShopifyOrder: false,
        evaluatedAt: now,
      };
    }

    // ── Check for MO/PO existence (committed even without SO — real production) ──
    if (item.manufacturingOrderId || item.purchaseOrderId) {
      return {
        level: 'committed',
        reason: buildCommitmentReason('MO/PO exists', {
          hasMO: !!item.manufacturingOrderId,
          hasPO: !!item.purchaseOrderId,
        }),
        quoteApproved: !!project.quoteApproved,
        hasMO: !!(item.manufacturingOrderId),
        hasPO: !!(item.purchaseOrderId),
        hasShopifyOrder: false,
        evaluatedAt: now,
      };
    }

    // ── Check project status (active production) ──
    if (['in-progress', 'production', 'in_progress'].includes(projectStatus)) {
      return {
        level: 'committed',
        reason: buildCommitmentReason('Project in active production', { projectStatus }),
        quoteApproved: !!project.quoteApproved,
        hasMO: false,
        hasPO: false,
        hasShopifyOrder: false,
        evaluatedAt: now,
      };
    }

    // ── Quote approved WITHOUT SO → probable (not committed without formal SO) ──
    if (project.quoteApproved || (project.quoteStatus as string) === 'approved') {
      return {
        level: 'probable',
        reason: buildCommitmentReason('Quote approved, awaiting Sales Order', {}),
        quoteApproved: true,
        hasMO: false,
        hasPO: false,
        hasShopifyOrder: false,
        evaluatedAt: now,
      };
    }

    // ── Quote sent/viewed WITHOUT SO → EXCLUDE (no client confirmation) ──
    // ── Draft/concept/estimation WITHOUT SO → EXCLUDE ──
    // ── Fallback → EXCLUDE ──
    // These projects have no formal client acceptance — they don't belong in the queue
    return null;
  }

  /**
   * Pre-load CRM deals by their IDs for batch evaluation.
   */
  private async preloadCrmDeals(dealIds: string[]): Promise<Map<string, Record<string, unknown>>> {
    const cache = new Map<string, Record<string, unknown>>();
    const uniqueIds = [...new Set(dealIds.filter(Boolean))];

    // Firestore 'in' queries are limited to 30 values
    for (let i = 0; i < uniqueIds.length; i += 30) {
      const batch = uniqueIds.slice(i, i + 30);
      const dealsRef = collection(db, 'deals');
      const dealsQuery = query(dealsRef, where('__name__', 'in', batch));
      const snapshot = await getDocs(dealsQuery);
      for (const doc of snapshot.docs) {
        cache.set(doc.id, doc.data());
      }
    }
    return cache;
  }

  private async findExistingExpenditure(
    companyId: string,
    sourceType: ExpenditureSourceType,
    sourceId: string
  ): Promise<ExpenditureItem | null> {
    const q = query(
      collection(db, 'companies', companyId, 'expenditure_queue'),
      where('sourceType', '==', sourceType),
      where('sourceId', '==', sourceId),
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as ExpenditureItem;
  }

  private classifyBillCategory(bill: Record<string, unknown>): ExpenditureCategory {
    const desc = ((bill.Line as Array<{ Description?: string }>)?.[0]?.Description || '').toLowerCase();
    if (desc.includes('rent') || desc.includes('lease')) return 'rent';
    if (desc.includes('salary') || desc.includes('wage') || desc.includes('payroll')) return 'labor';
    if (desc.includes('tax') || desc.includes('paye') || desc.includes('nssf') || desc.includes('vat')) return 'statutory';
    if (desc.includes('loan') || desc.includes('repayment')) return 'loan_repayment';
    if (desc.includes('electric') || desc.includes('water') || desc.includes('internet')) return 'utilities';
    if (desc.includes('material') || desc.includes('supply') || desc.includes('timber') || desc.includes('hardware')) return 'materials';
    if (desc.includes('transport') || desc.includes('delivery') || desc.includes('shipping')) return 'transport';
    if (desc.includes('insurance') || desc.includes('professional') || desc.includes('legal') || desc.includes('audit')) return 'professional_fees';
    return 'other';
  }

  /**
   * Classify expenditure category using the cost breakdown for better accuracy.
   */
  private classifyFromBreakdown(
    breakdown: ItemCostBreakdown,
    item: Record<string, unknown>
  ): ExpenditureCategory {
    // If subcontractor cost dominates, it's a subcontractor payment
    if (breakdown.subcontractorCost > 0 && breakdown.subcontractorCost >= breakdown.totalPureCost * 0.5) {
      return 'subcontractor';
    }
    // If labor cost dominates, classify as labor
    if (breakdown.laborCost > 0 && breakdown.laborCost >= breakdown.totalPureCost * 0.5) {
      return 'labor';
    }
    // Fall back to sourcing type classification
    const sourcingType = ((item.sourcingType as string) || '').toUpperCase();
    switch (sourcingType) {
      case 'MANUFACTURED':
      case 'CUSTOM_FURNITURE_MILLWORK':
      case 'PROCURED':
        return 'materials';
      case 'CONSTRUCTION':
        return 'subcontractor';
      case 'ARCHITECTURAL':
      case 'DESIGN_DOCUMENT':
        return 'professional_fees';
      default:
        return 'materials';
    }
  }

  private classifyPOCategory(po: Record<string, unknown>): ExpenditureCategory {
    const lineItems = (po.lineItems as Array<{ category?: string }>) || [];
    const categories = lineItems.map(li => li.category || '');

    if (categories.includes('asset')) return 'equipment';
    if (categories.includes('service')) return 'professional_fees';
    return 'materials';
  }

  private calculateProjectRevenueUnlock(
    project: Record<string, unknown>,
    pureCost: number
  ): RevenueUnlockInfo {
    const estimate = project.consolidatedEstimate as Record<string, unknown> | undefined;
    const quoteTotal = (estimate?.total as number) || 0;

    if (quoteTotal > pureCost && pureCost > 0) {
      // Multiplier reflects ACTUAL markup (revenue / cost)
      const multiplier = Math.round((quoteTotal / pureCost) * 10) / 10;
      return {
        enabled: true,
        unlockAmount: quoteTotal,
        unlockTimelineDays: 45,
        unlockConfidence: 50,
        unlockMultiplier: multiplier,
        dependencyChain: [],
      };
    }

    return defaultRevenueUnlock();
  }

  private calculateReceivedValue(po: Record<string, unknown>): number {
    const lineItems = (po.lineItems as Array<{
      quantityReceived?: number;
      unitCost?: number;
      effectiveUnitCost?: number;
    }>) || [];

    return lineItems.reduce((total, li) => {
      const received = li.quantityReceived || 0;
      const unitCost = li.effectiveUnitCost || li.unitCost || 0;
      return total + (received * unitCost);
    }, 0);
  }
}

function buildCommitmentReason(
  primary: string,
  context: Record<string, unknown>
): string {
  const details = Object.entries(context)
    .filter(([, v]) => v !== undefined && v !== null && v !== false && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  return details ? `${primary} (${details})` : primary;
}

function defaultRevenueUnlock(): RevenueUnlockInfo {
  return {
    enabled: false,
    unlockAmount: 0,
    unlockTimelineDays: 0,
    unlockConfidence: 0,
    unlockMultiplier: 0,
    dependencyChain: [],
  };
}

function zeroCostBreakdown(sourcingType: string): ItemCostBreakdown {
  return {
    materialsCost: 0,
    laborCost: 0,
    processingCost: 0,
    logisticsCost: 0,
    subcontractorCost: 0,
    totalPureCost: 0,
    sourcingType,
    confidenceLevel: 'estimated',
  };
}

export const dataIngestionService = new DataIngestionService();
