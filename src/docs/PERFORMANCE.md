# Performance Guidelines

## Optimization Strategies

### 1. Component Optimization
- Use `React.memo` for components that render lists (GlowingPixel, etc.)
- Use `useMemo` for expensive calculations (color, size, friendship checks)
- Use `useCallback` for functions passed as props

### 2. Real-time Optimization
- Debounce rapid real-time updates (room memberships)
- Use selective subscriptions with filters
- Clean up subscriptions properly

### 3. Memory Management
- Limit trail history in GlowingPixel
- Clean up intervals and timeouts
- Use virtual scrolling for large lists

### 4. Network Optimization
- Batch database updates where possible
- Use efficient queries with proper indexes
- Implement optimistic updates for better UX

## Monitoring
- Check React DevTools for unnecessary re-renders
- Monitor network tab for excessive real-time events
- Use console logs to track subscription status