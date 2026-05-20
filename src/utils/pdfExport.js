import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Export optimization report to PDF
 * @param {HTMLElement} reportElement - The report element to capture
 * @param {string} projectCode - Project code for filename
 * @returns {Promise<void>}
 */
export const exportOptimizationPDF = async (reportElement, projectCode = 'UNKNOWN') => {
  if (!reportElement) {
    console.error('No report element provided');
    return;
  }

  try {
    // Show loading state
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'pdf-loading';
    loadingDiv.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;
    loadingDiv.innerHTML = `
      <div style="background: white; padding: 24px 48px; border-radius: 8px; text-align: center;">
        <div style="margin-bottom: 12px;">Generating PDF...</div>
        <div style="width: 40px; height: 40px; border: 3px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
      </div>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;
    document.body.appendChild(loadingDiv);

    // Capture the report element
    const canvas = await html2canvas(reportElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: reportElement.scrollWidth,
      windowHeight: reportElement.scrollHeight
    });

    // Calculate dimensions
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Add image to PDF (handle multi-page if needed)
    let heightLeft = imgHeight;
    let position = 0;
    
    // First page
    pdf.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      0,
      position,
      imgWidth,
      imgHeight
    );
    heightLeft -= pageHeight;
    
    // Additional pages if content is longer than one page
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        0,
        position,
        imgWidth,
        imgHeight
      );
      heightLeft -= pageHeight;
    }

    // Generate filename
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `${projectCode}-CuttingOptimization-${dateStr}-${timeStr}.pdf`;

    // Save the PDF
    pdf.save(filename);

    // Remove loading state
    document.body.removeChild(loadingDiv);

    return filename;
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    
    // Remove loading state if it exists
    const loadingDiv = document.getElementById('pdf-loading');
    if (loadingDiv) {
      document.body.removeChild(loadingDiv);
    }
    
    throw error;
  }
};

/**
 * Format date for filename
 * @returns {string} Formatted date string
 */
export const formatDate = () => {
  const date = new Date();
  return date.toISOString().split('T')[0];
};

export default {
  exportOptimizationPDF,
  formatDate
};
