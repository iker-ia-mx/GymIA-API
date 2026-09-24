import { IsIn, IsOptional } from 'class-validator';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png'] as const;

export class CreateUploadUrlDto {
  @IsOptional()
  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType?: (typeof ALLOWED_CONTENT_TYPES)[number];
}
