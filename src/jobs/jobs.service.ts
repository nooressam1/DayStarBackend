import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../Resend/emailservice';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private isRunning = false;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly emailService: EmailService,
  ) {}

  // Run every 30 seconds to pick up pending background jobs
  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleCron() {
    if (this.isRunning) {
      this.logger.debug('Previous job processor cycle is still running. Skipping iteration.');
      return;
    }

    this.isRunning = true;
    try {
      await this.processPendingJobs();
    } catch (err: any) {
      this.logger.error(`Error in job processor cycle: ${err.message}`, err.stack);
    } finally {
      this.isRunning = false;
    }
  }

  async processPendingJobs() {
    // 1. Pick up pending jobs
    const { data: pendingJobs, error } = await this.supabaseService.admin
      .from('jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5);

    if (error) {
      this.logger.error(`Failed to fetch pending jobs: ${error.message}`);
      return;
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return;
    }

    this.logger.log(`[Job Processor] Found ${pendingJobs.length} pending job(s) to process.`);

    // 2. Process each job
    for (const job of pendingJobs) {
      await this.processJob(job);
    }
  }

  private async processJob(job: any) {
    const jobId = job.id;
    this.logger.log(`[Job ${jobId}] Starting processing for job type: "${job.type}"`);

    // Step A: Mark status as 'processing'
    await this.supabaseService.admin
      .from('jobs')
      .update({
        status: 'processing',
        attempts: (job.attempts || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    try {
      // Step B: Dispatch based on job type
      if (job.type === 'sale_notification') {
        await this.handleSaleNotificationJob(job);
      } else {
        this.logger.warn(`[Job ${jobId}] Unknown job type: "${job.type}"`);
      }

      // Step C: Mark status as 'completed'
      await this.supabaseService.admin
        .from('jobs')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      this.logger.log(`[Job ${jobId}] Successfully completed job "${job.type}".`);
    } catch (err: any) {
      this.logger.error(`[Job ${jobId}] Failed to process job: ${err.message}`, err.stack);

      // Mark status as 'failed' with error message
      await this.supabaseService.admin
        .from('jobs')
        .update({
          status: 'failed',
          error_message: err.message || 'Unknown processing error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }
  }

  private async handleSaleNotificationJob(job: any) {
    const payload = job.payload || {};
    const productId = payload.product_id;
    const productName = payload.product_name || 'Skincare Product';

    if (!productId) {
      throw new Error('Missing product_id in job payload');
    }

    this.logger.log(
      `[Job ${job.id}] Finding subscribers for on-sale product "${productName}" (${productId})...`
    );

    // 1. Query matching favorites using indexed columns
    const { data: matchingFavorites, error: favError } = await this.supabaseService.admin
      .from('favorites')
      .select('id, user_id, notify_on_sale, last_notified_at')
      .eq('product_id', productId)
      .eq('notify_on_sale', true);

    if (favError) {
      throw new Error(`Failed to query favorites: ${favError.message}`);
    }

    if (!matchingFavorites || matchingFavorites.length === 0) {
      this.logger.log(`[Job ${job.id}] No users have favorited "${productName}" with sale notifications enabled.`);
      return;
    }

    this.logger.log(`[Job ${job.id}] Found ${matchingFavorites.length} user(s) to notify.`);

    // 2. Process in batches of 5 to respect Resend rate limits
    const BATCH_SIZE = 5;
    const PAUSE_MS = 600; // 600ms delay between emails

    let sentCount = 0;
    let failCount = 0;

    for (let i = 0; i < matchingFavorites.length; i += BATCH_SIZE) {
      const batch = matchingFavorites.slice(i, i + BATCH_SIZE);

      for (const fav of batch) {
        try {
          // Fetch user profile/email from Supabase Auth
          const { data: userData, error: userError } = await this.supabaseService.admin.auth.admin.getUserById(fav.user_id);

          if (userError || !userData?.user?.email) {
            this.logger.warn(`Could not resolve email for user ID ${fav.user_id}: ${userError?.message || 'No email'}`);
            failCount++;
            continue;
          }

          const email = userData.user.email;
          const customerName =
            userData.user.user_metadata?.full_name ||
            userData.user.user_metadata?.name ||
            email.split('@')[0];

          // Send the branded sale email via Resend
          await this.emailService.sendSaleAlert(email, payload, customerName);
          sentCount++;

          // Update last_notified_at on this favorite row so we have a record
          await this.supabaseService.admin
            .from('favorites')
            .update({ last_notified_at: new Date().toISOString() })
            .eq('id', fav.id);

          // Rate-limiting delay
          await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
        } catch (emailErr: any) {
          this.logger.error(`Failed to send sale alert for user ${fav.user_id}: ${emailErr.message}`);
          failCount++;
        }
      }
    }

    this.logger.log(
      `[Job ${job.id}] Sale notification dispatch finished. Sent: ${sentCount}, Failed: ${failCount}`
    );
  }
}
