import type { Genealogy } from "./genealogy";

const HORIZONTAL_SPACING = 235;
const GENERATION_SPACING = 210;

type Position = { x: number; y: number };
type Block = { ids: string[]; x: number; width: number };

// Find the closest positions to the preferred centers while enforcing card
// spacing. Pooling crowded neighbors lets both branches make room equally.
function placeRow(row: Block[], targets: Map<Block, { x: number; weight: number }>) {
  row.sort((a, b) => targets.get(a)!.x - targets.get(b)!.x);
  const offsets: number[] = [];
  const pools: { start: number; end: number; sum: number; weight: number }[] = [];
  row.forEach((block, index) => {
    offsets[index] = index === 0 ? 0 : offsets[index - 1] +
      (row[index - 1].width + block.width) / 2;
    const target = targets.get(block)!;
    pools.push({
      start: index, end: index,
      sum: (target.x - offsets[index]) * target.weight,
      weight: target.weight,
    });
    while (pools.length > 1) {
      const right = pools[pools.length - 1];
      const left = pools[pools.length - 2];
      if (left.sum / left.weight <= right.sum / right.weight) break;
      left.end = right.end;
      left.sum += right.sum;
      left.weight += right.weight;
      pools.pop();
    }
  });
  for (const pool of pools) {
    for (let i = pool.start; i <= pool.end; i++) {
      row[i].x = pool.sum / pool.weight + offsets[i];
    }
  }
}

export function layoutFamily(
  family: Genealogy,
  root: string,
  levels: Map<string, number>,
): Map<string, Position> {
  const rows = new Map<number, Block[]>();
  const blocks = new Map<string, Block>();
  const parents = new Map<string, Set<string>>();
  const children = new Map<string, Set<string>>();

  // Partners occupy one contiguous block, so siblings cannot split a couple.
  for (const [id, level] of levels) {
    if (blocks.has(id)) continue;
    const block: Block = { ids: [id], x: 0, width: HORIZONTAL_SPACING };
    blocks.set(id, block);
    for (let i = 0; i < block.ids.length; i++) {
      for (const partner of family.partners(block.ids[i])) {
        if (levels.get(partner) === level && !blocks.has(partner)) {
          block.ids.push(partner);
          blocks.set(partner, block);
        }
      }
    }
    if (block.ids.length > 2) {
      // Place a person with several partners between them, instead of routing
      // every partnership past the other partners' cards.
      const degree = (person: string) => family.partners(person)
        .filter((partner) => block.ids.includes(partner)).length;
      const hub = [...block.ids].sort((a, b) => degree(b) - degree(a))[0];
      const others = block.ids.filter((person) => person !== hub);
      const ordered = [hub];
      others.forEach((partner, index) => {
        if (index % 2 === 0) ordered.unshift(partner);
        else ordered.push(partner);
      });
      block.ids = ordered;
    }
    const row = rows.get(level) ?? [];
    row.push(block);
    rows.set(level, row);
  }

  for (const [id, level] of levels) {
    // Conflicting roles/cycles can put a recorded parent on the same or a lower
    // row. Preserve familyMembers' generation assignments in those cases.
    const visibleParents = new Set(family.parents(id).filter(
      (parent) => levels.has(parent) && levels.get(parent)! < level,
    ));
    parents.set(id, visibleParents);
    for (const parent of visibleParents) {
      const offspring = children.get(parent) ?? new Set<string>();
      offspring.add(id);
      children.set(parent, offspring);
    }
  }

  const orderedLevels = [...rows.keys()].sort((a, b) => a - b);
  // Reserve each branch's footprint in earlier generations. Otherwise a wide
  // group of cousins repeatedly squeezes its parents back into one card's slot.
  for (const level of [...orderedLevels].reverse()) {
    for (const block of rows.get(level)!) {
      const childBlocks = new Set(block.ids.flatMap((id) =>
        [...(children.get(id) ?? [])].map((child) => blocks.get(child)!),
      ));
      let childWidth = 0;
      for (const childBlock of childBlocks) {
        const parentBlocks = new Set(childBlock.ids.flatMap((id) =>
          [...(parents.get(id) ?? [])].map((parent) => blocks.get(parent)!),
        ));
        childWidth += childBlock.width / parentBlocks.size;
      }
      block.width = Math.max(block.ids.length * HORIZONTAL_SPACING, childWidth);
    }
  }

  const rootBlock = blocks.get(root);
  const rootRow = rows.get(0);
  if (rootBlock && rootRow) {
    rootRow.splice(rootRow.indexOf(rootBlock), 1);
    rootRow.splice(Math.floor(rootRow.length / 2), 0, rootBlock);
  }
  for (const row of rows.values()) {
    let offset = 0;
    const width = row.reduce((sum, block) => sum + block.width, 0);
    for (const block of row) {
      block.x = offset + block.width / 2 - width / 2;
      offset += block.width;
    }
  }

  const xOf = (id: string) => {
    const block = blocks.get(id)!;
    return block.x + (block.ids.indexOf(id) - (block.ids.length - 1) / 2) * HORIZONTAL_SPACING;
  };
  const sweep = (down: boolean) => {
    for (const level of down ? orderedLevels : [...orderedLevels].reverse()) {
      const row = rows.get(level)!;
      const targets = new Map<Block, { x: number; weight: number }>();
      for (const block of row) {
        const relatives = new Set(block.ids.flatMap((id) =>
          [...((down ? parents : children).get(id) ?? [])],
        ));
        targets.set(block, relatives.size ? {
          x: [...relatives].reduce((sum, id) => sum + xOf(id), 0) / relatives.size,
          weight: relatives.size,
        } : { x: block.x, weight: 0.1 });
      }
      placeRow(row, targets);
    }
  };

  // Descendants need room for their own families; feeding their centers back
  // upward widens the parent generation instead of shifting children under an
  // aunt or uncle. Finish downward to favor children aligning with parents.
  for (let iteration = 0; iteration < 32; iteration++) {
    sweep(true);
    sweep(false);
  }
  sweep(true);

  const rootX = rootBlock ? xOf(root) : 0;
  return new Map([...levels].map(([id, level]) => [id, {
    x: xOf(id) - rootX,
    y: level * GENERATION_SPACING,
  }]));
}
