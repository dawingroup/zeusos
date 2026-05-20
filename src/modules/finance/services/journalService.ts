// ============================================================================
// JOURNAL SERVICE
// DawinOS v2.0 - Financial Management Module
// Service for Journal Entry management
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  DocumentSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import {
  JournalEntry,
  JournalLine,
  JournalEntryCreateInput,
  JournalEntryUpdateInput,
  JournalFilter,
  JournalSort,
  JOURNAL_STATUS,
  JOURNAL_TYPES,
  JOURNAL_SOURCES,
} from '../types/journal.types';
import { Account } from '../types/account.types';
import { DEFAULT_CURRENCY, FUNCTIONAL_CURRENCY } from '../constants/currency.constants';
import { balanceService } from './balanceService';

const COLLECTION_NAME = 'journals';

/**
 * Get fiscal year and period from date (Uganda fiscal year starts July 1)
 */
function getFiscalPeriod(date: Date): { fiscalYear: number; fiscalPeriod: number } {
  const month = date.getMonth(); // 0-11
  const year = date.getFullYear();
  
  // Uganda fiscal year: July 1 - June 30
  // July = period 1, June = period 12
  const fiscalYear = month >= 6 ? year + 1 : year;
  const fiscalPeriod = month >= 6 ? month - 5 : month + 7;
  
  return { fiscalYear, fiscalPeriod };
}

/**
 * Generate journal number
 */
function generateJournalNumber(fiscalYear: number, sequence: number): string {
  return `JE-${fiscalYear}-${sequence.toString().padStart(6, '0')}`;
}

/**
 * Journal Service Class
 */
class JournalService {
  private collectionRef(companyId: string) {
    return collection(db, 'companies', companyId, COLLECTION_NAME);
  }

  private docRef(companyId: string, journalId: string) {
    return doc(db, 'companies', companyId, COLLECTION_NAME, journalId);
  }

  private accountDocRef(companyId: string, accountId: string) {
    return doc(db, 'companies', companyId, 'accounts', accountId);
  }

  /**
   * Get journal by ID
   */
  async getById(companyId: string, journalId: string): Promise<JournalEntry | null> {
    const docSnap = await getDoc(this.docRef(companyId, journalId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as JournalEntry;
  }

  /**
   * Get journal by number
   */
  async getByNumber(companyId: string, journalNumber: string): Promise<JournalEntry | null> {
    const q = query(
      this.collectionRef(companyId),
      where('journalNumber', '==', journalNumber),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as JournalEntry;
  }

  /**
   * Get all journals with optional filtering
   */
  async getAll(
    companyId: string,
    filter?: JournalFilter,
    sort?: JournalSort,
    pageSize: number = 50,
    lastDoc?: DocumentSnapshot
  ): Promise<{ journals: JournalEntry[]; lastDoc: DocumentSnapshot | null }> {
    const constraints: QueryConstraint[] = [];

    // Apply filters
    if (filter?.fiscalYear) {
      constraints.push(where('fiscalYear', '==', filter.fiscalYear));
    }
    if (filter?.fiscalPeriod) {
      constraints.push(where('fiscalPeriod', '==', filter.fiscalPeriod));
    }
    if (filter?.types && filter.types.length > 0) {
      constraints.push(where('type', 'in', filter.types));
    }
    if (filter?.sources && filter.sources.length > 0) {
      constraints.push(where('source', 'in', filter.sources));
    }
    if (filter?.status && filter.status.length > 0) {
      constraints.push(where('status', 'in', filter.status));
    }

    // Apply sorting
    const sortField = sort?.field || 'date';
    const sortDirection = sort?.direction || 'desc';
    constraints.push(orderBy(sortField, sortDirection));

    // Apply pagination
    constraints.push(limit(pageSize));
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const q = query(this.collectionRef(companyId), ...constraints);
    const snapshot = await getDocs(q);

    const journals = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as JournalEntry[];

    // Apply date range filter (client-side due to Firestore limitations)
    let filteredJournals = journals;
    if (filter?.dateFrom || filter?.dateTo) {
      filteredJournals = journals.filter((j) => {
        const journalDate = j.date.toDate();
        if (filter.dateFrom && journalDate < filter.dateFrom) return false;
        if (filter.dateTo && journalDate > filter.dateTo) return false;
        return true;
      });
    }

    // Apply search filter (client-side)
    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      filteredJournals = filteredJournals.filter(
        (j) =>
          j.journalNumber.toLowerCase().includes(searchLower) ||
          j.description.toLowerCase().includes(searchLower) ||
          j.sourceReference?.toLowerCase().includes(searchLower)
      );
    }

    const newLastDoc = snapshot.docs.length > 0 
      ? snapshot.docs[snapshot.docs.length - 1] 
      : null;

    return { journals: filteredJournals, lastDoc: newLastDoc };
  }

  /**
   * Get next journal sequence number
   */
  private async getNextSequence(companyId: string, fiscalYear: number): Promise<number> {
    const q = query(
      this.collectionRef(companyId),
      where('fiscalYear', '==', fiscalYear),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return 1;
    
    const lastJournal = snapshot.docs[0].data() as JournalEntry;
    const lastNumber = lastJournal.journalNumber;
    const lastSequence = parseInt(lastNumber.split('-')[2], 10);
    
    return lastSequence + 1;
  }

  /**
   * Create new journal entry
   */
  async create(
    companyId: string,
    userId: string,
    input: JournalEntryCreateInput
  ): Promise<JournalEntry> {
    const { fiscalYear, fiscalPeriod } = getFiscalPeriod(input.date);
    const sequence = await this.getNextSequence(companyId, fiscalYear);
    const journalNumber = generateJournalNumber(fiscalYear, sequence);
    
    // Fetch account details for denormalization
    const accountMap = new Map<string, Account>();
    for (const line of input.lines) {
      const accountSnap = await getDoc(this.accountDocRef(companyId, line.accountId));
      if (!accountSnap.exists()) {
        throw new Error(`Account ${line.accountId} not found`);
      }
      const account = { id: accountSnap.id, ...accountSnap.data() } as Account;
      if (!account.isPostable) {
        throw new Error(`Account ${account.code} is not postable`);
      }
      accountMap.set(line.accountId, account);
    }

    // Calculate totals
    const totalDebits = input.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredits = input.lines.reduce((sum, line) => sum + line.credit, 0);
    
    if (Math.abs(totalDebits - totalCredits) >= 0.01) {
      throw new Error('Journal entry is not balanced');
    }

    const currency = input.currency || DEFAULT_CURRENCY;
    const exchangeRate = input.exchangeRate || 1;

    // Build journal lines with denormalized data
    const lines: JournalLine[] = input.lines.map((line, index) => {
      const account = accountMap.get(line.accountId)!;
      return {
        id: `${index + 1}`,
        lineNumber: index + 1,
        accountId: line.accountId,
        accountCode: account.code,
        accountName: account.name,
        description: line.description,
        debit: line.debit,
        credit: line.credit,
        currency,
        exchangeRate,
        functionalDebit: currency === FUNCTIONAL_CURRENCY ? line.debit : line.debit * exchangeRate,
        functionalCredit: currency === FUNCTIONAL_CURRENCY ? line.credit : line.credit * exchangeRate,
        dimensions: line.dimensions,
      };
    });

    const functionalTotalDebits = lines.reduce((sum, line) => sum + line.functionalDebit, 0);
    const functionalTotalCredits = lines.reduce((sum, line) => sum + line.functionalCredit, 0);

    const journalId = doc(this.collectionRef(companyId)).id;
    const now = Timestamp.now();

    const journal: JournalEntry = {
      id: journalId,
      companyId,
      journalNumber,
      date: Timestamp.fromDate(input.date),
      fiscalYear,
      fiscalPeriod,
      type: input.type || JOURNAL_TYPES.STANDARD,
      source: input.source || JOURNAL_SOURCES.MANUAL,
      sourceId: input.sourceId,
      sourceReference: input.sourceReference,
      description: input.description,
      lines,
      totalDebits,
      totalCredits,
      functionalTotalDebits,
      functionalTotalCredits,
      isBalanced: true,
      currency,
      exchangeRate,
      status: JOURNAL_STATUS.DRAFT,
      isReversal: false,
      isRecurring: false,
      attachments: input.attachments || [],
      createdBy: userId,
      createdAt: now,
      updatedBy: userId,
      updatedAt: now,
    };

    if (input.autoReverse && input.autoReverseDate) {
      journal.autoReverseDate = Timestamp.fromDate(input.autoReverseDate);
    }

    await setDoc(this.docRef(companyId, journalId), journal);
    return journal;
  }

  /**
   * Update journal entry (only draft status)
   */
  async update(
    companyId: string,
    journalId: string,
    userId: string,
    input: JournalEntryUpdateInput
  ): Promise<JournalEntry> {
    const journal = await this.getById(companyId, journalId);
    if (!journal) {
      throw new Error(`Journal ${journalId} not found`);
    }

    if (journal.status !== JOURNAL_STATUS.DRAFT) {
      throw new Error('Only draft journal entries can be updated');
    }

    const updateData: Partial<JournalEntry> = {
      updatedBy: userId,
      updatedAt: Timestamp.now(),
    };

    if (input.date) {
      const { fiscalYear, fiscalPeriod } = getFiscalPeriod(input.date);
      updateData.date = Timestamp.fromDate(input.date);
      updateData.fiscalYear = fiscalYear;
      updateData.fiscalPeriod = fiscalPeriod;
    }

    if (input.description) {
      updateData.description = input.description;
    }

    if (input.attachments) {
      updateData.attachments = input.attachments;
    }

    // If lines are updated, recalculate everything
    if (input.lines) {
      const accountMap = new Map<string, Account>();
      for (const line of input.lines) {
        const accountSnap = await getDoc(this.accountDocRef(companyId, line.accountId));
        if (!accountSnap.exists()) {
          throw new Error(`Account ${line.accountId} not found`);
        }
        accountMap.set(line.accountId, { id: accountSnap.id, ...accountSnap.data() } as Account);
      }

      const totalDebits = input.lines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredits = input.lines.reduce((sum, line) => sum + line.credit, 0);
      
      if (Math.abs(totalDebits - totalCredits) >= 0.01) {
        throw new Error('Journal entry is not balanced');
      }

      const lines: JournalLine[] = input.lines.map((line, index) => {
        const account = accountMap.get(line.accountId)!;
        return {
          id: `${index + 1}`,
          lineNumber: index + 1,
          accountId: line.accountId,
          accountCode: account.code,
          accountName: account.name,
          description: line.description,
          debit: line.debit,
          credit: line.credit,
          currency: journal.currency,
          exchangeRate: journal.exchangeRate,
          functionalDebit: journal.currency === FUNCTIONAL_CURRENCY ? line.debit : line.debit * journal.exchangeRate,
          functionalCredit: journal.currency === FUNCTIONAL_CURRENCY ? line.credit : line.credit * journal.exchangeRate,
          dimensions: line.dimensions,
        };
      });

      updateData.lines = lines;
      updateData.totalDebits = totalDebits;
      updateData.totalCredits = totalCredits;
      updateData.functionalTotalDebits = lines.reduce((sum, line) => sum + line.functionalDebit, 0);
      updateData.functionalTotalCredits = lines.reduce((sum, line) => sum + line.functionalCredit, 0);
    }

    await updateDoc(this.docRef(companyId, journalId), updateData);
    return { ...journal, ...updateData } as JournalEntry;
  }

  /**
   * Post journal entry (update account balances)
   */
  async post(
    companyId: string,
    journalId: string,
    userId: string
  ): Promise<JournalEntry> {
    const journal = await this.getById(companyId, journalId);
    if (!journal) {
      throw new Error(`Journal ${journalId} not found`);
    }

    if (journal.status !== JOURNAL_STATUS.DRAFT && journal.status !== JOURNAL_STATUS.APPROVED) {
      throw new Error('Only draft or approved journal entries can be posted');
    }

    // Update account balances
    await balanceService.updateBalances(companyId, journal.lines);

    // Update journal status
    const now = Timestamp.now();
    await updateDoc(this.docRef(companyId, journalId), {
      status: JOURNAL_STATUS.POSTED,
      postedAt: now,
      postedBy: userId,
      updatedBy: userId,
      updatedAt: now,
    });

    return {
      ...journal,
      status: JOURNAL_STATUS.POSTED,
      postedAt: now,
      postedBy: userId,
    };
  }

  /**
   * Reverse a posted journal entry
   */
  async reverse(
    companyId: string,
    journalId: string,
    userId: string,
    reversalDate: Date,
    description?: string
  ): Promise<JournalEntry> {
    const original = await this.getById(companyId, journalId);
    if (!original) {
      throw new Error(`Journal ${journalId} not found`);
    }

    if (original.status !== JOURNAL_STATUS.POSTED) {
      throw new Error('Only posted journal entries can be reversed');
    }

    if (original.reversedById) {
      throw new Error('Journal has already been reversed');
    }

    // Create reversal journal
    const reversalInput: JournalEntryCreateInput = {
      date: reversalDate,
      type: JOURNAL_TYPES.REVERSING,
      source: original.source,
      sourceId: original.id,
      sourceReference: `Reversal of ${original.journalNumber}`,
      description: description || `Reversal of ${original.journalNumber}: ${original.description}`,
      currency: original.currency,
      exchangeRate: original.exchangeRate,
      lines: original.lines.map((line) => ({
        accountId: line.accountId,
        description: `Reversal: ${line.description || ''}`,
        debit: line.credit, // Swap debit/credit
        credit: line.debit,
        dimensions: line.dimensions,
      })),
    };

    const reversalJournal = await this.create(companyId, userId, reversalInput);
    
    // Post the reversal
    await this.post(companyId, reversalJournal.id, userId);

    // Update original journal
    await updateDoc(this.docRef(companyId, journalId), {
      status: JOURNAL_STATUS.REVERSED,
      reversedById: reversalJournal.id,
      updatedBy: userId,
      updatedAt: Timestamp.now(),
    });

    // Update reversal journal
    await updateDoc(this.docRef(companyId, reversalJournal.id), {
      isReversal: true,
      reversalOfId: journalId,
    });

    return reversalJournal;
  }

  /**
   * Void a journal entry (mark as void without reversing)
   */
  async void(
    companyId: string,
    journalId: string,
    userId: string,
    reason: string
  ): Promise<JournalEntry> {
    const journal = await this.getById(companyId, journalId);
    if (!journal) {
      throw new Error(`Journal ${journalId} not found`);
    }

    if (journal.status === JOURNAL_STATUS.POSTED) {
      throw new Error('Posted journals must be reversed, not voided');
    }

    if (journal.status === JOURNAL_STATUS.VOID) {
      throw new Error('Journal is already void');
    }

    const now = Timestamp.now();
    await updateDoc(this.docRef(companyId, journalId), {
      status: JOURNAL_STATUS.VOID,
      updatedBy: userId,
      updatedAt: now,
      approvalHistory: [
        ...(journal.approvalHistory || []),
        {
          action: 'rejected' as const,
          userId,
          timestamp: now,
          comments: `Voided: ${reason}`,
        },
      ],
    });

    return {
      ...journal,
      status: JOURNAL_STATUS.VOID,
    };
  }

  /**
   * Get ledger entries for an account
   */
  async getAccountLedger(
    companyId: string,
    accountId: string,
    filter?: { dateFrom?: Date; dateTo?: Date; fiscalYear?: number }
  ): Promise<JournalEntry[]> {
    // Query journals containing this account
    const constraints: QueryConstraint[] = [
      where('status', '==', JOURNAL_STATUS.POSTED),
      orderBy('date', 'desc'),
    ];

    if (filter?.fiscalYear) {
      constraints.push(where('fiscalYear', '==', filter.fiscalYear));
    }

    const q = query(this.collectionRef(companyId), ...constraints);
    const snapshot = await getDocs(q);

    const journals = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as JournalEntry))
      .filter((j) => j.lines.some((l) => l.accountId === accountId));

    // Apply date filters
    return journals.filter((j) => {
      const journalDate = j.date.toDate();
      if (filter?.dateFrom && journalDate < filter.dateFrom) return false;
      if (filter?.dateTo && journalDate > filter.dateTo) return false;
      return true;
    });
  }
}

export const journalService = new JournalService();
