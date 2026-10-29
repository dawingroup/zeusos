/**
 * The morning brief — two or three sentences on a person's day, written by
 * Claude from the published plan (Phase 6.E PR 3).
 *
 * Runs inside the 06:00 publish for every plan with work on it, when
 * ANTHROPIC_API_KEY is configured; without the key the publish is unchanged
 * and `plan.brief` stays null. Best-effort: a failed brief never fails the
 * publish, and a plan that already has a brief for the day is not asked again.
 *
 * The brief names specific items, says what each needs from the person, and
 * flags what is carried or overdue — never invents facts the plan does not
 * hold (the prompt gives it only the plan).
 */

const { toMillis } = require('../lib/taskModel');

const MAX_BRIEFS_PER_RUN = 60;

/** PURE: the prompt for one plan. */
function briefPrompt(plan, { todayKey } = {}) {
  const items = (plan.items || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((i, n) => {
      const bits = [i.priority];
      if (i.focusReason === 'carry_over') bits.push('carried over');
      if (i.focusReason === 'overdue') bits.push('OVERDUE');
      if (i.focusReason === 'manager_pick') bits.push('manager pick');
      if (i.dueAt) bits.push(`due ${String(i.dueAt).slice(0, 10)}`);
      if (i.timeboxMinutes) bits.push(`${i.timeboxMinutes} min`);
      const why = i.whyToday ? ` Why today: ${i.whyToday}` : '';
      const left = i.resumeNote ? ` Where they left it: ${i.resumeNote}` : '';
      return `${n + 1}. ${i.title} [${bits.join(', ')}]${why}${left}`;
    })
    .join('\n');
  return [
    `Write the morning brief for ${plan.assigneeName || 'a colleague'} at Zeus Group for ${plan.date || todayKey}. Two or three sentences, plain and warm, no headings, no bullet points, no greeting.`,
    plan.dayGoal ? `Their manager's day goal: "${plan.dayGoal}".` : 'No day goal was set.',
    plan.managerNote ? `Their manager's note: "${plan.managerNote}".` : '',
    plan.reviewed ? `Reviewed by ${plan.reviewedByName || 'their manager'}.` : 'Not yet reviewed by a manager (auto-ranked).',
    '',
    "Today's plan, in order:",
    items || '(nothing)',
    '',
    'Name the first thing to do and why, mention what is carried over or overdue, and say what to protect time for. Use only what is above — never invent clients, amounts or dates.',
  ].filter(Boolean).join('\n');
}

function clean(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 700) || null;
}

/**
 * Brief every published plan that has items and no brief yet. Returns the
 * count written. `getAnthropic` is injected; NOT_CONFIGURED means skip all.
 */
async function briefPlans(db, plans, { getAnthropic, logger = console, nowIso, todayKey } = {}) {
  let client; let model;
  try {
    ({ client, model } = await getAnthropic());
  } catch (err) {
    if (err && err.code === 'NOT_CONFIGURED') {
      logger.info('[dailyBrief] ANTHROPIC_API_KEY not set — plans publish without a brief.');
      return 0;
    }
    logger.warn('[dailyBrief] Anthropic client unavailable', { error: err.message });
    return 0;
  }

  let written = 0;
  for (const plan of plans) {
    if (written >= MAX_BRIEFS_PER_RUN) break;
    if (plan.status !== 'published' || !(plan.items || []).length) continue;
    if (plan.brief && plan.briefAt && toMillis(plan.briefAt) != null && plan.briefDate === plan.date) continue;
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 300,
        messages: [{ role: 'user', content: briefPrompt(plan, { todayKey }) }],
      });
      const text = clean((response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(' '));
      if (!text) continue;
      const ref = db.collection('daily_plans').doc(plan.id);
      await ref.update({ brief: text, briefAt: nowIso || new Date().toISOString(), briefDate: plan.date, briefModel: model });
      plan.brief = text;
      written++;
    } catch (err) {
      logger.warn('[dailyBrief] brief failed', { planId: plan.id, error: err.message });
    }
  }
  return written;
}

module.exports = { briefPlans, briefPrompt, MAX_BRIEFS_PER_RUN };
