/**
 * src/account_routes.mjs
 * HTTP route handlers for /_space, /api/auth/passkey/*, /api/account/*, and /api/space/*.
 */

import { getSecret } from './constant.js'
import { Cookies } from './cookie_compat.mjs'
import { getI18n, returnJSON } from './helper.js'
import { StorageAuthorityError, isAccountFeatureEnabled } from './storage_driver.mjs'
import { SPACE_SECURITY_HEADERS, Space, buildSpacesCirclesCsp, resolveAccountPageTheme } from './templates/space.js'
import { WebAuthnError } from './webauthn_core.mjs'
import {
    AccountServiceError,
    addPasskeyFinish,
    addPasskeyStart,
    assertAccountFeatureReady,
    bookmarkNoteToSpace,
    buildSessionCookie,
    commitGuestHistoryImport,
    deleteAccountAnnotationMessage,
    deleteSpaceItem,
    enforceAccountCsrf,
    enforceJsonContentType,
    getTurnstileBootstrapConfig,
    listAccountAnnotations,
    listAccountPasskeys,
    listCircles,
    listSpaceItems,
    loginPasskeyFinish,
    loginPasskeyStart,
    logoutSession,
    parseSessionCookie,
    previewGuestHistoryImport,
    readBoundedJsonBody,
    registerPasskeyFinish,
    registerPasskeyStart,
    removePasskey,
    resolveAccountSession,
    stepupFinish,
    stepupStart,
    updateAccountNickname,
} from './account_data.mjs'

function jsonSuccess(payload, { headers = {}, status = 200 } = {}) {
    return returnJSON(
        0,
        payload,
        { status, 'Cache-Control': 'no-store', ...headers },
        payload,
    )
}

export function mapAccountErrorResponse(err) {
    if (err instanceof AccountServiceError) {
        const body = {
            code: err.code,
            message: err.message,
            error: err.message,
            ...(err.extra || {}),
        }
        return returnJSON(err.status, body, { status: err.status, 'Cache-Control': 'no-store' }, body)
    }
    if (err instanceof StorageAuthorityError || err?.name === 'StorageAuthorityError') {
        const body = {
            code: err.code || 'STORAGE_UNAVAILABLE',
            message: err.message || 'Storage unavailable',
            error: err.message || 'Storage unavailable',
        }
        return returnJSON(503, body, { status: 503, 'Cache-Control': 'no-store' }, body)
    }
    if (err instanceof WebAuthnError) {
        const body = {
            code: err.code || 'WEBAUTHN_ERROR',
            message: err.message || 'WebAuthn verification failed',
            error: err.message || 'WebAuthn verification failed',
        }
        return returnJSON(400, body, { status: 400, 'Cache-Control': 'no-store' }, body)
    }
    const body = {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected account server error',
        error: 'Unexpected account server error',
    }
    return returnJSON(500, body, { status: 500, 'Cache-Control': 'no-store' }, body)
}

export async function requireAccountSession(request, env = globalThis) {
    await assertAccountFeatureReady(env, { write: false })
    const session = await resolveAccountSession(request, env)
    if (!session) {
        throw new AccountServiceError(401, 'UNAUTHORIZED', 'Authentication required')
    }
    return session
}

function methodNotAllowed(allowedMethods) {
    return returnJSON(
        405,
        { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed', error: 'Method not allowed' },
        { status: 405, 'Cache-Control': 'no-store', Allow: allowedMethods.join(', ') },
        { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed', error: 'Method not allowed' },
    )
}

function resolveSpaceLang(request, url) {
    const queryLang = url.searchParams.get('lang')
    if (queryLang === 'en-US' || queryLang === 'zh-TW') return queryLang
    return getI18n(request)
}

function resolveSpaceTheme(request, url) {
    const queryTheme = url.searchParams.get('theme')
    if (queryTheme) return resolveAccountPageTheme(queryTheme)
    const cookies = Cookies.parse(request?.headers?.get?.('Cookie') || '')
    return resolveAccountPageTheme(cookies?.theme)
}

async function handleSpacePage(request, env, url) {
    const method = request.method.toUpperCase()
    if (method !== 'GET' && method !== 'HEAD') {
        return methodNotAllowed(['GET', 'HEAD'])
    }

    const lang = resolveSpaceLang(request, url)
    const theme = resolveSpaceTheme(request, url)
    const ts = getTurnstileBootstrapConfig(env)
    const secret = env?.SCN_SECRET ?? getSecret()
    const accountEnabled = Boolean(isAccountFeatureEnabled(env) && secret && String(secret).trim())

    const headers = new Headers({
        'Content-Type': 'text/html; charset=UTF-8',
        ...SPACE_SECURITY_HEADERS,
        'Content-Security-Policy': buildSpacesCirclesCsp({ allowTurnstile: ts.policy === 'enabled' }),
    })

    if (!accountEnabled) {
        const html = Space({
            lang,
            theme,
            accountEnabled: false,
            authenticated: false,
            turnstileEnabled: false,
            turnstileSiteKey: '',
        })
        return new Response(method === 'HEAD' ? null : html, { status: 200, headers })
    }

    try {
        await assertAccountFeatureReady(env, { write: false })
        const session = await resolveAccountSession(request, env)
        let items = []
        let pagination = { page: 1, pageSize: 50, total: 0, totalPages: 1 }
        let passkeys = []
        let circles = []

        if (session) {
            const [spaceRes, pkRes, circleRes] = await Promise.all([
                listSpaceItems({ env, accountId: session.account_id, page: 1, pageSize: 50 }),
                listAccountPasskeys(env, session.account_id),
                listCircles({ env, accountId: session.account_id }),
            ])
            items = spaceRes.items
            pagination = spaceRes.pagination
            passkeys = pkRes
            circles = circleRes
        }

        const html = Space({
            lang,
            theme,
            accountEnabled: true,
            authenticated: Boolean(session),
            account: session
                ? {
                    nickname: session.nickname,
                    createdAt: Number(session.account_created_at || 0),
                    updatedAt: Number(session.account_updated_at || 0),
                }
                : null,
            passkeys,
            items,
            pagination,
            circles,
            turnstileEnabled: ts.turnstileEnabled,
            turnstileSiteKey: ts.turnstileSiteKey,
        })

        return new Response(method === 'HEAD' ? null : html, { status: 200, headers })
    } catch (err) {
        return mapAccountErrorResponse(err)
    }
}

/**
 * Dispatch /_space, /api/auth/passkey/*, /api/account/*, and /api/space/* routes.
 * Returns null if the request path does not belong to account/space routes.
 */
export async function handleAccountRoutes(request, env = globalThis) {
    const url = new URL(request.url)
    const pathname = url.pathname
    const method = request.method.toUpperCase()

    if (pathname === '/_space') {
        return handleSpacePage(request, env, url)
    }

    try {
        if (pathname === '/api/auth/passkey/register/options') {
            if (method !== 'POST') return methodNotAllowed(['POST'])
            enforceAccountCsrf(request, env)
            enforceJsonContentType(request)
            const body = await readBoundedJsonBody(request)
            const data = await registerPasskeyStart(request, env, body)
            return jsonSuccess(data)
        }

        if (pathname === '/api/auth/passkey/register/verify') {
            if (method !== 'POST') return methodNotAllowed(['POST'])
            enforceAccountCsrf(request, env)
            enforceJsonContentType(request)
            const body = await readBoundedJsonBody(request)
            const result = await registerPasskeyFinish(request, env, body)
            const setCookie = buildSessionCookie(result.sessionId, request)
            return jsonSuccess(
                { authenticated: true, account: result.account, credentialId: result.credentialId },
                { headers: { 'Set-Cookie': setCookie } },
            )
        }

        if (pathname === '/api/auth/passkey/login/options') {
            if (method !== 'POST') return methodNotAllowed(['POST'])
            enforceAccountCsrf(request, env)
            enforceJsonContentType(request)
            await readBoundedJsonBody(request, undefined, { allowEmpty: true })
            const data = await loginPasskeyStart(request, env)
            return jsonSuccess(data)
        }

        if (pathname === '/api/auth/passkey/login/verify') {
            if (method !== 'POST') return methodNotAllowed(['POST'])
            enforceAccountCsrf(request, env)
            enforceJsonContentType(request)
            const body = await readBoundedJsonBody(request)
            const result = await loginPasskeyFinish(request, env, body)
            const setCookie = buildSessionCookie(result.sessionId, request)
            return jsonSuccess(
                { authenticated: true, account: result.account },
                { headers: { 'Set-Cookie': setCookie } },
            )
        }

        if (pathname === '/api/auth/passkey/logout') {
            if (method !== 'POST') return methodNotAllowed(['POST'])
            enforceAccountCsrf(request, env)
            enforceJsonContentType(request)
            await readBoundedJsonBody(request, undefined, { allowEmpty: true })
            await assertAccountFeatureReady(env, { write: true })
            const sessionId = parseSessionCookie(request)
            await logoutSession(env, sessionId)
            const clearCookie = buildSessionCookie('', request, { clear: true })
            return jsonSuccess(
                { authenticated: false, loggedOut: true },
                { headers: { 'Set-Cookie': clearCookie } },
            )
        }

        if (pathname === '/api/account/me') {
            if (method === 'GET') {
                await assertAccountFeatureReady(env, { write: false })
                const session = await resolveAccountSession(request, env)
                if (!session) {
                    return jsonSuccess({ authenticated: false, account: null })
                }
                return jsonSuccess({
                    authenticated: true,
                    account: {
                        nickname: session.nickname,
                        createdAt: Number(session.account_created_at || 0),
                        updatedAt: Number(session.account_updated_at || 0),
                    },
                })
            }
            if (method === 'PATCH') {
                enforceAccountCsrf(request, env)
                enforceJsonContentType(request)
                const body = await readBoundedJsonBody(request)
                const session = await requireAccountSession(request, env)
                const account = await updateAccountNickname(env, session.account_id, body.nickname)
                return jsonSuccess({ account })
            }
            return methodNotAllowed(['GET', 'PATCH'])
        }

        if (pathname === '/api/account/nickname') {
            if (method !== 'PATCH') return methodNotAllowed(['PATCH'])
            enforceAccountCsrf(request, env)
            enforceJsonContentType(request)
            const body = await readBoundedJsonBody(request)
            const session = await requireAccountSession(request, env)
            const account = await updateAccountNickname(env, session.account_id, body.nickname)
            return jsonSuccess({ account })
        }

        if (pathname === '/api/account/passkeys') {
            if (method !== 'GET') return methodNotAllowed(['GET'])
            const session = await requireAccountSession(request, env)
            const passkeys = await listAccountPasskeys(env, session.account_id)
            return jsonSuccess({ passkeys })
        }

        if (pathname === '/api/account/passkeys/stepup/options') {
            if (method !== 'POST') return methodNotAllowed(['POST'])
            enforceAccountCsrf(request, env)
            enforceJsonContentType(request)
            const body = await readBoundedJsonBody(request)
            const session = await requireAccountSession(request, env)
            const data = await stepupStart(request, env, session, body)
            return jsonSuccess(data)
        }

        if (pathname === '/api/account/passkeys/stepup/verify') {
            if (method !== 'POST') return methodNotAllowed(['POST'])
            enforceAccountCsrf(request, env)
            enforceJsonContentType(request)
            const body = await readBoundedJsonBody(request)
            const session = await requireAccountSession(request, env)
            const data = await stepupFinish(request, env, session, body)
            return jsonSuccess(data)
        }

        if (pathname === '/api/account/passkeys/add/options') {
            if (method !== 'POST') return methodNotAllowed(['POST'])
            enforceAccountCsrf(request, env)
            enforceJsonContentType(request)
            const body = await readBoundedJsonBody(request)
            const session = await requireAccountSession(request, env)
            const data = await addPasskeyStart(request, env, session, body)
            return jsonSuccess(data)
        }

        if (pathname === '/api/account/passkeys/add/verify') {
            if (method !== 'POST') return methodNotAllowed(['POST'])
            enforceAccountCsrf(request, env)
            enforceJsonContentType(request)
            const body = await readBoundedJsonBody(request)
            const session = await requireAccountSession(request, env)
            const data = await addPasskeyFinish(request, env, session, body)
            return jsonSuccess(data)
        }

        if (pathname === '/api/account/passkeys/remove') {
            if (method !== 'POST') return methodNotAllowed(['POST'])
            enforceAccountCsrf(request, env)
            enforceJsonContentType(request)
            const body = await readBoundedJsonBody(request)
            const session = await requireAccountSession(request, env)
            const data = await removePasskey(request, env, session, {
                grantId: body.grantId,
                credentialId: body.credentialId,
            })
            return jsonSuccess(data)
        }

        const passkeyDeleteMatch = pathname.match(/^\/api\/account\/passkeys\/([^/]+)$/)
        if (passkeyDeleteMatch) {
            if (method !== 'DELETE') return methodNotAllowed(['DELETE'])
            enforceAccountCsrf(request, env)
            enforceJsonContentType(request)
            const body = await readBoundedJsonBody(request, undefined, { allowEmpty: true })
            const session = await requireAccountSession(request, env)
            let credentialId = passkeyDeleteMatch[1]
            try {
                credentialId = decodeURIComponent(credentialId)
            } catch {
                throw new AccountServiceError(400, 'INVALID_CREDENTIAL_ID', 'Invalid credentialId encoding')
            }
            const grantId = body.grantId || url.searchParams.get('grantId') || request.headers.get('x-stepup-grant-id') || ''
            const data = await removePasskey(request, env, session, { grantId, credentialId })
            return jsonSuccess(data)
        }

        if (pathname === '/api/account/annotations') {
            if (method !== 'GET') return methodNotAllowed(['GET'])
            const session = await requireAccountSession(request, env)
            const limit = url.searchParams.get('limit') || 50
            const annotations = await listAccountAnnotations(env, session.account_id, { limit })
            return jsonSuccess({ annotations })
        }

        const annDeleteMatch = pathname.match(/^\/api\/account\/annotations\/([^/]+)$/)
        if (annDeleteMatch) {
            if (method !== 'DELETE') return methodNotAllowed(['DELETE'])
            enforceAccountCsrf(request, env)
            enforceJsonContentType(request)
            await readBoundedJsonBody(request, undefined, { allowEmpty: true })
            const session = await requireAccountSession(request, env)
            let messageId = annDeleteMatch[1]
            try {
                messageId = decodeURIComponent(messageId)
            } catch {
                throw new AccountServiceError(400, 'INVALID_MESSAGE_ID', 'Invalid messageId encoding')
            }
            const data = await deleteAccountAnnotationMessage(env, session.account_id, messageId)
            return jsonSuccess(data)
        }

        if (pathname === '/api/space/items') {
            if (method !== 'GET') return methodNotAllowed(['GET'])
            const session = await requireAccountSession(request, env)
            const data = await listSpaceItems({
                env,
                accountId: session.account_id,
                facet: url.searchParams.get('facet') || 'all',
                format: url.searchParams.get('format') || 'all',
                page: url.searchParams.get('page') || 1,
                pageSize: url.searchParams.get('pageSize') || 50,
                cursor: url.searchParams.get('cursor'),
                limit: url.searchParams.get('limit'),
            })
            return jsonSuccess(data)
        }

        if (pathname === '/api/space/bookmark') {
            if (method !== 'POST') return methodNotAllowed(['POST'])
            enforceAccountCsrf(request, env)
            enforceJsonContentType(request)
            const body = await readBoundedJsonBody(request)
            const session = await requireAccountSession(request, env)
            const data = await bookmarkNoteToSpace({
                env,
                accountId: session.account_id,
                shareId: body.shareId || '',
                notePath: body.notePath || '',
                noteUid: body.noteUid || '',
                editorFormat: body.editorFormat || 'markdown',
                titleSummary: body.titleSummary || '',
                request,
            })
            return jsonSuccess(data)
        }

        const spaceDeleteMatch = pathname.match(/^\/api\/space\/items\/([^/]+)$/)
        if (spaceDeleteMatch) {
            if (method !== 'DELETE') return methodNotAllowed(['DELETE'])
            enforceAccountCsrf(request, env)
            enforceJsonContentType(request)
            await readBoundedJsonBody(request, undefined, { allowEmpty: true })
            const session = await requireAccountSession(request, env)
            let itemKey = spaceDeleteMatch[1]
            try {
                itemKey = decodeURIComponent(itemKey)
            } catch {
                throw new AccountServiceError(400, 'INVALID_ITEM_KEY', 'Invalid itemKey encoding')
            }
            const data = await deleteSpaceItem({ env, accountId: session.account_id, itemKey })
            return jsonSuccess(data)
        }

        if (pathname === '/api/space/import/preview') {
            if (method !== 'POST') return methodNotAllowed(['POST'])
            enforceAccountCsrf(request, env)
            enforceJsonContentType(request)
            const body = await readBoundedJsonBody(request)
            const session = await requireAccountSession(request, env)
            const data = await previewGuestHistoryImport(request, env, session.account_id, body)
            return jsonSuccess(data)
        }

        if (pathname === '/api/space/import') {
            if (method !== 'POST') return methodNotAllowed(['POST'])
            enforceAccountCsrf(request, env)
            enforceJsonContentType(request)
            const body = await readBoundedJsonBody(request)
            const session = await requireAccountSession(request, env)
            const data = await commitGuestHistoryImport(request, env, session.account_id, body)
            return jsonSuccess(data)
        }

        return null
    } catch (err) {
        return mapAccountErrorResponse(err)
    }
}
