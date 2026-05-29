import * as XLSX from 'xlsx';

const SAMPLE_ROWS = [
  ['Material de construção', 'Cimento Portland CP II', 'saco 50kg', '32,50'],
  ['Serviço', 'Execução de alvenaria', 'm²', '85,00'],
];

/** Generates CSV template content for licitacao item import */
export function generateCsvTemplate(): Buffer {
  const header = 'categoria,descricao,unidade,valor';
  const lines = SAMPLE_ROWS.map((row) => row.join(','));
  return Buffer.from([header, ...lines].join('\n'), 'utf-8');
}

/** Generates XLSX template buffer for licitacao item import */
export function generateXlsxTemplate(): Buffer {
  const data = [['categoria', 'descricao', 'unidade', 'valor'], ...SAMPLE_ROWS];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Itens');
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}
