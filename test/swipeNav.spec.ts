import { describe, it, expect, vi } from 'vitest'
import { useSwipeNav, type SwipeNavCallbacks } from '../app/composables/useSwipeNav'

// A minimal PointerEvent-shaped stub. `currentTarget` reports the panel width the gesture measures
// against (200px here → the 50% commit threshold is 100px) and swallows `setPointerCapture`.
function evt(x: number, y = 0): PointerEvent {
  const target = { clientWidth: 200, setPointerCapture: () => {}, closest: () => null }
  return { clientX: x, clientY: y, pointerId: 1, target, currentTarget: target } as unknown as PointerEvent
}

function make(over: Partial<SwipeNavCallbacks> = {}) {
  const onCommit = vi.fn()
  const nav = useSwipeNav({
    enabled: () => true,
    canPrev: () => true,
    canNext: () => true,
    onCommit,
    ...over,
  })
  return { nav, onCommit }
}

describe('useSwipeNav', () => {
  it('follows the finger once a horizontal drag is locked in', () => {
    const { nav } = make()
    nav.onPointerDown(evt(100))
    nav.onPointerMove(evt(60)) // dx -40 → horizontal, locks
    expect(nav.dragging.value).toBe(true)
    expect(nav.dragX.value).toBe(-40)
  })

  it('a >50% left drag commits to the next slide (after the settle transition)', () => {
    const { nav, onCommit } = make()
    nav.onPointerDown(evt(100))
    nav.onPointerMove(evt(-30)) // dx -130 (> 100)
    nav.onPointerUp()
    expect(nav.animating.value).toBe(true)
    expect(nav.dragX.value).toBe(-200) // settling to full width
    nav.onTransitionEnd()
    expect(onCommit).toHaveBeenCalledWith('next')
  })

  it('a >50% right drag commits to the previous slide', () => {
    const { nav, onCommit } = make()
    nav.onPointerDown(evt(100))
    nav.onPointerMove(evt(230)) // dx +130
    nav.onPointerUp()
    nav.onTransitionEnd()
    expect(onCommit).toHaveBeenCalledWith('prev')
  })

  it('a sub-50% drag springs back and commits nothing', () => {
    const { nav, onCommit } = make()
    nav.onPointerDown(evt(100))
    nav.onPointerMove(evt(40)) // dx -60 (< 100)
    nav.onPointerUp()
    expect(nav.animating.value).toBe(true)
    expect(nav.dragX.value).toBe(0)
    nav.onTransitionEnd()
    expect(onCommit).not.toHaveBeenCalled()
    expect(nav.animating.value).toBe(false)
  })

  it('clamps the dead edge — no next means a left drag cannot move', () => {
    const { nav, onCommit } = make({ canNext: () => false })
    nav.onPointerDown(evt(100))
    nav.onPointerMove(evt(-50)) // would be dx -150 but clamped
    expect(nav.dragX.value).toBe(0)
    nav.onPointerUp()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('ignores a vertical gesture so the page can scroll', () => {
    const { nav } = make()
    nav.onPointerDown(evt(100, 100))
    nav.onPointerMove(evt(95, 160)) // dy 60 > dx 5 → vertical, bail
    expect(nav.dragging.value).toBe(false)
    expect(nav.dragX.value).toBe(0)
  })

  it('does not start a gesture when disabled (desktop)', () => {
    const { nav } = make({ enabled: () => false })
    nav.onPointerDown(evt(100))
    nav.onPointerMove(evt(40))
    expect(nav.dragX.value).toBe(0)
  })
})
