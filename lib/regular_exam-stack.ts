import * as cdk from 'aws-cdk-lib';
import {aws_apigateway} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import {RestApi} from "aws-cdk-lib/aws-apigateway";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {Runtime} from "aws-cdk-lib/aws-lambda";
import {AttributeType, Table,BillingMode} from "aws-cdk-lib/aws-dynamodb";
import {Subscription, SubscriptionProtocol, Topic} from "aws-cdk-lib/aws-sns";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3Notifications from 'aws-cdk-lib/aws-s3-notifications';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';

// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class RegularExamStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


// S3 Bucket for File Storage
    const fileBucket :cdk.aws_s3.Bucket = new s3.Bucket(this, 'FileBucket',{
       removalPolicy: cdk.RemovalPolicy.DESTROY,
    });


// DynamoDB Table for Metadata
    const metadataTable:cdk.aws_dynamodb.Table= new Table(this,'metadataTable',{
      partitionKey:{
            name:'FileExtension',
            type: AttributeType.STRING},
      sortKey: {
            name: 'UploadDate',
            type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

  // SNS Topic for Notifications
    const snsTopic = new Topic(this, 'snsTopic',
        {topicName:'snsTopic'});

  // New Subscription
    new Subscription(this,'snsSubscriptions',{
        topic: snsTopic,
        protocol: SubscriptionProtocol.EMAIL,
        endpoint: 'velmira.cacc@gmail.com'
    });

  // Lambda Function for File Processing
    const fileProcessorLambda:cdk.aws_lambda_nodejs.NodejsFunction = new NodejsFunction(this,'fileProcessorLambda',{
      runtime: Runtime.NODEJS_20_X,
      handler: 'handler',
      entry:`${__dirname}/../src/fileProcessorLambda.ts`,
      environment: {
        BUCKET_NAME: fileBucket.bucketName,
        TABLE_NAME: metadataTable.tableName,
        SNS_TOPIC_ARN: snsTopic.topicArn,},
    });

// Grant permissions to Lambda
    fileBucket.grantReadWrite(fileProcessorLambda);
    metadataTable.grantWriteData(fileProcessorLambda);
    snsTopic.grantPublish(fileProcessorLambda);


// IAM Policy for file validation
    fileProcessorLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject', 's3:GetObject', 's3:DeleteObject'],
        resources: [`${fileBucket.bucketArn}/*`],
      })
    );


// API Gateway for File Upload
    const api: cdk.aws_apigateway.RestApi = new RestApi(this,'FileUploadAPI', {
      restApiName: 'File Upload Service'
    });

    const uploadResource: cdk.aws_apigateway.Resource = api.root.addResource('upload');
    uploadResource.addMethod('POST', new aws_apigateway.LambdaIntegration(fileProcessorLambda));

// Add S3 Event Notification for Lambda
    fileBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3Notifications.LambdaDestination(fileProcessorLambda)
    );

// Lambda Function for Auto-Deleting Files Older Than 30 Minutes
    const cleanupLambda:cdk.aws_lambda_nodejs.NodejsFunction = new NodejsFunction(this,'cleanupLambda',{
      runtime: Runtime.NODEJS_20_X,
      handler: 'handler',
      entry:`${__dirname}/../src/cleanupLambda.ts`,
      environment: {
        BUCKET_NAME: fileBucket.bucketName,},
    });

// Grant Cleanup Lambda Permissions to Delete Objects
    fileBucket.grantReadWrite(cleanupLambda);

// Schedule Cleanup Lambda to Run Every 15 Minutes
    const rule = new events.Rule(this, 'CleanupSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(30)),
    });
    rule.addTarget(new eventsTargets.LambdaFunction(cleanupLambda));

// Outputs
    new cdk.CfnOutput(this, 'APIEndpoint', {
      value: api.url,
      description: 'The API endpoint for file uploads',
    });
    new cdk.CfnOutput(this, 'S3BucketName', {
      value: fileBucket.bucketName,
      description: 'The name of the S3 bucket for uploaded files',
    });
  }

}
