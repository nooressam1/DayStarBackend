import { IsNotEmpty, IsString, MaxLength, IsEmail, IsOptional, IsIn, IsUUID } from 'class-validator';

export class CreateContactSubmissionDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  subject: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  message: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;
}

export class UpdateContactSubmissionDto {
  @IsOptional()
  @IsString()
  @IsIn(['pending', 'in_progress', 'resolved'])
  status?: 'pending' | 'in_progress' | 'resolved';

  @IsOptional()
  @IsString()
  resolved_at?: string;
}
