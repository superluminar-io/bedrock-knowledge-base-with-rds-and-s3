import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { Construct, IDependable } from 'constructs';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';

type KnowledgebaseIngestionProps = {
    knowledgebaseDataSource: bedrock.CfnDataSource;
    knowledgebase: bedrock.CfnKnowledgeBase;
    dependencies: IDependable[];
}

export default class KnowledgebaseIngestion extends Construct {

    constructor(scope: Construct, id: string, props: KnowledgebaseIngestionProps) {
        super(scope, id);

        const physicalResourceId = cr.PhysicalResourceId.of(`knowledgebase-ingestion-${Date.now}`);

        const knowledgebaseIngestion = new cr.AwsCustomResource(this, 'knowledgebase-ingestion', {
            onUpdate: {
                service: 'bedrock-agent',
                action: 'startIngestionJob',
                parameters: {
                    'dataSourceId': props.knowledgebaseDataSource.attrDataSourceId,
                    'knowledgeBaseId': props.knowledgebase.attrKnowledgeBaseId,
                },
                physicalResourceId: physicalResourceId,
            },
            policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
                resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
            }),
        });

        knowledgebaseIngestion.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:*',
                'iam:CreateServiceLinkedRole',
                'iam:PassRole'
            ],
            resources: ['*'],
        }));

        knowledgebaseIngestion.node.addDependency(...props.dependencies);
    }
}

