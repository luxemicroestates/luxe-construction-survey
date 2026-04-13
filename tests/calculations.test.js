/**
 * Unit tests for calculations.js — the pure business logic of the Site Survey Estimator.
 *
 * Coverage goals
 * ─────────────
 * • Every exported function is tested.
 * • Happy-path values are verified against manually worked examples.
 * • Boundary / edge cases are called out explicitly so regressions are obvious.
 * • Minimum-price enforcement (foundation) and ceiling arithmetic (trenching days)
 *   each get their own describe blocks.
 */

const {
  RATES,
  formatCurrency,
  calculateSetup,
  calculateFoundation,
  calculateElectrical,
  calculateWater,
  calculateSewer,
  calculateSeptic,
  calculateTrenching,
  calculateOther,
  calculateTotals
} = require('../calculations');

// ─── formatCurrency ───────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  test('zero renders as $0.00', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  test('integer under 1,000 has no comma', () => {
    expect(formatCurrency(500)).toBe('$500.00');
  });

  test('exactly 1,000 gets comma separator', () => {
    expect(formatCurrency(1000)).toBe('$1,000.00');
  });

  test('decimal is rounded to two places', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
  });

  test('large amount with two comma groups', () => {
    expect(formatCurrency(12345.67)).toBe('$12,345.67');
  });

  test('six-figure amount', () => {
    expect(formatCurrency(100000)).toBe('$100,000.00');
  });
});

// ─── calculateSetup ───────────────────────────────────────────────────────────

describe('calculateSetup', () => {
  describe('base rates per home size (no trailer)', () => {
    test.each([
      ['20x20', 4000],
      ['20x30', 4500],
      ['20x40', 5000],
      ['8x20',  1500],
      ['8x40',  2000]
    ])('%s → $%i', (size, expected) => {
      expect(calculateSetup(size, false)).toBe(expected);
    });
  });

  describe('trailer premium (+$1,750)', () => {
    test('20x20 with trailer = $4,000 + $1,750 = $5,750', () => {
      expect(calculateSetup('20x20', true)).toBe(5750);
    });

    test('8x40 with trailer = $2,000 + $1,750 = $3,750', () => {
      expect(calculateSetup('8x40', true)).toBe(3750);
    });

    test('trailer premium matches RATES.trailerExtra constant', () => {
      const withTrailer    = calculateSetup('20x30', true);
      const withoutTrailer = calculateSetup('20x30', false);
      expect(withTrailer - withoutTrailer).toBe(RATES.trailerExtra);
    });
  });

  test('unknown size returns 0 (no trailer)', () => {
    expect(calculateSetup('99x99', false)).toBe(0);
  });

  test('unknown size with trailer returns only trailer premium', () => {
    expect(calculateSetup('99x99', true)).toBe(RATES.trailerExtra);
  });
});

// ─── calculateFoundation ──────────────────────────────────────────────────────

describe('calculateFoundation', () => {
  test('type "none" always returns 0', () => {
    expect(calculateFoundation('20x40', 'none')).toBe(0);
    expect(calculateFoundation('8x20',  'none')).toBe(0);
  });

  describe('base pad ($4.50/sq ft, $1,500 minimum)', () => {
    test('20x40 = 800 sq ft × $4.50 = $3,600', () => {
      expect(calculateFoundation('20x40', 'base')).toBe(3600);
    });

    test('20x30 = 600 sq ft × $4.50 = $2,700', () => {
      expect(calculateFoundation('20x30', 'base')).toBe(2700);
    });

    test('20x20 = 400 sq ft × $4.50 = $1,800 (above minimum)', () => {
      expect(calculateFoundation('20x20', 'base')).toBe(1800);
    });

    test('8x40 = 320 sq ft × $4.50 = $1,440 → enforces $1,500 minimum', () => {
      expect(calculateFoundation('8x40', 'base')).toBe(1500);
    });

    test('8x20 = 160 sq ft × $4.50 = $720 → enforces $1,500 minimum', () => {
      expect(calculateFoundation('8x20', 'base')).toBe(1500);
    });

    test('result is never below $1,500', () => {
      const allSizes = Object.keys(RATES.setup);
      allSizes.forEach(size => {
        expect(calculateFoundation(size, 'base')).toBeGreaterThanOrEqual(1500);
      });
    });
  });

  describe('concrete slab ($13.50/sq ft, $2,160 minimum)', () => {
    test('20x40 = 800 sq ft × $13.50 = $10,800', () => {
      expect(calculateFoundation('20x40', 'concrete')).toBe(10800);
    });

    test('20x30 = 600 sq ft × $13.50 = $8,100', () => {
      expect(calculateFoundation('20x30', 'concrete')).toBe(8100);
    });

    test('20x20 = 400 sq ft × $13.50 = $5,400 (above minimum)', () => {
      expect(calculateFoundation('20x20', 'concrete')).toBe(5400);
    });

    test('8x20 = 160 sq ft × $13.50 = $2,160 (exactly at minimum)', () => {
      // Boundary: computed value equals the minimum — must NOT be raised.
      expect(calculateFoundation('8x20', 'concrete')).toBe(2160);
    });

    test('8x40 = 320 sq ft × $13.50 = $4,320 (above minimum)', () => {
      expect(calculateFoundation('8x40', 'concrete')).toBe(4320);
    });

    test('result is never below $2,160', () => {
      const allSizes = Object.keys(RATES.setup);
      allSizes.forEach(size => {
        expect(calculateFoundation(size, 'concrete')).toBeGreaterThanOrEqual(2160);
      });
    });
  });
});

// ─── calculateElectrical ──────────────────────────────────────────────────────

describe('calculateElectrical', () => {
  // Formula: feet × 3 × $10/ft + $950 subpanel
  test('0 feet returns $0 (no charge when not selected)', () => {
    expect(calculateElectrical(0)).toBe(0);
  });

  test('negative footage returns $0', () => {
    expect(calculateElectrical(-50)).toBe(0);
  });

  test('1 ft: 1 × 3 × $10 + $950 = $980', () => {
    expect(calculateElectrical(1)).toBe(980);
  });

  test('50 ft: 50 × 3 × $10 + $950 = $2,450', () => {
    expect(calculateElectrical(50)).toBe(2450);
  });

  test('100 ft: 100 × 3 × $10 + $950 = $3,950', () => {
    expect(calculateElectrical(100)).toBe(3950);
  });

  test('subpanel fee ($950) is always included when footage > 0', () => {
    const atOneFoot = calculateElectrical(1);
    const atTwoFeet = calculateElectrical(2);
    // The difference between 1 ft and 2 ft should be exactly 3 × $10 = $30
    expect(atTwoFeet - atOneFoot).toBe(3 * RATES.electricalPerFoot);
  });
});

// ─── calculateWater ───────────────────────────────────────────────────────────

describe('calculateWater', () => {
  // Formula: feet × $21.62/ft
  test('0 feet returns $0', () => {
    expect(calculateWater(0)).toBe(0);
  });

  test('1 ft = $21.62', () => {
    expect(calculateWater(1)).toBeCloseTo(21.62, 2);
  });

  test('50 ft = $1,081.00', () => {
    expect(calculateWater(50)).toBeCloseTo(1081, 2);
  });

  test('100 ft = $2,162.00', () => {
    expect(calculateWater(100)).toBeCloseTo(2162, 2);
  });

  test('result scales linearly with footage', () => {
    expect(calculateWater(200)).toBeCloseTo(calculateWater(100) * 2, 5);
  });
});

// ─── calculateSewer ───────────────────────────────────────────────────────────

describe('calculateSewer', () => {
  // Formula: feet × $36/ft
  test('0 feet returns $0', () => {
    expect(calculateSewer(0)).toBe(0);
  });

  test('25 ft = $900', () => {
    expect(calculateSewer(25)).toBe(900);
  });

  test('100 ft = $3,600', () => {
    expect(calculateSewer(100)).toBe(3600);
  });

  test('result scales linearly with footage', () => {
    expect(calculateSewer(50)).toBe(calculateSewer(25) * 2);
  });
});

// ─── calculateSeptic ──────────────────────────────────────────────────────────

describe('calculateSeptic', () => {
  describe('base tank costs', () => {
    test('no tank selected (empty string) returns $0', () => {
      expect(calculateSeptic('', 0)).toBe(0);
    });

    test('1,000 gallon tank = $9,750', () => {
      expect(calculateSeptic('1000', 0)).toBe(9750);
    });

    test('1,200 gallon tank = $10,450', () => {
      expect(calculateSeptic('1200', 0)).toBe(10450);
    });

    test('1,500 gallon tank = $11,250', () => {
      expect(calculateSeptic('1500', 0)).toBe(11250);
    });

    test('unrecognised tank size returns $0', () => {
      expect(calculateSeptic('9999', 0)).toBe(0);
    });
  });

  describe('extra leach line ($15/ft)', () => {
    test('0 extra feet adds nothing to tank cost', () => {
      expect(calculateSeptic('1000', 0)).toBe(9750);
    });

    test('1,000 gal + 50 ft extra leach = $9,750 + $750 = $10,500', () => {
      expect(calculateSeptic('1000', 50)).toBe(10500);
    });

    test('1,500 gal + 100 ft extra leach = $11,250 + $1,500 = $12,750', () => {
      expect(calculateSeptic('1500', 100)).toBe(12750);
    });

    test('extra leach line cost scales at $15/ft', () => {
      const base      = calculateSeptic('1200', 0);
      const withExtra = calculateSeptic('1200', 10);
      expect(withExtra - base).toBe(10 * RATES.septic.extraLeachPerFoot);
    });
  });
});

// ─── calculateTrenching ───────────────────────────────────────────────────────

describe('calculateTrenching', () => {
  // Formula: feet × $15/ft  +  ceil(feet / 200) × $400/day

  test('0 feet returns $0', () => {
    expect(calculateTrenching(0)).toBe(0);
  });

  test('negative footage returns $0', () => {
    expect(calculateTrenching(-1)).toBe(0);
  });

  test('1 ft: $15 labour + 1 day × $400 machine = $415', () => {
    expect(calculateTrenching(1)).toBe(415);
  });

  test('100 ft: $1,500 labour + 1 day × $400 = $1,900', () => {
    expect(calculateTrenching(100)).toBe(1900);
  });

  describe('machine-day boundary at 200 ft/day', () => {
    test('exactly 200 ft = 1 day: $3,000 labour + $400 machine = $3,400', () => {
      expect(calculateTrenching(200)).toBe(3400);
    });

    test('201 ft crosses into 2 days: $3,015 labour + $800 machine = $3,815', () => {
      // ceil(201/200) = 2 days
      expect(calculateTrenching(201)).toBe(3815);
    });

    test('400 ft = exactly 2 days: $6,000 labour + $800 machine = $6,800', () => {
      expect(calculateTrenching(400)).toBe(6800);
    });

    test('401 ft = 3 days: $6,015 labour + $1,200 machine = $7,215', () => {
      expect(calculateTrenching(401)).toBe(7215);
    });
  });

  test('machine rental scales with number of days', () => {
    const oneDayJob   = calculateTrenching(200);
    const twoDayJob   = calculateTrenching(400);
    const threeDayJob = calculateTrenching(600);
    // Machine delta per additional 200 ft should be $400
    expect(twoDayJob   - oneDayJob).toBe(200 * RATES.trenchPerFoot + RATES.trenchMachineDay);
    expect(threeDayJob - twoDayJob).toBe(200 * RATES.trenchPerFoot + RATES.trenchMachineDay);
  });
});

// ─── calculateOther ───────────────────────────────────────────────────────────

describe('calculateOther', () => {
  test('undefined returns 0', () => {
    expect(calculateOther(undefined)).toBe(0);
  });

  test('0 returns 0', () => {
    expect(calculateOther(0)).toBe(0);
  });

  test('positive integer is returned as-is', () => {
    expect(calculateOther(500)).toBe(500);
  });

  test('decimal cost is returned as-is', () => {
    expect(calculateOther(123.45)).toBe(123.45);
  });
});

// ─── calculateTotals ──────────────────────────────────────────────────────────

describe('calculateTotals', () => {
  const baseInput = {
    size: '20x20',
    hasTrailer: false,
    foundationType: 'none',
    electricalFeet: 0,
    waterFeet: 0,
    sewerFeet: 0,
    septicSize: '',
    septicLeach: 0,
    trenchFeet: 0,
    otherCost: 0
  };

  test('only setup cost present when all optional items are zero/none', () => {
    const result = calculateTotals(baseInput);
    expect(result.setup).toBe(4000);
    expect(result.foundation).toBe(0);
    expect(result.electrical).toBe(0);
    expect(result.water).toBe(0);
    expect(result.sewer).toBe(0);
    expect(result.septic).toBe(0);
    expect(result.trench).toBe(0);
    expect(result.other).toBe(0);
    expect(result.total).toBe(4000);
  });

  test('total equals sum of all individual line items', () => {
    const input = {
      size: '20x40',
      hasTrailer: true,
      foundationType: 'concrete',
      electricalFeet: 100,
      waterFeet: 50,
      sewerFeet: 30,
      septicSize: '1000',
      septicLeach: 20,
      trenchFeet: 200,
      otherCost: 500
    };
    const result = calculateTotals(input);
    const expectedTotal =
      result.setup + result.foundation + result.electrical +
      result.water + result.sewer + result.septic +
      result.trench + result.other;
    expect(result.total).toBe(expectedTotal);
  });

  test('each line-item value matches the corresponding stand-alone function', () => {
    const input = {
      size: '20x30',
      hasTrailer: true,
      foundationType: 'base',
      electricalFeet: 75,
      waterFeet: 40,
      sewerFeet: 60,
      septicSize: '1200',
      septicLeach: 10,
      trenchFeet: 300,
      otherCost: 250
    };
    const result = calculateTotals(input);

    expect(result.setup).toBe(calculateSetup(input.size, input.hasTrailer));
    expect(result.foundation).toBe(calculateFoundation(input.size, input.foundationType));
    expect(result.electrical).toBe(calculateElectrical(input.electricalFeet));
    expect(result.water).toBe(calculateWater(input.waterFeet));
    expect(result.sewer).toBe(calculateSewer(input.sewerFeet));
    expect(result.septic).toBe(calculateSeptic(input.septicSize, input.septicLeach));
    expect(result.trench).toBe(calculateTrenching(input.trenchFeet));
    expect(result.other).toBe(calculateOther(input.otherCost));
  });

  test('correct concrete-slab full estimate (manually verified)', () => {
    // setup:      20x40 + trailer = $5,000 + $1,750 = $6,750
    // foundation: 800 sq ft × $13.50 = $10,800
    // electrical: 100 ft × 3 × $10 + $950 = $3,950
    // water:      50 ft × $21.62 = $1,081
    // sewer:      30 ft × $36 = $1,080
    // septic:     $9,750 + 20 ft × $15 = $10,050
    // trench:     200 ft × $15 + 1 day × $400 = $3,400
    // other:      $500
    // total:      $37,611
    const result = calculateTotals({
      size: '20x40',
      hasTrailer: true,
      foundationType: 'concrete',
      electricalFeet: 100,
      waterFeet: 50,
      sewerFeet: 30,
      septicSize: '1000',
      septicLeach: 20,
      trenchFeet: 200,
      otherCost: 500
    });

    expect(result.setup).toBe(6750);
    expect(result.foundation).toBe(10800);
    expect(result.electrical).toBe(3950);
    expect(result.water).toBeCloseTo(1081, 2);
    expect(result.sewer).toBe(1080);
    expect(result.septic).toBe(10050);
    expect(result.trench).toBe(3400);
    expect(result.other).toBe(500);
    expect(result.total).toBeCloseTo(37611, 2);
  });
});
