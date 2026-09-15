'use strict';
/**
 * ATI CPTS weekly entry - data gatherer.
 *
 *   node scripts/pull-week.js 2026-08-30        (the week's SUNDAY)
 *
 * Reads your shop management system and your payroll source, applies the rules in
 * config.json, and prints a staged review table.
 *
 * It NEVER writes anywhere, and it never touches the CPTS form.
 *
 * Rule book: FIELD-MAP.md.  Form notes: CPTS-FORM.md.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

// ------------------------------------------------------------------ config

function loadConfig() {
  const p = path.join(REPO_ROOT, 'config.json');
  if (!fs.existsSync(p)) {
    throw new Error(
      `No config.json found at ${p}\n` +
      'Copy config.example.json to config.json and fill in your shop.'
    );
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadEnv(envPath) {
  const p = path.isAbsolute(envPath) ? envPath : path.resolve(REPO_ROOT, envPath);
  if (!fs.existsSync(p)) {
    throw new Error(
      `Credentials file not found: ${p}\n` +
      'It should hold TEKMETRIC_CLIENT_ID and TEKMETRIC_CLIENT_SECRET, and it should ' +
      'live OUTSIDE this repo. Point at it with sms.tekmetric.envPath in config.json.'
    );
  }
  const env = {};
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

// ----------------------------------------------------------------- helpers

/** UTC offset for a date in a named zone. Never hardcode -05:00/-06:00. */
function zoneOffset(isoDate, timeZone) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const tz = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(d).find((p) => p.type === 'timeZoneName').value;   // "GMT-5"
  const m = tz.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) throw new Error(`Could not derive a UTC offset for ${timeZone} from "${tz}"`);
  return `${m[1]}${m[2].padStart(2, '0')}:${m[3] || '00'}`;
}

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const usd = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const fromCents = (c) => (Number(c) || 0) / 100;
const rx = (pattern, flags = 'i') => new RegExp(pattern, flags);

// -------------------------------------------------------------------- main

async function main() {
  const sunday = process.argv[2];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sunday || '')) {
    console.error("Usage: node scripts/pull-week.js YYYY-MM-DD   (the week's SUNDAY)");
    process.exit(1);
  }
  if (new Date(`${sunday}T12:00:00Z`).getUTCDay() !== 0) {
    console.error(`${sunday} is not a Sunday. ATI weeks start Sunday.`);
    process.exit(1);
  }

  const config = loadConfig();
  const tz = config.shop?.timeZone || 'America/Chicago';
  const saturday = addDays(sunday, 6);
  const offset = zoneOffset(sunday, tz);

  console.log(`\nATI week: ${sunday} (Sun) .. ${saturday} (Sat)   [${tz} ${offset}]`);
  if (config.shop?.name) console.log(`Shop: ${config.shop.name}`);

  // --------------------------------------------------------------- SMS read
  const provider = config.sms?.provider || 'tekmetric';
  if (provider !== 'tekmetric') {
    throw new Error(
      `sms.provider "${provider}" has no reader in this repo.\n` +
      'Ask Claude to write one. It must return an array of posted repair orders ' +
      'with jobs, parts, labor, fees, sublets and discounts - the same shape the ' +
      'Tekmetric reader returns. Nothing downstream cares where the data came from.'
    );
  }

  const { TekmetricClient, REPAIR_ORDER_STATUS } = require('./lib/tekmetric.js');
  const tk = config.sms.tekmetric || {};
  if (!tk.shopId) throw new Error('Set sms.tekmetric.shopId in config.json.');

  const env = loadEnv(tk.envPath);
  const tek = new TekmetricClient({
    clientId: env.TEKMETRIC_CLIENT_ID,
    clientSecret: env.TEKMETRIC_CLIENT_SECRET,
    environment: tk.environment || 'production',
  });
  await tek.authenticate();

  const ros = await tek.getAllPages('/api/v1/repair-orders', {
    shop: tk.shopId,
    postedDateStart: `${sunday}T00:00:00.000${offset}`,
    postedDateEnd: `${saturday}T23:59:59.999${offset}`,
    repairOrderStatusId: REPAIR_ORDER_STATUS.POSTED,
  });

  // ------------------------------------------------------------- basic sums
  const sum = (fn) => ros.reduce((a, r) => a + (Number(fn(r)) || 0), 0);

  const partsSalesGross = fromCents(sum((r) => r.partsSales));
  const laborSalesGross = fromCents(sum((r) => r.laborSales));
  const subletSales = fromCents(sum((r) => r.subletSales));
  const discountsTotal = fromCents(sum((r) => r.discountTotal));
  const discountCentsTotal = sum((r) => r.discountTotal);

  const SUPPLIES_FEE = rx(config.supplies?.feeNamePattern || 'suppl|hazmat');
  const INSPECTION_JOB = rx(config.inspection?.jobNamePattern || 'multi.?point');
  const TIRE_CODE = rx(`^${config.tires?.partTypeCode || 'TIRE'}$`);
  const TPP_FEE = rx(config.tires?.protectionPlanPattern || 'tire protection plan');
  const ALIGNMENT = rx(config.tires?.alignmentPattern || 'align');
  const TPMS = rx(config.tires?.tpmsPattern || '\\bTPMS\\b');
  const OFF_LABOR = rx(config.discounts?.offLaborPattern || 'off\\s+labor');

  // Supplies/hazmat fees ONLY. Job-level fees count only on AUTHORIZED jobs -
  // unsold estimate lines carry fees too, and they can be enormous.
  let suppliesCents = 0;
  const otherFees = {};
  for (const r of ros) {
    const fees = [
      ...(r.fees || []),
      ...(r.jobs || []).filter((j) => j.authorized).flatMap((j) => j.fees || []),
    ];
    for (const f of fees) {
      const name = (f.name || '(unnamed)').trim();
      const v = Number(f.total ?? f.amount) || 0;
      if (SUPPLIES_FEE.test(name)) suppliesCents += v;
      else otherFees[name] = (otherFees[name] || 0) + v;
    }
  }

  const subletCost = fromCents(
    ros.flatMap((r) => r.sublets || [])
      .filter((s) => s.authorized)
      .reduce((a, s) => a + (Number(s.cost) || 0), 0)
  );

  const excludeWriters = new Set(config.carCount?.excludeServiceWriterIds || []);
  const countedRos = ros.filter((r) => !excludeWriters.has(r.serviceWriterId));
  const excludedRos = ros.length - countedRos.length;

  const billedHours = ros
    .flatMap((r) => (r.jobs || []).filter((j) => j.authorized))
    .reduce((a, j) => a + (Number(j.laborHours) || 0), 0);

  // Courtesy checks are distinct ROs carrying a COMPLETED inspection, not a
  // count of inspection jobs. One RO can carry two.
  const inspectionRos = new Set(
    ros.flatMap((r) => (r.jobs || [])
      .filter((j) => INSPECTION_JOB.test(j.name || '') || INSPECTION_JOB.test(j.jobCategoryName || ''))
      .filter((j) => j.completedDate)
      .map(() => r.id))
  );

  // ------------------------------------------------------------------ tires
  let tireRetailCents = 0, tireCostCents = 0, tireUnits = 0;
  let tppSalesCents = 0, tppCount = 0, tpmsCount = 0;
  const tireRos = new Set();
  const alignments = [];
  const tireLines = [];

  for (const r of ros) {
    for (const j of (r.jobs || []).filter((x) => x.authorized)) {
      let tiresOnJob = 0;
      for (const p of (j.parts || [])) {
        const code = (p.partType && (p.partType.code || p.partType.name)) || '';
        const qty = Number(p.quantity) || 0;
        if (TIRE_CODE.test(String(code))) {
          const retail = (Number(p.retail) || 0) * qty;
          tiresOnJob += qty;
          tireUnits += qty;
          tireRetailCents += retail;
          tireCostCents += (Number(p.cost) || 0) * qty;
          tireRos.add(r.repairOrderNumber);
          tireLines.push(`RO#${r.repairOrderNumber}  ${qty} x ${p.name || '(unnamed)'}  retail ${usd(fromCents(retail))}`);
        }
        if (TPMS.test(p.name || '')) tpmsCount += qty;
      }
      // Protection plans count PER TIRE, not per fee line.
      for (const f of (j.fees || [])) {
        if (TPP_FEE.test(f.name || '')) {
          tppSalesCents += Number(f.total ?? f.amount) || 0;
          tppCount += tiresOnJob;
        }
      }
    }
    for (const s of (r.sublets || [])) {
      if (s.authorized && ALIGNMENT.test(s.name || '')) {
        alignments.push(`RO#${r.repairOrderNumber}  ${s.name}`);
      }
    }
  }

  const tireSales = fromCents(tireRetailCents);

  // -------------------------------------------------------------- discounts
  const mode = config.discounts?.mode || 'bundled';
  const disc = { parts: 0, labor: 0, supplies: 0, dropped: 0 };
  const discLines = [];
  const discWarn = [];

  if (mode === 'netted') {
    for (const r of ros) {
      // This RO's own CPTS-bearing bases, in cents. Tire retail is excluded - it
      // is Tires-tab revenue, not Mechanical Parts Sales.
      let roTireCents = 0, roSuppCents = 0;
      for (const j of (r.jobs || []).filter((x) => x.authorized)) {
        for (const p of (j.parts || [])) {
          const code = (p.partType && (p.partType.code || p.partType.name)) || '';
          if (TIRE_CODE.test(String(code))) roTireCents += (Number(p.retail) || 0) * (Number(p.quantity) || 0);
        }
        for (const f of (j.fees || [])) {
          if (SUPPLIES_FEE.test(f.name || '')) roSuppCents += Number(f.total ?? f.amount) || 0;
        }
      }
      for (const f of (r.fees || [])) {
        if (SUPPLIES_FEE.test(f.name || '')) roSuppCents += Number(f.total ?? f.amount) || 0;
      }

      const baseP = Math.max(0, (Number(r.partsSales) || 0) - roTireCents);
      const baseL = Number(r.laborSales) || 0;
      const baseS = roSuppCents;
      const base = baseP + baseL + baseS;
      const jobs = (r.jobs || []).filter((x) => x.authorized);

      for (const d of (r.discounts || [])) {
        const amt = Number(d.total) || 0;
        if (!amt) continue;
        const name = (d.name || '(unnamed)').trim();
        const tag = `RO#${r.repairOrderNumber}  ${usd(fromCents(amt))}  ${name.slice(0, 46)}`;

        // Rule 4: this RO carries nothing CPTS counts, so the discount comes out
        // of nothing. A pure car-rental or fee-only RO does this. Forcing it onto
        // Labor would understate Labor Sales for a discount that never touched
        // labor, and drag the effective labor rate down with it.
        if (base <= 0) {
          disc.dropped += amt;
          discLines.push(`DROP   ${tag}   (this RO has no parts/labor/supplies CPTS carries)`);
          continue;
        }

        // Rule 1: the name states the category.
        if (OFF_LABOR.test(name)) {
          disc.labor += amt;
          discLines.push(`LABOR  ${tag}   (name matches the off-labor pattern)`);
          continue;
        }

        // Rule 2: a coupon that zeroes one job splits itself - the amount equals
        // that job's own labor total or parts total exactly.
        const hitL = jobs.filter((j) => (Number(j.laborTotal) || 0) === amt);
        const hitP = jobs.filter((j) => (Number(j.partsTotal) || 0) === amt);
        if (hitL.length === 1 && !hitP.length) {
          disc.labor += amt;
          discLines.push(`LABOR  ${tag}   (= labor total of job "${(hitL[0].name || '').slice(0, 28)}")`);
          continue;
        }
        if (hitP.length === 1 && !hitL.length) {
          disc.parts += amt;
          discLines.push(`PARTS  ${tag}   (= parts total of job "${(hitP[0].name || '').slice(0, 28)}")`);
          continue;
        }
        if (hitL.length && hitP.length) {
          discWarn.push(`${tag} matches BOTH a labor total and a parts total - pro-rated instead. Check it by hand.`);
        }

        // Rule 3: no category anywhere - pro-rata over this RO's own mix. The
        // rounding remainder goes on labor so the allocation balances exactly.
        const cp = Math.round(amt * baseP / base);
        const cs = Math.round(amt * baseS / base);
        const cl = amt - cp - cs;
        disc.parts += cp; disc.supplies += cs; disc.labor += cl;
        discLines.push(`SPLIT  ${tag}   parts ${usd(fromCents(cp))} / labor ${usd(fromCents(cl))} / supp ${usd(fromCents(cs))}`);
      }
    }
  }

  const discParts = fromCents(disc.parts);
  const discLabor = fromCents(disc.labor);
  const discSupp = fromCents(disc.supplies);
  const discDropped = fromCents(disc.dropped);
  const discBalanced = mode !== 'netted'
    || (disc.parts + disc.labor + disc.supplies + disc.dropped) === discountCentsTotal;

  const partsSales = partsSalesGross - tireSales - discParts;
  const laborSales = laborSalesGross - discLabor;
  const suppliesSales = fromCents(suppliesCents) - discSupp;
  const discountsField = mode === 'netted' ? 0 : discountsTotal;

  // ---------------------------------------------------------------- payroll
  const source = config.payroll?.source || 'manual';
  const adapters = {
    manual: './lib/payroll-manual.js',
    notion: './lib/payroll-notion.js',
    quickbooks: './lib/payroll-quickbooks.js',
  };
  if (!adapters[source]) throw new Error(`Unknown payroll.source "${source}". Use manual, notion or quickbooks.`);

  let pay = { techWages: null, smgrWages: null, techCount: null, clockHours: null, notes: [] };
  try {
    pay = await require(adapters[source]).load(config, sunday, REPO_ROOT);
  } catch (err) {
    pay.notes.push(`Payroll read failed: ${err.message}`);
  }

  // Refuse to stage figures that are visibly not ready. An uncalculated period
  // returns plausible-looking partials, not an error.
  if (pay.clockHours !== null && pay.clockHours <= 0) {
    pay.notes.push(`HOLD: clock hours came back ${Number(pay.clockHours).toFixed(2)} - the period is not loaded yet. Not staging it.`);
    pay.clockHours = null;
  }
  if (pay.techWages === 0) {
    pay.notes.push('HOLD: tech wages came back $0.00 - the period is not calculated yet. Not staging it.');
    pay.techWages = null;
  }

  // ----------------------------------------------------------------- output
  const row = (label, value, note) =>
    console.log(`  ${label.padEnd(30)} ${String(value).padStart(14)}${note ? '   ' + note : ''}`);
  const dash = (v, fmt) => (v === null || v === undefined ? '—' : fmt(v));

  console.log('\n=== READY TO ENTER ===');
  row('Performance Date', sunday);
  row('Parts Sales', usd(partsSales),
    mode === 'netted'
      ? `gross ${usd(partsSalesGross)} less tires ${usd(tireSales)} less disc ${usd(discParts)}`
      : `gross ${usd(partsSalesGross)} less tires ${usd(tireSales)}`);
  row('Labor Sales', usd(laborSales),
    mode === 'netted' ? `gross ${usd(laborSalesGross)} less disc ${usd(discLabor)}` : '');
  row('Supplies/Hazmat Sales', usd(suppliesSales),
    mode === 'netted' ? `supplies+hazmat fees less disc ${usd(discSupp)}` : 'supplies+hazmat fees only');
  row('Sublet Sales', usd(subletSales));
  row('Discounts', usd(discountsField),
    mode === 'netted' ? 'ALWAYS $0.00 - netted out above' : 'all discounts bundled');
  row('Supplies Cost', usd(config.supplies?.cost?.flatAmount ?? 0),
    'your figure - NEVER the report percentage');
  row('Sublet Cost', usd(subletCost), 'authorized sublets');
  row('# of Service Techs', dash(pay.techCount, (v) => v));
  row('Billed Labor Hours', billedHours.toFixed(2), 'authorized jobs');
  row('Clock Hours Worked', dash(pay.clockHours, (v) => Number(v).toFixed(2)), 'flag techs');
  row('Car Count', countedRos.length, excludedRos ? `(${excludedRos} internal/employee excluded)` : '');
  row('Maintenance Schedules', inspectionRos.size);
  row('Courtesy Checks', inspectionRos.size, 'completed inspection per car');
  row('Tech Wages', dash(pay.techWages, usd));
  row('SMgr./Writer Wages', dash(pay.smgrWages, usd), 'owner and admin excluded');

  // File a Tires entry only when there is something to report. An all-zero row
  // records nothing, and ATI's "Alignments % of Tire Units" divides by zero.
  if (tireUnits || tireRetailCents || alignments.length || tppCount) {
    console.log('\n=== TIRES ENTRY (separate record, same Performance Date) ===');
    row('Labor Sales', usd(0), 'always $0');
    row('Sales', usd(tireSales + fromCents(tppSalesCents)),
      `tires ${usd(tireSales)} + protection plans ${usd(fromCents(tppSalesCents))}`);
    row('Tech Wages', usd(0), 'always $0');
    row('SMgr. Wages', usd(0), 'always $0');
    row('Units', tireUnits);
    row('Cost', usd(fromCents(tireCostCents)));
    row('TPPs Sold', tppCount, 'per tire, not per fee line');
    row('Alignments', alignments.length);
    row('Rebates', usd(0));
    row('TPMS', tpmsCount);
    row('Car Count', tireRos.size, [...tireRos].map((n) => `RO#${n}`).join(', '));
  } else {
    console.log('\n=== TIRES ENTRY ===');
    console.log('  None needed - zero tire sales and zero alignments.');
  }

  console.log('\n=== YOU MUST SUPPLY ===');
  console.log('  Parts Cost              - read it off your SMS report page');
  console.log('  Total Estimated Sales   - same page');
  console.log(`  # of Service Bays       - currently ${config.shop?.serviceBays ?? '?'} in config`);
  console.log('  Checking Balance        - the FRIDAY balance, not Saturday');
  console.log('  Savings Balance');
  console.log('  Shop Debt / Owner Debt  - these pre-fill at $0.00, set them explicitly');
  console.log('  What made the week?     - the owner writes this. Never fabricate it.');

  console.log('\n=== LEAVE BLANK unless your coach uses them ===');
  console.log('  Marketing Discounts, Warranty Labor/Parts/Reimbursement, Freight, Royalty %');

  console.log('\n=== CHECK ME ===');
  console.log(`  Posted ROs in window: ${ros.length}`);
  if (excludedRos) console.log(`  Excluded as internal/employee: ${excludedRos}`);

  const feeList = Object.entries(otherFees).sort((a, b) => b[1] - a[1]);
  if (feeList.length) {
    console.log('  Fees deliberately EXCLUDED from Supplies/Hazmat:');
    for (const [n, v] of feeList) console.log(`     ${usd(fromCents(v)).padStart(10)}  ${n}`);
  }

  if (mode === 'netted') {
    console.log(`  Discounts allocated: parts ${usd(discParts)} / labor ${usd(discLabor)} / supplies ${usd(discSupp)} / dropped ${usd(discDropped)}`);
    console.log(`  Balance check: allocated + dropped ${discBalanced ? 'MATCHES' : 'DOES NOT MATCH'} total discounts ${usd(discountsTotal)}`);
    if (!discBalanced) console.log('     STOP: the allocation does not balance. Do not file this week until it does.');
    if (discLines.length) {
      console.log('  Every discount, and where it went:');
      for (const l of discLines) console.log(`     ${l}`);
    }
    for (const w of discWarn) console.log(`  ! ${w}`);
  }

  if (tireLines.length) {
    console.log('  Tire parts subtracted from Parts Sales:');
    for (const l of tireLines) console.log(`     ${l}`);
  }
  if (alignments.length) {
    console.log('  Alignments (authorized sublets):');
    for (const l of alignments) console.log(`     ${l}`);
  }
  for (const n of pay.notes) console.log(`  ! ${n}`);

  console.log('\n  Nothing detects unposted ROs. Confirm the week is closed before you file it.');
  console.log('\nNothing has been submitted. Review, then enter in CPTS.\n');
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}\n`);
  process.exit(1);
});
