import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { CreateSquadDto } from './dto/create-squad.dto.js';
import { CreateSquadPostDto } from './dto/create-squad-post.dto.js';
import { JoinSquadDto } from './dto/join-squad.dto.js';
import { SquadService } from './squad.service.js';

// Feed: solo texto + tipo, con likes, sin comentarios ni multimedia (MVP
// aprobado, docs/ESCUADRON_PRODUCT_SPEC.md §13). Sin retos/eventos, sin
// administración de escuadrón — fuera del MVP.
@UseGuards(JwtAuthGuard)
@Controller('squad')
export class SquadController {
  constructor(private readonly squadService: SquadService) {}

  @Post()
  createSquad(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSquadDto) {
    return this.squadService.createSquad(user.id, dto);
  }

  @Post('join')
  joinSquad(@CurrentUser() user: AuthenticatedUser, @Body() dto: JoinSquadDto) {
    return this.squadService.joinSquad(user.id, dto);
  }

  @Delete('leave')
  leaveSquad(@CurrentUser() user: AuthenticatedUser) {
    return this.squadService.leaveSquad(user.id);
  }

  @Get('me')
  getMySquad(@CurrentUser() user: AuthenticatedUser) {
    return this.squadService.getMySquad(user.id);
  }

  @Get('members')
  listMembers(@CurrentUser() user: AuthenticatedUser) {
    return this.squadService.listMembers(user.id);
  }

  @Get('members/:userId')
  getMemberProfile(@CurrentUser() user: AuthenticatedUser, @Param('userId') targetUserId: string) {
    return this.squadService.getMemberProfile(user.id, targetUserId);
  }

  // ---- Feed ----

  @Post('posts')
  createPost(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSquadPostDto) {
    return this.squadService.createPost(user.id, dto);
  }

  @Get('posts')
  listPosts(@CurrentUser() user: AuthenticatedUser) {
    return this.squadService.listPosts(user.id);
  }

  @Post('posts/:id/like')
  likePost(@CurrentUser() user: AuthenticatedUser, @Param('id') postId: string) {
    return this.squadService.likePost(user.id, postId);
  }

  @Delete('posts/:id/like')
  unlikePost(@CurrentUser() user: AuthenticatedUser, @Param('id') postId: string) {
    return this.squadService.unlikePost(user.id, postId);
  }
}
