import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { Construct, IDependable } from 'constructs';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';

type PrepareAgentProps = {
    agent: bedrock.CfnAgent;
    dependencies: IDependable[];
}

export default class PrepareAgent extends Construct {

    constructor(scope: Construct, id: string, props: PrepareAgentProps) {
        super(scope, id);

        const prepareAgent = new cr.AwsCustomResource(this, 'prepare-agent', {
            onUpdate: {
                service: 'bedrock-agent',
                action: 'prepareAgent',
                parameters: {
                    agentId: props.agent.attrAgentId
                },
                physicalResourceId: cr.PhysicalResourceId.of('prepare-agent'),
            },
            policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
                resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
            }),
        });

        prepareAgent.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:prepareAgent',
                'iam:CreateServiceLinkedRole',
                'iam:PassRole',
                'lambda:*',
            ],
            resources: ['*'],
        }));

        prepareAgent.node.addDependency(...props.dependencies);
    }
}