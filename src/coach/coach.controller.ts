import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { CoachChatService } from './coach-chat.service.js';
import { CoachService } from './coach.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';

// Contratos reales para N02/N03 "Hoy", N04 "Coach GymIA · Chat" y N17
// "Revisión semanal del Coach" de GYMIA MASTER FLOW V1. El chat (`GET
// /coach/chat`, `POST /coach/chat/messages`) persiste de verdad en
// `Conversation`/`Message` y ya funciona hoy mismo — responde con la
// decisión real del motor v0 (mismo texto que `/coach/today`) mientras no
// haya un proveedor de LLM conectado (`LlmProviderFactory`,
// `src/coach/llm`). Conectar un proveedor real (04.05 Proveedores y
// costos de IA) no requiere cambiar ni un endpoint de aquí.
@UseGuards(JwtAuthGuard)
@Controller('coach')
export class CoachController {
  constructor(
    private readonly coachService: CoachService,
    private readonly coachChatService: CoachChatService,
  ) {}

  @Get('readiness')
  getReadiness(@CurrentUser() user: AuthenticatedUser) {
    return this.coachService.getReadiness(user.id);
  }

  @Get('today')
  getToday(@CurrentUser() user: AuthenticatedUser) {
    return this.coachService.getTodayDecision(user.id);
  }

  @Get('weekly-review')
  getWeeklyReview(@CurrentUser() user: AuthenticatedUser) {
    return this.coachService.getWeeklyReview(user.id);
  }

  @Get('chat')
  getChat(@CurrentUser() user: AuthenticatedUser) {
    return this.coachChatService.getConversation(user.id);
  }

  @Post('chat/messages')
  sendMessage(@CurrentUser() user: AuthenticatedUser, @Body() dto: SendMessageDto) {
    return this.coachChatService.sendMessage(user.id, dto.text);
  }
}
