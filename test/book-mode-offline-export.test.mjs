import test from 'node:test'
import assert from 'node:assert/strict'
import { HTML } from '../src/templates/base.js'

test('book mode renders offline cache button and export menu with all options', () => {
    const html = HTML({
        lang: 'zh-TW',
        title: 'TypeScript 实战手册',
        content: '# TypeScript 实战手册\n\n- [第一章](/share/ts-ch1)\n- [第二章](/share/ts-ch2)',
        shareId: 'ts-handbook',
        ext: {
            sharePath: '/share/ts-handbook',
            presentationPath: '/share/ts-handbook/present',
            bookPath: '/share/ts-handbook/book',
            bookMode: true,
            autoBook: true,
            meta: { canonicalUrl: 'https://wiki.david888.com/share/ts-handbook/book' }
        },
        path: 'ts-handbook'
    })

    assert.ok(html.includes('book-offline-cache-btn'), 'Includes book-offline-cache-btn element')
    assert.ok(html.includes('book-export-toggle-btn'), 'Includes book-export-toggle-btn element')
    assert.ok(html.includes('book-export-md-btn'), 'Includes book-export-md-btn element')
    assert.ok(html.includes('book-export-html-btn'), 'Includes book-export-html-btn element')
    assert.ok(html.includes('book-export-pdf-btn'), 'Includes book-export-pdf-btn element')
    assert.ok(html.includes('book-print-container'), 'Includes book-print-container element for PDF printing')
    assert.ok(html.includes('cf-notepad:book-offline:'), 'Includes localStorage key for offline book caching')
    assert.ok(html.includes('cf-notepad:book-last-idx:'), 'Includes localStorage key for reading progress')
    assert.ok(html.includes('david888-wiki-shell-v8'), 'Pre-caches to shell cache')
    assert.ok(html.includes('david888-wiki-images-v1'), 'Pre-caches images')
})

test('book mode scripts have zero syntax errors when evaluated', () => {
    const html = HTML({
        lang: 'en-US',
        title: 'Book Reader Test',
        content: '# Test Book\n\n- [Ch1](/share/ch1)',
        shareId: 'test-book',
        ext: {
            sharePath: '/share/test-book',
            presentationPath: '/share/test-book/present',
            bookPath: '/share/test-book/book',
            bookMode: true,
            autoBook: true,
            meta: { canonicalUrl: 'https://wiki.david888.com/share/test-book/book' }
        },
        path: 'test-book'
    })

    const scriptMatches = html.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi) || []
    assert.ok(scriptMatches.length > 0, 'Found scripts')
    assert.ok(
        html.includes("'<\\\\/script>\\n</body>\\n</html>'"),
        'Standalone HTML export must escape its closing script tag in the enclosing client script'
    )

    for (const tag of scriptMatches) {
        if (tag.includes('text/template') || tag.includes('application/ld+json') || tag.includes('application/json') || tag.includes('src=')) continue
        const code = tag.replace(/<script[\s\S]*?>/i, '').replace(/<\/script>/i, '').trim()
        if (!code) continue
        if (tag.includes('type="module"')) {
            const sanitized = code
                .replace(/import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"];?/g, (match, imports) => {
                    const cleanImports = imports.replace(/[{}]/g, '').split(',').map(x => x.trim()).filter(Boolean);
                    return cleanImports.length > 0 ? 'var ' + cleanImports.join(', ') + ';' : '';
                })
                .replace(/export\s+function\s+/g, 'function ')
                .replace(/export\s+const\s+/g, 'const ');
            assert.doesNotThrow(() => {
                new Function(sanitized)
            }, 'Client module script should evaluate without syntax errors')
            continue;
        }
        assert.doesNotThrow(() => {
            new Function(code)
        }, 'Client script should evaluate without syntax errors')
    }
})
