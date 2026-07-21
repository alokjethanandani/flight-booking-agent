import type { OfferTier } from '@/lib/api'

export const TIER_META: Record<OfferTier, { variant: 'success' | 'warning' | 'alert'; label: string }> = {
  eligible: { variant: 'success', label: 'Meets all your rules' },
  tolerance: { variant: 'warning', label: 'Close — over budget, within tolerance' },
  rejected: { variant: 'alert', label: 'Breaks a rule' },
}
