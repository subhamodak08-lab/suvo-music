# Suvo Music

Responsive dark music website starter for an independent artist. Built with React + Vite + Supabase.

## Features

- Public music library with search, genre labels, playlists and play counts
- MP3 streaming, cover artwork and direct downloads
- Supabase email/password authentication for admin access
- Admin upload and delete actions
- Mobile responsive layout
- Artist profile page (starter profile fields are currently local preview only)
- SQL schema with row-level security (RLS) and storage policies

## Requirements

- Node.js 18+ (20+ recommended)
- A free Supabase account/project
- A free deployment account such as Vercel or Netlify

## 1. Install locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL printed by Vite. The website shows demo cards until Supabase is configured.

## 2. Configure Supabase

1. Create a project at https://supabase.com.
2. Open **Project Settings → API** and copy the Project URL and publishable/anon key.
3. Put them in `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

The browser key is intended to be public; RLS policies are what protect the database. **Never put a service-role key in the frontend.**

4. Open **SQL Editor**, paste all of `supabase/schema.sql`, and run it.
5. Create your account through the site's **Admin login → Create one**. Confirm your email if Supabase requests it.
6. In Supabase **Authentication → Users**, copy your account UUID.
7. In SQL Editor run the following with your actual UUID:

```sql
insert into public.site_admins(user_id)
values ('YOUR-ADMIN-USER-UUID');
```

8. After your admin is set up, disable public sign-ups in **Authentication → Settings / Providers**. Use the dashboard to create future admin users and explicitly add their UUID to `site_admins`.

**Important:** Do not add yourself to `site_admins` until you have created the auth user. Do not publish the SQL with a placeholder UUID.

## 3. Run and build

```bash
npm run dev
npm run build
npm run preview
```

## 4. Deploy free

### Vercel
1. Push this folder to a private or public GitHub repository.
2. Import the repository at https://vercel.com/new.
3. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under Project Settings → Environment Variables.
5. Deploy. Re-deploy after changing environment variables.

### Netlify
1. Import the repository at https://app.netlify.com.
2. Build command: `npm run build`; publish directory: `dist`.
3. Add the same two environment variables and deploy.

Free-plan quotas and terms can change. Audio bandwidth/storage can become the main cost as the audience grows. Check current limits before publishing a large catalogue.

## 5. Upload your first song

1. Sign in with the admin account.
2. Click **Upload song**.
3. Enter title, artist, genre and playlist.
4. Choose an MP3 up to 20 MB and optional JPG/PNG/WebP cover art.
5. Publish. The track should appear in the public library and can be streamed/downloaded.

## Security notes

- RLS protects database writes; storage upload/delete policies are admin-only.
- The public song bucket means uploaded MP3s are intentionally public and downloadable.
- The starter's public signup should be disabled after initial admin setup.
- Admin role assignment is performed from the Supabase SQL editor/dashboard, not by a public user.
- For production, consider server-side rate limiting for play-count increments and use signed URLs/private storage if downloads should not be public.
- This starter does not include a custom domain, moderation system, or database-persisted artist profile editor.

## Troubleshooting

- `Invalid API key` / no songs: check `.env.local`, then restart Vite.
- Upload rejected: confirm the logged-in user's UUID exists in `public.site_admins`, SQL policies ran, and the file is MP3 under 20 MB.
- Cover upload rejected: use JPG, PNG or WebP under 5 MB.
- If email confirmation is enabled, confirm the account before logging in.
