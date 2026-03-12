# Database Migration Guide

## Migrations to Apply

You need to apply the following 3 new migrations to your Supabase database:

### 1. Create Member Requests Table
**File:** `supabase/migrations/20251110000007_create_member_requests.sql`

This creates the `member_requests` table to store public membership applications.

### 2. Create Approved Emails Whitelist
**File:** `supabase/migrations/20251110000008_create_approved_emails_whitelist.sql`

This creates the `approved_emails` table which acts as a whitelist for Google OAuth login.

### 3. Update Auth Flow for OAuth
**File:** `supabase/migrations/20251110000009_update_auth_flow_for_oauth.sql`

This updates the `profiles` table and `handle_new_user()` trigger to enforce the email whitelist.

## How to Apply Migrations

### Option 1: Using Supabase CLI (Recommended)

If you have Supabase CLI installed:

```bash
# Navigate to project directory
cd D:\JKKN\yi-connect

# Apply all pending migrations
supabase db push
```

### Option 2: Using Supabase Studio (Web Interface)

1. Go to your Supabase project dashboard at https://supabase.com
2. Navigate to **SQL Editor** in the left sidebar
3. For each migration file, copy the entire SQL content and paste it into the SQL Editor
4. Run them in order:
   - First: `20251110000007_create_member_requests.sql`
   - Second: `20251110000008_create_approved_emails_whitelist.sql`
   - Third: `20251110000009_update_auth_flow_for_oauth.sql`

### Option 3: Using npx supabase

If you don't have Supabase CLI installed globally, you can use npx:

```bash
npx supabase db push
```

## Verify Migrations

After applying the migrations, verify in Supabase Studio:

1. **Table Editor** → Check that these tables exist:
   - `member_requests`
   - `approved_emails`

2. **Table Editor** → `profiles` table → Check for new columns:
   - `invited_by`
   - `approved_email_id`

3. **Database** → Functions → Check that `handle_new_user()` function exists and is updated

## Testing the New Flow

After migrations are applied, test the complete workflow:

1. **Public Application:**
   - Visit http://localhost:3000/apply
   - Fill out the membership application form
   - Submit the application

2. **Admin Approval:**
   - Login as Executive Member or National Admin
   - Go to http://localhost:3000/member-requests
   - Review and approve the application
   - This adds the email to the whitelist

3. **Member Login:**
   - Go to http://localhost:3000/login
   - Click "Continue with Google"
   - Sign in with the approved email
   - First login automatically creates member record
   - Redirected to dashboard

4. **Unauthorized Login Test:**
   - Try logging in with an email that was NOT approved
   - Should see error: "Email is not authorized. Please apply for membership first."

## Troubleshooting

### Error: "relation already exists"
If you see errors about relations already existing, the migration may have been partially applied. Check which tables exist in Supabase Studio and skip the relevant migrations.

### Error: "permission denied"
Make sure you're using the service role key or have proper permissions in Supabase.

### Rollback
If you need to rollback, you can manually drop the tables:
```sql
DROP TABLE IF EXISTS public.approved_emails CASCADE;
DROP TABLE IF EXISTS public.member_requests CASCADE;
```

## Next Steps After Migration

Once migrations are successfully applied:

1. Test the public application form at `/apply`
2. Test the admin approval workflow at `/member-requests`
3. Test Google OAuth login with approved emails
4. Verify unauthorized emails are blocked
5. Check that member records are auto-created on first login
