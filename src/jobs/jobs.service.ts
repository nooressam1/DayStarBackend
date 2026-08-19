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

  // Run every 20 minutes to automatically deactivate expired discounts
  @Cron('*/20 * * * *')
  async handleDiscountExpirationCron() {
    try {
      const now = new Date().toISOString();
      const { data, error } = await this.supabaseService.admin
        .from('discount')
        .update({ is_active: false })
        .eq('is_active', true)
        .not('active_end_date', 'is', null)
        .lt('active_end_date', now)
        .select('id, code');

      if (error) {
        this.logger.error(`Failed to deactivate expired discounts: ${error.message}`);
      } else if (data && data.length > 0) {
        this.logger.log(
          `[JobsService] Automatically deactivated ${data.length} expired discount(s): ${data.map((d) => d.code).join(', ')}`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Error in discount expiration cron: ${err.message}`);
    }
  }

  async processPendingJobs() {
    // 1. Pick up pending jobs
    const { data: pendingJobs, error } = await this.supabaseService.admin
      .from('jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(20);

    if (error) {
      this.logger.error(`Failed to fetch pending jobs: ${error.message}`);
      return;
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return;
    }

    this.logger.log(`[Job Processor] Found ${pendingJobs.length} pending job(s) to process.`);

    // 2. Separate sale_notification jobs to merge them by user
    const saleJobs = pendingJobs.filter((j) => j.type === 'sale_notification');
    const otherJobs = pendingJobs.filter((j) => j.type !== 'sale_notification');

    if (saleJobs.length > 0) {
      await this.processBatchSaleNotificationJobs(saleJobs);
    }

    for (const job of otherJobs) {
      await this.processGenericJob(job);
    }
  }

  /**
   * Aggregates multiple sale notification jobs and merges on-sale products
   * into a single email per recipient user.
   */
  private async processBatchSaleNotificationJobs(jobs: any[]) {
    const jobIds = jobs.map((j) => j.id);

    // Step A: Mark all batch jobs as 'processing'
    await this.supabaseService.admin
      .from('jobs')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .in('id', jobIds);

    try {
      // Step B: Build a map of product_id -> product payload
      const productMap = new Map<string, any>();
      const productIds: string[] = [];

      for (const job of jobs) {
        const payload = job.payload || {};
        if (payload.product_id) {
          productMap.set(payload.product_id, payload);
          if (!productIds.includes(payload.product_id)) {
            productIds.push(payload.product_id);
          }
        }
      }

      if (productIds.length === 0) {
        await this.supabaseService.admin
          .from('jobs')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .in('id', jobIds);
        return;
      }

      // Step C: Query all subscribers who favorited any of these products
      const { data: matchingFavorites, error: favError } = await this.supabaseService.admin
        .from('favorites')
        .select('id, user_id, product_id, notify_on_sale, last_notified_at')
        .in('product_id', productIds)
        .eq('notify_on_sale', true);

      if (favError) {
        throw new Error(`Failed to query favorites: ${favError.message}`);
      }

      if (!matchingFavorites || matchingFavorites.length === 0) {
        this.logger.log(`[Batch Processor] No subscribers found for ${productIds.length} on-sale product(s).`);
        await this.supabaseService.admin
          .from('jobs')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .in('id', jobIds);
        return;
      }

      // Step D: Group on-sale products by user_id
      const userProductsMap = new Map<string, { favIds: string[]; products: any[] }>();

      for (const fav of matchingFavorites) {
        const prod = productMap.get(fav.product_id);
        if (!prod) continue;

        if (!userProductsMap.has(fav.user_id)) {
          userProductsMap.set(fav.user_id, { favIds: [], products: [] });
        }

        const userEntry = userProductsMap.get(fav.user_id)!;
        userEntry.favIds.push(fav.id);

        if (!userEntry.products.some((p) => p.product_id === prod.product_id)) {
          userEntry.products.push(prod);
        }
      }

      this.logger.log(
        `[Batch Processor] Bundled ${productIds.length} on-sale product(s) across ${userProductsMap.size} user recipient(s).`
      );

      // Step E: Dispatch 1 merged email per user
      const PAUSE_MS = 600; // Rate-limiting delay
      const allProcessedFavIds: string[] = [];
      let sentCount = 0;
      let failCount = 0;

      for (const [userId, { favIds, products }] of userProductsMap.entries()) {
        try {
          const { data: userData, error: userError } =
            await this.supabaseService.admin.auth.admin.getUserById(userId);

          if (userError || !userData?.user?.email) {
            this.logger.warn(`Could not resolve email for user ID ${userId}`);
            failCount++;
            continue;
          }

          const email = userData.user.email;
          const customerName =
            userData.user.user_metadata?.full_name ||
            userData.user.user_metadata?.name ||
            email.split('@')[0];

          // Send 1 single merged email containing all favorited on-sale products
          await this.emailService.sendSaleAlert(email, products, customerName);
          sentCount++;
          allProcessedFavIds.push(...favIds);

          // Rate-limiting delay
          await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
        } catch (emailErr: any) {
          this.logger.error(`Failed to send merged sale alert for user ${userId}: ${emailErr.message}`);
          failCount++;
        }
      }

      // Step F: Update last_notified_at on all notified favorites rows
      if (allProcessedFavIds.length > 0) {
        await this.supabaseService.admin
          .from('favorites')
          .update({ last_notified_at: new Date().toISOString() })
          .in('id', allProcessedFavIds);
      }

      // Step G: Mark all jobs as completed
      await this.supabaseService.admin
        .from('jobs')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .in('id', jobIds);

      this.logger.log(
        `[Batch Processor] Completed ${jobs.length} sale_notification job(s). Emails sent: ${sentCount}, Failed: ${failCount}`
      );
    } catch (err: any) {
      this.logger.error(`[Batch Processor] Failed processing batch sale jobs: ${err.message}`, err.stack);
      await this.supabaseService.admin
        .from('jobs')
        .update({
          status: 'failed',
          error_message: err.message || 'Batch processing error',
          updated_at: new Date().toISOString(),
        })
        .in('id', jobIds);
    }
  }

  private async processGenericJob(job: any) {
    const jobId = job.id;
    this.logger.log(`[Job ${jobId}] Starting generic job processing for type: "${job.type}"`);

    await this.supabaseService.admin
      .from('jobs')
      .update({
        status: 'processing',
        attempts: (job.attempts || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    try {
      this.logger.log(`[Job ${jobId}] Generic job completed.`);
      await this.supabaseService.admin
        .from('jobs')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', jobId);
    } catch (err: any) {
      await this.supabaseService.admin
        .from('jobs')
        .update({ status: 'failed', error_message: err.message, updated_at: new Date().toISOString() })
        .eq('id', jobId);
    }
  }
}
