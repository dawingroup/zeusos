/**
 * Adobe PDF Services Test Script
 *
 * Run from browser console or as a component to test the integration.
 * Make sure you're authenticated before running.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';

// Test: Compress a small PDF from URL
export async function testAdobeCompressPdf() {
  const functions = getFunctions(getApp());
  const compressPdf = httpsCallable(functions, 'adobeCompressPdf');

  // Using a small sample PDF from Adobe's own samples
  const testPdfUrl = 'https://documentcloud.adobe.com/view-sdk-demo/PDFs/Bodea%20Brochure.pdf';

  console.log('Testing Adobe PDF Compress...');
  console.log('Input URL:', testPdfUrl);

  try {
    const result = await compressPdf({
      input: {
        type: 'url',
        value: testPdfUrl,
      },
      compressionLevel: 'medium',
    });

    console.log('Result:', result.data);
    return result.data;
  } catch (error: unknown) {
    console.error('Error:', error);
    throw error;
  }
}

// Test: Extract text from PDF
export async function testAdobeExtractPdf() {
  const functions = getFunctions(getApp());
  const extractPdf = httpsCallable(functions, 'adobeExtractPdf');

  const testPdfUrl = 'https://documentcloud.adobe.com/view-sdk-demo/PDFs/Bodea%20Brochure.pdf';

  console.log('Testing Adobe PDF Extract...');
  console.log('Input URL:', testPdfUrl);

  try {
    const result = await extractPdf({
      input: {
        type: 'url',
        value: testPdfUrl,
      },
      elementsToExtract: ['text', 'tables'],
    });

    console.log('Extraction Result:', result.data);
    return result.data;
  } catch (error: unknown) {
    console.error('Error:', error);
    throw error;
  }
}

// Quick connectivity test - just checks if function can authenticate with Adobe
export async function testAdobeConnectivity() {
  const functions = getFunctions(getApp());
  const createPdf = httpsCallable(functions, 'adobeCreatePdf');

  console.log('Testing Adobe API connectivity...');

  try {
    // This will fail with "input required" but will test auth first
    await createPdf({});
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.message?.includes('Input file reference required')) {
      console.log('✅ Adobe API connectivity OK - function is responding correctly');
      return { success: true, message: 'Adobe API connectivity verified' };
    }
    if (err.message?.includes('Adobe OAuth token request failed')) {
      console.error('❌ Adobe authentication failed - check credentials');
      throw new Error('Adobe authentication failed');
    }
    throw error;
  }
}

// Run all tests
export async function runAllAdobeTests() {
  console.log('=== Adobe PDF Services Integration Tests ===\n');

  try {
    // Test 1: Connectivity
    console.log('1. Testing connectivity...');
    await testAdobeConnectivity();
    console.log('');

    // Test 2: Compress (simpler operation)
    console.log('2. Testing PDF compression...');
    const compressResult = await testAdobeCompressPdf();
    if (compressResult) {
      console.log('✅ Compression successful');
      console.log(`   Original size: ${(compressResult as { originalSize?: number }).originalSize} bytes`);
      console.log(`   Compressed size: ${(compressResult as { compressedSize?: number }).compressedSize} bytes`);
    }
    console.log('');

    // Test 3: Extract
    console.log('3. Testing PDF extraction...');
    const extractResult = await testAdobeExtractPdf();
    if (extractResult) {
      console.log('✅ Extraction successful');
    }

    console.log('\n=== All tests passed! ===');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}
