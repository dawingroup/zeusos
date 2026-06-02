/**
 * Read-handler bundle — one handler per READ_HANDLER_CONFIGS entry, built via
 * the read factory. Adding a read tool is a single line in ./lib/collectionMap.js.
 */
const { createReadHandler } = require('./lib/readFactory');
const { READ_HANDLER_CONFIGS } = require('./lib/collectionMap');

const READ_HANDLERS = {};
for (const [toolId, config] of Object.entries(READ_HANDLER_CONFIGS)) {
  READ_HANDLERS[toolId] = createReadHandler({ toolId, ...config });
}

module.exports = { READ_HANDLERS };
