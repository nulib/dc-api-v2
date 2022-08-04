class RequestPipeline {
  constructor(body) {
    this.body = body;
  }

  toJson() {
    return JSON.stringify(this.body);
  }
}