import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
    disposeEchartsCharts,
    getEchartsChartLabel,
    parseEchartsOption,
    renderEchartsChart,
} from '../static/js/echarts-renderer.mjs'

const baseTemplate = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')

test('parses a JSON ECharts option object', () => {
    const option = parseEchartsOption('{"series":[{"type":"pie","data":[{"value":1}]}]}')
    assert.equal(option.series[0].type, 'pie')
})

test('rejects invalid JSON, arrays, and primitive values', () => {
    assert.throws(() => parseEchartsOption('{bad json}'), /valid JSON object/i)
    assert.throws(() => parseEchartsOption('[]'), /JSON object/i)
    assert.throws(() => parseEchartsOption('42'), /JSON object/i)
    assert.throws(() => parseEchartsOption('null'), /JSON object/i)
})

test('derives an accessible label from the chart title', () => {
    assert.equal(getEchartsChartLabel({ title: { text: '訪問來源' } }), '訪問來源')
    assert.equal(getEchartsChartLabel({}), 'ECharts chart')
})

test('initializes, labels, and disposes a chart instance', () => {
    const attributes = new Map()
    const calls = []
    const container = {
        setAttribute(name, value) { attributes.set(name, value) },
    }
    const chart = {
        setOption(option) { calls.push(['setOption', option]) },
        resize() { calls.push(['resize']) },
        dispose() { calls.push(['dispose']) },
    }
    const echartsApi = {
        init(node, theme, options) {
            assert.equal(node, container)
            assert.equal(options.renderer, 'canvas')
            assert.equal(options.useDirtyRect, false)
            return chart
        },
    }

    renderEchartsChart(container, '{"title":{"text":"流量來源"}}', echartsApi)
    assert.equal(attributes.get('role'), 'img')
    assert.equal(attributes.get('aria-label'), '流量來源')
    assert.deepEqual(calls[0][0], 'setOption')

    disposeEchartsCharts()
    assert.deepEqual(calls.at(-1), ['dispose'])
})

test('integrates ECharts into the existing diagram pipeline', () => {
    assert.match(baseTemplate, /lang === 'echarts'/)
    assert.match(baseTemplate, /echarts@6\.1\.0\/dist\/echarts\.min\.js/)
    assert.match(baseTemplate, /diagram-echarts-render/)
})
