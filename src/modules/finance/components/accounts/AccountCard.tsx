// ============================================================================
// AccountCard COMPONENT
// DawinOS v2.0 - Financial Management Module
// Card display for account summary
// ============================================================================

import React from 'react';
import {
  Card,
  CardContent,
  CardActionArea,
  Box,
  Typography,
  Chip,
  Skeleton,
} from '@mui/material';
import {
  AccountBalance as AssetIcon,
  CreditCard as LiabilityIcon,
  Business as EquityIcon,
  TrendingUp as RevenueIcon,
  TrendingDown as ExpenseIcon,
} from '@mui/icons-material';
import { Account } from '../../types/account.types';
import {
  AccountType,
  ACCOUNT_TYPE_COLORS,
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_STATUS,
} from '../../constants/account.constants';
import { formatCurrency } from '../../constants/currency.constants';

interface AccountCardProps {
  account: Account;
  onClick?: () => void;
  showBalance?: boolean;
  compact?: boolean;
  loading?: boolean;
}

const getAccountIcon = (type: AccountType) => {
  switch (type) {
    case 'asset':
      return <AssetIcon />;
    case 'liability':
      return <LiabilityIcon />;
    case 'equity':
      return <EquityIcon />;
    case 'revenue':
      return <RevenueIcon />;
    case 'expense':
      return <ExpenseIcon />;
    default:
      return <AssetIcon />;
  }
};

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  onClick,
  showBalance = true,
  compact = false,
  loading = false,
}) => {
  const color = ACCOUNT_TYPE_COLORS[account.type];
  const isInactive = account.status !== ACCOUNT_STATUS.ACTIVE;

  if (loading) {
    return (
      <Card variant="outlined">
        <CardContent sx={{ p: compact ? 1.5 : 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Skeleton variant="circular" width={32} height={32} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="40%" />
            </Box>
          </Box>
          {showBalance && <Skeleton variant="text" width="50%" />}
        </CardContent>
      </Card>
    );
  }

  const content = (
    <CardContent sx={{ p: compact ? 1.5 : 2, '&:last-child': { pb: compact ? 1.5 : 2 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: compact ? 1 : 1.5 }}>
        <Box
          sx={{
            p: 0.75,
            borderRadius: 1,
            bgcolor: `${color}15`,
            color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {getAccountIcon(account.type)}
        </Box>
        
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
              color: 'text.secondary',
              fontSize: '0.75rem',
            }}
          >
            {account.code}
          </Typography>
          <Typography
            variant={compact ? 'body2' : 'subtitle1'}
            fontWeight="medium"
            noWrap
            sx={{
              color: isInactive ? 'text.disabled' : 'text.primary',
            }}
          >
            {account.name}
          </Typography>
        </Box>

        {isInactive && (
          <Chip
            label={account.status}
            size="small"
            color="default"
            sx={{ textTransform: 'capitalize' }}
          />
        )}
      </Box>

      {/* Type Badge */}
      {!compact && (
        <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5 }}>
          <Chip
            label={ACCOUNT_TYPE_LABELS[account.type]}
            size="small"
            sx={{
              bgcolor: `${color}15`,
              color,
              fontWeight: 'medium',
            }}
          />
          {account.isHeader && (
            <Chip
              label="Header"
              size="small"
              variant="outlined"
            />
          )}
        </Box>
      )}

      {/* Balance */}
      {showBalance && account.isPostable && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            pt: compact ? 0 : 1,
            borderTop: compact ? 'none' : 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Balance
          </Typography>
          <Typography
            variant={compact ? 'body2' : 'h6'}
            fontWeight="bold"
            sx={{
              fontFamily: 'monospace',
              color: account.balance.balance >= 0 ? 'success.main' : 'error.main',
            }}
          >
            {formatCurrency(account.balance.balance, account.currency)}
          </Typography>
        </Box>
      )}

      {/* Description */}
      {!compact && account.description && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            mt: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {account.description}
        </Typography>
      )}
    </CardContent>
  );

  if (onClick) {
    return (
      <Card
        variant="outlined"
        sx={{
          borderLeft: `4px solid ${color}`,
          opacity: isInactive ? 0.7 : 1,
        }}
      >
        <CardActionArea onClick={onClick}>
          {content}
        </CardActionArea>
      </Card>
    );
  }

  return (
    <Card
      variant="outlined"
      sx={{
        borderLeft: `4px solid ${color}`,
        opacity: isInactive ? 0.7 : 1,
      }}
    >
      {content}
    </Card>
  );
};

export default AccountCard;
