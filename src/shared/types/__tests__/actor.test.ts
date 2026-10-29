import { describe, it, expect } from 'vitest';
import { actorRef, stampActor } from '../actor';

describe('actorRef', () => {
  it('uses the display name, then the email local part, never the uid', () => {
    expect(actorRef({ uid: 'u1', displayName: 'Jane Okello', email: 'jane@zeustheagency.com' }).name).toBe('Jane Okello');
    expect(actorRef({ uid: 'u1', displayName: '  ', email: 'jane@zeustheagency.com' }).name).toBe('jane');
    expect(actorRef({ uid: 'u1' }).name).toBe('Zeus staff');
  });
  it('stamps the id and the name as a pair', () => {
    expect(stampActor('createdBy', { uid: 'u1', name: 'Jane' })).toEqual({ createdBy: 'u1', createdByName: 'Jane' });
  });
});
