import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadOutfitFont } from '../utils/pdfFonts';
import { materialHasGrain, getGrainDisplay, processEdgeData, calculateProjectEdgeTotals } from '../utils/csvParser';

/**
 * Enhanced PDF Export Service for Cutting Optimization Reports
 * Generates professional workshop-ready cutting layouts
 * Uses Outfit font for brand alignment
 */

// Dawin Finishes Brand Colors
const COLORS = {
  header: '#872E5C',        // Boysenberry - primary brand color
  subheader: '#6a2449',     // Boysenberry dark
  accent: '#1d1d1f',        // Teal - secondary accent
  text: '#212121',
  lightGray: '#f5f5f5',
  cashmere: '#E2CAA9',      // Cashmere - warm background
  cashmereLight: '#efe3d4', // Cashmere light
  edgeThick: '#E74C3C',     // Red - 2.0mm thick edge banding
  edgeThin: '#3498DB',       // Blue - 0.4mm thin edge banding
  seaform: '#7ABDCD',       // Seaform blue - info/highlights
  pesto: '#8A7D4B',         // Pesto - success states
  grainArrow: 'rgba(135, 46, 92, 0.6)', // Boysenberry 60% - grain direction
};

/**
 * Generate optimization PDF with cutting layouts
 * @param {Array} sheetLayouts - Array of sheet layout results
 * @param {Object} projectInfo - Project information
 * @param {HTMLElement} reportElement - Report DOM element for SVG capture
 * @returns {jsPDF} PDF document
 */
export const generateOptimizationPDF = async (sheetLayouts, projectInfo, reportElement) => {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Load Outfit font for brand alignment
  const fontLoaded = await loadOutfitFont(pdf);
  const fontFamily = fontLoaded ? 'Outfit' : 'helvetica';

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;

  // Calculate totals for summary
  let totalSheets = sheetLayouts.length;
  let totalUsedArea = 0;
  let totalWastedArea = 0;
  let totalPanels = 0;
  const edgeBandingTotals = {};
  const materialSummary = {};

  sheetLayouts.forEach(sheet => {
    totalUsedArea += sheet.usedArea;
    totalWastedArea += sheet.wastedArea;
    totalPanels += sheet.placements.length;

    // Track by material
    if (!materialSummary[sheet.material]) {
      materialSummary[sheet.material] = { sheets: 0, usedArea: 0, wastedArea: 0 };
    }
    materialSummary[sheet.material].sheets++;
    materialSummary[sheet.material].usedArea += sheet.usedArea;
    materialSummary[sheet.material].wastedArea += sheet.wastedArea;

    // Calculate edge banding totals
    sheet.placements.forEach(placement => {
      const panel = placement.panel;
      const edges = panel.edges || panel.edgeBanding || {};
      Object.entries(edges).forEach(([edge, type]) => {
        if (type) {
          const key = `${type} ${sheet.material}`;
          const length = (edge === 'top' || edge === 'bottom') 
            ? (panel.length || placement.width) 
            : (panel.width || placement.height);
          edgeBandingTotals[key] = (edgeBandingTotals[key] || 0) + length;
        }
      });
    });
  });

  // Generate each sheet page
  for (let i = 0; i < sheetLayouts.length; i++) {
    if (i > 0) pdf.addPage();
    const sheet = sheetLayouts[i];
    
    await renderSheetPage(pdf, sheet, i + 1, totalSheets, projectInfo, pageWidth, pageHeight, margin, fontFamily);
  }

  // Add summary page
  pdf.addPage();
  renderSummaryPage(pdf, sheetLayouts, projectInfo, materialSummary, edgeBandingTotals, pageWidth, pageHeight, margin, fontFamily);

  return pdf;
};

/**
 * Render a single sheet page
 */
const renderSheetPage = async (pdf, sheet, sheetNum, totalSheets, projectInfo, pageWidth, pageHeight, margin, fontFamily = 'helvetica') => {
  // Header bar
  pdf.setFillColor(COLORS.header);
  pdf.rect(0, 0, pageWidth, 18, 'F');
  
  pdf.setTextColor('#ffffff');
  pdf.setFontSize(12);
  pdf.setFont(fontFamily, 'bold');
  pdf.text('DAWIN FINISHES - CUTTING OPTIMIZATION', margin, 11);
  
  pdf.setFontSize(9);
  pdf.setFont(fontFamily, 'normal');
  pdf.text(`Sheet ${sheetNum} of ${totalSheets}`, pageWidth - margin - 30, 8);
  pdf.text(new Date().toLocaleDateString(), pageWidth - margin - 30, 13);
  
  pdf.setFontSize(10);
  pdf.text(`Project: ${projectInfo.code || 'DRAFT'} - ${projectInfo.name || 'Untitled'}`, margin + 95, 11);

  // Material info bar
  pdf.setFillColor(COLORS.cashmereLight);
  pdf.rect(margin, 22, pageWidth - 2 * margin, 10, 'F');
  
  pdf.setTextColor(COLORS.text);
  pdf.setFontSize(9);
  pdf.text(`Material: ${sheet.material} ${sheet.thickness}mm`, margin + 3, 28);
  pdf.text(`Stock: ${sheet.width} × ${sheet.height} mm`, margin + 70, 28);
  pdf.text(`Utilization: ${sheet.utilization.toFixed(1)}%`, margin + 130, 28);
  pdf.text(`Waste: ${(sheet.wastedArea / 1000000).toFixed(3)} m²`, margin + 175, 28);
  pdf.text(`Panels: ${sheet.placements.length}`, margin + 220, 28);

  // Cutting diagram area (left 60%)
  const diagramWidth = (pageWidth - 3 * margin) * 0.6;
  const diagramHeight = pageHeight - 85;
  const diagramX = margin;
  const diagramY = 36;

  // Draw simplified cutting diagram directly in PDF
  drawCuttingDiagram(pdf, sheet, diagramX, diagramY, diagramWidth, diagramHeight);

  // Legend area (right 35%)
  const legendX = diagramX + diagramWidth + margin;
  const legendWidth = pageWidth - legendX - margin;
  let legendY = diagramY;

  // Statistics box
  pdf.setFillColor(COLORS.cashmereLight);
  pdf.rect(legendX, legendY, legendWidth, 35, 'F');
  pdf.setDrawColor(COLORS.cashmere);
  pdf.rect(legendX, legendY, legendWidth, 35, 'S');
  
  pdf.setFontSize(10);
  pdf.setFont(fontFamily, 'bold');
  pdf.setTextColor(COLORS.text);
  pdf.text('STATISTICS', legendX + 3, legendY + 7);
  
  pdf.setFont(fontFamily, 'normal')
  pdf.setFontSize(8);
  const stats = [
    ['Used Area:', `${(sheet.usedArea / 1000000).toFixed(3)} m²`],
    ['Waste:', `${(sheet.wastedArea / 1000000).toFixed(3)} m²`],
    ['Cuts:', `${sheet.cuts?.length || 0}`],
    ['Cut Length:', `${((sheet.cuts?.reduce((sum, cut) => sum + (cut.type === 'horizontal' ? Math.abs(cut.x2 - cut.x1) : Math.abs(cut.y2 - cut.y1)), 0) || 0) / 1000).toFixed(1)} m`],
  ];
  stats.forEach((stat, idx) => {
    pdf.text(stat[0], legendX + 3, legendY + 14 + idx * 5);
    pdf.text(stat[1], legendX + 25, legendY + 14 + idx * 5);
  });

  legendY += 40;

  // Panel legend table
  pdf.setFontSize(10);
  pdf.setFont(fontFamily, 'bold');
  pdf.text('PANEL LEGEND', legendX + 3, legendY + 5);

  const getLetterLabel = (index) => {
    if (index < 26) return String.fromCharCode(65 + index);
    return String.fromCharCode(65 + Math.floor(index / 26) - 1) + String.fromCharCode(65 + (index % 26));
  };

  autoTable(pdf, {
    startY: legendY + 8,
    margin: { left: legendX },
    tableWidth: legendWidth,
    head: [['Ref', 'Label', 'Size', 'Edges', 'Grain']],
    body: sheet.placements.map((p, idx) => [
      getLetterLabel(idx),
      p.label || p.panel.label || p.panel.cabinet || '-',
      `${p.panel.length || p.width}×${p.panel.width || p.height}`,
      calculateEdgeSummary(p.panel),
      getPanelGrainIcon(p.panel),
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: COLORS.subheader, textColor: '#ffffff', fontStyle: 'bold' },
    alternateRowStyles: { fillColor: '#f9f9f9' },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 22 },
      3: { cellWidth: 12 },
      4: { cellWidth: 10 },
    },
  });

  // Edge banding key
  const keyY = pdf.lastAutoTable.finalY + 8;
  pdf.setFontSize(10);
  pdf.setFont(fontFamily, 'bold');
  pdf.text('EDGE BANDING KEY', legendX + 3, keyY);
  
  pdf.setFontSize(8);
  pdf.setFont(fontFamily, 'normal');
  
  // Thick edge indicator (Red)
  pdf.setDrawColor(COLORS.edgeThick);
  pdf.setLineWidth(1.2);
  pdf.line(legendX + 3, keyY + 6, legendX + 18, keyY + 6);
  pdf.setTextColor(COLORS.text);
  pdf.text('2.0mm (Thick)', legendX + 21, keyY + 7);
  
  // Thin edge indicator (Blue)
  pdf.setDrawColor(COLORS.edgeThin);
  pdf.setLineWidth(0.6);
  pdf.line(legendX + 3, keyY + 12, legendX + 18, keyY + 12);
  pdf.text('0.4mm (Thin)', legendX + 21, keyY + 13);
  
  // Edge summary format
  pdf.setFontSize(7);
  pdf.text('L = Length edges, W = Width edges', legendX + 3, keyY + 19);
  
  // Grain indicators (three states)
  pdf.setFontSize(8);
  pdf.text('↕ Vertical Grain', legendX + 3, keyY + 26);
  pdf.text('↔ Horizontal Grain', legendX + 3, keyY + 31);
  pdf.text('— No Grain', legendX + 3, keyY + 36);

  // Footer
  pdf.setFontSize(7);
  pdf.setTextColor('#9E9E9E');
  pdf.text(
    'Generated by Dawin Cutlist Processor | dawin-cutlist-processor.web.app',
    margin,
    pageHeight - 5
  );
};

/**
 * Calculate dynamic font size based on panel dimensions
 * Ensures readability on both large and small panels (14-24px range)
 */
const getDimensionFontSize = (panelWidth, panelHeight, scale) => {
  const scaledWidth = panelWidth * scale;
  const scaledHeight = panelHeight * scale;
  const minDimension = Math.min(scaledWidth, scaledHeight);
  
  // Scale font to panel size, clamped between 14-24px equivalent in mm
  // PDF uses mm, so we scale down from px (roughly 1mm = 2.8px at 72dpi)
  const fontSize = Math.min(8, Math.max(4, minDimension * 0.12));
  return Math.round(fontSize * 10) / 10;
};

/**
 * Get edge style based on edge value
 */
const getEdgeStyle = (edgeValue) => {
  if (!edgeValue) return null;
  const v = edgeValue.toString().toLowerCase();
  if (v === '2' || v === '2.0' || v === '2mm' || v === 'thick') {
    return { color: COLORS.edgeThick, width: 1.2 }; // Red, thick
  }
  if (v === '0.4' || v === '0.4mm' || v === 'thin') {
    return { color: COLORS.edgeThin, width: 0.6 }; // Blue, thin
  }
  return { color: COLORS.edgeThin, width: 0.4 }; // Default thin
};

/**
 * Calculate edge summary in PG Bison format
 * Length edges = Top + Bottom (horizontal edges)
 * Width edges = Left + Right (vertical edges)
 */
const calculateEdgeSummary = (panel) => {
  const hasEdge = (value) => value && value !== '0' && value !== '' && value !== null;
  const edges = panel.edges || panel.edgeBanding || panel._edges || {};
  
  const lengthEdges = [edges.top, edges.bottom].filter(hasEdge).length;
  const widthEdges = [edges.left, edges.right].filter(hasEdge).length;
  
  if (lengthEdges === 0 && widthEdges === 0) {
    return '-';
  }
  
  const parts = [];
  if (lengthEdges > 0) parts.push(`${lengthEdges}L`);
  if (widthEdges > 0) parts.push(`${widthEdges}W`);
  
  return parts.join(' ');
};

/**
 * Get grain icon for panel (three states: ↕ / ↔ / —)
 */
const getPanelGrainIcon = (panel) => {
  const materialName = panel.material || '';
  const hasGrain = materialHasGrain(materialName);
  
  if (!hasGrain) {
    return '—'; // No grain (painted, solid laminate)
  }
  
  // grain === 1 typically means vertical, grain === 0 means horizontal
  if (panel.grain === 1) {
    return '↕'; // Vertical grain
  } else if (panel.grain === 0) {
    return '↔'; // Horizontal grain
  }
  
  return '↕'; // Default to vertical
};

/**
 * Draw simplified cutting diagram in PDF with enhanced visuals
 */
const drawCuttingDiagram = (pdf, sheet, x, y, maxWidth, maxHeight) => {
  const sheetWidth = sheet.width;
  const sheetHeight = sheet.height;
  
  // Calculate scale to fit
  const scaleX = maxWidth / sheetWidth;
  const scaleY = maxHeight / sheetHeight;
  const scale = Math.min(scaleX, scaleY) * 0.95;
  
  const drawWidth = sheetWidth * scale;
  const drawHeight = sheetHeight * scale;
  
  // Center the diagram
  const offsetX = x + (maxWidth - drawWidth) / 2;
  const offsetY = y + (maxHeight - drawHeight) / 2;

  // Draw stock sheet outline
  pdf.setFillColor('#FAFAFA');
  pdf.setDrawColor('#424242');
  pdf.setLineWidth(0.5);
  pdf.rect(offsetX, offsetY, drawWidth, drawHeight, 'FD');

  // Draw waste areas
  if (sheet.freeRects) {
    sheet.freeRects.forEach(rect => {
      const isUsable = rect.width >= 300 && rect.height >= 300;
      pdf.setFillColor(isUsable ? '#FFF9C4' : '#F5F5F5');
      pdf.setDrawColor('#BDBDBD');
      pdf.setLineWidth(0.2);
      pdf.rect(
        offsetX + rect.x * scale,
        offsetY + rect.y * scale,
        rect.width * scale,
        rect.height * scale,
        'FD'
      );
      
      // Waste label
      if (rect.width * scale > 15 && rect.height * scale > 10) {
        pdf.setFontSize(5);
        pdf.setTextColor('#757575');
        pdf.text(
          isUsable ? 'OFFCUT' : 'WASTE',
          offsetX + rect.x * scale + rect.width * scale / 2,
          offsetY + rect.y * scale + rect.height * scale / 2 - 2,
          { align: 'center' }
        );
        pdf.setFontSize(4);
        pdf.text(
          `${Math.round(rect.width)}×${Math.round(rect.height)}`,
          offsetX + rect.x * scale + rect.width * scale / 2,
          offsetY + rect.y * scale + rect.height * scale / 2 + 2,
          { align: 'center' }
        );
      }
    });
  }

  // Draw panels
  const getLetterLabel = (index) => {
    if (index < 26) return String.fromCharCode(65 + index);
    return String.fromCharCode(65 + Math.floor(index / 26) - 1) + String.fromCharCode(65 + (index % 26));
  };

  sheet.placements.forEach((placement, idx) => {
    const panel = placement.panel;
    const px = offsetX + placement.x * scale;
    const py = offsetY + placement.y * scale;
    const pw = placement.width * scale;
    const ph = placement.height * scale;

    // Panel fill color based on grain - using brand colors
    const grainIcon = getPanelGrainIcon(panel);
    const fillColor = grainIcon === '↕' ? '#fdf2f7' : grainIcon === '↔' ? '#e0f7fa' : COLORS.cashmereLight;
    pdf.setFillColor(fillColor);
    pdf.setDrawColor('#424242');
    pdf.setLineWidth(0.3);
    pdf.rect(px, py, pw, ph, 'FD');

    // Draw edge banding indicators with colored borders
    const edges = panel.edges || panel.edgeBanding || panel._edges || {};
    
    // Top edge
    const topStyle = getEdgeStyle(edges.top);
    if (topStyle) {
      pdf.setDrawColor(topStyle.color);
      pdf.setLineWidth(topStyle.width);
      pdf.line(px, py + topStyle.width/2, px + pw, py + topStyle.width/2);
    }
    
    // Bottom edge
    const bottomStyle = getEdgeStyle(edges.bottom);
    if (bottomStyle) {
      pdf.setDrawColor(bottomStyle.color);
      pdf.setLineWidth(bottomStyle.width);
      pdf.line(px, py + ph - bottomStyle.width/2, px + pw, py + ph - bottomStyle.width/2);
    }
    
    // Left edge
    const leftStyle = getEdgeStyle(edges.left);
    if (leftStyle) {
      pdf.setDrawColor(leftStyle.color);
      pdf.setLineWidth(leftStyle.width);
      pdf.line(px + leftStyle.width/2, py, px + leftStyle.width/2, py + ph);
    }
    
    // Right edge
    const rightStyle = getEdgeStyle(edges.right);
    if (rightStyle) {
      pdf.setDrawColor(rightStyle.color);
      pdf.setLineWidth(rightStyle.width);
      pdf.line(px + pw - rightStyle.width/2, py, px + pw - rightStyle.width/2, py + ph);
    }

    // Panel content - only if panel is large enough
    if (pw > 8 && ph > 6) {
      // Reference letter (A, B, C...)
      pdf.setFontSize(Math.min(10, pw * 0.18, ph * 0.25));
      pdf.setTextColor('#212121');
      pdf.setFont('helvetica', 'bold');
      pdf.text(getLetterLabel(idx), px + pw / 2, py + ph / 2 - 2, { align: 'center' });
      
      // Dimensions with dynamic font size (larger, more readable)
      const panelLength = panel.length || placement.width;
      const panelWidth = panel.width || placement.height;
      const dimFontSize = getDimensionFontSize(panelLength, panelWidth, scale);
      
      if (pw > 12 && ph > 8) {
        // Dimensions with white background for contrast
        const dimensionText = `${panelLength}×${panelWidth}`;
        pdf.setFontSize(dimFontSize);
        pdf.setFont('helvetica', 'bold');
        const textWidth = pdf.getTextWidth(dimensionText);
        const textHeight = dimFontSize * 0.4;
        
        // Draw white background rectangle
        pdf.setFillColor(255, 255, 255);
        pdf.rect(
          px + pw / 2 - textWidth / 2 - 1,
          py + ph / 2 + 0.5,
          textWidth + 2,
          textHeight + 1.5,
          'F'
        );
        
        pdf.setTextColor('#333333');
        pdf.text(
          dimensionText,
          px + pw / 2,
          py + ph / 2 + textHeight + 1,
          { align: 'center' }
        );
      }

      // Grain arrow (only for materials with grain)
      if (pw > 15 && ph > 10) {
        pdf.setFontSize(5);
        pdf.setTextColor('#666666');
        pdf.text(
          grainIcon,
          px + pw / 2,
          py + ph / 2 + 5,
          { align: 'center' }
        );
      }
    }
  });

  // Dimension annotations
  pdf.setFontSize(8);
  pdf.setTextColor('#757575');
  pdf.text(`${sheetWidth} mm`, offsetX + drawWidth / 2, offsetY + drawHeight + 6, { align: 'center' });
  
  // Rotate for height annotation
  pdf.text(`${sheetHeight} mm`, offsetX - 4, offsetY + drawHeight / 2, { angle: 90 });
};

/**
 * Render summary page
 */
const renderSummaryPage = (pdf, sheetLayouts, projectInfo, materialSummary, edgeBandingTotals, pageWidth, pageHeight, margin, fontFamily = 'helvetica') => {
  // Header
  pdf.setFillColor(COLORS.header);
  pdf.rect(0, 0, pageWidth, 18, 'F');
  
  pdf.setTextColor('#ffffff');
  pdf.setFontSize(12);
  pdf.setFont(fontFamily, 'bold');
  pdf.text('PROJECT SUMMARY', margin, 11);
  
  pdf.setFontSize(10);
  pdf.text(`${projectInfo.code || 'DRAFT'} - ${projectInfo.name || 'Untitled'}`, margin + 55, 11);
  pdf.text(new Date().toLocaleDateString(), pageWidth - margin - 25, 11);

  let yPos = 28;

  // Material Requirements Table
  pdf.setTextColor(COLORS.text);
  pdf.setFontSize(11);
  pdf.setFont(fontFamily, 'bold');
  pdf.text('MATERIAL REQUIREMENTS', margin, yPos);

  const materialData = Object.entries(materialSummary).map(([material, data]) => [
    material,
    data.sheets.toString(),
    `${(data.usedArea / 1000000).toFixed(3)} m²`,
    `${(data.wastedArea / 1000000).toFixed(3)} m²`,
    `${Math.round((data.usedArea / (data.usedArea + data.wastedArea)) * 100)}%`,
  ]);

  const totalUsed = Object.values(materialSummary).reduce((sum, d) => sum + d.usedArea, 0);
  const totalWaste = Object.values(materialSummary).reduce((sum, d) => sum + d.wastedArea, 0);
  const totalSheets = Object.values(materialSummary).reduce((sum, d) => sum + d.sheets, 0);

  autoTable(pdf, {
    startY: yPos + 4,
    margin: { left: margin, right: margin },
    head: [['Material', 'Sheets', 'Used Area', 'Waste', 'Utilization']],
    body: materialData,
    foot: [[
      'TOTAL',
      totalSheets.toString(),
      `${(totalUsed / 1000000).toFixed(3)} m²`,
      `${(totalWaste / 1000000).toFixed(3)} m²`,
      `${Math.round((totalUsed / (totalUsed + totalWaste)) * 100)}%`,
    ]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: COLORS.subheader, textColor: '#ffffff' },
    footStyles: { fillColor: COLORS.cashmere, fontStyle: 'bold' },
  });

  yPos = pdf.lastAutoTable.finalY + 12;

  // Edge Banding Requirements
  pdf.setFontSize(11);
  pdf.setFont(fontFamily, 'bold');
  pdf.text('EDGE BANDING REQUIREMENTS', margin, yPos);

  const edgeData = Object.entries(edgeBandingTotals).map(([type, length]) => [
    type,
    `${(length / 1000).toFixed(2)} m`,
  ]);

  if (edgeData.length > 0) {
    autoTable(pdf, {
      startY: yPos + 4,
      margin: { left: margin, right: margin },
      tableWidth: 100,
      head: [['Type', 'Total Length']],
      body: edgeData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: COLORS.subheader, textColor: '#ffffff' },
    });
    yPos = pdf.lastAutoTable.finalY + 12;
  } else {
    pdf.setFontSize(9);
    pdf.setFont(fontFamily, 'normal');
    pdf.text('No edge banding data available', margin, yPos + 8);
    yPos += 16;
  }

  // Panel Count Summary
  pdf.setFontSize(11);
  pdf.setFont(fontFamily, 'bold');
  pdf.text('PANEL SUMMARY', margin, yPos);

  const panelCounts = {};
  sheetLayouts.forEach(sheet => {
    sheet.placements.forEach(p => {
      const label = p.label || p.panel.label || p.panel.cabinet || 'Unlabeled';
      panelCounts[label] = (panelCounts[label] || 0) + 1;
    });
  });

  const panelData = Object.entries(panelCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([label, count]) => [label, count.toString()]);

  if (panelData.length > 0) {
    autoTable(pdf, {
      startY: yPos + 4,
      margin: { left: margin, right: margin },
      tableWidth: 100,
      head: [['Panel Label', 'Count']],
      body: panelData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: COLORS.subheader, textColor: '#ffffff' },
    });
  }

  // Footer
  pdf.setFontSize(7);
  pdf.setTextColor('#9E9E9E');
  pdf.text(
    'Generated by Dawin Cutlist Processor | dawin-cutlist-processor.web.app',
    margin,
    pageHeight - 5
  );
};

/**
 * Download optimization PDF
 * @param {Array} sheetLayouts - Sheet layout results
 * @param {Object} projectInfo - Project info
 * @param {HTMLElement} reportElement - Report element
 * @returns {Promise<string>} Filename
 */
export const downloadOptimizationPDF = async (sheetLayouts, projectInfo, reportElement) => {
  const pdf = await generateOptimizationPDF(sheetLayouts, projectInfo, reportElement);
  const fileName = `${projectInfo.code || 'DRAFT'}-CuttingOptimization-${formatDate()}.pdf`;
  pdf.save(fileName);
  return fileName;
};

const formatDate = () => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

export default {
  generateOptimizationPDF,
  downloadOptimizationPDF,
};
