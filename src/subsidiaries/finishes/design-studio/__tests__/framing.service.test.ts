/**
 * Framing Service Tests — pure math validation
 */
import { describe, it, expect } from 'vitest';
import {
  directionFromAzimuthElevation,
  computePoseForSubject,
  interpolatePose,
  clampDistance,
  getPresetForSubject,
} from '../services/framing.service';
import type { BoundingSphere, CameraPose, CameraSubject } from '../types/framing.types';
import { FRAMING_PADDING, PERSPECTIVE_FOV_DEGREES } from '../constants/framing.constants';

describe('framing.service', () => {
  describe('directionFromAzimuthElevation', () => {
    it('azimuth 0 elevation 0 points along -Z (north-facing default)', () => {
      const d = directionFromAzimuthElevation(0, 0);
      expect(d.x).toBeCloseTo(0, 5);
      expect(d.y).toBeCloseTo(0, 5);
      expect(d.z).toBeCloseTo(-1, 5);
    });

    it('azimuth 90 elevation 0 points along +X (east)', () => {
      const d = directionFromAzimuthElevation(90, 0);
      expect(d.x).toBeCloseTo(1, 5);
      expect(d.y).toBeCloseTo(0, 5);
      expect(d.z).toBeCloseTo(0, 5);
    });

    it('elevation 90 points straight up (+Y)', () => {
      const d = directionFromAzimuthElevation(0, 90);
      expect(d.x).toBeCloseTo(0, 5);
      expect(d.y).toBeCloseTo(1, 5);
      expect(d.z).toBeCloseTo(0, 5);
    });

    it('elevation -90 points straight down (-Y)', () => {
      const d = directionFromAzimuthElevation(0, -90);
      expect(d.y).toBeCloseTo(-1, 5);
    });

    it('iso_ne (azimuth 45 elevation 35) produces unit vector', () => {
      const d = directionFromAzimuthElevation(45, 35);
      const mag = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
      expect(mag).toBeCloseTo(1, 5);
    });
  });

  describe('computePoseForSubject', () => {
    const bounds: BoundingSphere = {
      center: { x: 0, y: 0, z: 0 },
      radius: 300,  // 600mm diameter cube bounding sphere
    };

    it('perspective distance matches formula: radius / sin(fov/2) * padding', () => {
      const pose = computePoseForSubject(bounds, 'iso_ne', 1.0);
      const halfFovRad = (PERSPECTIVE_FOV_DEGREES / 2) * (Math.PI / 180);
      const expected = (bounds.radius / Math.sin(halfFovRad)) * FRAMING_PADDING;

      const dx = pose.position.x - pose.target.x;
      const dy = pose.position.y - pose.target.y;
      const dz = pose.position.z - pose.target.z;
      const actual = Math.sqrt(dx * dx + dy * dy + dz * dz);

      expect(actual).toBeCloseTo(expected, 0); // ±1mm
    });

    it('orthographic orthoSize = radius * padding', () => {
      const pose = computePoseForSubject(bounds, 'front', 1.0);
      expect(pose.projection).toBe('orthographic');
      expect(pose.orthoSize).toBeCloseTo(bounds.radius * FRAMING_PADDING, 2);
    });

    it('target equals bounds center', () => {
      const offBounds: BoundingSphere = {
        center: { x: 1000, y: 500, z: -2000 },
        radius: 300,
      };
      const pose = computePoseForSubject(offBounds, 'iso_ne', 1.0);
      expect(pose.target.x).toBe(1000);
      expect(pose.target.y).toBe(500);
      expect(pose.target.z).toBe(-2000);
    });

    it('top preset looks down (position Y > target Y)', () => {
      const pose = computePoseForSubject(bounds, 'top', 1.0);
      expect(pose.position.y).toBeGreaterThan(pose.target.y);
    });

    it('front preset faces -Z', () => {
      const pose = computePoseForSubject(bounds, 'front', 1.0);
      expect(pose.position.z).toBeLessThan(pose.target.z);
    });
  });

  describe('interpolatePose', () => {
    const from: CameraPose = {
      position: { x: 0, y: 0, z: 0 },
      target: { x: 0, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      projection: 'perspective', fov: 35, near: 1, far: 1000,
    };
    const to: CameraPose = {
      position: { x: 100, y: 200, z: 300 },
      target: { x: 10, y: 20, z: 30 },
      up: { x: 0, y: 1, z: 0 },
      projection: 'perspective', fov: 40, near: 10, far: 10000,
    };

    it('t=0 returns from-pose', () => {
      const r = interpolatePose(from, to, 0);
      expect(r.position).toEqual(from.position);
      expect(r.target).toEqual(from.target);
    });

    it('t=1 returns to-pose', () => {
      const r = interpolatePose(from, to, 1);
      expect(r.position.x).toBeCloseTo(to.position.x);
      expect(r.position.y).toBeCloseTo(to.position.y);
    });

    it('t=0.5 returns midpoint', () => {
      const r = interpolatePose(from, to, 0.5);
      expect(r.position.x).toBeCloseTo(50);
      expect(r.position.y).toBeCloseTo(100);
      expect(r.position.z).toBeCloseTo(150);
      expect(r.target.x).toBeCloseTo(5);
    });

    it('clamps t outside [0,1]', () => {
      const rBelow = interpolatePose(from, to, -0.5);
      expect(rBelow.position).toEqual(from.position);
      const rAbove = interpolatePose(from, to, 1.5);
      expect(rAbove.position.x).toBeCloseTo(to.position.x);
    });

    it('perspective→orthographic swap happens at t=0.5', () => {
      const orthoTo: CameraPose = { ...to, projection: 'orthographic', orthoSize: 500 };
      const below = interpolatePose(from, orthoTo, 0.4);
      const above = interpolatePose(from, orthoTo, 0.6);
      expect(below.projection).toBe('perspective');
      expect(above.projection).toBe('orthographic');
    });
  });

  describe('clampDistance', () => {
    const pose: CameraPose = {
      position: { x: 1000, y: 0, z: 0 },
      target: { x: 0, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      projection: 'perspective', near: 1, far: 10000,
    };

    it('leaves pose unchanged when distance is within range', () => {
      const r = clampDistance(pose, 100, 5000);
      expect(r.position.x).toBe(1000);
    });

    it('pushes camera out when too close', () => {
      const r = clampDistance(pose, 2000, 10000);
      expect(r.position.x).toBeCloseTo(2000);
    });

    it('pulls camera in when too far', () => {
      const r = clampDistance(pose, 100, 500);
      expect(r.position.x).toBeCloseTo(500);
    });
  });

  describe('getPresetForSubject', () => {
    it('returns subject.preferredViewPreset if set', () => {
      const subject: CameraSubject = {
        type: 'cabinet',
        id: 'c1',
        bounds: { center: { x: 0, y: 0, z: 0 }, radius: 300 },
        preferredViewPreset: 'front',
      };
      expect(getPresetForSubject(subject, 'iso_ne')).toBe('front');
    });

    it('returns default when no preferred', () => {
      const subject: CameraSubject = {
        type: 'cabinet',
        id: 'c1',
        bounds: { center: { x: 0, y: 0, z: 0 }, radius: 300 },
      };
      expect(getPresetForSubject(subject, 'iso_ne')).toBe('iso_ne');
    });
  });
});
