const { CreateJobCommand, MediaConvertClient } = require("@aws-sdk/client-mediaconvert");

function template(fileInput, fileOutput)  {
  const jobQueueArn = process.env.MEDIA_CONVERT_JOB_QUEUE_ARN;
  const iamRoleArn = process.env.MEDIA_CONVERT_ROLE_ARN;

  return {
    "Queue": jobQueueArn,
    "UserMetadata": {},
    "Role": iamRoleArn,
    "Settings": {
      "TimecodeConfig": {
        "Source": "ZEROBASED"
      },
      "OutputGroups": [
        {
          "CustomName": "priv-s3",
          "Name": "File Group",
          "Outputs": [
            {
              "ContainerSettings": {
                "Container": "MP4",
                "Mp4Settings": {}
              },
              "VideoDescription": {
                "CodecSettings": {
                  "Codec": "H_264",
                  "H264Settings": {
                    "MaxBitrate": 5000000,
                    "RateControlMode": "QVBR",
                    "SceneChangeDetect": "TRANSITION_DETECTION"
                  }
                }
              },
              "AudioDescriptions": [
                {
                  "CodecSettings": {
                    "Codec": "AAC",
                    "AacSettings": {
                      "Bitrate": 96000,
                      "CodingMode": "CODING_MODE_2_0",
                      "SampleRate": 48000
                    }
                  }
                }
              ]
            }
          ],
          "OutputGroupSettings": {
            "Type": "FILE_GROUP_SETTINGS",
            "FileGroupSettings": {
              "Destination": fileOutput
            }
          }
        }
      ],
      "Inputs": [
        {
          "AudioSelectors": {
            "Audio Selector 1": {
              "DefaultSelection": "DEFAULT"
            }
          },
          "VideoSelector": {},
          "TimecodeSource": "ZEROBASED",
          "FileInput": fileInput
        }
      ]
    },
    "AccelerationSettings": {
      "Mode": "DISABLED"
    },
    "StatusUpdateInterval": "SECONDS_60",
    "Priority": 0
  }
}

// should probably take source, destination and Settings?
module.exports.handler = async (event) => {

  console.log("MEDIA CONVERT LAMBDA")
  console.log(event)
  console.log(event.source)

  const destination = `s3://${process.env.MEDIA_CONVERT_DESTINATION_BUCKET}/test`
  const params = template(event.source, destination)

  const jobId = await createJob(params);
  
  return {jobId: jobId, destination: destination}
};

async function createJob(params){
  const mediaConvertClient = new MediaConvertClient({endpoint: process.env.MEDIA_CONVERT_ENDPOINT});

  try {
    const data = await mediaConvertClient.send(new CreateJobCommand(params));
    console.log("Success! ", data);
    return data.Job.Id;
  } catch (err) {
    console.log("Error", err);
    return null;
  }

}

