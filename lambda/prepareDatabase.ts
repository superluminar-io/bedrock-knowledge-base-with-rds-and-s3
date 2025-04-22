import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Client } from 'pg';

type DatabaseSecret = {
    host: string;
    port: number;
    username: string;
    password: string;
}

const secretsManagerClient = new SecretsManagerClient();

export const handler = async function () {
    const { VECTOR_SIZE } = process.env;

    const secret = await secretsManagerClient.send(new GetSecretValueCommand({
        SecretId: process.env.DATABASE_SECRET_ARN
    }))
    const dbConnectionParameters = JSON.parse(secret.SecretString!) as DatabaseSecret;

    const client = new Client({
        host: dbConnectionParameters.host,
        port: dbConnectionParameters.port,
        user: dbConnectionParameters.username,
        password: dbConnectionParameters.password,
        connectionTimeoutMillis: 1000,
    });

    await client.connect();

    await client.query('CREATE EXTENSION IF NOT EXISTS vector;')
    await client.query(`CREATE TABLE IF NOT EXISTS documents
                        (
                            id uuid primary key,
                            metadata json,
                            content  text,
                            embedding vector(${VECTOR_SIZE})
                        );`);
    await client.query('CREATE INDEX ON documents USING gin (to_tsvector(\'simple\', content));');
    await client.query('CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops);');

    await client.end();
}