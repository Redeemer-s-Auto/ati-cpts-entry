---
name: ati-cpts-entry
description: Gathers a week of auto repair shop performance data and stages it for entry into ATI's CPTS coaching portal (Client Performance Tracking System). Use whenever the user asks to do the ATI numbers, enter the ATI week, catch up CPTS data entry, fill the CPTS portal, or mentions ATI coaching, Overdrive, or the weekly ATI submission. Reads the shop's management system and payroll source, applies the shop's own exclusion rules from config.json, and presents a review table. NEVER submits the form without the user's numbers and consent.
---

# ATI CPTS weekly entry

Stages one week of numbers for the **ATI Client Performance Tracking System**
(`https://cpts2.autotraining.net/`) and files them.

**Read these three before changing any calculation:**

- `FIELD-MAP.md` — what belongs in each field, what is excluded, and why
- `CPTS-FORM.md` — how to drive the form, and every trap in it
- `STATUS.md` — this shop's running log: what was filed, what changed, what
  broke, and what the owner's coach has already decided. **Open it first every
  session.** If it does not exist yet, copy `STATUS.example.md` to `STATUS.md`.

Shop-specific settings live in `config.json` (copy `config.example.json`).
**Never hardcode a shop's id, employee names, or account numbers into a script.**

---

## Hard rules

1. **Never fabricate "What made the week?"** The owner writes it. This is not
   negotiable and never will be.
2. **Never submit without the owner's inputs.** You need the savings balance, the
   checking balance (the **Friday** figure) and the narrative. Without all three,
   stage the week and stop.
3. **Show every number next to its source** in the same message, every time, even
   when you have standing permission to submit.
4. **Stop and ask anyway if something looks wrong** — a figure that contradicts
   the narrative, a balance that moves without explanation, a guard tripping.
   Filing a number you doubt is worse than a delay.
5. **The shop management system connection is READ-ONLY.** No POST, PATCH or
   DELETE, ever. An RO is a legal record.
6. **Weeks run Sunday → Saturday** and file under the Sunday.
7. **Never type the user's credentials.** See the login section below.

---

## ⛔ Getting in: Overdrive first, then CPTS

**Do not navigate straight to a `cpts2.autotraining.net` URL.** It bounces to an
OAuth page demanding a username and password, which you must never enter.

**The path that works:**

1. Go to `https://overdrive.autotraining.net/learn`. The user signs in here
   themselves if the session has expired — that is an identity challenge and it
   belongs to them.
2. That page carries a CPTS link at
   `https://cpts2.autotraining.net/account/OverdriveAuth`.
3. It greets the user by name and shows an `input[name="authorize_button"]`.
   Click it.
4. You land on the CPTS dashboard with a live session.

Step 1 is what creates the session the OAuth handshake hands back. There is no
shortcut. If you find yourself looking at a password field, you skipped it.

---

## Run it

```bash
node scripts/pull-week.js 2026-08-30
```

The argument is the week's **Sunday**. Output is a staged review table, a Tires
entry if one is needed, a list of what the script cannot know, and a `CHECK ME`
block showing its work.

**The script never submits anything.**

---

## Weekly run order

1. **Confirm the week is ready.** Every RO posted, payroll run. The script refuses
   a week whose payroll clearly has not run, but **nothing detects unposted ROs** —
   ask the owner.
2. Run `pull-week.js <sunday>`.
3. Read **Parts Cost** and **Total Estimated Sales** off the shop management
   system's report page. Neither is derived.
4. **Read the `CHECK ME` block.** Anything printed `SPLIT` was pro-rated, which is
   a reasoned guess. Confirm the discount balance line reads `MATCHES`.
5. Collect from the owner: savings balance, checking balance (**Friday**), and
   "What made the week?".
6. Show the owner every number beside its source.
7. Fill and submit the Mechanical entry per `CPTS-FORM.md`.
8. **Verify by reading the saved record back from the server** — not by the "Save
   Successful" banner. Confirm Shop Debt and Owner Debt persisted as entered and
   not as $0.00.
9. If the week had tire sales **or any alignments**, file the Tires entry too and
   verify it the same way.
10. **Update `STATUS.md`** — the saved record ids, anything that surprised you,
    and any flag worth the owner's attention. Do this in the same turn the week
    lands, not at the end of a session that may never reach its end.

---

## What the script fills

Rules and reasoning for every row are in `FIELD-MAP.md`.

| CPTS field | Source |
|---|---|
| Parts Sales | RO parts sales, **less tire sales**, less the allocated discount |
| Labor Sales | RO labor sales, less the allocated discount |
| Sublet Sales | RO sublet sales |
| Supplies/Hazmat Sales | Fees named *supplies* or *hazmat* only, less the allocated discount |
| Discounts | `$0.00` in `netted` mode, or the bundled total in `bundled` mode |
| Supplies Cost | Your configured figure. ⛔ **Never** the report's suggested number |
| Sublet Cost | Authorized sublets only |
| Car Count | Posted ROs, less your configured internal/employee writer ids |
| Billed Labor Hours | Labor hours over authorized jobs. Includes unpaid work, deliberately |
| Maintenance Schedules / Courtesy Checks | Distinct ROs with a completed multi-point inspection |
| Tech Wages · SMgr. Wages · # of Techs · Clock Hours | Your payroll adapter |
| **The whole Tires entry** | Sales, Units, Cost, TPPs (per tire), Alignments, TPMS, tire car count |

## What the script cannot fill — ask the owner

- **Parts Cost** — read off the SMS report page. Not derived; see `FIELD-MAP.md`.
- **Total Estimated Sales** — same page.
- **# of Service Bays** — the owner enters it. Changes more often than you expect.
- **Checking / Savings balances** — the owner enters them. Use the **Friday**
  balance.
- **Shop Debt / Owner Debt** — the owner enters them. ⛔ These pre-fill at $0.00.
- **What made the week?** — the owner writes it.

## Left blank unless the owner's coach says otherwise

Marketing Discounts · Warranty Labor Cost · Warranty Parts Cost · Warranty
Reimbursement · Freight · Royalty %

## Pre-filled constants — leave alone

Tech T&B Load · SMgr T&B Load · Labor Rate · Fixed Cost · Capacity. The owner
maintains these in the portal; they change when the owner changes them.

---

## Keep a log — `STATUS.md`

**Every trap in `CPTS-FORM.md` and `FIELD-MAP.md` came out of a log like this**
at the shop that built this skill. Somebody filed a week, something was wrong,
and they wrote down what and why. That is the only reason those documents are
worth anything.

Without a log, you start from zero every week and re-learn the same lessons.

**Start it:** copy `STATUS.example.md` to `STATUS.md`. The template has the
sections that turned out to matter — weeks filed with their record ids, the
values that must be carried forward by hand, decisions the owner's coach has
made, open questions, and what went wrong.

**Write the reason, not just the number.** "Car count 11" is data. "Car count
went 8 to 11 because four ROs posted after we staged it" is a lesson.

⛔ **`STATUS.md` is gitignored and must stay that way.** It will hold the
owner's bank balances, their debt and their real weekly figures. If this repo
was forked, that gitignore line is the only thing standing between a routine
`git push` and publishing a shop's finances. **Never commit it, never remove
that line, and never paste its contents anywhere public.**

---

## Adapting this to a different shop

This skill ships configured for a shop running Tekmetric with a Notion payroll
tracker. Neither is required.

- **Different management system?** The reader is one module. Write a new one that
  returns the same shape. Nothing else in the script cares where the data came
  from.
- **No API at all?** Set `payroll.source` to `manual` and read the figures off
  your own reports. You still get the rule book, the discount math and the form
  automation.
- **QuickBooks or QBO Time for payroll?** `scripts/lib/payroll-quickbooks.js` is a
  stub with the shape laid out. Finish it against the user's account.
- **Coach teaches discounts differently?** Set `discounts.mode` to `bundled`.
- **Any other rule your coach teaches differently?** Change it in `FIELD-MAP.md`
  and in the script. The rule book is shipped as a document precisely so it can be
  argued with.
