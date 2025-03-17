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

  upload.on("end", ({ loaded, total, part, Key, Bucket }) => {
    console.log(`Uploaded ${total} bytes in ${part} parts to s3://${Bucket}/${Key}`);
  });

  try {
    ffmpeg({ logger: console })
      .input(url)
      .inputOptions(inputOptions)
      .format("mp3")
      .output(pass, { end: false })
      .on('start', function(commandLine) {
        console.log('Spawned Ffmpeg with command: ' + commandLine);
      })
      .on("error", (error) => {
        console.error("ffmpeg error", error);
      })
      .on("end", () => {
        console.log("ffmpeg finished");
        pass.end();
      })
      .on("*", (event, ...args) => {
        console.log('ffmpeg fired event:', event, 'with', args);
      })
      .run();
  } catch (error) {
    console.error("ffmpeg error", error);
    reject(error);
  }

  await upload.done();
  return { status: 200, message: 'done' };
}