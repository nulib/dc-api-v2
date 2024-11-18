from locust import HttpUser, task, between
import random

class DcApiUser(HttpUser):
  wait_time = between(1, 5)

  @task(1)
  def page_through_works(self):
    with self.client.rename_request("/search/works (paged)"):
      response = self.client.get('/search/works').json()
      for i in range(4):
        next_url = response['pagination']['next_url']
        response = self.client.get(next_url).json()

  @task(1)
  def search_works(self):
    with self.client.rename_request("/search/works with query (paged)"):
      query = { 'query': { 'term': { 'title': 'baez' } } }
      response = self.client.post('/search/works', json=query).json()
      for i in range(4):
        next_url = response['pagination']['next_url']
        response = self.client.get(next_url).json()

  @task(3)
  def load_collection_as_json(self):
    id = random.choice(self.collection_ids)
    self.client.get(f'/collections/{id}', name="/collections/:id")
    
  @task(3)
  def load_collection_as_iiif(self):
    id = random.choice(self.collection_ids)
    self.client.get(f'/collections/{id}?as=iiif', name="/collections/:id?as=iiif")

  @task(3)
  def load_work_as_json(self):
    id = random.choice(self.work_ids)
    self.client.get(f'/works/{id}', name="/works/:id")
    
  @task(3)
  def load_work_as_iiif(self):
    id = random.choice(self.work_ids)
    self.client.get(f'/works/{id}?as=iiif', name="/works/:id?as=iiif")
    
  @task(3)
  def load_work_thumbnail(self):
    id = random.choice(self.work_ids)
    self.client.get(f'/works/{id}/thumbnail', name="/works/:id/thumbnail")

  @task(3)
  def load_file_set(self):
    id = random.choice(self.file_set_ids)
    self.client.get(f'/file-sets/{id}', name="/file-sets/:id")
    
  def on_start(self):
    response = self.random_docs('works', include='id,file_sets.id')
    self.work_ids = [doc['id'] for doc in response['data']]
    self.file_set_ids = [file_set['id'] for item in response['data'] for file_set in item['file_sets']]
    self.collection_ids = [doc['id'] for doc in self.random_docs('collections')['data']]
    
  def random_docs(self, type, count=100, include='id'):
    query = {
      "size": count,
      "query": {
        "function_score": {
          "query": { "match_all": {} },
          "random_score": {}
        }
      }
    }
    
    response = self.client.post(f'/search/{type}?_source_includes={include}', json=query, name=f'Load {count} random {type}')
    json = response.json()
    return json
