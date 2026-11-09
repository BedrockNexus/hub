"""
Generates the original pixel-art textures for the home page's chunk layers.

Every block is an 8x8 grid drawn here from a seeded random source, so the
output is stable between runs. Layers are SVGs that place block symbols
with <use>, which keeps each file small. Run from the hub folder:

    python scripts/generate-chunk-textures.py

then `bunx biome check --write public/textures/chunk` to format the output.
"""

import pathlib
import random

OUT = pathlib.Path('public/textures/chunk')
BLOCK = 8

PALETTES = {
    'stone': ('#7f8084', ['#8b8c90', '#727377', '#696a6e', '#94959a']),
    'dirt': ('#7a5436', ['#8a6142', '#6b482d', '#5e3f27', '#946a49']),
    'deepslate': ('#4a4b50', ['#55565c', '#404146', '#38393d', '#5d5e64']),
    'bedrock': ('#4b4c50', ['#2e2f32', '#6c6d70', '#3a3b3e', '#858689', '#232426']),
    'snow': ('#e8edf2', ['#f5f8fb', '#d6dde5', '#c9d2dc']),
    'leaves': ('#3d7a2a', ['#4c8f33', '#2f6420', '#5aa33d', '#26521a']),
    'andesite': ('#888a8b', ['#9c9e9f', '#76787a', '#6c6e70', '#a7a9aa']),
    'gravel': ('#7f7774', ['#9a9290', '#655e5b', '#aaa3a0', '#56504d']),
}
GRASS = ['#5c9a37', '#71b347', '#4c832d']
LOG = ['#6b4f2e', '#5a4126', '#7a5c37', '#4a3520']
ORES = {
    'coal': ['#2b2b2d', '#1b1b1c'],
    'iron': ['#d8b394', '#b08a6a'],
    'gold': ['#f5d04a', '#c99a1c'],
    'redstone': ['#ea4232', '#a3241a'],
    'diamond': ['#66e3ea', '#2ea6b0'],
    'copper': ['#e7865b', '#b8603d', '#5fae8f'],
}


def base_block(kind, rng):
    base, variants = PALETTES[kind]
    grid = []
    for y in range(BLOCK):
        # Deepslate reads as layered: each row leans lighter or darker.
        row_bias = rng.choice(variants) if kind == 'deepslate' else None
        row = []
        for _ in range(BLOCK):
            roll = rng.random()
            if row_bias and roll < 0.3:
                row.append(row_bias)
            elif roll < 0.55:
                row.append(base)
            else:
                row.append(rng.choice(variants))
        grid.append(row)
    return grid


def bedrock_block(rng):
    # Bedrock is mottled: patches of near-black and pale grey, not fine noise.
    base, variants = PALETTES['bedrock']
    grid = [[base] * BLOCK for _ in range(BLOCK)]
    for _ in range(rng.randint(7, 10)):
        color = rng.choice(variants)
        x, y = rng.randrange(BLOCK), rng.randrange(BLOCK)
        w, h = rng.choice([(1, 1), (2, 1), (1, 2), (2, 2), (3, 2)])
        for dy in range(h):
            for dx in range(w):
                if x + dx < BLOCK and y + dy < BLOCK:
                    grid[y + dy][x + dx] = color
    return grid


def ore_block(host, ore, rng):
    grid = base_block(host, rng)
    colors = ORES[ore]
    for _ in range(rng.randint(2, 3)):
        cx, cy = rng.randint(1, 6), rng.randint(1, 6)
        cells = [(cx, cy)] + [
            (cx + dx, cy + dy)
            for dx, dy in rng.sample([(1, 0), (0, 1), (-1, 0), (0, -1), (1, 1)], 3)
        ]
        for x, y in cells:
            if 0 <= x < BLOCK and 0 <= y < BLOCK:
                grid[y][x] = rng.choice(colors)
    return grid


def grid_to_rects(grid):
    """Merge runs of the same colour on each row into one rect."""
    rects = []
    for y, row in enumerate(grid):
        x = 0
        while x < len(row):
            end = x
            while end + 1 < len(row) and row[end + 1] == row[x]:
                end += 1
            if row[x] is not None:
                rects.append(
                    f'<rect fill="{row[x]}" height="1" width="{end - x + 1}" x="{x}" y="{y}" />'
                )
            x = end + 1
    return rects


class Sheet:
    """Block symbols for one SVG, defined once and placed with <use>."""

    def __init__(self, seed):
        self.rng = random.Random(seed)
        self.symbols = {}
        self.uses = []

    def symbol(self, name, grid_fn):
        if name not in self.symbols:
            self.symbols[name] = grid_to_rects(grid_fn())
        return name

    def variant(self, kind, count=4):
        index = self.rng.randrange(count)
        make = bedrock_block if kind == 'bedrock' else (lambda rng: base_block(kind, rng))
        if kind == 'dirt':
            # The same material in every sheet, including the hero terrain.
            return self.symbol(f'{kind}{index}', lambda: make(random.Random(110 + index)))
        return self.symbol(f'{kind}{index}', lambda: make(self.rng))

    def ore(self, host, ore):
        return self.symbol(f'{host}-{ore}', lambda: ore_block(host, ore, self.rng))

    def place(self, name, col, row, shade=None):
        x, y = col * BLOCK, row * BLOCK
        self.uses.append(f'<use href="#{name}" x="{x}" y="{y}" />')
        if shade:
            # Darken just this block, for edges whose gaps must stay clear.
            self.uses.append(
                f'<rect fill="#07080a" fill-opacity="{shade}" height="{BLOCK}" '
                f'width="{BLOCK}" x="{x}" y="{y}" />'
            )

    def write(self, filename, cols, rows, title):
        width, height = cols * BLOCK, rows * BLOCK
        defs = ''.join(
            f'<g id="{name}">{"".join(rects)}</g>' for name, rects in self.symbols.items()
        )
        svg = (
            f'<svg height="{height}" shape-rendering="crispEdges" '
            f'viewBox="0 0 {width} {height}" width="{width}" '
            f'xmlns="http://www.w3.org/2000/svg">'
            f'<title>{title}</title>'
            f'<defs>{defs}</defs>{"".join(self.uses)}</svg>\n'
        )
        (OUT / filename).write_bytes(svg.encode())


def fill_layer(filename, kind, title, ores, cols=16, rows=12, seed=1):
    sheet = Sheet(seed)
    cells = [(c, r) for r in range(rows) for c in range(cols)]
    picks = sheet.rng.sample(cells, sum(count for _, count in ores))
    special = {}
    for (ore, count) in ores:
        for _ in range(count):
            special[picks.pop()] = ore
    for col, row in cells:
        name = (
            sheet.ore(kind, special[(col, row)])
            if (col, row) in special
            else sheet.variant(kind)
        )
        sheet.place(name, col, row)
    sheet.write(filename, cols, rows, title)


def grass_block(rng):
    """Dirt with a grass top that drips down a pixel or two."""
    grid = base_block('dirt', rng)
    for x in range(BLOCK):
        depth = 2 + (1 if rng.random() < 0.35 else 0)
        for y in range(depth):
            grid[y][x] = rng.choice(GRASS)
    return grid


def log_block(rng):
    """Oak bark: vertical stripes."""
    stripes = [rng.choice(LOG) for _ in range(BLOCK)]
    return [
        [stripes[x] if rng.random() < 0.8 else rng.choice(LOG) for x in range(BLOCK)]
        for _ in range(BLOCK)
    ]


def rect(fill, x, y, w=1, h=1):
    return f'<rect fill="{fill}" height="{h}" width="{w}" x="{x}" y="{y}" />'


def sprite(rows, colors, rng=None):
    """A grid from strings: '.' is clear, any other letter looks up a colour."""
    grid = []
    for line in rows:
        row = []
        for char in line:
            if char == '.':
                row.append(None)
            else:
                value = colors[char]
                row.append(rng.choice(value) if isinstance(value, list) else value)
        grid.append(row)
    return grid


# Plains: rolling grassy hills of dirt, one block step at a time, so the dirt
# runs on into the dirt layer below. 80 columns = 2560px, anchored to the
# hero's right edge; columns from about 35 on show at 1440px.
SURFACE = (
    [1, 1, 2, 2, 3, 3, 3, 2, 2, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1]
    + [1, 1, 1, 2, 2, 3, 3, 3, 3, 2, 2, 2, 1, 1, 1, 1, 1, 1, 2, 2]
    + [2, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4, 3, 3, 3, 2]
    + [2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 4, 4, 4, 3, 3, 3, 3, 4, 4, 4]
)
# Oaks (two-log trunk) on low ground.
TREES = [9, 16, 22, 43, 77]
TUFT = [
    '........',
    '........',
    '....g...',
    '.g..g..g',
    '.g.gg..g',
    '.gg.g.g.',
    '..g.g.g.',
    '..g.gg..',
]
POPPY = [
    '........',
    '........',
    '...rr...',
    '..rkrr..',
    '...rr...',
    '...g....',
    '..gg....',
    '...g....',
]
DANDELION = [
    '........',
    '........',
    '........',
    '...yy...',
    '..yYy...',
    '...g....',
    '...gg...',
    '...g....',
]


def surface():
    rows = 9
    cols = len(SURFACE)
    sheet = Sheet(41)
    for col, height in enumerate(SURFACE):
        top_row = rows - height
        for row in range(top_row, rows):
            if row == top_row:
                index = sheet.rng.randrange(3)
                name = sheet.symbol(f'grass{index}', lambda: grass_block(sheet.rng))
            else:
                name = sheet.variant('dirt')
            sheet.place(name, col, row)
    shaded = set()
    for col in TREES:
        ground = rows - SURFACE[col]
        for row in range(ground - 2, ground):
            index = sheet.rng.randrange(2)
            sheet.place(sheet.symbol(f'log{index}', lambda: log_block(sheet.rng)), col, row)
        crown = [(-1, -3), (0, -3), (1, -3), (-1, -2), (1, -2), (0, -4)]
        for dx, dy in crown:
            sheet.place(sheet.variant('leaves', 3), col + dx, ground + dy)
        shaded.update({col - 1, col, col + 1})
    # Tall grass and flowers on the open ground.
    plants = {
        'tuft': (TUFT, {'g': GRASS}),
        'poppy': (POPPY, {'r': '#d8352a', 'k': '#3a1a10', 'g': '#4c832d'}),
        'dandelion': (DANDELION, {'y': '#f5d04a', 'Y': '#c99a1c', 'g': '#4c832d'}),
    }
    for col in range(cols):
        if col in shaded or sheet.rng.random() > 0.3:
            continue
        kind = sheet.rng.choices(['tuft', 'poppy', 'dandelion'], [6, 1, 1])[0]
        rows_, colors = plants[kind]
        name = sheet.symbol(kind, lambda: sprite(rows_, colors, sheet.rng))
        sheet.place(name, col, rows - SURFACE[col] - 1)
    sheet.write('surface.svg', cols, rows, 'Rolling plains')


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    fill_layer('dirt.svg', 'dirt', 'Dirt layer', [], seed=11)
    fill_layer(
        'stone.svg',
        'stone',
        'Stone layer with ores',
        [('coal', 3), ('iron', 2), ('gold', 1), ('redstone', 1), ('diamond', 1)],
        seed=12,
    )
    fill_layer(
        'deepslate.svg',
        'deepslate',
        'Deepslate layer with ores',
        [('diamond', 2), ('redstone', 2), ('gold', 1)],
        seed=13,
    )
    fill_layer('bedrock.svg', 'bedrock', 'Bedrock layer', [], cols=16, rows=8, seed=14)

    cols = 24

    # Dirt giving way to stone over two rows.
    sheet = Sheet(21)
    for col in range(cols):
        for row, dirt_chance in ((0, 0.7), (1, 0.25)):
            kind = 'dirt' if sheet.rng.random() < dirt_chance else 'stone'
            sheet.place(sheet.variant(kind), col, row)
    sheet.write('edge-dirt-stone.svg', cols, 2, 'Dirt to stone')

    # Stone gives way to deepslate over four rows, with solid materials
    # at either edge so the transition joins the adjacent page layers.
    sheet = Sheet(23)
    for col in range(cols):
        for row, stone_chance in enumerate((1, 0.7, 0.3, 0)):
            kind = 'stone' if sheet.rng.random() < stone_chance else 'deepslate'
            sheet.place(sheet.variant(kind), col, row)
    sheet.write('edge-stone-deepslate.svg', cols, 4, 'Stone to deepslate')

    # Deepslate breaking into bedrock, with a ragged top so the page shows through.
    sheet = Sheet(24)
    for col in range(cols):
        if sheet.rng.random() < 0.5:
            sheet.place(sheet.variant('bedrock'), col, 0, shade=0.5)
        kind = 'bedrock' if sheet.rng.random() < 0.5 else 'deepslate'
        sheet.place(sheet.variant(kind), col, 1, shade=0.55 if kind == 'bedrock' else 0.82)
        kind = 'bedrock' if sheet.rng.random() < 0.85 else 'deepslate'
        sheet.place(sheet.variant(kind), col, 2, shade=0.6 if kind == 'bedrock' else 0.82)
    sheet.write('edge-bedrock.svg', cols, 3, 'Deepslate to bedrock')

    surface()

    # Sparse, square stars; no browser-time randomness or moving backdrop.
    rng = random.Random(57)
    stars = [rect(rng.choice(['#8494aa', '#b7c5d6', '#e0e6ed']),
                  rng.randrange(1440), rng.randrange(650),
                  rng.choice([2, 2, 3]), 2) for _ in range(125)]
    (OUT / 'stars.svg').write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="720" '
        'viewBox="0 0 1440 720"><title>Night stars</title>'
        + ''.join(stars) + '</svg>\n')


if __name__ == '__main__':
    main()
