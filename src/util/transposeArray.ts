export default function transposeArray<T>(columns: T[][]) {
  return columns[0].map((_, colIndex) => columns.map((row) => row[colIndex]));
}
