const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const ffmpeg = require('fluent-ffmpeg');
const stream = require('stream');

module.exports.handler = async (event) => {
  const s3Client = new S3Client();
  const url = event.streamingUrl;
  const referer = event.referer || null;
  const inputOptions = referer ? ["-referer", referer] : [];
  const bucket = event.destinationBucket;
  const key = event.destinationKey;
  const pass = new stream.PassThrough();
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: pass,
      ContentType: 'audio/mp3'
    }
  });

  const ffmpegPromise = new Promise((resolve, reject) => {
    try {
      ffmpeg()
        .input(url)
        .inputOptions(inputOptions)
        .format("mp3")
        .output(pass, { end: true })
        .on("error", (error) => {
          console.error("ffmpeg error", error);
          reject(error);
        })
        .run();
      resolve();
    } catch (error) {
      console.error("ffmpeg error", error);
      reject(error);
    }
  });

  await ffmpegPromise;
  await upload.done();
  return { status: 200, message: 'done' };
}