import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class RegularExamStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    // S3 Bucket for File Storage
    const fileBucket :cdk.aws_s3.Bucket = new s3.Bucket(this, 'FileBucket',{
      lifecycleRules: [{expiration: cdk.Duration.minutes(30)}]
    });




  }
}
