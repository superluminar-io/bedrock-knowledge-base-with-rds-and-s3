#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Baseline } from '../lib/stacks/Baseline';
import { Agent } from '../lib/stacks/Agent';
import { AgentKnowledgebase } from '../lib/stacks/AgentKnowledgebase';
import { Persistence } from '../lib/stacks/Persistence';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { AgentKnowledgebaseTest } from '../lib/stacks/AgentKnowledgebaseTest';

const app = new cdk.App();

const defaultStackProperties = {
    env: {
        region: 'eu-central-1',
        account: 'YOUR_ACCOUNT_ID'
    },
    tags: {
        project: 'knowledgebase-example'
    }
} as const;

// Network setup
const baselineStack = new Baseline(app, 'knowledgebase-example-baseline', {
    ...defaultStackProperties,
});

// Database setup + Networking
const persistenceStack = new Persistence(app, 'knowledgebase-example-persistence', {
    vpc: baselineStack.vpc,
    vectorSize: 1536,
    ...defaultStackProperties,
})

// Agent setup
const agentStack = new Agent(app, 'knowledgebase-example-agent', {
    foundationModel: bedrock.FoundationModelIdentifier.ANTHROPIC_CLAUDE_3_5_SONNET_20240620_V1_0,
    cluster: persistenceStack.cluster,
    ...defaultStackProperties,
})

// Agent Knowledgebase + documents
const agentKnowledgebase = new AgentKnowledgebase(app, 'knowledgebase-example-agent-knowledgebase', {
    embeddingModel: bedrock.FoundationModelIdentifier.AMAZON_TITAN_EMBEDDINGS_G1_TEXT_V1,
    agent: agentStack.agent,
    agentRole: agentStack.agentRole,
    cluster: persistenceStack.cluster,
    contentPath: './documents',
    enableLogging: true,
    ...defaultStackProperties
})

// Agent Knowledgebase testing lambda
new AgentKnowledgebaseTest(app, 'knowledgebase-example-agent-knowledgebase-test', {
    agentAlias: agentKnowledgebase.agentAlias,
    ...defaultStackProperties
})