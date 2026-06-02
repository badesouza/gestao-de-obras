/** Splits textarea content into non-empty lines, ignoring trailing blank lines */
export function splitColumnLines(content) {
    if (!content)
        return [];
    const lines = content.split(/\r?\n/).map((line) => line.trim());
    let end = lines.length;
    while (end > 0 && lines[end - 1] === '') {
        end -= 1;
    }
    return lines.slice(0, end);
}
/** Returns true when optional column has at least one non-empty line */
export function isColumnUsed(lines) {
    return lines.some((line) => line.length > 0);
}
/** Validates line parity across used columns and builds aligned rows */
export function parseColumnsInput(columns) {
    const descricaoLines = splitColumnLines(columns.descricao);
    const unidadeLines = splitColumnLines(columns.unidade);
    const categoriaLines = splitColumnLines(columns.categoria);
    const quantidadeLines = splitColumnLines(columns.quantidade);
    const valorLines = splitColumnLines(columns.valor);
    if (descricaoLines.length === 0 || unidadeLines.length === 0) {
        return { rows: [] };
    }
    const usedColumns = [
        { name: 'descricao', lines: descricaoLines },
        { name: 'unidade', lines: unidadeLines },
    ];
    if (isColumnUsed(categoriaLines)) {
        usedColumns.push({ name: 'categoria', lines: categoriaLines });
    }
    if (isColumnUsed(quantidadeLines)) {
        usedColumns.push({ name: 'quantidade', lines: quantidadeLines });
    }
    if (isColumnUsed(valorLines)) {
        usedColumns.push({ name: 'valor', lines: valorLines });
    }
    const counts = usedColumns.map((col) => ({
        name: col.name,
        lineCount: col.lines.length,
    }));
    const expectedCount = counts[0]?.lineCount ?? 0;
    const mismatch = counts.filter((col) => col.lineCount !== expectedCount);
    if (mismatch.length > 0) {
        return { rows: [], mismatch: counts };
    }
    const rows = [];
    for (let i = 0; i < expectedCount; i += 1) {
        rows.push({
            line: i + 1,
            categoria: isColumnUsed(categoriaLines) ? (categoriaLines[i] ?? '') : null,
            descricao: descricaoLines[i] ?? '',
            unidade: unidadeLines[i] ?? '',
            quantidade: isColumnUsed(quantidadeLines) ? (quantidadeLines[i] ?? '') : null,
            valor: isColumnUsed(valorLines) ? (valorLines[i] ?? '') : null,
        });
    }
    return { rows };
}
//# sourceMappingURL=columns.parser.js.map