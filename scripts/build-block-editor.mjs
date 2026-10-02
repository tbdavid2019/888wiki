import { build } from 'esbuild'

await build({
    entryPoints: ['static/js/blocknote-editor.jsx'],
    bundle: true,
    format: 'esm',
    target: ['es2022'],
    outfile: 'static/js/block-editor.bundle.mjs',
    sourcemap: false,
    minify: true,
    charset: 'utf8',
    legalComments: 'none',
    conditions: ['style'],
})
