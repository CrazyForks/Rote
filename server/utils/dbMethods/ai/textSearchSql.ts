import { sql } from 'drizzle-orm';

export function buildSourceIdExclusionSql(alias: 'r' | 'a', sourceIds: string[]) {
  if (sourceIds.length === 0) return sql``;

  const uuidArray = sql`ARRAY[${sql.join(
    sourceIds.map((sourceId) => sql`${sourceId}`),
    sql`, `
  )}]::uuid[]`;

  return alias === 'r'
    ? sql`AND NOT (r."id" = ANY(${uuidArray}))`
    : sql`AND NOT (a."id" = ANY(${uuidArray}))`;
}
