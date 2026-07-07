/**
 * Helper centralisé pour extraire un message lisible d'une erreur typée `unknown`.
 * Conforme à la règle Core : `catch (error: unknown)`.
 *
 * Gère les cas :
 * - Error natif (Error, TypeError, ...)
 * - PostgrestError (objet { message, ... })
 * - FunctionsHttpError / FunctionsError (Supabase)
 * - String / objet quelconque (fallback JSON.stringify)
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const obj = error as { message?: unknown; error?: unknown };
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}
