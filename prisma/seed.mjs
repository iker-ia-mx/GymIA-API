import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const exercises = [
  { name: 'Press de Banca', muscleGroup: 'Pecho' },
  { name: 'Press Inclinado con Mancuernas', muscleGroup: 'Pecho' },
  { name: 'Aperturas con Mancuernas', muscleGroup: 'Pecho' },
  { name: 'Press Militar', muscleGroup: 'Hombros' },
  { name: 'Elevaciones Laterales', muscleGroup: 'Hombros' },
  { name: 'Face Pulls', muscleGroup: 'Hombros' },
  { name: 'Dominadas', muscleGroup: 'Espalda' },
  { name: 'Remo con Barra', muscleGroup: 'Espalda' },
  { name: 'Jalón al Pecho', muscleGroup: 'Espalda' },
  { name: 'Sentadilla', muscleGroup: 'Piernas' },
  { name: 'Peso Muerto', muscleGroup: 'Piernas' },
  { name: 'Zancadas', muscleGroup: 'Piernas' },
  { name: 'Curl de Bíceps', muscleGroup: 'Brazos' },
  { name: 'Extensiones de Tríceps', muscleGroup: 'Brazos' },
  { name: 'Fondos en Paralelas', muscleGroup: 'Brazos' },
];

async function main() {
  for (const exercise of exercises) {
    const existing = await prisma.exercise.findFirst({ where: { name: exercise.name } });
    if (!existing) {
      await prisma.exercise.create({ data: exercise });
    }
  }
  const count = await prisma.exercise.count();
  console.log(`Exercise catalog ready: ${count} exercises`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
