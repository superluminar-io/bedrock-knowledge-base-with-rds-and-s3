import * as cdk from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { Construct } from 'constructs';

interface AgentKnowledgebaseTestProps extends cdk.StackProps {
    agentAlias: bedrock.CfnAgentAlias;
}

export class AgentKnowledgebaseTest extends cdk.Stack {
    constructor(scope: Construct, id: string, props: AgentKnowledgebaseTestProps) {
        super(scope, id, props);

        const slackHandler = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'resolve-question', {
            runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
            entry: 'lambda/resolveQuestion.ts',
            memorySize: 256,
            timeout: Duration.seconds(30),
            environment: {
                BEDROCK_AGENT_ID: props.agentAlias.agentId,
                BEDROCK_AGENT_ALIAS_ID: props.agentAlias.attrAgentAliasId,
            },
        });

        slackHandler.role!.addToPrincipalPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeAgent'
            ],
            resources: [
                props.agentAlias.attrAgentAliasArn
            ],
        }));
    }
}