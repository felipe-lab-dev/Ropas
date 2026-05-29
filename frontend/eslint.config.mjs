// Flat config para ESLint 9 + Next 16.
// Reemplaza al `.eslintrc.json` legacy (`next/core-web-vitals` + `next/typescript`),
// que dejó de funcionar al actualizar a ESLint 9 (eslintrc deprecado) y Next 16
// (que removió el comando `next lint`). `eslint-config-next` v16 exporta flat configs.
import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

export default [
  // Ignores globales (un objeto solo-`ignores` aplica a todo el run).
  {
    ignores: [
      '.next/**',
      'out/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  ...coreWebVitals,
  ...typescript,

  // Calibración para este repo.
  {
    rules: {
      // Reglas nuevas del React Compiler que llegaron con eslint-plugin-react-hooks
      // (vía Next 16). El código se escribió para React 19 ANTES de estas reglas, así que
      // las dejamos como `warn` (visibles, no bloquean CI) para abordarlas de forma
      // incremental en vez de frenar todo de golpe. Subir a `error` cuando se limpien.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/incompatible-library': 'warn',
    },
  },
];
