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
import { CreateRecipeDto } from './dto/create-recipe.dto.js';
import { UpdateFoodDto } from './dto/update-food.dto.js';
import { UpdateRecipeDto } from './dto/update-recipe.dto.js';
import { UpsertMealScheduleEntryDto } from './dto/upsert-meal-schedule.dto.js';

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

// Snapshot de macros para una cantidad dada de un Food — mismo cálculo que
// ya usaba addMealItem, extraído para reutilizarlo también en recetas.
function scaleMacros(
  food: { caloriesKcal: number; proteinG: number; carbsG: number; fatG: number; servingSizeG: number | null },
  quantityG: number,
) {
  const servingSizeG = food.servingSizeG ?? DEFAULT_SERVING_SIZE_G;
  const multiplier = quantityG / servingSizeG;
  return {
    caloriesKcal: food.caloriesKcal * multiplier,
    proteinG: food.proteinG * multiplier,
    carbsG: food.carbsG * multiplier,
    fatG: food.fatG * multiplier,
  };
}

function sumMacros<T extends { caloriesKcal: number; proteinG: number; carbsG: number; fatG: number }>(
  items: T[],
) {
  return items.reduce(
    (sum, item) => ({
      caloriesKcal: sum.caloriesKcal + item.caloriesKcal,
      proteinG: sum.proteinG + item.proteinG,
      carbsG: sum.carbsG + item.carbsG,
      fatG: sum.fatG + item.fatG,
    }),
    { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

const recipeInclude = {
  ingredients: {
    include: {
      food: { select: { id: true, name: true } },
    },
  },
};

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

    return this.prisma.mealItem.create({
      data: {
        mealId,
        foodId: food.id,
        quantityG: dto.quantityG,
        ...scaleMacros(food, dto.quantityG),
      },
    });
  }

  async updateMealItemQuantity(
    userId: string,
    mealId: string,
    itemId: string,
    quantityG: number,
  ) {
    const meal = await this.getMealById(userId, mealId);
    const item = meal.items.find((mealItem) => mealItem.id === itemId);
    if (!item) {
      throw new NotFoundException('Meal item not found in this meal');
    }

    const food = await this.getFoodById(userId, item.foodId);

    return this.prisma.mealItem.update({
      where: { id: itemId },
      data: {
        quantityG,
        ...scaleMacros(food, quantityG),
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

  // "Repetir esta comida" (s01-context-menu en Figma, adaptado a comidas ya
  // registradas — ver nota de honestidad en el plan maestro): clona una
  // comida existente como una comida nueva de hoy, con snapshots
  // independientes (no comparte MealItem con el original).
  async duplicateMeal(userId: string, mealId: string) {
    const meal = await this.getMealById(userId, mealId);

    return this.prisma.meal.create({
      data: {
        userId,
        mealType: meal.mealType,
        items: {
          create: meal.items.map((item) => ({
            foodId: item.foodId,
            quantityG: item.quantityG,
            caloriesKcal: item.caloriesKcal,
            proteinG: item.proteinG,
            carbsG: item.carbsG,
            fatG: item.fatG,
          })),
        },
      },
      include: mealInclude,
    });
  }

  // "Guardar como receta" (s01-context-menu): convierte los ítems ya
  // registrados de una comida en una Recipe reutilizable.
  async createRecipeFromMeal(userId: string, mealId: string, name: string) {
    const meal = await this.getMealById(userId, mealId);
    if (meal.items.length === 0) {
      throw new ConflictException('This meal has no items to save as a recipe');
    }

    return this.prisma.recipe.create({
      data: {
        userId,
        name,
        ingredients: {
          create: meal.items.map((item) => ({
            foodId: item.foodId,
            quantityG: item.quantityG,
            caloriesKcal: item.caloriesKcal,
            proteinG: item.proteinG,
            carbsG: item.carbsG,
            fatG: item.fatG,
          })),
        },
      },
      include: recipeInclude,
    });
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

  // ---- Recipes ----

  private async buildIngredientRows(userId: string, ingredients: { foodId: string; quantityG: number }[]) {
    return Promise.all(
      ingredients.map(async (input) => {
        const food = await this.getFoodById(userId, input.foodId);
        return {
          foodId: food.id,
          quantityG: input.quantityG,
          ...scaleMacros(food, input.quantityG),
        };
      }),
    );
  }

  async createRecipe(userId: string, dto: CreateRecipeDto) {
    const ingredientRows = await this.buildIngredientRows(userId, dto.ingredients);

    return this.prisma.recipe.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        prepTimeMin: dto.prepTimeMin,
        difficulty: dto.difficulty,
        ingredients: { create: ingredientRows },
      },
      include: recipeInclude,
    });
  }

  async getRecipes(userId: string) {
    const recipes = await this.prisma.recipe.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: recipeInclude,
    });

    return recipes.map((recipe) => ({
      ...recipe,
      totals: sumMacros(recipe.ingredients),
    }));
  }

  async getRecipeById(userId: string, id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: recipeInclude,
    });
    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }
    if (recipe.userId !== userId) {
      throw new ForbiddenException('This recipe does not belong to you');
    }
    return { ...recipe, totals: sumMacros(recipe.ingredients) };
  }

  async updateRecipe(userId: string, id: string, dto: UpdateRecipeDto) {
    await this.getRecipeById(userId, id);

    const ingredientRows = dto.ingredients
      ? await this.buildIngredientRows(userId, dto.ingredients)
      : undefined;

    const recipe = await this.prisma.recipe.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.prepTimeMin !== undefined ? { prepTimeMin: dto.prepTimeMin } : {}),
        ...(dto.difficulty !== undefined ? { difficulty: dto.difficulty } : {}),
        ...(dto.isFavorite !== undefined ? { isFavorite: dto.isFavorite } : {}),
        ...(ingredientRows
          ? { ingredients: { deleteMany: {}, create: ingredientRows } }
          : {}),
      },
      include: recipeInclude,
    });

    return { ...recipe, totals: sumMacros(recipe.ingredients) };
  }

  async deleteRecipe(userId: string, id: string) {
    await this.getRecipeById(userId, id);
    await this.prisma.recipe.delete({ where: { id } });
    return { id };
  }

  // "Duplicar" en Screen-4-Detalle-Receta.
  async duplicateRecipe(userId: string, id: string) {
    const recipe = await this.getRecipeById(userId, id);

    const created = await this.prisma.recipe.create({
      data: {
        userId,
        name: `${recipe.name} (copia)`,
        description: recipe.description,
        prepTimeMin: recipe.prepTimeMin,
        difficulty: recipe.difficulty,
        ingredients: {
          create: recipe.ingredients.map((ingredient) => ({
            foodId: ingredient.foodId,
            quantityG: ingredient.quantityG,
            caloriesKcal: ingredient.caloriesKcal,
            proteinG: ingredient.proteinG,
            carbsG: ingredient.carbsG,
            fatG: ingredient.fatG,
          })),
        },
      },
      include: recipeInclude,
    });

    return { ...created, totals: sumMacros(created.ingredients) };
  }

  // "Añadir" en Screen-4-Detalle-Receta: registra la receta como una comida
  // de hoy, con snapshots propios (independientes de ediciones futuras a la
  // receta o a los Food subyacentes).
  async addRecipeToDiary(userId: string, id: string, mealType: string) {
    const recipe = await this.getRecipeById(userId, id);

    return this.prisma.meal.create({
      data: {
        userId,
        mealType,
        items: {
          create: recipe.ingredients.map((ingredient) => ({
            foodId: ingredient.foodId,
            quantityG: ingredient.quantityG,
            caloriesKcal: ingredient.caloriesKcal,
            proteinG: ingredient.proteinG,
            carbsG: ingredient.carbsG,
            fatG: ingredient.fatG,
          })),
        },
      },
      include: mealInclude,
    });
  }

  // ---- Meal schedule ----

  getMealSchedule(userId: string) {
    return this.prisma.mealScheduleEntry.findMany({
      where: { userId },
      orderBy: { timeOfDay: 'asc' },
    });
  }

  upsertMealScheduleEntry(userId: string, dto: UpsertMealScheduleEntryDto) {
    return this.prisma.mealScheduleEntry.upsert({
      where: { userId_mealType: { userId, mealType: dto.mealType } },
      create: {
        userId,
        mealType: dto.mealType,
        enabled: dto.enabled ?? true,
        timeOfDay: dto.timeOfDay,
        reminderEnabled: dto.reminderEnabled ?? true,
      },
      update: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        timeOfDay: dto.timeOfDay,
        ...(dto.reminderEnabled !== undefined ? { reminderEnabled: dto.reminderEnabled } : {}),
      },
    });
  }
}
