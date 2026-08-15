import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { EmailService } from '../Resend/emailservice';

@Module({
  providers: [JobsService, EmailService],
  exports: [JobsService],
})
export class JobsModule {}
