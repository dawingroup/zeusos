/**
 * Messaging module — Phase 4.1 (internal team chat).
 * Barrel exports for types, services, pages.
 */

export * from './types/internalChat';
export {
  subscribeToChannels,
  subscribeToChannel,
  subscribeToChannelMessages,
  subscribeToUnreadChannelCount,
  createChannel,
  getOrCreateDM,
  sendChatMessage,
  markChannelRead,
  archiveChannel,
} from './services/internalChatService';
export { startPresenceHeartbeat, subscribeToPresence } from './services/presenceService';
export { subscribeStaff } from './services/staff-directory.service';
export { isPushSupported, getPermissionStatus, subscribeToPush } from './services/pushNotification.service';
export { PushRegistrar } from './components/PushRegistrar';
