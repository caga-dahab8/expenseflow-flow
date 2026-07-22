import { initialSchemaMigration } from "./001_initial_schema.js";
import { workspaceInvitationsMigration } from "./002_workspace_invitations.js";
import { authTokensMigration } from "./003_auth_tokens.js";

export const migrations = [
  initialSchemaMigration,
  workspaceInvitationsMigration,
  authTokensMigration,
];
