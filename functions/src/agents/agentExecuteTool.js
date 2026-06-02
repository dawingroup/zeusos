/**
 * agentExecuteTool — onCall wrapper around the dispatcher. One callable, every
 * tool: { agentId, toolId, input }. The dispatcher does permission + autoActMode
 * gating + audit, then routes to the handler. Auth: any signed-in staff user
 * (recorded on the audit row as the human who invoked the agent).
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { dispatch, DispatcherError } = require('./dispatcher');
const { getToolSchema, validateAgainstSchema } = require('./toolCatalog');

exports.agentExecuteTool = onCall(
  { region: 'europe-west1', timeoutSeconds: 60, memory: '256MiB' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to invoke an agent tool.');
    }
    const { agentId, toolId, input } = request.data || {};
    if (!agentId || !toolId) {
      throw new HttpsError('invalid-argument', 'agentId and toolId are required');
    }

    const schemaEntry = getToolSchema(toolId);
    if (schemaEntry) {
      try {
        validateAgainstSchema(input || {}, schemaEntry.input_schema);
      } catch (validationErr) {
        throw new HttpsError('invalid-argument', `Invalid input for ${toolId}: ${validationErr.message}`);
      }
    }

    try {
      return await dispatch({ agentId, toolId, input }, { userId: request.auth.uid });
    } catch (err) {
      if (err instanceof DispatcherError) {
        const httpsCode = {
          'not-found': 'not-found',
          'permission-denied': 'permission-denied',
          'failed-precondition': 'failed-precondition',
          internal: 'internal',
        }[err.code] || 'internal';
        logger.warn('[agentExecuteTool] dispatcher refused', { agentId, toolId, code: err.code });
        throw new HttpsError(httpsCode, err.message);
      }
      logger.error('[agentExecuteTool] unexpected error', err);
      throw new HttpsError('internal', err.message || 'Agent tool invocation failed');
    }
  },
);
