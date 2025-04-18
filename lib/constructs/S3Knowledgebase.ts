import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { RemovalPolicy } from 'aws-cdk-lib';

type S3KnowledgebaseProps = {
    knowledgebase: bedrock.CfnKnowledgeBase;
    contentPath: string,
}

export default class S3Knowledgebase extends Construct {

    datasource: bedrock.CfnDataSource;

    constructor(scope: Construct, id: string, props: S3KnowledgebaseProps) {
        super(scope, id);

        const knowledgebaseBucket = new s3.Bucket(this, 'knowledgebase-bucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        knowledgebaseBucket.grantRead(new iam.ServicePrincipal('bedrock.amazonaws.com'));

        new s3deploy.BucketDeployment(this, 'knowledgebase-bucket-deployment', {
            sources: [s3deploy.Source.asset(props.contentPath)],
            destinationBucket: knowledgebaseBucket,
            memoryLimit: 1024,
        });

        this.datasource = new bedrock.CfnDataSource(this, 'knowledgebase-data-source', {
            name: 'knowledgebase-s3',
            knowledgeBaseId: props.knowledgebase.attrKnowledgeBaseId,
            dataDeletionPolicy: 'RETAIN',
            dataSourceConfiguration: {
                s3Configuration: {
                    bucketArn: knowledgebaseBucket.bucketArn,
                },
                type: 'S3',
            },
            vectorIngestionConfiguration: {
                chunkingConfiguration: {
                    chunkingStrategy: 'FIXED_SIZE',
                    fixedSizeChunkingConfiguration: {
                        maxTokens: 300,
                        overlapPercentage: 20,
                    },
                },
            },
        });
    }
}
