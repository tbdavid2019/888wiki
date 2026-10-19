const chartRecords = new Set()

export const parseEchartsOption = source => {
    let option
    try {
        option = JSON.parse(String(source || '').trim())
    } catch (error) {
        throw new Error('ECharts block must contain a valid JSON object')
    }

    if (!option || typeof option !== 'object' || Array.isArray(option)) {
        throw new Error('ECharts block must contain a JSON object')
    }

    return option
}

export const getEchartsChartLabel = option => {
    const title = Array.isArray(option?.title)
        ? option.title.find(item => item && typeof item === 'object' && item.text)
        : option?.title
    const label = title && typeof title === 'object' ? String(title.text || '').trim() : ''
    return label || 'ECharts chart'
}

const disposeRecord = record => {
    if (!record) return
    record.observer?.disconnect()
    record.windowTarget?.removeEventListener('resize', record.onWindowResize)
    record.chart?.dispose()
    chartRecords.delete(record)
    if (record.container?.__cfNotepadEchartsRecord === record) {
        delete record.container.__cfNotepadEchartsRecord
    }
}

export const disposeEchartsCharts = () => {
    Array.from(chartRecords).forEach(disposeRecord)
}

export const renderEchartsChart = (container, source, echartsApi = globalThis.echarts) => {
    if (!container) throw new Error('ECharts container is missing')
    if (!echartsApi || typeof echartsApi.init !== 'function') {
        throw new Error('ECharts library is unavailable')
    }

    disposeRecord(container.__cfNotepadEchartsRecord)
    const option = parseEchartsOption(source)
    const chart = echartsApi.init(container, null, {
        renderer: 'canvas',
        useDirtyRect: false,
    })
    const record = {
        chart,
        container,
        observer: null,
        windowTarget: null,
        onWindowResize: null,
    }

    try {
        chart.setOption(option)
        container.setAttribute('role', 'img')
        container.setAttribute('aria-label', getEchartsChartLabel(option))

        const resize = () => chart.resize()
        if (typeof ResizeObserver !== 'undefined') {
            record.observer = new ResizeObserver(resize)
            record.observer.observe(container)
        } else if (typeof window !== 'undefined') {
            record.windowTarget = window
            record.onWindowResize = resize
            window.addEventListener('resize', resize)
        }

        container.__cfNotepadEchartsRecord = record
        chartRecords.add(record)
        return record
    } catch (error) {
        chart.dispose()
        throw error
    }
}

if (typeof window !== 'undefined') {
    window.disposeEchartsCharts = disposeEchartsCharts
}
