/**
 * EXCHANGE RATE SERVICE
 *
 * CRUD operations for program-level exchange rate reference table.
 * Rates are stored per program and can be selected when entering transactions.
 */

import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  Firestore,
  CollectionReference,
  QueryConstraint,
} from 'firebase/firestore';
import type {
  ExchangeRateEntry,
  ExchangeRateSource,
} from '../types/exchange-rate';

// ─────────────────────────────────────────────────────────────────
// COLLECTION PATHS
// ─────────────────────────────────────────────────────────────────

const BASE_PATH = 'organizations/default/advisory_programs';

// ─────────────────────────────────────────────────────────────────
// EXCHANGE RATE SERVICE
// ─────────────────────────────────────────────────────────────────

export class ExchangeRateService {
  private static instance: ExchangeRateService;
  private db: Firestore;

  private constructor(db: Firestore) {
    this.db = db;
  }

  static getInstance(db: Firestore): ExchangeRateService {
    if (!ExchangeRateService.instance) {
      ExchangeRateService.instance = new ExchangeRateService(db);
    }
    return ExchangeRateService.instance;
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private getCollectionRef(programId: string): CollectionReference {
    return collection(
      this.db,
      `${BASE_PATH}/${programId}/exchange_rates`
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // WRITE OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Add a new exchange rate entry to the program's reference table.
   */
  async addRate(
    programId: string,
    data: {
      fromCurrency: string;
      toCurrency: string;
      rate: number;
      effectiveDate: Date;
      expiresDate?: Date;
      source: ExchangeRateSource;
      notes?: string;
    },
    userId: string
  ): Promise<string> {
    const colRef = this.getCollectionRef(programId);

    const docData: Omit<ExchangeRateEntry, 'id'> = {
      programId,
      fromCurrency: data.fromCurrency,
      toCurrency: data.toCurrency,
      rate: data.rate,
      effectiveDate: data.effectiveDate,
      source: data.source,
      ...(data.expiresDate ? { expiresDate: data.expiresDate } : {}),
      ...(data.notes ? { notes: data.notes } : {}),
      createdBy: userId,
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(colRef, docData);
    return docRef.id;
  }

  // ─────────────────────────────────────────────────────────────────
  // READ OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get exchange rates for a program, with optional filters.
   */
  async getRates(
    programId: string,
    options: {
      fromCurrency?: string;
      year?: number;
    } = {}
  ): Promise<ExchangeRateEntry[]> {
    const colRef = this.getCollectionRef(programId);
    const constraints: QueryConstraint[] = [];

    if (options.fromCurrency) {
      constraints.push(where('fromCurrency', '==', options.fromCurrency));
    }

    constraints.push(orderBy('effectiveDate', 'desc'));

    const q = query(colRef, ...constraints);
    const snapshot = await getDocs(q);

    let rates = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })) as ExchangeRateEntry[];

    // Client-side filter by year (effectiveDate is stored as a Date)
    if (options.year) {
      rates = rates.filter(r => {
        const date = r.effectiveDate instanceof Date
          ? r.effectiveDate
          : (r.effectiveDate as unknown as Timestamp).toDate();
        return date.getFullYear() === options.year;
      });
    }

    return rates;
  }

  /**
   * Get the most recent rate for a specific currency pair.
   */
  async getLatestRate(
    programId: string,
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRateEntry | null> {
    const colRef = this.getCollectionRef(programId);

    const q = query(
      colRef,
      where('fromCurrency', '==', fromCurrency),
      where('toCurrency', '==', toCurrency),
      orderBy('effectiveDate', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const d = snapshot.docs[0];
    return { id: d.id, ...d.data() } as ExchangeRateEntry;
  }

  // ─────────────────────────────────────────────────────────────────
  // DELETE OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Delete an exchange rate entry.
   */
  async deleteRate(programId: string, rateId: string): Promise<void> {
    const docRef = doc(
      this.db,
      `${BASE_PATH}/${programId}/exchange_rates`,
      rateId
    );
    await deleteDoc(docRef);
  }
}

// Export singleton factory
export function getExchangeRateService(db: Firestore): ExchangeRateService {
  return ExchangeRateService.getInstance(db);
}
