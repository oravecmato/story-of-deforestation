// Number formatting (tech-spec §11.5, ADR-018). The SINGLE path for turning a number into display
// text — components and chart-option classes never format inline. Purely numeric and
// locale-agnostic: international compact notation (`3.2M`, `820k`, `1.1B`), never locale-formatted.
// Units are i18n keys resolved by the CALLER (ADR-011) and concatenated with the formatted number;
// the Formatter never touches i18n.
export interface FormatOptions {
  fractionDigits?: number
}

export abstract class Formatter {
  /** null / non-finite → 'n/a'. */
  abstract format(value: number | null, opts?: FormatOptions): string

  /** Convenience: the multiplier framing, fixed to 1 decimal, e.g. '×3.2'. */
  multiplier(value: number): string {
    return `×${value.toFixed(1)}`
  }
}

// The ONLY concrete implementation in V1. A locale-aware / higher-precision variant is a drop-in
// subclass with no call-site changes.
export class CompactNumberFormatter extends Formatter {
  format(value: number | null, opts?: FormatOptions): string {
    if (value === null || !Number.isFinite(value)) return 'n/a'
    const text = new Intl.NumberFormat('en', {
      notation: 'compact',
      maximumFractionDigits: opts?.fractionDigits ?? 1,
    }).format(value)
    // Intl 'en' emits an uppercase thousands suffix; the spec renders it lowercase (`820k`).
    return text.replace(/K$/, 'k')
  }
}
