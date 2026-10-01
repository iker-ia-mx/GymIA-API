import { IsIn, Length } from 'class-validator';

// Tipos tal como los define docs/ESCUADRON_PRODUCT_SPEC.md §6 (SquadPost) —
// mismos 3 valores que muestra el composer de Crear Publicación en Figma
// (138:6348). Feed del MVP: solo texto + tipo, sin multimedia, sin
// hashtags (docs/ESCUADRON_PRODUCT_SPEC.md §13).
const SQUAD_POST_TYPES = ['entrenamiento', 'comida', 'progreso'] as const;

export class CreateSquadPostDto {
  @IsIn(SQUAD_POST_TYPES)
  type!: (typeof SQUAD_POST_TYPES)[number];

  @Length(1, 500)
  text!: string;
}
