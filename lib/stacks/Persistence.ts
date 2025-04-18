import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import PrepareDatabase from '../constructs/PrepareDatabase';

interface PersistenceProps extends cdk.StackProps {
    vpc: ec2.IVpc
    vectorSize: number,
}

export class Persistence extends cdk.Stack {

    cluster: rds.DatabaseCluster
    clusterSecret: secretsmanager.ISecret

    constructor(scope: Construct, id: string, props: PersistenceProps) {
        super(scope, id, props);

        const securityGroup = this.createSecurityGroup(props.vpc);
        const cluster = this.createCluster(props.vpc, securityGroup);

        new PrepareDatabase(this, 'prepare-database', {
            cluster,
            vpc: props.vpc,
            vectorSize: props.vectorSize,
        });

        this.cluster = cluster;
        this.clusterSecret = cluster.secret as secretsmanager.ISecret;
    }

    private createCluster(vpc: ec2.IVpc, securityGroup: ec2.SecurityGroup) {
        return new rds.DatabaseCluster(this, 'database-cluster', {
            clusterIdentifier: 'knowledgebase-vector-store',
            vpc: vpc,
            vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }),
            engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_16_6 }),
            writer: rds.ClusterInstance.serverlessV2('writer', { publiclyAccessible: false }),
            readers: [
                rds.ClusterInstance.serverlessV2('reader1', { scaleWithWriter: true }),
                rds.ClusterInstance.serverlessV2('reader2'),
            ],
            serverlessV2MinCapacity: 2,
            serverlessV2MaxCapacity: 4,
            securityGroups: [securityGroup],
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            deletionProtection: false,
            enableDataApi: true,
        });
    }

    private createSecurityGroup(vpc: ec2.IVpc) {
        const securityGroup = new ec2.SecurityGroup(this, 'database-cluster-security-group', {
            securityGroupName: 'knowledgebase-cluster-security-group',
            vpc: vpc,
            allowAllOutbound: true,
        });

        securityGroup.addIngressRule(cdk.aws_ec2.Peer.anyIpv4(), cdk.aws_ec2.Port.tcp(5432));

        return securityGroup;
    }
}