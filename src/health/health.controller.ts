import { Controller, Get } from '@nestjs/common';

/** Public liveness check — no auth required. */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
