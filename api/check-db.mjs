import { PrismaClient } from './generated/prisma/index.js';
const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres@localhost:5432/gestao_de_obras_db' } }
});
try {
  const r = await p.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  if (r.length === 0) console.log('Nenhuma tabela encontrada!');
  else r.forEach(x => console.log(x.table_name));
} catch (e) {
  console.error('ERRO:', e.message);
} finally {
  await p.$disconnect();
}
