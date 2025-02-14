/* istanbul ignore file */
const { CreateJobCommand, MediaConvertClient } = require("@aws-sdk/client-mediaconvert");


module.exports.handler = async (event) => {
  const jobQueueArn = process.env.MEDIA_CONVERT_JOB_QUEUE_ARN;
  const iamRoleArn = process.env.MEDIA_CONVERT_ROLE_ARN;

  const params = {
    "Queue": jobQueueArn,
    "UserMetadata": {},
    "Role": iamRoleArn,
    "Settings": event.settings,
    "AccelerationSettings": {
      "Mode": "DISABLED"
    },
    "StatusUpdateInterval": "SECONDS_60",
    "Priority": 0
  }

  const job = await createJob(params);
  
  return {jobId: job.Job.Id, status: job.Job.Status}
};

async function createJob(params){
  const mediaConvertClient = new MediaConvertClient({endpoint: process.env.MEDIA_CONVERT_ENDPOINT});

  try {
    const data = await mediaConvertClient.send(new CreateJobCommand(params));
    return data
  } catch (err) {
    console.error("Error", err);
    return null;
  }

}

