# Team Chat — permissions model

The internal Team Chat (`chatChannels` + `presence`) uses **client-direct
Firestore writes** (no Cloud Function in the send path), so `firestore.rules`
is the entire authorization boundary. This documents what's enforced.

## Who is "staff"

```
isStaffAuth()  ==  isAuthenticated() && !isAnonymousAuth()
```

Every chat read/write requires a real (non-anonymous) signed-in user. Portal /
anonymous clients are rejected outright.

## `chatChannels/{channelId}`

| Op | Rule |
|---|---|
| **read** | staff **and** `uid ∈ memberIds` — only members see a channel. |
| **create** | staff, **and** the caller seeds themselves into `memberIds`, **and** `createdBy == caller`, **and** `type ∈ {channel, dm}`. |
| **update** | staff, **and** caller `∈ memberIds`, **and** `createdBy` unchanged (immutable), **and** *either* `memberIds` unchanged *or* caller is the channel creator/admin. |
| **delete** | staff, **and** caller is the channel creator or an admin. |

**Why the update split:** every member needs to write the common fields —
their own read cursor (`lastReadBy.{uid}`), the denormalised
`lastMessage*`, a rename — so those are allowed whenever membership is
unchanged. But **changing who is in the channel** (adding/removing members) is
restricted to the creator or an admin, so a regular member can't add themselves
to a channel they aren't in or eject others. `createdBy` can never be
reassigned.

> Note: the rules can't cheaply diff individual map keys, so "membership
> unchanged" is enforced at the whole-`memberIds`-array level. A member editing
> only their read cursor passes (array identical); any membership edit requires
> creator/admin. This is intentionally strict — broadening to "a member may add
> a member" would be a Cloud-Function path with its own checks.

## `chatChannels/{channelId}/messages/{messageId}`

| Op | Rule |
|---|---|
| **read** | staff **and** caller `∈` the parent channel's `memberIds`. |
| **create** | staff, **and** `senderId == caller`, **and** caller `∈ memberIds`. |
| **update / delete** | **always denied.** Messages are append-only; moderation/edits, if ever needed, go through an admin Cloud Function. |

## `presence/{uid}`

| Op | Rule |
|---|---|
| **read** | any staff (the roster + DM presence dots). |
| **write** | staff **and** `uid == caller` — you may only write your own presence. |

## Roles & escalation

- **Member** — read/post in their channels; bump their own read cursor; rename a
  channel; start DMs (a DM is just a 2-member channel they create).
- **Channel creator** — everything a member can, plus add/remove members and
  delete the channel.
- **Admin** (`isAdmin()`) — may delete/manage any channel (moderation).

There is no separate "post-only" or "read-only" channel tier yet; membership is
the grant. If channel-level roles (e.g. announce-only) are needed later, add a
`postRoles[]`/`readonly` field to the channel doc and gate message `create` on
it — the rules structure already isolates the message-create clause.
