/* istanbul ignore file */
const { S3Client, CopyObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

module.exports.handler = async (event) => {
  const region = process.env.AWS_REGION || 'us-east-1';
  const { bucket, key } = event;
  const s3Client = new S3Client({ region });
  const head = await s3Client.send(new HeadObjectCommand({Bucket: bucket, Key: key}));
  if (!head.ContentDisposition || !head.ContentDisposition.includes('attachment')) {
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: key,
        CopySource: `${bucket}/${key}`,
        ACL: "public-read",
        ContentDisposition: `attachment; filename=${event.disposition}`,
        MetadataDirective: "REPLACE"
      })
    );
  }
  const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

  return {downloadLink: url}
};


