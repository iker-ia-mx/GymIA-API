import { Module } from '@nestjs/common';
import { AdherenceModule } from '../adherence/adherence.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { CoachChatService } from './coach-chat.service.js';
import { CoachController } from './coach.controller.js';
import { CoachQuotaService } from './coach-quota.service.js';
import { CoachService } from './coach.service.js';
import { LlmProviderFactory } from './llm/llm-provider.factory.js';
import { AnthropicProvider } from './llm/providers/anthropic.provider.js';
import { AzureOpenAiProvider } from './llm/providers/azure-openai.provider.js';
import { GeminiProvider } from './llm/providers/gemini.provider.js';
import { NullLlmProvider } from './llm/providers/null.provider.js';
import { OpenAiProvider } from './llm/providers/openai.provider.js';

@Module({
  imports: [AuthModule, AdherenceModule],
  controllers: [CoachController],
  providers: [
    CoachService,
    CoachChatService,
    CoachQuotaService,
    LlmProviderFactory,
    OpenAiProvider,
    AzureOpenAiProvider,
    AnthropicProvider,
    GeminiProvider,
    NullLlmProvider,
  ],
  exports: [CoachService, CoachChatService],
})
export class CoachModule {}
