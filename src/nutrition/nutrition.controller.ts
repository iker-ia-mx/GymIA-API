import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { AddMealItemDto } from './dto/add-meal-item.dto.js';
import { CreateFoodDto } from './dto/create-food.dto.js';
import { CreateMealDto } from './dto/create-meal.dto.js';
import { CreateNutritionGoalDto } from './dto/create-nutrition-goal.dto.js';
import { UpdateFoodDto } from './dto/update-food.dto.js';
import { NutritionService } from './nutrition.service.js';

@UseGuards(JwtAuthGuard)
@Controller()
export class NutritionController {
  constructor(private readonly nutritionService: NutritionService) {}

  // ---- Foods ----

  @Post('foods')
  createFood(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFoodDto) {
    return this.nutritionService.createFood(user.id, dto);
  }

  @Get('foods')
  getFoods(@CurrentUser() user: AuthenticatedUser) {
    return this.nutritionService.getFoods(user.id);
  }

  @Get('foods/:id')
  getFoodById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.nutritionService.getFoodById(user.id, id);
  }

  @Patch('foods/:id')
  updateFood(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateFoodDto,
  ) {
    return this.nutritionService.updateFood(user.id, id, dto);
  }

  @Delete('foods/:id')
  deleteFood(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.nutritionService.deleteFood(user.id, id);
  }

  // ---- Meals ----

  @Post('meals')
  createMeal(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMealDto) {
    return this.nutritionService.createMeal(user.id, dto);
  }

  @Get('meals')
  getMeals(@CurrentUser() user: AuthenticatedUser) {
    return this.nutritionService.getMeals(user.id);
  }

  @Get('meals/:id')
  getMealById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.nutritionService.getMealById(user.id, id);
  }

  @Delete('meals/:id')
  deleteMeal(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.nutritionService.deleteMeal(user.id, id);
  }

  @Post('meals/:id/items')
  addMealItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddMealItemDto,
  ) {
    return this.nutritionService.addMealItem(user.id, id, dto);
  }

  @Delete('meals/:id/items/:itemId')
  deleteMealItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.nutritionService.deleteMealItem(user.id, id, itemId);
  }

  // ---- Nutrition goals ----

  @Post('nutrition-goals')
  createOrUpdateGoal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateNutritionGoalDto,
  ) {
    return this.nutritionService.createOrUpdateGoal(user.id, dto);
  }

  @Get('nutrition-goals/me')
  getMyGoal(@CurrentUser() user: AuthenticatedUser) {
    return this.nutritionService.getMyGoal(user.id);
  }

  // ---- Dashboard ----

  @Get('nutrition/summary/today')
  getTodaySummary(@CurrentUser() user: AuthenticatedUser) {
    return this.nutritionService.getTodaySummary(user.id);
  }
}
