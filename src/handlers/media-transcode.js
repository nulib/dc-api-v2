const AWS = require("aws-sdk");

function template(fileInput)  {
  const jobQueueArn = process.env.MEDIA_CONVERT_JOB_QUEUE_ARN;
  const iamRoleArn = process.env.MEDIA_CONVERT_ROLE_ARN;
  const destination = `s3://${process.env.MEDIA_CONVERT_DESTINATION_BUCKET}/test`

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
              "Destination": destination
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


module.exports.handler = async (event) => {

  console.log("MEDIA CONVERT LAMBDA")
  console.log(event)
  console.log(event.s3Location)
  console.log(event.email)

  const params = template(event.s3Location)

  createJob(params);
  
  return {statusCode: 200}
};

function createJob(params){
  const mediaConvertEndpoint = process.env.MEDIA_CONVERT_ENDPOINT

  AWS.config.mediaconvert = {endpoint : mediaConvertEndpoint};
  var endpointPromise = new AWS.MediaConvert({apiVersion: '2017-08-29'}).createJob(params).promise();

  endpointPromise.then(
    function(data) {
      console.log("Job created ", data);
    },
    function(err) {
      console.log("Error", err);
    }
  );
  return;

}

