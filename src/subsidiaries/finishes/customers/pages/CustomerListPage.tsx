/**
 * CustomerListPage
 * Page wrapper for CustomerList component
 */

import { useState } from 'react';
import { CustomerList, CustomerForm } from '../components';

export default function CustomerListPage() {
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  return (
    <div className="px-6 py-6">
      <CustomerList onNewCustomer={() => setShowNewCustomer(true)} />
      
      {showNewCustomer && (
        <CustomerForm onClose={() => setShowNewCustomer(false)} />
      )}
    </div>
  );
}
