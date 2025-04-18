import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

interface BaselineProps extends cdk.StackProps {
}

export class Baseline extends cdk.Stack {

    vpc: ec2.IVpc;

    constructor(scope: Construct, id: string, props: BaselineProps) {
        super(scope, id, props);

        this.vpc = new ec2.Vpc(this, 'vpc', {
            vpcName: 'knowledgebase-vpc',
            maxAzs: 2,
            natGateways: 1,
            ipAddresses: cdk.aws_ec2.IpAddresses.cidr('10.0.0.0/20'),
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: 'public',
                    subnetType: ec2.SubnetType.PUBLIC,
                },
                {
                    cidrMask: 24,
                    name: 'private',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                },
            ]
        })
    }
}