import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

interface Deliverable {
  id: string;
  fileName?: string;
  name?: string;
  fileUrl?: string;
  url?: string;
  type?: string;
}

interface LaunchWorkshopViewerButtonProps {
  projectId: string;
  itemId: string;
  itemName: string;
  sourcingType: string;
  deliverables?: Deliverable[];
}

const MODEL_EXTENSIONS = ['.3ds', '.dxf'];

function isModelFile(deliverable: Deliverable): boolean {
  const filename = (deliverable.fileName || deliverable.name || '').toLowerCase();
  return MODEL_EXTENSIONS.some((ext) => filename.endsWith(ext));
}

function getFileUrl(deliverable: Deliverable): string {
  return deliverable.fileUrl || deliverable.url || '';
}

function getDisplayName(deliverable: Deliverable): string {
  return deliverable.fileName || deliverable.name || deliverable.id;
}

const ELIGIBLE_SOURCING_TYPES = ['MANUFACTURED', 'CUSTOM_FURNITURE_MILLWORK'];

export default function LaunchWorkshopViewerButton({
  projectId,
  itemId,
  itemName,
  sourcingType,
  deliverables = [],
}: LaunchWorkshopViewerButtonProps) {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const modelFiles = useMemo(
    () => deliverables.filter((d) => isModelFile(d) && getFileUrl(d)),
    [deliverables],
  );

  if (!ELIGIBLE_SOURCING_TYPES.includes(sourcingType)) {
    return null;
  }

  const hasModels = modelFiles.length > 0;
  const hasSingleModel = modelFiles.length === 1;

  const handleNavigate = (fileUrl: string) => {
    navigate(
      `/workshop?projectId=${encodeURIComponent(projectId)}&itemId=${encodeURIComponent(itemId)}&fileUrl=${encodeURIComponent(fileUrl)}`,
    );
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!hasModels) return;
    if (hasSingleModel) {
      handleNavigate(getFileUrl(modelFiles[0]));
    } else {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleMenuItemClick = (deliverable: Deliverable) => {
    handleMenuClose();
    handleNavigate(getFileUrl(deliverable));
  };

  const button = (
    <span>
      <Button
        variant="outlined"
        size="small"
        startIcon={<ViewInArIcon />}
        endIcon={modelFiles.length > 1 ? <ArrowDropDownIcon /> : undefined}
        disabled={!hasModels}
        onClick={handleClick}
        aria-label={`Open ${itemName} in Design Studio`}
      >
        Design Studio
      </Button>
    </span>
  );

  return (
    <>
      {hasModels ? (
        button
      ) : (
        <Tooltip title="No 3D model uploaded" arrow>
          {button}
        </Tooltip>
      )}

      {modelFiles.length > 1 && (
        <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleMenuClose}>
          {modelFiles.map((file) => (
            <MenuItem key={file.id} onClick={() => handleMenuItemClick(file)}>
              <ListItemText primary={getDisplayName(file)} />
            </MenuItem>
          ))}
        </Menu>
      )}
    </>
  );
}
