'use strict';
/**
 * QuickBooks payroll adapter - NOT IMPLEMENTED.
 *
 * This file exists so the shape is obvious and finishing it is a small job
 * rather than a design exercise. If your shop runs QuickBooks Online Payroll or
 * QBO Time, hand this file to Claude along with your QuickBooks connection and
 * ask it to finish the adapter. It is maybe an hour of work.
 *
 * WHAT IT HAS TO RETURN
 *
 *   {
 *     techWages:  Number | null,   // total pay for FLAG TECHNICIANS in the period
 *     smgrWages:  Number | null,   // service advisor / writer pay: gross + tips + commission
 *     techCount:  Number | null,   // how many flag techs worked the period
 *     clockHours: Number | null,   // clock hours for those techs, adjusted
 *     notes:      String[],        // anything the operator should see
 *   }
 *
 * THE RULES THAT ARE EASY TO GET WRONG
 *
 * 1. EXCLUDE THE OWNER from smgrWages. ATI counts owner pay as a fixed expense,
 *    so putting it here double-counts it. Exclude office and admin staff too -
 *    only the people writing service belong in this field.
 *
 * 2. FLAG TECHS ONLY for techWages, techCount and clockHours. If your general
 *    service techs are hourly rather than flagged, leave them out or your
 *    productivity number is meaningless.
 *
 * 3. PAY PERIOD BOUNDARIES rarely match the ATI week. ATI weeks run Sunday
 *    through Saturday. If your pay period runs Monday through Sunday, the two
 *    mismatched days are the Sundays - harmless if the shop is closed Sundays,
 *    and a silent under-report if it is not. Decide deliberately and write down
 *    which you chose.
 *
 * 4. A PERIOD THAT HAS NOT BEEN RUN returns plausible-looking partial numbers,
 *    not an error. pull-week.js guards against clockHours <= 0 and techWages
 *    === 0 for exactly this reason. Do not defeat those guards.
 *
 * Useful starting points: the payroll "get payslips" and "get employees" calls,
 * filtered to the pay date that falls inside your week.
 */

async function load(config, sundayIso, repoRoot) {
  throw new Error(
    'The QuickBooks payroll adapter is not implemented.\n' +
    '\n' +
    'Options:\n' +
    '  1. Set payroll.source to "manual" in config.json and enter the four\n' +
    '     figures from your payroll report.\n' +
    '  2. Ask Claude to finish scripts/lib/payroll-quickbooks.js against your\n' +
    '     QuickBooks account. The required shape and the four rules that are easy\n' +
    '     to get wrong are documented at the top of that file.'
  );
}

module.exports = { load };
