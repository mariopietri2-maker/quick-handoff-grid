/*
  Auth project settings (applied via Management API for fresh-delivery):
  - mailer_autoconfirm = true  (no SMTP → confirmation emails never arrive;
    unconfirmed users get "Invalid login credentials" on password login)
  - site_url = https://fresh-delivery-rho.vercel.app
  - uri_allow_list includes production + localhost Vite ports

  Re-apply if the project is recreated:
    PATCH https://api.supabase.com/v1/projects/<ref>/config/auth
    { "mailer_autoconfirm": true, "site_url": "...", "uri_allow_list": "..." }

  When custom SMTP is configured, you may turn autoconfirm off again.
*/
SELECT 1;
