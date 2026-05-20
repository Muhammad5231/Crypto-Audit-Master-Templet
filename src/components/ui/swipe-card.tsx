'use client'

import { useCallback, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Reusable Swipe Card Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// A card container that supports touch swipe gestures for navigating
// between items. Shows one card at a time with position indicator.
//
// Features:
// - Touch event handlers for swipe detection (onTouchStart/Move/End)
// - Minimum swipe distance threshold (50px)
// - Smooth CSS transition on card movement
// - Drag-follow effect while swiping
// - Position indicator ("Item X of Y")
// - Previous/Next arrow buttons
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MIN_SWIPE_DISTANCE = 50

interface SwipeCardProps {
  children: React.ReactNode
  currentIndex: number
  totalCount: number
  onSwipeLeft: () => void
  onSwipeRight: () => void
  positionLabel?: string
  className?: string
}

export function SwipeCard({
  children,
  currentIndex,
  totalCount,
  onSwipeLeft,
  onSwipeRight,
  positionLabel,
  className,
}: SwipeCardProps) {
  const touchStartX = useRef<number>(0)
  const touchStartY = useRef<number>(0)
  const touchCurrentX = useRef<number>(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    touchCurrentX.current = e.touches[0].clientX
    setIsDragging(true)
    setSwipeDirection(null)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX
    const deltaX = touchCurrentX.current - touchStartX.current
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current)

    // Only track horizontal swipes (not vertical scrolling)
    if (deltaY > Math.abs(deltaX) && Math.abs(deltaX) < 20) return

    setDragOffset(deltaX)
    setSwipeDirection(deltaX > 0 ? 'right' : 'left')
  }, [])

  const handleTouchEnd = useCallback(() => {
    const deltaX = touchCurrentX.current - touchStartX.current

    setIsDragging(false)
    setDragOffset(0)
    setSwipeDirection(null)

    if (Math.abs(deltaX) >= MIN_SWIPE_DISTANCE) {
      if (deltaX < 0 && currentIndex < totalCount - 1) {
        onSwipeLeft()
      } else if (deltaX > 0 && currentIndex > 0) {
        onSwipeRight()
      }
    }
  }, [currentIndex, totalCount, onSwipeLeft, onSwipeRight])

  const label = positionLabel ?? `Item ${currentIndex + 1} of ${totalCount}`

  return (
    <div className={cn('flex flex-col items-center gap-4 w-full', className)}>
      {/* Swipeable Card Container */}
      <div
        className="w-full overflow-hidden rounded-2xl touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="w-full transition-transform"
          style={{
            transform: isDragging
              ? `translateX(${dragOffset}px)`
              : swipeDirection === 'left'
                ? 'translateX(-30px)'
                : swipeDirection === 'right'
                  ? 'translateX(30px)'
                  : 'translateX(0)',
            transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          }}
        >
          {children}
        </div>
      </div>

      {/* Position & Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={onSwipeRight}
          disabled={currentIndex === 0}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors',
            currentIndex === 0
              ? 'opacity-30 cursor-not-allowed'
              : 'hover:bg-accent active:bg-accent/80'
          )}
          aria-label="Previous"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <span className="text-sm font-medium text-muted-foreground min-w-[100px] text-center">
          {label}
        </span>

        <button
          onClick={onSwipeLeft}
          disabled={currentIndex === totalCount - 1}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors',
            currentIndex === totalCount - 1
              ? 'opacity-30 cursor-not-allowed'
              : 'hover:bg-accent active:bg-accent/80'
          )}
          aria-label="Next"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Dot indicators */}
      {totalCount > 1 && totalCount <= 10 && (
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalCount }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === currentIndex
                  ? 'w-6 bg-teal-500'
                  : 'w-1.5 bg-muted-foreground/30'
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}
