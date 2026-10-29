const test = require('node:test');
const assert = require('node:assert/strict');

const { isMachineActor, MACHINE_ACTOR_PATTERNS } = require('../../src/approvals/policy');

test('isMachineActor: placeholders, agents, system actors and nobody are all non-human', () => {
  for (const v of ['current-user', 'user', 'system', 'system:marketing', 'agent:ZA-001', 'mcp-agent', 'SYSTEM_SEED', 'seed-script', 'unknown', '', '   ', null, undefined, 42]) {
    assert.equal(isMachineActor(v), true, `${String(v)} should be a machine actor`);
  }
});

test('isMachineActor: a Firebase uid is a person', () => {
  assert.equal(isMachineActor('K3jd92nfA0sdf8sdf'), false);
  assert.equal(isMachineActor('user-am-1'), false, 'a uid that merely CONTAINS "user" is still a uid');
});

test('the pattern list is what the client mirror pins (count + sources)', () => {
  assert.equal(MACHINE_ACTOR_PATTERNS.length, 9);
  assert.deepEqual(MACHINE_ACTOR_PATTERNS.map((re) => re.source), [
    '^mcp-agent$', '^agent:', '^system:', '^SYSTEM_', '^seed-script$', '^unknown$', '^current-user$', '^user$', '^system$',
  ]);
});
