'use strict';
/**
 * Notion payroll adapter.
 *
 * Reads two Notion databases: a Weekly Payroll table (one row per worker per pay
 * period, carrying a Worker Type) and a Tech Pay Summary table (one row per tech
 * per period, carrying total pay and adjusted clock hours).
 *
 * Your property names almost certainly differ from the defaults. They are all
 * configurable under payroll.notion in config.json.
 *
 * ⚠️ A 404 from this API means "wrong door", not "no access". Three things have
 * to be right AT ONCE, and any one of them wrong gives the same 404:
 *   - the token is an internal integration that has been SHARED with the page
 *   - the API version matches what your ids expect
 *   - the endpoint is /v1/data_sources/{id}/query, not /v1/databases/{id}/query
 * The ids in config are DATA SOURCE ids, not database ids.
 */

const fs = require('fs');
const path = require('path');

function readToken(tokenPath, repoRoot) {
  const p = path.isAbsolute(tokenPath) ? tokenPath : path.resolve(repoRoot, tokenPath);
  if (!fs.existsSync(p)) {
    throw new Error(`Notion token not found at ${p}. Set payroll.notion.tokenPath in config.json.`);
  }
  return fs.readFileSync(p, 'utf8').trim();
}

async function notionPost(token, apiVersion, urlPath, body) {
  const res = await fetch(`https://api.notion.com/v1${urlPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': apiVersion,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Notion ${res.status} on ${urlPath}: ${text.slice(0, 300)}\n` +
      'A 404 here means wrong door, not no access - check the token is shared with the page, ' +
      'the Notion-Version, and /data_sources/ vs /databases/.'
    );
  }
  return JSON.parse(text);
}

/** Every page of a data source whose pay-period property equals `period`. */
async function queryPeriod(token, apiVersion, dataSourceId, property, period) {
  const rows = [];
  let cursor;
  do {
    const body = { filter: { property, select: { equals: period } }, page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const page = await notionPost(token, apiVersion, `/data_sources/${dataSourceId}/query`, body);
    rows.push(...page.results);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return rows;
}

const propNum = (p) => {
  if (!p) return null;
  if (p.type === 'number') return p.number;
  if (p.type === 'formula') return p.formula?.number ?? null;
  if (p.type === 'rollup') return p.rollup?.number ?? null;
  return null;
};

const propText = (p) => {
  if (!p) return '';
  if (p.type === 'title') return (p.title || []).map((t) => t.plain_text).join('');
  if (p.type === 'rich_text') return (p.rich_text || []).map((t) => t.plain_text).join('');
  if (p.type === 'select') return p.select?.name || '';
  if (p.type === 'formula') return p.formula?.string || '';
  return '';
};

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Build the pay-period label for an ATI week.
 *
 * Notion pay periods commonly run Monday-Sunday while ATI weeks run
 * Sunday-Saturday. The two mismatched days are the Sundays. If your shop is
 * CLOSED Sundays those are always zero and the Monday-start period that overlaps
 * Mon-Sat is the right one.
 *
 * ⚠️ If your shop WORKS Sundays, this mapping silently under-reports. Change it.
 */
function periodLabel(sundayIso, format) {
  const mon = addDays(sundayIso, 1);
  const sun = addDays(sundayIso, 7);
  const md = (iso) => {
    const [, m, d] = iso.split('-');
    return `${Number(m)}/${Number(d)}`;
  };
  return format
    .replace('{mon}', md(mon))
    .replace('{sun}', md(sun))
    .replace('{yy}', sundayIso.slice(2, 4));
}

async function load(config, sundayIso, repoRoot) {
  const c = (config.payroll && config.payroll.notion) || {};
  const notes = [];

  const token = readToken(c.tokenPath, repoRoot);
  const apiVersion = c.apiVersion || '2025-09-03';
  const period = periodLabel(sundayIso, c.payPeriodFormat || '{mon}-{sun}/{yy}');
  const payProp = c.payPeriodProperty || 'Pay Period';

  notes.push(`Notion pay period: ${period}`);

  const wp = await queryPeriod(token, apiVersion, c.weeklyPayrollDataSourceId, payProp, period);
  const tps = await queryPeriod(token, apiVersion, c.techPaySummaryDataSourceId, payProp, period);

  if (!wp.length) notes.push(`No Weekly Payroll rows for "${period}".`);
  if (!tps.length) notes.push(`No Tech Pay Summary rows for "${period}".`);

  const exclude = c.alwaysExcludePattern ? new RegExp(c.alwaysExcludePattern, 'i') : null;
  const writers = c.serviceWriterNames || [];
  const workerTypeProp = c.workerTypeProperty || 'Worker Type';
  const flagType = c.flagTechWorkerType || 'Flag Tech';

  const flagRows = wp.filter((r) => propText(r.properties[workerTypeProp]) === flagType);
  const techCount = flagRows.length;

  // Service writer wages: named writers only. The owner is always excluded -
  // ATI counts owner pay as a fixed expense, so including it double-counts.
  let smgrWages = 0;
  for (const r of wp) {
    const name = propText(r.properties.Name);
    if (exclude && exclude.test(name)) continue;
    if (!writers.some((w) => name.toLowerCase().startsWith(String(w).toLowerCase()))) continue;
    smgrWages += (propNum(r.properties['Gross Pay']) || 0)
      + (propNum(r.properties['Actual Tips']) || 0)
      + (propNum(r.properties['Actual Commission']) || 0);
  }

  // Tech wages and adjusted clock hours, flag techs only.
  const flagNames = new Set(
    flagRows.map((r) => propText(r.properties.Name).split('·')[0].trim().toLowerCase())
  );
  let techWages = 0;
  let clockHours = 0;
  let matched = 0;

  for (const r of tps) {
    const tech = propText(r.properties.Tech).split('·')[0].trim().toLowerCase();
    if (exclude && exclude.test(tech)) continue;
    if (/^zz\b|test row/i.test(tech)) continue;
    if (flagNames.size && !flagNames.has(tech)) continue;
    matched += 1;
    techWages += propNum(r.properties['Total Paycheck']) || 0;
    clockHours += propNum(r.properties['Clock Hrs (Adjusted)']) || 0;
  }

  if (!matched) {
    notes.push('No Tech Pay Summary rows matched the flag tech roster - check the name formats line up.');
  }

  return { techWages, smgrWages, techCount, clockHours, notes };
}

module.exports = { load, periodLabel };
