const AWS = require('aws-sdk');
const ffmpeg = require('fluent-ffmpeg');
const stream = require('stream');

module.exports.handler = async (event) => {
  
  const s3 = new AWS.S3();
  const url = event.streamingUrl;
  const referer = event.referer || null;
  const inputOptions = referer ? ["-referer", referer] : [];
  const bucket = event.destinationBucket;
  const key = event.destinationKey;
  const pass = new stream.PassThrough();

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(url)
      .inputOptions(inputOptions)
      .format('mp3')
      .output(pass, { end: true })
      .on('start', () => {
        s3.upload({
          Bucket: bucket,
          Key: key,
          Body: pass,
        }, (error, _data) => {
          if (error) {
            console.error('upload failed', error);
            reject(error);
          } else {
            resolve({ success: true });
          }
        });
      })
      .on('error', (error) => {
        console.error('ffmpeg error', error);
        reject(error);
      })
      .run();
  });
}