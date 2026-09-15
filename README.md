# ATI CPTS Entry — a Claude skill for the weekly portal submission

A [Claude Code](https://claude.com/claude-code) skill that gathers a week of shop
performance numbers, applies your shop's rules, shows you every figure next to
the source it came from, and fills the ATI **Client Performance Tracking System**
form for you.

Built and used weekly at [Redeemer's Auto](https://redeemersauto.com) in Houston.
Shared with the ATI community because most of what is in here is not code — it is
**the list of traps in the CPTS form itself**, and every ATI member hits them.

---

## Read this first, even if you use nothing else

### ⛔ Log in to Overdrive, then click CPTS. Never go straight to CPTS.

Going directly to a `cpts2.autotraining.net` URL bounces you to an OAuth page that
demands a username and password. Claude will not enter your credentials, and it
should not — that is an identity challenge and it belongs to you.

**The path that works:**

1. Go to `https://overdrive.autotraining.net/learn` and sign in yourself.
2. That page carries a CPTS link at `https://cpts2.autotraining.net/account/OverdriveAuth`.
3. It greets you by name and shows a single **Authorize** button. Click it.
4. You land on the CPTS dashboard with a live session, and the data entry forms work.

Step 1 is what creates the session the OAuth page hands back. Skip it and you get
the credential prompt instead, every time.

### Four things the CPTS form will get wrong if you let it

These cost real accuracy. They are in [`CPTS-FORM.md`](CPTS-FORM.md) in full.

1. **Shop Debt and Owner Debt pre-fill at $0.00 on every new entry.** They do not
   carry forward. Leave them alone and the week files as debt-free.
2. **"# of Service Techs" pre-fills from last week** and is frequently wrong. Set
   it explicitly every time.
3. **The Tekmetric report's "Supplies Cost" is a percentage, not a cost.** It is
   exactly 33% of your Supplies/Hazmat Sales. Entering it files an expense that
   scales with revenue.
4. **A week is not final when you think it is.** ROs post late. One week here went
   from 8 cars to 11 between staging and filing. Re-pull immediately before you
   file.

---

## Does this work for my shop?

**The rule book and the form notes work for everybody.**
[`FIELD-MAP.md`](FIELD-MAP.md) and [`CPTS-FORM.md`](CPTS-FORM.md) are plain
documents. Hand them to Claude and it knows how the form behaves and what belongs
in each field. No credentials, no setup, no code.

**The script needs a shop management system it can read.** It ships with a
Tekmetric reader, because that is what this shop runs.

| You have | What to do |
|---|---|
| Tekmetric API credentials | Works out of the box. Set `tekmetricShopId` in your config. |
| A different SMS (Shop-Ware, Mitchell, Protractor, R.O. Writer…) | Ask Claude to write a reader for it. The rest of the script does not care where the numbers came from. |
| No API at all | Use `"source": "manual"` and read the figures off your own reports. You still get the rule book, the allocation math and the form automation. |

**Payroll is pluggable.** Tech wages, service writer wages, tech count and clock
hours come from an adapter you choose in the config:

| `payroll.source` | Status |
|---|---|
| `"manual"` | Type the four numbers into your config, or read them off your payroll report. Works today. |
| `"notion"` | Ships working. Point it at your own Notion databases. |
| `"quickbooks"` | Stub. If you run QuickBooks or QBO Time for payroll, ask Claude to finish this adapter against your account — it is a small job and the shape is already laid out. |

### A word on your coach

Coaches teach portal data entry differently, and shops differ in how meticulously
they track. **Do not assume this repo's rules are your rules.** Two examples that
are genuinely contested:

- **Discounts.** This shop was taught to file `Discounts` as **$0.00** and net the
  real discounts out of Parts, Labor and Supplies/Hazmat. Other coaches teach
  bundling every discount into the Discounts field. The config supports both —
  `"discounts": { "mode": "netted" }` or `"mode": "bundled"`.
- **Supplies Cost.** This shop enters a flat figure the owner recalculates himself.
  Yours may be measured differently.

Everything contested is a config switch or a documented rule, not a hardcoded
assumption. If your coach teaches something this repo does not cover, tell Claude
and have it change the rule — that is the whole point of shipping the rule book
as a document.

---

## Install

The skill lives in your Claude Code skills folder.

**Windows**

```bash
git clone https://github.com/Redeemer-s-Auto/ati-cpts-entry.git "%USERPROFILE%\.claude\skills\ati-cpts-entry"
```

**macOS / Linux**

```bash
git clone https://github.com/Redeemer-s-Auto/ati-cpts-entry.git ~/.claude/skills/ati-cpts-entry
```

Then copy the example config and fill in your shop:

```bash
cp config.example.json config.json
```

`config.json` is gitignored. Your shop's numbers never go near this repo.

### Credentials

Nothing in this repo holds a secret, and nothing should.

**Tekmetric API.** Ask your Tekmetric rep for **read-only** API credentials. You
get a client id and a client secret. Put them in a `.env` file outside the repo,
or anywhere your config's `tekmetric.envPath` points:

```
TEKMETRIC_CLIENT_ID=...
TEKMETRIC_CLIENT_SECRET=...
```

⚠️ **Ask for read-only.** This skill never writes to Tekmetric and never should.
An RO is a legal record.

**Notion**, if you use the Notion payroll adapter: an internal integration token,
and the two data source ids, in your config.

---

## Run it

```bash
node scripts/pull-week.js 2026-08-30
```

The argument is the week's **Sunday**. ATI weeks run Sunday through Saturday and
file under the Sunday.

You get a staged review table, a Tires entry if the week needs one, a list of
everything the script cannot know, and a `CHECK ME` block showing its work.

**It never submits anything.** It reads, it calculates, it prints. Filing the form
is a separate step you drive with Claude, using
[`CPTS-FORM.md`](CPTS-FORM.md).

---

## What is in here

| File | What it is |
|---|---|
| [`SKILL.md`](SKILL.md) | The skill itself. Claude reads this. |
| [`FIELD-MAP.md`](FIELD-MAP.md) | The rule book. What belongs in each CPTS field, what is excluded, and why. |
| [`CPTS-FORM.md`](CPTS-FORM.md) | How to drive the form reliably, and every trap in it. |
| [`config.example.json`](config.example.json) | Copy to `config.json` and fill in. |
| `scripts/pull-week.js` | The gatherer. |
| `scripts/lib/tekmetric.js` | Minimal read-only Tekmetric API client. |
| `scripts/lib/payroll-*.js` | Payroll adapters. |

---

## Honest limits

- **Parts Cost and Total Estimated Sales are not derived.** Read them off your SMS
  report. An attempt to derive Parts Cost from the Tekmetric API came out $88.24
  high on a test week and the cause was never found, so it is not shipped. A wrong
  number that looks right is worse than a blank.
- **Nothing detects unposted ROs.** The script guards against unrun payroll, but it
  cannot know an RO is still sitting open. That check is yours.
- **The Tires tab is supported; Budget, BudgetTires and Program Assessment are not.**
- This is one shop's working tool, shared as-is. It is not an ATI product and ATI
  did not write it.

## License

MIT. Use it, change it, share it.
