/**
 * Client Hooks for Delivery Module
 * Simple hooks for fetching and managing clients
 */

import { useEffect, useState } from 'react';
import { collection, getDocs, Firestore } from 'firebase/firestore';

export interface Client {
  id: string;
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  type: 'individual' | 'organization' | 'government' | 'ngo';
  status: 'active' | 'inactive';
  createdAt: Date;
}

/**
 * Hook to fetch all clients
 */
export function useClients(db: Firestore) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const clientsRef = collection(db, 'customers');
      const snapshot = await getDocs(clientsRef);

      const clientsList: Client[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Unnamed Client',
          code: data.code,
          email: data.email,
          phone: data.phone,
          type: data.type || 'organization',
          status: data.status || 'active',
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      });

      // Filter only active clients for project assignment
      const activeClients = clientsList.filter(c => c.status === 'active');

      setClients(activeClients);
      setError(null);
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [db]);

  const refetch = () => {
    fetchClients();
  };

  return { clients, loading, error, refetch };
}
