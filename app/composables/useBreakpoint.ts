import { onMounted, onUnmounted } from 'vue'
import { useUiStore } from '../stores/ui'

// Sync the ui-store breakpoint from the viewport width (UI §12). Breakpoints (design §5): <768 sm,
// 768–1119 md, ≥1120 lg. Chart-option classes read `ui.breakpoint` via ChartContext to adapt label
// rotation / legend / grid margins. Client-only (no window on the server).
export function useBreakpoint(): void {
  const ui = useUiStore()
  if (import.meta.server) return

  const compute = () => {
    const w = window.innerWidth
    ui.setBreakpoint(w < 768 ? 'sm' : w < 1120 ? 'md' : 'lg')
  }

  onMounted(() => {
    compute()
    window.addEventListener('resize', compute, { passive: true })
  })
  onUnmounted(() => window.removeEventListener('resize', compute))
}
