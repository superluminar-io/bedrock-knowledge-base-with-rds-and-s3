import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

interface AgentProps extends cdk.StackProps {
    foundationModel: bedrock.FoundationModelIdentifier;
    cluster: rds.DatabaseCluster,
}

export class Agent extends cdk.Stack {
    agent: bedrock.CfnAgent
    agentRole: iam.IRole

    constructor(scope: Construct, id: string, props: AgentProps) {
        super(scope, id, props);

        const agentRole = this.createAgentRole();
        const agent = this.createAgent(props.foundationModel, agentRole);

        props.cluster.grantDataApiAccess(agentRole);

        this.agent = agent;
        this.agentRole = agentRole;
    }

    private createAgent(foundationModel: bedrock.FoundationModelIdentifier, agentRole: iam.IRole) {
        return new bedrock.CfnAgent(this, 'agent', {
            agentName: 'example-agent',
            instruction: 'You are an AI assistant specializing in answering HR-related questions strictly based on the company\'s official knowledge base.' +
                'Your responses must be exclusively derived from the information available in the knowledge base.' +
                'Do not use external sources, speculate, or make assumptions.' +
                'If a question cannot be answered using the provided documents, clearly state that the information is not available.' +
                'Maintain a professional, concise, and helpful tone while ensuring compliance with company policies and best practices.',
            autoPrepare: true,
            foundationModel: foundationModel.modelId,
            agentResourceRoleArn: agentRole.roleArn
        });
    }

    private createAgentRole() {
        const agentRole = new iam.Role(this, 'agent-role', {
            roleName: 'knowledgebase-agent-role',
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
        })

        // todo: narrow for prod usage
        agentRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:*',
            ],
            resources: ['*'],
        }))

        // todo: narrow for prod usage
        agentRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                's3:GetBucketLocation',
                's3:GetObject',
                's3:ListBucket',
                's3:ListBucketMultipartUploads',
                's3:ListMultipartUploadParts',
                's3:AbortMultipartUpload',
                's3:CreateBucket',
                's3:PutObject',
                's3:PutBucketLogging',
                's3:PutBucketVersioning',
                's3:PutBucketNotification',
            ],
            resources: ['*'],
        }))

        // todo: narrow for prod usage
        agentRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'rds:*',
            ],
            resources: ['*'],
        }))

        return agentRole;
    }
}