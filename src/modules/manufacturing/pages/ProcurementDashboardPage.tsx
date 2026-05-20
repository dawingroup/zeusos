/**
 * Procurement Dashboard Page
 * Shows procurement requirements grouped by supplier for consolidation into POs.
 * Two views: "By Supplier" (consolidation) and "By MO" (per-order view).
 */

import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Checkbox,
  Chip,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { Link } from 'react-router-dom';
import { useProcurementRequirements, useProcurementConsolidation } from '../hooks/useProcurementRequirements';
import { PROCUREMENT_STATUS_LABELS } from '../types/procurement';
import type { ProcurementRequirement } from '../types/procurement';
import { useAuth } from '@/shared/hooks/useAuth';

export default function ProcurementDashboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [consolidating, setConsolidating] = useState(false);

  // All requirements (real-time)
  const {
    requirements,
    loading,
    error,
    consolidate,
  } = useProcurementRequirements({
    subsidiaryId: 'finishes',
  });

  // Grouped by supplier
  const { groups, loading: groupsLoading, refresh: refreshGroups } = useProcurementConsolidation('finishes');

  // Requirements grouped by MO
  const byMO = useMemo(() => {
    const map = new Map<string, ProcurementRequirement[]>();
    for (const req of requirements) {
      if (!map.has(req.moId)) map.set(req.moId, []);
      map.get(req.moId)!.push(req);
    }
    return Array.from(map.entries()).map(([moId, reqs]) => ({
      moId,
      moNumber: reqs[0].moNumber,
      designItemName: reqs[0].designItemName,
      projectCode: reqs[0].projectCode,
      requirements: reqs,
    }));
  }, [requirements]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllForSupplier = (supplierId: string) => {
    const group = groups.find((g) => g.supplierId === supplierId);
    if (!group) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = group.requirements.every((r) => next.has(r.id));
      for (const req of group.requirements) {
        if (allSelected) next.delete(req.id);
        else next.add(req.id);
      }
      return next;
    });
  };

  const handleConsolidate = async (supplierId: string) => {
    if (!user?.uid) return;
    const idsForSupplier = groups
      .find((g) => g.supplierId === supplierId)
      ?.requirements.filter((r) => selectedIds.has(r.id))
      .map((r) => r.id) ?? [];

    if (idsForSupplier.length === 0) return;

    setConsolidating(true);
    const poId = await consolidate(idsForSupplier, supplierId, user.uid);
    setConsolidating(false);
    if (poId) {
      setSelectedIds(new Set());
      refreshGroups();
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'added-to-po': return 'info';
      case 'ordered': return 'primary';
      case 'received': return 'success';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  if (loading && requirements.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 1 }}>Procurement Requirements</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Outsourced materials and special parts needed across manufacturing orders.
        Consolidate requirements by supplier into Purchase Orders.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={`By Supplier (${groups.length})`} />
        <Tab label={`By MO (${byMO.length})`} />
        <Tab label={`All (${requirements.length})`} />
      </Tabs>

      {/* Tab 0: By Supplier — consolidation view */}
      {tab === 0 && (
        <Box>
          {groupsLoading ? (
            <CircularProgress />
          ) : groups.length === 0 ? (
            <Alert severity="info">No pending procurement requirements</Alert>
          ) : (
            groups.map((group) => {
              const selectedCount = group.requirements.filter((r) => selectedIds.has(r.id)).length;
              return (
                <Accordion key={group.supplierId} defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                      <Typography fontWeight="bold">{group.supplierName}</Typography>
                      <Chip label={`${group.requirements.length} items`} size="small" />
                      <Chip label={`${group.moCount} MO(s)`} size="small" variant="outlined" />
                      <Typography color="text.secondary" sx={{ ml: 'auto', mr: 2 }}>
                        Est. {group.totalEstimatedCost.toLocaleString()} {group.currency}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={group.requirements.every((r) => selectedIds.has(r.id))}
                                indeterminate={
                                  selectedCount > 0 && selectedCount < group.requirements.length
                                }
                                onChange={() => selectAllForSupplier(group.supplierId)}
                              />
                            </TableCell>
                            <TableCell>MO#</TableCell>
                            <TableCell>Design Item</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell align="right">Qty</TableCell>
                            <TableCell>Unit</TableCell>
                            <TableCell align="right">Est. Cost</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {group.requirements.map((req) => (
                            <TableRow key={req.id}>
                              <TableCell padding="checkbox">
                                <Checkbox
                                  checked={selectedIds.has(req.id)}
                                  onChange={() => toggleSelection(req.id)}
                                  disabled={req.status !== 'pending'}
                                />
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={req.moNumber}
                                  size="small"
                                  variant="outlined"
                                  component={Link}
                                  to={`/manufacturing/orders/${req.moId}`}
                                  clickable
                                />
                              </TableCell>
                              <TableCell>{req.designItemName}</TableCell>
                              <TableCell>{req.itemDescription}</TableCell>
                              <TableCell align="right">{req.quantityRequired}</TableCell>
                              <TableCell>{req.unit}</TableCell>
                              <TableCell align="right">
                                {req.estimatedTotalCost.toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={PROCUREMENT_STATUS_LABELS[req.status]}
                                  size="small"
                                  color={statusColor(req.status) as any}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    {selectedCount > 0 && (
                      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          variant="contained"
                          startIcon={consolidating ? <CircularProgress size={16} /> : <ShoppingCartIcon />}
                          onClick={() => handleConsolidate(group.supplierId)}
                          disabled={consolidating}
                        >
                          Create PO ({selectedCount} item{selectedCount > 1 ? 's' : ''})
                        </Button>
                      </Box>
                    )}
                  </AccordionDetails>
                </Accordion>
              );
            })
          )}
        </Box>
      )}

      {/* Tab 1: By MO */}
      {tab === 1 && (
        <Box>
          {byMO.length === 0 ? (
            <Alert severity="info">No procurement requirements</Alert>
          ) : (
            byMO.map((mo) => (
              <Card key={mo.moId} variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Chip
                      label={mo.moNumber}
                      component={Link}
                      to={`/manufacturing/orders/${mo.moId}`}
                      clickable
                    />
                    <Typography>{mo.designItemName}</Typography>
                    <Typography color="text.secondary">{mo.projectCode}</Typography>
                  </Box>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Description</TableCell>
                          <TableCell>Supplier</TableCell>
                          <TableCell align="right">Qty</TableCell>
                          <TableCell align="right">Est. Cost</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>PO</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {mo.requirements.map((req) => (
                          <TableRow key={req.id}>
                            <TableCell>{req.itemDescription}</TableCell>
                            <TableCell>{req.supplierName ?? '—'}</TableCell>
                            <TableCell align="right">{req.quantityRequired}</TableCell>
                            <TableCell align="right">
                              {req.estimatedTotalCost.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={PROCUREMENT_STATUS_LABELS[req.status]}
                                size="small"
                                color={statusColor(req.status) as any}
                              />
                            </TableCell>
                            <TableCell>
                              {req.poId ? (
                                <Chip
                                  label="View PO"
                                  size="small"
                                  variant="outlined"
                                  component={Link}
                                  to={`/manufacturing/purchase-orders/${req.poId}`}
                                  clickable
                                />
                              ) : (
                                '—'
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            ))
          )}
        </Box>
      )}

      {/* Tab 2: All requirements flat */}
      {tab === 2 && (
        <Card variant="outlined">
          <CardContent>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>MO#</TableCell>
                    <TableCell>Design Item</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Supplier</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Est. Cost</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>PO</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requirements.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell>
                        <Chip
                          label={req.moNumber}
                          size="small"
                          variant="outlined"
                          component={Link}
                          to={`/manufacturing/orders/${req.moId}`}
                          clickable
                        />
                      </TableCell>
                      <TableCell>{req.designItemName}</TableCell>
                      <TableCell>{req.itemDescription}</TableCell>
                      <TableCell>{req.supplierName ?? '—'}</TableCell>
                      <TableCell align="right">{req.quantityRequired}</TableCell>
                      <TableCell align="right">
                        {req.estimatedTotalCost.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={PROCUREMENT_STATUS_LABELS[req.status]}
                          size="small"
                          color={statusColor(req.status) as any}
                        />
                      </TableCell>
                      <TableCell>
                        {req.poId ? (
                          <Chip
                            label="View PO"
                            size="small"
                            variant="outlined"
                            component={Link}
                            to={`/manufacturing/purchase-orders/${req.poId}`}
                            clickable
                          />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {requirements.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <Typography color="text.secondary">No procurement requirements</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
