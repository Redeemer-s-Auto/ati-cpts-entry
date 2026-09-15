# Driving the CPTS form

Everything in this file is about the portal itself, not about any one shop's
numbers. If you use nothing else from this repo, use this.

---

## Getting in

### ⛔ Overdrive first. Always.

Going straight to a `cpts2.autotraining.net` URL bounces to an OAuth page that
asks for a username and password. **Claude should never type your credentials.**
That is an identity challenge and it is yours to perform.

With a live Overdrive session the very same OAuth page instead greets you by name
and offers one button.

**The path:**

1. `https://overdrive.autotraining.net/learn` — sign in yourself if needed.
2. The page carries a CPTS link pointing at
   `https://cpts2.autotraining.net/account/OverdriveAuth`.
3. That shows *"Welcome &lt;user&gt;! Authorize CPTS to access your Automotive
   Training Institute account?"* with an `input[name="authorize_button"]`.
4. Click it. You land on the CPTS dashboard with a working session.

Step 1 is what establishes the session the OAuth handshake hands back. There is no
way to skip it, and trying just produces the credential prompt.

### The data entry URLs

```
https://cpts2.autotraining.net/Performance/DataEntry/?performanceId=0&templateType=Mechanical&performanceType=Date
https://cpts2.autotraining.net/Performance/DataEntry/?performanceId=0&templateType=Tire&performanceType=Date
```

⚠️ `performanceId` is **required**. Omitting it throws a .NET null-parameter
server error. Pass `performanceId=0` for a new entry.

---

## ⛔ Do not click this form by coordinate

Field order on screen is not field order in the DOM, and the positional index
shifts between entries. Screenshots are for **verifying**, never for navigating.

Every value input is named `performancevalueeditmodels[N].Value`, where `N` is a
positional index that moves. Each row also carries a **hidden `CodeName` input**
holding the field's real identity. Build the map first, then act on elements by
name:

```js
const cn = {};
document.querySelectorAll('input[name$=".CodeName"]')
  .forEach(e => { cn[e.value] = e.name.match(/\[(\d+)\]/)[1]; });
// cn.PartsSales -> "0", cn.ShopDebtBalance -> "36", ...
```

### Setting a value

The inputs are masked. A plain `el.value = x` is silently discarded. You need the
**native setter** plus the events:

```js
const setter = Object.getOwnPropertyDescriptor(
  window.HTMLInputElement.prototype, 'value'
).set;

function setField(codeName, value) {
  const el = document.querySelector(
    `[name="performancevalueeditmodels[${cn[codeName]}].Value"]`
  );
  setter.call(el, value);
  ['input', 'change', 'blur'].forEach(t =>
    el.dispatchEvent(new Event(t, { bubbles: true }))
  );
}
```

The narrative is a **textarea**, so it needs `HTMLTextAreaElement.prototype`:

```js
// name="PerformanceDateEditModel.Notes"
// date: name="PerformanceDateEditModel.PerformanceDate", format MM/DD/YYYY
```

Synthetic clicks on the Submit button work fine. A whole entry is about four
evaluations, versus dozens of screenshot round-trips.

---

## The traps

### 1. ⛔ Shop Debt and Owner Debt do NOT carry forward

They **pre-fill at $0.00 on every new entry.** The "match last week" rule is
something the operator does by hand — the form will not do it for you.

Left alone, your week files as debt-free. **Set both explicitly, every time**, and
verify them in the read-back.

### 2. ⚠️ "# of Service Techs" pre-fills from the prior week and is often wrong

It moved 4 → 4 → 3 → 3 → 2 across five consecutive weeks at one shop. Set it
explicitly, every time.

### 3. ⛔ The SMS report's "Supplies Cost" is a percentage, not a cost

On Tekmetric's ATI Report page, `Supplies Cost` is **exactly 33.00% of
Supplies/Hazmat Sales**. Measured on multiple weeks: $1,878.19 → $619.80, and
$425.89 → $140.54.

It is a **suggested markup**, not a measured expense. Entering it files a
fabricated cost that scales with revenue. Use a figure you actually calculated.

⚠️ This does **not** extend to Parts Cost or Total Estimated Sales on that same
page. Those are real figures.

### 4. 🚨 A week is not final when you think it is

ROs post late. One week was staged at 8 cars and filed a week later at **11** —
parts, labor, supplies, discounts and billed hours all moved, some by more than
double.

**Re-pull the week immediately before you file it.** Never carry a staged figure
forward from a previous sitting.

### 5. ⚠️ Field indices shift on the second and later entries in a session

Each saved week appears as a link above the form, which changes the positional
indices. **Re-read the page between entries** rather than reusing a map. Using
`CodeName` instead of raw indices makes this a non-issue.

### 6. The Tires entry is a separate record, not a sub-tab

It has its own `performanceId`, reached with `templateType=Tire`, tied to the same
Performance Date. Filing the Mechanical entry does not create it.

The **Edit recent data entry** table is scoped to the currently selected template
type — Mechanical entries only show under Mechanical, Tire entries only under
Tire. Entries stay editable for roughly **52 hours**.

### 7. ⛔ Never re-click Submit after a connection error

If your browser automation drops mid-click, the form will still look filled,
still sit on `performanceId=0`, and show no success banner. **That looks exactly
like a failed submit. It is not necessarily one.**

This happened here — the record had saved. A second click would have created a
duplicate performance record.

**Check instead.** Open a second tab, load the DataEntry URL with
`performanceId=0` for that template type, and read the recent-entry links:

```js
[...document.querySelectorAll('a')].map(a => {
  const h = a.getAttribute('href') || '';
  const id = (h.match(/performanceId=(\d+)/) || [])[1];
  return id && +id > 0 ? { txt: a.innerText.trim(), id: +id } : null;
}).filter(Boolean)
```

### 8. Verify by reading the record back, not by the banner

"Save Successful" is a status label. The persisted values are the evidence.
Reload the saved `performanceId` and compare every field.

This is how you catch a Shop Debt that quietly filed as $0.00.

### 9. ⚠️ Browser tools may redact URL query strings

Some automation tools return `[BLOCKED: Cookie/query string data]` for anything
containing a query string — which kills the whole result, not just that field.

Never put `location.search` or a raw `href` in a returned value. Extract the
number you want inside the page and return it as an integer, as in trap 7.

---

## Field CodeNames

### Mechanical

```
PartsSales · LaborSales · SuppliesSales · SubletSales · TotalEstimatedSales ·
Discounts · MarketingDiscounts · TechnicianWages · WarrantyLaborCost ·
ManagerWages · TechnicianLoad · ManagerLoad · PartsCost · SuppliesCost ·
WarrantyPartsCost · WarrantyReimbursement · FreightCost · Royalty · SubletCost ·
TechCount · BayCount · LaborRate · LaborHoursTurned · ClockHoursWorked ·
CarCount · MaintenanceScheduleCount · CourtesyCheckCount · FixedCost · MinNOP ·
TechLiftSplit · Capacity · SalesLiftSplit · CalcBonusPercentage ·
SavingsAccountBalance · CheckingAccountBalance · OtherBankingBalances ·
ShopDebtBalance · OwnerDebtBalance
```

Plus `PerformanceDateEditModel.PerformanceDate` (MM/DD/YYYY) and
`PerformanceDateEditModel.Notes` (the narrative textarea).

### Tires

```
TireLaborSales · TireSales · TireTechnicianWages · TireManagerWages ·
TireTechnicianLoad · TireManagerLoad · TireUnits · TireCost ·
TireProtectionPlans · TireAlignments · TireRebates · TireTPMS · TireCarCount
```

---

## Field-ordering evidence — "Freight" is a cost

The Mechanical form's DOM order runs:

> Parts Cost · Supplies Cost · Warranty Parts Cost · Warranty Reimbursement ·
> **Freight** · Royalty % · Sublet Cost

Every neighbour is a cost. All the revenue fields sit in a separate block higher
up. Freight is also conventionally a COGS line in shop accounting — inbound parts
freight.

⚠️ **This is inference from layout, not confirmation from ATI.** If your coach has
told you otherwise, believe your coach. This shop leaves the field empty.
