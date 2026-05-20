# Payroll Subsidiary Allocations — Methodology

This document describes how DawinOS treats payroll cost when an employee
works across multiple Dawin Group subsidiaries, and explains why the
treatment is consistent with IAS 19, IAS 24, and URA's transfer pricing
expectations for sub-25 bn UGX entities.

It is the **methodology companion** to:

1. The signed **Intercompany Services / Cost-Sharing Agreement** between
   the participating subsidiaries.
2. The monthly **Intercompany Recharge Schedule** generated from the
   Monthly Payroll Run detail page (CSV + JE template).

Together they form the supporting file the Dawin Group can present to
auditors or URA in the event of a transfer pricing review.

---

## 1. The arrangement (Model A — host employer + intercompany recharge)

Each employee has **one legal employer of record** — the *host subsidiary*
(`Employee.subsidiaryId`). The host:

- Holds the employment contract.
- Runs payroll once per period at the employee's full pay.
- Withholds PAYE, NSSF (employee), and LST under its own TIN and remits
  to URA / NSSF.
- Pays the full employer NSSF contribution under its own NSSF employer
  number.
- Pays the employee the full net pay through its own bank account /
  mobile money rail.

When the employee renders services to other Dawin Group subsidiaries,
those subsidiaries reimburse the host for their share of the
**rechargeable cost**:

> rechargeable cost = gross pay + employer NSSF
>
> recharge to recipient = allocation percent × rechargeable cost

The recharge is settled through the intercompany current account.

---

## 2. Why one payslip and one set of statutory filings

- **PAYE bracket efficiency.** Splitting the same employee across two
  TINs resets URA's progressive PAYE bands per employer, which typically
  *increases* the employee's tax under standard withholding (until they
  apply for a secondary-employer adjustment). Hosting on a single TIN
  keeps the tax position optimal.
- **NSSF accruals.** Each employer-employee relationship registers a
  separate NSSF account. A split would force the employee to maintain
  parallel accruals against two employers for the rest of their career.
- **Compliance overhead.** One PAYE return / one NSSF submission / one
  LST filing per employee per period instead of N copies.
- **Operational simplicity.** Allocation changes (e.g. an employee
  moves from 60/40 to 50/50) require only a single edit in the
  employee record, not new contracts with URA / NSSF.

---

## 3. Allocation source of truth

Allocations live on the employee record:

```ts
Employee.subsidiaryAllocations: Array<{
  subsidiaryId: string;
  allocationPercent: number;  // 0–100; the array must sum to 100
}>
```

Edited via the **Subsidiary Allocations** card on the employee's
Overview tab. The primary `subsidiaryId` (host) is kept aligned with
the largest share.

When a payroll is calculated, the calculator **snapshots** the live
allocation onto the payroll record (`EmployeePayroll.subsidiaryAllocations`)
so the historical batch and its recharge schedule remain stable even
if the employee's split changes in subsequent months. The snapshot is
the source of truth for all downstream cost reporting.

---

## 4. Accounting treatment (IAS 1 §33, IAS 19)

The intercompany recharge is booked as a **contra-expense at the
host**, not as revenue.

### Host journal entry

```
DR  Intercompany receivable (Recipient)          <recharge amount>
CR  Salary expense (recovery)                    <recharge amount>
```

### Recipient journal entry

```
DR  Salary expense (allocated from Host)         <recharge amount>
CR  Intercompany payable (Host)                  <recharge amount>
```

### Why contra-expense, not revenue

IAS 1 §32 prohibits offsetting in general, but §33 *permits* netting
when it reflects the substance of the transaction. For a cost-sharing
arrangement that:

- Is **not** a service supply by host to recipient,
- Has **no markup / profit element**,
- Involves **no transfer of value** beyond cost reimbursement, and
- Sees host effectively act as **paymaster** for the group,

contra-expense is the correct presentation. Booking the recharge as
"other income" would inflate the host's revenue line without changing
net earnings, distorting margins, segment reporting, and KPIs.

The recipient's debit to "Salary expense (allocated)" is a real,
deductible operating expense — it represents the cost of employee
services rendered to that subsidiary.

### Stand-alone vs consolidated view

- **Stand-alone**: each subsidiary's P&L shows its actual share of the
  employee cost. URA CIT deduction at each subsidiary matches.
- **Consolidated**: the intercompany receivable / payable and the
  contra-expense / allocated-expense fully eliminate at group level.
  Group P&L shows the original full salary expense once.

---

## 5. Transfer pricing position

The recharges are between related parties (subsidiaries under common
control) and so fall within URA's TP regulations (Income Tax Act
§§90–91 + Transfer Pricing Regulations 2011, amended 2020).

**Position taken**: cost-only (no markup) is consistent with the
arm's-length principle for *pure pass-through* cost-sharing
arrangements where:

- There is no service entity providing a distinct service.
- The host has no functional / risk profile beyond paymaster.
- The allocation key is independently observable (employee allocation
  percentages, derived from business reality and documented per
  employee).

**Documentation maintained** (TP file contents):

1. This methodology document.
2. The signed Intercompany Services / Cost-Sharing Agreement.
3. Monthly Intercompany Recharge Schedule (CSV) generated by DawinOS.
4. Monthly Journal Entry register evidencing the recharges were
   actually posted.
5. Allocation change log (DawinOS audit trail on the employee record).

**TP documentation threshold**: Dawin Group operates below URA's
UGX 25 bn turnover threshold for any single subsidiary, so the formal
Local File / Master File is not required. The above set is the
proportionate documentation expected at this scale.

If any subsidiary crosses the 25 bn threshold, this methodology
should be upgraded to a full Local File with:

- Comparable benchmarking study to justify cost-only treatment.
- Functional analysis per entity.
- Master File covering the group structure.

---

## 6. Where in DawinOS

| Concern | Location |
|---|---|
| Set employee allocation | Employee detail → Overview → Subsidiary Allocations |
| View allocation snapshot per period | Payroll record (`EmployeePayroll.subsidiaryAllocations`) |
| Generate monthly recharge schedule | Monthly Payroll Run detail → "Intercompany recharge" |
| Per-pair JE template | Inside the recharge dialog, expand "Journal entry template" |
| Service code | `src/modules/hr-central/payroll/services/intercompany-recharge.service.ts` |
| Allocation factor helper | `getEmployeeSubsidiaryAllocation` in `payroll-batch.service.ts` |
| Calc-time snapshot | `calculateEmployeePayroll` in `payroll-calculator.service.ts` |

---

## 7. Versioning

This document describes the methodology as implemented from
2026-05-13 onward. Any change to the recharge formula, treatment, or
documentation set must be reflected here and dated.

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-13 | Initial methodology — Model A, cost-only recharge, contra-expense at host. |
