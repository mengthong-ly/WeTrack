-- Everything that exists today counts as seen, so Home starts empty instead of flagging every task.
INSERT INTO "task_view" ("task_id", "user_id", "viewed_at")
SELECT "task_id", "user_id", now() FROM "task_assignee"
UNION
SELECT "id", "created_by_id", now() FROM "task" WHERE "created_by_id" IS NOT NULL
ON CONFLICT DO NOTHING;
