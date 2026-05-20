/**
 * Employee Card Component - DawinOS v2.0
 * Mobile-optimized card view for employee in list
 */

import React from 'react';
import {
  Card,
  CardContent,
  CardActionArea,
  Box,
  Avatar,
  Typography,
  Chip,
  IconButton,
  Checkbox,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Groups as GroupsIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

import {
  EmploymentStatus,
} from '../../types/employee.types';
import {
  EMPLOYMENT_STATUS_LABELS,
} from '../../config/employee.constants';

const STATUS_COLORS: Record<EmploymentStatus, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  active: 'success',
  probation: 'info',
  suspended: 'error',
  notice_period: 'warning',
  on_leave: 'info',
  terminated: 'error',
  resigned: 'default',
  retired: 'default',
};

export interface EmployeeCardData {
  id: string;
  employeeNumber: string;
  fullName: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  title: string;
  departmentId: string;
  employmentStatus: EmploymentStatus;
  joiningDate: Timestamp;
  directReports: number;
}

interface EmployeeCardProps {
  employee: EmployeeCardData;
  selected?: boolean;
  onSelect?: () => void;
  onClick?: () => void;
  onMenuClick?: (event: React.MouseEvent<HTMLElement>) => void;
}

export const EmployeeCard: React.FC<EmployeeCardProps> = ({
  employee,
  selected = false,
  onSelect,
  onClick,
  onMenuClick,
}) => {
  return (
    <Card variant="outlined" sx={{ position: 'relative' }}>
      {/* Selection checkbox */}
      {onSelect && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 1,
          }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <Checkbox
            checked={selected}
            onChange={onSelect}
            size="small"
          />
        </Box>
      )}

      {/* Menu button */}
      {onMenuClick && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1,
          }}
        >
          <IconButton
            size="small"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              onMenuClick(e as React.MouseEvent<HTMLElement>);
            }}
          >
            <MoreVertIcon />
          </IconButton>
        </Box>
      )}

      <CardActionArea onClick={onClick}>
        <CardContent sx={{ pt: onSelect ? 2 : 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            {/* Avatar */}
            <Avatar
              src={employee.photoUrl || undefined}
              alt={employee.fullName}
              sx={{ width: 56, height: 56 }}
            >
              {employee.fullName.charAt(0)}
            </Avatar>

            {/* Info */}
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              {/* Name and status */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, pr: 4 }}>
                <Typography variant="subtitle1" fontWeight={500} noWrap>
                  {employee.fullName}
                </Typography>
                <Chip
                  label={EMPLOYMENT_STATUS_LABELS[employee.employmentStatus]}
                  color={STATUS_COLORS[employee.employmentStatus]}
                  size="small"
                />
              </Box>

              {/* Employee number */}
              <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                {employee.employeeNumber}
              </Typography>

              {/* Position */}
              <Typography variant="body2" color="text.secondary" noWrap>
                {employee.title}
              </Typography>

              {/* Contact info */}
              <Box sx={{ display: 'flex', gap: 2, mt: 1, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <EmailIcon fontSize="inherit" color="action" />
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {employee.email}
                  </Typography>
                </Box>
                {employee.phone && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PhoneIcon fontSize="inherit" color="action" />
                    <Typography variant="caption" color="text.secondary">
                      {employee.phone}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Meta info */}
              <Box sx={{ display: 'flex', gap: 2, mt: 1, flexWrap: 'wrap' }}>
                <Typography variant="caption" color="text.secondary">
                  Joined {format(employee.joiningDate.toDate(), 'dd MMM yyyy')}
                </Typography>
                {employee.directReports > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <GroupsIcon fontSize="inherit" color="action" />
                    <Typography variant="caption" color="text.secondary">
                      {employee.directReports} direct report{employee.directReports !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default EmployeeCard;
