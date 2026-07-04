export class NotConfiguredError extends Error {
  constructor() {
    super("Workit is not configured. Run `workit init` first.");
    this.name = "NotConfiguredError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ProfileNotFoundError extends Error {
  constructor(profileName: string) {
    super(`Profile "${profileName}" not found. Run \`workit config\` to see available profiles.`);
    this.name = "ProfileNotFoundError";
  }
}

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationError";
  }
}
