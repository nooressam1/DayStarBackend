import * as Joi from 'joi';

/**
 * Validates environment variables at boot. If any required value is missing or
 * malformed, the app fails to start with a clear error instead of crashing later.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3002),
  SUPABASE_URL: Joi.string().uri().required(),
  SUPABASE_PUBLISHABLE_KEY: Joi.string().required(),
  SUPABASE_SECRET_KEY: Joi.string().required(),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),
});
