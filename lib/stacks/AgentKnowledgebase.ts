import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy } from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { Construct } from 'constructs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as logs from 'aws-cdk-lib/aws-logs';
import KnowledgebaseIngestion from '../constructs/KnowledgebaseIngestion';
import KnowledgebaseAssociation from '../constructs/KnowledgebaseAssociation';
import PrepareAgent from '../constructs/PrepareAgent';
import S3Knowledgebase from '../constructs/S3Knowledgebase';

interface AgentKnowledgebaseProps extends cdk.StackProps {
    agent: bedrock.CfnAgent;
    agentRole: iam.IRole;
    embeddingModel: bedrock.FoundationModelIdentifier;
    cluster: rds.DatabaseCluster;
    enableLogging: boolean;
    contentPath: string;
}

export class AgentKnowledgebase extends cdk.Stack {
    agentAlias: bedrock.CfnAgentAlias

    constructor(scope: Construct, id: string, props: AgentKnowledgebaseProps) {
        super(scope, id, props);

        const knowledgebase = this.createKnowledgebase(props);
        const knowledgebaseDataSource = this.createKnowledgebaseDatasource(props, knowledgebase);

        if (props.enableLogging) {
            this.enableKnowledgeBaseLogging(knowledgebase);
        }

        const knowledgebaseIngestion = new KnowledgebaseIngestion(this, 'knowledgebase-ingestion', {
            knowledgebaseDataSource: knowledgebaseDataSource,
            knowledgebase: knowledgebase,
            dependencies: [knowledgebaseDataSource],
        })

        const knowledgebaseAssociation = new KnowledgebaseAssociation(this, 'knowledgebase-association', {
            agent: props.agent,
            knowledgebase: knowledgebase,
            dependencies: [knowledgebaseIngestion]
        })

        const prepareAgent = new PrepareAgent(this, 'prepare-agent', {
            agent: props.agent,
            dependencies: [knowledgebaseAssociation]
        });

        this.agentAlias = new bedrock.CfnAgentAlias(this, 'agent-alias', {
            agentAliasName: 'bedrock-agent-alias',
            agentId: props.agent.attrAgentId,
        })

        this.agentAlias.node.addDependency(prepareAgent);
    }

    private createKnowledgebaseDatasource(props: AgentKnowledgebaseProps, knowledgebase: bedrock.CfnKnowledgeBase) {
        const s3Knowledgebase = new S3Knowledgebase(this, 's3-knowledgebase', {
            contentPath: props.contentPath,
            knowledgebase: knowledgebase,
        });

        return s3Knowledgebase.datasource;
    }

    private createKnowledgebase(props: AgentKnowledgebaseProps) {
        return new bedrock.CfnKnowledgeBase(this, 'knowledgebase', {
            name: 's3-knowledgebase',
            roleArn: props.agentRole.roleArn,
            knowledgeBaseConfiguration: {
                type: 'VECTOR',
                vectorKnowledgeBaseConfiguration: {
                    embeddingModelArn: `arn:aws:bedrock:${this.region}::foundation-model/${props.embeddingModel.modelId}`,
                }
            },
            storageConfiguration: {
                type: 'RDS',
                rdsConfiguration: {
                    resourceArn: props.cluster.clusterArn,
                    credentialsSecretArn: props.cluster.secret!.secretArn!,
                    databaseName: 'postgres', // default db name
                    tableName: 'documents',
                    fieldMapping: {
                        primaryKeyField: 'id', // The name of the field in which Amazon Bedrock stores the ID for each entry.
                        metadataField: 'metadata', // The name of the field in which Amazon Bedrock stores metadata about the vector store.
                        textField: 'content', // The name of the field in which Amazon Bedrock stores the raw text from your data
                        vectorField: 'embedding' // The name of the field in which Amazon Bedrock stores the vector embeddings for your data sources.
                    },
                }
            },
        });
    }

    private enableKnowledgeBaseLogging(knowledgebase: bedrock.CfnKnowledgeBase) {
        const logGroup = new logs.LogGroup(this, 'knowledgebase-logs', {
            logGroupName: 'Bedrock/Knowledgebase',
            removalPolicy: RemovalPolicy.DESTROY,
            retention: logs.RetentionDays.ONE_WEEK,
        })

        const putDeliverySourceCustomResource = new cr.AwsCustomResource(this, 'put-delivery-source', {
            onCreate: {
                service: 'CloudwatchLogs',
                action: 'PutDeliverySource',
                parameters: {
                    logType: 'APPLICATION_LOGS',
                    name: 'knowledgebase-logs',
                    resourceArn: knowledgebase.attrKnowledgeBaseArn
                },
                physicalResourceId: cr.PhysicalResourceId.of('put-delivery-source'),
            },
            policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
                resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
            }),
        });

        const putDeliveryDestinationCustomResource = new cr.AwsCustomResource(this, 'put-delivery-destination', {
            onCreate: {
                service: 'CloudwatchLogs',
                action: 'PutDeliveryDestination',
                parameters: {
                    deliveryDestinationConfiguration: {
                        destinationResourceArn: logGroup.logGroupArn
                    },
                    name: 'knowledgebase-logs-delivery',
                    outputFormat: 'json',
                },
                physicalResourceId: cr.PhysicalResourceId.of('put-delivery-destination'),
            },
            policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
                resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
            }),
        });

        const createDeliveryCustomResource = new cr.AwsCustomResource(this, 'create-delivery', {
            onCreate: {
                service: 'CloudwatchLogs',
                action: 'CreateDelivery',
                parameters: {
                    deliverySourceName: putDeliverySourceCustomResource.getResponseField('deliverySource.name'),
                    deliveryDestinationArn: putDeliveryDestinationCustomResource.getResponseField('deliveryDestination.arn'),
                },
                physicalResourceId: cr.PhysicalResourceId.of('create-delivery'),
            },
            policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
                resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
            }),
        });

        createDeliveryCustomResource.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'logs:*',
            ],
            resources: ['*'],
        }));

        putDeliverySourceCustomResource.node.addDependency(knowledgebase);

        putDeliveryDestinationCustomResource.node.addDependency(
            knowledgebase,
            logGroup
        );

        createDeliveryCustomResource.node.addDependency(
            putDeliverySourceCustomResource,
            putDeliveryDestinationCustomResource
        );
    }
}