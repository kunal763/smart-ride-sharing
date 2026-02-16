import { RideCompletionService } from './RideCompletionService';

/**
 * Cron service to run periodic tasks
 */
export class CronService {
  private completionService: RideCompletionService;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 60000; // Check every 1 minute

  constructor() {
    this.completionService = new RideCompletionService();
  }

  /**
   * Start the cron service
   */
  start(): void {
    if (this.intervalId) {
      console.log('⚠️  Cron service already running');
      return;
    }

    console.log('🕐 Starting cron service (checking every 1 minute)...');
    
    // Run immediately on start
    this.runTasks();

    // Then run every minute
    this.intervalId = setInterval(() => {
      this.runTasks();
    }, this.CHECK_INTERVAL_MS);

    console.log('✓ Cron service started');
  }

  /**
   * Stop the cron service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('✓ Cron service stopped');
    }
  }

  /**
   * Run all periodic tasks
   */
  private async runTasks(): Promise<void> {
    try {
      // Auto-complete expired rides
      const count = await this.completionService.completeExpiredRides();
      
      if (count > 0) {
        console.log(`[${new Date().toISOString()}] Auto-completed ${count} ride(s)`);
      }
    } catch (error) {
      console.error('[Cron] Error running tasks:', error);
    }
  }
}
