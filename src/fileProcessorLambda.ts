//import AWS from "aws-sdk";
import { S3Event } from "aws-lambda";
import AWS = require("aws-sdk");
import { APIGatewayProxyHandler } from 'aws-lambda';



const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

const bucketName = process.env.BUCKET_NAME; // S3 bucket name
const tableName = process.env.TABLE_NAME; // DynamoDB table name
const snsTopicArn = process.env.SNS_TOPIC_ARN; // SNS topic ARN

const allowedExtensions = ['.pdf', '.jpg', '.png'];

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Log the incoming request
    console.log("Event:", event);

    // Ensure the request is base64-encoded binary
    if (!event.body || !event.isBase64Encoded) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid file or encoding. Ensure the file is sent as base64." }),
      };
    }

    // Decode the base64-encoded file
    const fileBuffer = Buffer.from(event.body, "base64");

    // Extract content type from headers
    const contentType = event.headers["content-type"] || event.headers["Content-Type"];
    if (!contentType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Content-Type header is required." }),
      };
    }

    // Map Content-Type to file extension
    const extensionMap: { [key: string]: string } = {
      "application/pdf": ".pdf",
      "image/jpeg": ".jpg",
      "image/png": ".png",
    };
    const extension = extensionMap[contentType];

    // Validate the file extension
    if (!extension || !allowedExtensions.includes(extension)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Unsupported file type: ${contentType}` }),
      };
    }

    // Generate a unique key for the file in S3
    const fileKey = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}${extension}`;

    // Prepare upload parameters for S3
    const uploadParams: AWS.S3.PutObjectRequest = {
      Bucket: bucketName!,
      Key: fileKey,
      Body: fileBuffer,
      ContentType: contentType,
    };

    // Upload the file to S3
    await s3.putObject(uploadParams).promise();

    // Get file metadata
    const size = fileBuffer.length; // Size of the file in bytes
    const uploadDate = new Date().toISOString();

    // Save file metadata to DynamoDB
    await dynamodb
      .put({
        TableName: tableName!,
        Item: {
          FileKey: fileKey,
          FileExtension: extension,
          FileSize: size,
          ContentType: contentType,
          UploadDate: uploadDate,
        },
      })
      .promise();

    // Send an SNS notification
    const message = `File uploaded:\nKey: ${fileKey}\nExtension: ${extension}\nSize: ${size} bytes\nUpload Date: ${uploadDate}`;
    await sns
      .publish({
        TopicArn: snsTopicArn!,
        Message: message,
      })
      .promise();

    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "File uploaded successfully!", fileKey }),
    };
  } catch (error) {
    console.error("Error processing file:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to upload file" }),
    };
  }
};




