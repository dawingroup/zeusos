/**
 * The WRITER CONTRACT for person references.
 *
 * Every stored `createdBy` / `approvedBy` / `assignedTo` / `postedBy` carries a
 * Firebase Auth uid or an employee doc id. Staff surfaces resolve those
 * through the shared people directory, but react-pdf documents, the client
 * portal and server-generated notifications cannot look anyone up — so a
 * writer that stores a person reference also stores the display name beside
 * it (`createdByName`, `assignedToName`, …), from the session actor at write
 * time.
 *
 * `name` is REQUIRED here on purpose: a caller that has no name for the
 * actor should be a compile error, not a silently blank field.
 */
export interface ActorRef {
  uid: string;
  name: string;
  email?: string;
}

/**
 * Build an ActorRef from a Firebase Auth user (or any `{uid, displayName,
 * email}` shape). Falls back to the email's local part, then to "Zeus
 * staff" — never to the uid.
 */
export function actorRef(user: {
  uid: string;
  displayName?: string | null;
  email?: string | null;
}): ActorRef {
  const name = user.displayName?.trim() || user.email?.split('@')[0]?.trim() || 'Zeus staff';
  return { uid: user.uid, name, email: user.email ?? undefined };
}

/** `{ createdBy, createdByName }`-style pair for spreading into a doc. */
export function stampActor<K extends string>(field: K, actor: ActorRef): Record<K | `${K}Name`, string> {
  return { [field]: actor.uid, [`${field}Name`]: actor.name } as Record<K | `${K}Name`, string>;
}
