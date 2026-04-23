const TYPE_LABEL: Record<string, string> = {
  comment: 'comment',
  review: 'review',
  status_change: 'status change',
  priority_change: 'priority change',
  review_requested: 'review request',
  mentioned: 'mention',
  assigned: 'assignment',
  pr: 'PR update',
  issue: 'issue update',
  watching: 'activity',
  direct: 'message',
};

export function humanizeType(type: string): string {
  return TYPE_LABEL[type] ?? type.replace(/_/g, ' ');
}
