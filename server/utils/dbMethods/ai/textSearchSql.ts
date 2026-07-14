import { sql } from 'drizzle-orm';
import { isUuid } from './sourceIds';

export function buildSourceIdExclusionSql(alias: 'r' | 'a', sourceIds: string[]) {
  const validSourceIds = sourceIds.filter(isUuid);
  if (validSourceIds.length === 0) return sql``;

  const uuidArray = sql`ARRAY[${sql.join(
    validSourceIds.map((sourceId) => sql`${sourceId}`),
    sql`, `
  )}]::uuid[]`;

  return alias === 'r'
    ? sql`AND NOT (r."id" = ANY(${uuidArray}))`
    : sql`AND NOT (a."id" = ANY(${uuidArray}))`;
}
