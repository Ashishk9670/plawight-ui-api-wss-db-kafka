import type { CodegenConfig } from '@graphql-codegen/cli';

/** TypeScript types for the GraphQL schema. Source of truth: aut/schema.graphql. Run: npm run gen:graphql-types */
const config: CodegenConfig = {
  schema: 'aut/schema.graphql',
  generates: {
    'schemas/graphql.generated.ts': {
      plugins: ['typescript'],
      config: { scalars: {}, enumsAsTypes: true, avoidOptionals: false, maybeValue: 'T | null' },
    },
  },
};

export default config;
