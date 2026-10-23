import { jsx } from 'react/jsx-runtime'
import { useState, useEffect } from 'react'
import * as sdk from '@hermes/plugin-sdk'

const { host } = sdk
const ROUTES_AREA = sdk.ROUTES_AREA
const SIDEBAR_NAV_AREA = sdk.SIDEBAR_NAV_AREA
const PALETTE_AREA = sdk.PALETTE_AREA

function Page() {
  const [account, setAccount] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => {
    (async () => {
      try {
        const r = await window.__xda_rest('/account')
        setAccount(r)
      } catch (e) { setErr(String(e)) }
    })()
  }, [])
  if (err) return jsx('div', { children: 'Error: ' + err })
  if (!account) return jsx('div', { children: 'Loading…' })
  return jsx('div', { style: { padding: 20 }, children: [
    jsx('h1', { children: 'X Dashboard' }),
    jsx('p', { children: 'Followers: ' + (account.followers_count || 0) }),
    jsx('p', { children: 'Verified followers: ' + (account.verified_followers_count || 0) }),
    jsx('p', { children: 'Posts: ' + (account.tweet_count || 0) })
  ] })
}

export default {
  id: 'x-dashboard',
  name: 'X Dashboard',
  register(ctx) {
    window.__xda_rest = (path) => ctx.rest(path)
    return ctx.registerMany([
      { id: 'page', area: ROUTES_AREA, data: { path: '/x-dashboard' }, render: () => jsx(Page, {}) },
      { id: 'nav', area: SIDEBAR_NAV_AREA, order: 90, data: { codicon: 'graph', label: 'X Dashboard', path: '/x-dashboard' } },
      { id: 'open', area: PALETTE_AREA, data: { id: 'x-dashboard.open', label: 'X Dashboard: Open', keywords: ['x','dashboard'], run: () => host.navigate('/x-dashboard') } }
    ])
  }
}
