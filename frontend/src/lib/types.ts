export const ApplicationStatus = {
  APPLIED:   'applied',
  PENDING:   'pending',
  DRAFT:     'draft',
  INTERVIEW: 'interview',
  OFFER:     'offer',
  REJECTED:  'rejected',
  EXTERNAL:  'external',
} as const;

export type ApplicationStatus = typeof ApplicationStatus[keyof typeof ApplicationStatus];
