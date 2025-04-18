import { Construct } from 'constructs';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';

type PrepareDatabaseProps = {
    cluster: rds.DatabaseCluster;
    vectorSize: number;
    vpc: ec2.IVpc;
}

export default class PrepareDatabase extends Construct {

    constructor(scope: Construct, id: string, { cluster, vectorSize, vpc }: PrepareDatabaseProps) {
        super(scope, id);

        const clusterSecret = cluster.secret as secretsmanager.ISecret

        const prepareDatabaseLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'lambda', {
            functionName: 'knowledgebase-prepare-database-lambda',
            runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
            environment: {
                DATABASE_SECRET_ARN: clusterSecret.secretArn,
                VECTOR_SIZE: vectorSize.toString()
            },
            vpc: vpc,
            vpcSubnets: vpc.selectSubnets({ subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS }),
            entry: 'lambda/prepareDatabase.ts',
        });

        clusterSecret.grantRead(prepareDatabaseLambda);

        const role = new iam.Role(this, 'role', {
            roleName: 'knowledgebase-prepare-database-role',
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        })

        prepareDatabaseLambda.grantInvoke(role);

        const prepareDatabase = new cr.AwsCustomResource(this, 'custom-resource', {
            functionName: 'knowledgebase-prepare-database-custom-resource',
            policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
                resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
            }),
            onUpdate: {
                physicalResourceId: cr.PhysicalResourceId.of('prepare-database'),
                service: 'Lambda',
                action: 'invoke',
                parameters: {
                    FunctionName: prepareDatabaseLambda.functionName,
                }
            },
            role: role,
        });

        prepareDatabase.node.addDependency(
            cluster,
            clusterSecret,
            prepareDatabaseLambda
        );
    }
}