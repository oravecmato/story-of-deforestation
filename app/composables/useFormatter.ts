import { CompactNumberFormatter, type Formatter } from '../format/Formatter'

// Binds the active Formatter instance (composition root, tech-spec §11.5). Stateless and
// locale-agnostic in V1 → a module singleton. A future locale-aware variant swaps this binding
// with no call-site changes.
const formatter: Formatter = new CompactNumberFormatter()

export const useFormatter = (): Formatter => formatter
