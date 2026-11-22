/**
 * static/js/account-auth.mjs
 * Client-side Passkey WebAuthn, embedded WebView detection, step-up grants,
 * and account profile management helpers.
 */

export class AccountApiError extends Error {
    constructor(message, { status = 0, code = 'API_ERROR', payload = null } = {}) {
        super(message)
        this.name = 'AccountApiError'
        this.status = status
        this.code = code
        this.payload = payload
    }
}

export function base64UrlToUint8Array(value) {
    if (value instanceof Uint8Array) return value
    if (value instanceof ArrayBuffer) return new Uint8Array(value)
    const normalized = String(value || '')
        .trim()
        .replace(/-/g, '+')
        .replace(/_/g, '/')
    if (!normalized) return new Uint8Array(0)
    const padLen = (4 - (normalized.length % 4)) % 4
    const padded = normalized + '='.repeat(padLen)
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes
}

export function base64UrlToArrayBuffer(value) {
    const bytes = base64UrlToUint8Array(value)
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

export function arrayBufferToBase64Url(input) {
    if (!input) return ''
    const bytes = input instanceof Uint8Array
        ? input
        : input instanceof ArrayBuffer
            ? new Uint8Array(input)
            : ArrayBuffer.isView(input)
                ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
                : new Uint8Array(0)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const EMBEDDED_WEBVIEW_RE = /\b(Line|FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|WeChat|Telegram|Twitter|BytedanceWebview|TikTok|KAKAOTALK|Snapchat|LinkedInApp|GSA)\b|;\s*wv\)/i

export function isEmbeddedWebView(userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
    const ua = String(userAgent || '')
    if (!ua) return false
    if (EMBEDDED_WEBVIEW_RE.test(ua)) return true
    const isIos = /iPhone|iPad|iPod/i.test(ua)
    const hasAppleWebKit = /AppleWebKit/i.test(ua)
    const hasSafariToken = /Safari\//i.test(ua)
    const isKnownIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua)
    if (isIos && hasAppleWebKit && !hasSafariToken && !isKnownIosBrowser) {
        return true
    }
    return false
}

export function getWebAuthnSupportStatus() {
    const webview = isEmbeddedWebView()
    const hasCredentials = typeof navigator !== 'undefined'
        && Boolean(navigator.credentials)
        && typeof navigator.credentials.create === 'function'
        && typeof navigator.credentials.get === 'function'
    const hasPublicKeyCredential = typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined'
    return {
        supported: hasCredentials && hasPublicKeyCredential,
        isEmbeddedWebView: webview,
    }
}

export async function copyCurrentUrlToClipboard(targetUrl = typeof window !== 'undefined' ? window.location.href : '') {
    const text = String(targetUrl || '')
    if (!text) return false
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
            await navigator.clipboard.writeText(text)
            return true
        } catch {}
    }
    if (typeof document !== 'undefined' && document.body) {
        const area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', 'true')
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        try {
            const ok = document.execCommand('copy')
            area.remove()
            return ok
        } catch {
            area.remove()
            return false
        }
    }
    return false
}

export async function accountFetch(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase()
    const headers = {
        Accept: 'application/json',
        ...(options.headers || {}),
    }
    let body = options.body
    if (body !== undefined && body !== null && typeof body !== 'string') {
        headers['Content-Type'] = 'application/json'
        body = JSON.stringify(body)
    } else if (method !== 'GET' && method !== 'HEAD' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json'
        if (body === undefined) body = '{}'
    }

    const res = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers,
        body: method === 'GET' || method === 'HEAD' ? undefined : body,
    })

    let payload = null
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
        try {
            payload = await res.json()
        } catch {
            payload = null
        }
    } else {
        const text = await res.text().catch(() => '')
        payload = text ? { message: text } : null
    }

    if (!res.ok) {
        const code = payload?.code || payload?.error || `HTTP_${res.status}`
        const message = payload?.message || payload?.error || `Request failed (${res.status})`
        throw new AccountApiError(message, { status: res.status, code, payload })
    }

    return payload
}

export function prepareCreationOptions(serverOptions) {
    const source = serverOptions?.publicKey || serverOptions?.options?.publicKey || serverOptions?.options || serverOptions || {}
    return {
        ...source,
        challenge: base64UrlToUint8Array(source.challenge),
        user: {
            ...(source.user || {}),
            id: base64UrlToUint8Array(source.user?.id),
        },
        excludeCredentials: Array.isArray(source.excludeCredentials)
            ? source.excludeCredentials.map(item => ({
                ...item,
                id: base64UrlToUint8Array(item.id),
            }))
            : [],
    }
}

export function serializeRegistrationCredential(credential) {
    if (!credential || !credential.response) {
        throw new AccountApiError('Passkey registration was cancelled or returned an invalid credential.', { code: 'WEBAUTHN_EMPTY_CREDENTIAL' })
    }
    const transports = typeof credential.response.getTransports === 'function'
        ? credential.response.getTransports()
        : undefined
    return {
        id: credential.id,
        rawId: arrayBufferToBase64Url(credential.rawId),
        type: credential.type || 'public-key',
        authenticatorAttachment: credential.authenticatorAttachment || null,
        response: {
            clientDataJSON: arrayBufferToBase64Url(credential.response.clientDataJSON),
            attestationObject: arrayBufferToBase64Url(credential.response.attestationObject),
            ...(Array.isArray(transports) ? { transports } : {}),
        },
    }
}

export function prepareRequestOptions(serverOptions) {
    const source = serverOptions?.publicKey || serverOptions?.options?.publicKey || serverOptions?.options || serverOptions || {}
    return {
        ...source,
        challenge: base64UrlToUint8Array(source.challenge),
        allowCredentials: Array.isArray(source.allowCredentials)
            ? source.allowCredentials.map(item => ({
                ...item,
                id: base64UrlToUint8Array(item.id),
            }))
            : [],
    }
}

export function serializeAssertionCredential(credential) {
    if (!credential || !credential.response) {
        throw new AccountApiError('Passkey authentication was cancelled or returned an invalid assertion.', { code: 'WEBAUTHN_EMPTY_ASSERTION' })
    }
    return {
        id: credential.id,
        rawId: arrayBufferToBase64Url(credential.rawId),
        type: credential.type || 'public-key',
        authenticatorAttachment: credential.authenticatorAttachment || null,
        response: {
            clientDataJSON: arrayBufferToBase64Url(credential.response.clientDataJSON),
            authenticatorData: arrayBufferToBase64Url(credential.response.authenticatorData),
            signature: arrayBufferToBase64Url(credential.response.signature),
            userHandle: credential.response.userHandle
                ? arrayBufferToBase64Url(credential.response.userHandle)
                : null,
        },
    }
}

function assertWebAuthnAvailable() {
    const status = getWebAuthnSupportStatus()
    if (!status.supported) {
        throw new AccountApiError(
            status.isEmbeddedWebView
                ? 'Embedded WebView does not support Passkeys. Please open this URL in Safari or Chrome.'
                : 'This browser does not support WebAuthn Passkeys.',
            { code: status.isEmbeddedWebView ? 'WEBVIEW_UNSUPPORTED' : 'WEBAUTHN_UNSUPPORTED' },
        )
    }
}

export async function getAccountSession() {
    return accountFetch('/api/account/me', { method: 'GET' })
}

export async function registerPasskey({ nickname, turnstileToken = '', deviceLabel = '' } = {}) {
    assertWebAuthnAvailable()
    const trimmedNickname = String(nickname || '').trim()
    if (!trimmedNickname) {
        throw new AccountApiError('Nickname is required.', { status: 400, code: 'INVALID_NICKNAME' })
    }

    const optionsRes = await accountFetch('/api/auth/passkey/register/options', {
        method: 'POST',
        body: {
            nickname: trimmedNickname,
            ...(turnstileToken ? { turnstileToken } : {}),
        },
    })

    const publicKey = prepareCreationOptions(optionsRes)
    const challenge = optionsRes.challenge || arrayBufferToBase64Url(publicKey.challenge)
    const credential = await navigator.credentials.create({ publicKey })
    const serialized = serializeRegistrationCredential(credential)

    return accountFetch('/api/auth/passkey/register/verify', {
        method: 'POST',
        body: {
            challenge,
            nickname: trimmedNickname,
            deviceLabel: String(deviceLabel || '').trim(),
            ...(turnstileToken ? { turnstileToken } : {}),
            credential: serialized,
        },
    })
}

export async function loginWithPasskey() {
    assertWebAuthnAvailable()
    const optionsRes = await accountFetch('/api/auth/passkey/login/options', {
        method: 'POST',
        body: {},
    })
    const publicKey = prepareRequestOptions(optionsRes)
    const challenge = optionsRes.challenge || arrayBufferToBase64Url(publicKey.challenge)
    const credential = await navigator.credentials.get({ publicKey })
    const serialized = serializeAssertionCredential(credential)

    return accountFetch('/api/auth/passkey/login/verify', {
        method: 'POST',
        body: {
            challenge,
            credential: serialized,
        },
    })
}

export async function logoutAccount() {
    return accountFetch('/api/auth/passkey/logout', {
        method: 'POST',
        body: {},
    })
}

export async function updateNickname(nickname) {
    return accountFetch('/api/account/nickname', {
        method: 'PATCH',
        body: { nickname: String(nickname || '').trim() },
    })
}

export async function listPasskeys() {
    return accountFetch('/api/account/passkeys', { method: 'GET' })
}

export async function requestStepUpGrant(purpose) {
    assertWebAuthnAvailable()
    const optionsRes = await accountFetch('/api/account/passkeys/stepup/options', {
        method: 'POST',
        body: { purpose },
    })
    const publicKey = prepareRequestOptions(optionsRes)
    const challenge = optionsRes.challenge || arrayBufferToBase64Url(publicKey.challenge)
    const credential = await navigator.credentials.get({ publicKey })
    const serialized = serializeAssertionCredential(credential)

    return accountFetch('/api/account/passkeys/stepup/verify', {
        method: 'POST',
        body: {
            challenge,
            credential: serialized,
        },
    })
}

export async function addPasskeyWithStepUp({ deviceLabel = '' } = {}) {
    assertWebAuthnAvailable()
    const stepup = await requestStepUpGrant('passkey_add_stepup')
    const grantId = stepup?.grantId
    if (!grantId) {
        throw new AccountApiError('Step-up verification did not return a grantId.', { code: 'STEPUP_FAILED' })
    }

    const cleanLabel = String(deviceLabel || '').trim()
    const optionsRes = await accountFetch('/api/account/passkeys/add/options', {
        method: 'POST',
        body: {
            grantId,
            deviceLabel: cleanLabel,
        },
    })
    const publicKey = prepareCreationOptions(optionsRes)
    const challenge = optionsRes.challenge || arrayBufferToBase64Url(publicKey.challenge)
    const credential = await navigator.credentials.create({ publicKey })
    const serialized = serializeRegistrationCredential(credential)

    return accountFetch('/api/account/passkeys/add/verify', {
        method: 'POST',
        body: {
            challenge,
            grantId,
            deviceLabel: cleanLabel,
            credential: serialized,
        },
    })
}

export async function removePasskeyWithStepUp(credentialId) {
    assertWebAuthnAvailable()
    const cleanId = String(credentialId || '').trim()
    if (!cleanId) {
        throw new AccountApiError('Credential ID is required.', { status: 400, code: 'INVALID_CREDENTIAL_ID' })
    }
    const stepup = await requestStepUpGrant('passkey_remove_stepup')
    const grantId = stepup?.grantId
    if (!grantId) {
        throw new AccountApiError('Step-up verification did not return a grantId.', { code: 'STEPUP_FAILED' })
    }

    return accountFetch('/api/account/passkeys/remove', {
        method: 'POST',
        body: {
            grantId,
            credentialId: cleanId,
        },
    })
}
