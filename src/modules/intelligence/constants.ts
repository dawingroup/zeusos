// ============================================================================
// MARKET INTELLIGENCE CONSTANTS
// DawinOS v2.0 - Market Intelligence Module
// Module constants and configuration
// ============================================================================

// Module branding
export const MODULE_COLOR = '#FF5722';
export const MODULE_COLOR_LIGHT = '#FF8A50';
export const MODULE_COLOR_DARK = '#C41C00';

// Data source types
export const DATA_SOURCES = [
  { id: 'news', label: 'News', color: '#2196f3' },
  { id: 'social', label: 'Social Media', color: '#1DA1F2' },
  { id: 'financial', label: 'Financial Reports', color: '#4caf50' },
  { id: 'regulatory', label: 'Regulatory Filings', color: '#9c27b0' },
  { id: 'industry', label: 'Industry Reports', color: '#ff9800' },
  { id: 'internal', label: 'Internal Research', color: '#e91e63' },
  { id: 'api', label: 'API Feed', color: '#607d8b' },
] as const;

export type DataSourceType = typeof DATA_SOURCES[number]['id'];

// Sentiment levels
export const SENTIMENT_LEVELS = [
  { id: 'very_positive', label: 'Very Positive', color: '#2e7d32', score: 2 },
  { id: 'positive', label: 'Positive', color: '#4caf50', score: 1 },
  { id: 'neutral', label: 'Neutral', color: '#9e9e9e', score: 0 },
  { id: 'negative', label: 'Negative', color: '#f44336', score: -1 },
  { id: 'very_negative', label: 'Very Negative', color: '#c62828', score: -2 },
] as const;

export type SentimentLevel = typeof SENTIMENT_LEVELS[number]['id'];

// Confidence levels
export const CONFIDENCE_LEVELS = [
  { id: 'high', label: 'High Confidence', color: '#4caf50', minScore: 0.8 },
  { id: 'medium', label: 'Medium Confidence', color: '#ff9800', minScore: 0.5 },
  { id: 'low', label: 'Low Confidence', color: '#f44336', minScore: 0 },
] as const;

export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[number]['id'];

// Trend directions
export const TREND_DIRECTIONS = [
  { id: 'strong_up', label: 'Strong Upward', color: '#2e7d32' },
  { id: 'up', label: 'Upward', color: '#4caf50' },
  { id: 'flat', label: 'Flat', color: '#9e9e9e' },
  { id: 'down', label: 'Downward', color: '#f44336' },
  { id: 'strong_down', label: 'Strong Downward', color: '#c62828' },
] as const;

export type TrendDirection = typeof TREND_DIRECTIONS[number]['id'];

// Competitor threat levels
export const THREAT_LEVELS = [
  { id: 'critical', label: 'Critical', color: '#c62828', priority: 1 },
  { id: 'high', label: 'High', color: '#f44336', priority: 2 },
  { id: 'medium', label: 'Medium', color: '#ff9800', priority: 3 },
  { id: 'low', label: 'Low', color: '#4caf50', priority: 4 },
  { id: 'minimal', label: 'Minimal', color: '#9e9e9e', priority: 5 },
] as const;

export type ThreatLevel = typeof THREAT_LEVELS[number]['id'];

// Industry sectors relevant to Uganda/East Africa
export const INDUSTRY_SECTORS = [
  { id: 'agriculture', label: 'Agriculture & Agribusiness' },
  { id: 'banking', label: 'Banking & Financial Services' },
  { id: 'construction', label: 'Construction & Real Estate' },
  { id: 'education', label: 'Education & Training' },
  { id: 'energy', label: 'Energy & Utilities' },
  { id: 'healthcare', label: 'Healthcare & Pharmaceuticals' },
  { id: 'hospitality', label: 'Hospitality & Tourism' },
  { id: 'manufacturing', label: 'Manufacturing' },
  { id: 'mining', label: 'Mining & Extractives' },
  { id: 'retail', label: 'Retail & Consumer Goods' },
  { id: 'technology', label: 'Technology & Telecommunications' },
  { id: 'transport', label: 'Transport & Logistics' },
  { id: 'fintech', label: 'Fintech' },
  { id: 'agritech', label: 'Agritech' },
  { id: 'healthtech', label: 'Healthtech' },
] as const;

// News categories
export const NEWS_CATEGORIES = [
  { id: 'market_update', label: 'Market Update' },
  { id: 'competitor_news', label: 'Competitor News' },
  { id: 'regulatory', label: 'Regulatory & Policy' },
  { id: 'technology', label: 'Technology & Innovation' },
  { id: 'funding', label: 'Funding & Investment' },
  { id: 'partnerships', label: 'Partnerships & M&A' },
  { id: 'leadership', label: 'Leadership & People' },
  { id: 'product_launch', label: 'Product Launch' },
  { id: 'economic', label: 'Economic News' },
  { id: 'industry_report', label: 'Industry Report' },
] as const;

// Insight types
export const INSIGHT_TYPES = [
  { id: 'opportunity', label: 'Opportunity', color: '#4caf50' },
  { id: 'threat', label: 'Threat', color: '#f44336' },
  { id: 'trend', label: 'Trend', color: '#2196f3' },
  { id: 'anomaly', label: 'Anomaly', color: '#ff9800' },
  { id: 'recommendation', label: 'Recommendation', color: '#9c27b0' },
] as const;

export type InsightType = typeof INSIGHT_TYPES[number]['id'];

// Uganda-specific economic indicators
export const UGANDA_INDICATORS = [
  { key: 'gdp_growth', label: 'GDP Growth Rate', unit: '%' },
  { key: 'inflation', label: 'Inflation Rate', unit: '%' },
  { key: 'interest_rate', label: 'Central Bank Rate', unit: '%' },
  { key: 'exchange_rate', label: 'USD/UGX Rate', unit: 'UGX' },
  { key: 'trade_balance', label: 'Trade Balance', unit: 'USD M' },
  { key: 'fdi', label: 'Foreign Direct Investment', unit: 'USD M' },
] as const;
