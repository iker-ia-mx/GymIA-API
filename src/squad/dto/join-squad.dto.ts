import { IsString, Length } from 'class-validator';

export class JoinSquadDto {
  @IsString()
  @Length(6, 12)
  inviteCode!: string;
}
