module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: "core-no-nest-layer",
      comment:
        "domain/ e application/ ficam sem framework: não importam a camada Nest (backend/src/nest). " +
        "Imports de @nestjs/* e fastify nessas pastas são barrados por backend/src/architecture.test.ts.",
      severity: "error",
      from: { path: "^backend/src/modules/[^/]+/(domain|application)/" },
      to: { path: "^backend/src/nest/" },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    includeOnly: "^(backend/src|packages/.*?/src)",
  },
};
