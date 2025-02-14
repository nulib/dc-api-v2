/* istanbul ignore file */
const { SESClient, SendTemplatedEmailCommand } = require("@aws-sdk/client-ses");

module.exports.handler = async (event) => {

  const sesClient = new SESClient();
  const templateName = event.template;
  const toAddress = event.to;
  const fromAddress = event.from;

  const params = event.params
  const sendTemplatedEmailCommand = createSendTemplatedEmailCommand(
    toAddress,
    fromAddress,
    templateName,
    params
  );

  try {
    await sesClient.send(sendTemplatedEmailCommand);
  } catch (err) {
    console.error("Failed to send template email", err);
    return err;
  }
  return {success: true}
};


const createSendTemplatedEmailCommand = (
  toAddress,
  fromAddress,
  templateName,
  params
) => {
  return new SendTemplatedEmailCommand({
    Destination: { ToAddresses: [toAddress] },
    TemplateData: JSON.stringify(params),
    Source: `Northwestern University Libraries <${fromAddress}>`,
    Template: templateName,
  });
};
