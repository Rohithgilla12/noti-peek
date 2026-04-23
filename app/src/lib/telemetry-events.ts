import { captureEvent } from './telemetry';
import type { WorkLinkPair } from './types';

export function trackCrossBundleRendered(count: number) {
  if (count > 0) captureEvent('cross_bundle_rendered', { count });
}

export function trackCrossBundleExpanded(pair: WorkLinkPair) {
  captureEvent('cross_bundle_expanded', { pair });
}

export function trackCrossBundleMarkAllRead(pair: WorkLinkPair, childCount: number) {
  captureEvent('cross_bundle_mark_all_read', { pair, child_count: childCount });
}

export function trackSuggestedLinkShown(pair: WorkLinkPair, confidence: number) {
  const bucket: 'high' | 'medium' = confidence >= 0.85 ? 'high' : 'medium';
  captureEvent('suggested_link_shown', { pair, confidence_bucket: bucket });
}

export function trackSuggestedLinkConfirmed(pair: WorkLinkPair) {
  captureEvent('suggested_link_confirmed', { pair });
}

export function trackSuggestedLinkDismissed(pair: WorkLinkPair) {
  captureEvent('suggested_link_dismissed', { pair });
}
