import { Graph } from "graph-data-structure";

export default function makeGraphForDatabase(
  tables: {
    name: string;
    foreignKeysPointTo: string[];
  }[],
) {
  const nodes = tables.map(({ name }) => name);
  const links = tables.flatMap(({ name: sourceTable, foreignKeysPointTo }) => {
    return foreignKeysPointTo.map((targetTable) => ({
      source: sourceTable,
      target: targetTable,
    }));
  });
  const graph = new Graph();
  nodes.forEach((node) => graph.addNode(node));
  links.forEach(({ source, target }) => graph.addEdge(source, target));
  return graph;
}
