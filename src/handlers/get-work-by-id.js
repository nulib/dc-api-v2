const index = process.env.INDEX;

/**
 * A simple function to get a work by id
 */
exports.getByIdHandler = async (event) => {
  if (event.httpMethod !== "GET") {
    throw new Error(
      `getMethod only accept GET method, you tried: ${event.httpMethod}`
    );
  }
  // All log statements are written to CloudWatch
  console.info("received event:", event);

  // Get work id from pathParameters from APIGateway because of `/works/{id}` at template.yaml
  const id = event.pathParameters.id;

  console.log("id", id);

  const response = {
    statusCode: 200,
    body: JSON.stringify({ id: id }),
  };

  console.info(
    `response from: ${event.path} statusCode: ${response.statusCode} body: ${response.body}`
  );
  return response;
};
