import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GroqService } from './groq.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [GroqService],
  exports: [GroqService],
})
export class GroqModule {}
