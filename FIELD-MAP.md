# The rule book — what belongs in each CPTS field

Every dollar figure in this file is an **illustration**, not any shop's real
numbers. The rules are what matter.

> **Your coach outranks this document.** Coaches teach portal entry differently
> and shops track at different levels of detail. Where a rule below is genuinely
> contested, it says so and the config has a switch. Where your coach disagrees
> with something that is not switchable, change it — tell Claude what your coach
> teaches and have it rewrite the rule.

---

## The week

**ATI weeks run Sunday → Saturday, and file under the Sunday.**

Time zone matters. Compute the UTC offset from your shop's own zone rather than
hardcoding it, or a daylight-saving change silently shifts your week by an hour
and moves ROs across the boundary.

```js
// America/Chicago gives -05:00 in CDT, -06:00 in CST. Derive it, never type it.
new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago', timeZoneName: 'longOffset',
}).formatToParts(new Date(`${isoDate}T12:00:00Z`))
  .find(p => p.type === 'timeZoneName').value;   // "GMT-5"
```

---

## Mechanical fields

| CPTS field | Rule |
|---|---|
| **Parts Sales** | Sum of RO parts sales, **less tire sales**, less the allocated discount. See the two sections below — both subtractions are easy to miss. |
| **Labor Sales** | Sum of RO labor sales, less the allocated discount. |
| **Sublet Sales** | Sum of RO sublet sales. |
| **Supplies/Hazmat Sales** | Fees named *supplies* or *hazmat* **only**, less the allocated discount. ⛔ **Not** the RO's total fee figure. |
| **Discounts** | Depends on how you were taught. See **Discounts**, below. |
| Marketing Discounts | Not used here. Left empty. |
| **Parts Cost** | **Read it off your SMS report.** Not derived — see *Honest limits*. |
| **Supplies Cost** | A figure you actually calculated. ⛔ **Never** the SMS report's suggested number — it is a fixed percentage of supplies sales, not a cost. |
| **Sublet Cost** | Sum of sublet cost over **authorized** sublets only. |
| **Total Estimated Sales** | Read it off your SMS report. Not derived. |
| **Car Count** | Posted ROs, excluding your internal and employee-vehicle service writers. **Match on employee id, never on name** — names get renamed, ids do not. |
| **Billed Labor Hours Produced** | Sum of labor hours over **authorized** jobs. Deliberately includes unpaid work — complimentary inspections, test drives. That is intentional: the tech was on the car. |
| **Clock Hours Worked** | Clock hours for your flag technicians. Exclude general service if your shop does not flag them. |
| **# of Service Techs** | Count of flag techs who worked the period. ⚠️ The form pre-fills this wrong. |
| **Maintenance Schedules** | Same number as Courtesy Checks. |
| **Courtesy Checks** | Distinct **ROs** carrying a completed multi-point inspection job — not the count of inspection jobs. One RO can carry two. |
| **Tech Wages** | Flag technicians' total pay for the period. |
| **SMgr./Writer Wages** | Service advisor / writer pay: gross plus tips plus commission. ⛔ **Not the owner** — ATI counts owner pay as a fixed expense, so including it double-counts. Exclude office and admin staff too. |
| **Savings / Checking balance** | Yours to enter. ⚠️ Use the **Friday** balance, not Saturday — see below. |
| **Shop Debt / Owner Debt** | Yours to enter. ⛔ These pre-fill at $0.00 every time. |
| Warranty Labor Cost · Warranty Parts Cost · Warranty Reimbursement · Freight · Royalty % | Left empty here. Fill them if your coach uses them. |
| Labor Rate · Fixed Cost · Capacity · T&B loads | Constants you maintain in the portal. Leave them alone unless you are changing them deliberately. |

### ⚠️ Use the Friday balance, not Saturday

The week ends Saturday, but most shops' last banking day is Friday. A Saturday
balance includes deposits that have not cleared and misses Friday's settlement.
Ask for — and enter — the **Friday** figure, and be consistent about it.

---

## 🚨 Parts Sales must have tire sales subtracted

Your SMS almost certainly reports parts sales **including** tires. ATI's Parts
Sales does not — **tires belong on the Tires tab.**

```
CPTS Parts Sales = sum(RO parts sales) − tire sales − allocated discount
```

This is the single easiest error to make, because it is **invisible on any week
that sold no tires**. Across five test weeks at one shop, three matched perfectly
without the subtraction — purely because those weeks sold zero tires. The other
two were overstated.

In Tekmetric, tires are parts whose `partType.code` is `TIRE`. **Rims are typed
`PART`** and stay in Mechanical Parts Sales.

---

## 🚨 Job-level fees only count when the job was authorized

Unsold estimate lines carry fees too, and they can be large.

A real example: one RO showed **$3,700** of extended-warranty fee lines hanging
off engine and transmission jobs the customer declined. That RO's actual total
sales were $270.00 and its real fee total was **$0.04**. Counting those unsold
fees would have invented $3,700 of revenue that never existed.

**Filter every job-level fee to authorized jobs.** RO-level fees are already real.

---

## Discounts

Two approaches. Both are legitimate. **Ask your coach which one you were taught**,
then set `discounts.mode` in your config.

### Mode `bundled` — the straightforward one

Put the whole discount total in the CPTS `Discounts` field. Parts, Labor and
Supplies/Hazmat are entered gross. Done.

### Mode `netted` — file Discounts as $0.00

The `Discounts` field files as **$0.00**, and every discount dollar is subtracted
from the sales line it actually came off. Your sales lines then read net, which
makes your effective labor rate and your wages-to-labor ratio honest.

**The catch:** your SMS probably records discounts at RO level with only a name,
not a category. So you have to decide where each one belongs.

#### The allocation order

1. **The name states the category.** "New Client — 10% Off Labor", "Ministry
   Discount — 10% Off Labor", "Senior Discount — 15% Off Labor". Anything matching
   `/off labor/i` goes to **Labor**. Straightforward and by far the most common.

2. **A coupon that zeroes one job splits itself.** Watch for a discount whose
   amount **exactly equals one job's own parts total or labor total**.

   Illustration: a "Free Oil Change" coupon arrived as **two** discount lines. The
   oil change job on that RO had parts of exactly one amount and labor of exactly
   the other. One line killed the parts, one killed the labor. The split was
   already done — it just had to be recognised.

   **Match the amounts against the job before assuming anything.**

3. **No category anywhere — pro-rata over that RO's own mix.** A generic "Courtesy
   Discount" is often the plug that lands an invoice on a round number. Split it
   across that RO's parts, labor and supplies/hazmat in proportion. Put the
   rounding remainder on Labor so it balances to the penny.

   ⚠️ This is a **reasoned guess, not a fact.** The script prints these as `SPLIT`
   so you can see them. Look at them.

4. ⛔ **A discount against revenue CPTS does not carry is DROPPED, not
   reallocated.**

   Illustration: an RO sold **zero parts and zero labor** — it was a pure car
   rental, all fees. It carried a rewards-points discount. Rental income lands in
   no CPTS field, so its discount comes out of no CPTS field either.

   Forcing it onto Labor would understate Labor Sales for a discount that never
   touched labor, and drag the effective labor rate down with it. **Drop it.** Net
   sales then read higher than the bundled method by exactly that amount, and that
   gap is correct and explainable in one sentence.

#### Always run the balance check

```
parts disc + labor disc + supplies disc + dropped = total discounts
```

If that does not balance **to the penny**, the allocation is wrong. Do not file
the week.

#### What netting does to your ratios

Netting makes **tech wages against labor sales look worse**, because the labor
line shrinks while wages do not. One week here went from 75.0% to 86.8% on
identical wages. Nothing changed in the shop — the ratio just got more honest.

Know this before you show the number to your coach.

---

## The Tires entry

A separate performance record on the same Performance Date. File one **only when
there is something to report** — tire sales, or alignments. An all-zero row
records nothing, and ATI's "Alignments % of Tire Units" divides by zero.

| Tires field | Rule |
|---|---|
| **Labor Sales** | **Always $0.** Mount-and-balance labor stays in Mechanical Labor Sales. |
| **Sales** | Tire retail **plus** the tire protection plan charge. No labor. |
| **Tech Wages / SMgr. Wages** | **Always $0.** Never split wages onto this tab. |
| Tech / SMgr T&B Load | Leave at 0.00%. |
| **Units** | Tire units sold. |
| **Cost** | Tire cost. |
| **TPPs Sold** | ⚠️ Counted **per tire, not per line.** Your SMS likely writes one protection-plan fee line per job, so a job with 4 tires is **4 plans**, not 1. |
| **Alignments** | Count every alignment, every week — even in a week with zero tire sales. It is the cheapest tracking you will ever add. |
| Rebates | Leave $0 unless your coach uses it. |
| **TPMS** | Number of TPMS sensors sold. |
| **Car Count** | **Tire** car count — distinct ROs that bought tires. Not your shop car count. |
| What made the week? | Leave blank. The narrative lives on the Mechanical entry. |

### Explicitly not tire sales

- **Rims.** Typed `PART`, not `TIRE`. They stay in Mechanical Parts Sales.
- **Tire disposal fee.** Not tire sales, and not supplies/hazmat either. It lands
  in no CPTS field, deliberately.
- **Mount & balance labor.** Stays in Mechanical Labor Sales, because Tires Labor
  Sales is always $0.

### Where the numbers come from

- **Units / Cost / Sales** — your SMS report, or parts with `partType.code === 'TIRE'`
  on authorized jobs.
- **TPPs** — fee lines matching the protection-plan name, but the value entered is
  the **tire quantity on that job**, not the number of fee lines.
- **Alignments** — these usually come through as **sublets**, not jobs. Match
  `/align/i` on the sublet name, authorized only. Both standard and warranty
  alignments appear.
- **Tire car count** — distinct ROs carrying tire parts.

### ⚠️ Never match TPMS on the word "sensor"

A `/sensor/i` match is a false-positive generator. It matched a **DPF
Differential Pressure Sensor** on a real RO and would have reported a TPMS sale
that never happened. Match `TPMS` explicitly.

---

## Alignments are worth tracking even at zero

One shop's data: a week that **quoted 6 alignments and sold 1**. Sublet
alignments are close to pure margin — a typical one bills far above its sublet
cost.

Logging alignments every week, including zero weeks, is what made that visible.
There is no other field in CPTS where it shows up.

---

## Honest limits

### Parts Cost is not derived

An attempt to derive Parts Cost from the Tekmetric API came out **$88.24 high** on
a test week ($5,755.35 against a known-good $5,667.11), and the cause was never
found. Ruled out: job authorized/selected/archived filters, part status
(Ordered / Received / null), part type (Part / Battery), and every individual line
item.

**Read it off the report page.** A wrong number that looks right is worse than a
blank one.

### Total Estimated Sales is not derived

Not located in the API. Read it off the report page.

### Nothing detects unposted ROs

The script refuses a week whose payroll clearly has not run — clock hours at or
below zero, or tech wages at exactly zero. Those are the shapes of an
uncalculated period.

**It cannot know an RO is still sitting open.** That check is yours, and it is the
single most common reason a filed week turns out wrong.

---

## A closing habit

**Verify at the destination.** A zero exit code, a success banner and a status
label are all *claims*. The saved record is *evidence*.

After you file, reload the saved entry and compare every field. That is how you
catch a Shop Debt that quietly filed as $0.00.
