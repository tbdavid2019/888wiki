const PAGE_SIZE_DEFAULT = 25
const PAGE_SIZE_MAX = 100
const SORT_FIELDS = new Set(['updatedAt', 'title', 'path', 'views', 'versionCount'])

function safeNumber(value) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

function clampInteger(value, fallback, min, max) {
    const parsed = Number.parseInt(String(value ?? ''), 10)
    if (!Number.isFinite(parsed)) return fallback
    return Math.min(Math.max(parsed, min), max)
}

function normalizeDateInput(value) {
    const normalized = String(value || '').trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : ''
}

export function normalizeAdminQuery(searchParams = new URLSearchParams()) {
    const params = searchParams instanceof URLSearchParams
        ? searchParams
        : new URLSearchParams(searchParams)
    const sort = SORT_FIELDS.has(params.get('sort')) ? params.get('sort') : 'updatedAt'
    const direction = params.get('dir') === 'asc' ? 'asc' : 'desc'

    return {
        page: clampInteger(params.get('page'), 1, 1, Number.MAX_SAFE_INTEGER),
        pageSize: clampInteger(params.get('pageSize'), PAGE_SIZE_DEFAULT, 10, PAGE_SIZE_MAX),
        sort,
        direction,
        title: String(params.get('title') || '').trim(),
        text: String(params.get('text') || '').trim(),
        from: normalizeDateInput(params.get('from')),
        to: normalizeDateInput(params.get('to')),
    }
}

function dateBoundary(value, endOfDay = false) {
    if (!value) return null
    const [year, month, day] = value.split('-').map(Number)
    const milliseconds = Date.UTC(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0)
    return Math.floor(milliseconds / 1000)
}

export function filterAdminNotes(notes = [], query = {}) {
    const titleNeedle = String(query.title || '').trim().toLocaleLowerCase()
    const textNeedle = String(query.text || '').trim().toLocaleLowerCase()
    const from = dateBoundary(query.from)
    const to = dateBoundary(query.to, true)

    return notes.filter(note => {
        const title = String(note.title || '').toLocaleLowerCase()
        const path = String(note.path || '').toLocaleLowerCase()
        const content = String(note.content || '').toLocaleLowerCase()
        const updatedAt = safeNumber(note.updatedAt)

        if (titleNeedle && !title.includes(titleNeedle) && !path.includes(titleNeedle)) return false
        if (textNeedle && !content.includes(textNeedle) && !title.includes(textNeedle) && !path.includes(textNeedle)) return false
        if (from !== null && updatedAt < from) return false
        if (to !== null && updatedAt > to) return false
        return true
    })
}

export function sortAdminNotes(notes = [], query = {}) {
    const field = SORT_FIELDS.has(query.sort) ? query.sort : 'updatedAt'
    const direction = query.direction === 'asc' ? 1 : -1

    return [...notes].sort((left, right) => {
        const leftValue = field === 'title' || field === 'path'
            ? String(left[field] || '').toLocaleLowerCase()
            : safeNumber(left[field])
        const rightValue = field === 'title' || field === 'path'
            ? String(right[field] || '').toLocaleLowerCase()
            : safeNumber(right[field])

        if (leftValue < rightValue) return -1 * direction
        if (leftValue > rightValue) return 1 * direction

        return String(left.path || '').localeCompare(String(right.path || ''))
    })
}

export function paginateAdminNotes(notes = [], page = 1, pageSize = PAGE_SIZE_DEFAULT) {
    const safePageSize = clampInteger(pageSize, PAGE_SIZE_DEFAULT, 1, PAGE_SIZE_MAX)
    const totalItems = notes.length
    const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize))
    const safePage = Math.min(clampInteger(page, 1, 1, Number.MAX_SAFE_INTEGER), totalPages)
    const start = (safePage - 1) * safePageSize

    return {
        items: notes.slice(start, start + safePageSize),
        page: safePage,
        pageSize: safePageSize,
        totalItems,
        totalPages,
    }
}

export function summarizeAdminNotes(notes = []) {
    return notes.reduce((summary, note) => ({
        total: summary.total + 1,
        shared: summary.shared + (note.shared ? 1 : 0),
        protected: summary.protected + (note.protected ? 1 : 0),
        indexed: summary.indexed + (note.indexed ? 1 : 0),
        views: summary.views + safeNumber(note.views),
        versions: summary.versions + safeNumber(note.versionCount),
    }), {
        total: 0,
        shared: 0,
        protected: 0,
        indexed: 0,
        views: 0,
        versions: 0,
    })
}

export function normalizeAdminDeleteSelection(body = {}) {
    if (Array.isArray(body?.items)) {
        return body.items.map(item => ({
            path: typeof item?.path === 'string' ? item.path : '',
            noteUid: typeof item?.noteUid === 'string' && item.noteUid ? item.noteUid : undefined,
        }))
    }
    if (Array.isArray(body?.paths)) {
        const uidMap = body?.noteUids && typeof body.noteUids === 'object' ? body.noteUids : null
        return body.paths.map(path => ({
            path: typeof path === 'string' ? path : '',
            noteUid: (uidMap && typeof path === 'string' && typeof uidMap[path] === 'string' && uidMap[path])
                ? uidMap[path]
                : undefined,
        }))
    }
    return null
}

export {
    PAGE_SIZE_DEFAULT,
    PAGE_SIZE_MAX,
}
