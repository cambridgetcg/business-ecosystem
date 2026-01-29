/**
 * AWS Secrets Manager Integration
 * 
 * Retrieves database credentials and other secrets securely.
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { awsConfig } from './config.js';

const client = new SecretsManagerClient({ region: awsConfig.region });

export interface DatabaseCredentials {
  username: string;
  password: string;
  host: string;
  port: number;
  dbname: string;
}

let cachedCredentials: DatabaseCredentials | null = null;

export async function getDatabaseCredentials(): Promise<DatabaseCredentials> {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  const command = new GetSecretValueCommand({
    SecretId: awsConfig.secrets.databaseCredentials,
  });

  const response = await client.send(command);
  
  if (!response.SecretString) {
    throw new Error('Database credentials secret is empty');
  }

  cachedCredentials = JSON.parse(response.SecretString) as DatabaseCredentials;
  return cachedCredentials;
}

export function buildDatabaseUrl(creds: DatabaseCredentials): string {
  return `postgresql://${creds.username}:${creds.password}@${creds.host}:${creds.port}/${creds.dbname}`;
}
