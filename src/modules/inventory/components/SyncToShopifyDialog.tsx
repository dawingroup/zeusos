/**
 * SyncToShopifyDialog Component
 *
 * Dialog for syncing an inventory product to Shopify.
 * Allows customization of product details before sync.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  InputAdornment,
} from '@mui/material';
import { ShoppingBag, Tag, DollarSign } from 'lucide-react';
import {
  syncInventoryItemToShopify,
  type ShopifyProductInput,
} from '../services/inventoryShopifyLinkService';
import type { InventoryItem } from '../types/inventory';

interface Props {
  open: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  onSynced: () => void;
}

export function SyncToShopifyDialog({ open, onClose, item, onSynced }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when item changes
  useEffect(() => {
    if (item) {
      setTitle(item.displayName || item.name);
      setDescription(item.description || '');
      setPrice(item.pricing.costPerUnit.toString());
      setTags(item.tags || []);
      setError(null);
    }
  }, [item]);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSync = async () => {
    if (!item) return;

    setError(null);
    setSyncing(true);

    try {
      const productInput: ShopifyProductInput = {
        title,
        description,
        productType: item.category,
        tags,
        variants: [
          {
            price,
            sku: item.sku,
            inventoryQuantity: item.inventory.inStock,
          },
        ],
      };

      const result = await syncInventoryItemToShopify(item.id, productInput);

      if (result.success) {
        onSynced();
        onClose();
      } else {
        setError(result.error || 'Sync failed');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const handleClose = () => {
    if (!syncing) {
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ShoppingBag className="w-5 h-5" />
        Sync to Shopify
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {item && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              This will create a new product on your Shopify store with the details below.
            </Typography>

            <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                SKU
              </Typography>
              <Typography variant="body2" fontFamily="monospace">
                {item.sku}
              </Typography>
            </Box>

            <TextField
              label="Product Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              required
              disabled={syncing}
            />

            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              disabled={syncing}
            />

            <TextField
              label="Price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              fullWidth
              required
              disabled={syncing}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <DollarSign className="w-4 h-4" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    {item.pricing.currency}
                  </InputAdornment>
                ),
              }}
            />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Tags
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                {tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    onDelete={() => handleRemoveTag(tag)}
                    disabled={syncing}
                  />
                ))}
              </Box>
              <TextField
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                size="small"
                fullWidth
                disabled={syncing}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Tag className="w-4 h-4" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <Box sx={{ bgcolor: 'info.50', p: 2, borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Stock Level
              </Typography>
              <Typography variant="body2">
                {item.inventory.inStock} {item.pricing.unit}
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={syncing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSync}
          disabled={syncing || !title || !price}
          startIcon={syncing ? <CircularProgress size={16} /> : <ShoppingBag className="w-4 h-4" />}
        >
          {syncing ? 'Syncing...' : 'Sync to Shopify'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default SyncToShopifyDialog;
