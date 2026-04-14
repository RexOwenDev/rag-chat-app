import { z } from 'zod';

export const analyticsQuerySchema = z.object({
  dateRange: z.enum(['7d', '30d']).default('7d'),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
