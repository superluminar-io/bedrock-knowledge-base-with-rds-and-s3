import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { Construct, IDependable } from 'constructs';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';

type KnowledgebaseAssociationProps = {
    agent: bedrock.CfnAgent;
    knowledgebase: bedrock.CfnKnowledgeBase;
    dependencies: IDependable[];
}

export default class KnowledgebaseAssociation extends Construct {

    constructor(scope: Construct, id: string, props: KnowledgebaseAssociationProps) {
        super(scope, id);

        const knowledgebaseAssociation = new cr.AwsCustomResource(this, 'knowledgebase-association', {
            onCreate: {
                service: 'bedrock-agent',
                action: 'AssociateAgentKnowledgeBase',
                parameters: {
                    'agentId': props.agent.attrAgentId,
                    'agentVersion': 'DRAFT',
                    'knowledgeBaseId': props.knowledgebase.attrKnowledgeBaseId,
                    'knowledgeBaseState': 'ENABLED',
                    'description': 'The Knowledge Base contains official company documents for internal inquiries.' +
                        'Answers must be strictly based on these documents.',
                },
                physicalResourceId: cr.PhysicalResourceId.of('knowledgebase-association'),
            },
            policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
                resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
            }),
        });

        knowledgebaseAssociation.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:AssociateAgentKnowledgeBase',
                'bedrock:DisassociateAgentKnowledgeBase',
                'iam:CreateServiceLinkedRole',
                'iam:PassRole',
                'lambda:invoke',
            ],
            resources: ['*'],
        }));

        knowledgebaseAssociation.node.addDependency(...props.dependencies);
    }
}
