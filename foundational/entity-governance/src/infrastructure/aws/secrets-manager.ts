/**
 * AWS Secrets Manager Integration
 *
 * Retrieves database credentials from Secrets Manager at runtime.
 * Used in production to avoid storing credentials in environment variables.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { env } from '../../env.js';

interface DatabaseCredentials {
  username: string;
  password: string;
  host: string;
  port: number;
  database: string;
  url: string;
}

let client: SecretsManagerClient | null = null;
let cachedCredentials: DatabaseCredentials | null = null;

function getClient(): SecretsManagerClient {
  if (!client) {
    client = new SecretsManagerClient({ region: env.AWS_REGION });
  }
  return client;
}

/**
 * Retrieves database credentials from AWS Secrets Manager.
 * Credentials are cached after first retrieval.
 */
export async function getDatabaseCredentials(): Promise<DatabaseCredentials> {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  const secretArn = env.AWS_SECRET_ARN;

  // If no secret ARN is configured, fall back to DATABASE_URL
  if (!secretArn) {
    return {
      username: '',
      password: '',
      host: '',
      port: 5432,
      database: '',
      url: env.DATABASE_URL,
    };
  }

  const command = new GetSecretValueCommand({ SecretId: secretArn });
  const response = await getClient().send(command);

  if (!response.SecretString) {
    throw new Error('Secret value is empty');
  }

  cachedCredentials = JSON.parse(response.SecretString) as DatabaseCredentials;
  return cachedCredentials;
}

/**
 * Gets the database URL, either from Secrets Manager or environment.
 */
export async function getDatabaseUrl(): Promise<string> {
  const credentials = await getDatabaseCredentials();
  return credentials.url;
}

/**
 * Clears the cached credentials. Useful for testing or credential rotation.
 */
export function clearCredentialsCache(): void {
  cachedCredentials = null;
}
