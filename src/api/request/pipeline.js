class RequestPipeline {
  constructor(body) {
    this.body = body;
  }

  // Things tranformer needs to do:
  // - not allow unpuplished or restricted items
  // - Reading room/IP (not in first iteration)
  // - Add `track_total_hits` to body of search (so we can get accurate hits.total.value)

  toJson() {
    return JSON.stringify(this.body);
  }
}