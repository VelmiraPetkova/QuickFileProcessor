import AWS = require("aws-sdk");

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.BUCKET_NAME!;

export const handler = async () => {
  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;

  try {
    // List objects in the bucket
    const objects = await s3
      .listObjectsV2({ Bucket: BUCKET_NAME })
      .promise();

    if (!objects.Contents || objects.Contents.length === 0) {
      console.log('No objects to clean up.');
      return;
    }

    const objectsToDelete = objects.Contents.filter((object) => {
      return object.LastModified && object.LastModified.getTime() < thirtyMinutesAgo;
    }).map((object) => ({ Key: object.Key! }));

    if (objectsToDelete.length > 0) {
      await s3
        .deleteObjects({
          Bucket: BUCKET_NAME,
          Delete: { Objects: objectsToDelete },
        })
        .promise();
      console.log(`Deleted ${objectsToDelete.length} objects.`);
    } else {
      console.log('No objects older than 30 minutes.');
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
};
