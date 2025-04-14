/* istanbul ignore file */
const { GetJobCommand, MediaConvertClient } = require("@aws-sdk/client-mediaconvert");

module.exports.handler = async (event) => {
  if(!event.jobId) return {success: false}
  
  const status = await checkJobStatus(event.jobId)

  return {jobId: event.jobId, status: status, destination: event.destination}
};

async function checkJobStatus(jobId){
  const mediaConvertClient = new MediaConvertClient({endpoint: process.env.MEDIA_CONVERT_ENDPOINT});

  // possible: "SUBMITTED" || "PROGRESSING" || "COMPLETE" || "CANCELED" || "ERROR"

  try {
    const data = await mediaConvertClient.send(new GetJobCommand({Id: jobId}));
    return data.Job.Status;
  } catch (err) {
    console.error("Error", err);
    return null;
  }

}