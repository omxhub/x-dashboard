# X Dashboard (Hermes plugin)

Read-only X analytics dashboard for Hermes. Each user brings their own X API credits.

## Install

1. Copy this repo's `dashboard/` folder into your Hermes plugins directory:

   ```
   ~/.hermes/plugins/x-dashboard/dashboard/
   ```

2. Enable the plugin in `~/.hermes/config.yaml`:

   ```yaml
   plugins:
     enabled:
       - x-dashboard
   ```

3. Restart the Hermes dashboard.

4. Install `xurl` and authenticate (outside the agent):

   ```bash
   npm install -g @xdevplatform/xurl
   xurl auth apps add my-app --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET
   xurl auth oauth2 --app my-app
   xurl auth default my-app
   ```

   Tokens stay in `~/.xurl` on your machine. Nothing is committed.

5. Open the Hermes dashboard sidebar → **X Dashboard** and click Refresh.

## Cost

Uses X API owned reads (~$0.001/resource). A refresh is roughly $0.05. Auto-recharge should stay off; set a spending limit in the X Developer Console.

## Read-only

No posting, DMs, follows, likes, or deletes. Only reads your own account data.

## License

MIT
