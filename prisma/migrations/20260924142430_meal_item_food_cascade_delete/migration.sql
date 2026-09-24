-- DropForeignKey
ALTER TABLE "MealItem" DROP CONSTRAINT "MealItem_foodId_fkey";

-- AddForeignKey
ALTER TABLE "MealItem" ADD CONSTRAINT "MealItem_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;
