/**
 * FadeList.tsx
 * This list is used to fade in the messages when the user scrolls.
 * @AshokSaravanan222
 * 03-24-2025
 */
import React, { useState, useEffect, useRef, Children } from 'react';
import { useDebouncedValue } from '@mantine/hooks';

interface FadeListProps {
    children: React.ReactNode;
    scrollDelay?: number;
    transitionDuration?: number;
    viewDuration?: number;
    enabled?: boolean;
}

export default function FadeList({ 
  children, 
  scrollDelay = 300, 
  transitionDuration = 500,
  viewDuration = 1000,
  enabled = true
}: FadeListProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [debouncedIndex] = useDebouncedValue(activeIndex, 100);
  const containerRef = useRef<HTMLDivElement>(null);
  const childrenRefs = useRef<(HTMLDivElement | null)[]>([]);
  const childrenArray = Children.toArray(children);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const viewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isScrollingRef = useRef(false);

  // Initialize or resize the childrenRefs array when children change
  useEffect(() => {
    childrenRefs.current = childrenRefs.current.slice(0, childrenArray.length);
    while (childrenRefs.current.length < childrenArray.length) {
      childrenRefs.current.push(null);
    }
  }, [childrenArray.length]);

  useEffect(() => {
    if (!enabled) return;
    
    const handleScroll = (e: WheelEvent) => {
      const currentChildRef = childrenRefs.current[activeIndex];
      
      if (!currentChildRef) return;
      
      // Get scroll position details
      const { scrollHeight, scrollTop, clientHeight } = currentChildRef;
      const isAtTop = scrollTop <= 1; // Small threshold for top detection
      const isAtBottom = scrollHeight - scrollTop - clientHeight <= 1; // Small threshold for bottom detection
      
      // Debug information
      console.log('Scroll event', { 
        activeIndex,
        direction: e.deltaY > 0 ? 'down' : 'up',
        isAtTop, 
        isAtBottom,
        scrollTop,
        scrollHeight,
        clientHeight,
        isScrollingRef: isScrollingRef.current
      });
      
      // Allow normal scrolling if not at edges
      if ((e.deltaY > 0 && !isAtBottom) || (e.deltaY < 0 && !isAtTop)) {
        return; // Let the default scroll behavior happen
      }
      
      // Only handle edge cases
      if ((e.deltaY > 0 && isAtBottom && activeIndex < childrenArray.length - 1) || 
          (e.deltaY < 0 && isAtTop && activeIndex > 0)) {
        
        e.preventDefault();
        e.stopPropagation();
        
        // Ensure we're not already in a transition
        if (!isScrollingRef.current) {
          isScrollingRef.current = true;
          
          // Update index based on scroll direction
          const newIndex = e.deltaY > 0 
            ? Math.min(activeIndex + 1, childrenArray.length - 1)
            : Math.max(activeIndex - 1, 0);
          
          console.log('Changing index from', activeIndex, 'to', newIndex);
          setActiveIndex(newIndex);
          
          // Reset scrolling lock after delay
          if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
          scrollTimeoutRef.current = setTimeout(() => {
            isScrollingRef.current = false;
            console.log('Scroll lock released');
          }, scrollDelay);
        }
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleScroll, { passive: false });
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleScroll);
      }
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [childrenArray.length, scrollDelay, enabled, activeIndex]);

  // Update active index when children change
  useEffect(() => {
    if (activeIndex >= childrenArray.length) {
      setActiveIndex(Math.max(0, childrenArray.length - 1));
    }
  }, [childrenArray.length, activeIndex]);

  // Reset scroll position when active index changes
  useEffect(() => {
    const currentChildRef = childrenRefs.current[debouncedIndex];
    if (currentChildRef) {
      currentChildRef.scrollTop = 0;
    }
  }, [debouncedIndex]);

  // If not enabled, render children normally
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div 
      ref={containerRef} 
      className="relative overflow-hidden"
      style={{ 
        height: '100%', 
        width: '100%',
        position: 'relative'
      }}
    >
      {childrenArray.map((child, index) => (
        <div
          key={index}
          ref={el => {
            childrenRefs.current[index] = el
          }}
          className="absolute w-full overflow-auto"
          style={{
            opacity: index === debouncedIndex ? 1 : 0,
            pointerEvents: index === debouncedIndex ? 'auto' : 'none',
            transition: `opacity ${transitionDuration}ms ease-in-out`,
            transform: `translateY(${(index - debouncedIndex) * 20}px)`,
            zIndex: childrenArray.length - index,
            // Instead of fixed height, use top/bottom positioning
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            // Ensure scrollbars are visible when needed
            overflowY: 'auto',
            overflowX: 'hidden'
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}