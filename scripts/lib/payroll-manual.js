'use strict';
/**
 * Manual payroll adapter.
 *
 * For shops with no payroll API, or shops still deciding. Read the four figures
 * off your own payroll report and put them in config.json under
 * payroll.manual, or leave them null and the script prints a dash for you to
 * fill in by hand on the form.
 *
 * Every adapter returns this same shape:
 *   { techWages, smgrWages, techCount, clockHours, notes: [] }
 * Any value may be null, meaning "not known, ask the owner".
 */

async function load(config) {
  const m = (config.payroll && config.payroll.manual) || {};
  const notes = [];

  const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

  const out = {
    techWages: num(m.techWages),
    smgrWages: num(m.smgrWages),
    techCount: num(m.techCount),
    clockHours: num(m.clockHours),
    notes,
  };

  const missing = Object.keys(out).filter((k) => k !== 'notes' && out[k] === null);
  if (missing.length) {
    notes.push(
      `Manual payroll: ${missing.join(', ')} not set in config.payroll.manual. ` +
      'Read them off your payroll report and enter them on the form by hand.'
    );
  }

  return out;
}

module.exports = { load };
