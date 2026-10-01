// Guardarraíl determinista sobre el texto del LLM (DEC-014 · 04.04). El
// prompt ya pide texto plano en 2-3 frases; esto lo garantiza aunque el
// modelo no obedezca: quita markdown, emojis y títulos, junta todo en un
// párrafo y corta a 3 frases. Si la respuesta se truncó por max_tokens,
// descarta la última frase incompleta. Nunca añade contenido.
export const MAX_REPLY_SENTENCES = 3;

const EMOJI =
  /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|\u{FE0F}|\u{200D}|\u{20E3}/gu;

export type GuardedReply = { text: string; modified: boolean };

export function guardCoachReply(
  raw: string,
  stopReason: string | null,
): GuardedReply {
  let text = raw
    .replace(EMOJI, '')
    .replace(/^\s{0,3}#{1,6}\s+.*$/gm, '') // líneas de título
    .replace(/^\s*(?:[-*•+]|\d+[.)])\s+/gm, '') // viñetas / listas
    .replace(/\*\*|__|`+|~~/g, '') // énfasis y código
    .replace(/(^|\s)[*_]+(?=\S)|(?<=\S)[*_]+(?=\s|$|[.,;:!?])/g, '$1')
    .replace(/^\s*>\s?/gm, '') // citas
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  let sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    stopReason === 'max_tokens' &&
    sentences.length > 1 &&
    !/[.!?]$/.test(sentences[sentences.length - 1])
  ) {
    sentences = sentences.slice(0, -1);
  }
  const limited = sentences.slice(0, MAX_REPLY_SENTENCES).join(' ').trim();
  text = limited || text;
  return { text, modified: text !== raw.trim() };
}
