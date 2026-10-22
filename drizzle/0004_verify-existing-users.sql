-- Password sign-in now requires a confirmed email. Accounts made before that came through the
-- setup link or an emailed invite id, so their addresses are already proven: keep them signed in.
UPDATE "user" SET "email_verified" = true WHERE "email_verified" = false;
