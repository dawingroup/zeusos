/**
 * InventoryPage Component
 * Main page for unified inventory management with tabbed navigation
 * Products (finished goods for retail/projects) and Materials (raw materials for manufacturing)
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { InventoryList } from '../components/InventoryList';
import { InventoryItemModal } from '../components/InventoryItemModal';
import { InventoryItemDetail } from '../components/InventoryItemDetail';
import { ProductsTab } from '../components/ProductsTab';
import { MaterialsTab } from '../components/MaterialsTab';
import { SyncToShopifyDialog } from '../components/SyncToShopifyDialog';
import { AddToProjectDialog } from '../components/AddToProjectDialog';
import { InventoryStorefrontDrawer } from '../components/InventoryStorefrontDrawer';
import StockLevelsByLocation from '../components/StockLevelsByLocation';
import WarehouseManager from '../components/WarehouseManager';
import { InventoryHealthDashboard } from '../components/InventoryHealthDashboard';
import { BulkActionsToolbar, type BulkAction } from '../components/BulkActionsToolbar';
import { BulkReclassifyDialog } from '../components/BulkReclassifyDialog';
import { BulkStatusChangeDialog } from '../components/BulkStatusChangeDialog';
import { BulkDeleteDialog } from '../components/BulkDeleteDialog';
import { BulkAIEnhanceDialog } from '../components/BulkAIEnhanceDialog';
import { ReclassifyAsVariantDialog } from '../components/ReclassifyAsVariantDialog';
import { ConvertToFamilyDialog } from '../components/ConvertToFamilyDialog';
import { MergeItemsDialog } from '../components/MergeItemsDialog';
import { FamilyForm } from '../components/FamilyForm';
import { MaterialLinkModal } from '../components/MaterialLinkModal';
import {
  Dialog,
  DialogContent,
} from '@/core/components/ui/dialog';
import { useBulkSelection } from '../hooks/useBulkSelection';
import { useInventory } from '../hooks/useInventory';
import { linkMaterialToInventory } from '../services/materialInventoryLinkService';
import type { InventoryListItem, InventoryItem } from '../types';
import { db } from '@/shared/services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Package, ShoppingBag, Layers, Plus, BarChart3, Warehouse, Sparkles } from 'lucide-react';
import { ColoredStatsCard, QuickActionsGrid } from '@/shared/components/data-display';

type InventoryTab = 'products' | 'materials' | 'all-items' | 'stock-levels' | 'warehouses' | 'ai-health';

const TABS: { id: InventoryTab; label: string; icon?: typeof Package }[] = [
  { id: 'all-items', label: 'All Items' },
  { id: 'products', label: 'Products' },
  { id: 'materials', label: 'Materials' },
  { id: 'stock-levels', label: 'Stock Levels' },
  { id: 'warehouses', label: 'Warehouses' },
  { id: 'ai-health', label: 'AI Health', icon: Sparkles },
];

export function InventoryPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<InventoryTab>('all-items');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | undefined>();
  const [detailItem, setDetailItem] = useState<InventoryListItem | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Dialog state for Products tab
  const [shopifyDialogItem, setShopifyDialogItem] = useState<InventoryItem | null>(null);
  const [projectDialogItem, setProjectDialogItem] = useState<InventoryItem | null>(null);
  const [storefrontDrawerItem, setStorefrontDrawerItem] = useState<InventoryItem | null>(null);

  // Material link modal state
  const [materialLinkItem, setMaterialLinkItem] = useState<InventoryListItem | null>(null);

  // Family form dialog
  const [familyFormOpen, setFamilyFormOpen] = useState(false);
  const [familyFormClassification, setFamilyFormClassification] = useState<'material' | 'product'>('product');

  // Bulk selection & operations
  const bulkSelection = useBulkSelection();
  const [bulkDialog, setBulkDialog] = useState<BulkAction | null>(null);
  const { items: allItems } = useInventory();

  const handleViewItem = useCallback((item: InventoryListItem) => {
    setDetailItem(item);
  }, []);

  // Fetch full item data and open Shopify dialog
  const handleSyncToShopify = useCallback(async (listItem: InventoryListItem) => {
    const itemDoc = await getDoc(doc(db, 'inventoryItems', listItem.id));
    if (itemDoc.exists()) {
      setShopifyDialogItem({ id: itemDoc.id, ...itemDoc.data() } as InventoryItem);
    }
  }, []);

  // Fetch full item data and open Project dialog
  const handleAddToProject = useCallback(async (listItem: InventoryListItem) => {
    const itemDoc = await getDoc(doc(db, 'inventoryItems', listItem.id));
    if (itemDoc.exists()) {
      setProjectDialogItem({ id: itemDoc.id, ...itemDoc.data() } as InventoryItem);
    }
  }, []);

  // Fetch full item data and open Storefront drawer
  const handleOpenStorefront = useCallback(async (listItem: InventoryListItem) => {
    const itemDoc = await getDoc(doc(db, 'inventoryItems', listItem.id));
    if (itemDoc.exists()) {
      setStorefrontDrawerItem({ id: itemDoc.id, ...itemDoc.data() } as InventoryItem);
    }
  }, []);

  // Bulk operation handlers
  const handleBulkAction = useCallback((action: BulkAction) => {
    setBulkDialog(action);
  }, []);

  const handleBulkComplete = useCallback(() => {
    setBulkDialog(null);
    bulkSelection.clearSelection();
    setRefreshKey(k => k + 1);
  }, [bulkSelection]);

  const handleTabChange = useCallback((tab: InventoryTab) => {
    setActiveTab(tab);
    bulkSelection.clearSelection();
  }, [bulkSelection]);

  // Early return AFTER all hooks
  if (!user?.email) {
    return (
      <div className="p-6 text-center text-gray-500">
        Please log in to manage inventory.
      </div>
    );
  }

  const handleAddItem = () => {
    setEditItemId(undefined);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditItemId(undefined);
  };

  const handleModalSaved = () => {
    setRefreshKey(k => k + 1);
  };

  const handleDetailClose = () => {
    setDetailItem(null);
  };

  const handleDetailEdit = () => {
    if (detailItem) {
      setEditItemId(detailItem.id);
      setDetailItem(null);
      setModalOpen(true);
    }
  };

  // Inventory counts
  const [inventoryCounts, setInventoryCounts] = useState({ total: 0, products: 0, materials: 0 });
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const allRef = collection(db, 'inventoryItems');
        const prodQ = query(allRef, where('classification', '==', 'product'));
        const matQ = query(allRef, where('classification', '==', 'material'));
        const [allSnap, prodSnap, matSnap] = await Promise.all([
          getCountFromServer(allRef),
          getCountFromServer(prodQ),
          getCountFromServer(matQ),
        ]);
        setInventoryCounts({
          total: allSnap.data().count,
          products: prodSnap.data().count,
          materials: matSnap.data().count,
        });
      } catch (err) {
        console.error('Failed to fetch inventory counts:', err);
      }
    };
    fetchCounts();
  }, [refreshKey]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <p className="text-gray-500 mt-1">
          Unified material library - single source of truth for all pricing and stock levels.
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <ColoredStatsCard
          label="Total Items"
          value={inventoryCounts.total}
          icon={Package}
          color="blue"
          subtitle="All inventory"
        />
        <ColoredStatsCard
          label="Products"
          value={inventoryCounts.products}
          icon={ShoppingBag}
          color="green"
          subtitle="Finished goods"
          onClick={() => setActiveTab('products')}
        />
        <ColoredStatsCard
          label="Materials"
          value={inventoryCounts.materials}
          icon={Layers}
          color="amber"
          subtitle="Raw materials"
          onClick={() => setActiveTab('materials')}
        />
        <ColoredStatsCard
          label="Locations"
          value="-"
          icon={Warehouse}
          color="purple"
          subtitle="Stock locations"
          onClick={() => setActiveTab('stock-levels')}
        />
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <QuickActionsGrid
          columns={4}
          actions={[
            { label: 'Add Item', description: 'Create new inventory item', icon: Plus, onClick: handleAddItem },
            { label: 'New Family', description: 'Create product or material family', icon: Layers, onClick: () => { setFamilyFormClassification('product'); setFamilyFormOpen(true); } },
            { label: 'Stock Levels', description: 'View by location', icon: BarChart3, onClick: () => setActiveTab('stock-levels') },
            { label: 'Warehouses', description: 'Manage storage locations', icon: Warehouse, onClick: () => setActiveTab('warehouses') },
          ]}
        />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {TabIcon && <TabIcon className="w-3.5 h-3.5" />}
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'products' && (
        <>
          <ProductsTab
            key={refreshKey}
            onItemClick={handleViewItem}
            onAddItem={handleAddItem}
            onSyncToShopify={handleSyncToShopify}
            onAddToProject={handleAddToProject}
            onOpenStorefront={handleOpenStorefront}
            selectionEnabled={true}
            selectedIds={bulkSelection.selectedIds}
            onToggleItem={bulkSelection.toggleItem}
            onToggleAll={bulkSelection.toggleAll}
          />

          <InventoryItemModal
            isOpen={modalOpen}
            onClose={handleModalClose}
            onSaved={handleModalSaved}
            itemId={editItemId}
            userId={user.uid}
          />

          {detailItem && (
            <InventoryItemDetail
              itemId={detailItem.id}
              onClose={handleDetailClose}
              onEdit={handleDetailEdit}
            />
          )}
        </>
      )}

      {activeTab === 'materials' && (
        <>
          <MaterialsTab
            key={refreshKey}
            onItemClick={handleViewItem}
            onAddItem={handleAddItem}
            onLinkToMaterial={(item) => {
              setMaterialLinkItem(item);
            }}
            onManageSupplierPricing={(item) => {
              setDetailItem(item);
            }}
            onOpenStorefront={handleOpenStorefront}
            selectionEnabled={true}
            selectedIds={bulkSelection.selectedIds}
            onToggleItem={bulkSelection.toggleItem}
            onToggleAll={bulkSelection.toggleAll}
          />

          <InventoryItemModal
            isOpen={modalOpen}
            onClose={handleModalClose}
            onSaved={handleModalSaved}
            itemId={editItemId}
            userId={user.uid}
          />

          {detailItem && (
            <InventoryItemDetail
              itemId={detailItem.id}
              onClose={handleDetailClose}
              onEdit={handleDetailEdit}
            />
          )}

          <MaterialLinkModal
            isOpen={!!materialLinkItem}
            onClose={() => setMaterialLinkItem(null)}
            inventoryItemName={materialLinkItem?.name || ''}
            inventoryItemSku={materialLinkItem?.sku || ''}
            excludeIds={[]}
            onLink={async (material) => {
              if (!materialLinkItem) return;
              await linkMaterialToInventory(
                material.id,
                material.tier || 'global',
                undefined,
                materialLinkItem.id,
                materialLinkItem.sku || '',
                user?.uid || 'unknown'
              );
              setMaterialLinkItem(null);
              setRefreshKey(k => k + 1);
            }}
          />
        </>
      )}

      {activeTab === 'all-items' && (
        <>
          <InventoryList
            key={refreshKey}
            onAddItem={handleAddItem}
            onItemClick={handleViewItem}
            showActions={true}
            selectionEnabled={true}
            selectedIds={bulkSelection.selectedIds}
            onToggleItem={bulkSelection.toggleItem}
            onToggleAll={bulkSelection.toggleAll}
          />

          <InventoryItemModal
            isOpen={modalOpen}
            onClose={handleModalClose}
            onSaved={handleModalSaved}
            itemId={editItemId}
            userId={user.uid}
          />

          {detailItem && (
            <InventoryItemDetail
              itemId={detailItem.id}
              onClose={handleDetailClose}
              onEdit={handleDetailEdit}
            />
          )}
        </>
      )}

      {activeTab === 'stock-levels' && (
        <StockLevelsByLocation />
      )}

      {activeTab === 'warehouses' && (
        <WarehouseManager />
      )}

      {activeTab === 'ai-health' && (
        <InventoryHealthDashboard
          userId={user.uid}
          onViewItem={(itemId) => {
            setDetailItem({ id: itemId, sku: '', name: '', category: 'other', tier: 'catalogue', source: 'manual', status: 'active' });
          }}
        />
      )}

      {/* Dialogs for Products tab */}
      <SyncToShopifyDialog
        open={!!shopifyDialogItem}
        onClose={() => setShopifyDialogItem(null)}
        item={shopifyDialogItem}
        onSynced={() => setRefreshKey((k) => k + 1)}
      />

      {/* Storefront publishing drawer — dawinfinishes.com */}
      {storefrontDrawerItem && (
        <InventoryStorefrontDrawer
          item={storefrontDrawerItem}
          onClose={() => setStorefrontDrawerItem(null)}
        />
      )}

      <AddToProjectDialog
        open={!!projectDialogItem}
        onClose={() => setProjectDialogItem(null)}
        item={projectDialogItem}
        onLinked={() => setRefreshKey((k) => k + 1)}
      />

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={bulkSelection.selectedCount}
        onAction={handleBulkAction}
        onClearSelection={bulkSelection.clearSelection}
      />

      {/* Bulk Dialogs */}
      <BulkReclassifyDialog
        open={bulkDialog === 'reclassify'}
        selectedIds={bulkSelection.selectedIds}
        selectedItems={bulkSelection.getSelectedItems(allItems)}
        onClose={() => setBulkDialog(null)}
        onComplete={handleBulkComplete}
        userId={user.uid}
      />

      <BulkStatusChangeDialog
        open={bulkDialog === 'status-change'}
        selectedIds={bulkSelection.selectedIds}
        onClose={() => setBulkDialog(null)}
        onComplete={handleBulkComplete}
        userId={user.uid}
      />

      <BulkDeleteDialog
        open={bulkDialog === 'delete'}
        selectedIds={bulkSelection.selectedIds}
        selectedItems={bulkSelection.getSelectedItems(allItems)}
        onClose={() => setBulkDialog(null)}
        onComplete={handleBulkComplete}
      />

      <BulkAIEnhanceDialog
        open={bulkDialog === 'ai-enhance'}
        selectedItems={bulkSelection.getSelectedItems(allItems)}
        onClose={() => setBulkDialog(null)}
        onComplete={handleBulkComplete}
        userId={user.uid}
      />

      <ReclassifyAsVariantDialog
        open={bulkDialog === 'make-variant'}
        selectedIds={bulkSelection.selectedIds}
        selectedItems={bulkSelection.getSelectedItems(allItems)}
        onClose={() => setBulkDialog(null)}
        onComplete={handleBulkComplete}
        userId={user.uid}
      />

      <ConvertToFamilyDialog
        open={bulkDialog === 'convert-to-family'}
        item={
          bulkDialog === 'convert-to-family' && bulkSelection.selectedIds.size === 1
            ? bulkSelection.getSelectedItems(allItems)[0] ?? null
            : null
        }
        onClose={() => setBulkDialog(null)}
        onComplete={handleBulkComplete}
        userId={user.uid}
      />

      <MergeItemsDialog
        open={bulkDialog === 'merge'}
        selectedIds={bulkSelection.selectedIds}
        selectedItems={bulkSelection.getSelectedItems(allItems)}
        onClose={() => setBulkDialog(null)}
        onComplete={handleBulkComplete}
        userId={user.uid}
      />

      {/* Family Form Dialog */}
      <Dialog open={familyFormOpen} onOpenChange={(o) => !o && setFamilyFormOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <FamilyForm
            onClose={() => setFamilyFormOpen(false)}
            onCreated={() => {
              setFamilyFormOpen(false);
              setRefreshKey((k) => k + 1);
            }}
            userId={user.uid}
            initialClassification={familyFormClassification}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default InventoryPage;
