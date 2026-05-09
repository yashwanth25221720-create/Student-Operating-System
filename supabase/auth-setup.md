# Supabase Auth Setup

## Google Sign-In

1. In Supabase, open **Authentication > URL Configuration**.
2. Set **Site URL** to your local app while developing:

```text
http://127.0.0.1:5173
```

3. Add these **Redirect URLs**:

```text
http://127.0.0.1:5173/**
http://localhost:5173/**
https://your-production-domain.com/**
```

4. In **Authentication > Providers > Google**, enable Google and add your Google Client ID and Client Secret.
5. In Google Cloud Console, add this authorized redirect URI:

```text
https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback
```

Google sign-in will not work until both Supabase and Google Cloud have matching redirect URLs.

## Signup OTP Email

For the Register page OTP box to work, Supabase must send a numeric token.

1. In Supabase, open **Authentication > Emails > Confirm signup**.
2. Use an email body that includes the token:

```html
<h2>Your SOS verification code</h2>
<p>Enter this OTP in the app:</p>
<h1>{{ .Token }}</h1>
<p>This code expires soon. If you did not request it, ignore this email.</p>
```

3. Make sure **Authentication > Providers > Email** is enabled.
4. If emails are not reaching Gmail reliably, configure **Authentication > SMTP Settings** with your own sender domain. Gmail may put default Supabase emails in spam during testing.

If email confirmations are disabled, Supabase signs the user in immediately and the OTP screen is skipped.
