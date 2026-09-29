export const getReadingProgress = ({ scrollTop = 0, scrollHeight = 0, clientHeight = 0 } = {}) => {
    const maxScroll = Math.max(0, Number(scrollHeight) - Number(clientHeight))
    const currentScroll = Math.max(0, Math.min(Number(scrollTop) || 0, maxScroll))
    const percent = maxScroll ? Math.round((currentScroll / maxScroll) * 100) : 0

    return { percent, maxScroll, isScrollable: maxScroll > 0 }
}

const ICONS = {
    toc: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="21" x2="3" y1="6" y2="6"></line><line x1="15" x2="3" y1="12" y2="12"></line><line x1="17" x2="3" y1="18" y2="18"></line></svg>`,
    pin: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.8l-1.78.89A2 2 0 0 0 5 15.24Z"></path></svg>`,
    close: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
}

const getProgressLabels = doc => {
    const isZh = doc.documentElement.lang.toLowerCase().startsWith('zh')
    return isZh
        ? {
            label: '閱讀進度與章節位置',
            value: (percent, heading, index, total) => `已閱讀 ${percent}%，第 ${index + 1} / ${total} 節：${heading}`,
            tocTitle: '章節目錄',
            tocShortTitle: '目錄',
            sections: '章節',
            pin: '釘選目錄',
            unpin: '取消釘選',
            close: '關閉目錄',
            untitled: '未命名章節',
        }
        : {
            label: 'Reading progress and section',
            value: (percent, heading, index, total) => `${percent}% read, section ${index + 1} of ${total}: ${heading}`,
            tocTitle: 'Table of Contents',
            tocShortTitle: 'Contents',
            sections: 'sections',
            pin: 'Pin table of contents',
            unpin: 'Unpin table of contents',
            close: 'Close table of contents',
            untitled: 'Untitled section',
        }
}

export const initReadingProgress = (root = document) => {
    const preview = root.querySelector('#preview-md, #preview-plain')
    if (!preview) return false

    const host = preview.closest('.preview-pane') || preview.parentElement
    if (!host || host.querySelector('.reading-progress')) return true

    const doc = preview.ownerDocument
    const labels = getProgressLabels(doc)
    const isShareView = doc.body?.classList?.contains('share-view') || false
    host.classList.add('reading-progress-host')

    const widget = doc.createElement('aside')
    widget.className = 'reading-progress is-hidden'
    widget.setAttribute('aria-label', labels.label)

    let toggleBtn = null
    let drawer = null
    let tocList = null
    let badge = null
    let pinBtn = null
    let closeBtn = null
    let openTimer = null
    let closeTimer = null

    if (isShareView) {
        widget.classList.add('has-drawer')

        toggleBtn = doc.createElement('button')
        toggleBtn.type = 'button'
        toggleBtn.className = 'reading-progress-toggle-btn'
        toggleBtn.setAttribute('aria-label', labels.tocTitle)
        toggleBtn.title = labels.tocTitle
        toggleBtn.innerHTML = ICONS.toc
        widget.append(toggleBtn)

        drawer = doc.createElement('nav')
        drawer.className = 'reading-toc-drawer'
        drawer.setAttribute('aria-label', labels.tocTitle)

        const drawerHeader = doc.createElement('div')
        drawerHeader.className = 'reading-toc-header'
        drawerHeader.innerHTML = `
            <div class="reading-toc-header-title">
                <span class="reading-toc-header-icon">${ICONS.toc}</span>
                <span class="reading-toc-heading-text">${labels.tocShortTitle}</span>
                <span class="reading-toc-badge">0</span>
            </div>
            <div class="reading-toc-header-actions">
                <button type="button" class="reading-toc-action-btn reading-toc-pin-btn" title="${labels.pin}" aria-label="${labels.pin}" aria-pressed="false">
                    ${ICONS.pin}
                </button>
                <button type="button" class="reading-toc-action-btn reading-toc-close-btn" title="${labels.close}" aria-label="${labels.close}">
                    ${ICONS.close}
                </button>
            </div>
        `
        drawer.append(drawerHeader)

        const drawerBody = doc.createElement('div')
        drawerBody.className = 'reading-toc-body'
        tocList = doc.createElement('div')
        tocList.className = 'reading-toc-list'
        tocList.setAttribute('role', 'list')
        drawerBody.append(tocList)
        drawer.append(drawerBody)

        badge = drawerHeader.querySelector('.reading-toc-badge')
        pinBtn = drawerHeader.querySelector('.reading-toc-pin-btn')
        closeBtn = drawerHeader.querySelector('.reading-toc-close-btn')
    }

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

    if (drawer) {
        widget.append(drawer)
    }

    host.append(widget)

    let headings = []
    let activeHeadingIndex = 0
    let observer

    const headingText = heading => heading?.textContent?.replace(/\s+/g, ' ').trim() || labels.untitled

    const scrollToHeading = heading => {
        if (!heading) return
        if (typeof preview.scrollTo === 'function') {
            const previewRect = preview.getBoundingClientRect ? preview.getBoundingClientRect() : { top: 0 }
            const headingRect = heading.getBoundingClientRect ? heading.getBoundingClientRect() : { top: 0 }
            preview.scrollTo({
                top: (preview.scrollTop || 0) + (headingRect.top || 0) - (previewRect.top || 0) - 20,
                behavior: 'smooth',
            })
        } else if (typeof heading.scrollIntoView === 'function') {
            heading.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }

    const openDrawer = () => {
        if (!isShareView || !headings.length) return
        clearTimeout(closeTimer)
        widget.classList.add('is-drawer-open')
        if (tocList) {
            const activeItem = tocList.children[activeHeadingIndex]
            if (activeItem && typeof activeItem.scrollIntoView === 'function') {
                activeItem.scrollIntoView({ block: 'nearest' })
            }
        }
    }

    const closeDrawer = (force = false) => {
        if (!isShareView) return
        if (!force && widget.classList.contains('is-pinned')) return
        clearTimeout(openTimer)
        widget.classList.remove('is-drawer-open')
    }

    const updatePinState = () => {
        if (!pinBtn) return
        const isPinned = widget.classList.contains('is-pinned')
        pinBtn.classList.toggle('is-active', isPinned)
        pinBtn.setAttribute('aria-pressed', String(isPinned))
        pinBtn.title = isPinned ? labels.unpin : labels.pin
        pinBtn.setAttribute('aria-label', isPinned ? labels.unpin : labels.pin)
    }

    if (isShareView) {
        widget.addEventListener('mouseenter', () => {
            clearTimeout(closeTimer)
            openTimer = setTimeout(openDrawer, 120)
        })

        widget.addEventListener('mouseleave', () => {
            clearTimeout(openTimer)
            if (!widget.classList.contains('is-pinned')) {
                closeTimer = setTimeout(() => closeDrawer(), 250)
            }
        })

        toggleBtn?.addEventListener('click', e => {
            e.stopPropagation()
            if (widget.classList.contains('is-drawer-open')) {
                if (widget.classList.contains('is-pinned')) {
                    widget.classList.remove('is-pinned')
                    updatePinState()
                    closeDrawer(true)
                } else {
                    widget.classList.add('is-pinned')
                    updatePinState()
                }
            } else {
                openDrawer()
                widget.classList.add('is-pinned')
                updatePinState()
            }
        })

        pinBtn?.addEventListener('click', e => {
            e.stopPropagation()
            widget.classList.toggle('is-pinned')
            updatePinState()
        })

        closeBtn?.addEventListener('click', e => {
            e.stopPropagation()
            widget.classList.remove('is-pinned')
            updatePinState()
            closeDrawer(true)
        })

        doc.addEventListener('keydown', e => {
            if (e.key === 'Escape' && widget.classList.contains('is-drawer-open') && !widget.classList.contains('is-pinned')) {
                closeDrawer(true)
            }
        })
    }

    const update = () => {
        const progress = getReadingProgress(preview)
        if (progress.percent >= 99 && headings.length) activeHeadingIndex = headings.length - 1
        else if (!observer && headings.length) {
            const previewTop = preview.getBoundingClientRect().top
            const activationLine = previewTop + preview.clientHeight * 0.2
            activeHeadingIndex = Math.max(0, headings.findIndex(heading => heading.getBoundingClientRect().top > activationLine) - 1)
        }
        const currentHeading = headingText(headings[activeHeadingIndex])
        widget.classList.toggle('is-hidden', !progress.isScrollable && !headings.length)
        widget.style.setProperty('--reading-progress', `${progress.percent}%`)
        track.setAttribute('aria-label', labels.value(progress.percent, currentHeading, activeHeadingIndex, headings.length || 1))
        value.value = String(progress.percent)
        value.textContent = headings.length ? `${progress.percent}% · ${activeHeadingIndex + 1}/${headings.length}` : `${progress.percent}%`
        track.title = labels.value(progress.percent, currentHeading, activeHeadingIndex, headings.length || 1)
        markers.querySelectorAll('.reading-progress-marker').forEach((marker, index) => {
            marker.classList.toggle('is-active', index === activeHeadingIndex)
        })
        if (tocList) {
            tocList.querySelectorAll('.reading-toc-item').forEach((item, index) => {
                const isActive = index === activeHeadingIndex
                item.classList.toggle('is-active', isActive)
                if (isActive && widget.classList.contains('is-drawer-open') && typeof item.scrollIntoView === 'function') {
                    item.scrollIntoView({ block: 'nearest' })
                }
            })
        }
    }

    const refreshHeadings = () => {
        const previousHeading = headings[activeHeadingIndex]
        headings = [...preview.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')]
        const preservedIndex = previousHeading ? headings.indexOf(previousHeading) : -1
        activeHeadingIndex = preservedIndex >= 0 ? preservedIndex : Math.min(activeHeadingIndex, Math.max(0, headings.length - 1))

        if (toggleBtn) {
            toggleBtn.style.display = headings.length ? '' : 'none'
        }
        if (badge) {
            badge.textContent = String(headings.length)
        }

        markers.replaceChildren(...headings.map((heading, index) => {
            const marker = doc.createElement('span')
            marker.className = 'reading-progress-marker'
            const tag = (heading.tagName || '').toLowerCase()
            const level = parseInt(tag.replace('h', '') || '1', 10)
            const isMajor = level <= 2
            marker.classList.add(isMajor ? 'is-heading-major' : 'is-heading-minor')
            marker.dataset.level = String(level)
            marker.style.top = `${headings.length > 1 ? index / (headings.length - 1) * 100 : 0}%`
            marker.title = headingText(heading)
            marker.addEventListener('click', e => {
                e.stopPropagation()
                scrollToHeading(heading)
            })
            return marker
        }))

        if (tocList) {
            tocList.replaceChildren(...headings.map((heading, index) => {
                const item = doc.createElement('a')
                item.className = 'reading-toc-item'
                item.href = `#${heading.id || ''}`
                const tag = (heading.tagName || '').toLowerCase()
                const level = parseInt(tag.replace('h', '') || '1', 10)
                const isMajor = level <= 2
                item.classList.add(isMajor ? 'is-level-major' : 'is-level-minor')
                item.dataset.level = String(level)
                item.dataset.index = String(index)

                const bullet = doc.createElement('span')
                bullet.className = `reading-toc-item-bullet ${isMajor ? 'is-dash' : 'is-dot'}`

                const label = doc.createElement('span')
                label.className = 'reading-toc-item-text'
                label.textContent = headingText(heading)

                item.append(bullet, label)

                item.addEventListener('click', e => {
                    e.preventDefault()
                    scrollToHeading(heading)
                    if (!widget.classList.contains('is-pinned')) {
                        setTimeout(() => closeDrawer(), 120)
                    }
                })
                return item
            }))
        }

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
