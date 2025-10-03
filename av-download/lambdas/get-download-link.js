/* istanbul ignore file */
const { S3Client, PutObjectAclCommand } = require('@aws-sdk/client-s3');

module.exports.handler = async (event) => {
  const region = process.env.AWS_REGION || 'us-east-1';
  const { bucket, key } = event;
  const s3Client = new S3Client({ region });
  const command = new PutObjectAclCommand({
    Bucket: bucket,
    Key: key,
    ACL: 'public-read'
  });
  await s3Client.send(command);
  const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

  return {downloadLink: url}
};


