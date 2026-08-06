/** @type {import('jest').Config} */
module.exports = {
  roots: ["<rootDir>/tests/jest"],
  testEnvironment: "node",
  testMatch: ["**/*.jest.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          target: "ES2022",
          module: "CommonJS",
          esModuleInterop: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
