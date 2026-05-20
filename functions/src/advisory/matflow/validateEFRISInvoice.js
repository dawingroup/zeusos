/**
 * EFRIS Invoice Validation Cloud Functions
 * Validates invoices with Uganda Revenue Authority's EFRIS system
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

// Define secrets for EFRIS API
const efrisApiKey = defineSecret('EFRIS_API_KEY');

// EFRIS API Configuration (URA endpoints)
const EFRIS_CONFIG = {
  baseUrl: process.env.EFRIS_API_URL || 'https://efris.ura.go.ug/api/v1',
  timeout: 30000,
};

/**
 * Validate invoice with EFRIS API
 */
exports.validateEFRISInvoice = onCall(
  { secrets: [efrisApiKey] },
  async (request) => {
    // Check authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    const { fdn, sellerTin, invoiceAmount } = request.data;
    
    // Validate FDN format
    const fdnRegex = /^[A-Z0-9]{8}-\d{8}-[A-Z0-9]{4}$/;
    if (!fdnRegex.test(fdn)) {
      return {
        success: false,
        status: 'invalid',
        error: {
          code: 'INVALID_FDN_FORMAT',
          message: 'Invalid Fiscal Document Number format',
        },
        validatedAt: new Date().toISOString(),
      };
    }
    
    try {
      // Check if EFRIS API is configured
      const apiKey = efrisApiKey.value();
      if (!apiKey) {
        // Development/staging mode - simulate validation
        console.log('EFRIS API not configured, using simulation mode');
        return simulateEFRISValidation(fdn, sellerTin, invoiceAmount);
      }
      
      // Make actual EFRIS API call
      const response = await fetch(
        `${EFRIS_CONFIG.baseUrl}/validate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fiscalDocumentNumber: fdn,
            sellerTin,
            expectedAmount: invoiceAmount,
          }),
          signal: AbortSignal.timeout(EFRIS_CONFIG.timeout),
        }
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            status: 'not_found',
            error: {
              code: 'FDN_NOT_FOUND',
              message: 'Fiscal Document Number not found in EFRIS system',
            },
            validatedAt: new Date().toISOString(),
          };
        }
        throw new Error(`EFRIS API error: ${response.status}`);
      }
      
      const data = await response.json();
      return parseEFRISResponse(data);
      
    } catch (error) {
      console.error('EFRIS validation error:', error);
      
      return {
        success: false,
        status: 'invalid',
        error: {
          code: 'EFRIS_ERROR',
          message: error.message || 'Failed to validate with EFRIS',
        },
        validatedAt: new Date().toISOString(),
      };
    }
  }
);

/**
 * Simulate EFRIS validation for development
 */
function simulateEFRISValidation(fdn, sellerTin, invoiceAmount) {
  // Generate deterministic result based on FDN
  const hash = fdn.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // 80% success rate in simulation
  const isValid = hash % 10 < 8;
  
  if (!isValid) {
    return {
      success: false,
      status: 'not_found',
      error: {
        code: 'SIMULATION',
        message: 'Simulated: FDN not found (development mode)',
      },
      validatedAt: new Date().toISOString(),
    };
  }
  
  // Generate simulated invoice data
  const amount = invoiceAmount || Math.round(hash * 1000);
  const vatAmount = Math.round(amount * 0.18 / 1.18);
  const subtotal = amount - vatAmount;
  
  return {
    success: true,
    status: 'valid',
    invoice: {
      fdn,
      invoiceNumber: `INV-${hash.toString().slice(0, 6)}`,
      invoiceDate: new Date().toISOString().split('T')[0],
      invoiceTime: '10:30:00',
      seller: {
        tin: sellerTin || `100${hash.toString().slice(0, 6)}`,
        name: 'Simulated Supplier Ltd',
        tradeName: 'Sim Supplies',
        address: 'Plot 123, Industrial Area, Kampala',
        vatRegistered: true,
      },
      buyer: {
        tin: '1001234567',
        name: 'Project Company Ltd',
      },
      amounts: {
        subtotal,
        vatAmount,
        totalAmount: amount,
        currency: 'UGX',
      },
      items: [
        {
          lineNumber: 1,
          description: 'Construction Materials',
          quantity: 1,
          unitOfMeasure: 'LOT',
          unitPrice: subtotal,
          totalPrice: subtotal,
          vatRate: 18,
          vatAmount,
          vatRateType: 'standard',
        },
      ],
      taxBreakdown: [
        {
          vatRateType: 'standard',
          vatRate: 18,
          taxableAmount: subtotal,
          vatAmount,
        },
      ],
      status: 'normal',
      issuedAt: new Date().toISOString(),
    },
    validatedAt: new Date().toISOString(),
  };
}

/**
 * Parse actual EFRIS API response
 */
function parseEFRISResponse(data) {
  if (data.status === 'success' && data.invoice) {
    return {
      success: true,
      status: 'valid',
      invoice: {
        fdn: data.invoice.fiscalDocumentNumber,
        invoiceNumber: data.invoice.invoiceNumber,
        invoiceDate: data.invoice.invoiceDate,
        invoiceTime: data.invoice.invoiceTime,
        seller: {
          tin: data.invoice.seller.tin,
          name: data.invoice.seller.legalName,
          tradeName: data.invoice.seller.tradeName,
          address: data.invoice.seller.address,
          vatRegistered: data.invoice.seller.isVatRegistered,
        },
        buyer: {
          tin: data.invoice.buyer?.tin,
          name: data.invoice.buyer?.name,
        },
        amounts: {
          subtotal: data.invoice.subtotal,
          vatAmount: data.invoice.vatAmount,
          totalAmount: data.invoice.totalAmount,
          currency: data.invoice.currency || 'UGX',
        },
        items: data.invoice.lineItems?.map((item, idx) => ({
          lineNumber: idx + 1,
          description: item.description,
          quantity: item.quantity,
          unitOfMeasure: item.unit,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          vatRate: item.vatRate,
          vatAmount: item.vatAmount,
          vatRateType: item.vatCategory || 'standard',
        })) || [],
        taxBreakdown: data.invoice.taxBreakdown || [],
        status: data.invoice.documentType || 'normal',
        issuedAt: data.invoice.issuedAt,
      },
      validatedAt: new Date().toISOString(),
    };
  }
  
  return {
    success: false,
    status: data.status || 'invalid',
    error: {
      code: data.errorCode || 'UNKNOWN_ERROR',
      message: data.errorMessage || 'Validation failed',
    },
    validatedAt: new Date().toISOString(),
  };
}

/**
 * Verify supplier TIN with URA
 */
exports.verifySupplierTIN = onCall(
  { secrets: [efrisApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    const { tin } = request.data;
    
    // Validate TIN format (Uganda TIN is 10 digits)
    if (!/^\d{10}$/.test(tin)) {
      return null;
    }
    
    try {
      // Check if EFRIS API is configured
      const apiKey = efrisApiKey.value();
      if (!apiKey) {
        // Development mode simulation
        const hash = tin.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        
        return {
          supplierId: tin,
          tin,
          tradeName: `Simulated Company ${tin.slice(-4)}`,
          legalName: `Simulated Company ${tin.slice(-4)} Ltd`,
          vatRegistered: hash % 3 !== 0,
          taxStatus: hash % 5 === 0 ? 'suspended' : 'active',
          lastVerified: new Date().toISOString(),
          verificationHistory: [{
            verifiedAt: new Date().toISOString(),
            status: 'active',
            vatRegistered: true,
            source: 'efris',
          }],
        };
      }
      
      // Make actual URA API call
      const response = await fetch(
        `${EFRIS_CONFIG.baseUrl}/taxpayer/${tin}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          signal: AbortSignal.timeout(EFRIS_CONFIG.timeout),
        }
      );
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      
      return {
        supplierId: tin,
        tin: data.tin,
        tradeName: data.tradeName,
        legalName: data.legalName,
        vatRegistered: data.isVatRegistered,
        taxStatus: data.status,
        registrationDate: data.registrationDate,
        lastVerified: new Date().toISOString(),
        verificationHistory: [{
          verifiedAt: new Date().toISOString(),
          status: data.status,
          vatRegistered: data.isVatRegistered,
          source: 'efris',
        }],
      };
      
    } catch (error) {
      console.error('TIN verification error:', error);
      return null;
    }
  }
);

module.exports = {
  validateEFRISInvoice: exports.validateEFRISInvoice,
  verifySupplierTIN: exports.verifySupplierTIN,
};
