import { describe, expect, test } from 'bun:test';
import { PgDialect } from 'drizzle-orm/pg-core';
import { buildSourceIdExclusionSql } from '../utils/dbMethods/ai/textSearchSql';

const dialect = new PgDialect();
const roteId = '4c67fd19-1961-4942-a2ef-f61e203be40f';
const articleId = '2aecb5c7-7b92-4d1c-bf85-2becd86b5a06';

describe('textSearchMemory exclusion queries', () => {
  test.each([
    { sourceType: 'rote' as const, sourceId: roteId, alias: 'r' },
    { sourceType: 'article' as const, sourceId: articleId, alias: 'a' },
  ])('casts $sourceType exclusions to uuid[]', ({ sourceId, alias }) => {
    const query = dialect.sqlToQuery(buildSourceIdExclusionSql(alias, [sourceId]));

    expect(query.sql).toContain(`${alias}."id" = ANY(`);
    expect(query.sql).toContain('::uuid[]');
    expect(query.sql).not.toContain('::text[]');
    expect(query.params).toContain(sourceId);
  });

  test('omits the exclusion clause when no IDs have been seen', () => {
    const query = dialect.sqlToQuery(buildSourceIdExclusionSql('r', []));

    expect(query.sql).toBe('');
    expect(query.params).toEqual([]);
  });
});
