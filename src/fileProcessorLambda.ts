//import AWS from "aws-sdk";
import { S3Event } from "aws-lambda";
import AWS = require("aws-sdk");
import { APIGatewayProxyHandler } from 'aws-lambda';


const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

const allowedExtensions = ['.pdf', '.jpg', '.png'];

export const handler = async (event: S3Event) => {
  try {
    for (const record of event.Records) {
      const bucket = record.s3.bucket.name;
      const key = record.s3.object.key;

      // Validate file extension
      const extension = key.slice(key.lastIndexOf('.')).toLowerCase();
      if (!allowedExtensions.includes(extension)) {
        console.error(`Invalid file extension: ${extension}`);
        return;
      }

      // Get file metadata
      const head = await s3.headObject({ Bucket: bucket, Key: key }).promise();
      const size = head.ContentLength || 0;
      const uploadDate = new Date().toISOString();

      // Save metadata to DynamoDB
      await dynamodb
        .put({
          TableName: process.env.TABLE_NAME!,
          Item: {
            FileExtension: extension,
            FileSize: size,
            UploadDate: uploadDate,
          },
        })
        .promise();

      // Notify via SNS
      const message = `File uploaded: \nExtension: ${extension}\nSize: ${size} bytes\nUpload Date: ${uploadDate}`;
      await sns
        .publish({
          TopicArn: process.env.SNS_TOPIC_ARN!,
          Message: message,
        })
        .promise();

      console.log(`Successfully processed file: ${key}`);
    }
  } catch (err) {
    console.error('Error processing file', err);
    throw err;
  }
};
