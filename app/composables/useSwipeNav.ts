import { ref, computed, type CSSProperties } from 'vue'

// Touch/pointer swipe navigation for the deck on mobile + tablet (design §5.1). A best-practice Pointer
// Events gesture (works for touch, pen and mouse; `touch-action: pan-y` on the stage lets the browser
// keep vertical page-scroll while we own the horizontal axis) — no dependency, no custom physics.
//
// The active slide is a SINGLE panel that follows the finger horizontally; the dark stage revealed
// behind it IS the "empty next/prev screen" (we cannot pre-render a sibling slide, it has to fetch its
// data first — §17.3). On release: dragged past 50% of the panel width → commit to the next/prev slide
// (animate the panel fully off, then the page swaps the content and calls `reset()` to snap the new
// slide back to centre); otherwise the panel springs back. The first/last slide clamp their dead edge.

export interface SwipeNavCallbacks {
  /** Gate: only run the gesture where the deck is a scroll-flow stack (mobile/tablet), never desktop. */
  enabled: () => boolean
  canPrev: () => boolean
  canNext: () => boolean
  /** Committed past the threshold — the page navigates to the adjacent slug. */
  onCommit: (dir: 'prev' | 'next') => void
}

/** Movement (px) before we decide the gesture is a horizontal swipe vs a vertical scroll. */
const LOCK_SLOP = 8
/** Fraction of the panel width the drag must pass to commit to the next/prev slide. */
const COMMIT_FRACTION = 0.5
/** Interactive descendants whose own horizontal drag/tap must win over a slide swipe. */
const IGNORE_SELECTOR = 'input,textarea,select,button,a,[role="slider"],.p-slider,.p-select'

export function useSwipeNav(cb: SwipeNavCallbacks) {
  /** Horizontal offset of the active panel from centre, px (+ = finger moved right). */
  const dragX = ref(0)
  /** True while a horizontal drag is locked in (used to suppress text selection). */
  const dragging = ref(false)
  /** True while the settle/commit CSS transition is running. */
  const animating = ref(false)

  let startX = 0
  let startY = 0
  let width = 1
  let active = false
  let locked = false
  let pending: 'prev' | 'next' | null = null

  /** Panel transform: translate by the live drag, with a transition only while settling. */
  const panelStyle = computed<CSSProperties>(() => ({
    transform: `translateX(${dragX.value}px)`,
    transition: animating.value ? 'transform 260ms ease' : 'none',
  }))

  function onPointerDown(e: PointerEvent): void {
    if (!cb.enabled() || animating.value) return
    if ((e.target as HTMLElement | null)?.closest(IGNORE_SELECTOR)) return
    width = (e.currentTarget as HTMLElement).clientWidth || 1
    startX = e.clientX
    startY = e.clientY
    active = true
    locked = false
  }

  function onPointerMove(e: PointerEvent): void {
    if (!active) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    if (!locked) {
      if (Math.abs(dx) < LOCK_SLOP && Math.abs(dy) < LOCK_SLOP) return
      if (Math.abs(dy) >= Math.abs(dx)) {
        active = false // a vertical gesture → hand it back to the page for scrolling
        return
      }
      locked = true
      dragging.value = true
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    }
    // Clamp the dead edge: no next → can't drag left; no prev → can't drag right.
    let x = dx
    if (x < 0 && !cb.canNext()) x = 0
    if (x > 0 && !cb.canPrev()) x = 0
    dragX.value = x
  }

  function onPointerUp(): void {
    if (!active) return
    active = false
    if (!locked) return
    locked = false
    dragging.value = false
    const past = Math.abs(dragX.value) >= width * COMMIT_FRACTION
    if (past && dragX.value < 0 && cb.canNext()) settle('next')
    else if (past && dragX.value > 0 && cb.canPrev()) settle('prev')
    else settle(null)
  }

  /** Animate the panel to its resolved resting position; `dir` null = spring back to centre. */
  function settle(dir: 'prev' | 'next' | null): void {
    pending = dir
    const target = dir === 'next' ? -width : dir === 'prev' ? width : 0
    if (dragX.value === target) {
      finish() // nothing to animate (already there / clamped at an edge)
      return
    }
    animating.value = true
    dragX.value = target
  }

  function onTransitionEnd(): void {
    finish()
  }

  function finish(): void {
    if (pending) {
      const dir = pending
      pending = null
      cb.onCommit(dir) // page navigates; it calls reset() once the new slide is mounted
    } else {
      animating.value = false
      dragX.value = 0
    }
  }

  /** Snap back to centre with no animation — called by the page AFTER the slug (and thus the panel's
   *  content) has changed, so the incoming slide appears centred with no flash of the outgoing one. */
  function reset(): void {
    pending = null
    animating.value = false
    dragX.value = 0
  }

  return {
    dragX,
    dragging,
    animating,
    panelStyle,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onTransitionEnd,
    reset,
  }
}
