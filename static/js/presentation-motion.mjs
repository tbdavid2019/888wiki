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
    const variant = String(options.variant || '').toLowerCase()
    let rafId = null
    let destroyed = false
    let width = 0
    let height = 0
    let dpr = 1

    const palette = variant === 'warm'
        ? {
            bgA: 'rgba(200, 101, 75, 0.36)',
            bgB: 'rgba(56, 189, 248, 0.30)',
            bgC: 'rgba(245, 158, 11, 0.28)',
            ribbonA: 'rgba(200, 101, 75, 0.22)',
            ribbonB: 'rgba(20, 184, 166, 0.20)',
            dot: 'rgba(200, 101, 75, 0.55)',
            line: 'rgba(200, 101, 75, 0.24)',
            stroke: 'rgba(200, 101, 75, 0.40)',
            arc: 'rgba(200, 101, 75, 0.65)',
            node: 'rgba(200, 101, 75, 0.85)',
        }
        : (isLight
            ? {
                bgA: 'rgba(56, 189, 248, 0.44)',
                bgB: 'rgba(139, 92, 246, 0.38)',
                bgC: 'rgba(16, 185, 129, 0.36)',
                ribbonA: 'rgba(59, 130, 246, 0.24)',
                ribbonB: 'rgba(168, 85, 247, 0.22)',
                dot: 'rgba(37, 99, 235, 0.52)',
                line: 'rgba(59, 130, 246, 0.24)',
                stroke: 'rgba(37, 99, 235, 0.34)',
                arc: 'rgba(14, 165, 233, 0.68)',
                node: 'rgba(2, 132, 199, 0.88)',
            }
            : {
                bgA: 'rgba(56, 189, 248, 0.48)',
                bgB: 'rgba(139, 92, 246, 0.44)',
                bgC: 'rgba(20, 184, 166, 0.40)',
                ribbonA: 'rgba(34, 211, 238, 0.24)',
                ribbonB: 'rgba(167, 139, 250, 0.22)',
                dot: 'rgba(103, 232, 249, 0.60)',
                line: 'rgba(56, 189, 248, 0.26)',
                stroke: 'rgba(103, 232, 249, 0.36)',
                arc: 'rgba(56, 189, 248, 0.75)',
                node: 'rgba(103, 232, 249, 0.92)',
            })

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
                x: width * (0.26 + 0.16 * Math.cos(phase)),
                y: height * (0.30 + 0.14 * Math.sin(phase)),
                r: Math.max(width, height) * 0.48,
                color: palette.bgA,
            },
            {
                x: width * (0.74 + 0.15 * Math.sin(phase)),
                y: height * (0.56 + 0.15 * Math.cos(phase * 2)),
                r: Math.max(width, height) * 0.44,
                color: palette.bgB,
            },
            {
                x: width * (0.48 + 0.18 * Math.sin(phase * 2)),
                y: height * (0.74 + 0.12 * Math.sin(phase)),
                r: Math.max(width, height) * 0.40,
                color: palette.bgC,
            },
        ]
        for (const b of blobs) {
            const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
            g.addColorStop(0, b.color)
            g.addColorStop(0.55, b.color)
            g.addColorStop(1, 'rgba(0, 0, 0, 0)')
            ctx.fillStyle = g
            ctx.beginPath()
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
            ctx.fill()
        }

        // Flowing aurora ribbons (2 seamless periodic waves)
        const ribbons = [
            { yBase: height * 0.34, amp: height * 0.10, freq: 1, color: palette.ribbonA },
            { yBase: height * 0.64, amp: height * 0.12, freq: 2, color: palette.ribbonB },
        ]
        for (const rb of ribbons) {
            ctx.save()
            ctx.fillStyle = rb.color
            ctx.beginPath()
            ctx.moveTo(0, height)
            const steps = 24
            for (let s = 0; s <= steps; s++) {
                const u = s / steps
                const x = u * width
                const y = rb.yBase
                    + Math.sin(phase * rb.freq + u * Math.PI * 2) * rb.amp
                    + Math.cos(phase - u * Math.PI * 2) * (rb.amp * 0.45)
                ctx.lineTo(x, y)
            }
            ctx.lineTo(width, height)
            ctx.closePath()
            ctx.fill()
            ctx.restore()
        }
    }

    function drawMesh(phase) {
        const spacing = 56
        const cols = Math.ceil(width / spacing) + 2
        const rows = Math.ceil(height / spacing) + 2
        const grid = []
        for (let row = 0; row < rows; row++) {
            const rowPts = []
            for (let col = 0; col < cols; col++) {
                const wave = Math.sin(phase + col * 0.42 + row * 0.30)
                const cross = Math.cos(phase - col * 0.25 + row * 0.38)
                rowPts.push({
                    x: col * spacing + cross * 7,
                    y: row * spacing + wave * 9,
                    wave,
                })
            }
            grid.push(rowPts)
        }

        ctx.save()
        ctx.strokeStyle = palette.line
        ctx.lineWidth = 1.1
        for (let row = 0; row < rows; row++) {
            ctx.beginPath()
            for (let col = 0; col < cols; col++) {
                const pt = grid[row][col]
                if (col === 0) ctx.moveTo(pt.x, pt.y)
                else ctx.lineTo(pt.x, pt.y)
            }
            ctx.stroke()
        }
        for (let col = 0; col < cols; col++) {
            ctx.beginPath()
            for (let row = 0; row < rows; row++) {
                const pt = grid[row][col]
                if (row === 0) ctx.moveTo(pt.x, pt.y)
                else ctx.lineTo(pt.x, pt.y)
            }
            ctx.stroke()
        }

        ctx.fillStyle = palette.dot
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const pt = grid[row][col]
                const r = 1.8 + (pt.wave + 1) * 1.4
                ctx.beginPath()
                ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2)
                ctx.fill()
            }
        }
        ctx.restore()
    }

    function drawOrbits(phase) {
        const cx = width * 0.5
        const cy = height * 0.5
        const base = Math.min(width, height) * 0.28
        const rings = [
            { r: base * 0.72, speed: 1, dash: [14, 10], nodes: 2 },
            { r: base * 1.18, speed: -1, dash: [8, 12], nodes: 3 },
            { r: base * 1.66, speed: 2, dash: [22, 16], nodes: 4 },
        ]
        for (const ring of rings) {
            const angleOffset = phase * ring.speed
            ctx.save()
            ctx.strokeStyle = palette.stroke
            ctx.lineWidth = 1.5
            ctx.setLineDash(ring.dash)
            ctx.beginPath()
            ctx.arc(cx, cy, ring.r, angleOffset, angleOffset + Math.PI * 2)
            ctx.stroke()
            ctx.setLineDash([])

            // Sweeping highlight arc segment
            ctx.strokeStyle = palette.arc
            ctx.lineWidth = 2.4
            ctx.beginPath()
            ctx.arc(cx, cy, ring.r, angleOffset, angleOffset + Math.PI * 0.42)
            ctx.stroke()

            for (let i = 0; i < ring.nodes; i++) {
                const a = angleOffset + (i * Math.PI * 2) / ring.nodes
                const nx = cx + Math.cos(a) * ring.r
                const ny = cy + Math.sin(a) * ring.r
                const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, 14)
                glow.addColorStop(0, palette.node)
                glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
                ctx.fillStyle = glow
                ctx.beginPath()
                ctx.arc(nx, ny, 14, 0, Math.PI * 2)
                ctx.fill()

                ctx.fillStyle = palette.node
                ctx.beginPath()
                ctx.arc(nx, ny, 4.2, 0, Math.PI * 2)
                ctx.fill()
            }
            ctx.restore()
        }
    }

    function drawFrame(now) {
        if (destroyed || preset === 'off' || !ctx) return
        syncSize()
        ctx.clearRect(0, 0, width, height)
        const ts = Number.isFinite(now) ? now : (typeof performance !== 'undefined' ? performance.now() : Date.now())
        const t = ((ts % MOTION_LOOP_PERIOD_MS) / MOTION_LOOP_PERIOD_MS)
        const phase = t * Math.PI * 2

        if (preset === 'aurora') drawAurora(phase)
        else if (preset === 'mesh') drawMesh(phase)
        else if (preset === 'orbits') drawOrbits(phase)
    }

    function renderFrame(now) {
        if (destroyed || preset === 'off' || !ctx) return
        drawFrame(now)
        rafId = window.requestAnimationFrame(renderFrame)
    }

    function start() {
        if (destroyed || preset === 'off') {
            canvas.classList.remove('active')
            if (ctx && width && height) ctx.clearRect(0, 0, width, height)
            return
        }
        canvas.classList.add('active')
        drawFrame(typeof performance !== 'undefined' ? performance.now() : Date.now())
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
