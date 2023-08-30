const { HttpResponseStream } = global.awslambda;

class MultiPartStream {
  constructor(stream) {
    if (stream) {
      this.boundary = `--stream-boundary-${Number(new Date())}`;
      this.stream = HttpResponseStream.from(stream, {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Expose-Headers": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "3600",
          "Content-Type": `multipart/mixed; boundary='${this.boundary}'`,
        },
      });
    }
  }

  newPart(headers) {
    if (!this.stream) return;
    const head = [this.boundary];
    for (const header in headers) {
      head.push(`${header}: ${headers[header]}`);
    }
    head.push("");
    this.write(head.join("\n"));
  }

  write(content) {
    if (!this.stream) return;
    this.stream.write(`${content.length.toString(16)}\r\n${content}\r\n`);
  }

  end() {
    if (!this.stream) return;
    this.stream.end();
  }
}

module.exports = MultiPartStream;
