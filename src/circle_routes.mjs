/**
 * src/circle_routes.mjs
 * HTTP route handlers for /api/circles/* and public /c/:publicToken views.
 */

import { Cookies } from './cookie_compat.mjs'
import { getI18n, returnJSON } from './helper.js'
import { CIRCLE_CSP, CIRCLE_SECURITY_HEADERS, Circle } from './templates/circle.js'
import { resolveAccountPageTheme } from './templates/space.js'
import {
    AccountServiceError,
    addCircleItem,
    createCircle,
    deleteCircle,
    enforceAccountCsrf,
    enforceJsonContentType,
    getCircleOwnerDetail,
    listCircles,
    loadPublicCircleView,
    readBoundedJsonBody,
    removeCircleItem,
    resolveAccountSession,
    rotateCircleToken,
    updateCircle,
} from './account_data.mjs'
import { mapAccountErrorResponse, requireAccountSession } from './account_routes.mjs'

function jsonSuccess(payload, { headers = {}, status = 200 } = {}) {
    return returnJSON(
        0,
        payload,
        { status, 'Cache-Control': 'no-store', ...headers },
        payload,
    )
}

function methodNotAllowed(allowedMethods) {
    return returnJSON(
        405,
        { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed', error: 'Method not allowed' },
        { status: 405, 'Cache-Control': 'no-store', Allow: allowedMethods.join(', ') },
        { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed', error: 'Method not allowed' },
    )
}

function notFoundResponse(isHead = false) {
    const headers = new Headers({
        'Content-Type': 'text/plain; charset=UTF-8',
        ...CIRCLE_SECURITY_HEADERS,
        'Content-Security-Policy': CIRCLE_CSP,
    })
    return new Response(isHead ? null : 'Not Found', { status: 404, headers })
}

function wantsJsonResponse(request, url) {
    if (url.searchParams.get('format') === 'json') return true
    const accept = String(request?.headers?.get?.('Accept') || '').toLowerCase()
    return accept.includes('application/json') && !accept.includes('text/html')
}

async function handlePublicCirclePage(request, env, url, rawToken) {
    const method = request.method.toUpperCase()
    if (method !== 'GET' && method !== 'HEAD') {
        return methodNotAllowed(['GET', 'HEAD'])
    }
    const isHead = method === 'HEAD'

    let publicToken = rawToken
    try {
        publicToken = decodeURIComponent(rawToken)
    } catch {
        return notFoundResponse(isHead)
    }

    const preview = url.searchParams.get('preview') === '1'
    const viewerSession = preview ? await resolveAccountSession(request, env) : null

    const view = await loadPublicCircleView({
        env,
        publicToken,
        viewerSession,
        preview,
    })

    if (!view.found) {
        return notFoundResponse(isHead)
    }

    if (wantsJsonResponse(request, url)) {
        const payload = {
            circle: view.circle,
            items: view.items,
            isOwnerPreview: view.isOwnerPreview,
        }
        const headers = new Headers({
            'Content-Type': 'application/json; charset=UTF-8',
            ...CIRCLE_SECURITY_HEADERS,
            'Content-Security-Policy': CIRCLE_CSP,
        })
        return new Response(isHead ? null : JSON.stringify(payload), { status: 200, headers })
    }

    const queryLang = url.searchParams.get('lang')
    const lang = (queryLang === 'en-US' || queryLang === 'zh-TW') ? queryLang : getI18n(request)
    const cookies = Cookies.parse(request?.headers?.get?.('Cookie') || '')
    const theme = resolveAccountPageTheme(url.searchParams.get('theme') || cookies?.theme)

    const html = Circle({
        lang,
        theme,
        circle: view.circle,
        items: view.items,
        isOwnerPreview: view.isOwnerPreview,
    })

    const headers = new Headers({
        'Content-Type': 'text/html; charset=UTF-8',
        ...CIRCLE_SECURITY_HEADERS,
        'Content-Security-Policy': CIRCLE_CSP,
    })
    return new Response(isHead ? null : html, { status: 200, headers })
}

/**
 * Dispatch /api/circles/* and /c/:publicToken routes.
 * Returns null if the request path does not match a Circle route.
 */
export async function handleCircleRoutes(request, env = globalThis) {
    const url = new URL(request.url)
    const pathname = url.pathname
    const method = request.method.toUpperCase()

    try {
        const publicMatch = pathname.match(/^\/c\/([^/]+)\/?$/)
        if (publicMatch) {
            return await handlePublicCirclePage(request, env, url, publicMatch[1])
        }

        if (pathname === '/api/circles') {
            if (method === 'GET') {
                const session = await requireAccountSession(request, env)
                const circles = await listCircles({ env, accountId: session.account_id })
                return jsonSuccess({ circles })
            }
            if (method === 'POST') {
                enforceAccountCsrf(request, env)
                enforceJsonContentType(request)
                const body = await readBoundedJsonBody(request)
                const session = await requireAccountSession(request, env)
                const circle = await createCircle({
                    env,
                    accountId: session.account_id,
                    name: body.name,
                    isEnabled: body.isEnabled === true,
                })
                return jsonSuccess({ circle }, { status: 201 })
            }
            return methodNotAllowed(['GET', 'POST'])
        }

        const rotateMatch = pathname.match(/^\/api\/circles\/([^/]+)\/rotate$/)
        if (rotateMatch) {
            if (method !== 'POST') return methodNotAllowed(['POST'])
            enforceAccountCsrf(request, env)
            enforceJsonContentType(request)
            await readBoundedJsonBody(request, undefined, { allowEmpty: true })
            const session = await requireAccountSession(request, env)
            const circleId = decodeURIComponent(rotateMatch[1])
            const circle = await rotateCircleToken({ env, accountId: session.account_id, circleId })
            return jsonSuccess({ circle })
        }

        const itemsMatch = pathname.match(/^\/api\/circles\/([^/]+)\/items$/)
        if (itemsMatch) {
            if (method !== 'POST') return methodNotAllowed(['POST'])
            enforceAccountCsrf(request, env)
            enforceJsonContentType(request)
            const body = await readBoundedJsonBody(request)
            const session = await requireAccountSession(request, env)
            const circleId = decodeURIComponent(itemsMatch[1])
            const result = await addCircleItem({
                env,
                accountId: session.account_id,
                circleId,
                itemKey: body.itemKey || '',
                spaceItemId: body.spaceItemId || '',
                shareId: body.shareId || '',
                notePath: body.notePath || '',
                noteUid: body.noteUid || '',
                request,
            })
            return jsonSuccess(result, { status: 201 })
        }

        const itemDeleteMatch = pathname.match(/^\/api\/circles\/([^/]+)\/items\/([^/]+)$/)
        if (itemDeleteMatch) {
            if (method !== 'DELETE') return methodNotAllowed(['DELETE'])
            enforceAccountCsrf(request, env)
            enforceJsonContentType(request)
            await readBoundedJsonBody(request, undefined, { allowEmpty: true })
            const session = await requireAccountSession(request, env)
            const circleId = decodeURIComponent(itemDeleteMatch[1])
            const itemKey = decodeURIComponent(itemDeleteMatch[2])
            const result = await removeCircleItem({ env, accountId: session.account_id, circleId, itemKey })
            return jsonSuccess(result)
        }

        const circleDetailMatch = pathname.match(/^\/api\/circles\/([^/]+)$/)
        if (circleDetailMatch) {
            const circleId = decodeURIComponent(circleDetailMatch[1])
            if (method === 'GET') {
                const session = await requireAccountSession(request, env)
                const detail = await getCircleOwnerDetail({ env, accountId: session.account_id, circleId })
                return jsonSuccess(detail)
            }
            if (method === 'PATCH') {
                enforceAccountCsrf(request, env)
                enforceJsonContentType(request)
                const body = await readBoundedJsonBody(request)
                const session = await requireAccountSession(request, env)
                const circle = await updateCircle({
                    env,
                    accountId: session.account_id,
                    circleId,
                    name: body.name,
                    isEnabled: body.isEnabled,
                })
                return jsonSuccess({ circle })
            }
            if (method === 'DELETE') {
                enforceAccountCsrf(request, env)
                enforceJsonContentType(request)
                await readBoundedJsonBody(request, undefined, { allowEmpty: true })
                const session = await requireAccountSession(request, env)
                const result = await deleteCircle({ env, accountId: session.account_id, circleId })
                return jsonSuccess(result)
            }
            return methodNotAllowed(['GET', 'PATCH', 'DELETE'])
        }

        return null
    } catch (err) {
        if (err instanceof URIError) {
            return mapAccountErrorResponse(new AccountServiceError(400, 'INVALID_PATH', 'Invalid URL encoding'))
        }
        return mapAccountErrorResponse(err)
    }
}
