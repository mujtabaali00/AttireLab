import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    // Handle the @/* path alias from tsconfig
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        // Jest-specific tsconfig overrides
        module: 'CommonJS',
        moduleResolution: 'node',
        jsx: 'react-jsx',
      },
    }],
  },
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/*.test.ts',
    '**/*.test.tsx',
  ],
  // Exclude Next.js build artifacts and node_modules
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  // Collect coverage from lib/ and app/api/ by default
  collectCoverageFrom: [
    'lib/**/*.ts',
    'app/api/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
}

export default config
