import { describe, expect, it } from 'vitest';
import {
  PORTRAIT_LAYOUT_EDGE_ROTATION_QUARTER_TURNS,
  remapEdgeBandingForPlacement,
  remapEdgeOperationsForPlacement,
  rotateEdgeBandingQuarterTurns,
} from '../edgeBandingOrientation';

type TravellerEdgeMarks = {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
};

function toTravellerEdgeMarks(
  edgeBanding: TravellerEdgeMarks | undefined
): TravellerEdgeMarks {
  return {
    top: !!edgeBanding?.top,
    bottom: !!edgeBanding?.bottom,
    left: !!edgeBanding?.left,
    right: !!edgeBanding?.right,
  };
}

describe('edge banding flow to shop traveller marks', () => {
  it('moves original length-side edging to width side in quarter-turn placement', () => {
    // Original part has edge only on TOP (a length-side edge in source orientation).
    const sourceEdgeBanding = {
      top: true,
      bottom: false,
      left: false,
      right: false,
    };

    // In persisted nesting data, `rotated=false` is the quarter-turn placement orientation.
    const placedEdgeBanding = remapEdgeBandingForPlacement(sourceEdgeBanding, false);

    // PDF traveller uses placed-orientation side booleans.
    const travellerMarks = toTravellerEdgeMarks(placedEdgeBanding);

    expect(travellerMarks).toEqual({
      top: false,
      bottom: false,
      left: false,
      right: true,
    });
  });

  it('keeps integrity through placement + portrait-layout rotation', () => {
    const sourceEdgeBanding = {
      top: true,
      bottom: false,
      left: false,
      right: false,
    };

    const placedEdgeBanding = remapEdgeBandingForPlacement(sourceEdgeBanding, false);
    const portraitDisplayBanding = rotateEdgeBandingQuarterTurns(
      placedEdgeBanding,
      PORTRAIT_LAYOUT_EDGE_ROTATION_QUARTER_TURNS
    );
    const travellerMarks = toTravellerEdgeMarks(portraitDisplayBanding);

    expect(travellerMarks).toEqual({
      top: false,
      bottom: true,
      left: false,
      right: false,
    });
  });

  it('maps placed top edge to display right for portrait sheet transform', () => {
    const placedEdgeBanding = {
      top: true,
      right: false,
      bottom: false,
      left: false,
    };

    const portraitDisplayBanding = rotateEdgeBandingQuarterTurns(
      placedEdgeBanding,
      PORTRAIT_LAYOUT_EDGE_ROTATION_QUARTER_TURNS
    );

    expect(toTravellerEdgeMarks(portraitDisplayBanding)).toEqual({
      top: false,
      right: true,
      bottom: false,
      left: false,
    });
  });

  it('keeps side-bound operations aligned through rotations', () => {
    const sourceOps = {
      top: [{ type: 'grooving' as const, depthMm: 6 }],
    };

    const placedOps = remapEdgeOperationsForPlacement(sourceOps, false);
    const portraitDisplayOps = remapEdgeOperationsForPlacement(placedOps, false);

    expect(portraitDisplayOps).toEqual({
      bottom: [{ type: 'grooving', depthMm: 6 }],
    });
  });
});
