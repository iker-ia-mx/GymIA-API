import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Mock } from 'vitest';
import { NutritionService } from './nutrition.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('NutritionService', () => {
  let service: NutritionService;
  let prisma: {
    food: { create: Mock; findMany: Mock; findUnique: Mock; update: Mock; delete: Mock };
    meal: { create: Mock; findMany: Mock; findUnique: Mock; delete: Mock };
    mealItem: { create: Mock; update: Mock; delete: Mock; count: Mock };
    nutritionGoal: { upsert: Mock; findUnique: Mock };
    recipe: { create: Mock; findMany: Mock; findUnique: Mock; update: Mock; delete: Mock };
    mealScheduleEntry: { findMany: Mock; upsert: Mock };
  };

  const userId = 'user-1';
  const otherUserId = 'user-2';

  const food = {
    id: 'food-1',
    userId,
    name: 'Pechuga de pollo',
    caloriesKcal: 165,
    proteinG: 31,
    carbsG: 0,
    fatG: 3.6,
    servingSizeG: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      food: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
      meal: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
      mealItem: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
      nutritionGoal: { upsert: vi.fn(), findUnique: vi.fn() },
      recipe: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
      mealScheduleEntry: { findMany: vi.fn(), upsert: vi.fn() },
    };

    service = new NutritionService(prisma as unknown as PrismaService);
  });

  describe('Food CRUD', () => {
    it('createFood asocia el alimento al usuario autenticado', async () => {
      prisma.food.create.mockResolvedValue(food);

      await service.createFood(userId, {
        name: 'Pechuga de pollo',
        caloriesKcal: 165,
        proteinG: 31,
        carbsG: 0,
        fatG: 3.6,
      });

      expect(prisma.food.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId, name: 'Pechuga de pollo' }),
      });
    });

    it('getFoodById lanza NotFoundException si no existe', async () => {
      prisma.food.findUnique.mockResolvedValue(null);

      await expect(service.getFoodById(userId, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('getFoodById lanza ForbiddenException si pertenece a otro usuario', async () => {
      prisma.food.findUnique.mockResolvedValue(food);

      await expect(service.getFoodById(otherUserId, food.id)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('updateFood aplica solo los campos enviados', async () => {
      prisma.food.findUnique.mockResolvedValue(food);
      prisma.food.update.mockResolvedValue({ ...food, caloriesKcal: 180 });

      await service.updateFood(userId, food.id, { caloriesKcal: 180 });

      expect(prisma.food.update).toHaveBeenCalledWith({
        where: { id: food.id },
        data: { caloriesKcal: 180 },
      });
    });

    it('deleteFood elimina cuando el alimento no está en uso', async () => {
      prisma.food.findUnique.mockResolvedValue(food);
      prisma.mealItem.count.mockResolvedValue(0);
      prisma.food.delete.mockResolvedValue(food);

      await expect(service.deleteFood(userId, food.id)).resolves.toEqual({ id: food.id });
      expect(prisma.food.delete).toHaveBeenCalledWith({ where: { id: food.id } });
    });

    it('deleteFood lanza ConflictException cuando el alimento ya se usó en una comida', async () => {
      prisma.food.findUnique.mockResolvedValue(food);
      prisma.mealItem.count.mockResolvedValue(2);

      await expect(service.deleteFood(userId, food.id)).rejects.toThrow(ConflictException);
      expect(prisma.food.delete).not.toHaveBeenCalled();
    });
  });

  describe('Meal CRUD', () => {
    function makeMeal(overrides: Partial<Record<string, unknown>> = {}) {
      return {
        id: 'meal-1',
        userId,
        mealType: 'comida',
        loggedAt: new Date(),
        createdAt: new Date(),
        items: [],
        ...overrides,
      };
    }

    it('createMeal asocia la comida al usuario autenticado', async () => {
      prisma.meal.create.mockResolvedValue(makeMeal());

      await service.createMeal(userId, { mealType: 'comida' });

      expect(prisma.meal.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId, mealType: 'comida' }) }),
      );
    });

    it('getMealById lanza ForbiddenException si la comida pertenece a otro usuario', async () => {
      prisma.meal.findUnique.mockResolvedValue(makeMeal());

      await expect(service.getMealById(otherUserId, 'meal-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deleteMeal elimina la comida (sus ítems se van en cascada por Prisma)', async () => {
      prisma.meal.findUnique.mockResolvedValue(makeMeal());
      prisma.meal.delete.mockResolvedValue({});

      await expect(service.deleteMeal(userId, 'meal-1')).resolves.toEqual({ id: 'meal-1' });
      expect(prisma.meal.delete).toHaveBeenCalledWith({ where: { id: 'meal-1' } });
    });

    it('deleteMeal lanza ForbiddenException si la comida pertenece a otro usuario', async () => {
      prisma.meal.findUnique.mockResolvedValue(makeMeal());

      await expect(service.deleteMeal(otherUserId, 'meal-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.meal.delete).not.toHaveBeenCalled();
    });

    it('addMealItem calcula el snapshot de macros según servingSizeG', async () => {
      prisma.meal.findUnique.mockResolvedValue(makeMeal());
      prisma.food.findUnique.mockResolvedValue(food); // servingSizeG: 100
      prisma.mealItem.create.mockResolvedValue({});

      // 150g de un alimento definido por 100g -> multiplicador 1.5
      await service.addMealItem(userId, 'meal-1', { foodId: food.id, quantityG: 150 });

      expect(prisma.mealItem.create).toHaveBeenCalledWith({
        data: {
          mealId: 'meal-1',
          foodId: food.id,
          quantityG: 150,
          caloriesKcal: 165 * 1.5,
          proteinG: 31 * 1.5,
          carbsG: 0,
          fatG: 3.6 * 1.5,
        },
      });
    });

    it('addMealItem usa 100g como referencia por defecto cuando servingSizeG es null', async () => {
      prisma.meal.findUnique.mockResolvedValue(makeMeal());
      prisma.food.findUnique.mockResolvedValue({ ...food, servingSizeG: null });
      prisma.mealItem.create.mockResolvedValue({});

      await service.addMealItem(userId, 'meal-1', { foodId: food.id, quantityG: 200 });

      expect(prisma.mealItem.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ caloriesKcal: 165 * 2 }) }),
      );
    });

    it('addMealItem lanza ForbiddenException si el alimento pertenece a otro usuario', async () => {
      prisma.meal.findUnique.mockResolvedValue(makeMeal());
      prisma.food.findUnique.mockResolvedValue(food);

      await expect(
        service.addMealItem(otherUserId, 'meal-1', { foodId: food.id, quantityG: 100 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deleteMealItem elimina un ítem existente de la comida', async () => {
      const meal = makeMeal({ items: [{ id: 'item-1' }] });
      prisma.meal.findUnique.mockResolvedValue(meal);
      prisma.mealItem.delete.mockResolvedValue({});

      await expect(service.deleteMealItem(userId, 'meal-1', 'item-1')).resolves.toEqual({
        id: 'item-1',
      });
    });

    it('deleteMealItem lanza NotFoundException si el ítem no pertenece a esa comida', async () => {
      prisma.meal.findUnique.mockResolvedValue(makeMeal({ items: [{ id: 'item-1' }] }));

      await expect(service.deleteMealItem(userId, 'meal-1', 'item-missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getTodaySummary', () => {
    it('suma las macros de todos los ítems de las comidas de hoy', async () => {
      prisma.meal.findMany.mockResolvedValue([
        { items: [{ caloriesKcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 }] },
        { items: [{ caloriesKcal: 200, proteinG: 5, carbsG: 40, fatG: 2 }] },
      ]);
      prisma.nutritionGoal.findUnique.mockResolvedValue(null);

      const result = await service.getTodaySummary(userId);

      expect(result.totalCaloriesKcal).toBe(365);
      expect(result.totalProteinG).toBe(36);
      expect(result.totalCarbsG).toBe(40);
      expect(result.totalFatG).toBeCloseTo(5.6);
      expect(result.mealCount).toBe(2);
    });

    it('con un día sin comidas devuelve todo en cero, sin error', async () => {
      prisma.meal.findMany.mockResolvedValue([]);
      prisma.nutritionGoal.findUnique.mockResolvedValue(null);

      const result = await service.getTodaySummary(userId);

      expect(result).toMatchObject({
        totalCaloriesKcal: 0,
        totalProteinG: 0,
        totalCarbsG: 0,
        totalFatG: 0,
        mealCount: 0,
        goal: null,
      });
    });

    it('incluye el objetivo nutricional cuando existe', async () => {
      const goal = { userId, dailyCaloriesKcal: 2000, proteinG: 150, carbsG: null, fatG: null };
      prisma.meal.findMany.mockResolvedValue([]);
      prisma.nutritionGoal.findUnique.mockResolvedValue(goal);

      const result = await service.getTodaySummary(userId);

      expect(result.goal).toEqual(goal);
    });

    it('filtra las comidas por el rango del día actual en UTC', async () => {
      prisma.meal.findMany.mockResolvedValue([]);
      prisma.nutritionGoal.findUnique.mockResolvedValue(null);

      await service.getTodaySummary(userId);

      const call = prisma.meal.findMany.mock.calls[0][0];
      expect(call.where.userId).toBe(userId);
      const { gte, lt } = call.where.loggedAt;
      expect(lt.getTime() - gte.getTime()).toBe(24 * 60 * 60 * 1000);
      expect(gte.getUTCHours()).toBe(0);
      expect(gte.getUTCMinutes()).toBe(0);
    });
  });

  describe('Recipes', () => {
    function makeRecipe(overrides: Partial<Record<string, unknown>> = {}) {
      return {
        id: 'recipe-1',
        userId,
        name: 'Bowl de Pollo',
        description: null,
        prepTimeMin: null,
        difficulty: null,
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ingredients: [
          { id: 'ing-1', recipeId: 'recipe-1', foodId: food.id, quantityG: 150, caloriesKcal: 247.5, proteinG: 46.5, carbsG: 0, fatG: 5.4 },
        ],
        ...overrides,
      };
    }

    it('createRecipe calcula el snapshot de macros de cada ingrediente según servingSizeG', async () => {
      prisma.food.findUnique.mockResolvedValue(food); // servingSizeG: 100
      prisma.recipe.create.mockResolvedValue(makeRecipe());

      await service.createRecipe(userId, {
        name: 'Bowl de Pollo',
        ingredients: [{ foodId: food.id, quantityG: 150 }],
      });

      expect(prisma.recipe.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            name: 'Bowl de Pollo',
            ingredients: {
              create: [
                expect.objectContaining({
                  foodId: food.id,
                  quantityG: 150,
                  caloriesKcal: 165 * 1.5,
                  proteinG: 31 * 1.5,
                  carbsG: 0,
                  fatG: 3.6 * 1.5,
                }),
              ],
            },
          }),
        }),
      );
    });

    it('getRecipes suma los macros de los ingredientes en `totals`', async () => {
      prisma.recipe.findMany.mockResolvedValue([makeRecipe()]);

      const [result] = await service.getRecipes(userId);

      expect(result.totals).toEqual({
        caloriesKcal: 247.5,
        proteinG: 46.5,
        carbsG: 0,
        fatG: 5.4,
      });
    });

    it('getRecipeById lanza ForbiddenException si la receta pertenece a otro usuario', async () => {
      prisma.recipe.findUnique.mockResolvedValue(makeRecipe());

      await expect(service.getRecipeById(otherUserId, 'recipe-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('duplicateRecipe copia los ingredientes con el nombre "(copia)"', async () => {
      prisma.recipe.findUnique.mockResolvedValue(makeRecipe());
      prisma.recipe.create.mockResolvedValue(makeRecipe({ id: 'recipe-2', name: 'Bowl de Pollo (copia)' }));

      await service.duplicateRecipe(userId, 'recipe-1');

      expect(prisma.recipe.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            name: 'Bowl de Pollo (copia)',
            ingredients: { create: [expect.objectContaining({ foodId: food.id, quantityG: 150 })] },
          }),
        }),
      );
    });

    it('addRecipeToDiary crea una comida de hoy con los ingredientes de la receta', async () => {
      prisma.recipe.findUnique.mockResolvedValue(makeRecipe());
      prisma.meal.create.mockResolvedValue({});

      await service.addRecipeToDiary(userId, 'recipe-1', 'cena');

      expect(prisma.meal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            mealType: 'cena',
            items: { create: [expect.objectContaining({ foodId: food.id, quantityG: 150 })] },
          }),
        }),
      );
    });

    it('deleteRecipe lanza NotFoundException si no existe', async () => {
      prisma.recipe.findUnique.mockResolvedValue(null);

      await expect(service.deleteRecipe(userId, 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('duplicateMeal / createRecipeFromMeal (s01-context-menu adaptado)', () => {
    function makeMealWithItems() {
      return {
        id: 'meal-1',
        userId,
        mealType: 'cena',
        loggedAt: new Date(),
        createdAt: new Date(),
        items: [
          { id: 'item-1', mealId: 'meal-1', foodId: food.id, quantityG: 150, caloriesKcal: 247.5, proteinG: 46.5, carbsG: 0, fatG: 5.4 },
        ],
      };
    }

    it('duplicateMeal clona los ítems como una comida nueva del mismo tipo', async () => {
      prisma.meal.findUnique.mockResolvedValue(makeMealWithItems());
      prisma.meal.create.mockResolvedValue({});

      await service.duplicateMeal(userId, 'meal-1');

      expect(prisma.meal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            mealType: 'cena',
            items: { create: [expect.objectContaining({ foodId: food.id, quantityG: 150 })] },
          }),
        }),
      );
    });

    it('createRecipeFromMeal lanza ConflictException si la comida no tiene ítems', async () => {
      prisma.meal.findUnique.mockResolvedValue({ ...makeMealWithItems(), items: [] });

      await expect(service.createRecipeFromMeal(userId, 'meal-1', 'Mi receta')).rejects.toThrow(
        ConflictException,
      );
    });

    it('updateMealItemQuantity recalcula el snapshot con la nueva cantidad', async () => {
      const meal = makeMealWithItems();
      prisma.meal.findUnique.mockResolvedValue(meal);
      prisma.food.findUnique.mockResolvedValue(food); // servingSizeG: 100
      prisma.mealItem.update.mockResolvedValue({});

      await service.updateMealItemQuantity(userId, 'meal-1', 'item-1', 200);

      expect(prisma.mealItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: expect.objectContaining({ quantityG: 200, caloriesKcal: 165 * 2 }),
      });
    });
  });

  describe('Meal schedule', () => {
    it('upsertMealScheduleEntry usa la clave compuesta userId_mealType', async () => {
      prisma.mealScheduleEntry.upsert.mockResolvedValue({});

      await service.upsertMealScheduleEntry(userId, { mealType: 'desayuno', timeOfDay: '08:00' });

      expect(prisma.mealScheduleEntry.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_mealType: { userId, mealType: 'desayuno' } },
        }),
      );
    });
  });
});
