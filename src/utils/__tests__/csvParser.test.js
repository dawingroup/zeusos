import { expandMultiPartLabels, arePartsIdentical, groupIdenticalParts, parseCSV } from '../csvParser';

describe('expandMultiPartLabels', () => {
  test('splits comma-separated labels', () => {
    const rows = [{ label: 'Door_Left, Door_Right', material: 'MDF', length: 600, width: 400 }];
    const result = expandMultiPartLabels(rows);
    
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('Door_Left');
    expect(result[1].label).toBe('Door_Right');
    expect(result[0].material).toBe('MDF');
    expect(result[1].material).toBe('MDF');
  });
  
  test('generates unique part IDs', () => {
    const rows = [{ cabinet: 'BC01', label: 'Shelf_1, Shelf_2', material: 'MDF', length: 600, width: 400 }];
    const result = expandMultiPartLabels(rows);
    
    expect(result[0].partId).toBe('BC01_SHELF_1_01');
    expect(result[1].partId).toBe('BC01_SHELF_2_02');
  });
  
  test('preserves single labels unchanged', () => {
    const rows = [{ label: 'Single_Part', material: 'MDF', length: 600, width: 400 }];
    const result = expandMultiPartLabels(rows);
    
    expect(result).toHaveLength(1);
    expect(result[0]._isSplit).toBe(false);
  });
  
  test('handles labels with extra whitespace', () => {
    const rows = [{ label: 'Part_A,  Part_B  , Part_C', material: 'MDF', length: 600, width: 400 }];
    const result = expandMultiPartLabels(rows);
    
    expect(result).toHaveLength(3);
    expect(result[0].label).toBe('Part_A');
    expect(result[1].label).toBe('Part_B');
    expect(result[2].label).toBe('Part_C');
  });

  test('tracks split metadata correctly', () => {
    const rows = [{ label: 'A, B, C', material: 'MDF', length: 600, width: 400 }];
    const result = expandMultiPartLabels(rows);
    
    expect(result[0]._isSplit).toBe(true);
    expect(result[0]._splitFrom).toBe('A, B, C');
    expect(result[0]._splitCount).toBe(3);
    expect(result[0]._splitIndex).toBe(1);
    expect(result[2]._splitIndex).toBe(3);
  });
});

describe('arePartsIdentical', () => {
  test('returns true for identical parts', () => {
    const parts = [
      { material: 'MDF', thickness: 18, length: 600, width: 400, grain: 0 },
      { material: 'MDF', thickness: 18, length: 600, width: 400, grain: 0 },
    ];
    expect(arePartsIdentical(parts)).toBe(true);
  });

  test('returns false for different dimensions', () => {
    const parts = [
      { material: 'MDF', thickness: 18, length: 600, width: 400 },
      { material: 'MDF', thickness: 18, length: 650, width: 400 },
    ];
    expect(arePartsIdentical(parts)).toBe(false);
  });

  test('returns false for single part', () => {
    const parts = [{ material: 'MDF', thickness: 18, length: 600, width: 400 }];
    expect(arePartsIdentical(parts)).toBe(false);
  });
});

describe('groupIdenticalParts', () => {
  test('groups parts with identical properties', () => {
    const parts = [
      { label: 'Shelf_1', material: 'MDF', thickness: 18, length: 600, width: 400, quantity: 1 },
      { label: 'Shelf_2', material: 'MDF', thickness: 18, length: 600, width: 400, quantity: 1 },
      { label: 'Shelf_3', material: 'MDF', thickness: 18, length: 600, width: 400, quantity: 1 }
    ];
    const result = groupIdenticalParts(parts, 'Shelf_1, Shelf_2, Shelf_3');
    
    expect(result.label).toBe('Shelf × 3');
    expect(result.quantity).toBe(3);
    expect(result._isGrouped).toBe(true);
  });
  
  test('returns null for non-identical parts', () => {
    const parts = [
      { label: 'Door_L', material: 'MDF', length: 600, width: 400 },
      { label: 'Door_R', material: 'MDF', length: 650, width: 400 }
    ];
    const result = groupIdenticalParts(parts, 'Door_L, Door_R');
    
    expect(result).toBeNull();
  });
});

describe('parseCSV', () => {
  test('parses basic CSV correctly', () => {
    const csv = `cabinet,label,material,thickness,length,width,grain
BC01,Top,MDF,18,600,400,0
BC01,Bottom,MDF,18,600,400,0`;
    
    const result = parseCSV(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].label).toBe('Top');
    expect(result.rows[1].label).toBe('Bottom');
  });

  test('expands multi-part labels by default', () => {
    const csv = `cabinet,label,material,thickness,length,width,grain
BC01,"Left, Right",MDF,18,600,400,0`;
    
    const result = parseCSV(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.stats.splitRows).toBe(2);
  });

  test('can disable multi-part expansion', () => {
    const csv = `cabinet,label,material,thickness,length,width,grain
BC01,"Left, Right",MDF,18,600,400,0`;
    
    const result = parseCSV(csv, { expandMultiPart: false });
    expect(result.rows).toHaveLength(1);
  });
});
