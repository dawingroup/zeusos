-- ============================================================================
-- SOCIAL INTELLIGENCE - BigQuery Schema
-- DawinOS v2.0 - Market Intelligence Module
-- Dataset: social_intelligence
-- ============================================================================

-- Create dataset (run manually or via gcloud CLI):
-- bq mk --dataset --location=US dawinos:social_intelligence

-- ============================================================================
-- 1. RAW POSTS — Individual social media posts with metrics
-- Partitioned by published_at for efficient time-range queries
-- Clustered by competitor_id, platform for fast filtering
-- ============================================================================
CREATE TABLE IF NOT EXISTS `social_intelligence.raw_posts` (
  post_id STRING NOT NULL,
  competitor_id STRING NOT NULL,
  profile_id STRING NOT NULL,
  platform STRING NOT NULL,  -- instagram, twitter, tiktok, facebook, linkedin, youtube

  -- Content
  content_text STRING,
  content_type STRING,       -- text, image, video, carousel, reel, story
  media_urls ARRAY<STRING>,
  hashtags ARRAY<STRING>,
  mentions ARRAY<STRING>,
  external_url STRING,

  -- Metrics (at time of capture)
  likes INT64 DEFAULT 0,
  comments INT64 DEFAULT 0,
  shares INT64 DEFAULT 0,
  views INT64 DEFAULT 0,
  saves INT64 DEFAULT 0,
  engagement_rate FLOAT64,

  -- AI Analysis (populated by Gemini)
  ai_strategy STRING,        -- Educational, Promotional, FOMO, Brand-Building, Community
  ai_tone STRING,            -- Professional, Casual, Aggressive, Inspirational, Sarcastic
  ai_target_audience STRING,
  ai_sentiment FLOAT64,      -- -1.0 to 1.0
  ai_summary STRING,
  ai_strategic_pillars ARRAY<STRING>,
  ai_analyzed_at TIMESTAMP,

  -- Metadata
  published_at TIMESTAMP NOT NULL,
  captured_at TIMESTAMP NOT NULL,
  source STRING DEFAULT 'apify',
)
PARTITION BY DATE(published_at)
CLUSTER BY competitor_id, platform;

-- ============================================================================
-- 2. ACCOUNT METRICS — Time-series account-level stats
-- Partitioned by captured_at for trend analysis
-- ============================================================================
CREATE TABLE IF NOT EXISTS `social_intelligence.account_metrics` (
  metric_id STRING NOT NULL,
  competitor_id STRING NOT NULL,
  profile_id STRING NOT NULL,
  platform STRING NOT NULL,
  profile_handle STRING,

  -- Account Metrics
  followers INT64 DEFAULT 0,
  `following` INT64 DEFAULT 0,
  total_posts INT64 DEFAULT 0,
  engagement_rate FLOAT64,
  avg_likes_per_post FLOAT64,
  avg_comments_per_post FLOAT64,
  avg_shares_per_post FLOAT64,
  avg_views_per_post FLOAT64,

  -- Growth (delta from previous capture)
  followers_delta INT64 DEFAULT 0,
  following_delta INT64 DEFAULT 0,
  posts_delta INT64 DEFAULT 0,

  -- Metadata
  captured_at TIMESTAMP NOT NULL,
  source STRING DEFAULT 'apify',
)
PARTITION BY DATE(captured_at)
CLUSTER BY competitor_id, platform;

-- ============================================================================
-- 3. COMPETITOR PROFILES — Denormalized competitor info for joins
-- ============================================================================
CREATE TABLE IF NOT EXISTS `social_intelligence.competitor_profiles` (
  competitor_id STRING NOT NULL,
  name STRING NOT NULL,
  legal_name STRING,
  description STRING,
  website STRING,
  competitor_type STRING,    -- direct, indirect, emerging
  threat_level STRING,       -- critical, high, moderate, low
  industries ARRAY<STRING>,
  headquarters_city STRING,
  headquarters_country STRING,
  company_size STRING,

  -- Social Presence Summary
  tracked_platforms ARRAY<STRING>,
  total_social_followers INT64 DEFAULT 0,
  avg_engagement_rate FLOAT64,
  social_score FLOAT64,      -- 0-100 composite score

  -- Metadata
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
);

-- ============================================================================
-- USEFUL VIEWS
-- ============================================================================

-- Top performing posts across all competitors
CREATE OR REPLACE VIEW `social_intelligence.top_posts_last_30d` AS
SELECT
  p.competitor_id,
  cp.name AS competitor_name,
  p.platform,
  p.content_text,
  p.content_type,
  p.likes,
  p.comments,
  p.shares,
  p.views,
  p.engagement_rate,
  p.ai_strategy,
  p.ai_tone,
  p.published_at
FROM `social_intelligence.raw_posts` p
LEFT JOIN `social_intelligence.competitor_profiles` cp
  ON p.competitor_id = cp.competitor_id
WHERE p.published_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
ORDER BY p.engagement_rate DESC;

-- Follower growth trends
CREATE OR REPLACE VIEW `social_intelligence.follower_trends` AS
SELECT
  am.competitor_id,
  cp.name AS competitor_name,
  am.platform,
  am.profile_handle,
  am.followers,
  am.followers_delta,
  am.engagement_rate,
  am.captured_at
FROM `social_intelligence.account_metrics` am
LEFT JOIN `social_intelligence.competitor_profiles` cp
  ON am.competitor_id = cp.competitor_id
ORDER BY am.captured_at DESC;
