(function () {
  var SDK = window.__HERMES_PLUGIN_SDK__ || {};
  var React = SDK.React || window.React;
  var h = React.createElement;
  var hooks = SDK.hooks || {};
  var useState = hooks.useState || React.useState;
  var useEffect = hooks.useEffect || React.useEffect;
  var fetchJSON = SDK.fetchJSON || function (p) { return fetch(p).then(function (r) { return r.json(); }); };

  var GOAL_FOLLOWERS = 500;
  var GOAL_IMPRESSIONS = 500000;

  function Card(props) {
    return h('div', { className: 'xa-card' }, props.children);
  }
  function Label(props) { return h('div', { className: 'xa-label' }, props.children); }
  function Value(props) { return h('div', { className: 'xa-value' }, props.children); }

  function ProgressBar(props) {
    var pct = Math.min(100, Math.max(0, (props.value / props.goal) * 100));
    return h('div', { className: 'xa-progress' },
      h('div', { className: 'xa-progress-fill', style: { width: pct + '%' } }),
      h('div', { className: 'xa-progress-text' }, props.value.toLocaleString() + ' / ' + props.goal.toLocaleString() + ' (' + pct.toFixed(1) + '%)')
    );
  }

  function Page() {
    var _a = useState(null); var account = _a[0]; var setAccount = _a[1];
    var _p = useState(null); var posts = _p[0]; var setPosts = _p[1];
    var _m = useState(null); var mentions = _m[0]; var setMentions = _m[1];
    var _s = useState(null); var summary = _s[0]; var setSummary = _s[1];
    var _l = useState(false); var loading = _l[0]; var setLoading = _l[1];
    var _e = useState(null); var error = _e[0]; var setError = _e[1];

    function load() {
      setLoading(true);
      setError(null);
      Promise.all([
        fetchJSON('/api/plugins/x-dashboard/account'),
        fetchJSON('/api/plugins/x-dashboard/posts?limit=20'),
        fetchJSON('/api/plugins/x-dashboard/mentions?limit=10'),
        fetchJSON('/api/plugins/x-dashboard/summary'),
      ]).then(function (res) {
        if (res[0] && res[0].ok) setAccount(res[0]); else setError((res[0] && res[0].error) || 'account failed');
        if (res[1] && res[1].ok) setPosts(res[1]);
        if (res[2] && res[2].ok) setMentions(res[2]);
        if (res[3] && res[3].ok) setSummary(res[3]);
      }).catch(function (e) { setError(String(e)); })
        .finally(function () { setLoading(false); });
    }

    useEffect(function () { load(); }, []);

    var verifiedFollowers = account ? (account.verified_followers_count || 0) : 0;
    var followers = account ? (account.followers_count || 0) : 0;
    var recentImpressions = summary ? (summary.recent_posts_impressions || 0) : 0;

    return h('div', { className: 'xa-root' },
      h('div', { className: 'xa-header' },
        h('h1', null, 'X Dashboard'),
        h('button', { className: 'xa-refresh', onClick: load, disabled: loading }, loading ? 'Loading…' : 'Refresh')
      ),
      error ? h('div', { className: 'xa-error' }, 'Error: ' + (typeof error === 'string' ? error : JSON.stringify(error))) : null,

      h('div', { className: 'xa-grid' },
        Card({ children: [
          Label(null, 'Followers'),
          Value(null, followers.toLocaleString()),
          Label(null, 'Verified followers'),
          Value(null, verifiedFollowers.toLocaleString()),
        ]}),
        Card({ children: [
          Label(null, 'Progress: 500 verified followers'),
          ProgressBar({ value: verifiedFollowers, goal: GOAL_FOLLOWERS }),
        ]}),
        Card({ children: [
          Label(null, 'Recent posts impressions (last 20)'),
          Value(null, recentImpressions.toLocaleString()),
          Label(null, 'Progress: 500K verified impressions'),
          ProgressBar({ value: recentImpressions, goal: GOAL_IMPRESSIONS }),
          h('div', { className: 'xa-note' }, 'Note: X API exposes total impressions only. Verified-only impressions are not available via API; X Premium analytics UI has them.')
        ]}),
        account ? Card({ children: [
          Label(null, 'Account'),
          h('div', { className: 'xa-row' }, h('span', null, 'Subscription: '), h('strong', null, account.subscription_type || '—')),
          h('div', { className: 'xa-row' }, h('span', null, 'Posts: '), h('strong', null, (account.tweet_count || 0).toLocaleString())),
          h('div', { className: 'xa-row' }, h('span', null, 'Following: '), h('strong', null, (account.following_count || 0).toLocaleString())),
          h('div', { className: 'xa-row' }, h('span', null, 'Listed: '), h('strong', null, (account.listed_count || 0).toLocaleString())),
        ]}) : null
      ),

      posts ? h('div', { className: 'xa-section' },
        h('h2', null, 'Recent posts'),
        h('table', { className: 'xa-table' },
          h('thead', null, h('tr', null,
            h('th', null, 'Created'), h('th', null, 'Text'), h('th', null, 'Impressions'), h('th', null, 'Likes'), h('th', null, 'Reposts'), h('th', null, 'Replies')
          )),
          h('tbody', null, posts.items.map(function (p) {
            return h('tr', { key: p.id },
              h('td', null, (p.created_at || '').slice(0, 16).replace('T', ' ')),
              h('td', { className: 'xa-text' }, (p.text || '').slice(0, 90)),
              h('td', null, (p.impressions || 0).toLocaleString()),
              h('td', null, (p.likes || 0).toLocaleString()),
              h('td', null, (p.reposts || 0).toLocaleString()),
              h('td', null, (p.replies || 0).toLocaleString())
            );
          }))
        )
      ) : null,

      mentions ? h('div', { className: 'xa-section' },
        h('h2', null, 'Recent mentions'),
        h('ul', { className: 'xa-mentions' }, mentions.items.map(function (m) {
          return h('li', { key: m.id },
            h('strong', null, '@' + (m.author_username || 'unknown')),
            ' — ', (m.text || '').slice(0, 120),
            h('span', { className: 'xa-meta' }, ' · ' + (m.impressions || 0).toLocaleString() + ' imp')
          );
        }))
      ) : null,

      h('div', { className: 'xa-footer' }, 'Read-only. Data via X API owned reads. Tokens local. Refresh charges ~$0.05.')
    );
  }

  var style = document.createElement('style');
  style.textContent = [
    '.xa-root{padding:20px;font-family:var(--theme-font-sans,system-ui);color:var(--midground,#e5e7eb);}',
    '.xa-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;}',
    '.xa-header h1{margin:0;font-size:20px;}',
    '.xa-refresh{background:var(--color-primary,#3b82f6);color:#fff;border:none;border-radius:var(--radius,8px);padding:8px 14px;cursor:pointer;}',
    '.xa-refresh:disabled{opacity:.6;cursor:default;}',
    '.xa-error{background:var(--color-destructive,#ef4444);color:#fff;padding:10px;border-radius:8px;margin-bottom:12px;}',
    '.xa-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:16px;}',
    '.xa-card{background:var(--color-card,rgba(255,255,255,.05));border:1px solid var(--color-border,rgba(255,255,255,.1));border-radius:var(--radius,12px);padding:14px;}',
    '.xa-label{font-size:12px;color:var(--color-muted-foreground,#9ca3af);text-transform:uppercase;margin-top:6px;}',
    '.xa-value{font-size:26px;font-weight:700;margin:2px 0 6px;}',
    '.xa-row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--color-border,rgba(255,255,255,.08));}',
    '.xa-progress{position:relative;height:22px;background:var(--color-border,rgba(255,255,255,.1));border-radius:11px;overflow:hidden;margin:6px 0;}',
    '.xa-progress-fill{height:100%;background:var(--color-primary,#3b82f6);transition:width .3s;}',
    '.xa-progress-text{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;}',
    '.xa-note{font-size:11px;color:var(--color-muted-foreground,#9ca3af);margin-top:8px;}',
    '.xa-section{margin-top:16px;}',
    '.xa-section h2{font-size:16px;margin-bottom:8px;}',
    '.xa-table{width:100%;border-collapse:collapse;font-size:13px;}',
    '.xa-table th,.xa-table td{padding:6px 8px;border-bottom:1px solid var(--color-border,rgba(255,255,255,.08));text-align:left;}',
    '.xa-text{max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.xa-mentions{list-style:none;padding:0;margin:0;}',
    '.xa-mentions li{padding:8px 0;border-bottom:1px solid var(--color-border,rgba(255,255,255,.08));}',
    '.xa-meta{color:var(--color-muted-foreground,#9ca3af);font-size:12px;}',
    '.xa-footer{margin-top:20px;font-size:11px;color:var(--color-muted-foreground,#9ca3af);}'
  ].join('');
  document.head.appendChild(style);

  window.__HERMES_PLUGINS__ = window.__HERMES_PLUGINS__ || {};
  window.__HERMES_PLUGINS__['x-dashboard'] = Page;
})();
