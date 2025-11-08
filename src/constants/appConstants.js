// src/constants/appConstants.js
export const APP_CONSTANTS = {
  // Real-time channel names
  CHANNELS: {
    USER_POSITIONS: 'user_positions_changes',
    ROOM_MEMBERSHIPS: 'user_room_memberships_changes',
    ALL_ROOM_MEMBERSHIPS: 'all_room_memberships_changes',
    ROOM_UPDATES: 'room_updates_changes',
    CHAT_MESSAGES: 'chat_messages',
    PRIVATE_MESSAGES: 'private_messages',
    FRIENDSHIP_EVENTS: 'friendship_events_changes'
  },

  // Timing constants
  TIMING: {
    USER_MOVEMENT_INTERVAL: 3000, // 3 seconds
    MESSAGE_CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutes
    FRIENDSHIP_GLOW_DURATION: 5000, // 5 seconds
    TWINKLE_DURATION: 3000 // 3 seconds
  },

  // UI constants
  UI: {
    CURRENT_USER_STAR_SIZE: 30,
    OTHER_USER_STAR_SIZE: 22,
    DEFAULT_LUMINOSITY: 0.8,
    TWINKLE_LUMINOSITY: 1.5
  }
};