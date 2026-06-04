const path = require('path');
const { PrismaClient } = require(path.join(__dirname, 'generated/prisma/index.js'));
const p = new PrismaClient();
p.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name")
  .then(r => {
    if (r.length === 0) console.log('Nenhuma tabela encontrada!');
    else r.forEach(x => console.log(x.table_name));
    p.$disconnect();
  })
  .catch(e => { console.error('ERRO:', e.message); p.$disconnect(); });
