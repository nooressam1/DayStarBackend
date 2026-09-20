import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { Review } from './review.interface';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  // 1. Get reviews for a specific product
  async getReviews(productId: string): Promise<Review[]> {
    const { data, error } = await this.supabaseService.admin
      .from('review')
      .select('*, profile(username)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(Failed to fetch reviews: );
    }

    return (data || []) as Review[];
  }

  // 2. Get featured text reviews for testimonials
  async getFeaturedReviews(limit = 10): Promise<Review[]> {
    const { data, error } = await this.supabaseService.admin
      .from('review')
      .select(
        id,
        product_id,
        user_id,
        rating,
        title,
        body,
        comment,
        created_at,
        date,
        timestamp,
        profile:user_id ( username ),
        product:product_id ( name, slug )
      )
      .not('body', 'is', null)
      .neq('body', '')
      .gte('rating', 4)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error('Failed to fetch featured reviews:', error);
      return [];
    }

    return (data || []) as Review[];
  }

  // 3. Create a review and update product stats
  async createReview(
    productId: string,
    userId: string,
    reviewData: CreateReviewDto,
  ): Promise<Review> {
    const now = new Date();
    const dateEpoch = Math.floor(now.getTime() / 1000);
    const timeString = now.toTimeString().split(' ')[0];

    const reviewToInsert = {
      product_id: productId,
      user_id: userId,
      rating: reviewData.rating,
      title: reviewData.title,
      body: reviewData.body,
      comment: reviewData.body,
      date: dateEpoch,
      timestamp: timeString,
    };

    const { data, error } = await this.supabaseService.admin
      .from('review')
      .insert(reviewToInsert)
      .select('*, profile(username)')
      .single();

    if (error) {
      throw new InternalServerErrorException(Failed to create review: );
    }

    // Recalculate and update rating & reviews_count on the product table
    await this.updateProductRatingStats(productId);

    return data as Review;
  }

  // 4. Update product rating stats on the product table
  async updateProductRatingStats(productId: string): Promise<{ rating: number; reviews_count: number }> {
    const { data: reviews, error } = await this.supabaseService.admin
      .from('review')
      .select('rating')
      .eq('product_id', productId);

    if (error) {
      this.logger.error(Failed to fetch reviews to update stats for product :, error);
      return { rating: 0, reviews_count: 0 };
    }

    const reviewsCount = reviews?.length || 0;
    const avgRating = reviewsCount > 0
      ? Math.round((reviews!.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviewsCount) * 10) / 10
      : 0;

    const { error: updateError } = await this.supabaseService.admin
      .from('product')
      .update({
        rating: avgRating,
        reviews_count: reviewsCount,
      })
      .eq('id', productId);

    if (updateError) {
      this.logger.error(Failed to update rating stats for product :, updateError);
    }

    return { rating: avgRating, reviews_count: reviewsCount };
  }
}
