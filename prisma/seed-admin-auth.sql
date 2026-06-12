INSERT INTO "role" ("code", "name", "description", "isSystem")
VALUES
  ('super_admin', 'Super Admin', 'Full platform access (reserved)', true),
  ('admin', 'Admin', 'General admin access', true),
  ('viewer', 'Viewer', 'Read-only platform access', true)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "permission" ("code", "name", "description")
VALUES
  ('admin:access-dashboard', 'Access Dashboard', 'Can access admin dashboard routes.'),
  ('admin:create', 'Create Admin', 'Can create additional admin users.'),
  ('admin:manage', 'Manage Admins', 'Can manage admin accounts and assignments.'),
  ('admin:content-write', 'Write Public Content', 'Can edit public website management content.'),
  ('admin:content-read', 'Read Public Content', 'Can view public website management content.')
ON CONFLICT ("code") DO NOTHING;
