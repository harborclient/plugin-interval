import { buildRenderer } from '@harborclient/sdk/build';

await buildRenderer({
  jsxRuntime: 'runtime',
  aliasReactTo: '@harborclient/sdk/react',
  external: ['react-dom'],
  watch: process.argv.includes('--watch')
});
