import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReviewService } from './review.service';
import { Review } from './review.interface';
import { CreateReviewDto } from './dto/create-review.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  // 1. Featured text reviews for homepage testimonials
  @Get('featured')
  async getFeaturedReviews(@Query('limit') limit?: number): Promise<Review[]> {
    return this.reviewService.getFeaturedReviews(limit ? Number(limit) : 10);
  }

  // 2. Get all reviews for a product
  @Get(':productId')
  async getReviews(@Param('productId') productId: string): Promise<Review[]> {
    return this.reviewService.getReviews(productId);
  }

  // 3. Post a review for a product
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post(':productId')
  @UseGuards(SupabaseAuthGuard)
  async postReview(
    @Param('productId') productId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateReviewDto,
  ): Promise<Review> {
    return this.reviewService.createReview(productId, user.sub, dto);
  }
}
