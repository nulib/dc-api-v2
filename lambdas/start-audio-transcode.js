const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
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

 return new Promise((resolve, reject) => {
   ffmpeg()
     .input(url)
     .inputOptions(inputOptions)
     .format('mp3')
     .output(pass, { end: true })
     .on('start', async () => {
       try {
         await s3Client.send(new PutObjectCommand({
           Bucket: bucket,
           Key: key,
           Body: pass
         }));
         resolve({ success: true });
       } catch (error) {
         console.error('upload failed', error);
         reject(error);
       }
     })
     .on('error', (error) => {
       console.error('ffmpeg error', error);
       reject(error);
     })
     .run();
 });
}