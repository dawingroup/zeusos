/**
 * Type-level + structural sanity tests for INFLUENCER + MODEL talent kinds.
 *
 * These don't hit Firestore — they just verify the type union exposes the
 * new kinds and that the per-kind extension blocks can be constructed
 * without surprises.
 */

import { describe, it, expect } from 'vitest';
import type {
  TalentProfile,
  TalentType,
  InfluencerProfile,
  ModelProfile,
  SocialHandle,
  SocialPlatform,
} from '../types/talent-profile.types';

describe('TalentType', () => {
  it('includes the four expected kinds', () => {
    const kinds: TalentType[] = ['STAFF', 'FREELANCER', 'INFLUENCER', 'MODEL'];
    expect(kinds).toHaveLength(4);
    // Type assertion that every value is valid
    kinds.forEach((k) => {
      const profile: Partial<TalentProfile> = { type: k };
      expect(profile.type).toBe(k);
    });
  });
});

describe('InfluencerProfile', () => {
  it('accepts a minimal influencer profile (just niches)', () => {
    const inf: InfluencerProfile = { niches: ['fashion', 'beauty'] };
    expect(inf.niches).toEqual(['fashion', 'beauty']);
  });

  it('accepts a full influencer profile with rate card + demographics', () => {
    const inf: InfluencerProfile = {
      niches: ['lifestyle'],
      totalFollowerCount: 250_000,
      audienceDemographics: {
        primaryCountry: 'UG',
        primaryAgeBracket: '18-24',
        audienceSplit: { female: 0.62, male: 0.36, nonBinary: 0.02 },
        languages: ['English', 'Luganda'],
      },
      rateCard: {
        postRateMinor: 2_500_000_00,
        storyRateMinor:   800_000_00,
        reelRateMinor:  3_500_000_00,
        bundleRateMinor: 6_000_000_00,
      },
      managerContact: {
        name: 'Sara Manager',
        email: 'sara@agency.test',
        agency: 'Talent Co.',
      },
    };
    expect(inf.totalFollowerCount).toBe(250_000);
    expect(inf.rateCard?.postRateMinor).toBe(2_500_000_00);
    expect(inf.audienceDemographics?.audienceSplit?.female).toBeCloseTo(0.62, 2);
  });

  it('audienceSplit fractions can sum to ~1 (not enforced; documentation only)', () => {
    const inf: InfluencerProfile = {
      audienceDemographics: { audienceSplit: { female: 0.5, male: 0.5 } },
    };
    const split = inf.audienceDemographics!.audienceSplit!;
    const total = (split.female ?? 0) + (split.male ?? 0) + (split.nonBinary ?? 0);
    expect(total).toBeCloseTo(1, 2);
  });
});

describe('SocialHandle', () => {
  it('builds a handle with full metrics', () => {
    const h: SocialHandle = {
      platform: 'INSTAGRAM' satisfies SocialPlatform,
      handle: '@beats_by_zee',
      url: 'https://instagram.com/beats_by_zee',
      followerCount: 125_000,
      monthlyReach: 800_000,
      engagementRate: 0.038,
      lastVerifiedAt: '2026-05-01',
    };
    expect(h.platform).toBe('INSTAGRAM');
    expect(h.engagementRate).toBeCloseTo(0.038, 3);
  });

  it('platform union includes all current channels', () => {
    const platforms: SocialPlatform[] = [
      'INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'TWITTER_X',
      'FACEBOOK', 'LINKEDIN', 'TWITCH', 'SNAPCHAT',
    ];
    expect(platforms).toHaveLength(8);
  });
});

describe('ModelProfile', () => {
  it('accepts a model profile with agency + attributes + rate card', () => {
    const m: ModelProfile = {
      agency: { name: 'Equator Models', contactEmail: 'casting@equator.test' },
      attributes: {
        heightCm: 178,
        bustCm: 86,
        waistCm: 64,
        hipsCm: 92,
        shoeSize: 'UK 7',
        hairColor: 'Black',
        eyeColor: 'Brown',
      },
      specialties: ['editorial', 'runway', 'commercial'],
      languages: ['English'],
      rateCard: {
        halfDayRateMinor:    600_000_00,
        fullDayRateMinor:  1_100_000_00,
        usage12mRateMinor: 5_000_000_00,
      },
    };
    expect(m.agency?.name).toBe('Equator Models');
    expect(m.attributes?.heightCm).toBe(178);
    expect(m.specialties).toContain('runway');
  });

  it('attributes block can be partial (e.g. only height)', () => {
    const m: ModelProfile = { attributes: { heightCm: 175 } };
    expect(m.attributes?.heightCm).toBe(175);
    expect(m.attributes?.waistCm).toBeUndefined();
  });
});

describe('TalentProfile structural compatibility', () => {
  it('a STAFF profile remains valid without kind-specific blocks', () => {
    const p: TalentProfile = {
      id: 't1',
      name: 'Joan Atimango',
      email: 'joan@zeus.test',
      type: 'STAFF',
      roles: ['AM'],
      status: 'ACTIVE',
      createdBy: 'u1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    expect(p.influencerProfile).toBeUndefined();
    expect(p.modelProfile).toBeUndefined();
  });

  it('an INFLUENCER profile can carry both social handles and an influencer block', () => {
    const p: TalentProfile = {
      id: 't2',
      name: 'Beats By Zee',
      email: 'beats@zee.test',
      type: 'INFLUENCER',
      roles: [],
      status: 'ACTIVE',
      socialHandles: [
        { platform: 'INSTAGRAM', handle: '@beats_by_zee', followerCount: 125_000 },
        { platform: 'TIKTOK',    handle: '@beatsbyzee',   followerCount: 80_000 },
      ],
      influencerProfile: {
        niches: ['music', 'lifestyle'],
        totalFollowerCount: 205_000,
      },
      createdBy: 'u1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    expect(p.type).toBe('INFLUENCER');
    expect(p.socialHandles).toHaveLength(2);
    expect(p.influencerProfile?.totalFollowerCount).toBe(205_000);
  });

  it('a MODEL profile carries a model block', () => {
    const p: TalentProfile = {
      id: 't3',
      name: 'Achieng Imani',
      email: 'achieng@models.test',
      type: 'MODEL',
      roles: [],
      status: 'ACTIVE',
      modelProfile: {
        attributes: { heightCm: 180 },
        specialties: ['runway'],
      },
      createdBy: 'u1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    expect(p.type).toBe('MODEL');
    expect(p.modelProfile?.attributes?.heightCm).toBe(180);
  });
});
