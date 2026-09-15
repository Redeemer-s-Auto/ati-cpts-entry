# CPTS Entry — STATUS

> **Copy this file to `STATUS.md` and keep it as you go.**
>
> `STATUS.md` is gitignored. It will hold your real figures, your bank balances
> and your debt. **Never commit it, and never remove that gitignore line** — it
> is what stops a fork publishing your shop's finances.
>
> Delete this quote block and the `(example)` rows once you start.

Last updated: **YYYY-MM-DD**

**CPTS is current through the week of MM/DD/YYYY.** Weeks before that are
submitted and verified — do not re-enter them. The next week to file is
**MM/DD/YYYY**.

---

## Why this file exists

Every trap in `CPTS-FORM.md` and `FIELD-MAP.md` came out of a file like this one
at another shop. Somebody filed a week, something was wrong, and they wrote down
what and why. That is the only reason those documents are worth reading.

Without a log, your Claude starts from zero every week and re-learns the same
lessons. With one, it opens this file, sees what happened last time, and does not
repeat it.

**Write the reason, not just the number.** "Car count 11" is data. "Car count went
8 to 11 because four ROs posted after we staged it" is a lesson.

---

## Weeks filed

Record the saved record ids. CPTS entries stay editable for about 52 hours, and
the id is how you get back to one.

| Week | Mechanical id | Tires id | Verified by read-back? | Notes |
|---|---|---|---|---|
| *(example)* MM/DD | `0000000` | `0000000` | yes | first week using the netted discount rule |

**Verify by reloading the saved record**, not by the "Save Successful" banner. The
banner is a status label. The persisted values are the evidence. This is how you
catch a Shop Debt that quietly filed as $0.00.

---

## Carried forward — check these every week

These do **not** carry themselves. The form pre-fills Shop Debt and Owner Debt at
$0.00 every single time.

| | Current value | Last changed |
|---|---|---|
| Shop Debt | | |
| Owner Debt | | |
| # of Service Bays | | |
| Labor Rate | | |
| Fixed Cost | | |
| Capacity | | |
| Tech T&B Load | | |
| SMgr T&B Load | | |

---

## Decisions my coach has made

Write down what you were told, in their words, with the date. This is the section
that stops a future session "improving" a rule your coach set deliberately.

| Date | Decision | Who said it |
|---|---|---|
| *(example)* YYYY-MM-DD | "File Discounts as zero and take them out of parts, labor and supplies." | my ATI coach |
| *(example)* YYYY-MM-DD | Supplies Cost stays a flat figure I recalculate myself. Never the report's percentage. | me |

---

## Open questions

Things nobody has answered yet. Keep them here rather than re-deciding them every
week.

- *(example)* Is Freight a cost field or income? The form's field ordering says
  cost, but that is inference from layout, not confirmation from ATI.

---

## What went wrong, and what it taught us

The most valuable section. One entry per surprise.

### (example) YYYY-MM-DD — the week grew after we staged it

Staged at N cars on one day, filed at N+4 a week later. Parts, labor, supplies,
discounts and billed hours all moved. Four ROs posted late.

**Lesson:** re-pull the week immediately before filing. Never carry a staged
figure forward from a previous sitting. Nothing detects unposted ROs — that check
is ours.

### (example) YYYY-MM-DD — a Submit click landed while the browser dropped

The connection died mid-click. The form still looked filled, still sat on
`performanceId=0`, and showed no success banner. It looked exactly like a failed
submit. The record had saved.

**Lesson:** never re-click Submit after a connection error. Open a second tab,
load the DataEntry URL with `performanceId=0`, and read the recent-entry links
first. A duplicate performance record is much worse than a minute spent checking.

---

## Flags raised to the owner

Numbers worth a conversation, not just a filing.

| Date | Flag |
|---|---|
| *(example)* YYYY-MM-DD | Productivity NN% — billed hours over clock hours. Target is 80%. |
| *(example)* YYYY-MM-DD | Quoted N alignments, sold M. Sublet alignments are near-pure margin. |
