/**
 * onTaskWritten — one trigger on every `generated_tasks` write, sending the
 * notices lib/taskNotice.js plans: a task landing on someone (created, handed
 * over, reopened), an overdue task escalating (assignee + manager), and a
 * task put on hold with a reason (the person who can unblock it).
 *
 * One trigger instead of edits to every task writer — tasks are created by
 * the event engine, agents, the callables and the sweeps. Notice ids are
 * deterministic per moment, so a retried write notifies nobody twice.
 */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

const { TASKS_COLLECTION } = require('../lib/taskModel');
const { planTaskNotices, notifyTaskChange } = require('../lib/taskNotice');

if (!admin.apps.length) admin.initializeApp();

const onTaskWritten = onDocumentWritten(
  { document: `${TASKS_COLLECTION}/{taskId}`, region: 'europe-west1', timeoutSeconds: 60, memory: '256MiB' },
  async (event) => {
    const taskId = event.params.taskId;
    const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
    const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
    if (!planTaskNotices(before, after, taskId).length) return null;
    try {
      const results = await notifyTaskChange(admin.firestore(), taskId, before, after, { logger });
      logger.info('[onTaskWritten] notices', { taskId, results });
    } catch (err) {
      logger.warn('[onTaskWritten] failed', { taskId, error: err.message });
    }
    return null;
  },
);

module.exports = { onTaskWritten };
