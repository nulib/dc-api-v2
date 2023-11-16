/* istanbul ignore file */
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

module.exports.handler = async (event) => {
  const clientParams = {}

  const getObjectParams = {
    Bucket: event.bucket,
    Key: event.key,
    ResponseContentDisposition: `attachment; filename=${event.disposition}`,
  };

  const client = new S3Client(clientParams);
  const command = new GetObjectCommand(getObjectParams);
  const url = await getSignedUrl(client, command, { expiresIn: 3600 * 24 * 3 }); // 3 days

  return {downloadLink: url}
  
};


