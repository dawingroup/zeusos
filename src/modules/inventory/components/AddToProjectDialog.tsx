/**
 * AddToProjectDialog Component
 *
 * Dialog for linking an inventory product to a Design Manager project.
 * Allows searching and selecting projects.
 */

import { useState, useEffect, useCallback } from 'react';
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
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  InputAdornment,
} from '@mui/material';
import { FolderOpen, Search, Check } from 'lucide-react';
import {
  addProductToProject,
  getRecentProjects,
  searchProjects,
  getProjectsUsingProduct,
  removeProductFromProject,
  type ProjectSummary,
} from '../services/inventoryProjectLinkService';
import type { InventoryItem } from '../types/inventory';

interface Props {
  open: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  onLinked: () => void;
}

export function AddToProjectDialog({ open, onClose, item, onLinked }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [linkedProjects, setLinkedProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load projects
  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      if (searchTerm) {
        const results = await searchProjects(searchTerm);
        setProjects(results);
      } else {
        const recent = await getRecentProjects(20);
        setProjects(recent);
      }
    } catch (e) {
      console.error('Failed to load projects:', e);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  // Load linked projects for this item
  const loadLinkedProjects = useCallback(async () => {
    if (!item) return;
    try {
      const linked = await getProjectsUsingProduct(item.id);
      setLinkedProjects(linked);
    } catch (e) {
      console.error('Failed to load linked projects:', e);
    }
  }, [item]);

  useEffect(() => {
    if (open) {
      loadProjects();
      loadLinkedProjects();
      setError(null);
    }
  }, [open, loadProjects, loadLinkedProjects]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (open) loadProjects();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, open, loadProjects]);

  const isLinked = (projectId: string) => {
    return linkedProjects.some((p) => p.id === projectId);
  };

  const handleLinkProject = async (projectId: string) => {
    if (!item) return;

    setLinking(true);
    setError(null);

    try {
      if (isLinked(projectId)) {
        // Unlink
        const result = await removeProductFromProject(item.id, projectId);
        if (!result.success) {
          setError(result.error || 'Failed to unlink');
          return;
        }
        setLinkedProjects((prev) => prev.filter((p) => p.id !== projectId));
      } else {
        // Link
        const result = await addProductToProject(item.id, projectId);
        if (!result.success) {
          setError(result.error || 'Failed to link');
          return;
        }
        const project = projects.find((p) => p.id === projectId);
        if (project) {
          setLinkedProjects((prev) => [...prev, project]);
        }
      }
      onLinked();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLinking(false);
    }
  };

  const handleClose = () => {
    if (!linking) {
      setError(null);
      setSearchTerm('');
      onClose();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'in-progress':
        return 'success';
      case 'planning':
        return 'info';
      case 'completed':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FolderOpen className="w-5 h-5" />
        Add to Project
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {item && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
              <Typography variant="subtitle2">
                {item.displayName || item.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                {item.sku}
              </Typography>
            </Box>

            {linkedProjects.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Currently linked to {linkedProjects.length} project(s)
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {linkedProjects.map((project) => (
                    <Chip
                      key={project.id}
                      label={project.code}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            )}

            <TextField
              placeholder="Search projects by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              fullWidth
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search className="w-4 h-4" />
                  </InputAdornment>
                ),
              }}
            />

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : projects.length === 0 ? (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                No projects found
              </Typography>
            ) : (
              <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                {projects.map((project) => {
                  const linked = isLinked(project.id);
                  return (
                    <ListItem key={project.id} disablePadding>
                      <ListItemButton
                        onClick={() => handleLinkProject(project.id)}
                        selected={linked}
                        disabled={linking}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" fontWeight={500}>
                                {project.code}
                              </Typography>
                              <Chip
                                label={project.status}
                                size="small"
                                color={getStatusColor(project.status) as any}
                                sx={{ height: 20 }}
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="caption">{project.name}</Typography>
                              {project.customerName && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {project.customerName}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        {linked && (
                          <Check className="w-4 h-4 text-green-600" />
                        )}
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            )}

            <Typography variant="caption" color="text.secondary">
              Click a project to link/unlink this product
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={linking}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AddToProjectDialog;
