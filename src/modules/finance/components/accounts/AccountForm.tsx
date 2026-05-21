// ============================================================================
// AccountForm COMPONENT
// ZeusOS v2.0 - Financial Management Module
// Form for creating/editing accounts
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  Button,
  Grid as MuiGrid,
  Typography,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Chip,
  Autocomplete,
  SelectChangeEvent,
} from '@mui/material';
const Grid = MuiGrid as any;
import { Account, AccountCreateInput, AccountUpdateInput } from '../../types/account.types';
import {
  AccountType,
  AccountSubType,
  ACCOUNT_TYPES,
  ACCOUNT_SUB_TYPES,
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_SUB_TYPE_LABELS,
  ACCOUNT_TYPE_SUB_TYPES,
  ACCOUNT_TYPE_COLORS,
  ACCOUNT_CODE_FORMAT,
} from '../../constants/account.constants';
import { CurrencyCode, CURRENCIES, CURRENCY_CONFIG } from '../../constants/currency.constants';

interface AccountFormProps {
  mode: 'create' | 'edit';
  account?: Account;
  accounts?: Account[];
  onSubmit: (data: AccountCreateInput | AccountUpdateInput) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
}

export const AccountForm: React.FC<AccountFormProps> = ({
  mode,
  account,
  accounts = [],
  onSubmit,
  onCancel,
  loading = false,
  error = null,
}) => {
  // Form state
  const [code, setCode] = useState(account?.code || '');
  const [name, setName] = useState(account?.name || '');
  const [description, setDescription] = useState(account?.description || '');
  const [type, setType] = useState<AccountType>(account?.type || ACCOUNT_TYPES.ASSET);
  const [subType, setSubType] = useState<AccountSubType>(account?.subType || ACCOUNT_SUB_TYPES.CURRENT_ASSET);
  const [parentId, setParentId] = useState<string | null>(account?.parentId || null);
  const [currency, setCurrency] = useState<CurrencyCode>(account?.currency || CURRENCIES.UGX);
  const [isHeader, setIsHeader] = useState(account?.isHeader || false);
  const [tags, setTags] = useState<string[]>(account?.tags || []);
  const [tagInput, setTagInput] = useState('');

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Available sub-types based on type
  const availableSubTypes = ACCOUNT_TYPE_SUB_TYPES[type];

  // Available parent accounts (same type, headers only)
  const availableParents = accounts.filter(
    (a) => a.type === type && a.isHeader && a.id !== account?.id
  );

  // Reset sub-type when type changes
  useEffect(() => {
    if (!availableSubTypes.includes(subType)) {
      setSubType(availableSubTypes[0]);
    }
  }, [type, availableSubTypes, subType]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!code) {
      newErrors.code = 'Account code is required';
    } else if (code.length !== ACCOUNT_CODE_FORMAT.TOTAL_DIGITS) {
      newErrors.code = `Account code must be ${ACCOUNT_CODE_FORMAT.TOTAL_DIGITS} digits`;
    } else if (!/^\d+$/.test(code)) {
      newErrors.code = 'Account code must contain only digits';
    }

    if (!name || name.length < 2) {
      newErrors.name = 'Account name must be at least 2 characters';
    } else if (name.length > 100) {
      newErrors.name = 'Account name must be at most 100 characters';
    }

    if (description && description.length > 500) {
      newErrors.description = 'Description must be at most 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (mode === 'create') {
      const data: AccountCreateInput = {
        code,
        name,
        description: description || undefined,
        type,
        subType,
        parentId: parentId || undefined,
        currency,
        isHeader,
        isPostable: !isHeader,
        tags,
      };
      await onSubmit(data);
    } else {
      const data: AccountUpdateInput = {
        name,
        description: description || undefined,
        parentId,
        tags,
      };
      await onSubmit(data);
    }
  };

  const handleTypeChange = (e: SelectChangeEvent<string>) => {
    setType(e.target.value as AccountType);
    setParentId(null); // Reset parent when type changes
  };

  const handleAddTag = () => {
    if (tagInput && !tags.includes(tagInput)) {
      setTags([...tags, tagInput]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Account Code */}
        <Grid item xs={12} sm={4}>
          <TextField
            label="Account Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={mode === 'edit' || loading}
            error={!!errors.code}
            helperText={errors.code || `${ACCOUNT_CODE_FORMAT.TOTAL_DIGITS} digits`}
            fullWidth
            required
            inputProps={{ maxLength: ACCOUNT_CODE_FORMAT.TOTAL_DIGITS }}
          />
        </Grid>

        {/* Account Name */}
        <Grid item xs={12} sm={8}>
          <TextField
            label="Account Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            error={!!errors.name}
            helperText={errors.name}
            fullWidth
            required
          />
        </Grid>

        {/* Account Type */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth disabled={mode === 'edit' || loading}>
            <InputLabel>Account Type</InputLabel>
            <Select
              value={type}
              onChange={handleTypeChange}
              label="Account Type"
            >
              {Object.entries(ACCOUNT_TYPES).map(([key, value]) => (
                <MenuItem key={key} value={value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: ACCOUNT_TYPE_COLORS[value],
                      }}
                    />
                    {ACCOUNT_TYPE_LABELS[value]}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Account Sub-Type */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth disabled={mode === 'edit' || loading}>
            <InputLabel>Sub-Type</InputLabel>
            <Select
              value={subType}
              onChange={(e) => setSubType(e.target.value as AccountSubType)}
              label="Sub-Type"
            >
              {availableSubTypes.map((st) => (
                <MenuItem key={st} value={st}>
                  {ACCOUNT_SUB_TYPE_LABELS[st]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Parent Account */}
        <Grid item xs={12} sm={6}>
          <Autocomplete
            value={availableParents.find((a) => a.id === parentId) || null}
            onChange={(_, newValue) => setParentId(newValue?.id || null)}
            options={availableParents}
            getOptionLabel={(option) => `${option.code} - ${option.name}`}
            disabled={loading}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Parent Account"
                helperText="Optional - for hierarchy organization"
              />
            )}
          />
        </Grid>

        {/* Currency */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth disabled={mode === 'edit' || loading}>
            <InputLabel>Currency</InputLabel>
            <Select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              label="Currency"
            >
              {Object.entries(CURRENCIES).map(([key, value]) => (
                <MenuItem key={key} value={value}>
                  {CURRENCY_CONFIG[value].symbol} - {CURRENCY_CONFIG[value].name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>Currency for this account</FormHelperText>
          </FormControl>
        </Grid>

        {/* Description */}
        <Grid item xs={12}>
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
            error={!!errors.description}
            helperText={errors.description}
            fullWidth
            multiline
            rows={2}
          />
        </Grid>

        {/* Is Header */}
        {mode === 'create' && (
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={isHeader}
                  onChange={(e) => setIsHeader(e.target.checked)}
                  disabled={loading}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">Header Account</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Header accounts group other accounts and cannot receive transactions
                  </Typography>
                </Box>
              }
            />
          </Grid>
        )}

        {/* Tags */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            Tags
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            {tags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                onDelete={() => handleRemoveTag(tag)}
                disabled={loading}
              />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add tag..."
              size="small"
              disabled={loading}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={handleAddTag}
              disabled={!tagInput || loading}
            >
              Add
            </Button>
          </Box>
        </Grid>
      </Grid>

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 4 }}>
        <Button
          variant="outlined"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {mode === 'create' ? 'Create Account' : 'Save Changes'}
        </Button>
      </Box>
    </Box>
  );
};

export default AccountForm;
