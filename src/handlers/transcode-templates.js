function transcodeSettings(fileInput, fileOutput) {
  return {
    TimecodeConfig: {
      Source: "ZEROBASED",
    },
    OutputGroups: [
      {
        CustomName: "priv-s3",
        Name: "File Group",
        Outputs: [
          {
            ContainerSettings: {
              Container: "MP4",
              Mp4Settings: {},
            },
            VideoDescription: {
              CodecSettings: {
                Codec: "H_264",
                H264Settings: {
                  MaxBitrate: 5000000,
                  RateControlMode: "QVBR",
                  SceneChangeDetect: "TRANSITION_DETECTION",
                },
              },
            },
            AudioDescriptions: [
              {
                CodecSettings: {
                  Codec: "AAC",
                  AacSettings: {
                    Bitrate: 96000,
                    CodingMode: "CODING_MODE_2_0",
                    SampleRate: 48000,
                  },
                },
              },
            ],
          },
        ],
        OutputGroupSettings: {
          Type: "FILE_GROUP_SETTINGS",
          FileGroupSettings: {
            Destination: fileOutput,
          },
        },
      },
    ],
    Inputs: [
      {
        AudioSelectors: {
          "Audio Selector 1": {
            DefaultSelection: "DEFAULT",
          },
        },
        VideoSelector: {},
        TimecodeSource: "ZEROBASED",
        FileInput: fileInput,
      },
    ],
  };
}

module.exports = { transcodeSettings };
