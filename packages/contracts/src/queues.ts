export const QUEUE_NAMES = {
  notifications: 'notifications',
  deadLetter: 'notifications-dead-letter',
} as const;

export const JOB_NAMES = {
  sendNotification: 'send-notification',
  deadLetterNotification: 'dead-letter-notification',
} as const;

export const REALTIME_CHANNEL = 'pulseflow:events';

export const DEFAULT_JOB_OPTIONS = {
  attempts: 4,
  backoff: {
    type: 'exponential' as const,
    delay: 1_500,
  },
  removeOnComplete: 250,
  removeOnFail: 500,
} as const;
