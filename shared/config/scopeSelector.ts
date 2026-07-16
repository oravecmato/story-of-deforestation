import type { DomainId, Scope } from '../types'

// Scope / domain selector config (tech-spec §2.4). The scope and domain axes stay two independent
// state variables (DerivationParams.scope + domainId); this merge is PURELY a UI convenience — one
// dropdown whose entries are the sole mapping from the single control back onto the two variables.

export interface ScopeSelectorOption {
  labelKey: string // i18n key — never a literal label
  divider: boolean // render a simple delimiter before this item
  scope: Scope // 'global' | 'local'
  domainId: DomainId | null // local domain id; null for the global entry
}

// Display order; the dropdown is rendered from this array (no hardcoded strings).
export const SCOPE_SELECTOR_OPTIONS: readonly ScopeSelectorOption[] = [
  { labelKey: 'scope.domain.amazon', divider: false, scope: 'local', domainId: 'amazon' },
  { labelKey: 'scope.domain.congo', divider: false, scope: 'local', domainId: 'congo' },
  { labelKey: 'scope.domain.seasia', divider: false, scope: 'local', domainId: 'seasia' },
  { labelKey: 'scope.domain.other', divider: false, scope: 'local', domainId: 'other_tropical' },
  { labelKey: 'scope.global', divider: true, scope: 'global', domainId: null }, // DEFAULT
]
