/**
 * Procedural 12-second seamless motion-loop backgrounds for Presentation Mode.
 * Inspired by Scenario Motion Loops: deterministic periodic canvas shaders
 * using integer harmonics of 2*PI over a 12,000ms loop period.
 */

export const MOTION_LOOP_PERIOD_MS = 12000
export const MOTION_LOOP_PRESETS = ['off', 'aurora', 'mesh', 'orbits']
export const SLIDE_TRANSITIONS = ['fade', 'slide', 'convex', 'zoom', 'none']

export function normalizeMotionPreset(value) {
    const normalized = String(value || '').trim().toLowerCase()
    return MOTION_LOOP_PRESETS.includes(normalized) ? normalized : 'off'
}

export function normalizeSlideTransition(value) {
    const normalized = String(value || '').trim().toLowerCase()
    return SLIDE_TRANSITIONS.includes(normalized) ? normalized : 'fade'
}

export function getMotionLoopLabel(preset, lang = 'zh-TW') {
    const isZh = lang === 'zh-TW'
    switch (normalizeMotionPreset(preset)) {
        case 'aurora':
            return isZh ? '極光循環' : 'Aurora'
        case 'mesh':
            return isZh ? '網格波紋' : 'Mesh'
        case 'orbits':
            return isZh ? '軌道幾何' : 'Orbits'
        default:
            return isZh ? '關閉' : 'Off'
    }
}

export function getTransitionLabel(transition, lang = 'zh-TW') {
    const isZh = lang === 'zh-TW'
    switch (normalizeSlideTransition(transition)) {
        case 'slide':
            return isZh ? '滑動' : 'Slide'
        case 'convex':
            return isZh ? '立體翻頁' : 'Convex'
        case 'zoom':
            return isZh ? '縮放' : 'Zoom'
        case 'none':
            return isZh ? '無過場' : 'None'
        default:
            return isZh ? '淡入淡出' : 'Fade'
    }
}

/**
 * Attaches a seamless 12s canvas motion loop controller to a canvas element.
 * @param {HTMLCanvasElement} canvas
 * @param {{ preset?: string, theme?: string, isLight?: boolean }} [options]
 */
export function createPresentationMotionController(canvas, options = {}) {
    if (!canvas || typeof canvas.getContext !== 'function') {
        return {
            setPreset: () => {},
            getPreset: () => 'off',
            destroy: () => {},
        }
    }

    const ctx = canvas.getContext('2d')
    let preset = normalizeMotionPreset(options.preset)
    const isLight = options.isLight === true
    let rafId = null
    let destroyed = false
    let width = 0
    let height = 0
    let dpr = 1

    const palette = isLight
        ? {
            bgA: 'rgba(56, 189, 248, 0.14)',
            bgB: 'rgba(168, 85, 247, 0.11)',
            bgC: 'rgba(16, 185, 129, 0.10)',
            dot: 'rgba(30, 41, 59, 0.16)',
            stroke: 'rgba(59, 130, 246, 0.16)',
            node: 'rgba(14, 165, 233, 0.35)',
        }
        : {
            bgA: 'rgba(56, 189, 248, 0.18)',
            bgB: 'rgba(139, 92, 246, 0.16)',
            bgC: 'rgba(20, 184, 166, 0.14)',
            dot: 'rgba(148, 163, 184, 0.22)',
            stroke: 'rgba(103, 232, 249, 0.16)',
            node: 'rgba(103, 232, 249, 0.42)',
        }

    function syncSize() {
        const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight }
        dpr = Math.min(window.devicePixelRatio || 1, 2)
        width = Math.max(1, Math.round(rect.width || window.innerWidth || 1280))
        height = Math.max(1, Math.round(rect.height || window.innerHeight || 720))
        const targetW = Math.round(width * dpr)
        const targetH = Math.round(height * dpr)
        if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW
            canvas.height = targetH
        }
        if (ctx && typeof ctx.setTransform === 'function') {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        }
    }

    function drawAurora(phase) {
        const blobs = [
            {
                x: width * (0.28 + 0.14 * Math.cos(phase)),
                y: height * (0.34 + 0.12 * Math.sin(phase)),
                r: Math.max(width, height) * 0.42,
                color: palette.bgA,
            },
            {
                x: width * (0.72 + 0.13 * Math.sin(phase)),
                y: height * (0.58 + 0.14 * Math.cos(phase * 2)),
                r: Math.max(width, height) * 0.38,
                color: palette.bgB,
            },
            {
                x: width * (0.48 + 0.16 * Math.sin(phase * 2)),
                y: height * (0.72 + 0.10 * Math.sin(phase)),
                r: Math.max(width, height) * 0.34,
                color: palette.bgC,
            },
        ]
        for (const b of blobs) {
            const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
            g.addColorStop(0, b.color)
            g.addColorStop(1, 'rgba(0, 0, 0, 0)')
            ctx.fillStyle = g
            ctx.beginPath()
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
            ctx.fill()
        }
    }

    function drawMesh(phase) {
        const spacing = 44
        const cols = Math.ceil(width / spacing) + 1
        const rows = Math.ceil(height / spacing) + 1
        ctx.fillStyle = palette.dot
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const wave = Math.sin(phase + col * 0.35 + row * 0.25)
                const x = col * spacing + Math.cos(phase + row * 0.2) * 3
                const y = row * spacing + wave * 3
                const r = 1.2 + (wave + 1) * 0.9
                ctx.beginPath()
                ctx.arc(x, y, r, 0, Math.PI * 2)
                ctx.fill()
            }
        }
    }

    function drawOrbits(phase) {
        const cx = width * 0.5
        const cy = height * 0.5
        const base = Math.min(width, height) * 0.28
        const rings = [
            { r: base * 0.85, speed: 1, dash: [14, 10], nodes: 2 },
            { r: base * 1.32, speed: -1, dash: [6, 12], nodes: 3 },
            { r: base * 1.78, speed: 2, dash: [22, 16], nodes: 2 },
        ]
        for (const ring of rings) {
            const angleOffset = phase * ring.speed
            ctx.save()
            ctx.strokeStyle = palette.stroke
            ctx.lineWidth = 1.25
            ctx.setLineDash(ring.dash)
            ctx.beginPath()
            ctx.arc(cx, cy, ring.r, angleOffset, angleOffset + Math.PI * 2)
            ctx.stroke()
            ctx.setLineDash([])
            ctx.fillStyle = palette.node
            for (let i = 0; i < ring.nodes; i++) {
                const a = angleOffset + (i * Math.PI * 2) / ring.nodes
                ctx.beginPath()
                ctx.arc(cx + Math.cos(a) * ring.r, cy + Math.sin(a) * ring.r, 3.2, 0, Math.PI * 2)
                ctx.fill()
            }
            ctx.restore()
        }
    }

    function renderFrame(now) {
        if (destroyed || preset === 'off' || !ctx) return
        syncSize()
        ctx.clearRect(0, 0, width, height)
        const t = ((now % MOTION_LOOP_PERIOD_MS) / MOTION_LOOP_PERIOD_MS)
        const phase = t * Math.PI * 2

        if (preset === 'aurora') drawAurora(phase)
        else if (preset === 'mesh') drawMesh(phase)
        else if (preset === 'orbits') drawOrbits(phase)

        rafId = window.requestAnimationFrame(renderFrame)
    }

    function start() {
        if (destroyed || preset === 'off') {
            canvas.classList.remove('active')
            if (ctx && width && height) ctx.clearRect(0, 0, width, height)
            return
        }
        canvas.classList.add('active')
        if (rafId !== null) window.cancelAnimationFrame(rafId)
        rafId = window.requestAnimationFrame(renderFrame)
    }

    function stop() {
        if (rafId !== null && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
            window.cancelAnimationFrame(rafId)
        }
        rafId = null
        canvas.classList.remove('active')
        if (ctx && width && height) ctx.clearRect(0, 0, width, height)
    }

    const handleResize = () => syncSize()
    if (typeof window !== 'undefined') {
        window.addEventListener('resize', handleResize)
    }

    if (preset !== 'off') {
        start()
    }

    return {
        setPreset(nextPreset) {
            preset = normalizeMotionPreset(nextPreset)
            if (preset === 'off') stop()
            else start()
        },
        getPreset() {
            return preset
        },
        destroy() {
            destroyed = true
            stop()
            if (typeof window !== 'undefined') {
                window.removeEventListener('resize', handleResize)
            }
        },
    }
}
