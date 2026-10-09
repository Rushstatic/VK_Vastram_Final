/**
 * Universal Slug Generator for VK VASTRAM
 */

export function generateSlug(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Resolve unique slug by checking existing records
 */
export async function resolveUniqueSlug(
  baseName: string,
  checkExistsFn: (candidateSlug: string) => Promise<boolean>
): Promise<string> {
  const baseSlug = generateSlug(baseName) || 'item';
  let candidate = baseSlug;
  let counter = 2;

  while (await checkExistsFn(candidate)) {
    candidate = `${baseSlug}-${counter}`;
    counter++;
  }

  return candidate;
}
