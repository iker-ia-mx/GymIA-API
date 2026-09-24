import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AddMealItemDto } from './dto/add-meal-item.dto.js';
import { CreateFoodDto } from './dto/create-food.dto.js';
import { CreateMealDto } from './dto/create-meal.dto.js';
import { CreateNutritionGoalDto } from './dto/create-nutrition-goal.dto.js';
import { UpdateFoodDto } from './dto/update-food.dto.js';

const DEFAULT_SERVING_SIZE_G = 100;

const mealInclude = {
  items: {
    include: {
      food: { select: { id: true, name: true } },
    },
  },
};

function getStartOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

@Injectable()
export class NutritionService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Food ----

  createFood(userId: string, dto: CreateFoodDto) {
    return this.prisma.food.create({
      data: {
        userId,
        name: dto.name,
        caloriesKcal: dto.caloriesKcal,
        proteinG: dto.proteinG,
        carbsG: dto.carbsG,
        fatG: dto.fatG,
        servingSizeG: dto.servingSizeG,
      },
    });
  }

  getFoods(userId: string) {
    return this.prisma.food.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  async getFoodById(userId: string, id: string) {
    const food = await this.prisma.food.findUnique({ where: { id } });
    if (!food) {
      throw new NotFoundException('Food not found');
    }
    if (food.userId !== userId) {
      throw new ForbiddenException('This food does not belong to you');
    }
    return food;
  }

  async updateFood(userId: string, id: string, dto: UpdateFoodDto) {
    await this.getFoodById(userId, id);

    return this.prisma.food.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.caloriesKcal !== undefined ? { caloriesKcal: dto.caloriesKcal } : {}),
        ...(dto.proteinG !== undefined ? { proteinG: dto.proteinG } : {}),
        ...(dto.carbsG !== undefined ? { carbsG: dto.carbsG } : {}),
        ...(dto.fatG !== undefined ? { fatG: dto.fatG } : {}),
        ...(dto.servingSizeG !== undefined ? { servingSizeG: dto.servingSizeG } : {}),
      },
    });
  }

  async deleteFood(userId: string, id: string) {
    await this.getFoodById(userId, id);

    const usageCount = await this.prisma.mealItem.count({ where: { foodId: id } });
    if (usageCount > 0) {
      throw new ConflictException(
        'This food is used in existing meals and cannot be deleted',
      );
    }

    await this.prisma.food.delete({ where: { id } });
    return { id };
  }

  // ---- Meal ----

  createMeal(userId: string, dto: CreateMealDto) {
    return this.prisma.meal.create({
      data: {
        userId,
        mealType: dto.mealType,
        ...(dto.loggedAt ? { loggedAt: new Date(dto.loggedAt) } : {}),
      },
      include: mealInclude,
    });
  }

  getMeals(userId: string) {
    return this.prisma.meal.findMany({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
      include: mealInclude,
    });
  }

  async getMealById(userId: string, id: string) {
    const meal = await this.prisma.meal.findUnique({
      where: { id },
      include: mealInclude,
    });

    if (!meal) {
      throw new NotFoundException('Meal not found');
    }
    if (meal.userId !== userId) {
      throw new ForbiddenException('This meal does not belong to you');
    }

    return meal;
  }

  async deleteMeal(userId: string, id: string) {
    await this.getMealById(userId, id);

    // MealItem tiene onDelete: Cascade hacia Meal, así que sus ítems se
    // eliminan automáticamente junto con la comida.
    await this.prisma.meal.delete({ where: { id } });
    return { id };
  }

  async addMealItem(userId: string, mealId: string, dto: AddMealItemDto) {
    await this.getMealById(userId, mealId);
    const food = await this.getFoodById(userId, dto.foodId);

    const servingSizeG = food.servingSizeG ?? DEFAULT_SERVING_SIZE_G;
    const multiplier = dto.quantityG / servingSizeG;

    return this.prisma.mealItem.create({
      data: {
        mealId,
        foodId: food.id,
        quantityG: dto.quantityG,
        caloriesKcal: food.caloriesKcal * multiplier,
        proteinG: food.proteinG * multiplier,
        carbsG: food.carbsG * multiplier,
        fatG: food.fatG * multiplier,
      },
    });
  }

  async deleteMealItem(userId: string, mealId: string, itemId: string) {
    const meal = await this.getMealById(userId, mealId);

    const item = meal.items.find((mealItem) => mealItem.id === itemId);
    if (!item) {
      throw new NotFoundException('Meal item not found in this meal');
    }

    await this.prisma.mealItem.delete({ where: { id: itemId } });
    return { id: itemId };
  }

  // ---- NutritionGoal ----

  createOrUpdateGoal(userId: string, dto: CreateNutritionGoalDto) {
    return this.prisma.nutritionGoal.upsert({
      where: { userId },
      create: {
        userId,
        dailyCaloriesKcal: dto.dailyCaloriesKcal,
        proteinG: dto.proteinG,
        carbsG: dto.carbsG,
        fatG: dto.fatG,
      },
      update: {
        dailyCaloriesKcal: dto.dailyCaloriesKcal,
        proteinG: dto.proteinG,
        carbsG: dto.carbsG,
        fatG: dto.fatG,
      },
    });
  }

  getMyGoal(userId: string) {
    return this.prisma.nutritionGoal.findUnique({ where: { userId } });
  }

  // ---- Dashboard ----

  async getTodaySummary(userId: string) {
    const startOfDay = getStartOfTodayUTC();
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const [meals, goal] = await Promise.all([
      this.prisma.meal.findMany({
        where: { userId, loggedAt: { gte: startOfDay, lt: endOfDay } },
        include: { items: true },
      }),
      this.prisma.nutritionGoal.findUnique({ where: { userId } }),
    ]);

    const allItems = meals.flatMap((meal) => meal.items);
    const rawTotals = allItems.reduce(
      (sum, item) => ({
        totalCaloriesKcal: sum.totalCaloriesKcal + item.caloriesKcal,
        totalProteinG: sum.totalProteinG + item.proteinG,
        totalCarbsG: sum.totalCarbsG + item.carbsG,
        totalFatG: sum.totalFatG + item.fatG,
      }),
      { totalCaloriesKcal: 0, totalProteinG: 0, totalCarbsG: 0, totalFatG: 0 },
    );

    // Redondeo a 1 decimal antes de exponer — mismo patrón que EvolutionService
    // (Math.round(x * 10) / 10), evita artefactos de punto flotante como
    // 5.6000000000000005 en la respuesta.
    const totals = {
      totalCaloriesKcal: Math.round(rawTotals.totalCaloriesKcal * 10) / 10,
      totalProteinG: Math.round(rawTotals.totalProteinG * 10) / 10,
      totalCarbsG: Math.round(rawTotals.totalCarbsG * 10) / 10,
      totalFatG: Math.round(rawTotals.totalFatG * 10) / 10,
    };

    return {
      date: startOfDay.toISOString(),
      ...totals,
      mealCount: meals.length,
      goal,
    };
  }
}
