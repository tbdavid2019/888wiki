const loadScript = src => new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) return resolve()
    const script = document.createElement('script')
    script.src = src
    script.onload = resolve
    script.onerror = () => reject(new Error(`Could not load ${src}`))
    document.head.append(script)
})

async function renderMermaid() {
    const nodes = document.querySelectorAll('.mermaid-block-container .mermaid')
    if (!nodes.length) return
    try {
        let pele = null
        try {
            pele = await import('https://cdn.jsdelivr.net/npm/pele@1.6.0/dist/pele.js')
        } catch (pe) {
            console.warn('Block-view Pele load failed:', pe)
        }
        const unrendered = []
        if (pele && typeof pele.render === 'function') {
            nodes.forEach(node => {
                const code = (node.textContent || '').trim()
                if (!code) return
                try {
                    const res = pele.render(code, { responsive: true })
                    if (res && res.svg) {
                        node.innerHTML = res.svg
                        node.setAttribute('data-diagram-engine', 'pele')
                        return
                    }
                } catch (e) {
                    console.warn('Block-view Pele render failed, falling back:', e)
                }
                unrendered.push(node)
            })
        } else {
            unrendered.push(...nodes)
        }
        if (unrendered.length > 0) {
            const mermaid = (await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs')).default
            mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' })
            await mermaid.run({ nodes: unrendered })
        }
    } catch (error) {
        console.error('Mermaid block render failed', error)
    }
}

async function renderEcharts() {
    const nodes = document.querySelectorAll('.echarts-block-container .echarts')
    if (!nodes.length) return
    try {
        await loadScript('https://cdn.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js')
        const { renderEchartsChart } = await import('/js/echarts-renderer.mjs')
        nodes.forEach(node => {
            try {
                renderEchartsChart(node, node.dataset.echartsOptions || '', window.echarts)
            } catch (error) {
                node.textContent = `ECharts Render Error: ${error.message || error}`
            }
        })
    } catch (error) {
        console.error('ECharts block render failed', error)
    }
}

await Promise.all([renderMermaid(), renderEcharts()])
