/**
 * Pure business-logic functions for the Site Survey Estimator.
 *
 * All functions accept plain values (no DOM reads) so they can be imported
 * and tested in Node.js with Jest without a browser environment.
 *
 * In the browser the functions are exposed as globals; Node.js consumers
 * receive them via module.exports.
 */

const RATES = {
  setup: { '20x20': 4000, '20x30': 4500, '20x40': 5000, '8x20': 1500, '8x40': 2000 },
  trailerExtra: 1750,
  electricalPerFoot: 10,
  electricalSubPanel: 950,
  panelUpgrade: 2500,
  waterPerFoot: 21.62,
  sewerPerFoot: 36,
  septic: { '1000': 9750, '1200': 10450, '1500': 11250, extraLeachPerFoot: 15 },
  trenchPerFoot: 15,
  trenchMachineDay: 400,
  trenchFeetPerDay: 200,
  // Multipliers applied to the total trenching cost based on ground conditions.
  soilMultiplier: { normal: 1, rocky: 1.5, very_rocky: 2.25 }
};

/** Format a numeric value as a USD currency string, e.g. 1234.5 → "$1,234.50" */
function formatCurrency(value) {
  return '$' + value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

/**
 * Setup cost based on home size and whether it is mounted on a trailer.
 * @param {string} size - e.g. "20x40"
 * @param {boolean} hasTrailer
 * @returns {number}
 */
function calculateSetup(size, hasTrailer) {
  let cost = RATES.setup[size] || 0;
  if (hasTrailer) cost += RATES.trailerExtra;
  return cost;
}

/**
 * Foundation cost based on home size and foundation type.
 * Enforces minimums: $1,500 for base pad, $2,160 for concrete slab.
 * @param {string} size - e.g. "20x40"
 * @param {'none'|'base'|'concrete'} type
 * @returns {number}
 */
function calculateFoundation(size, type) {
  const [width, length] = size.split('x').map(Number);
  const area = width * length;
  let cost = 0;
  if (type === 'base') {
    cost = area * 4.5;
    if (cost < 1500) cost = 1500;
  } else if (type === 'concrete') {
    cost = area * 13.5;
    if (cost < 2160) cost = 2160;
  }
  return cost;
}

/**
 * Electrical cost: 3× linear footage at $10/ft plus a $950 subpanel fee.
 * Returns 0 when no footage is specified.
 * @param {number} feet
 * @returns {number}
 */
function calculateElectrical(feet) {
  if (feet <= 0) return 0;
  return feet * 3 * RATES.electricalPerFoot + RATES.electricalSubPanel;
}

/**
 * Water line cost at $21.62/ft.
 * @param {number} feet
 * @returns {number}
 */
function calculateWater(feet) {
  return feet * RATES.waterPerFoot;
}

/**
 * Sewer line cost at $36/ft.
 * @param {number} feet
 * @returns {number}
 */
function calculateSewer(feet) {
  return feet * RATES.sewerPerFoot;
}

/**
 * Septic tank cost plus optional extra leach line footage at $15/ft.
 * Returns 0 when no tank size is selected.
 * @param {string} tankSize - "1000", "1200", "1500", or ""
 * @param {number} extraLeachFeet
 * @returns {number}
 */
function calculateSeptic(tankSize, extraLeachFeet) {
  if (!tankSize) return 0;
  let cost = RATES.septic[tankSize] || 0;
  if (extraLeachFeet > 0) cost += extraLeachFeet * RATES.septic.extraLeachPerFoot;
  return cost;
}

/**
 * Trenching cost: $15/ft plus machine rental ($400/day, capacity 200 ft/day).
 * Machine rental days are rounded up to the nearest whole day.
 * soilFactor multiplies the result to account for difficult ground conditions
 * (use RATES.soilMultiplier values: normal=1, rocky=1.5, very_rocky=2.25).
 * Returns 0 when no footage is specified.
 * @param {number} feet
 * @param {number} [soilFactor=1]
 * @returns {number}
 */
function calculateTrenching(feet, soilFactor) {
  if (feet <= 0) return 0;
  soilFactor = soilFactor || 1;
  const costFeet = feet * RATES.trenchPerFoot;
  const days = Math.ceil(feet / RATES.trenchFeetPerDay);
  return (costFeet + days * RATES.trenchMachineDay) * soilFactor;
}

/**
 * Cost of upgrading the main electrical panel when it is at capacity or outdated.
 * @param {boolean} needed
 * @returns {number}
 */
function calculatePanelUpgrade(needed) {
  return needed ? RATES.panelUpgrade : 0;
}

/**
 * Pass-through for the "Other" custom line item.
 * @param {number} cost
 * @returns {number}
 */
function calculateOther(cost) {
  return cost || 0;
}

/**
 * Aggregate all cost categories and return individual amounts plus grand total.
 * @param {{
 *   size: string,
 *   hasTrailer: boolean,
 *   foundationType: string,
 *   electricalFeet: number,
 *   needsPanelUpgrade: boolean,
 *   waterFeet: number,
 *   sewerFeet: number,
 *   septicSize: string,
 *   septicLeach: number,
 *   trenchFeet: number,
 *   soilFactor: number,
 *   otherCost: number
 * }} params
 * @returns {{ setup, foundation, electrical, panel, water, sewer, septic, trench, other, total }}
 */
function calculateTotals({ size, hasTrailer, foundationType, electricalFeet, needsPanelUpgrade,
    waterFeet, sewerFeet, septicSize, septicLeach, trenchFeet, soilFactor, otherCost }) {
  const setup      = calculateSetup(size, hasTrailer);
  const foundation = calculateFoundation(size, foundationType);
  const electrical = calculateElectrical(electricalFeet);
  const panel      = calculatePanelUpgrade(needsPanelUpgrade);
  const water      = calculateWater(waterFeet);
  const sewer      = calculateSewer(sewerFeet);
  const septic     = calculateSeptic(septicSize, septicLeach);
  const trench     = calculateTrenching(trenchFeet, soilFactor || 1);
  const other      = calculateOther(otherCost);
  return {
    setup, foundation, electrical, panel, water, sewer, septic, trench, other,
    total: setup + foundation + electrical + panel + water + sewer + septic + trench + other
  };
}

// Support both browser (global) and Node.js (CommonJS module) environments.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RATES,
    formatCurrency,
    calculateSetup,
    calculateFoundation,
    calculateElectrical,
    calculatePanelUpgrade,
    calculateWater,
    calculateSewer,
    calculateSeptic,
    calculateTrenching,
    calculateOther,
    calculateTotals
  };
}
