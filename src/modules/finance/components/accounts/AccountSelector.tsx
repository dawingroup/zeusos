// ============================================================================
// AccountSelector COMPONENT
// DawinOS v2.0 - Financial Management Module
// Account selection dropdown/autocomplete
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  Chip,
  CircularProgress,
} from '@mui/material';
import { Account } from '../../types/account.types';
import {
  AccountType,
  ACCOUNT_TYPE_COLORS,
  ACCOUNT_TYPE_LABELS,
} from '../../constants/account.constants';
import { formatCurrency } from '../../constants/currency.constants';

interface AccountSelectorProps {
  accounts: Account[];
  value: Account | null;
  onChange: (account: Account | null) => void;
  loading?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  label?: string;
  placeholder?: string;
  filterTypes?: AccountType[];
  postableOnly?: boolean;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  required?: boolean;
  showBalance?: boolean;
}

export const AccountSelector: React.FC<AccountSelectorProps> = ({
  accounts,
  value,
  onChange,
  loading = false,
  disabled = false,
  error = false,
  helperText,
  label = 'Account',
  placeholder = 'Select account...',
  filterTypes,
  postableOnly = true,
  size = 'medium',
  fullWidth = true,
  required = false,
  showBalance = false,
}) => {
  const [inputValue, setInputValue] = useState('');

  // Filter accounts based on props
  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      if (postableOnly && !account.isPostable) return false;
      if (filterTypes && filterTypes.length > 0 && !filterTypes.includes(account.type)) {
        return false;
      }
      if (account.status !== 'active') return false;
      return true;
    });
  }, [accounts, filterTypes, postableOnly]);

  // Group accounts by type
  const groupedAccounts = useMemo(() => {
    const grouped = new Map<AccountType, Account[]>();
    filteredAccounts.forEach((account) => {
      const group = grouped.get(account.type) || [];
      group.push(account);
      grouped.set(account.type, group);
    });
    return grouped;
  }, [filteredAccounts]);

  return (
    <Autocomplete
      value={value}
      onChange={(_, newValue) => onChange(newValue)}
      inputValue={inputValue}
      onInputChange={(_, newInputValue) => setInputValue(newInputValue)}
      options={filteredAccounts}
      getOptionLabel={(option) => `${option.code} - ${option.name}`}
      groupBy={(option) => option.type}
      loading={loading}
      disabled={disabled}
      size={size}
      fullWidth={fullWidth}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      filterOptions={(options, { inputValue }) => {
        const searchLower = inputValue.toLowerCase();
        return options.filter(
          (option) =>
            option.code.toLowerCase().includes(searchLower) ||
            option.name.toLowerCase().includes(searchLower)
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          error={error}
          helperText={helperText}
          required={required}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => {
        const color = ACCOUNT_TYPE_COLORS[option.type];
        return (
          <Box
            component="li"
            {...props}
            sx={{
              '&:hover': {
                backgroundColor: `${color}08 !important`,
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  color: 'text.secondary',
                  fontSize: '0.75rem',
                  minWidth: 60,
                }}
              >
                {option.code}
              </Typography>
              <Typography
                variant="body2"
                sx={{ flex: 1 }}
                noWrap
              >
                {option.name}
              </Typography>
              {showBalance && (
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'monospace',
                    color: option.balance.balance >= 0 ? 'success.main' : 'error.main',
                    fontSize: '0.75rem',
                  }}
                >
                  {formatCurrency(option.balance.balance, option.currency)}
                </Typography>
              )}
            </Box>
          </Box>
        );
      }}
      renderGroup={(params) => {
        const color = ACCOUNT_TYPE_COLORS[params.group as AccountType];
        return (
          <Box key={params.key}>
            <Box
              sx={{
                position: 'sticky',
                top: 0,
                bgcolor: 'background.paper',
                p: 1,
                borderBottom: 1,
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Chip
                label={ACCOUNT_TYPE_LABELS[params.group as AccountType]}
                size="small"
                sx={{
                  bgcolor: `${color}15`,
                  color,
                  fontWeight: 'bold',
                }}
              />
              <Typography variant="caption" color="text.secondary">
                ({groupedAccounts.get(params.group as AccountType)?.length || 0} accounts)
              </Typography>
            </Box>
            {params.children}
          </Box>
        );
      }}
    />
  );
};

/**
 * Multiple account selector
 */
interface MultiAccountSelectorProps {
  accounts: Account[];
  value: Account[];
  onChange: (accounts: Account[]) => void;
  loading?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  label?: string;
  placeholder?: string;
  filterTypes?: AccountType[];
  postableOnly?: boolean;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  maxSelections?: number;
}

export const MultiAccountSelector: React.FC<MultiAccountSelectorProps> = ({
  accounts,
  value,
  onChange,
  loading = false,
  disabled = false,
  error = false,
  helperText,
  label = 'Accounts',
  placeholder = 'Select accounts...',
  filterTypes,
  postableOnly = true,
  size = 'medium',
  fullWidth = true,
  maxSelections,
}) => {
  const [inputValue, setInputValue] = useState('');

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      if (postableOnly && !account.isPostable) return false;
      if (filterTypes && filterTypes.length > 0 && !filterTypes.includes(account.type)) {
        return false;
      }
      if (account.status !== 'active') return false;
      return true;
    });
  }, [accounts, filterTypes, postableOnly]);

  const isMaxReached = maxSelections !== undefined && value.length >= maxSelections;

  return (
    <Autocomplete
      multiple
      value={value}
      onChange={(_, newValue) => {
        if (maxSelections && newValue.length > maxSelections) return;
        onChange(newValue);
      }}
      inputValue={inputValue}
      onInputChange={(_, newInputValue) => setInputValue(newInputValue)}
      options={filteredAccounts}
      getOptionLabel={(option) => `${option.code} - ${option.name}`}
      loading={loading}
      disabled={disabled || isMaxReached}
      size={size}
      fullWidth={fullWidth}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      getOptionDisabled={() => isMaxReached}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={value.length === 0 ? placeholder : undefined}
          error={error}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => {
          const color = ACCOUNT_TYPE_COLORS[option.type];
          return (
            <Chip
              {...getTagProps({ index })}
              key={option.id}
              label={`${option.code} - ${option.name}`}
              size="small"
              sx={{
                bgcolor: `${color}15`,
                borderColor: color,
                '& .MuiChip-deleteIcon': {
                  color: `${color}80`,
                },
              }}
            />
          );
        })
      }
    />
  );
};

export default AccountSelector;
