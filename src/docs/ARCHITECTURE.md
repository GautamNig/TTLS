# Application Architecture

## Overview
A real-time collaborative space where users are represented as glowing stars that can chat, form friendships, and join rooms.

## Core Technologies
- **Frontend**: React + Vite
- **Backend**: Supabase (PostgreSQL + Real-time)
- **Authentication**: Supabase Auth

## Data Flow
1. User authenticates → `useAuth` hook
2. User position updates → `useUsers` hook + real-time subscriptions
3. Chat messages → `useChat` hook + real-time subscriptions
4. Friendships → `useFriends` hook + RPC calls
5. Rooms → `useRooms` hook + real-time subscriptions

## Key Hooks
- `useAuth`: Authentication state and session management
- `useUsers`: User positions and real-time movement
- `useChat`: Public and private messaging
- `useFriends`: Friendship system and mutual follows
- `useRooms`: Room creation, joining, and management

## Real-time Features
- User positions update every 3 seconds
- Instant message delivery via PostgreSQL real-time
- Live room membership updates
- Friendship notifications

## Performance Optimizations
- React.memo for expensive components
- useCallback for stable function references
- useMemo for expensive calculations
- Debounced real-time updates