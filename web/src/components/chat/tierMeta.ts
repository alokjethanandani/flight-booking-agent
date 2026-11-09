import type { OfferTier } from '@/lib/api'

export const TIER_META: Record<OfferTier, { variant: 'success' | 'warning' | 'alert'; label: string }> = {
  eligible: { variant: 'success', label: 'Meets your configured rules' },
  tolerance: { variant: 'warning', label: 'Over budget. Approval required' },
  rejected: { variant: 'alert', label: 'Does not meet a required rule' },
}
