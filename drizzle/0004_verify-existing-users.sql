-- Password sign-in now requires a confirmed email. Accounts made before that came through the
-- setup link or an emailed invite id and are in a workspace, so their addresses are proven: keep
-- them signed in. Unconfirmed accounts from open sign-up can't sign in, so they can't be members,
-- which keeps this safe whether it runs before or after the deploy.
UPDATE "user" SET "email_verified" = true
WHERE "email_verified" = false AND "id" IN (SELECT "user_id" FROM "member");
