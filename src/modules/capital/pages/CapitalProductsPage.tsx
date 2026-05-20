import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Sparkles, ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { useCapitalProducts } from '../hooks/useCapitalProducts';
import { StatusChip } from '../components/shared/StatusChip';
import { formatCurrency } from '../components/shared/CurrencyDisplay';
import { ProviderSearchPanel } from '../components/research/ProviderSearchPanel';
import { AddProductDialog } from '../components/products/AddProductDialog';
import { ProductDetailDrawer } from '../components/products/ProductDetailDrawer';
import {
  PRODUCT_TYPE_LABELS,
  PRODUCT_TYPE_COLORS,
  PROVIDER_TYPE_LABELS,
  INTEREST_TYPE_LABELS,
} from '../constants/capital.constants';
import type { CapitalProduct, CapitalProductFilters } from '../types/capital.types';

const COMPANY_ID = 'default';

export default function CapitalProductsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showResearch, setShowResearch] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CapitalProduct | null>(null);
  const filters: CapitalProductFilters = searchTerm ? { searchTerm } : {};
  const { products, loading, refresh, createProduct, updateProduct, deleteProduct } = useCapitalProducts(COMPANY_ID, filters);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Capital Products</h1>
          <p className="text-muted-foreground">
            Catalog of available financing products from banks, DFIs, and other providers
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showResearch ? 'default' : 'outline'}
            onClick={() => setShowResearch(!showResearch)}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Research Providers
            {showResearch ? (
              <ChevronUp className="h-4 w-4 ml-1" />
            ) : (
              <ChevronDown className="h-4 w-4 ml-1" />
            )}
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* AI Research Panel */}
      {showResearch && (
        <ProviderSearchPanel
          companyId={COMPANY_ID}
          onProductsSaved={refresh}
        />
      )}

      <div className="flex gap-4">
        <Input
          placeholder="Search products or providers..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
        </div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No capital products in your catalog yet
            </p>
            <Button variant="outline" onClick={() => setShowAddDialog(true)}>
              Add Your First Product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(product => (
            <Card key={product.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedProduct(product)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{product.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{product.provider}</p>
                  </div>
                  <StatusChip
                    label={PRODUCT_TYPE_LABELS[product.productType]}
                    color={PRODUCT_TYPE_COLORS[product.productType]}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  {PROVIDER_TYPE_LABELS[product.providerType]}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  {(product.minAmount || product.maxAmount) && (
                    <div>
                      <span className="text-xs text-muted-foreground block">Amount Range</span>
                      <span className="font-medium">
                        {product.minAmount ? formatCurrency(product.minAmount, product.currency, true) : '—'}
                        {' – '}
                        {product.maxAmount ? formatCurrency(product.maxAmount, product.currency, true) : '—'}
                      </span>
                    </div>
                  )}
                  {product.interestRate !== undefined && (
                    <div>
                      <span className="text-xs text-muted-foreground block">Interest Rate</span>
                      <span className="font-medium">
                        {product.interestRate}% p.a.
                        {product.interestType && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({INTEREST_TYPE_LABELS[product.interestType]})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {(product.tenorMinMonths || product.tenorMaxMonths) && (
                    <div>
                      <span className="text-xs text-muted-foreground block">Tenor</span>
                      <span className="font-medium">
                        {product.tenorMinMonths ?? '—'} – {product.tenorMaxMonths ?? '—'} months
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-muted-foreground block">Collateral</span>
                    <span className="font-medium">
                      {product.collateralRequired ? 'Required' : 'Not required'}
                    </span>
                  </div>
                </div>

                {product.requirements.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">
                      Requirements ({product.requirements.filter(r => r.mandatory).length} mandatory)
                    </span>
                  </div>
                )}

                {product.contactPerson && (
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    Contact: {product.contactPerson}
                    {product.contactEmail && ` · ${product.contactEmail}`}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Product Dialog */}
      <AddProductDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSave={createProduct}
      />

      {/* Product Detail Drawer */}
      <ProductDetailDrawer
        product={selectedProduct}
        open={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onUpdate={async (productId, updates) => {
          await updateProduct(productId, updates);
          setSelectedProduct(null);
        }}
        onDelete={async (productId) => {
          await deleteProduct(productId);
          setSelectedProduct(null);
        }}
      />
    </div>
  );
}
