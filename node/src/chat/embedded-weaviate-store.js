const { WeaviateStore } = require("langchain/vectorstores/weaviate");
const { Document } = require("langchain/document");

class EmbeddedWeaviateStore extends WeaviateStore {
  constructor(...args) {
    super(...args);
  }

  async similaritySearch(query, k = 4, filter = undefined) {
    try {
      let builder = await this.client.graphql
        .get()
        .withClassName(this.indexName)
        .withFields(this.queryAttrs.join(" "))
        .withNearText({
          concepts: [query],
        })
        .withLimit(k);

      if (filter?.where) {
        builder = builder.withWhere(filter.where);
      }

      const result = await builder.do();

      const documents = [];
      for (const data of result.data.Get[this.indexName]) {
        const { [this.textKey]: text, ...rest } = data;

        documents.push(
          new Document({
            pageContent: text,
            metadata: rest,
          })
        );
      }
      return documents;
    } catch (e) {
      throw Error(`'Error in similaritySearch' ${e}`);
    }
  }

  async similaritySearchWithScore(query, k = 4, filter = undefined) {
    try {
      let builder = await this.client.graphql
        .get()
        .withClassName(this.indexName)
        .withFields(`${this.queryAttrs.join(" ")} _additional { distance }`)
        .withNearText({
          concepts: [query],
        })
        .withLimit(k);

      if (filter?.where) {
        builder = builder.withWhere(filter.where);
      }

      const result = await builder.do();

      const documents = [];
      for (const data of result.data.Get[this.indexName]) {
        const { [this.textKey]: text, _additional, ...rest } = data;

        documents.push([
          new Document({
            pageContent: text,
            metadata: rest,
          }),
          _additional.distance,
        ]);
      }
      return documents;
    } catch (e) {
      throw Error(`'Error in similaritySearch' ${e}`);
    }
  }
}

module.exports = { EmbeddedWeaviateStore };
