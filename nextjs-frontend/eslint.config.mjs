import next from 'eslint-config-next';
import prettier from 'eslint-config-prettier';

const eslintConfig = [
  ...next,
  prettier,
  {
    rules: {
      // React Compiler advisories added in eslint-plugin-react-hooks 7. The existing
      // chat code (streaming, scroll and editor sync) relies on these patterns;
      // refactor them with tests rather than blindly, then turn these back to 'error'.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'next-env.d.ts'],
  },
];

export default eslintConfig;
