import { buildClientSchema, getIntrospectionQuery, printSchema, type IntrospectionQuery } from 'graphql';
import * as ops from '@clients/graphql-operations';
import { expect, test } from '@fixtures/base.fixture';

/**
 * Consumer-side contract: the live schema must match the committed baseline in
 * tests/api/__snapshots__/contract/graphql-schema.spec.ts/. An intentional schema change is accepted with
 * `npx playwright test --project=api graphql-schema --update-snapshots`.
 */
test.describe('GraphQL schema contract', () => {
  test('live schema matches the committed baseline @smoke @contract', async ({ graphql }) => {
    const { data, errors } = await graphql.execute<IntrospectionQuery>(getIntrospectionQuery());
    expect(errors).toBeUndefined();
    const sdl = printSchema(buildClientSchema(data!));
    expect(sdl).toMatchSnapshot('graphql-schema.graphql');
  });

  test('operations used by the framework are still valid against the schema', async ({ graphql }) => {
    // An empty-variable run exercises validation of each operation document.
    for (const [name, query] of Object.entries(ops).filter(([, v]) => typeof v === 'string')) {
      const { body } = await graphql.executeRaw(query as string, {});
      const validationErrors = (body.errors ?? []).filter((e) =>
        /Cannot query field|Unknown (type|argument)|Unknown field/.test(e.message),
      );
      expect(validationErrors, `${name} no longer matches the schema`).toEqual([]);
    }
  });
});
