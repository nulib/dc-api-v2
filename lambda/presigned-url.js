const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

module.exports.handler = async (event) => {

  console.log("PRESIGNED URL LAMBDA")
  console.log(event)

  const clientParams = {}

  const getObjectParams = {
    "Bucket": event.bucket,
    "Key": event.key
  }

  const client = new S3Client(clientParams);
  const command = new GetObjectCommand(getObjectParams);
  const url = await getSignedUrl(client, command, { expiresIn: 3600 });

  console.log("url", url)

  return {presignedUrl: url}
  
};


