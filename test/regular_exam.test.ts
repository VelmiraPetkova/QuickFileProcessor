import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import {RegularExamStack} from "../lib/regular_exam-stack";
//import { RegularExamStack } from '../lib/regular-exam-stack';

describe('RegularExamStack Tests', () => {
  let app: cdk.App;

  beforeEach(() => {
    app = new cdk.App();
  });



  test('DynamoDB Table Created', () => {
    const stack = new RegularExamStack(app, 'MyTestStack');
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [
        { AttributeName: 'FileExtension', KeyType: 'HASH' },
        { AttributeName: 'UploadDate', KeyType: 'RANGE' },
      ],
    });
  });

  test('SNS Topic Created with Email Subscription', () => {
    const stack = new RegularExamStack(app, 'MyTestStack');
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: 'velmira.cacc@gmail.com',
    });

    template.hasResourceProperties('AWS::SNS::Topic', {});
  });



  test('API Gateway Created', () => {
    const stack = new RegularExamStack(app, 'MyTestStack');
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'File Upload Service',
    });

    template.resourceCountIs('AWS::ApiGateway::Resource', 1);
    template.resourceCountIs('AWS::ApiGateway::Method', 1);
  });


  test('Cleanup Lambda Scheduled Rule Created', () => {
    const stack = new RegularExamStack(app, 'MyTestStack');
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::Events::Rule', {
      ScheduleExpression: 'rate(30 minutes)',
    });
  });
});
