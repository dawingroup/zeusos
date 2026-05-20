// ============================================================================
// BUDGET FORM COMPONENT
// DawinOS v2.0 - Financial Management Module
// Component for creating and editing budgets
// ============================================================================

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Button,
  Grid as MuiGrid,
  Chip,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
const Grid = MuiGrid as any;
import { BudgetInput } from '../../types/budget.types';
import { budgetInputSchema } from '../../schemas/budget.schemas';
import {
  BUDGET_TYPES,
  BUDGET_TYPE_LABELS,
  BUDGET_TYPE_DESCRIPTIONS,
  BUDGET_PERIODS,
  BUDGET_PERIOD_LABELS,
} from '../../constants/budget.constants';
import { CURRENCIES, CURRENCY_LABELS } from '../../constants/currency.constants';

interface BudgetFormProps {
  initialValues?: Partial<BudgetInput>;
  onSubmit: (data: BudgetInput) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  departments?: Array<{ id: string; name: string }>;
  projects?: Array<{ id: string; name: string }>;
  parentBudgets?: Array<{ id: string; name: string }>;
}

const currentYear = new Date().getFullYear();
const fiscalYears = Array.from({ length: 5 }, (_, i) => currentYear + i);

const defaultValues: BudgetInput = {
  name: '',
  code: '',
  description: '',
  type: 'operating',
  fiscalYear: currentYear + 1,
  periodType: 'monthly',
  currency: 'UGX',
  tags: [],
};

export const BudgetForm: React.FC<BudgetFormProps> = ({
  initialValues,
  onSubmit,
  onCancel,
  loading = false,
  departments = [],
  projects = [],
  parentBudgets = [],
}) => {
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BudgetInput>({
    resolver: zodResolver(budgetInputSchema) as any,
    defaultValues: { ...defaultValues, ...initialValues },
  });

  const selectedType = watch('type');
  const isEditing = !!initialValues?.name;

  const handleFormSubmit = async (data: BudgetInput) => {
    await onSubmit(data);
  };

  return (
    <Card>
      <CardHeader
        title={isEditing ? 'Edit Budget' : 'Create New Budget'}
        subheader={isEditing ? 'Update budget details' : 'Set up a new budget for your organization'}
      />
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit as any)}>
          <Grid container spacing={3}>
            {/* Budget Name */}
            <Grid item xs={12} md={8}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Budget Name"
                    placeholder="e.g., Operating Budget FY2026"
                    error={!!errors.name}
                    helperText={errors.name?.message}
                    disabled={loading}
                  />
                )}
              />
            </Grid>

            {/* Budget Code */}
            <Grid item xs={12} md={4}>
              <Controller
                name="code"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Budget Code"
                    placeholder="e.g., BUD-2026-OP"
                    error={!!errors.code}
                    helperText={errors.code?.message || 'Auto-generated if empty'}
                    disabled={loading}
                  />
                )}
              />
            </Grid>

            {/* Budget Type */}
            <Grid item xs={12} md={6}>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.type}>
                    <InputLabel>Budget Type</InputLabel>
                    <Select {...field} label="Budget Type" disabled={loading}>
                      {Object.entries(BUDGET_TYPES).map(([_key, value]) => (
                        <MenuItem key={value} value={value}>
                          {BUDGET_TYPE_LABELS[value]}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>
                      {errors.type?.message || BUDGET_TYPE_DESCRIPTIONS[selectedType]}
                    </FormHelperText>
                  </FormControl>
                )}
              />
            </Grid>

            {/* Fiscal Year */}
            <Grid item xs={12} md={3}>
              <Controller
                name="fiscalYear"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.fiscalYear}>
                    <InputLabel>Fiscal Year</InputLabel>
                    <Select {...field} label="Fiscal Year" disabled={loading}>
                      {fiscalYears.map((year) => (
                        <MenuItem key={year} value={year}>
                          FY{year} (Jul {year - 1} - Jun {year})
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>{errors.fiscalYear?.message}</FormHelperText>
                  </FormControl>
                )}
              />
            </Grid>

            {/* Period Type */}
            <Grid item xs={12} md={3}>
              <Controller
                name="periodType"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.periodType}>
                    <InputLabel>Period Type</InputLabel>
                    <Select {...field} label="Period Type" disabled={loading}>
                      {Object.entries(BUDGET_PERIODS).map(([_key, value]) => (
                        <MenuItem key={value} value={value}>
                          {BUDGET_PERIOD_LABELS[value]}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>{errors.periodType?.message}</FormHelperText>
                  </FormControl>
                )}
              />
            </Grid>

            {/* Department */}
            <Grid item xs={12} md={6}>
              <Controller
                name="departmentId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Department (Optional)</InputLabel>
                    <Select
                      {...field}
                      value={field.value || ''}
                      label="Department (Optional)"
                      disabled={loading}
                    >
                      <MenuItem value="">None</MenuItem>
                      {departments.map((dept) => (
                        <MenuItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            {/* Project */}
            <Grid item xs={12} md={6}>
              <Controller
                name="projectId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Project (Optional)</InputLabel>
                    <Select
                      {...field}
                      value={field.value || ''}
                      label="Project (Optional)"
                      disabled={loading}
                    >
                      <MenuItem value="">None</MenuItem>
                      {projects.map((project) => (
                        <MenuItem key={project.id} value={project.id}>
                          {project.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            {/* Currency */}
            <Grid item xs={12} md={6}>
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.currency}>
                    <InputLabel>Currency</InputLabel>
                    <Select {...field} label="Currency" disabled={loading}>
                      {Object.entries(CURRENCIES).map(([_key, value]) => (
                        <MenuItem key={value} value={value}>
                          {value} - {CURRENCY_LABELS[value]}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>{errors.currency?.message}</FormHelperText>
                  </FormControl>
                )}
              />
            </Grid>

            {/* Parent Budget */}
            <Grid item xs={12} md={6}>
              <Controller
                name="parentBudgetId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Parent Budget (Optional)</InputLabel>
                    <Select
                      {...field}
                      value={field.value || ''}
                      label="Parent Budget (Optional)"
                      disabled={loading}
                    >
                      <MenuItem value="">None</MenuItem>
                      {parentBudgets.map((budget) => (
                        <MenuItem key={budget.id} value={budget.id}>
                          {budget.name}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>
                      Link to a master budget for consolidation
                    </FormHelperText>
                  </FormControl>
                )}
              />
            </Grid>

            {/* Description */}
            <Grid item xs={12}>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    multiline
                    rows={3}
                    label="Description"
                    placeholder="Budget purpose and notes..."
                    error={!!errors.description}
                    helperText={errors.description?.message}
                    disabled={loading}
                  />
                )}
              />
            </Grid>

            {/* Tags */}
            <Grid item xs={12}>
              <Controller
                name="tags"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    multiple
                    freeSolo
                    options={[]}
                    value={field.value || []}
                    onChange={(_, newValue) => field.onChange(newValue)}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          label={option}
                          size="small"
                          {...getTagProps({ index })}
                          key={option}
                        />
                      ))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Tags"
                        placeholder="Press enter to add tags"
                        helperText="Add tags to organize and filter budgets"
                        disabled={loading}
                      />
                    )}
                  />
                )}
              />
            </Grid>

            {/* Actions */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={onCancel}
                  disabled={isSubmitting || loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isSubmitting || loading}
                  startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
                >
                  {isEditing ? 'Update Budget' : 'Create Budget'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </CardContent>
    </Card>
  );
};

export default BudgetForm;
