
const { GetJobCommand, MediaConvertClient } = require("@aws-sdk/client-mediaconvert");

module.exports.handler = async (event) => {

  console.log("TRANSCODE COMPLETE LAMBDA")
  console.log("event.jobId", event.jobId)
  if(!event.jobId) return {success: false}
  
  const status = await checkJobStatus(event.jobId)

  return {status: status}
};

async function checkJobStatus(jobId){
  const mediaConvertClient = new MediaConvertClient({endpoint: process.env.MEDIA_CONVERT_ENDPOINT});

  // possible: "SUBMITTED" || "PROGRESSING" || "COMPLETE" || "CANCELED" || "ERROR"

  try {
    const data = await mediaConvertClient.send(new GetJobCommand({Id: jobId}));
    console.log(data);
    console.log("Job status: ", data.Job.Status)
    return data.Job.Status;
  } catch (err) {
    console.log("Error", err);
    return null;
  }

}