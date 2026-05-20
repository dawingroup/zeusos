/**
 * PDF Font Loader for Outfit Font
 * Loads Outfit font into jsPDF for brand-aligned PDF generation
 */

// Function to load Outfit font from URL and add to jsPDF
export const loadOutfitFont = async (pdf) => {
  try {
    // Load Regular weight
    const regularResponse = await fetch('https://fonts.gstatic.com/s/outfit/v15/QGYyz_MVcBeNP4NjuGObqx1XmO1I4TC1C4E.ttf');
    const regularBuffer = await regularResponse.arrayBuffer();
    const regularBase64 = arrayBufferToBase64(regularBuffer);
    
    // Load Bold weight
    const boldResponse = await fetch('https://fonts.gstatic.com/s/outfit/v15/QGYyz_MVcBeNP4NjuGObqx1XmO1I4deyC4E.ttf');
    const boldBuffer = await boldResponse.arrayBuffer();
    const boldBase64 = arrayBufferToBase64(boldBuffer);
    
    // Add fonts to jsPDF
    pdf.addFileToVFS('Outfit-Regular.ttf', regularBase64);
    pdf.addFont('Outfit-Regular.ttf', 'Outfit', 'normal');
    
    pdf.addFileToVFS('Outfit-Bold.ttf', boldBase64);
    pdf.addFont('Outfit-Bold.ttf', 'Outfit', 'bold');
    
    return true;
  } catch (error) {
    console.warn('Failed to load Outfit font, falling back to Helvetica:', error);
    return false;
  }
};

// Helper function to convert ArrayBuffer to Base64
const arrayBufferToBase64 = (buffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};
