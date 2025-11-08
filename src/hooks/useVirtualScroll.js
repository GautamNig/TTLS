// src/hooks/useVirtualScroll.js
import { useState, useEffect } from 'react';

export default function useVirtualScroll(items, itemHeight, containerRef) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  
  useEffect(() => {
    if (!containerRef.current) return;

    const calculateVisibleItems = () => {
      const scrollTop = containerRef.current.scrollTop;
      const containerHeight = containerRef.current.clientHeight;
      
      const start = Math.floor(scrollTop / itemHeight);
      const end = Math.ceil((scrollTop + containerHeight) / itemHeight);
      
      setVisibleRange({ 
        start: Math.max(0, start - 5), // Buffer
        end: Math.min(items.length, end + 5) // Buffer
      });
    };

    const container = containerRef.current;
    container.addEventListener('scroll', calculateVisibleItems);
    calculateVisibleItems(); // Initial calculation
    
    return () => container.removeEventListener('scroll', calculateVisibleItems);
  }, [items.length, itemHeight, containerRef]);

  return {
    visibleItems: items.slice(visibleRange.start, visibleRange.end),
    startIndex: visibleRange.start,
    totalHeight: items.length * itemHeight
  };
}