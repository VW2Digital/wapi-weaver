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
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@tanstack/react-start/server$": "<rootDir>/tests/__mocks__/react-start-server.js",
  },
};
