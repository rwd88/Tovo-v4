module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    // If you ever alias prisma imports, adjust this; otherwise it won’t affect your current setup
    '^@/lib/prisma$': '<rootDir>/lib/prisma',
  },
};
