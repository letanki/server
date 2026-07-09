// Bootstrap de produção: registra o alias @/* apontando para os .js buildados
// (dist/src) antes de carregar o servidor. Necessário porque o tsconfig.json
// mapeia @/* para as fontes .ts em src/, que não existem no runtime de produção.
const path = require("path");

require("tsconfig-paths").register({
  baseUrl: path.join(__dirname, "dist"),
  paths: { "@/*": ["*"] },
});

require("./dist/server.js");
