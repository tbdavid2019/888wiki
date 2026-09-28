export const getReadingProgress = ({ scrollTop = 0, scrollHeight = 0, clientHeight = 0 } = {}) => {
    const maxScroll = Math.max(0, Number(scrollHeight) - Number(clientHeight))
    const currentScroll = Math.max(0, Math.min(Number(scrollTop) || 0, maxScroll))
    const percent = maxScroll ? Math.round((currentScroll / maxScroll) * 100) : 0

    return { percent, maxScroll, isScrollable: maxScroll > 0 }
}

const getProgressLabels = doc => {
    const isZh = doc.documentElement.lang.toLowerCase().startsWith('zh')
    return isZh
        ? {
            label: '閱讀進度與章節位置',
            value: (percent, heading, index, total) => `已閱讀 ${percent}%，第 ${index + 1} / ${total} 節：${heading}`,
        }
        : {
            label: 'Reading progress and section',
            value: (percent, heading, index, total) => `${percent}% read, section ${index + 1} of ${total}: ${heading}`,
        }
}

export const initReadingProgress = (root = document) => {
    const preview = root.querySelector('#preview-md, #preview-plain')
    if (!preview) return false

    const host = preview.closest('.preview-pane') || preview.parentElement
    if (!host || host.querySelector('.reading-progress')) return true

    const doc = preview.ownerDocument
    const labels = getProgressLabels(doc)
    host.classList.add('reading-progress-host')

    const widget = doc.createElement('aside')
    widget.className = 'reading-progress is-hidden'
    widget.setAttribute('aria-label', labels.label)
    const track = doc.createElement('button')
    track.type = 'button'
    track.className = 'reading-progress-track'
    track.setAttribute('aria-label', labels.label)
    const indicator = doc.createElement('span')
    indicator.className = 'reading-progress-indicator'
    indicator.setAttribute('aria-hidden', 'true')
    track.append(indicator)
    const markers = doc.createElement('span')
    markers.className = 'reading-progress-markers'
    markers.setAttribute('aria-hidden', 'true')
    track.append(markers)
    const value = doc.createElement('output')
    value.className = 'reading-progress-value'
    widget.append(track, value)
    host.append(widget)

    let headings = []
    let activeHeadingIndex = 0
    let observer
    const headingText = heading => heading?.textContent?.replace(/\s+/g, ' ').trim() || (doc.documentElement.lang.toLowerCase().startsWith('zh') ? '未命名章節' : 'Untitled section')
    const update = () => {
        const progress = getReadingProgress(preview)
        if (progress.percent >= 99 && headings.length) activeHeadingIndex = headings.length - 1
        else if (!observer && headings.length) {
            const previewTop = preview.getBoundingClientRect().top
            const activationLine = previewTop + preview.clientHeight * 0.2
            activeHeadingIndex = Math.max(0, headings.findIndex(heading => heading.getBoundingClientRect().top > activationLine) - 1)
        }
        const currentHeading = headingText(headings[activeHeadingIndex])
        widget.classList.toggle('is-hidden', !progress.isScrollable)
        widget.style.setProperty('--reading-progress', `${progress.percent}%`)
        track.setAttribute('aria-label', labels.value(progress.percent, currentHeading, activeHeadingIndex, headings.length || 1))
        value.value = String(progress.percent)
        value.textContent = headings.length ? `${progress.percent}% · ${activeHeadingIndex + 1}/${headings.length}` : `${progress.percent}%`
        track.title = labels.value(progress.percent, currentHeading, activeHeadingIndex, headings.length || 1)
        markers.querySelectorAll('.reading-progress-marker').forEach((marker, index) => {
            marker.classList.toggle('is-active', index === activeHeadingIndex)
        })
    }

    const refreshHeadings = () => {
        const previousHeading = headings[activeHeadingIndex]
        headings = [...preview.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')]
        const preservedIndex = previousHeading ? headings.indexOf(previousHeading) : -1
        activeHeadingIndex = preservedIndex >= 0 ? preservedIndex : Math.min(activeHeadingIndex, Math.max(0, headings.length - 1))
        markers.replaceChildren(...headings.map((heading, index) => {
            const marker = doc.createElement('span')
            marker.className = 'reading-progress-marker'
            marker.style.top = `${headings.length > 1 ? index / (headings.length - 1) * 100 : 0}%`
            marker.title = headingText(heading)
            return marker
        }))
        observer?.disconnect()
        const Observer = doc.defaultView?.IntersectionObserver
        observer = Observer && headings.length ? new Observer(entries => {
            const visibleEntries = entries.filter(entry => entry.isIntersecting)
            if (!visibleEntries.length) return
            const activeEntry = visibleEntries.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
            const index = headings.indexOf(activeEntry.target)
            if (index >= 0) {
                activeHeadingIndex = index
                update()
            }
        }, { root: preview, rootMargin: '0px 0px -80% 0px', threshold: 0 }) : undefined
        observer?.observe && headings.forEach(heading => observer.observe(heading))
        update()
    }

    track.addEventListener('click', event => {
        const rect = track.getBoundingClientRect()
        const ratio = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
        preview.scrollTop = ratio * getReadingProgress(preview).maxScroll
        update()
    })
    preview.addEventListener('scroll', update, { passive: true })
    const MutationObserverCtor = doc.defaultView?.MutationObserver
    if (MutationObserverCtor) new MutationObserverCtor(refreshHeadings).observe(preview, { childList: true, subtree: true })
    doc.defaultView?.addEventListener('resize', update, { passive: true })
    if (typeof window !== 'undefined') window.updateReadingProgress = update
    refreshHeadings()
    return true
}

if (typeof document !== 'undefined') {
    const initialize = () => initReadingProgress(document)
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true })
    else initialize()
}
